import {createDatabasePool,initializeDatabase} from "./db.js";

const token=process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId=process.env.WHATSAPP_PHONE_NUMBER_ID;
const graphVersion=process.env.WHATSAPP_GRAPH_API_VERSION;
const language=process.env.WHATSAPP_TEMPLATE_LANGUAGE||"en";
const pollMs=Math.max(1000,Number(process.env.NEXORA_LEAVE_POLL_MS||5000));
if(!token||!phoneNumberId||!graphVersion)throw new Error("Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_GRAPH_API_VERSION for the leave notification worker.");
if(!/^v\\d+\\.\\d+$/.test(graphVersion))throw new Error("WHATSAPP_GRAPH_API_VERSION must look like vNN.NN.");

const pool=await createDatabasePool();
if(!pool)throw new Error("DATABASE_URL is required for the leave notification worker.");
await initializeDatabase(pool);

type Notification={id:string;recipient_phone_e164:string;template_name:string;payload:Record<string,unknown>;attempts:number};
const variables:Record<string,string[]> = {
  leave_request_submitted:["employeeName","category","startDate","endDate"],
  leave_request_approved:["decision","category","startDate","endDate"],
  leave_request_rejected:["decision","category","startDate","endDate"],
  leave_return_3_days:["resumptionDate"],
  leave_return_1_day:["resumptionDate"],
  leave_return_today:["resumptionDate"]
};
async function deliver(row:Notification){
  const names=variables[row.template_name];
  if(!names)throw new Error("No WhatsApp template variable mapping for "+row.template_name);
  const parameters=names.map(name=>({type:"text",text:String(row.payload[name]??"")}));
  const response=await fetch("https://graph.facebook.com/"+graphVersion+"/"+phoneNumberId+"/messages",{
    method:"POST",
    headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({messaging_product:"whatsapp",to:row.recipient_phone_e164,type:"template",template:{name:row.template_name,language:{code:language},components:[{type:"body",parameters}]}})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const err=(data as any)?.error;throw Object.assign(new Error(String(err?.message||"WhatsApp API request failed")), {code:String(err?.code||response.status)});}
  const messageId=(data as any)?.messages?.[0]?.id;
  if(typeof messageId!=="string")throw new Error("WhatsApp API returned no message ID.");
  await pool!.query("UPDATE nexora_leave_notifications SET status='sent',provider_message_id=$2,sent_at=NOW(),last_error=NULL,last_error_code=NULL,updated_at=NOW() WHERE id=$1",[row.id,messageId]);
}
async function tick(){
  const client=await pool!.connect();
  let rows:Notification[]=[];
  try{
    await client.query("BEGIN");
    const claimed=await client.query("WITH due AS (SELECT id FROM nexora_leave_notifications WHERE status='queued' AND scheduled_at<=NOW() AND channel='whatsapp' AND recipient_phone_e164 IS NOT NULL ORDER BY scheduled_at FOR UPDATE SKIP LOCKED LIMIT 10) UPDATE nexora_leave_notifications n SET status='sending',attempts=n.attempts+1,updated_at=NOW() FROM due WHERE n.id=due.id RETURNING n.id,n.recipient_phone_e164,n.template_name,n.payload,n.attempts");
    rows=claimed.rows as Notification[];
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  for(const row of rows){
    try{await deliver(row);}
    catch(error){
      const message=error instanceof Error?error.message:"Unknown WhatsApp delivery error";
      const code=error&&typeof error==="object"&&"code" in error?String((error as {code:unknown}).code):null;
      const permanent=Boolean(code&&["132000","132001","132005","131047","131026","131030"].includes(code));
      const exhausted=row.attempts>=5||permanent;
      const delay=Math.min(3600,30*Math.pow(2,Math.max(0,row.attempts-1)));
      await pool!.query("UPDATE nexora_leave_notifications SET status=$2,scheduled_at=CASE WHEN $2='queued' THEN NOW()+($3::text||' seconds')::interval ELSE scheduled_at END,last_error_code=$4,last_error=$5,updated_at=NOW() WHERE id=$1",[row.id,exhausted?"failed":"queued",delay,code,message.slice(0,1000)]);
      console.error("Leave notification delivery failed",JSON.stringify({notificationId:row.id,attempt:row.attempts,failedPermanently:exhausted,code}));
    }
  }
}
console.log("Nexora Leave Tracker WhatsApp worker started.");
while(true){try{await tick();}catch(error){console.error("Leave notification worker cycle failed",error instanceof Error?error.message:"unknown error");}await new Promise(resolve=>setTimeout(resolve,pollMs));}
