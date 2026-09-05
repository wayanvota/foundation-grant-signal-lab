import test from "node:test";
import assert from "node:assert/strict";
import { generateGrantReview } from "../api/review.js";
import { compareClaimsToFiling } from "../src/filingAnalysis.js";

const proposal = "Our organization requests $500,000 to expand a documented regional learning program. The team will serve 2,000 students and publish outcome data each quarter.";
const strategy = "The foundation supports documented regional learning programs. Applicants must describe measurable outcomes, delivery responsibility, financial controls, and a plan for continuation after the grant.";
const modelReview = {
  sourceQuality: { status: "ANALYZABLE", explanation: "The request, delivery plan, and outcome commitment are reviewable." },
  summaryClaim: "The applicant requests support for a regional learning program.",
  claims: [{ claim: "The organization requests $500,000.", proposalQuote: "Our organization requests $500,000 to expand a documented regional learning program.", category: "grant_request", value: 500000, unit: "usd" }],
  strategyFindings: [{ status: "aligned", finding: "The program area aligns.", criterionQuote: "The foundation supports documented regional learning programs.", proposalQuote: "Our organization requests $500,000 to expand a documented regional learning program.", diligenceQuestion: "What evidence supports the proposed delivery scale?" }],
  eligibilityBucket: "ELIGIBILITY UNCERTAIN",
  recommendation: "HOLD FOR DILIGENCE",
  recommendationReason: "Current financial records are required.",
  boardLine: "The program aligns with the stated area, while current financial evidence remains necessary before full diligence.",
  reviewRoute: { route: "FULL DILIGENCE", why: "The program area aligns.", sources: [{ sourceType: "proposal", sourceQuote: "Our organization requests $500,000 to expand a documented regional learning program." }] },
  nextActions: [{ question: "Request current financial records.", basis: "The proposal states a material request.", source: { sourceType: "proposal", sourceQuote: "Our organization requests $500,000 to expand a documented regional learning program." } }, { question: "Confirm outcome measures.", basis: "The criterion requires measurable outcomes.", source: { sourceType: "foundation_criterion", sourceQuote: "Applicants must describe measurable outcomes" } }],
};

test("990-N follows a full review path with small-filer questions", async () => {
  const filingRecord = { ein: "12-3456789", organization: { name: "FICTIONAL SMALL FILER" }, latestFiling: null, filings: [], filingsWithoutData: [{ tax_prd: 2024, formtype: "990N" }], filingLagYears: null, sourceUrl: "https://example.test" };
  const result = await generateGrantReview({ applicantName: "Fictional Small Filer", ein: "12-3456789", filingContext: "990_n", proposal, foundationStrategy: strategy, askToRevenueThreshold: 0.25 }, {
    fetchIrs: async () => filingRecord,
    runProvider: async () => ({ attempts: 1, result: modelReview }),
  });
  assert.equal(result.recommendation, "HOLD FOR DILIGENCE");
  assert.equal(result.filingReviewProfile, "990_n");
  assert.match(result.financialSignals[0].question, /current budget/i);
});

test("no-return path still performs strategy review and names substitute documents", async () => {
  const emptyRecord = { ein: "12-3456789", organization: null, latestFiling: null, filings: [], filingsWithoutData: [], filingLagYears: null, sourceUrl: "https://example.test" };
  const result = await generateGrantReview({ applicantName: "Fictional New Organization", ein: "12-3456789", filingContext: "standalone", proposal, foundationStrategy: strategy, askToRevenueThreshold: 0.25 }, {
    fetchIrs: async () => emptyRecord,
    runProvider: async () => ({ attempts: 1, result: modelReview }),
  });
  assert.equal(result.recommendation, "HOLD FOR DILIGENCE");
  assert.equal(result.strategyFindings.length, 1);
  assert.match(result.financialSignals[0].question, /formation documents/i);
});

test("ask-to-revenue comparison prints the foundation-set threshold", () => {
  const record = { latestFiling: { tax_prd: 202412, tax_prd_yr: 2024, totrevenue: 1000000 }, filings: [], organization: {}, filingLagYears: 2 };
  const checks = compareClaimsToFiling(modelReview.claims, record, { askToRevenueThreshold: 0.3 });
  assert.equal(checks[0].threshold.fired, true);
  assert.equal(checks[0].threshold.value, 0.3);
  assert.match(checks[0].question, /30% review threshold/);
});
