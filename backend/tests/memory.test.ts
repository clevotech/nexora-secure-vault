import {test} from "node:test";
import assert from "node:assert/strict";
import {deleteMemory,listMemory,saveMemory} from "../src/memory.js";

test("memory is isolated by user",()=>{
  const a=saveMemory("user-a","likes concise answers");
  saveMemory("user-b","different user");
  assert.equal(listMemory("user-a").some(x=>x.id===a.id),true);
  assert.equal(listMemory("user-b").some(x=>x.id===a.id),false);
  assert.equal(deleteMemory("user-b",a.id),false);
});
