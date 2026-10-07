import {test} from "node:test";import assert from "node:assert/strict";import {applyCredit,balance} from "../src/credits.js";
test("credit ledger is idempotent",()=>{applyCredit("u",10,"grant","k1");applyCredit("u",10,"grant","k1");assert.equal(balance("u"),10);});
test("cannot overspend",()=>{assert.throws(()=>applyCredit("new",-1,"use","k2"));});