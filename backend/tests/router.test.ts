import {test} from "node:test";
import assert from "node:assert/strict";
import {routeModel} from "../src/registry.js";
import {validateChat} from "../src/router.js";

test("auto router selects a task-capable model",()=>{
  assert.equal(routeModel("auto","coding").strengths.includes("coding"),true);
});
test("explicit model is preserved",()=>{
  assert.equal(routeModel("openai:gpt-6-astra","chat").id,"openai:gpt-6-astra");
});
test("invalid model is rejected",()=>{
  assert.throws(()=>validateChat({messages:[{role:"user",content:"hi"}],model:"not-real"}));
});
test("message limits are enforced",()=>{
  assert.throws(()=>validateChat({messages:[]}));
});
