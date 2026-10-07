import {createSalt,deriveKey,encryptChunk,decryptChunk,operationId} from "./crypto.js";
import {CHUNK_SIZE,NSV_MAGIC,NSV_VERSION,encodeHeader,type NsvHeader} from "./protocol.js";

const te=new TextEncoder(), td=new TextDecoder();
const u32=(n:number)=>new Uint8Array(new Uint32Array([n]).buffer);
const readU32=(b:Uint8Array,o:number)=>new Uint32Array(b.buffer,b.byteOffset+o,1)[0];
const join=(parts:Uint8Array[])=>{const n=parts.reduce((s,x)=>s+x.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out};

export function encryptFile(input:Uint8Array,password:string,fileName:string,createdAt=new Date().toISOString()):Uint8Array{
 const salt=createSalt(),key=deriveKey(password,salt),id=operationId();
 const header:NsvHeader={magic:NSV_MAGIC,version:NSV_VERSION,algorithm:"AES-256-GCM",kdf:"Argon2id",salt:Array.from(salt,x=>x.toString(16).padStart(2,"0")).join(""),chunkSize:CHUNK_SIZE,originalName:fileName,originalSize:String(input.length),createdAt,operationId:id};
 const hb=encodeHeader(header),parts=[u32(hb.length),hb]; let seq=0;
 for(let o=0;o<input.length;o+=CHUNK_SIZE){const r=encryptChunk(key,input.subarray(o,Math.min(o+CHUNK_SIZE,input.length)),seq,hb);parts.push(u32(seq),new Uint8Array([r.nonce.length]),r.nonce,u32(r.ciphertext.length),r.ciphertext);seq++}
 return join(parts);
}
export function decryptFile(container:Uint8Array,password:string):{data:Uint8Array;header:NsvHeader}{
 let o=0;const hlen=readU32(container,o);o+=4;const hb=container.subarray(o,o+hlen);o+=hlen;const header=JSON.parse(td.decode(hb)) as NsvHeader;
 if(header.magic!==NSV_MAGIC||header.version!==NSV_VERSION)throw new Error("Unsupported or invalid Nexora container");
 const salt=new Uint8Array(header.salt.match(/../g)!.map(x=>parseInt(x,16))),key=deriveKey(password,salt),parts:Uint8Array[]=[];
 while(o<container.length){const seq=readU32(container,o);o+=4;const nl=container[o++];const nonce=container.subarray(o,o+nl);o+=nl;const clen=readU32(container,o);o+=4;const cipher=container.subarray(o,o+clen);o+=clen;parts.push(decryptChunk(key,cipher,nonce,seq,hb))}
 const data=join(parts);if(String(data.length)!==header.originalSize)throw new Error("Integrity/size verification failed");return {data,header};
}
