import { reviewInputSchema } from "../src/reviewSchema.js";
import { inspectAndStripInjection, containsInjection } from "../src/inputSafeguards.js";
import { fetchIrs990, assessFilingUsability, FILING_REVIEW_STATES } from "../src/irs990.js";
import { compareClaimsToFiling, calculateFinancialSignals } from "../src/filingAnalysis.js";
import { runValidatedReview } from "../src/provider.js";

export { reviewInputSchema };

export async function generateGrantReview(input, {
  fetchIrs = fetchIrs990,
  runProvider = runValidatedReview,
} = {}) {
  const parsedInput = reviewInputSchema.parse(input);
  const safeguarded = prepareInputs(parsedInput);
  if (safeguarded.terminalResult) return safeguarded.terminalResult;

  if (safeguarded.values.filingContext !== "standalone") {
    const knownAssessment = assessFilingUsability(null, safeguarded.values);
    return terminalMemo({
      input: safeguarded.values,
      reasonCode: knownAssessment.state,
      explanation: knownAssessment.reason,
      safeguard: safeguarded,
    });
  }

  let irsRecord;
  try {
    irsRecord = await fetchIrs(safeguarded.values.ein);
  } catch {
    return terminalMemo({
      input: safeguarded.values,
      reasonCode: "filing_lookup_failed",
      explanation: "The public filing service could not be checked during this review.",
      safeguard: safeguarded,
    });
  }
  const filingAssessment = assessFilingUsability(irsRecord, safeguarded.values);
  if (filingAssessment.state !== FILING_REVIEW_STATES.READY) {
    return terminalMemo({
      input: safeguarded.values,
      irsRecord,
      reasonCode: filingAssessment.state,
      explanation: filingAssessment.reason,
      safeguard: safeguarded,
    });
  }

  const providerResponse = await runProvider({
    input: safeguarded.values,
    filingSummary: publicFilingSummary(irsRecord),
  });

  if (providerResponse.result?.state === "NEEDS HUMAN CHECK") {
    return terminalMemo({
      input: safeguarded.values,
      irsRecord,
      reasonCode: providerResponse.result.reasonCode,
      explanation: providerResponse.result.explanation,
      safeguard: safeguarded,
      providerAttempts: providerResponse.attempts,
    });
  }

  const modelReview = providerResponse.result;
  const memo = {
    recommendation: modelReview.recommendation,
    recommendationReason: modelReview.recommendationReason,
    boardLine: modelReview.boardLine,
    summaryClaim: modelReview.summaryClaim,
    applicant: {
      legalName: safeguarded.values.applicantName,
      ein: irsRecord.ein,
      filingName: irsRecord.organization?.name || null,
    },
    filingSource: publicFilingSummary(irsRecord),
    claimChecks: compareClaimsToFiling(modelReview.claims, irsRecord),
    financialSignals: calculateFinancialSignals(irsRecord),
    strategyFindings: modelReview.strategyFindings,
    eligibilityBucket: modelReview.eligibilityBucket,
    reviewRoute: modelReview.reviewRoute,
    nextActions: appendFilingActions(modelReview.nextActions, irsRecord),
    humanReviewBoundary: humanCheckBoundary(),
    safeguard: safeguardSummary(safeguarded, providerResponse.attempts),
  };

  if (safeguarded.strippedSpans.length) {
    memo.recommendation = "NEEDS HUMAN CHECK";
    memo.recommendationReason = "Embedded model-control text was removed before analysis. The memo completed on the remaining content, but a person must inspect the removed span before relying on the recommendation.";
    memo.boardLine = "The filing and strategy review completed after embedded model-control text was removed, so staff must inspect that text before deciding whether this proposal advances.";
  }

  return memo;
}

export function prepareInputs(input) {
  const inspected = [
    ["proposal", input.proposal, 80],
    ["foundationStrategy", input.foundationStrategy, 80],
  ].map(([source, text, minimum]) => ({
    source,
    minimum,
    ...inspectAndStripInjection(text, { source }),
  }));

  const values = { ...input };
  const strippedSpans = [];
  const operationLog = [];
  for (const item of inspected) {
    values[item.source] = item.text;
    strippedSpans.push(...item.strippedSpans);
    operationLog.push(...item.operationLog);
    if (item.text.trim().length < item.minimum) {
      return {
        values,
        strippedSpans,
        operationLog,
        terminalResult: terminalMemo({
          input: values,
          reasonCode: "insufficient_content_after_strip",
          explanation: "Removing embedded model-control text left too little reliable content for a review.",
          safeguard: { strippedSpans, operationLog },
        }),
      };
    }
    if (item.strippedSpans.length && containsInjection(item.text)) {
      return {
        values,
        strippedSpans,
        operationLog,
        terminalResult: terminalMemo({
          input: values,
          reasonCode: "validation_failed_after_strip",
          explanation: "Model-control text remained after the single permitted strip-and-revalidate pass.",
          safeguard: { strippedSpans, operationLog },
        }),
      };
    }
  }

  return { values, strippedSpans, operationLog };
}

