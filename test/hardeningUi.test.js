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
  assert.match(html, /Self-screen parity: 100\/100, boundary-value suite, run 2026-09-05/i);
  assert.match(html, /Determinism: 20\/20 repeated evaluations, run 2026-09-05/i);
  assert.equal((html.match(/Default source: published sector estimate, user-editable/g) || []).length, 2);
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
    assert.match(html, /Not computed\..+below the minimum of 10/i);
    assert.match(html, /Applicant labor cost per dollar granted = 0\.34 × 100 = 34 cents/i);
    assert.match(html, /Grants available<\/small><strong>20<\/strong>/i);
  } finally {
    await fs.rm(target, { recursive: true, force: true });
  }
});
