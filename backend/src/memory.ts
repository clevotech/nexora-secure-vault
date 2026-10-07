export type MemoryRecord={id:string;userId:string;content:string;createdAt:string;updatedAt:string};
const records=new Map<string,MemoryRecord>();

export function listMemory(userId:string){return [...records.values()].filter(x=>x.userId===userId);}
export function saveMemory(userId:string,content:string){
  if(!content||content.length>20000)throw new Error("Invalid memory");
  const now=new Date().toISOString();
  const id=crypto.randomUUID();
  const record={id,userId,content,createdAt:now,updatedAt:now};
  records.set(id,record);return record;
}
export function deleteMemory(userId:string,id:string){
  const record=records.get(id);
  if(!record||record.userId!==userId)return false;
  records.delete(id);return true;
}
