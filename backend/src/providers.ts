import type {ChatMessage,ModelSpec,ProviderId,ProviderResult} from "./types.js";
import {providerEnv} from "./registry.js";

function requireConfig(provider:ProviderId){const cfg=providerEnv(provider);if(!cfg.key)throw new Error(`Provider ${provider} is not configured`);return cfg;}
function modelName(spec:ModelSpec){return spec.id.split(":").slice(1).join(":");}
async function jsonFetch(url:string,init:RequestInit){
  const r=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init.headers||{})}});
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
  const data=await jsonFetch((base||"https://api.anthropic.com").replace(/\/$/,"")+"/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:modelName(spec),max_tokens:4096,system,messages:messages.filter(m=>m.role!=="system")})});
  const content=data?.content?.map((x:{type?:string,text?:string})=>x.type==="text"?x.text:"").join("")||"";if(!content)throw new Error("Provider returned no assistant content");
  return {content,provider:"anthropic",model:spec.id};
}
async function google(spec:ModelSpec,messages:ChatMessage[]):Promise<ProviderResult>{
  const {key,base}=requireConfig("google");const url=(base||"https://generativelanguage.googleapis.com/v1beta").replace(/\/$/,"")+`/models/${modelName(spec)}:generateContent?key=${encodeURIComponent(key)}`;
  const contents=messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
  const data=await jsonFetch(url,{method:"POST",body:JSON.stringify({contents})});
  const content=data?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||"").join("")||"";if(!content)throw new Error("Provider returned no assistant content");
  return {content,provider:"google",model:spec.id};
}
export async function callProvider(spec:ModelSpec,messages:ChatMessage[]):Promise<ProviderResult>{
  if(spec.provider==="openai")return openAI(spec,messages);
  if(spec.provider==="anthropic")return anthropic(spec,messages);
  if(spec.provider==="google")return google(spec,messages);
  return openAICompatible(spec,messages);
}
