export type VideoRequest={prompt:string;model?:string;duration?:string;continuity?:boolean;characterConsistency?:boolean;voiceReference?:boolean;characterReferenceImages?:{name?:string;dataUrl:string}[];voiceReferenceAudio?:string;regionalAccent?:string;voiceStyle?:string;voiceName?:string};
export type VideoResult={videoBase64:string;model?:string;contentType:string};

const trimSlash=(value:string)=>value.endsWith("/")?value.slice(0,-1):value;
const base=()=>process.env.NEXORA_VIDEO_API_URL?trimSlash(process.env.NEXORA_VIDEO_API_URL):"";
const apiKey=()=>process.env.NEXORA_VIDEO_API_KEY||"";
const parse=async(r:Response)=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||d?.error||d?.message||`Video provider failed (${r.status})`);return d;};

async function generateWithConfiguredProvider(input:VideoRequest,url:string):Promise<VideoResult>{
  const headers={"Content-Type":"application/json",...(apiKey()?{Authorization:`Bearer ${apiKey()}`}:{})};
  const created=await parse(await fetch(url,{method:"POST",headers,body:JSON.stringify({prompt:input.prompt,model:input.model||process.env.NEXORA_VIDEO_MODEL,duration:input.duration,continuity:input.continuity,characterConsistency:input.characterConsistency,voiceReference:input.voiceReference,characterReferenceImages:input.characterReferenceImages||[],voiceReferenceAudio:input.voiceReferenceAudio,regionalAccent:input.regionalAccent,voiceStyle:input.voiceStyle,voiceName:input.voiceName})}));
  const jobId=String(created.jobId||created.id||"");
  if(!jobId)throw new Error("Video provider returned no job ID");
  const timeout=Date.now()+Math.max(60_000,Number(process.env.NEXORA_VIDEO_TIMEOUT_MS||1_800_000));
  const poll=Math.max(1000,Number(process.env.NEXORA_VIDEO_POLL_MS||3000));
  while(Date.now()<timeout){
    const d=await parse(await fetch(`${url}/${encodeURIComponent(jobId)}`,{headers}));
    const status=String(d.status||"").toLowerCase();
    if(["failed","error","cancelled"].includes(status))throw new Error(String(d.error||"Video generation failed"));
    const outputUrl=typeof d.downloadUrl==="string"?d.downloadUrl:typeof d.url==="string"?d.url:"";
    if(["completed","succeeded","done"].includes(status)&&outputUrl){
      const media=await fetch(outputUrl);if(!media.ok)throw new Error(`Video download failed (${media.status})`);
      return {videoBase64:Buffer.from(await media.arrayBuffer()).toString("base64"),model:typeof d.model==="string"?d.model:input.model,contentType:media.headers.get("content-type")||"video/mp4"};
    }
    await new Promise(resolve=>setTimeout(resolve,poll));
  }
  throw new Error("Video generation timed out");
}

async function generateWithGoogleVeo(input:VideoRequest):Promise<VideoResult>{
  if((input.characterReferenceImages?.length||0)>0||input.voiceReferenceAudio)throw new Error("The built-in Google Veo adapter currently cannot pass uploaded character images or custom voice samples. Configure NEXORA_VIDEO_API_URL with a provider adapter that supports reference inputs; your uploads were not silently ignored.");
  const key=process.env.NEXORA_GOOGLE_API_KEY;
  if(!key)throw new Error("Video generation is not configured. Add a supported video provider or NEXORA_GOOGLE_API_KEY.");
  const durationSeconds=Number((input.duration||"8").trim().split(" ")[0]);
  if(![4,6,8].includes(durationSeconds))throw new Error("Google Veo generates one short clip of up to 8 seconds. Select 4, 6, or 8 seconds, or configure NEXORA_VIDEO_API_URL for a long-form video provider.");
  const configuredModel=(process.env.NEXORA_VIDEO_MODEL||"").trim();
  const model=configuredModel.startsWith("veo-3.1-")?configuredModel:"veo-3.1-generate-preview";
  const apiBase=trimSlash(process.env.NEXORA_GOOGLE_BASE_URL||"https://generativelanguage.googleapis.com/v1beta");
  const headers={"Content-Type":"application/json","x-goog-api-key":key};
  const started=await parse(await fetch(`${apiBase}/models/${model}:predictLongRunning`,{method:"POST",headers,body:JSON.stringify({instances:[{prompt:input.prompt}],parameters:{aspectRatio:"9:16",durationSeconds:String(durationSeconds)}})}));
  const operationName=String(started.name||started.operation?.name||"");
  if(!operationName)throw new Error("Google Veo returned no operation name");
  const timeout=Date.now()+Math.max(60_000,Number(process.env.NEXORA_VIDEO_TIMEOUT_MS||1_800_000));
  const poll=Math.max(5000,Number(process.env.NEXORA_VIDEO_POLL_MS||10000));
  while(Date.now()<timeout){
    const operation=await parse(await fetch(`${apiBase}/${operationName.startsWith("/")?operationName.slice(1):operationName}`,{headers:{"x-goog-api-key":key}}));
    if(operation.error)throw new Error(operation.error.message||"Google Veo generation failed");
    if(operation.done===true){
      const response=operation.response||{};
      const samples=response.generateVideoResponse?.generatedSamples||response.generate_video_response?.generated_samples||[];
      const uri=samples[0]?.video?.uri||samples[0]?.video?.url;
      if(!uri)throw new Error("Google Veo completed without a downloadable video");
      const download=await fetch(uri,{headers:{"x-goog-api-key":key}});
      if(!download.ok)throw new Error(`Generated video download failed (${download.status})`);
      return {videoBase64:Buffer.from(await download.arrayBuffer()).toString("base64"),model,contentType:download.headers.get("content-type")||"video/mp4"};
    }
    await new Promise(resolve=>setTimeout(resolve,poll));
  }
  throw new Error("Video generation timed out while waiting for Google Veo");
}

export async function generateVideo(input:VideoRequest):Promise<VideoResult>{
  if(!input.prompt||input.prompt.length>32000)throw new Error("Invalid video prompt");
  const url=base();
  if(url)return generateWithConfiguredProvider(input,url);
  return generateWithGoogleVeo(input);
}
