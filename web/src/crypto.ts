import {gcm} from "@noble/ciphers/aes";
import {argon2id} from "@noble/hashes/argon2";
const te=new TextEncoder();
const random=(n:number)=>crypto.getRandomValues(new Uint8Array(n));
const join=(xs:Uint8Array[])=>{const n=xs.reduce((a,b)=>a+b.length,0),o=new Uint8Array(n);let p=0;for(const x of xs){o.set(x,p);p+=x.length}return o};
const u32=(n:number)=>{const x=new Uint8Array(4);new DataView(x.buffer).setUint32(0,n,true);return x};
const ru32=(x:Uint8Array,p:number)=>new DataView(x.buffer,x.byteOffset+p,4).getUint32(0,true);
const hex=(x:Uint8Array)=>Array.from(x,v=>v.toString(16).padStart(2,"0")).join("");
const unhex=(s:string)=>new Uint8Array(s.match(/../g)!.map(v=>parseInt(v,16)));
export type Header={magic:"NSV1";version:1;algorithm:"AES-256-GCM";kdf:"Argon2id";salt:string;chunkSize:number;originalName:string;originalSize:number;createdAt:string;operationId:string};
export async function keyFromPassword(password:string,salt:Uint8Array){return argon2id(te.encode(password),salt,{t:3,m:65536,p:1,dkLen:32})}
function aad(headerBytes:Uint8Array,seq:number){return join([headerBytes,u32(seq)])}
export async function encrypt(input:Uint8Array,name:string,password:string){
 const salt=random(16),key=await keyFromPassword(password,salt),chunkSize=1024*1024;
 const header:Header={magic:"NSV1",version:1,algorithm:"AES-256-GCM",kdf:"Argon2id",salt:hex(salt),chunkSize,originalName:name,originalSize:input.length,createdAt:new Date().toISOString(),operationId:hex(random(16))};
 const hb=te.encode(JSON.stringify(header)+"\n"),parts=[u32(hb.length),hb];
 for(let seq=0,o=0;o<input.length;o+=chunkSize,seq++){const nonce=random(12);const cipher=gcm(key,nonce,aad(hb,seq)).encrypt(input.subarray(o,Math.min(o+chunkSize,input.length)));parts.push(u32(seq),new Uint8Array([12]),nonce,u32(cipher.length),cipher)}
 return join(parts);
}
export async function decrypt(input:Uint8Array,password:string){
 let p=0;const hl=ru32(input,p);p+=4;const hb=input.subarray(p,p+hl);p+=hl;const h=JSON.parse(new TextDecoder().decode(hb)) as Header;
 if(h.magic!=="NSV1"||h.version!==1||h.algorithm!=="AES-256-GCM")throw Error("Unsupported Nexora container");
 const key=await keyFromPassword(password,unhex(h.salt)),out:Uint8Array[]=[];
 while(p<input.length){const seq=ru32(input,p);p+=4;const nl=input[p++];const nonce=input.subarray(p,p+nl);p+=nl;const cl=ru32(input,p);p+=4;const c=input.subarray(p,p+cl);p+=cl;out.push(gcm(key,nonce,aad(hb,seq)).decrypt(c))}
 const data=join(out);if(data.length!==h.originalSize)throw Error("Integrity verification failed");return {data,header:h};
}