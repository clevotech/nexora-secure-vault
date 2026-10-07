import test from "node:test";
import assert from "node:assert/strict";
import {encryptFile,decryptFile} from "../src/container.js";
test("round trips arbitrary bytes",()=>{const input=crypto.getRandomValues(new Uint8Array(2_500_123));const c=encryptFile(input,"correct horse battery staple","sample.bin");const d=decryptFile(c,"correct horse battery staple");assert.deepEqual(d.data,input);assert.equal(d.header.originalName,"sample.bin")});
test("wrong password fails",()=>{const input=new TextEncoder().encode("Nexora secure vault");const c=encryptFile(input,"right","a.txt");assert.throws(()=>decryptFile(c,"wrong"))});
