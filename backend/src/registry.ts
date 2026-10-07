import type {ModelSpec,ProviderId,Task} from "./types.js";

export const MODELS:ModelSpec[]=[
  {id:"openai:gpt-6-astra",provider:"openai",capabilities:["text","vision","tools","streaming"],strengths:["reasoning","research"],speed:"premium"},
  {id:"openai:gpt-6.1-sol",provider:"openai",capabilities:["text","vision","tools","streaming"],strengths:["reasoning","coding","research"],speed:"balanced"},
  {id:"openai:gpt-6-luna",provider:"openai",capabilities:["text","vision","tools","streaming"],strengths:["chat","coding"],speed:"fast"},
  {id:"anthropic:claude-opus-5.5",provider:"anthropic",capabilities:["text","vision","tools","streaming"],strengths:["reasoning","research","coding"],speed:"premium"},
  {id:"anthropic:claude-fable-5.1",provider:"anthropic",capabilities:["text","vision","tools","streaming"],strengths:["chat","research"],speed:"balanced"},
  {id:"google:gemini-3.8-flash",provider:"google",capabilities:["text","vision","audio","tools","streaming"],strengths:["chat","research","coding"],speed:"fast"},
  {id:"xai:grok-4.7",provider:"xai",capabilities:["text","vision","tools","streaming"],strengths:["chat","research","coding"],speed:"balanced"},
  {id:"deepseek:deepseek-v4-pro",provider:"deepseek",capabilities:["text","tools","streaming"],strengths:["reasoning","coding"],speed:"premium"},
  {id:"mistral:mistral-large-4",provider:"mistral",capabilities:["text","vision","tools","streaming"],strengths:["reasoning","coding","research"],speed:"balanced"}
];

export function findModel(id:string){return MODELS.find(m=>m.id===id);}
export function modelsForTask(task:Task){return MODELS.filter(m=>m.strengths.includes(task));}

export function routeModel(requested="auto",task:Task="chat"){
  if(requested!=="auto" && requested!=="fast" && requested!=="reasoning" && requested!=="creative"){
    const exact=findModel(requested);
    if(exact)return exact;
  }
  const preferred:Task=requested==="reasoning"?"reasoning":requested==="creative"?"chat":requested==="fast"?"chat":task;
  const candidates=modelsForTask(preferred);
  return candidates.find(m=>m.speed==="balanced") ?? candidates.find(m=>m.speed==="fast") ?? candidates[0] ?? MODELS[2];
}

export function providerEnv(provider:ProviderId){
  const p=provider.toUpperCase();
  return {key:process.env[`NEXORA_${p}_API_KEY`],base:process.env[`NEXORA_${p}_BASE_URL`]};
}
