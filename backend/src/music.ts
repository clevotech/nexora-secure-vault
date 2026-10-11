export type MusicRequest={
  prompt:string;title?:string;genre?:string;durationSeconds?:number;bpm?:number;key?:string;scale?:string;chordProgression?:string;customChordProgression?:string;mood?:string;structure?:string;introDirection?:string;interludeDirection?:string;outroDirection?:string;arrangementSections?:{intro?:string;interlude?:string;outro?:string};
  instruments?:string[];customInstruments?:string;instrumentDirection?:string;excludedInstruments?:string;lyrics?:string;instrumental?:boolean;beatOnly?:boolean;voiceReferenceAudio?:string;voiceName?:string;leadVocalist?:{name?:string;audio?:string;direction?:string};backupVoiceReferences?:{name:string;audio:string;lyrics?:string;direction?:string}[];
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
    prompt:input.prompt,title:input.title,genre:input.genre,durationSeconds:duration,bpm:input.bpm,key:input.key,scale:input.scale,chordProgression:input.chordProgression,customChordProgression:input.customChordProgression,mood:input.mood,structure:input.structure,introDirection:input.introDirection,interludeDirection:input.interludeDirection,outroDirection:input.outroDirection,arrangementSections:input.arrangementSections,
    instruments:(input.instruments||[]).filter(v=>typeof v==="string").slice(0,24),customInstruments:input.customInstruments,instrumentDirection:input.instrumentDirection,excludedInstruments:input.excludedInstruments,lyrics:input.lyrics,instrumental:input.instrumental===true,beatOnly:input.beatOnly===true,
    voiceReferenceAudio:input.voiceReferenceAudio,voiceName:input.voiceName,leadVocalist:input.leadVocalist,backupVoiceReferences:input.backupVoiceReferences||[],backupVocalLyrics:(input.backupVoiceReferences||[]).filter(v=>v.lyrics?.trim()).map(v=>({voiceName:v.name,lyrics:v.lyrics})),vocalArrangement:{leadVoice:input.leadVocalist?.name||input.voiceName||"provider default",backupVoices:(input.backupVoiceReferences||[]).map(v=>v.name),directions:"Keep the lead clear and centered; use backing voices for harmonies, doubles, ad-libs or call-and-response as musically appropriate. Preserve each authorized voice identity and mix backing vocals below the lead."},
    referenceTrackAudio:input.referenceTrackAudio,referenceTrackName:input.referenceTrackName,
    referenceRightsConfirmed:input.referenceRightsConfirmed===true,
    instructions:"Create an original composition. If a reference track is supplied and authorized, use it only for high-level rhythm, tempo, instrumentation, arrangement, or production analysis as requested. Do not copy its melody, lyrics, master recording, or a named artist's distinctive voice. Honor the requested genre, duration, key, scale/mode, chord progression, BPM, and custom section directions. Follow introDirection, interludeDirection, and outroDirection for their respective sections, including requested duration, instruments, vocal presence, energy, transitions, and ending; a direction of “none” means omit that section where musically possible. Keep section boundaries and transitions intentional, and ensure the outro gives the song a deliberate ending rather than an abrupt cutoff unless explicitly requested.  maintain the target tempo and harmonic progression across song sections unless a deliberate variation is specified. Support minor-key harmony and advanced chord qualities including diminished (°), fully diminished seventh (°7), half-diminished (ø or m7♭5), augmented (+ or aug), suspended (sus2/sus4), dominant seventh, altered dominants, and secondary dominants. Interpret Roman numerals relative to the selected key and mode; respect flats/sharps (♭/♯), chord inversions, slash chords, and chord extensions where specified. Do not silently convert diminished or other explicitly requested chord qualities into ordinary major/minor triads. Use customChordProgression when supplied and follow it exactly where musically feasible; if notation is ambiguous, favor the user\u2019s written chord symbols and musical intent. Use the selected instruments as the core arrangement, follow instrumentDirection for each instrument’s role and performance, and exclude instruments named in excludedInstruments. Preserve the selected instruments unless the requested style or provider capabilities make an explicit substitution necessary; return a complete audio file, not a short preview. If lead and backup voice references are supplied, use the lead as the primary singer and arrange the supplied backup voices as separate supporting vocal parts; do not collapse all roles into one voice. Follow leadVocalist.direction for the lead singer's tone, accent, language, range, emotion, and delivery. Follow each backupVoiceReferences item's direction independently for that singer's tone, harmony role, accent, language, ad-libs, and mix placement. Each backupVoiceReferences item may include lyrics; assign those lines only to that named backup vocalist and preserve the intended role, timing, and language. Do not substitute the lead lyrics for custom backup lyrics. If the provider cannot support multi-voice references, return an explicit capability error rather than silently ignoring selected voices."
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
