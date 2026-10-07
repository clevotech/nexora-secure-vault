import {sha256} from "../core/src/crypto.js";

export type AuditRecord={
  operationId:string;
  operation:"encrypt"|"decrypt"|"verify";
  status:"success"|"failure";
  timestampUtc:string;
  fileName:string;
  fileSize:number;
  fileHash?:string;
  algorithm?:string;
  kdf?:string;
  containerVersion?:number;
  keyId?:string;
  errorCode?:string;
  previousRecordHash:string;
  recordHash:string;
};

const canonical=(r:Omit<AuditRecord,"recordHash">)=>JSON.stringify(r);

export async function appendAuditRecord(previousHash:string, record:Omit<AuditRecord,"previousRecordHash"|"recordHash">){
  const base={...record,previousRecordHash:previousHash};
  const recordHash=await sha256(new TextEncoder().encode(canonical(base)));
  return {...base,recordHash};
}

export async function verifyAuditChain(records:AuditRecord[]){
  let previous="";
  for(const r of records){
    if(r.previousRecordHash!==previous)return false;
    const {recordHash,...base}=r;
    const expected=await sha256(new TextEncoder().encode(JSON.stringify(base)));
    if(expected!==recordHash)return false;
    previous=r.recordHash;
  }
  return true;
}
