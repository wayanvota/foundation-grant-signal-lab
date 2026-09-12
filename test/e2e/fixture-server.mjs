import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const port = Number(process.env.PORT || 4188);
process.env.NODE_ENV = "test";
process.env.FRONTEND_ORIGIN = `http://127.0.0.1:${port}`;
process.env.REVIEW_RATE_LIMIT_MAX = "40";
process.env.REVIEW_RATE_LIMIT_WINDOW_MS = "600000";

const [{ createApp }, { generateCallDesign }] = await Promise.all([
  import("../../api/server.js"),
  import("../../api/callDesign.js"),
]);

const compiledRule = {
  version: "1.0",
  name: "Fictional North Carolina E2E call",
  clauses: [
    {
      id: "C001", sourceSentence: "Applicants must operate in North Carolina.",
      fact: "geography", operator: "contains_any", value: ["North Carolina"], mandatory: true,
      reasonCode: "GEO_INELIGIBLE", selfScreenQuestion: "Does your organization operate in North Carolina?",
    },
    {
      id: "C002", sourceSentence: "Applicants must have operated for at least two years.",
      fact: "years_operating", operator: "gte", value: 2, mandatory: true,
      reasonCode: "OPERATING_HISTORY_SHORT", selfScreenQuestion: "Has your organization operated for at least two years?",
    },
  ],
  uncompiledLanguage: [{
    sourceSentence: "We prioritize community-rooted organizations.",
    reason: "Community-rootedness requires human judgment and is not a literal applicant fact.",
    suggestion: "Name a factual governance or service-area test if that is required.",
  }],
};

async function generateDesign(input) {
  return generateCallDesign(input, {
    compileRule: async () => ({
      ruleSpec: compiledRule,
      safeguard: { status: "passed", strippedSpanCount: 0 },
    }),
  });
}

function memoFixture(input) {
  const injected = /ignore (?:all )?(?:previous|prior) instructions/i.test(input.proposal || "");
  if (injected) {
    return {
      recommendation: "NEEDS HUMAN CHECK",
      recommendationReason: "Embedded model-control language was removed and requires source inspection.",
      boardLine: "Human review is required before the proposal can advance.",
      filingSource: { taxYear: 2024, filingLagYears: 2, sourceUrl: "", provider: "Synthetic filing" },
      humanReviewBoundary: "No award decision was made.",
      askToRevenueThreshold: { value: 0.25, setBy: "foundation input" },
      claimChecks: [], financialSignals: [], strategyFindings: [],
      reviewRoute: { route: "HUMAN REVIEW", why: "Source safeguard triggered.", sources: [] },
      nextActions: [],
      safeguard: { status: "human_check_required", strippedSpanCount: 1 },
    };
  }
  return {
    recommendation: "HOLD FOR DILIGENCE",
    recommendationReason: "The proposal fits the stated priority, but its baseline needs verification.",
    boardLine: `${input.applicantName} presents a plausible case with one material evidence gap.`,
    filingSource: { taxYear: 2024, filingLagYears: 2, sourceUrl: "https://example.org/filing", provider: "Synthetic filing" },
    humanReviewBoundary: "This is a diligence recommendation, not an award decision.",
    askToRevenueThreshold: { value: Number(input.askToRevenueThreshold || 0.25), setBy: "foundation input" },
    claimChecks: [{
      status: "not_checkable", claim: "The pilot will improve access.",
      proposalQuote: "The pilot will improve access for rural families.", filingLine: null,
      filingValue: null, taxYear: 2024, filingLagYears: 2,
      question: "What current baseline would make this outcome testable?",
    }],
    financialSignals: [{
      signal: "Ask-to-revenue review", taxYear: 2024,
      inputs: [{ filingLine: "Total revenue", value: 2_000_000 }],
      question: "Does the request fit current delivery capacity?",
    }],
    strategyFindings: [{
      status: "aligned", finding: "The proposed work addresses the stated program area.",
      criterionQuote: "The foundation supports measurable rural access programs.",
      proposalQuote: "The pilot will improve access for rural families.",
      diligenceQuestion: "Which measure will establish change from baseline?",
    }],
    reviewRoute: {
      route: "EVIDENCE CHECK", why: "One material baseline remains unresolved.",
      sources: [{ sourceType: "foundation_criterion", sourceQuote: "Applicants must document measurable outcomes." }],
    },
    nextActions: [{
      question: "Request a dated outcome baseline.", basis: "The result claim lacks a starting measure.",
      source: { sourceType: "proposal", sourceQuote: "The pilot will improve access for rural families." },
    }],
    safeguard: { status: "passed", strippedSpanCount: 0 },
  };
}

const api = createApp({ generateReview: async (input) => memoFixture(input), generateDesign });
const app = express();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

app.use((request, response, next) => {
  if (request.path === "/health" || request.path.startsWith("/api/")) return api(request, response, next);
  return next();
});
app.get("/config.js", (_request, response) => response.type("application/javascript").send(
  `window.GRANT_SIGNAL_CONFIG = { apiBaseUrl: "http://127.0.0.1:${port}" };`,
));
app.use(express.static(path.join(root, "frontend"), { index: "index.html" }));
app.use((_request, response) => response.status(404).json({ error: "Not found" }));

app.listen(port, "127.0.0.1", () => console.log(`Foundation Grant Signal Lab E2E fixture listening on ${port}`));
