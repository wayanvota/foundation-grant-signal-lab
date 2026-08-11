import test from "node:test";
import assert from "node:assert/strict";
import { runValidatedReview } from "../src/provider.js";

const proposalQuote = "Our annual operating budget is $5 million.";
const criterionQuote = "We support evidence-based regional learning programs.";
const input = {
  applicantName: "Fictional Regional Learning Network",
  proposal: `${proposalQuote} We serve 6,000 students through regional tutoring programs.`,
  foundationStrategy: `${criterionQuote} Requests above $300,000 require a two-year sustainability plan.`,
};

test("schema failure retries once on the same provider request path", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  let calls = 0;
  const result = await runValidatedReview({
    input,
    filingSummary: { taxYear: 2024, filingLagYears: 2 },
    fetchImpl: async (url) => {
      calls += 1;
      assert.equal(url, "https://api.openai.com/v1/responses");
      return response(calls === 1 ? {} : validReview());
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.result.recommendation, "HOLD FOR DILIGENCE");
});

test("a second schema failure becomes a soft terminal state", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  let calls = 0;
  const result = await runValidatedReview({
    input,
    filingSummary: { taxYear: 2024, filingLagYears: 2 },
    fetchImpl: async () => { calls += 1; return response({}); },
  });
  assert.equal(calls, 2);
  assert.equal(result.result.state, "NEEDS HUMAN CHECK");
  assert.equal(result.result.reasonCode, "schema_failed_after_retry");
});

function response(payload) {
  return { ok: true, async json() { return { output_text: JSON.stringify(payload) }; } };
}

function validReview() {
  return {
    sourceQuality: { status: "ANALYZABLE", explanation: "The proposal contains a reviewable request, budget, program scale, and delivery context." },
    summaryClaim: "The applicant seeks support for regional tutoring.",
    claims: [{ claim: "Annual budget is $5 million.", proposalQuote, category: "annual_budget", value: 5_000_000, unit: "usd" }],
    strategyFindings: [{ status: "aligned", finding: "The program area aligns.", criterionQuote, proposalQuote, diligenceQuestion: "What outcome evidence supports the planned expansion?" }],
    eligibilityBucket: "ELIGIBILITY UNCERTAIN",
    recommendation: "HOLD FOR DILIGENCE",
    recommendationReason: "Required evidence is incomplete.",
    boardLine: "The proposal aligns with the stated program area, but current evidence requires additional diligence.",
    reviewRoute: { route: "FULL DILIGENCE", why: "The stated program area aligns.", sources: [{ sourceType: "foundation_criterion", sourceQuote: criterionQuote }] },
    nextActions: [
      { question: "Request current financials.", basis: "The budget claim requires a current source.", source: { sourceType: "proposal", sourceQuote: proposalQuote } },
      { question: "Request a sustainability plan.", basis: "The criterion requires one.", source: { sourceType: "foundation_criterion", sourceQuote: "Requests above $300,000 require a two-year sustainability plan." } },
    ],
  };
}
