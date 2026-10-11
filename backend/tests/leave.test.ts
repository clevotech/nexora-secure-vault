import {test} from "node:test";
import assert from "node:assert/strict";
import {expectedResumption,localTimeToUtc,validIsoDate} from "../src/leave.js";

test("validIsoDate rejects impossible calendar dates",()=>{
  assert.equal(validIsoDate("2026-10-11"),true);
  assert.equal(validIsoDate("2026-02-30"),false);
  assert.equal(validIsoDate("11-10-2026"),false);
});

test("expectedResumption skips weekends and configured holidays",()=>{
  assert.equal(expectedResumption("2026-10-09",[1,2,3,4,5],["2026-10-12"]),"2026-10-13");
});

test("localTimeToUtc converts 09:00 to Africa/Lagos local time",()=>{
  assert.equal(localTimeToUtc("2026-01-05","Africa/Lagos",9).toISOString(),"2026-01-05T08:00:00.000Z");
});

test("localTimeToUtc respects daylight saving time",()=>{
  assert.equal(localTimeToUtc("2026-07-15","America/New_York",9).toISOString(),"2026-07-15T13:00:00.000Z");
});
