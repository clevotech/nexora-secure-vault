import {callProvider} from "./providers.js";
import {MODELS,providerEnv,routeModel,findModel} from "./registry.js";
import type {ChatRequest,ProviderResult} from "./types.js";

export async function routeChat(input:ChatRequest):Promise<ProviderResult>{
  const primary=routeModel(input.model,input.task||"chat");
  const configured=(spec:typeof MODELS[number])=>Boolean(providerEnv(spec.provider).key);
  const candidates=[primary,...MODELS
    .filter(configured)
    .sort((a,b)=>{
      const task=input.task||"chat";
      const aMatch=a.strengths.includes(task)?0:1;
      const bMatch=b.strengths.includes(task)?0:1;
      if(aMatch!==bMatch)return aMatch-bMatch;
      if(a.provider==="google"&&b.provider!=="google")return -1;
      if(b.provider==="google"&&a.provider!=="google")return 1;
      return a.speed==="fast"?-1:b.speed==="fast"?1:0;
    })]
    .filter((m,i,a)=>configured(m)&&a.findIndex(x=>x.id===m.id)===i);
  let last:unknown;
  for(const spec of candidates){
    try{return await callProvider(spec,input.messages);}
    catch(error){last=error;}
  }
  throw last instanceof Error?last:new Error("No configured AI provider is available");
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
