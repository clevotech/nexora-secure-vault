export type ProviderId="openai"|"anthropic"|"google"|"xai"|"deepseek"|"mistral";
export type Task="chat"|"reasoning"|"research"|"coding";
export type ModelCapability="text"|"vision"|"audio"|"tools"|"streaming";
export type ModelSpec={
  id:string;
  provider:ProviderId;
  capabilities:ModelCapability[];
  strengths:Task[];
  speed:"premium"|"balanced"|"fast";
};
