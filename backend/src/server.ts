import {createServer} from "node:http";
import {routeChat,validateChat} from "./router.js";
import {authenticate} from "./auth.js";
import {createMemoryStore} from "./storage.js";
import {balance,applyCredit} from "./credits.js";
import {createJob,getJob,updateJob} from "./jobs.js";
import {generateImage,transcribe,speak} from "./media.js";

const port=Number(process.env.PORT||8787);
const memory=createMemoryStore();

function send(res:import("node:http").ServerResponse,status:number,data:unknown){
  res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(data));
}

async function body(req:import("node:http").IncomingMessage,maxBytes=2_000_000){
  let raw="";for await(const chunk of req){
    raw+=chunk;
    if(Buffer.byteLength(raw)>maxBytes)throw new Error("Request too large");
  }
  try{return JSON.parse(raw||"{}");}catch{throw new Error("Invalid JSON");}
}

const server=createServer(async(req,res)=>{
  const origin=process.env.NEXORA_CORS_ORIGIN;
  res.setHeader("Access-Control-Allow-Origin",origin||"*");
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  if(req.method==="OPTIONS"){res.statusCode=204;return res.end();}
  if(req.url==="/health" && req.method==="GET"){return send(res,200,{ok:true,service:"nexora-ai-backend",storage:process.env.DATABASE_URL?"postgres":"memory"});}
  if(req.method!=="POST"){return send(res,405,{error:"Method not allowed"});}
  try{
    const authHeaders={"authorization":Array.isArray(req.headers.authorization)?req.headers.authorization[0]:req.headers.authorization};
    const auth=authenticate(authHeaders);
    if(req.url==="/chat"){
      const input=validateChat(await body(req));
      return send(res,200,await routeChat(input));
    }
    if(req.url==="/credits"){
      const input=await body(req);
      if(input.action==="balance")return send(res,200,{balance:balance(auth.userId)});
      if(input.action==="apply"){
        return send(res,200,{entry:applyCredit(auth.userId,Number(input.delta),String(input.reason||"adjustment"),String(input.idempotencyKey||""))});
      }
      return send(res,400,{error:"Invalid credit action"});
    }
    if(req.url==="/memory"){
      const input=await body(req);
      if(input.action==="list")return send(res,200,{data:await memory.list(auth.userId)});
      if(input.action==="save"){
        const content=String(input.content||"");
        if(!content||content.length>20000)throw new Error("Invalid memory");
        return send(res,200,{data:await memory.save(auth.userId,content)});
      }
      if(input.action==="delete")return send(res,200,{deleted:await memory.delete(auth.userId,String(input.id||""))});
      return send(res,400,{error:"Invalid memory action"});
    }
    if(req.url==="/image"){
      const input=await body(req,2_000_000);
      return send(res,200,await generateImage(String(input.prompt||""),typeof input.model==="string"?input.model:undefined));
    }
    if(req.url==="/voice/transcribe"){
      const input=await body(req,36_000_000);
      return send(res,200,await transcribe(String(input.audioBase64||""),String(input.filename||"audio.webm")));
    }
    if(req.url==="/voice/speak"){
      const input=await body(req,100_000);
      return send(res,200,await speak(String(input.text||""),typeof input.voice==="string"?input.voice:undefined));
    }
    if(req.url==="/jobs"){
      const input=await body(req);
      if(input.action==="create" && ["image","video","transcription","speech"].includes(input.kind)){
        return send(res,202,{job:createJob(auth.userId,input.kind,input.metadata||{})});
      }
      if(input.action==="get")return send(res,200,{job:getJob(auth.userId,String(input.id))||null});
      if(input.action==="update" && ["queued","running","completed","failed"].includes(input.status)){
        return send(res,200,{job:updateJob(auth.userId,String(input.id),input.status)});
      }
      return send(res,400,{error:"Invalid job action"});
    }
    if(["/video","/tools","/integrations"].includes(req.url||"")){
      return send(res,501,{error:"Route scaffolded; connect the corresponding service adapter before production use."});
    }
    return send(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Request failed";
    const status=/Authentication required|Invalid development authentication token|Production authentication verifier/.test(message)?401:message==="Request too large"?413:400;
    return send(res,status,{error:message});
  }
});

server.listen(port,()=>console.log(`Nexora AI backend listening on :${port}`));
