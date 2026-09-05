import test from "node:test";
import assert from "node:assert/strict";
import { computeRuleHash, SCHEMA_VERSION } from "../src/artifacts.js";
import { evaluateProfile, finalizeRuleSpec, loadRuleArtifact } from "../src/ruleSpec.js";

const draft = {
  version: "1.0",
  name: "Artifact fixture",
  clauses: [{ id: "C001", sourceSentence: "Applicants must operate in Virginia.", fact: "geography", operator: "contains_any", value: ["Virginia"], mandatory: true, reasonCode: "GEO_INELIGIBLE", selfScreenQuestion: "Do you operate in Virginia?" }],
  uncompiledLanguage: [],
};

test("RuleSpec freezes metadata, hash, and reserved fields", () => {
  const spec = finalizeRuleSpec(draft, { generatedAt: "2026-09-05T12:00:00.000Z", generatorVersion: "abc1234" });
  assert.equal(spec.artifact, "rule_spec");
  assert.equal(spec.schema_version, SCHEMA_VERSION);
  assert.equal(spec.generator_version, "abc1234");
  assert.equal(spec.rule_hash, computeRuleHash(spec.clauses));
  for (const field of ["batch_id", "submission_id", "stage_timestamps", "referral_source", "self_screen_outcome", "final_disposition"]) assert.equal(spec[field], null);
});

test("rule hash is stable across clause order and ignores artifact timestamps", () => {
  const second = { ...draft.clauses[0], id: "C002", sourceSentence: "Applicants must have two years of history.", fact: "years_operating", operator: "gte", value: 2, reasonCode: "OPERATING_HISTORY_SHORT" };
  assert.equal(computeRuleHash([second, draft.clauses[0]]), computeRuleHash([draft.clauses[0], second]));
});

test("a missing schema version is treated as 0.x and migrated visibly", () => {
  const result = loadRuleArtifact(draft, { generatedAt: "2026-09-05T12:00:00.000Z", generatorVersion: "abc1234" });
  assert.match(result.notice, /migrated from schema version 0\.x/);
  assert.equal(result.ruleSpec.schema_version, SCHEMA_VERSION);
});

test("a pre-freeze SessionBundle migrates its enclosed RuleSpec", () => {
  const result = loadRuleArtifact({ version: "1.0", exportedAt: "2026-08-10T12:00:00Z", ruleSpec: draft });
  assert.match(result.notice, /migrated from schema version 0\.x/);
  assert.equal(result.ruleSpec.name, draft.name);
});

test("a newer major schema is refused before fields are partially parsed", () => {
  assert.throws(() => loadRuleArtifact({ artifact: "rule_spec", schema_version: "2.0.0", clauses: "malformed" }), /uses schema version 2\.0\.0.*supports 1\.0\.0/);
});

test("same-major RuleSpec loads without migration", () => {
  const spec = finalizeRuleSpec(draft);
  const result = loadRuleArtifact(spec);
  assert.equal(result.notice, null);
  assert.deepEqual(result.ruleSpec, spec);
});

test("a compatible newer minor version loads without migration", () => {
  const spec = { ...finalizeRuleSpec(draft), schema_version: "1.1.0", compatible_addition: "ignored by the evaluator" };
  const result = loadRuleArtifact(spec);
  assert.equal(result.notice, null);
  assert.equal(result.ruleSpec.schema_version, "1.1.0");
});

test("a tampered clause set is refused when the hash no longer matches", () => {
  const spec = finalizeRuleSpec(draft);
  spec.clauses[0].value = ["Ohio"];
  assert.throws(() => loadRuleArtifact(spec), /rule-hash validation/);
});

test("defined custom reason codes keep their CUSTOM_ prefix in outcomes", () => {
  const spec = finalizeRuleSpec({ ...draft, custom_reason_codes: { CUSTOM_RURAL_COUNTY_ONLY: "Applicant is outside the foundation's named rural counties." }, clauses: [{ ...draft.clauses[0], reasonCode: "CUSTOM_RURAL_COUNTY_ONLY" }] });
  assert.equal(evaluateProfile(spec, { organizationName: "Fixture", geography: "Ohio" }).reasonCode, "CUSTOM_RURAL_COUNTY_ONLY");
});

test("undefined custom reason codes are rejected", () => {
  assert.throws(() => finalizeRuleSpec({ ...draft, clauses: [{ ...draft.clauses[0], reasonCode: "CUSTOM_UNKNOWN" }] }), /Custom reason codes must be defined/);
});
