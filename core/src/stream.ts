import {createSalt,deriveKey,encryptChunk,decryptChunk,operationId,encryptMetadata,decryptMetadata} from "./crypto.js";
import {CHUNK_SIZE,NSV_MAGIC,NSV_VERSION,encodeHeader,decodeHeader,type NsvHeader} from "./protocol.js";
export type ByteSource=AsyncIterable<Uint8Array>;
export type ByteSink=(chunk:Uint8Array)=>Promise<void>|void;
const u32=(n:number)=>{const x=new Uint8Array(4);new DataView(x.buffer).setUint32(0,n,true);return x};
const ru32=(b:Uint8Array,o:number)=>new DataView(b.buffer,b.byteOffset+o,4).getUint32(0,true);
const concat=(a:Uint8Array,b:Uint8Array)=>{const x=new Uint8Array(a.length+b.length);x.set(a);x.set(b,a.length);return x};
async function* chunks(source:ByteSource){let pending=new Uint8Array();for await(const part of source){pending=concat(pending,part);while(pending.length>=CHUNK_SIZE){yield pending.subarray(0,CHUNK_SIZE);pending=pending.slice(CHUNK_SIZE)}}if(pending.length)yield pending}
async function readExact(source:AsyncIterator<Uint8Array>,state:{buf:Uint8Array},n:number):Promise<Uint8Array>{
 while(state.buf.length<n){const next=await source.next();if(next.done)throw new Error("Unexpected end of container");state.buf=concat(state.buf,next.value)}
 const out=state.buf.slice(0,n);state.buf=state.buf.slice(n);return out;
}
export async function encryptStream(source:ByteSource,sink:ByteSink,password:string,fileName:string,originalSize:number,createdAt=new Date().toISOString()){
 const salt=createSalt(),key=deriveKey(password,salt),id=operationId(),safeName=fileName.replace(/[\\/]/g,"_").slice(0,1024)||"file";
 const privateMetadata=encryptMetadata(key,JSON.stringify({originalName:safeName}));
 const header:NsvHeader={magic:NSV_MAGIC,version:NSV_VERSION,algorithm:"AES-256-GCM",kdf:"Argon2id",salt:Array.from(salt,x=>x.toString(16).padStart(2,"0")).join(""),chunkSize:CHUNK_SIZE,originalName:"Encrypted file",originalSize:String(originalSize),createdAt,operationId:id,...privateMetadata};
 const hb=encodeHeader(header);await sink(concat(u32(hb.length),hb));let seq=0,wrote=false;
 for await(const plain of chunks(source)){const r=encryptChunk(key,plain,seq,hb);await sink(concat(concat(concat(u32(seq),new Uint8Array([12])),r.nonce),concat(u32(r.ciphertext.length),r.ciphertext)));seq++;wrote=true}
 if(!wrote){const r=encryptChunk(key,new Uint8Array(),0,hb);await sink(concat(concat(concat(u32(0),new Uint8Array([12])),r.nonce),concat(u32(r.ciphertext.length),r.ciphertext)))}
 return {...header,originalName:safeName};
}
export function restoreHeaderName(header:NsvHeader,password:string):string{
 if(!header.nameNonce||!header.nameCiphertext)return header.originalName;
 const salt=new Uint8Array(header.salt.match(/../g)!.map(x=>parseInt(x,16))),key=deriveKey(password,salt);
 let metadata:{originalName?:string};
 try{metadata=JSON.parse(decryptMetadata(key,header.nameNonce,header.nameCiphertext))}catch{throw new Error("Incorrect password or damaged encrypted file");}
 if(typeof metadata.originalName!=="string"||!metadata.originalName)throw new Error("Encrypted filename metadata is invalid");
 return metadata.originalName.replace(/[\\/]/g,"_").slice(0,1024)||"decrypted-file";
}
export async function decryptStream(source:ByteSource,sink:ByteSink,password:string){
 const it=source[Symbol.asyncIterator](),state={buf:new Uint8Array()};
 const hlen=ru32(await readExact(it,state,4),0);if(hlen>64*1024)throw new Error("Invalid header length");
 const hb=await readExact(it,state,hlen),header=decodeHeader(hb),salt=new Uint8Array(header.salt.match(/../g)!.map(x=>parseInt(x,16))),key=deriveKey(password,salt);
 let expected=0,total=0,outputHeader=header;
 if(header.nameNonce&&header.nameCiphertext)outputHeader={...header,originalName:restoreHeaderName(header,password)};
 const expectedSize=Number(header.originalSize);
 while(true){
  if(state.buf.length===0){const next=await it.next();if(next.done)break;state.buf=new Uint8Array(next.value)}
  const seq=ru32(await readExact(it,state,4),0);if(seq!==expected)throw new Error("Invalid chunk sequence");
  const nl=(await readExact(it,state,1))[0];if(nl!==12)throw new Error("Invalid nonce");
  const nonce=await readExact(it,state,nl),clen=ru32(await readExact(it,state,4),0);
  if(clen<16||clen>CHUNK_SIZE+16)throw new Error("Invalid ciphertext length");
  const cipher=await readExact(it,state,clen),plain=decryptChunk(key,cipher,nonce,seq,hb);total+=plain.length;
  if(total>expectedSize)throw new Error("Integrity/size verification failed");
  await sink(plain);expected++;
 }
 if(state.buf.length!==0||total!==expectedSize)throw new Error("Integrity/size verification failed");
 return outputHeader;
}
