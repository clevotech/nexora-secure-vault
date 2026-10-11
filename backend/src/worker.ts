import {createDatabasePool,initializeDatabase} from "./db.js";
import {generateImage,speak,transcribe} from "./media.js";
import {generateVideo} from "./video.js";
import {generateMusic} from "./music.js";
import {createObjectStorage} from "./object-storage.js";
import {JobStorePostgres,type MediaJob} from "./jobs.js";

const workerId=process.env.NEXORA_WORKER_ID||`worker-${process.pid}`;
const pollMs=Math.max(250,Number(process.env.NEXORA_WORKER_POLL_MS||1000));
const pool=await createDatabasePool();

if(!pool)throw new Error("DATABASE_URL is required for the production worker");
const databasePool=pool;
await initializeDatabase(pool);

const jobs=new JobStorePostgres(pool);
const storage=createObjectStorage();

async function processJob(job:MediaJob){
  if(job.kind==="transcription"){
    const output=await transcribe(String(job.metadata.audioBase64||""),typeof job.metadata.filename==="string"?job.metadata.filename:"audio.webm");
    return {type:"transcription",text:output.text,model:output.model};
  }
  if(job.kind==="speech"){
    if(!storage)throw new Error("Object storage is required for speech output jobs");
    const output=await speak(String(job.metadata.text||""),typeof job.metadata.voice==="string"?job.metadata.voice:undefined);
    const key=`${job.userId}/jobs/${job.id}.mp3`;
    await storage.put(key,Buffer.from(output.audioBase64,"base64"),"audio/mpeg");
    return {type:"audio",key,model:output.model,format:output.format};
  }
  if(job.kind==="music"){
    if(!storage)throw new Error("Object storage is required for generated music. Configure NEXORA_STORAGE_BUCKET and S3 credentials.");
    const output=await generateMusic({
      prompt:String(job.metadata.prompt||""),title:typeof job.metadata.title==="string"?job.metadata.title:undefined,
      genre:typeof job.metadata.genre==="string"?job.metadata.genre:undefined,
      durationSeconds:typeof job.metadata.durationSeconds==="number"?job.metadata.durationSeconds:180,
      bpm:typeof job.metadata.bpm==="number"?job.metadata.bpm:undefined,
      key:typeof job.metadata.key==="string"?job.metadata.key:undefined,
      scale:typeof job.metadata.scale==="string"?job.metadata.scale:undefined,
      chordProgression:typeof job.metadata.chordProgression==="string"?job.metadata.chordProgression:undefined,
      customChordProgression:typeof job.metadata.customChordProgression==="string"?job.metadata.customChordProgression:undefined,
      mood:typeof job.metadata.mood==="string"?job.metadata.mood:undefined,
      structure:typeof job.metadata.structure==="string"?job.metadata.structure:undefined,
      instruments:Array.isArray(job.metadata.instruments)?job.metadata.instruments.filter((v:unknown):v is string=>typeof v==="string").slice(0,24):[],
      customInstruments:typeof job.metadata.customInstruments==="string"?job.metadata.customInstruments:undefined,
      instrumentDirection:typeof job.metadata.instrumentDirection==="string"?job.metadata.instrumentDirection:undefined,
      excludedInstruments:typeof job.metadata.excludedInstruments==="string"?job.metadata.excludedInstruments:undefined,
      lyrics:typeof job.metadata.lyrics==="string"?job.metadata.lyrics:undefined,
      instrumental:job.metadata.instrumental===true,beatOnly:job.metadata.beatOnly===true,
      voiceReferenceAudio:typeof job.metadata.voiceReferenceAudio==="string"?job.metadata.voiceReferenceAudio:undefined,
      voiceName:typeof job.metadata.voiceName==="string"?job.metadata.voiceName:undefined,leadVocalist:job.metadata.leadVocalist&&typeof job.metadata.leadVocalist==="object"?{name:typeof (job.metadata.leadVocalist as any).name==="string"?(job.metadata.leadVocalist as any).name:undefined,audio:typeof (job.metadata.leadVocalist as any).audio==="string"?(job.metadata.leadVocalist as any).audio:undefined}:undefined,backupVoiceReferences:Array.isArray(job.metadata.backupVoiceReferences)?job.metadata.backupVoiceReferences.filter((v:unknown)=>Boolean(v&&typeof v==="object"&&typeof (v as {name?:unknown}).name==="string"&&typeof (v as {audio?:unknown}).audio==="string")).slice(0,8).map((v:unknown)=>({name:(v as {name:string}).name,audio:(v as {audio:string}).audio,lyrics:typeof (v as {lyrics?:unknown}).lyrics==="string"?(v as {lyrics:string}).lyrics:""})) as {name:string;audio:string;lyrics?:string}[]:[],
      referenceTrackAudio:typeof job.metadata.referenceTrackAudio==="string"?job.metadata.referenceTrackAudio:undefined,
      referenceTrackName:typeof job.metadata.referenceTrackName==="string"?job.metadata.referenceTrackName:undefined,
      referenceRightsConfirmed:job.metadata.referenceRightsConfirmed===true
    });
    const bytes=Buffer.from(output.audioBase64,"base64");
    if(bytes.byteLength===0)throw new Error("Music provider returned an empty audio file.");
    const mime=output.contentType||"audio/mpeg";
    const extension=mime.includes("wav")?"wav":mime.includes("ogg")?"ogg":mime.includes("mp4")?"m4a":"mp3";
    const key=`${job.userId}/jobs/${job.id}.${extension}`;
    await storage.put(key,bytes,mime);
    return {type:"audio",key,model:output.model,format:mime,title:typeof job.metadata.title==="string"?job.metadata.title:"Nexora song",durationSeconds:job.metadata.durationSeconds};
  }
  if(job.kind==="video"){
    const output=await generateVideo({prompt:String(job.metadata.prompt||""),model:typeof job.metadata.model==="string"?job.metadata.model:undefined,duration:typeof job.metadata.duration==="string"?job.metadata.duration:undefined,continuity:job.metadata.continuity===true,characterConsistency:job.metadata.characterConsistency===true,voiceReference:job.metadata.voiceReference===true,characterReferenceImages:Array.isArray(job.metadata.characterReferenceImages)?job.metadata.characterReferenceImages.filter((x:unknown)=>Boolean(x&&typeof x==="object"&&typeof (x as {dataUrl?:unknown}).dataUrl==="string")).slice(0,2) as {name?:string;dataUrl:string}[]:[],voiceReferenceAudio:typeof job.metadata.voiceReferenceAudio==="string"?job.metadata.voiceReferenceAudio:undefined,regionalAccent:typeof job.metadata.regionalAccent==="string"?job.metadata.regionalAccent:undefined,voiceStyle:typeof job.metadata.voiceStyle==="string"?job.metadata.voiceStyle:undefined,voiceName:typeof job.metadata.voiceName==="string"?job.metadata.voiceName:undefined,aspectRatio:typeof job.metadata.aspectRatio==="string"?job.metadata.aspectRatio:undefined,resolution:typeof job.metadata.resolution==="string"?job.metadata.resolution:undefined,quality:typeof job.metadata.quality==="string"?job.metadata.quality:undefined});
    const bytes=Buffer.from(output.videoBase64,"base64");
    if(!storage){
      // Short clips can still be returned securely through the authenticated job API
      // when an S3-compatible bucket has not been configured.
      if(bytes.byteLength>18_000_000)throw new Error("Generated video is too large for inline delivery. Configure NEXORA_STORAGE_BUCKET and its S3 credentials to store larger videos.");
      return {type:"video",videoBase64:output.videoBase64,model:output.model,format:output.contentType};
    }
    const extension=output.contentType.includes("webm")?"webm":"mp4";
    const key=`${job.userId}/jobs/${job.id}.${extension}`;
    await storage.put(key,bytes,output.contentType);
    return {type:"video",key,model:output.model,format:output.contentType};
  }
  if(job.kind!=="image")throw new Error(`No active worker adapter is configured for ${job.kind}`);
  if(!storage)throw new Error("Object storage is required for image output jobs");
  const output=await generateImage(String(job.metadata.prompt||""),typeof job.metadata.model==="string"?job.metadata.model:undefined);
  const key=`${job.userId}/jobs/${job.id}.png`;
  await storage.put(key,Buffer.from(output.imageBase64,"base64"),"image/png");
  return {type:"image",key,model:output.model};
}

async function tick(){
  const job=await jobs.claimNext(workerId);
  if(!job)return;
  try{
    const result=await processJob(job);
    await jobs.update(job.userId,job.id,"completed",result);
  }catch(error){
    const message=error instanceof Error?error.message:"Job failed";
    await jobs.update(job.userId,job.id,"failed",undefined,message);
  }
}

let stopping=false;
async function loop(){
  while(!stopping){
    await tick();
    if(!stopping)await new Promise(resolve=>setTimeout(resolve,pollMs));
  }
}

async function shutdown(){
  stopping=true;
  await databasePool.end();
}

process.on("SIGINT",()=>{void shutdown().then(()=>process.exit(0));});
process.on("SIGTERM",()=>{void shutdown().then(()=>process.exit(0));});

loop().catch(async error=>{
  console.error("Nexora worker failed",error);
  await databasePool.end();
  process.exit(1);
});
