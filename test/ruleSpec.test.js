import test from "node:test";
import assert from "node:assert/strict";
import { calculateFunnel, evaluateCandidateSet, evaluateProfile, generateSelfScreen } from "../src/ruleSpec.js";

const ruleSpec = {
  version: "1.0",
  name: "Fictional open call",
  clauses: [
    { id: "C001", sourceSentence: "Applicants must operate in North Carolina.", fact: "geography", operator: "contains_any", value: ["North Carolina"], mandatory: true, reasonCode: "GEO_INELIGIBLE", selfScreenQuestion: "Does your organization operate in North Carolina?" },
    { id: "C002", sourceSentence: "Applicants must have operated for at least two years.", fact: "years_operating", operator: "gte", value: 2, mandatory: true, reasonCode: "OPERATING_HISTORY_SHORT", selfScreenQuestion: "Has your organization operated for at least two years?" },
  ],
  uncompiledLanguage: [{ sourceSentence: "We prioritize community-rooted organizations.", reason: "Community-rootedness is not a testable applicant fact." }],
};

const baseProfile = { organizationName: "Fictional Applicant", filingRelationship: "standalone", annualBudget: 100000, yearsOperating: 4, geography: "North Carolina", issueArea: "health", orgType: "501(c)(3)", description: "Fictional." };

test("the same RuleSpec and profile produce identical clause-level outcomes", () => {
  const outcomes = Array.from({ length: 20 }, () => evaluateProfile(ruleSpec, baseProfile));
  for (const outcome of outcomes) assert.deepEqual(outcome, outcomes[0]);
  assert.equal(outcomes[0].status, "ADMIT");
});

test("mandatory failures exclude with the deciding clause and reason code", () => {
  const result = evaluateProfile(ruleSpec, { ...baseProfile, yearsOperating: 1 });
  assert.equal(result.status, "EXCLUDE");
  assert.equal(result.decidingClauseId, "C002");
  assert.equal(result.reasonCode, "OPERATING_HISTORY_SHORT");
});

test("missing facts return indeterminate rather than guessing", () => {
  const result = evaluateProfile(ruleSpec, { ...baseProfile, geography: "" });
  assert.equal(result.status, "INDETERMINATE");
  assert.equal(result.missingFact, "geography");
});

test("self-screen exposes exactly the mandatory evaluator tests", () => {
  const selfScreen = generateSelfScreen(ruleSpec);
  assert.equal(selfScreen.questions.length, 2);
  assert.match(selfScreen.html, /data-clause-id="C001"/);
  assert.match(selfScreen.plainText, /C002/);
});

test("impact report names the clause driving a filing-thin differential", () => {
  const set = [
    { ...baseProfile, organizationName: "Thin A", filingRelationship: "fiscal_sponsor", yearsOperating: 1 },
    { ...baseProfile, organizationName: "Thin B", filingRelationship: "990_n", yearsOperating: 1 },
    { ...baseProfile, organizationName: "Incumbent", yearsOperating: 8 },
  ];
  const report = evaluateCandidateSet(ruleSpec, set).impactReport;
  assert.equal(report.filingThin.exclusionRate, 1);
  assert.equal(report.other.exclusionRate, 0);
  assert.equal(report.clauseDrivers[0].clauseId, "C002");
});

test("funnel projection exposes inputs and arithmetic, including explicit zero costs", () => {
  const result = calculateFunnel({ totalPool: 1000000, grantSize: 250000, expectedApplications: 10, minutesPerFirstRead: 30, hoursPerApplication: 2, loadedHourlyCost: 0, applicantHoursPerApplication: 4, applicantHourlyValue: 0 });
  assert.equal(result.outputs.grantsAvailable, 4);
  assert.equal(result.outputs.reviewerHours, 25);
  assert.equal(result.outputs.applicantCost, 0);
  assert.equal(result.inputs.loadedHourlyCost, 0);
});
