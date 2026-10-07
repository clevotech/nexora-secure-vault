export const NSV_MAGIC="NSV1";
export const NSV_VERSION=1;
export const CHUNK_SIZE=1024*1024;
export type NsvHeader={magic:string;version:number;algorithm:"AES-256-GCM";kdf:"Argon2id";salt:string;chunkSize:number;originalName:string;originalSize:string;createdAt:string;operationId:string};
export function encodeHeader(h:NsvHeader):Uint8Array{return new TextEncoder().encode(JSON.stringify(h)+"\\n")}
export function decodeHeader(bytes:Uint8Array):NsvHeader{return JSON.parse(new TextDecoder().decode(bytes).trim()) as NsvHeader}
