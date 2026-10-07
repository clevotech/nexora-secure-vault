export interface MemoryStore<T>{list(userId:string):Promise<T[]>;save(userId:string,content:string):Promise<T>;delete(userId:string,id:string):Promise<boolean>;}
export type MemoryRecord={id:string;userId:string;content:string;createdAt:string;updatedAt:string};
export class MemoryStoreMemory implements MemoryStore<MemoryRecord>{
  private records=new Map<string,MemoryRecord>();
  async list(userId:string){return [...this.records.values()].filter(x=>x.userId===userId);}
  async save(userId:string,content:string){const now=new Date().toISOString();const r={id:crypto.randomUUID(),userId,content,createdAt:now,updatedAt:now};this.records.set(r.id,r);return r;}
  async delete(userId:string,id:string){const r=this.records.get(id);if(!r||r.userId!==userId)return false;this.records.delete(id);return true;}
}