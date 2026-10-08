import {createDatabasePool} from "./db.js";
import {generateImage} from "./media.js";
import {createObjectStorage} from "./object-storage.js";
import {JobStorePostgres,type MediaJob} from "./jobs.js";

const workerId=process.env.NEXORA_WORKER_ID||`worker-${process.pid}`;
const pollMs=Math.max(250,Number(process.env.NEXORA_WORKER_POLL_MS||1000));
const pool=createDatabasePool();

if(!pool)throw new Error("DATABASE_URL is required for the production worker");

const jobs=new JobStorePostgres(pool);
const storage=createObjectStorage();
if(!storage)throw new Error("NEXORA_STORAGE_BUCKET is required for the production worker");

async function processJob(job:MediaJob){
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
