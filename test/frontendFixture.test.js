import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("stored sample is explicitly fictional and contains no applicant contact fields", () => {
  const source = fs.readFileSync(new URL("../frontend/app.js", import.meta.url), "utf8");
  assert.match(source, /const sampleMemo/);
  assert.match(source, /fictional stored fixture/i);
  assert.doesNotMatch(source, /sampleMemo[\s\S]{0,1000}(?:email|phone|address)\s*:/i);
});
