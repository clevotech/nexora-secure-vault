import {createServer} from "node:http";
import {routeChat,validateChat} from "./router.js";

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
    if(req.url==="/chat"){
      const input=validateChat(await body(req));
      const result=await routeChat(input);
      return send(res,200,result);
    }
    if(["/image","/video","/tools","/memory","/voice/transcribe","/voice/speak","/integrations"].includes(req.url||"")){
      return send(res,501,{error:"Route scaffolded; connect the corresponding service adapter before production use."});
    }
    return send(res,404,{error:"Not found"});
  }catch(error){
    const message=error instanceof Error?error.message:"Request failed";
    return send(res,400,{error:message});
  }
});

server.listen(port,()=>console.log(`Nexora AI backend listening on :${port}`));
