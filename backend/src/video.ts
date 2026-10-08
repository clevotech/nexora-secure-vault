export type VideoRequest={prompt:string;model?:string;duration?:string;continuity?:boolean;characterConsistency?:boolean;voiceReference?:boolean};
export type VideoResult={videoBase64:string;model?:string;contentType:string};

const base=()=>process.env.NEXORA_VIDEO_API_URL?.replace(/\\/$/,"");
const apiKey=()=>process.env.NEXORA_VIDEO_API_KEY||"";
const parse=async(r:Response)=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||d?.error||`Video provider failed (${r.status})`);return d;};

export async function generateVideo(input:VideoRequest):Promise<VideoResult>{
  const url=base();if(!url)throw new Error("Video provider is not configured");
  if(!input.prompt||input.prompt.length>32000)throw new Error("Invalid video prompt");
  const headers={"Content-Type":"application/json",...(apiKey()?{Authorization:`Bearer ${apiKey()}`}:{})};
  const created=await parse(await fetch(url,{method:"POST",headers,body:JSON.stringify({prompt:input.prompt,model:input.model||process.env.NEXORA_VIDEO_MODEL,duration:input.duration,continuity:input.continuity,characterConsistency:input.characterConsistency,voiceReference:input.voiceReference})}));
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
