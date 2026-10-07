import {createServer} from "node:http";
import {routeChat,validateChat} from "./router.js";
import {authenticate} from "./auth.js";
import {listMemory,saveMemory,deleteMemory} from "./memory.js";
import {balance,applyCredit} from "./credits.js";
import {createJob,getJob,updateJob} from "./jobs.js";

const port=Number(process.env.PORT||8787);

function send(res:import("node:http").ServerResponse,status:number,data:unknown){
  res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(data));
}

async function body(req:import("node:http").IncomingMessage){
  let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>2_000_000)throw new Error("Request too large");}
  return JSON.parse(raw||"{}");
}

const server=createServer(async(req,res)=>{
  res.setHeader("Access-Control-Allow-Origin",process.env.NEXORA_CORS_ORIGIN||"*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  if(req.method==="OPTIONS"){res.statusCode=204;return res.end();}
  if(req.url==="/health" && req.method==="GET"){return send(res,200,{ok:true,service:"nexora-ai-backend"});}
  if(req.method!=="POST"){return send(res,405,{error:"Method not allowed"});}
  try{
    const authHeaders={"authorization":Array.isArray(req.headers.authorization)?req.headers.authorization[0]:req.headers.authorization};
    const auth=authenticate(authHeaders);
    if(req.url==="/chat"){
      const input=validateChat(await body(req));
      const result=await routeChat(input);
      return send(res,200,result);
    }
    if(req.url==="/credits"){
      const input=await body(req);
      if(input.action==="balance")return send(res,200,{balance:balance(auth.userId)});
      if(input.action==="apply")return send(res,200,{entry:applyCredit(auth.userId,Number(input.delta),String(input.reason||"adjustment"),String(input.idempotencyKey||""))});
      return send(res,400,{error:"Invalid credit action"});
    }
    if(req.url==="/memory"){
      const input=await body(req);
      if(input.action==="list")return send(res,200,{data:listMemory(auth.userId)});
      if(input.action==="save")return send(res,200,{data:saveMemory(auth.userId,input.content)});
      if(input.action==="delete")return send(res,200,{deleted:deleteMemory(auth.userId,input.id)});
      return send(res,400,{error:"Invalid memory action"});
    }
    if(req.url==="/jobs"){
      const input=await body(req);
      if(input.action==="create" && ["image","video","transcription","speech"].includes(input.kind))return send(res,202,{job:createJob(auth.userId,input.kind,input.metadata||{})});
      if(input.action==="get")return send(res,200,{job:getJob(auth.userId,String(input.id))||null});
      if(input.action==="update" && ["queued","running","completed","failed"].includes(input.status))return send(res,200,{job:updateJob(auth.userId,String(input.id),input.status)});
      return send(res,400,{error:"Invalid job action"});
    }
    if(["/image","/video","/tools","/voice/transcribe","/voice/speak","/integrations"].includes(req.url||"")){
      return send(res,501,{error:"Route scaffolded; connect the corresponding service adapter before production use."});
    }
    return send(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Request failed";
    return send(res,400,{error:message});
  }
});

server.listen(port,()=>console.log(`Nexora AI backend listening on :${port}`));
