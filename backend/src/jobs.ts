import type {Pool} from "pg";
export type JobStatus="queued"|"running"|"completed"|"failed";
export type MediaJob={id:string;userId:string;kind:"image"|"video"|"transcription"|"speech";status:JobStatus;createdAt:string;updatedAt:string;metadata:Record<string,unknown>;result?:unknown;error?:string};

export class JobStoreMemory{
  private jobs=new Map<string,MediaJob>();
  create(userId:string,kind:MediaJob["kind"],metadata:Record<string,unknown>={}){const now=new Date().toISOString();const j={id:crypto.randomUUID(),userId,kind,status:"queued" as const,createdAt:now,updatedAt:now,metadata};this.jobs.set(j.id,j);return j;}
  get(userId:string,id:string){const j=this.jobs.get(id);return j?.userId===userId?j:undefined;}
  update(userId:string,id:string,status:JobStatus,result?:unknown,error?:string){const j=this.get(userId,id);if(!j)throw new Error("Job not found");j.status=status;j.updatedAt=new Date().toISOString();if(result!==undefined)j.result=result;if(error!==undefined)j.error=error;return j;}
}

export class JobStorePostgres{
  constructor(private pool:Pool){}
  async create(userId:string,kind:MediaJob["kind"],metadata:Record<string,unknown>={}){const r=await this.pool.query("INSERT INTO nexora_jobs(id,user_id,kind,status,metadata) VALUES($1,$2,$3,'queued',$4) RETURNING id,user_id as \"userId\",kind,status,metadata,created_at as \"createdAt\",updated_at as \"updatedAt\"",[crypto.randomUUID(),userId,kind,metadata]);return r.rows[0] as MediaJob;}
  async get(userId:string,id:string){const r=await this.pool.query("SELECT id,user_id as \"userId\",kind,status,metadata,result,error,created_at as \"createdAt\",updated_at as \"updatedAt\" FROM nexora_jobs WHERE id=$1 AND user_id=$2",[id,userId]);return r.rows[0] as MediaJob|undefined;}
  async update(userId:string,id:string,status:JobStatus,result?:unknown,error?:string){const r=await this.pool.query("UPDATE nexora_jobs SET status=$3,result=CASE WHEN $4::jsonb IS NULL THEN result ELSE $4::jsonb END,error=CASE WHEN $5::text IS NULL THEN error ELSE $5::text END,updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id,user_id as \"userId\",kind,status,metadata,result,error,created_at as \"createdAt\",updated_at as \"updatedAt\"",[id,userId,status,result===undefined?null:JSON.stringify(result),error===undefined?null:error]);if(!r.rows[0])throw new Error("Job not found");return r.rows[0] as MediaJob;}
  async claimNext(workerId:string){
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const r=await client.query("SELECT id,user_id as \"userId\",kind,status,metadata,result,error,created_at as \"createdAt\",updated_at as \"updatedAt\" FROM nexora_jobs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
      if(!r.rows[0]){await client.query("COMMIT");return undefined;}
      const job=r.rows[0] as MediaJob;
      const updated=await client.query("UPDATE nexora_jobs SET status='running',metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{workerId}',to_jsonb($2::text)),updated_at=NOW() WHERE id=$1 RETURNING id,user_id as \"userId\",kind,status,metadata,result,error,created_at as \"createdAt\",updated_at as \"updatedAt\"",[job.id,workerId]);
      await client.query("COMMIT");return updated.rows[0] as MediaJob;
    }catch(e){await client.query("ROLLBACK");throw e}finally{client.release();}
  }
}

const defaultJobStore=new JobStoreMemory();
export function createJob(userId:string,kind:MediaJob["kind"],metadata:Record<string,unknown>={}){return defaultJobStore.create(userId,kind,metadata);}
export function getJob(userId:string,id:string){return defaultJobStore.get(userId,id);}
export function updateJob(userId:string,id:string,status:JobStatus,result?:unknown,error?:string){return defaultJobStore.update(userId,id,status,result,error);}
