import type {ChatMessage,ModelSpec,ProviderId,ProviderResult} from "./types.js";
import {providerEnv} from "./registry.js";

function requireConfig(provider:ProviderId){const cfg=providerEnv(provider);if(!cfg.key)throw new Error(`Provider ${provider} is not configured`);return cfg;}
function modelName(spec:ModelSpec){return spec.id.split(":").slice(1).join(":");}

// Keep double asterisks only for standalone heading lines. Remove them from
// inline emphasis and ordinary prose, and never expose hash-based headings.
export function cleanGeneratedText(value:string){
  const normalized = value
    .replace(/\r\n?/g,"\n")
    .replace(/(^|\n)\s*#{1,6}\s+/g,"$1")
    .replace(/#{2,}/g,"")
    .replace(/__(.*?)__/gs,"$1")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,"$1$2")
    .replace(/(^|\n)\s*`{3,}[^\n]*\n/g,"$1")
    .replace(/\n\s*`{3,}\s*(?=\n|$)/g,"\n");
  return normalized.split("\n").map(line => {
    const match = line.match(/^(\s*)\*\*([^*\n]{2,100})\*\*(\s*)$/);
    if (!match) return line.replace(/\*\*(.*?)\*\*/g,"$1");
    const heading = match[2].trim();
    // Keep emphasis only for concise, standalone heading-like labels, not sentences.
    const headingLike = !/[.!?。！？]$/.test(heading) && heading.split(/\s+/).length <= 10;
    return headingLike ? line : line.replace(/\*\*(.*?)\*\*/g,"$1");
  }).join("\n").trim();
}
function cleanResult(result:ProviderResult):ProviderResult{
  return {...result,content:cleanGeneratedText(result.content)};
}
async function jsonFetch(url:string,init:RequestInit){
  const timeoutMs=Math.max(5000,Math.min(120000,Number(process.env.NEXORA_PROVIDER_TIMEOUT_MS||30000)));
  const signal=init.signal||AbortSignal.timeout(timeoutMs);
  const r=await fetch(url,{...init,signal,headers:{"Content-Type":"application/json",...(init.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.error?.message||data?.error||data?.message||`Provider request failed (${r.status})`);
  return data;
}
async function openAI(spec:ModelSpec,messages:ChatMessage[]):Promise<ProviderResult>{
  const {key,base}=requireConfig("openai");
  const url=(base||"https://api.openai.com/v1").replace(/\/$/,"")+"/responses";
  const input=messages.map(m=>({role:m.role,content:m.content}));
  const data=await jsonFetch(url,{method:"POST",headers:{Authorization:`Bearer ${key}`},body:JSON.stringify({model:modelName(spec),input})});
  const content=typeof data?.output_text==="string"?data.output_text:(data?.output||[]).flatMap((x:{content?:{type?:string,text?:string}[]})=>x.content||[]).filter((x:{type?:string})=>x.type==="output_text").map((x:{text?:string})=>x.text||"").join("");
  if(!content)throw new Error("Provider returned no assistant content");
  return {content,provider:"openai",model:spec.id};
}
function defaultBase(p:ProviderId){return ({xai:"https://api.x.ai/v1",deepseek:"https://api.deepseek.com/v1",mistral:"https://api.mistral.ai/v1"} as Record<string,string>)[p]||"";}
async function openAICompatible(spec:ModelSpec,messages:ChatMessage[]):Promise<ProviderResult>{
  const {key,base}=requireConfig(spec.provider);const url=(base||defaultBase(spec.provider)).replace(/\/$/,"")+"/chat/completions";
  const data=await jsonFetch(url,{method:"POST",headers:{Authorization:`Bearer ${key}`},body:JSON.stringify({model:modelName(spec),messages,stream:false})});
  const content=data?.choices?.[0]?.message?.content;if(typeof content!=="string")throw new Error("Provider returned no assistant content");
  return {content,provider:spec.provider,model:spec.id};
}
async function anthropic(spec:ModelSpec,messages:ChatMessage[]):Promise<ProviderResult>{
  const {key,base}=requireConfig("anthropic");const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
  const data=await jsonFetch((base||"https://api.anthropic.com").replace(/\/$/,"")+"/v1/messages",{method:"POST",headers:{"x-api-key":key!,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:modelName(spec),max_tokens:4096,system,messages:messages.filter(m=>m.role!=="system")})});
  const content=data?.content?.map((x:{type?:string,text?:string})=>x.type==="text"?x.text:"").join("")||"";if(!content)throw new Error("Provider returned no assistant content");
  return {content,provider:"anthropic",model:spec.id};
}
async function google(spec:ModelSpec,messages:ChatMessage[]):Promise<ProviderResult>{
  const {key,base}=requireConfig("google");
  const url=(base||"https://generativelanguage.googleapis.com/v1beta").replace(/\/$/,"")+"/interactions";
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n\n");
  const input=messages.filter(m=>m.role!=="system").map(m=>`[${m.role.toUpperCase()}]
${m.content}`).join("\n\n");
  const data=await jsonFetch(url,{method:"POST",headers:{"x-goog-api-key":key!},body:JSON.stringify({model:modelName(spec),input,...(system?{system_instruction:system}:{})})});
  const content=typeof data?.output_text==="string"?data.output_text:(data?.steps||[]).filter((s:{type?:string})=>s.type==="model_output").flatMap((s:{content?:{type?:string,text?:string}[]})=>s.content||[]).filter((x:{type?:string})=>x.type==="text").map((x:{text?:string})=>x.text||"").join("");
  if(!content)throw new Error(data?.errors?.map((e:{message?:string})=>e.message).filter(Boolean).join("; ")||"Google Interactions API returned no assistant content");
  return {content,provider:"google",model:spec.id};
}
export async function callProvider(spec:ModelSpec,messages:ChatMessage[]):Promise<ProviderResult>{
  if(spec.provider==="openai")return openAI(spec,messages).then(cleanResult);
  if(spec.provider==="anthropic")return anthropic(spec,messages).then(cleanResult);
  if(spec.provider==="google")return google(spec,messages).then(cleanResult);
  return openAICompatible(spec,messages).then(cleanResult);
}


/** Stream model deltas to the authenticated API client when the provider supports SSE. */
export async function callProviderStream(spec:ModelSpec,messages:ChatMessage[],onToken:(delta:string)=>void):Promise<ProviderResult>{
 const cfg=requireConfig(spec.provider);
 const model=modelName(spec);
 let url="",headers:Record<string,string>={},payload:Record<string,unknown>={};
 if(spec.provider==="openai"){
  url=(cfg.base||"https://api.openai.com/v1").replace(/\\/$/,"")+"/responses";
  headers={Authorization:"Bearer "+cfg.key};
  payload={model,input:messages.map(m=>({role:m.role,content:m.content})),stream:true};
 }else if(spec.provider==="anthropic"){
  url=(cfg.base||"https://api.anthropic.com").replace(/\\/$/,"")+"/v1/messages";
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\\n");
  headers={"x-api-key":cfg.key!,"anthropic-version":"2023-06-01"};
  payload={model,max_tokens:4096,system,messages:messages.filter(m=>m.role!=="system"),stream:true};
 }else if(spec.provider==="google"){
  url=(cfg.base||"https://generativelanguage.googleapis.com/v1beta").replace(/\\/$/,"")+"/interactions";
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\\n\\n");
  const input=messages.filter(m=>m.role!=="system").map(m=>`[${m.role.toUpperCase()}]\\n${m.content}`).join("\\n\\n");
  headers={"x-goog-api-key":cfg.key!};
  payload={model,input,stream:true,...(system?{system_instruction:system}:{})};
 }else{
  url=(cfg.base||defaultBase(spec.provider)).replace(/\\/$/,"")+"/chat/completions";
  headers={Authorization:"Bearer "+cfg.key};
  payload={model,messages,stream:true};
 }
 const timeoutMs=Math.max(5000,Math.min(120000,Number(process.env.NEXORA_PROVIDER_TIMEOUT_MS||30000)));
 const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Accept:"text/event-stream",...headers},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok){const detail=await response.text().catch(()=>"");throw new Error(detail.slice(0,500)||`Streaming provider request failed (${response.status})`);}
 if(!response.body||!(response.headers.get("content-type")||"").includes("text/event-stream")){
  throw new Error("Provider did not return a streaming response");
 }
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer="",full="";
 const emit=(block:string)=>{
  const data=block.split(/\\r?\\n/).filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trim()).join("\\n");
  if(!data||data==="[DONE]")return;
  let item:Record<string,any>;
  try{item=JSON.parse(data)}catch{return;}
  if(item.error)throw new Error(typeof item.error==="string"?item.error:JSON.stringify(item.error));
  let delta="";
  if(spec.provider==="openai")delta=typeof item.delta==="string"?item.delta:(typeof item.delta?.text==="string"?item.delta.text:"");
  else if(spec.provider==="anthropic")delta=item.type==="content_block_delta"&&item.delta?.type==="text_delta"?String(item.delta.text||""):"";
  else if(spec.provider==="google"){
   const candidate=item.delta??item.content_delta??item.text_delta??item;
   delta=typeof candidate==="string"?candidate:typeof candidate?.text==="string"?candidate.text:typeof candidate?.content==="string"?candidate.content:typeof candidate?.delta==="string"?candidate.delta:"";
  }else delta=typeof item.choices?.[0]?.delta?.content==="string"?item.choices[0].delta.content:"";
  if(delta){full+=delta;onToken(delta);}
 };
 try{
  while(true){
   const {done,value}=await reader.read();
   buffer+=decoder.decode(value,{stream:!done});
   const blocks=buffer.split(/\\r?\\n\\r?\\n/);buffer=blocks.pop()||"";
   for(const block of blocks)emit(block);
   if(done)break;
  }
  if(buffer.trim())emit(buffer);
 }finally{reader.releaseLock();}
 if(!full.trim())throw new Error("Provider stream returned no text");
 return cleanResult({content:full,provider:spec.provider,model:spec.id});
}
