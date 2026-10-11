export type MusicRequest={
  prompt:string;title?:string;genre?:string;durationSeconds?:number;bpm?:number;mood?:string;structure?:string;
  lyrics?:string;instrumental?:boolean;beatOnly?:boolean;voiceReferenceAudio?:string;voiceName?:string;
  referenceTrackAudio?:string;referenceTrackName?:string;referenceRightsConfirmed?:boolean;
};
export type MusicResult={audioBase64:string;model?:string;contentType:string};
const trimSlash=(value:string)=>value.endsWith("/")?value.slice(0,-1):value;
const parse=async(r:Response)=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||d?.error||d?.message||`Music provider failed (${r.status})`);return d;};
const nestedString=(d:any,...keys:string[])=>{for(const key of keys){const v=d?.[key];if(typeof v==="string"&&v)return v;}return "";};
export async function generateMusic(input:MusicRequest):Promise<MusicResult>{
  if(!input.prompt?.trim()||input.prompt.length>32000)throw new Error("Describe the song or provide lyrics before generating music.");
  const duration=Number(input.durationSeconds||180);
  if(!Number.isFinite(duration)||duration<30||duration>600)throw new Error("Music duration must be between 30 seconds and 10 minutes.");
  if(input.referenceTrackAudio&&!input.referenceRightsConfirmed)throw new Error("Confirm permission to use the reference track before generating music.");
  const url=process.env.NEXORA_MUSIC_API_URL?trimSlash(process.env.NEXORA_MUSIC_API_URL):"";
  if(!url)throw new Error("Music generation is not configured yet. The service owner must set NEXORA_MUSIC_API_URL to a compatible music-generation provider.");
  const apiKey=process.env.NEXORA_MUSIC_API_KEY||"";
  const headers={"Content-Type":"application/json",...(apiKey?{Authorization:`Bearer ${apiKey}`}:{})};
  const payload={
    prompt:input.prompt,title:input.title,genre:input.genre,durationSeconds:duration,bpm:input.bpm,mood:input.mood,structure:input.structure,
    lyrics:input.lyrics,instrumental:input.instrumental===true,beatOnly:input.beatOnly===true,
    voiceReferenceAudio:input.voiceReferenceAudio,voiceName:input.voiceName,
    referenceTrackAudio:input.referenceTrackAudio,referenceTrackName:input.referenceTrackName,
    referenceRightsConfirmed:input.referenceRightsConfirmed===true,
    instructions:"Create an original composition. If a reference track is supplied and authorized, use it only for high-level rhythm, tempo, instrumentation, arrangement, or production analysis as requested. Do not copy its melody, lyrics, master recording, or a named artist's distinctive voice. Honor the requested genre and duration; return a complete audio file, not a short preview."
  };
  const created=await parse(await fetch(url,{method:"POST",headers,body:JSON.stringify(payload)}));
  const inline=nestedString(created,"audioBase64","audio_base64");
  if(inline)return {audioBase64:inline,model:nestedString(created,"model")||undefined,contentType:nestedString(created,"contentType","content_type","mimeType","mime_type")||"audio/mpeg"};
  const jobId=nestedString(created,"jobId","job_id","id");
  if(!jobId)throw new Error("Music provider returned neither audio nor a job ID. Check its API adapter contract.");
  const timeout=Date.now()+Math.max(60_000,Number(process.env.NEXORA_MUSIC_TIMEOUT_MS||1_800_000));
  const poll=Math.max(1500,Number(process.env.NEXORA_MUSIC_POLL_MS||5000));
  while(Date.now()<timeout){
    const d=await parse(await fetch(`${url}/${encodeURIComponent(jobId)}`,{headers}));
    const status=String(d.status||"").toLowerCase();
    if(["failed","error","cancelled"].includes(status))throw new Error(String(d.error||d.message||"Music generation failed."));
    const output=nestedString(d,"audioUrl","audio_url","downloadUrl","download_url","url")||nestedString(d.output,"audioUrl","audio_url","downloadUrl","download_url","url");
    if(["completed","succeeded","done","complete"].includes(status)&&output){
      const audio=await fetch(output);if(!audio.ok)throw new Error(`Music download failed (${audio.status}).`);
      return {audioBase64:Buffer.from(await audio.arrayBuffer()).toString("base64"),model:nestedString(d,"model")||undefined,contentType:audio.headers.get("content-type")||"audio/mpeg"};
    }
    const inlineAudio=nestedString(d,"audioBase64","audio_base64")||nestedString(d.output,"audioBase64","audio_base64");
    if(["completed","succeeded","done","complete"].includes(status)&&inlineAudio)return {audioBase64:inlineAudio,model:nestedString(d,"model")||undefined,contentType:nestedString(d,"contentType","content_type","mimeType","mime_type")||"audio/mpeg"};
    await new Promise(resolve=>setTimeout(resolve,poll));
  }
  throw new Error("Music generation timed out while waiting for the configured provider.");
}
