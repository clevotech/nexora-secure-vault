export type Capability="text"|"vision"|"audio"|"image"|"video"|"tools"|"streaming";
export type ProviderId="openai"|"anthropic"|"google"|"xai"|"deepseek"|"mistral";
export type Task="chat"|"reasoning"|"coding"|"research"|"image"|"video"|"voice";

export type ModelSpec={
  id:string;
  provider:ProviderId;
  capabilities:Capability[];
  strengths:Task[];
  speed:"fast"|"balanced"|"premium";
};

export type ChatMessage={role:"system"|"user"|"assistant";content:string};
export type ChatRequest={messages:ChatMessage[];model?:string;task?:Task};
export type ProviderResult={content:string;provider:ProviderId;model:string};
