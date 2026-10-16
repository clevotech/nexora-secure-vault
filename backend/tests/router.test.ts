import {test} from "node:test";
import assert from "node:assert/strict";
import {routeModel} from "../src/registry.js";
import {validateChat} from "../src/router.js";

test("auto router selects a task-capable model",()=>{
  assert.equal(routeModel("auto","coding").strengths.includes("coding"),true);
});
test("explicit model is preserved",()=>{
  assert.equal(routeModel("anthropic:claude-fable-5-1","chat").id,"anthropic:claude-fable-5-1");
});
test("invalid model is rejected",()=>{
  assert.throws(()=>validateChat({messages:[{role:"user",content:"hi"}],model:"not-real"}));
});
test("message limits are enforced",()=>{
  assert.throws(()=>validateChat({messages:[]}));
});
