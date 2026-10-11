import {getAccessToken} from "./auth";

export type ChatMessage={id:string;role:"user"|"assistant";content:string;createdAt:string};
export type AIResponse={content?:string;message?:string;error?:string;job?:unknown;url?:string;imageUrl?:string;images?:string[];imageBase64?:string;mimeType?:string;data?:unknown};
const base=import.meta.env.VITE_NEXORA_AI_ENDPOINT||"/api/ai";
async function request(path:string,payload:unknown,signal?:AbortSignal):Promise<AIResponse>{
 const token=await getAccessToken();
 const headers:Record<string,string>={"Content-Type":"application/json"};
 if(token)headers["Authorization"]=["Bearer",token].join(" ");
 const r=await fetch(base.replace(/\/$/,"")+path,{method:"POST",headers,body:JSON.stringify(payload),signal});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||data.message||`AI request failed (${r.status})`);
 return data;
}
export const aiChat=(messages:ChatMessage[],model="auto",signal?:AbortSignal)=>request("/chat",{messages,model},signal);

/** Prefer genuine server-sent token updates; gracefully fall back to the existing JSON chat API. */
export async function aiChatStream(messages:ChatMessage[],model="auto",onToken?:(text:string)=>void,signal?:AbortSignal):Promise<AIResponse>{
 const token=await getAccessToken();
 const headers:Record<string,string>={"Content-Type":"application/json","Accept":"text/event-stream, application/json"};
 if(token)headers["Authorization"]=["Bearer",token].join(" ");
 let response:Response;
 try{response=await fetch(base.replace(/\/$/,"")+"/chat/stream",{method:"POST",headers,body:JSON.stringify({messages,model,stream:true}),signal});}
 catch(error){if(signal?.aborted)throw error;return aiChat(messages,model,signal);}
 if(!response.ok||!response.body)return aiChat(messages,model,signal);
 const type=response.headers.get("content-type")||"";
 if(!type.includes("text/event-stream")&&!type.includes("application/x-ndjson"))return aiChat(messages,model,signal);
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer="",content="";
 const consume=(raw:string)=>{
  for(const line of raw.split(/\r?\n/)){
   const row=line.trim();if(!row||row.startsWith(":"))continue;
   const payload=row.startsWith("data:")?row.slice(5).trim():row;if(payload==="[DONE]")continue;
   let piece="";
   try{const item=JSON.parse(payload) as {choices?:Array<{delta?:{content?:string};message?:{content?:string}}>;delta?:string;token?:string;content?:string;text?:string;error?:string};if(item.error)throw new Error(item.error);piece=item.choices?.[0]?.delta?.content??item.choices?.[0]?.message?.content??item.delta??item.token??item.content??item.text??"";}
   catch(error){if(error instanceof Error&&error.message!==payload)throw error;if(payload.startsWith("{")||payload.startsWith("["))continue;piece=payload;}
   if(piece){content+=piece;onToken?.(content);}
  }
 };
 try{while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split(/\r?\n/);buffer=lines.pop()||"";consume(lines.join("\n"));if(done)break;}if(buffer.trim())consume(buffer);}
 finally{reader.releaseLock();}
 if(!content)return aiChat(messages,model,signal);
 return {content};
}
export const generateImage=(prompt:string,options:Record<string,unknown>={},signal?:AbortSignal)=>request("/image",{prompt,...options},signal);
export const generateVideo=(prompt:string,options:Record<string,unknown>={},signal?:AbortSignal)=>request("/video",{prompt,...options},signal);
export const aiTool=(tool:string,input:unknown,signal?:AbortSignal)=>request("/tools",{tool,input},signal);
export const getMemory=()=>request("/memory",{action:"list"});
export const saveMemory=(content:string)=>request("/memory",{action:"save",content});
export const deleteMemory=(id:string)=>request("/memory",{action:"delete",id});
export const voiceTranscribe=(audioBase64:string)=>request("/voice/transcribe",{audioBase64});
export const voiceSpeak=(text:string,voice?:string)=>request("/voice/speak",{text,voice});
export const createJob=(kind:"image"|"video"|"transcription"|"speech"|"music",metadata:Record<string,unknown>={},signal?:AbortSignal)=>request("/jobs",{action:"create",kind,metadata},signal);
export const getJob=(id:string,signal?:AbortSignal)=>request("/jobs",{action:"get",id},signal);
export const getAsset=(key:string,signal?:AbortSignal)=>request("/asset",{key},signal);
export async function waitForJob(id:string,signal?:AbortSignal,timeoutMs=120000,onUpdate?:(status:string)=>void){
 const started=Date.now();
 while(Date.now()-started<timeoutMs){
  const r=await getJob(id,signal);
  const job=(r.job as {status:string;result?:unknown;error?:string}|undefined);
  if(job?.status==="completed")return job;
  if(job?.status==="failed")throw new Error(job.error||"Job failed");
  if(job?.status)onUpdate?.(job.status);
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error("Job timed out");
}
export const getIntegrations=()=>request("/integrations",{action:"list"});

export async function publishSite(name:string,html:string):Promise<{url?:string;message?:string}>{return request("/deploy/site",{name,html});}

export const leaveApi=(input:Record<string,unknown>):Promise<any>=>request("/leave",input);
