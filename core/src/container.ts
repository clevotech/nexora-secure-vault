import {createSalt,deriveKey,encryptChunk,decryptChunk,operationId} from "./crypto.js";
import {CHUNK_SIZE,NSV_MAGIC,NSV_VERSION,MAX_CHUNK_BYTES,MAX_HEADER_BYTES,decodeHeader,encodeHeader,type NsvHeader} from "./protocol.js";

const u32=(n:number)=>{const x=new Uint8Array(4);new DataView(x.buffer).setUint32(0,n,true);return x};
const readU32=(b:Uint8Array,o:number)=>{if(o+4>b.length)throw new Error("Malformed container");return new DataView(b.buffer,b.byteOffset+o,4).getUint32(0,true)};
const join=(parts:Uint8Array[])=>{const n=parts.reduce((s,x)=>s+x.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out};
const saltHex=(s:Uint8Array)=>Array.from(s,x=>x.toString(16).padStart(2,"0")).join("");

export function encryptFile(input:Uint8Array,password:string,fileName:string,createdAt=new Date().toISOString()):Uint8Array{
 const salt=createSalt(),key=deriveKey(password,salt),id=operationId();
 const header:NsvHeader={magic:NSV_MAGIC,version:NSV_VERSION,algorithm:"AES-256-GCM",kdf:"Argon2id",salt:saltHex(salt),chunkSize:CHUNK_SIZE,originalName:fileName.replace(/[\\/]/g,"_"),originalSize:String(input.length),createdAt,operationId:id};
 const hb=encodeHeader(header);if(hb.length>MAX_HEADER_BYTES)throw new Error("Header too large");
 const parts=[u32(hb.length),hb];let seq=0;
 for(let o=0;o<input.length||seq===0;o+=CHUNK_SIZE){
   const plain=input.subarray(o,Math.min(o+CHUNK_SIZE,input.length));
   const r=encryptChunk(key,plain,seq,hb);
   if(r.ciphertext.length>MAX_CHUNK_BYTES)throw new Error("Chunk too large");
   parts.push(u32(seq),new Uint8Array([r.nonce.length]),r.nonce,u32(r.ciphertext.length),r.ciphertext);seq++;
 }
 return join(parts);
}
export function decryptFile(container:Uint8Array,password:string):{data:Uint8Array;header:NsvHeader}{
 let o=0;const hlen=readU32(container,o);o+=4;if(hlen>MAX_HEADER_BYTES||o+hlen>container.length)throw new Error("Malformed header");
 const hb=container.subarray(o,o+hlen);o+=hlen;const header=decodeHeader(hb);
 const salt=new Uint8Array(header.salt.match(/../g)!.map(x=>parseInt(x,16))),key=deriveKey(password,salt),parts:Uint8Array[]=[];
 let expectedSeq=0,total=0;
 while(o<container.length){
  const seq=readU32(container,o);o+=4;if(seq!==expectedSeq)throw new Error("Invalid chunk sequence");
  if(o>=container.length)throw new Error("Malformed chunk");const nl=container[o++];if(nl!==12||o+nl>container.length)throw new Error("Invalid nonce");
  const nonce=container.subarray(o,o+nl);o+=nl;const clen=readU32(container,o);o+=4;
  if(clen<16||clen>MAX_CHUNK_BYTES||o+clen>container.length)throw new Error("Invalid ciphertext length");
  const cipher=container.subarray(o,o+clen);o+=clen;const plain=decryptChunk(key,cipher,nonce,seq,hb);total+=plain.length;
  if(total>Number(header.originalSize))throw new Error("Integrity/size verification failed");parts.push(plain);expectedSeq++;
 }
 if(total!==Number(header.originalSize))throw new Error("Integrity/size verification failed");
 return {data:join(parts),header};
}