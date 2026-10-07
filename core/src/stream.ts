import {createSalt,deriveKey,encryptChunk,decryptChunk,operationId} from "./crypto.js";
import {CHUNK_SIZE,NSV_MAGIC,NSV_VERSION,encodeHeader,decodeHeader,type NsvHeader} from "./protocol.js";
export type ByteSource=AsyncIterable<Uint8Array>;
export type ByteSink=(chunk:Uint8Array)=>Promise<void>|void;
const u32=(n:number)=>{const x=new Uint8Array(4);new DataView(x.buffer).setUint32(0,n,true);return x};
const readU32=(b:Uint8Array,o:number)=>new DataView(b.buffer,b.byteOffset+o,4).getUint32(0,true);
const concat=(a:Uint8Array,b:Uint8Array)=>{const x=new Uint8Array(a.length+b.length);x.set(a);x.set(b,a.length);return x};
async function* chunks(source:ByteSource){let pending=new Uint8Array();for await(const part of source){pending=concat(pending,part);while(pending.length>=CHUNK_SIZE){yield pending.subarray(0,CHUNK_SIZE);pending=pending.slice(CHUNK_SIZE)}}if(pending.length)yield pending}
export async function encryptStream(source:ByteSource,sink:ByteSink,password:string,fileName:string,originalSize:number,createdAt=new Date().toISOString()){
 const salt=createSalt(),key=deriveKey(password,salt),header:NsvHeader={magic:NSV_MAGIC,version:NSV_VERSION,algorithm:"AES-256-GCM",kdf:"Argon2id",salt:Array.from(salt,x=>x.toString(16).padStart(2,"0")).join(""),chunkSize:CHUNK_SIZE,originalName:fileName.replace(/[\\/]/g,"_"),originalSize:String(originalSize),createdAt,operationId:operationId()};
 const hb=encodeHeader(header);await sink(concat(u32(hb.length),hb));let seq=0;
 for await(const plain of chunks(source)){const r=encryptChunk(key,plain,seq,hb);await sink(concat(concat(concat(u32(seq),new Uint8Array([12])),r.nonce),concat(u32(r.ciphertext.length),r.ciphertext)));seq++}
 return header;
}
export async function decryptStream(source:AsyncIterable<Uint8Array>,sink:ByteSink,password:string){
 const all:Uint8Array[]=[];for await(const p of source)all.push(p);const container=all.reduce((a,b)=>concat(a,b),new Uint8Array());let o=0;
 const hlen=readU32(container,o);o+=4;const hb=container.subarray(o,o+hlen);o+=hlen;const header=decodeHeader(hb);const salt=new Uint8Array(header.salt.match(/../g)!.map(x=>parseInt(x,16))),key=deriveKey(password,salt);let expected=0,total=0;
 while(o<container.length){const seq=readU32(container,o);o+=4;if(seq!==expected)throw new Error("Invalid chunk sequence");const nl=container[o++];const nonce=container.subarray(o,o+nl);o+=nl;const clen=readU32(container,o);o+=4;const cipher=container.subarray(o,o+clen);o+=clen;const plain=decryptChunk(key,cipher,nonce,seq,hb);total+=plain.length;if(total>Number(header.originalSize))throw new Error("Integrity/size verification failed");await sink(plain);expected++}
 if(total!==Number(header.originalSize))throw new Error("Integrity/size verification failed");return header;
}