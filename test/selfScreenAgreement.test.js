import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProfile, generateSelfScreen } from "../src/ruleSpec.js";

test("self-screen and evaluator agree for 100 generated profiles", () => {
  const ruleSpec = {
    version: "1.0",
    name: "Generated agreement fixture",
    clauses: [
      { id: "C001", sourceSentence: "Applicants must operate in North Carolina or Virginia.", fact: "geography", operator: "contains_any", value: ["North Carolina", "Virginia"], mandatory: true, reasonCode: "GEO_INELIGIBLE", selfScreenQuestion: "Do you operate in North Carolina or Virginia?" },
      { id: "C002", sourceSentence: "Applicants must have at least one year of operating history.", fact: "years_operating", operator: "gte", value: 1, mandatory: true, reasonCode: "OPERATING_HISTORY_SHORT", selfScreenQuestion: "Have you operated for at least one year?" },
      { id: "C003", sourceSentence: "Annual budgets must not exceed $5 million.", fact: "annual_budget", operator: "lte", value: 5000000, mandatory: true, reasonCode: "BUDGET_ABOVE_CEILING", selfScreenQuestion: "Is your annual budget $5 million or less?" },
    ],
    uncompiledLanguage: [],
  };
  const selfScreen = generateSelfScreen(ruleSpec);
  const selfScreenSpec = {
    version: "1.0",
    name: "Self-screen evaluator fixture",
    clauses: selfScreen.questions.map((question) => ({
      id: question.clauseId,
      sourceSentence: ruleSpec.clauses.find((clause) => clause.id === question.clauseId).sourceSentence,
      fact: question.fact,
      operator: question.operator,
      value: question.value,
      mandatory: true,
      reasonCode: ruleSpec.clauses.find((clause) => clause.id === question.clauseId).reasonCode,
      selfScreenQuestion: question.question,
    })),
    uncompiledLanguage: [],
  };

  for (let index = 0; index < 100; index += 1) {
    const profile = {
      organizationName: `Fictional profile ${index + 1}`,
      filingRelationship: index % 4 === 0 ? "fiscal_sponsor" : "standalone",
      annualBudget: (index + 1) * 100000,
      yearsOperating: index % 6,
      geography: index % 3 === 0 ? "North Carolina" : index % 3 === 1 ? "Virginia" : "Ohio",
      issueArea: "community services",
      orgType: "501(c)(3)",
      description: "Generated test profile.",
    };
    assert.deepEqual(evaluateProfile(selfScreenSpec, profile), evaluateProfile(ruleSpec, profile), `Profile ${index + 1} disagreed`);
  }
});