export function terminalMemo({ input, irsRecord = null, reasonCode, explanation, safeguard = {}, providerAttempts = 0 }) {
  return {
    recommendation: "NEEDS HUMAN CHECK",
    recommendationReason: explanation,
    boardLine: `Automated diligence stopped because ${lowercaseFirst(explanation)} Staff must resolve this condition before the proposal advances.`,
    summaryClaim: null,
    applicant: {
      legalName: input?.applicantName || null,
      ein: irsRecord?.ein || input?.ein || null,
      filingName: irsRecord?.organization?.name || null,
    },
    filingSource: irsRecord ? publicFilingSummary(irsRecord) : null,
    claimChecks: [],
    financialSignals: [],
    strategyFindings: [],
    eligibilityBucket: "ELIGIBILITY UNCERTAIN",
    reviewRoute: {
      route: "ELIGIBILITY CHECK",
      why: explanation,
      sources: [],
    },
    nextActions: [{
      question: humanCheckAction(reasonCode, input),
      basis: explanation,
      source: null,
    }],
    humanReviewBoundary: humanCheckBoundary(),
    terminalReason: { code: reasonCode, explanation },
    safeguard: safeguardSummary(safeguard, providerAttempts),
  };
}

function publicFilingSummary(record) {
  const filing = record.latestFiling;
  return filing ? {
    provider: "ProPublica Nonprofit Explorer",
    sourceUrl: record.sourceUrl,
    taxYear: Number(filing.tax_prd_yr || String(filing.tax_prd).slice(0, 4)),
    taxPeriod: String(filing.tax_prd),
    formType: filing.formtype,
    filingLagYears: record.filingLagYears,
    pdfUrl: filing.pdf_url || null,
  } : {
    provider: "ProPublica Nonprofit Explorer",
    sourceUrl: record.sourceUrl,
    taxYear: null,
    taxPeriod: null,
    formType: null,
    filingLagYears: null,
    pdfUrl: null,
  };
}

function appendFilingActions(actions, irsRecord) {
  return [
    ...actions,
    {
      question: `What changed between the ${irsRecord.latestFiling.tax_prd_yr} filing period and the proposal's current operating picture?`,
      basis: `The public filing is ${irsRecord.filingLagYears} year${irsRecord.filingLagYears === 1 ? "" : "s"} behind the current year, so divergence may be legitimate.`,
      source: {
        sourceType: "filing",
        sourceQuote: `Tax period ${irsRecord.latestFiling.tax_prd}`,
      },
    },
  ];
}

function safeguardSummary(safeguard, providerAttempts) {
  return {
    status: safeguard.strippedSpans?.length ? "human_check_required" : "passed",
    strippedSpanCount: safeguard.strippedSpans?.length || 0,
    strippedSpans: (safeguard.strippedSpans || []).map(({ source, start, end }) => ({ source, start, end })),
    operationLog: safeguard.operationLog || [],
    providerAttempts,
  };
}

function humanCheckBoundary() {
  return "This memo supports a program officer's first pass. It does not make a funding decision. Proposal-to-filing divergence is a diligence question, not a finding of fault. Staff must verify current facts, context, relationships, and any source gaps before acting.";
}

function humanCheckAction(reasonCode, input) {
  if (reasonCode === FILING_REVIEW_STATES.FISCAL_SPONSORSHIP) {
    return `Obtain the relevant financial evidence from ${input.fiscalSponsorName} and confirm which figures belong to the applicant project.`;
  }
  if (reasonCode === FILING_REVIEW_STATES.SHORT_PERIOD) return "Obtain a full 12-month financial period before calculating operating ratios.";
  if (reasonCode === FILING_REVIEW_STATES.GROUP_RETURN) return "Obtain affiliate-level financial statements and confirm which group-return figures apply to this applicant.";
  if (reasonCode === FILING_REVIEW_STATES.LIMITED_990_N) return "Request current financial statements because Form 990-N provides no financial detail.";
  if (reasonCode === FILING_REVIEW_STATES.NO_FILED_RETURN) return "Confirm the applicant's filing status and obtain the latest reviewable financial statements.";
  if (reasonCode === "filing_lookup_failed") return "Retry the public filing lookup or review the applicant's latest return directly before proceeding.";
  return "Review the source material manually and document why automated review could not be relied upon.";
}

function lowercaseFirst(value) {
  const text = String(value || "the evidence could not be checked.").trim();
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
