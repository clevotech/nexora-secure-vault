import {gcm} from "@noble/ciphers/aes";
import {argon2id} from "@noble/hashes/argon2";

const enc=new TextEncoder();
const dec=new TextDecoder();
const concat=(a:Uint8Array,b:Uint8Array)=>{const x=new Uint8Array(a.length+b.length);x.set(a);x.set(b,a.length);return x};
const random=(n:number)=>crypto.getRandomValues(new Uint8Array(n));
const hex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");

export type CryptoParams={salt:Uint8Array;chunkSize:number};

export function deriveKey(password:string,salt:Uint8Array):Uint8Array{
  return argon2id(enc.encode(password),salt,{t:3,m:65536,p:1,dkLen:32});
}
export function encryptChunk(key:Uint8Array,plain:Uint8Array,sequence:number,associated:Uint8Array){
  const nonce=random(12);
  const aad=concat(associated,new Uint8Array(new Uint32Array([sequence]).buffer));
  const cipher=gcm(key,nonce,aad);
  return {nonce,ciphertext:cipher.encrypt(plain)};
}
export function decryptChunk(key:Uint8Array,ciphertext:Uint8Array,nonce:Uint8Array,sequence:number,associated:Uint8Array){
  const aad=concat(associated,new Uint8Array(new Uint32Array([sequence]).buffer));
  return gcm(key,nonce,aad).decrypt(ciphertext);
}
export const createSalt=()=>random(16);
export const operationId=()=>hex(random(16));
export const sha256=async(data:Uint8Array)=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",data)));
