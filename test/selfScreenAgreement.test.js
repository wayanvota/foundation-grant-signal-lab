import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProfile, evaluateSelfScreen, generateSelfScreen } from "../src/ruleSpec.js";

const ruleSpec = {
  version: "1.0",
  name: "Boundary-complete parity fixture",
  clauses: [
    clause("C001", "Applicants must operate in North Carolina or Virginia.", "geography", "contains_any", ["North Carolina", "Virginia"], "GEO_INELIGIBLE", "Do you operate in North Carolina or Virginia?"),
    clause("C002", "Applicants must address health, housing, or education.", "issue_area", "in", ["health", "housing", "education"], "ISSUE_AREA_OUT_OF_SCOPE", "Does your work address health, housing, or education?"),
    clause("C003", "Applicants must be a 501(c)(3).", "org_type", "equals", "501(c)(3)", "ORG_TYPE_INELIGIBLE", "Are you a 501(c)(3)?"),
    clause("C004", "Annual budgets must be at least $100,000.", "annual_budget", "gte", 100000, "BUDGET_BELOW_FLOOR", "Is your annual budget at least $100,000?"),
    clause("C005", "Annual budgets must not exceed $5 million.", "annual_budget", "lte", 5000000, "BUDGET_ABOVE_CEILING", "Is your annual budget $5 million or less?"),
    clause("C006", "Applicants must have at least two years of operating history.", "years_operating", "gte", 2, "OPERATING_HISTORY_SHORT", "Have you operated for at least two years?"),
    clause("C007", "Applicants cannot be included in a group return.", "filing_relationship", "not_in", ["group_return"], "ORG_TYPE_INELIGIBLE", "Do you file independently or through a fiscal sponsor rather than a group return?"),
  ],
  uncompiledLanguage: [],
};

test("self-screen and evaluator agree for 100 boundary-complete profiles", () => {
  const questions = generateSelfScreen(ruleSpec).questions;
  assert.deepEqual(questions.map((item) => item.clauseId), ruleSpec.clauses.map((item) => item.id));
  const profiles = buildProfiles();
  assert.equal(profiles.length, 100);
  for (const profile of profiles) {
    const evaluator = evaluateProfile(ruleSpec, profile);
    const selfScreen = evaluateSelfScreen(ruleSpec, profile);
    const comparable = { status: evaluator.status, decidingClauseId: evaluator.decidingClauseId, reasonCode: evaluator.reasonCode, missingFact: evaluator.missingFact };
    assert.deepEqual(selfScreen, comparable, `${profile.organizationName}: parity mismatch at ${comparable.decidingClauseId || "admit"}`);
  }
});

function buildProfiles() {
  const base = { filingRelationship: "standalone", annualBudget: 500000, yearsOperating: 4, geography: "North Carolina", issueArea: "health", orgType: "501(c)(3)", description: "Generated parity profile." };
  const profiles = [
    { ...base, geography: null }, { ...base, issueArea: null }, { ...base, orgType: null },
    { ...base, annualBudget: null }, { ...base, yearsOperating: null }, { ...base, filingRelationship: null },
    { ...base, annualBudget: 99999 }, { ...base, annualBudget: 100000 }, { ...base, annualBudget: 5000000 }, { ...base, annualBudget: 5000001 },
    { ...base, yearsOperating: 1.99 }, { ...base, yearsOperating: 2 },
  ];
  const geography = ["North Carolina", "Virginia", "Ohio"];
  const issueArea = ["health", "housing", "education", "arts"];
  const orgType = ["501(c)(3)", "501(c)(6)"];
  const budgets = [100000, 100001, 4999999, 5000000, 5000001];
  const years = [2, 2.01, 10, 1.99];
  const filings = ["standalone", "fiscal_sponsor", "group_return"];
  for (let index = profiles.length; index < 100; index += 1) profiles.push({ ...base, geography: geography[index % geography.length], issueArea: issueArea[index % issueArea.length], orgType: orgType[index % orgType.length], annualBudget: budgets[index % budgets.length], yearsOperating: years[index % years.length], filingRelationship: filings[index % filings.length] });
  return profiles.map((profile, index) => ({ ...profile, organizationName: `Parity profile ${String(index + 1).padStart(3, "0")}` }));
}

function clause(id, sourceSentence, fact, operator, value, reasonCode, selfScreenQuestion) {
  return { id, sourceSentence, fact, operator, value, mandatory: true, reasonCode, selfScreenQuestion };
}
