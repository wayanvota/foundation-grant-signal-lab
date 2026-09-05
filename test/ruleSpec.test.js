import test from "node:test";
import assert from "node:assert/strict";
import { calculateFunnel, evaluateCandidateSet, evaluateProfile, generateSelfScreen, starterProfiles } from "../src/ruleSpec.js";

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
  const outputs = Array.from({ length: 20 }, () => JSON.stringify(evaluateProfile(ruleSpec, baseProfile)));
  for (const output of outputs) assert.equal(output, outputs[0]);
  assert.equal(JSON.parse(outputs[0]).status, "ADMIT");
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

test("impact report suppresses comparisons below the minimum group size", () => {
  const set = [{ ...baseProfile, organizationName: "Thin A", filingRelationship: "fiscal_sponsor" }, { ...baseProfile, organizationName: "Other A" }];
  const report = evaluateCandidateSet(ruleSpec, set).impactReport;
  assert.equal(report.computed, false);
  assert.equal(report.filingThin.exclusionRate, null);
  assert.equal(report.differentialPercentagePoints, null);
  assert.match(report.message, /below the minimum of 10/);
});

test("impact report names an unrelated deciding clause when both groups meet the minimum", () => {
  const thin = Array.from({ length: 10 }, (_, index) => ({ ...baseProfile, organizationName: `Thin ${index}`, filingRelationship: "fiscal_sponsor", geography: index < 5 ? "Ohio" : "North Carolina" }));
  const other = Array.from({ length: 10 }, (_, index) => ({ ...baseProfile, organizationName: `Other ${index}`, geography: index < 2 ? "Ohio" : "North Carolina" }));
  const report = evaluateCandidateSet(ruleSpec, [...thin, ...other]).impactReport;
  assert.equal(report.computed, true);
  assert.equal(report.filingThin.count, 10);
  assert.equal(report.other.count, 10);
  assert.equal(report.clauseDrivers.find((item) => item.clauseId === "C001").differentialPercentagePoints, 30);
  assert.match(report.attribution, /C001 \(geography\).+unrelated to filing structure/);
});

test("funnel projection exposes inputs and arithmetic, including explicit zero costs", () => {
  const result = calculateFunnel({ totalPool: 1000000, grantSize: 250000, expectedApplications: 10, minutesPerFirstRead: 30, advancedReviewHours: 2, expectedAdmitRate: 0.5, loadedHourlyCost: 0, applicantHoursPerApplication: 4, applicantHourlyValue: 0 });
  assert.equal(result.outputs.grantsAvailable, 4);
  assert.equal(result.outputs.firstReadHours, 5);
  assert.equal(result.outputs.advancedReviewHours, 10);
  assert.equal(result.outputs.reviewerHours, 15);
  assert.equal(result.outputs.applicantCost, 0);
  assert.equal(result.inputs.loadedHourlyCost, 0);
});

test("funnel defaults use published applicant assumptions and print dollars and cents", () => {
  const result = calculateFunnel({});
  assert.equal(result.inputs.applicantHoursPerApplication, 40);
  assert.equal(result.inputs.applicantHourlyValue, 85);
  assert.equal(result.inputs.expectedApplications, 1000);
  assert.equal(result.inputs.grantSize, 500000);
  assert.equal(result.inputs.expectedAdmitRate, 0.2);
  assert.equal(result.outputs.grantsAvailable, 20);
  assert.equal(result.outputs.admittedCount, 200);
  assert.equal(result.outputs.applicantCostPerDollarGranted, 0.34);
  assert.equal(result.outputs.applicantCostCentsPerDollarGranted, 34);
  assert.match(result.arithmetic.at(-1), /0\.34 × 100 = 34 cents/);
});

test("candidate exclusions supply the advanced-review count", () => {
  const result = calculateFunnel({ expectedApplications: 200 }, { admittedCount: 7 });
  assert.equal(result.outputs.admittedCount, 7);
  assert.equal(result.outputs.admittedCountSource, "exclusion_report");
  assert.equal(result.outputs.advancedReviewHours, 56);
  assert.equal(result.outputs.reviewerHours, 122.66666666666667);
});

test("starter fixture exercises admissions, exclusions, missing facts, and filing structures", () => {
  const workedRule = {
    version: "1.0", name: "Worked rule", uncompiledLanguage: [], clauses: [
      { id: "C001", sourceSentence: "US only.", fact: "geography", operator: "contains_any", value: ["United States", "Arizona", "Mississippi", "Michigan", "Kentucky", "Kansas", "North Carolina", "California", "Ohio", "New York", "Illinois", "Virginia"], mandatory: true, reasonCode: "GEO_INELIGIBLE", selfScreenQuestion: "US?" },
      { id: "C002", sourceSentence: "Three issue areas.", fact: "issue_area", operator: "contains_any", value: ["youth learning", "food security", "maternal health"], mandatory: true, reasonCode: "ISSUE_AREA_OUT_OF_SCOPE", selfScreenQuestion: "Issue?" },
      { id: "C003", sourceSentence: "Eligible organization type.", fact: "org_type", operator: "contains_any", value: ["501(c)(3)", "fiscally sponsored project"], mandatory: true, reasonCode: "ORG_TYPE_INELIGIBLE", selfScreenQuestion: "Type?" },
      { id: "C004", sourceSentence: "Two years.", fact: "years_operating", operator: "gte", value: 2, mandatory: true, reasonCode: "OPERATING_HISTORY_SHORT", selfScreenQuestion: "Two years?" },
    ],
  };
  const result = evaluateCandidateSet(workedRule, starterProfiles);
  const counts = Object.groupBy(result.results, (item) => item.outcome.status);
  assert.equal(counts.ADMIT.length, 7);
  assert.equal(counts.EXCLUDE.length, 4);
  assert.equal(counts.INDETERMINATE.length, 1);
  assert.equal(result.results.find((item) => item.profile.yearsOperating === 2).outcome.status, "ADMIT");
  assert.equal(result.clauseSummary.find((item) => item.clauseId === "C004").excluded, 2);
  for (const filing of ["fiscal_sponsor", "990_n", "group_return", "no_filing"]) assert.equal(starterProfiles.some((item) => item.filingRelationship === filing), true);
});

test("clause frequency surfaces clauses that never fire and clauses that exclude everything", () => {
  const never = evaluateCandidateSet(ruleSpec, [baseProfile]).clauseFrequencyFindings;
  assert.equal(never.some((item) => item.clauseId === "C001" && item.type === "never_fires"), true);
  const all = evaluateCandidateSet(ruleSpec, [{ ...baseProfile, geography: "Ohio" }]).clauseFrequencyFindings;
  assert.equal(all.some((item) => item.clauseId === "C001" && item.type === "excludes_everything"), true);
});
