import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildWorkedExample } from "../scripts/worked-example.mjs";

test("public interface exposes only the two shipped modes and states the boundary", async () => {
  const html = await fs.readFile(new URL("../frontend/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<button[^>]*>[^<]*(?:Intake Screen|Cohort Report)/i);
  assert.match(html, /does not run a live intake workflow or produce cohort reports/i);
  assert.match(html, /20 of 20 determinism runs and 100 of 100 self-screen parity profiles on September 5, 2026/i);
  assert.match(html, /worked-example\.html/);
});

test("worked example builds as a complete static artifact with a downloadable RuleSpec", async () => {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "signal-lab-example-"));
  try {
    await buildWorkedExample(target);
    const html = await fs.readFile(path.join(target, "worked-example.html"), "utf8");
    const ruleSpec = JSON.parse(await fs.readFile(path.join(target, "worked-example-rule-spec.json"), "utf8"));
    for (const heading of ["Compiled rule", "Uncompiled language", "Exclusion report", "Rule Impact Report", "Self-screen questions", "Funnel projection"]) assert.match(html, new RegExp(heading, "i"));
    assert.equal(ruleSpec.artifact, "rule_spec");
    assert.equal(ruleSpec.schema_version, "1.0.0");
    assert.match(ruleSpec.rule_hash, /^sha256:[a-f0-9]{64}$/);
    assert.match(html, /worked-example-rule-spec\.json/);
  } finally {
    await fs.rm(target, { recursive: true, force: true });
  }
});
