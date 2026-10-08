export type ChatMessage={id:string;role:"user"|"assistant";content:string;createdAt:string};
export type AIResponse={content?:string;message?:string;error?:string;job?:unknown;imageUrl?:string;images?:string[];data?:unknown};
const base=import.meta.env.VITE_NEXORA_AI_ENDPOINT||"/api/ai";
async function request(path:string,payload:unknown,signal?:AbortSignal):Promise<AIResponse>{
 const r=await fetch(base.replace(/\/$/,"")+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||data.message||`AI request failed (${r.status})`);
 return data;
}
export const aiChat=(messages:ChatMessage[],model="auto",signal?:AbortSignal)=>request("/chat",{messages,model},signal);
export const generateImage=(prompt:string,options:Record<string,unknown>={},signal?:AbortSignal)=>request("/image",{prompt,...options},signal);
export const generateVideo=(prompt:string,options:Record<string,unknown>={},signal?:AbortSignal)=>request("/video",{prompt,...options},signal);
export const aiTool=(tool:string,input:unknown,signal?:AbortSignal)=>request("/tools",{tool,input},signal);
export const getMemory=()=>request("/memory",{action:"list"});
export const saveMemory=(content:string)=>request("/memory",{action:"save",content});
export const deleteMemory=(id:string)=>request("/memory",{action:"delete",id});
export const voiceTranscribe=(audioBase64:string)=>request("/voice/transcribe",{audioBase64});
export const voiceSpeak=(text:string,voice?:string)=>request("/voice/speak",{text,voice});
export const createJob=(kind:"image"|"video"|"transcription"|"speech",metadata:Record<string,unknown>={},signal?:AbortSignal)=>request("/jobs",{action:"create",kind,metadata},signal);
export const getJob=(id:string,signal?:AbortSignal)=>request("/jobs",{action:"get",id},signal);
export const getAsset=(key:string,signal?:AbortSignal)=>request("/asset",{key},signal);
export async function waitForJob(id:string,signal?:AbortSignal,timeoutMs=120000){
 const started=Date.now();
 while(Date.now()-started<timeoutMs){
  const r=await getJob(id,signal);
  const job=(r.job as {status:string;result?:unknown;error?:string}|undefined);
  if(job?.status==="completed")return job;
  if(job?.status==="failed")throw new Error(job.error||"Job failed");
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error("Job timed out");
}
export const getIntegrations=()=>request("/integrations",{action:"list"});
