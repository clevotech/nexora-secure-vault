import test from "node:test";
import assert from "node:assert/strict";
import {encryptFile,decryptFile} from "../src/container.js";

test("round trips arbitrary multi-chunk bytes",()=>{
  const input=new Uint8Array(2_500_123);
  for(let i=0;i<input.length;i++) input[i]=(i*31)%256;
  const c=encryptFile(input,"sample.bin","correct horse battery staple");
  const d=decryptFile(c,"correct horse battery staple");
  assert.deepEqual(d.data,input);
  assert.equal(d.header.originalName,"sample.bin");
});

test("wrong password fails authentication",()=>{
  const input=new TextEncoder().encode("Nexora secure vault");
  const c=encryptFile(input,"a.txt","right");
  assert.throws(()=>decryptFile(c,"wrong"));
});

test("empty file round trip",()=>{
  const input=new Uint8Array();
  const c=encryptFile(input,"empty.bin","secret");
  const d=decryptFile(c,"secret");
  assert.equal(d.data.length,0);
});

test("tampering with encrypted bytes fails",()=>{
  const input=new TextEncoder().encode("tamper detection");
  const c=encryptFile(input,"a.txt","secret");
  const index=Math.max(8,c.length-5);
  c[index]^=1;
  assert.throws(()=>decryptFile(c,"secret"));
});
