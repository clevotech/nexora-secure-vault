import test from "node:test";
import assert from "node:assert/strict";
import {encryptFile,decryptFile} from "../src/container.js";

test("round trips arbitrary multi-chunk bytes",()=>{
  const input=new Uint8Array(2_500_123); for(let i=0;i<input.length;i++)input[i]=(i*31)%256;
  const c=encryptFile(input,"correct horse battery staple","sample.bin","2026-01-01T00:00:00.000Z");
  const d=decryptFile(c,"correct horse battery staple");
  assert.deepEqual(d.data,input); assert.equal(d.header.originalName,"sample.bin");\n  const rawHeader=new TextDecoder().decode(c.subarray(4,4+new DataView(c.buffer,c.byteOffset,4).getUint32(0,true)));\n  assert.equal(rawHeader.includes("sample.bin"),false,"encrypted container must not expose the original filename");\n  assert.equal(d.header.originalSize,String(input.length));
});

test("empty file is authenticated and round trips",()=>{
  const c=encryptFile(new Uint8Array(),"secret","empty.bin","2026-01-01T00:00:00.000Z");
  assert.ok(c.length>100); assert.equal(decryptFile(c,"secret").data.length,0);
  const tampered=c.slice(); tampered[tampered.length-1]^=1; assert.throws(()=>decryptFile(tampered,"secret"));
});

test("wrong password fails authentication",()=>{
  const c=encryptFile(new TextEncoder().encode("Nexora secure vault"),"right","a.txt");
  assert.throws(()=>decryptFile(c,"wrong"));
});

test("header tampering fails authentication",()=>{
  const c=encryptFile(new TextEncoder().encode("authenticated metadata"),"secret","a.txt");
  c[8]^=1; assert.throws(()=>decryptFile(c,"secret"));
});

test("truncation fails",()=>{
  const c=encryptFile(new Uint8Array(10000).fill(7),"secret","a.bin");
  assert.throws(()=>decryptFile(c.slice(0,-3),"secret"));
});