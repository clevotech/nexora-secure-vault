import {createDatabasePool} from "./db.js";
import {generateImage,speak} from "./media.js";
import {generateVideo} from "./video.js";
import {createObjectStorage} from "./object-storage.js";
import {JobStorePostgres,type MediaJob} from "./jobs.js";

const workerId=process.env.NEXORA_WORKER_ID||`worker-${process.pid}`;
const pollMs=Math.max(250,Number(process.env.NEXORA_WORKER_POLL_MS||1000));
const poolResult=createDatabasePool();
if(!poolResult)throw new Error("DATABASE_URL is required for the production worker");
const pool=poolResult;

const jobs=new JobStorePostgres(pool);
const storageResult=createObjectStorage();
if(!storageResult)throw new Error("NEXORA_STORAGE_BUCKET is required for the production worker");
const storage=storageResult;

async function processJob(job:MediaJob){
  if(job.kind==="speech"){
    const output=await speak(String(job.metadata.text||""),typeof job.metadata.voice==="string"?job.metadata.voice:undefined);
    const key=`${job.userId}/jobs/${job.id}.mp3`;
    await storage.put(key,Buffer.from(output.audioBase64,"base64"),"audio/mpeg");
    return {type:"audio",key,model:output.model,format:output.format};
  }
  if(job.kind==="video"){
    const output=await generateVideo({prompt:String(job.metadata.prompt||""),model:typeof job.metadata.model==="string"?job.metadata.model:undefined,duration:typeof job.metadata.duration==="string"?job.metadata.duration:undefined,continuity:job.metadata.continuity===true,characterConsistency:job.metadata.characterConsistency===true,voiceReference:job.metadata.voiceReference===true});
    const extension=output.contentType.includes("webm")?"webm":"mp4";
    const key=`${job.userId}/jobs/${job.id}.${extension}`;
    await storage.put(key,Buffer.from(output.videoBase64,"base64"),output.contentType);
    return {type:"video",key,model:output.model,format:output.contentType};
  }
  if(job.kind!=="image")throw new Error(`No active worker adapter is configured for ${job.kind}`);
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
  await pool.end();
}

process.on("SIGINT",()=>{void shutdown().then(()=>process.exit(0));});
process.on("SIGTERM",()=>{void shutdown().then(()=>process.exit(0));});

loop().catch(async error=>{
  console.error("Nexora worker failed",error);
  await pool.end();
  process.exit(1);
});
