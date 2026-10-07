import {Pool} from "pg";

export interface MemoryStore<T>{list(userId:string):Promise<T[]>;save(userId:string,content:string):Promise<T>;delete(userId:string,id:string):Promise<boolean>;}
export type MemoryRecord={id:string;userId:string;content:string;createdAt:string;updatedAt:string};

export class MemoryStoreMemory implements MemoryStore<MemoryRecord>{
  private records=new Map<string,MemoryRecord>();
  async list(userId:string){return [...this.records.values()].filter(x=>x.userId===userId);}
  async save(userId:string,content:string){
    const now=new Date().toISOString();const r={id:crypto.randomUUID(),userId,content,createdAt:now,updatedAt:now};
    this.records.set(r.id,r);return r;
  }
  async delete(userId:string,id:string){const r=this.records.get(id);if(!r||r.userId!==userId)return false;this.records.delete(id);return true;}
}

export class MemoryStorePostgres implements MemoryStore<MemoryRecord>{
  constructor(private pool:Pool){}
  async list(userId:string){
    const {rows}=await this.pool.query(
      "SELECT id,user_id as \"userId\",content,created_at as \"createdAt\",updated_at as \"updatedAt\" FROM nexora_memory WHERE user_id=$1 ORDER BY created_at DESC",
      [userId]);
    return rows as MemoryRecord[];
  }
  async save(userId:string,content:string){
    const {rows}=await this.pool.query(
      "INSERT INTO nexora_memory(id,user_id,content) VALUES($1,$2,$3) RETURNING id,user_id as \"userId\",content,created_at as \"createdAt\",updated_at as \"updatedAt\"",
      [crypto.randomUUID(),userId,content]);
    return rows[0] as MemoryRecord;
  }
  async delete(userId:string,id:string){
    const r=await this.pool.query("DELETE FROM nexora_memory WHERE id=$1 AND user_id=$2",[id,userId]);
    return r.rowCount===1;
  }
}

export function createMemoryStore(){
  if(process.env.DATABASE_URL){
    const pool=new Pool({
      connectionString:process.env.DATABASE_URL,
      max:Number(process.env.NEXORA_DB_POOL_MAX||10),
      idleTimeoutMillis:30000,
      connectionTimeoutMillis:5000
    });
    pool.on("error",error=>console.error("Nexora PostgreSQL pool error",error));
    return new MemoryStorePostgres(pool);
  }
  return new MemoryStoreMemory();
}
