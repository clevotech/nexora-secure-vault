import {callProvider,callProviderStream} from "./providers.js";
import {MODELS,providerEnv,routeModel,findModel} from "./registry.js";
import type {ChatRequest,ProviderResult} from "./types.js";

function safeProviderFailure(error:unknown):string{
  const raw=error instanceof Error?error.message:String(error);
  return raw
    .replace(/(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+\S+)/g,"[redacted]")
    .replace(/([?&](?:key|api_key|token)=)[^&\s]+/gi,"$1[redacted]")
    .slice(0,240);
}

export async function routeChat(input:ChatRequest):Promise<ProviderResult>{
  const primary=routeModel(input.model,input.task||"chat");
  const configured=(spec:typeof MODELS[number])=>Boolean(providerEnv(spec.provider).key);
  // Treat every configured provider as a legitimate fallback. If Google/Gemini
  // reaches its quota, a configured OpenAI, Anthropic, xAI, DeepSeek, or Mistral
  // key can still serve the request. Provider errors are retained if all fail.
  const eligible=(spec:typeof MODELS[number])=>configured(spec);
  const ranked=[primary,...MODELS
    .filter(eligible)
    .sort((a,b)=>{
      const task=input.task||"chat";
      const aMatch=a.strengths.includes(task)?0:1;
      const bMatch=b.strengths.includes(task)?0:1;
      if(aMatch!==bMatch)return aMatch-bMatch;
      if(a.provider==="google"&&b.provider!=="google")return -1;
      if(b.provider==="google"&&a.provider!=="google")return 1;
      return a.speed==="fast"?-1:b.speed==="fast"?1:0;
    })]
    .filter((m,i,a)=>eligible(m)&&a.findIndex(x=>x.id===m.id)===i);
  // One model per provider and no more than three providers per request. This
  // keeps fallback useful without making a failed request wait for every model.
  const candidates=ranked.filter((spec,index,array)=>array.findIndex(x=>x.provider===spec.provider)===index).slice(0,3);
  if(!candidates.length)throw new Error("No AI provider is configured. Add a valid provider API key in Render environment settings.");
  const failures:string[]=[];
  let timeoutCount=0;
  for(const spec of candidates){
    try{return await callProvider(spec,input.messages);}
    catch(error){
      const isTimeout=error instanceof Error&&(error.name==="AbortError"||error.name==="TimeoutError");
      const reason=safeProviderFailure(error);
      failures.push(`${spec.provider} (${spec.id}): ${reason}`);
      console.warn("[Nexora AI] provider request failed",{
        provider:spec.provider,
        model:spec.id,
        failureType:isTimeout?"timeout":"provider_error",
        errorName:error instanceof Error?error.name:"UnknownError",
        failureReason:reason
      });
      if(isTimeout)timeoutCount++;
    }
  }
  if(timeoutCount===candidates.length)throw new Error("All attempted AI providers timed out. Check provider quotas, billing, and Render logs.");
  throw new Error("All attempted AI providers failed: "+failures.join(" | "));
}

export function validateChat(input:unknown):ChatRequest{
  if(!input || typeof input!=="object")throw new Error("Invalid request");
  const x=input as Partial<ChatRequest>;
  if(!Array.isArray(x.messages)||x.messages.length===0||x.messages.length>100)throw new Error("Invalid messages");
  const messages=x.messages.map(m=>{
    if(!m||!["system","user","assistant"].includes(m.role)||typeof m.content!=="string"||m.content.length>100000)throw new Error("Invalid messages");
    return {role:m.role,content:m.content};
  });
  const model=typeof x.model==="string"?x.model:"auto";
  if(model!=="auto"&&model!=="fast"&&model!=="reasoning"&&model!=="creative"&&!findModel(model))throw new Error("Unsupported model");
  const task=["chat","reasoning","coding","research","image","video","voice"].includes(x.task||"")?x.task:"chat";
  return {messages,model,task:task as ChatRequest["task"]};
}


/** Stream tokens from a configured provider, preserving the existing fallback router. */
export async function routeChatStream(input:ChatRequest,onToken:(delta:string)=>void):Promise<ProviderResult>{
 const primary=routeModel(input.model,input.task||"chat");
 const configured=(spec:typeof MODELS[number])=>Boolean(providerEnv(spec.provider).key);
 const ranked=[primary,...MODELS.filter(configured).sort((a,b)=>{
  const task=input.task||"chat",aMatch=a.strengths.includes(task)?0:1,bMatch=b.strengths.includes(task)?0:1;
  if(aMatch!==bMatch)return aMatch-bMatch;
  if(a.provider==="google"&&b.provider!=="google")return -1;
  if(b.provider==="google"&&a.provider!=="google")return 1;
  return a.speed==="fast"?-1:b.speed==="fast"?1:0;
 })].filter((model,index,all)=>configured(model)&&all.findIndex(item=>item.id===model.id)===index);
 const candidates=ranked.filter((model,index,all)=>all.findIndex(item=>item.provider===model.provider)===index).slice(0,3);
 for(const spec of candidates){
  try{return await callProviderStream(spec,input.messages,onToken);}
  catch(error){
   const isTimeout=error instanceof Error&&(error.name==="AbortError"||error.name==="TimeoutError");
   console.warn("[Nexora AI] streaming provider request failed",{
    provider:spec.provider,
    model:spec.id,
    failureType:isTimeout?"timeout":"provider_error",
    errorName:error instanceof Error?error.name:"UnknownError",
    failureReason:safeProviderFailure(error)
   });
   // Try the next configured provider. A provider without streaming support is
   // not allowed to break chat; the normal router below remains the final fallback.
   if(isTimeout)continue;
  }
 }
 const result=await routeChat(input);
 onToken(result.content);
 return result;
}
