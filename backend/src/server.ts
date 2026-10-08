import {createServer} from "node:http";
import {routeChat,validateChat} from "./router.js";
import {authenticate} from "./auth.js";
import {createDatabasePool,initializeDatabase} from "./db.js";
import {createPersistence} from "./persistence.js";
import {generateImage,transcribe,speak} from "./media.js";
import {createObjectStorage} from "./object-storage.js";

const port=Number(process.env.PORT||8787);
const pool=createDatabasePool();
const persistence=createPersistence(pool);
const {memory,credits,jobs}=persistence;
const objectStorage=createObjectStorage();

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
  const configuredOrigin=process.env.NEXORA_CORS_ORIGIN||"";
  const requestOrigin=req.headers.origin;
  if(requestOrigin&&configuredOrigin.split(",").map(x=>x.trim()).filter(Boolean).includes(requestOrigin)){
    res.setHeader("Access-Control-Allow-Origin",requestOrigin);
  }
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  if(req.method==="OPTIONS"){res.statusCode=204;return res.end();}
  if(req.url==="/health" && req.method==="GET"){return send(res,200,{ok:true,service:"nexora-ai-backend",storage:process.env.DATABASE_URL?"postgres":"memory"});}
  if(req.method!=="POST"){return send(res,405,{error:"Method not allowed"});}
  try{
    const authHeaders={"authorization":Array.isArray(req.headers.authorization)?req.headers.authorization[0]:req.headers.authorization};
    const auth=await authenticate(authHeaders);
    if(req.url==="/chat"){
      const input=validateChat(await body(req));
      return send(res,200,await routeChat(input));
    }
    if(req.url==="/credits"){
      const input=await body(req);
      if(input.action==="balance")return send(res,200,{balance:await credits.balance(auth.userId)});
      if(input.action==="apply"){
        return send(res,200,{entry:await credits.apply(auth.userId,Number(input.delta),String(input.reason||"adjustment"),String(input.idempotencyKey||""))});
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
    if(req.url==="/asset"){
      if(!objectStorage)throw new Error("Object storage is not configured");
      const input=await body(req);
      const key=String(input.key||"");
      if(!key||key.length>500||key.includes("..")||!key.startsWith(`${auth.userId}/`))throw new Error("Invalid asset key");
      return send(res,200,{url:await objectStorage.signedGet(key)});
    }
    if(req.url==="/jobs"){
      const input=await body(req);
      if(input.action==="create" && ["image","video","transcription","speech"].includes(input.kind)){
        return send(res,202,{job:await jobs.create(auth.userId,input.kind,input.metadata||{})});
      }
      if(input.action==="get")return send(res,200,{job:await jobs.get(auth.userId,String(input.id))||null});
      return send(res,400,{error:"Invalid job action"});
    }
    if(req.url==="/video"){
      const input=await body(req,2_000_000);
      const prompt=String(input.prompt||"");
      if(!prompt||prompt.length>32000)throw new Error("Invalid video prompt");
      return send(res,202,{job:await jobs.create(auth.userId,"video",{prompt,model:typeof input.model==="string"?input.model:undefined,duration:typeof input.duration==="string"?input.duration:undefined,continuity:input.continuity===true,characterConsistency:input.characterConsistency===true,voiceReference:input.voiceReference===true})});
    }
    if(["/tools","/integrations"].includes(req.url||"")){
      return send(res,501,{error:"Route scaffolded; connect the corresponding service adapter before production use."});
    }
    return send(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Request failed";
    const status=/Authentication required|Invalid development authentication token|Production authentication verifier|Authentication failed|Authenticated token/.test(message)?401:message==="Request too large"?413:400;
    return send(res,status,{error:message});
  }
});

async function start(){
  if(pool)await initializeDatabase(pool);
  server.listen(port,()=>console.log(`Nexora AI backend listening on :${port}`));
}
start().catch(error=>{console.error("Nexora backend startup failed",error);process.exit(1);});
