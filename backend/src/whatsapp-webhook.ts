import {createHmac,timingSafeEqual} from "node:crypto";
import type {IncomingMessage,ServerResponse} from "node:http";
import type {Pool} from "pg";
import {appendAuditEvent} from "./leave.js";

async function readRawBody(req:IncomingMessage,limit=1_000_000):Promise<Buffer>{
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of req){
    const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    size+=bytes.length;
    if(size>limit)throw new Error("Webhook payload too large");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks,size);
}
function send(res:ServerResponse,status:number,body:string,contentType="application/json; charset=utf-8"){
  res.statusCode=status;res.setHeader("Content-Type",contentType);res.end(body);
}
function safeEqualHex(a:string,b:string){
  const left=Buffer.from(a,"utf8"),right=Buffer.from(b,"utf8");
  return left.length===right.length&&timingSafeEqual(left,right);
}

export async function handleWhatsAppWebhook(req:IncomingMessage,res:ServerResponse,pool:Pool|null):Promise<boolean>{
  const url=new URL(req.url||"/","http://localhost");
  if(url.pathname!=="/webhooks/whatsapp")return false;
  if(req.method==="GET"){
    const expected=process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const mode=url.searchParams.get("hub.mode"),token=url.searchParams.get("hub.verify_token"),challenge=url.searchParams.get("hub.challenge");
    if(mode==="subscribe"&&expected&&token===expected&&challenge){
      send(res,200,challenge,"text/plain; charset=utf-8");return true;
    }
    send(res,403,"Forbidden","text/plain; charset=utf-8");return true;
  }
  if(req.method!=="POST"){send(res,405,"Method not allowed","text/plain; charset=utf-8");return true;}
  if(!pool){send(res,503,JSON.stringify({error:"Webhook database is unavailable."}));return true;}
  const secret=process.env.WHATSAPP_APP_SECRET;
  const signature=req.headers["x-hub-signature-256"];
  if(!secret||typeof signature!=="string"||!signature.startsWith("sha256=")){
    send(res,401,JSON.stringify({error:"Webhook signature is missing or not configured."}));return true;
  }
  let raw:Buffer;
  try{raw=await readRawBody(req);}catch(error){
    send(res,error instanceof Error&&error.message==="Webhook payload too large"?413:400,JSON.stringify({error:"Invalid webhook payload."}));return true;
  }
  const expected="sha256="+createHmac("sha256",secret).update(raw).digest("hex");
  if(!safeEqualHex(signature,expected)){send(res,401,JSON.stringify({error:"Invalid webhook signature."}));return true;}
  let payload:any;
  try{payload=JSON.parse(raw.toString("utf8"));}catch{send(res,400,JSON.stringify({error:"Invalid JSON payload."}));return true;}
  let updated=0;
  try{
    const statuses:any[]=[];
    for(const entry of Array.isArray(payload.entry)?payload.entry:[]){
      for(const change of Array.isArray(entry?.changes)?entry.changes:[]){
        const values=change?.value?.statuses;
        if(Array.isArray(values))statuses.push(...values);
      }
    }
    for(const item of statuses){
      if(typeof item?.id!=="string"||typeof item?.status!=="string")continue;
      const status=String(item.status);
      if(!["sent","delivered","read","failed"].includes(status))continue;
      const errorInfo=Array.isArray(item.errors)?item.errors[0]:undefined;
      const errorCode=errorInfo?.code==null?null:String(errorInfo.code);
      const errorMessage=typeof errorInfo?.title==="string"?errorInfo.title:typeof errorInfo?.message==="string"?errorInfo.message:null;
      const result=await pool.query(
        "UPDATE nexora_leave_notifications SET status=CASE WHEN $2 IN ('delivered','read') THEN 'delivered' WHEN $2='failed' THEN 'failed' ELSE status END,delivered_at=CASE WHEN $2 IN ('delivered','read') THEN COALESCE(delivered_at,NOW()) ELSE delivered_at END,last_error_code=CASE WHEN $2='failed' THEN $3 ELSE last_error_code END,last_error=CASE WHEN $2='failed' THEN $4 ELSE last_error END,updated_at=NOW() WHERE provider_message_id=$1",
        [item.id,status,errorCode,errorMessage]
      );
      updated+=result.rowCount||0;
    }
    if(statuses.length){
      await appendAuditEvent(pool,{actorUserId:"whatsapp-webhook",action:"whatsapp.delivery_status.processed",resourceType:"whatsapp_notification",outcome:"success",details:{received:statuses.length,updated}});
    }
    send(res,200,JSON.stringify({received:true,updated}));return true;
  }catch(error){
    console.error("WhatsApp webhook processing failed",error instanceof Error?error.message:"unknown error");
    send(res,500,JSON.stringify({error:"Webhook processing failed."}));return true;
  }
}
