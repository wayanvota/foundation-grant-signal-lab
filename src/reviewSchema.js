import { z } from "zod";

export const recommendationValues = [
  "ADVANCE",
  "HOLD FOR DILIGENCE",
  "DECLINE",
  "NEEDS HUMAN CHECK",
];

export const reviewInputSchema = z.object({
  applicantName: z.string().trim().min(2).max(240),
  ein: z.string().trim().regex(/^\d{2}-?\d{7}$/, "Enter a valid nine-digit EIN."),
  proposal: z.string().trim().min(80).max(40_000),
  foundationStrategy: z.string().trim().min(80).max(30_000),
  filingContext: z.enum(["standalone", "fiscal_sponsor", "group_return", "990_n"]).default("standalone"),
  fiscalSponsorName: z.string().trim().max(240).optional().default(""),
}).superRefine((value, context) => {
  if (value.filingContext === "fiscal_sponsor" && value.fiscalSponsorName.length < 2) {
    context.addIssue({
      code: "custom",
      path: ["fiscalSponsorName"],
      message: "Name the fiscal sponsor so the human-check reason is reviewable.",
    });
  }
});

const sourceSchema = z.object({
  sourceType: z.enum(["proposal", "foundation_criterion"]),
  sourceQuote: z.string().min(1),
}).strict();

const claimSchema = z.object({
  claim: z.string().min(1),
  proposalQuote: z.string().min(1),
  category: z.enum([
    "annual_budget",
    "staff_size",
    "program_scale",
    "years_of_operation",
    "geographic_reach",
    "outcomes",
    "organizational_capacity",
    "other",
  ]),
  value: z.number().nullable(),
  unit: z.enum(["usd", "people", "years", "sites", "percent", "other", "none"]),
}).strict();

const strategyFindingSchema = z.object({
  status: z.enum(["aligned", "departure", "unclear"]),
  finding: z.string().min(1),
  criterionQuote: z.string().min(1),
  proposalQuote: z.string(),
  diligenceQuestion: z.string().min(1),
}).strict();

const actionSchema = z.object({
  question: z.string().min(1),
  basis: z.string().min(1),
  source: sourceSchema,
}).strict();

export const modelReviewSchema = z.object({
  summaryClaim: z.string().min(10),
  claims: z.array(claimSchema).min(1).max(12),
  strategyFindings: z.array(strategyFindingSchema).min(1).max(12),
  eligibilityBucket: z.enum([
    "MEETS STATED CRITERIA",
    "ELIGIBILITY UNCERTAIN",
    "OUTSIDE STATED SCOPE",
  ]),
  recommendation: z.enum(["ADVANCE", "HOLD FOR DILIGENCE", "DECLINE"]),
  recommendationReason: z.string().min(1),
  boardLine: z.string().min(20),
  reviewRoute: z.object({
    route: z.enum(["FULL DILIGENCE", "ELIGIBILITY CHECK", "SPECIALIST REVIEW"]),
    why: z.string().min(1),
    sources: z.array(sourceSchema).min(1).max(4),
  }).strict(),
  nextActions: z.array(actionSchema).min(2).max(8),
}).strict();

export const modelReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summaryClaim",
    "claims",
    "strategyFindings",
    "eligibilityBucket",
    "recommendation",
    "recommendationReason",
    "boardLine",
    "reviewRoute",
    "nextActions",
  ],
  properties: {
    summaryClaim: { type: "string" },
    claims: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "proposalQuote", "category", "value", "unit"],
        properties: {
          claim: { type: "string" },
          proposalQuote: { type: "string" },
          category: {
            type: "string",
            enum: ["annual_budget", "staff_size", "program_scale", "years_of_operation", "geographic_reach", "outcomes", "organizational_capacity", "other"],
          },
          value: { type: ["number", "null"] },
          unit: { type: "string", enum: ["usd", "people", "years", "sites", "percent", "other", "none"] },
        },
      },
    },
    strategyFindings: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["status", "finding", "criterionQuote", "proposalQuote", "diligenceQuestion"],
        properties: {
          status: { type: "string", enum: ["aligned", "departure", "unclear"] },
          finding: { type: "string" },
          criterionQuote: { type: "string" },
          proposalQuote: { type: "string" },
          diligenceQuestion: { type: "string" },
        },
      },
    },
    eligibilityBucket: { type: "string", enum: ["MEETS STATED CRITERIA", "ELIGIBILITY UNCERTAIN", "OUTSIDE STATED SCOPE"] },
    recommendation: { type: "string", enum: ["ADVANCE", "HOLD FOR DILIGENCE", "DECLINE"] },
    recommendationReason: { type: "string" },
    boardLine: { type: "string" },
    reviewRoute: {
      type: "object",
      additionalProperties: false,
      required: ["route", "why", "sources"],
      properties: {
        route: { type: "string", enum: ["FULL DILIGENCE", "ELIGIBILITY CHECK", "SPECIALIST REVIEW"] },
        why: { type: "string" },
        sources: { type: "array", minItems: 1, maxItems: 4, items: sourceJsonSchema() },
      },
    },
    nextActions: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "basis", "source"],
        properties: {
          question: { type: "string" },
          basis: { type: "string" },
          source: sourceJsonSchema(),
        },
      },
    },
  },
};

export function assertTraceability(review, { proposal, foundationStrategy }) {
  const proposalText = normalizeForTrace(proposal);
  const strategyText = normalizeForTrace(foundationStrategy);
  const failures = [];

  for (const [index, claim] of review.claims.entries()) {
    if (!proposalText.includes(normalizeForTrace(claim.proposalQuote))) {
      failures.push(`claims[${index}].proposalQuote is not present in the proposal`);
    }
  }

  for (const [index, finding] of review.strategyFindings.entries()) {
    if (!strategyText.includes(normalizeForTrace(finding.criterionQuote))) {
      failures.push(`strategyFindings[${index}].criterionQuote is not present in foundation strategy`);
    }
    if (finding.proposalQuote && !proposalText.includes(normalizeForTrace(finding.proposalQuote))) {
      failures.push(`strategyFindings[${index}].proposalQuote is not present in the proposal`);
    }
  }

  for (const [index, source] of review.reviewRoute.sources.entries()) {
    if (!sourceExists(source, proposalText, strategyText)) {
      failures.push(`reviewRoute.sources[${index}] quote is not present in its named source`);
    }
  }

  for (const [index, action] of review.nextActions.entries()) {
    if (!sourceExists(action.source, proposalText, strategyText)) {
      failures.push(`nextActions[${index}].source quote is not present in its named source`);
    }
  }

  if (failures.length) {
    const error = new Error(`Traceability validation failed: ${failures.join("; ")}`);
    error.code = "SCHEMA_VALIDATION_FAILED";
    error.validationDetail = failures.join("; ");
    throw error;
  }
  return review;
}

function sourceExists(source, proposal, strategy) {
  const haystack = source.sourceType === "proposal" ? proposal : strategy;
  return haystack.includes(normalizeForTrace(source.sourceQuote));
}

function normalizeForTrace(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function sourceJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["sourceType", "sourceQuote"],
    properties: {
      sourceType: { type: "string", enum: ["proposal", "foundation_criterion"] },
      sourceQuote: { type: "string" },
    },
  };
}
