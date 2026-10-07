export const NSV_MAGIC="NSV1";
export const NSV_VERSION=1;
export const CHUNK_SIZE=1024*1024;
export const MAX_HEADER_BYTES=64*1024;
export const MAX_CHUNK_BYTES=CHUNK_SIZE+16;
export type NsvHeader={
  magic:"NSV1"; version:1; algorithm:"AES-256-GCM"; kdf:"Argon2id";
  salt:string; chunkSize:number; originalName:string; originalSize:string;
  createdAt:string; operationId:string;
};
export function encodeHeader(h:NsvHeader):Uint8Array{
  return new TextEncoder().encode(JSON.stringify(h)+"\n");
}
export function decodeHeader(bytes:Uint8Array):NsvHeader{
  if(bytes.length===0||bytes.length>MAX_HEADER_BYTES) throw new Error("Invalid header length");
  const h=JSON.parse(new TextDecoder().decode(bytes).trim()) as NsvHeader;
  if(h.magic!==NSV_MAGIC||h.version!==NSV_VERSION||h.algorithm!=="AES-256-GCM"||h.kdf!=="Argon2id") throw new Error("Unsupported or invalid Nexora container");
  if(!/^[0-9a-f]{32}$/i.test(h.salt)) throw new Error("Invalid salt");
  if(h.chunkSize!==CHUNK_SIZE) throw new Error("Invalid chunk size");
  if(!Number.isSafeInteger(Number(h.originalSize))||Number(h.originalSize)<0) throw new Error("Invalid original size");
  if(typeof h.originalName!=="string"||h.originalName.length===0||h.originalName.length>1024) throw new Error("Invalid original filename");
  if(typeof h.operationId!=="string"||h.operationId.length<16) throw new Error("Invalid operation id");
  return h;
}