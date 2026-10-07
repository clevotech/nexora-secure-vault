export type JobStatus="queued"|"running"|"completed"|"failed";
export type MediaJob={id:string;userId:string;kind:"image"|"video"|"transcription"|"speech";status:JobStatus;createdAt:string;updatedAt:string;metadata:Record<string,unknown>};
const jobs=new Map<string,MediaJob>();
export function createJob(userId:string,kind:MediaJob["kind"],metadata:Record<string,unknown>={}){const now=new Date().toISOString();const job={id:crypto.randomUUID(),userId,kind,status:"queued" as const,createdAt:now,updatedAt:now,metadata};jobs.set(job.id,job);return job;}
export function getJob(userId:string,id:string){const j=jobs.get(id);return j?.userId===userId?j:undefined;}
export function updateJob(userId:string,id:string,status:JobStatus){const j=getJob(userId,id);if(!j)throw new Error("Job not found");j.status=status;j.updatedAt=new Date().toISOString();return j;}