import { reviewInputSchema } from "../src/reviewSchema.js";
import { inspectAndStripInjection, containsInjection } from "../src/inputSafeguards.js";
import { fetchIrs990, assessFilingUsability, FILING_REVIEW_STATES } from "../src/irs990.js";
import { compareClaimsToFiling, calculateFinancialSignals } from "../src/filingAnalysis.js";
import { runValidatedReview } from "../src/provider.js";
import { assessApplicantIdentity, assessProposalQuality } from "../src/inputQuality.js";

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
    return generateFilingThinMemo({ input: safeguarded.values, safeguard: safeguarded, assessment: knownAssessment, fetchIrs, runProvider });
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
    if (filingAssessment.state === FILING_REVIEW_STATES.NO_FILED_RETURN) {
      return generateFilingThinMemo({ input: safeguarded.values, safeguard: safeguarded, assessment: filingAssessment, irsRecord, fetchIrs, runProvider });
    }
    return terminalMemo({
      input: safeguarded.values,
      irsRecord,
      reasonCode: filingAssessment.state,
      explanation: filingAssessment.reason,
      safeguard: safeguarded,
    });
  }

  const identityAssessment = assessApplicantIdentity(
    safeguarded.values.applicantName,
    irsRecord.organization?.name,
  );
  if (!identityAssessment.ready) {
    return terminalMemo({
      input: safeguarded.values,
      irsRecord,
      reasonCode: "applicant_identity_mismatch",
      explanation: identityAssessment.reason,
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
  if (modelReview.sourceQuality?.status === "INSUFFICIENT") {
    return terminalMemo({
      input: safeguarded.values,
      irsRecord,
      reasonCode: "insufficient_decision_content",
      explanation: modelReview.sourceQuality.explanation,
      safeguard: safeguarded,
      providerAttempts: providerResponse.attempts,
    });
  }
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
    claimChecks: compareClaimsToFiling(modelReview.claims, irsRecord, { askToRevenueThreshold: safeguarded.values.askToRevenueThreshold }),
    financialSignals: calculateFinancialSignals(irsRecord),
    strategyFindings: modelReview.strategyFindings,
    eligibilityBucket: modelReview.eligibilityBucket,
    reviewRoute: modelReview.reviewRoute,
    nextActions: appendFilingActions(modelReview.nextActions, irsRecord),
    humanReviewBoundary: humanCheckBoundary(),
    safeguard: safeguardSummary(safeguarded, providerResponse.attempts),
    sourceQuality: modelReview.sourceQuality,
    askToRevenueThreshold: { value: safeguarded.values.askToRevenueThreshold, setBy: "foundation input" },
  };

  if (safeguarded.strippedSpans.length) {
    memo.recommendation = "NEEDS HUMAN CHECK";
    memo.recommendationReason = "Embedded model-control text was removed before analysis. The memo completed on the remaining content, but a person must inspect the removed span before relying on the recommendation.";
    memo.boardLine = "The filing and strategy review completed after embedded model-control text was removed, so staff must inspect that text before deciding whether this proposal advances.";
  }

  return memo;
}

async function generateFilingThinMemo({ input, safeguard, assessment, irsRecord = null, fetchIrs, runProvider }) {
  let record = irsRecord;
  if (["fiscal_sponsor", "group_return", "990_n"].includes(input.filingContext)) {
    try { record = await fetchIrs(input.ein); } catch { record = null; }
  }
  if (input.filingContext === "fiscal_sponsor" && record?.organization?.name) {
    const identity = assessApplicantIdentity(input.fiscalSponsorName, record.organization.name);
    if (!identity.ready) {
      return terminalMemo({
        input,
        irsRecord: record,
        reasonCode: "sponsor_identity_mismatch",
        explanation: `The sponsor name and filing name do not match closely enough for reliable use. ${identity.reason}`,
        safeguard,
      });
    }
  }
  if (input.filingContext === "990_n" && record?.organization?.name) {
    const identity = assessApplicantIdentity(input.applicantName, record.organization.name);
    if (!identity.ready) return terminalMemo({ input, irsRecord: record, reasonCode: "applicant_identity_mismatch", explanation: identity.reason, safeguard });
  }

  const providerResponse = await runProvider({
    input,
    filingSummary: {
      ...publicFilingSummary(record || { latestFiling: null, sourceUrl: "" }),
      reviewProfile: input.filingContext,
      filingLimitation: assessment.reason,
    },
  });
  if (providerResponse.result?.state === "NEEDS HUMAN CHECK") {
    return terminalMemo({ input, irsRecord: record, reasonCode: providerResponse.result.reasonCode, explanation: providerResponse.result.explanation, safeguard, providerAttempts: providerResponse.attempts });
  }
  const modelReview = providerResponse.result;
  if (modelReview.sourceQuality?.status === "INSUFFICIENT") {
    return terminalMemo({ input, irsRecord: record, reasonCode: "insufficient_decision_content", explanation: modelReview.sourceQuality.explanation, safeguard, providerAttempts: providerResponse.attempts });
  }

  const profile = filingThinProfile(input.filingContext, input.fiscalSponsorName);
  const memo = {
    recommendation: modelReview.recommendation,
    recommendationReason: `${modelReview.recommendationReason} ${profile.memoNote}`,
    boardLine: modelReview.boardLine,
    summaryClaim: modelReview.summaryClaim,
    applicant: { legalName: input.applicantName, ein: record?.ein || input.ein, filingName: record?.organization?.name || null },
    filingSource: record ? publicFilingSummary(record) : null,
    claimChecks: modelReview.claims.map((claim) => ({
      claim: claim.claim,
      proposalQuote: claim.proposalQuote,
      category: claim.category,
      status: "not_checkable",
      filingLine: null,
      filingValue: null,
      taxYear: record?.latestFiling?.tax_prd_yr || null,
      filingLagYears: record?.filingLagYears ?? null,
      question: profile.claimQuestion,
    })),
    financialSignals: [{ signal: profile.signal, taxYear: record?.latestFiling?.tax_prd_yr || null, inputs: [], status: "path_specific", question: profile.financialQuestion }],
    strategyFindings: modelReview.strategyFindings,
    eligibilityBucket: modelReview.eligibilityBucket,
    reviewRoute: modelReview.reviewRoute,
    nextActions: [...profile.actions, ...modelReview.nextActions],
    humanReviewBoundary: humanCheckBoundary(),
    safeguard: safeguardSummary(safeguard, providerResponse.attempts),
    sourceQuality: modelReview.sourceQuality,
    filingReviewProfile: input.filingContext,
    askToRevenueThreshold: { value: input.askToRevenueThreshold, setBy: "foundation input" },
  };
  if (safeguard.strippedSpans.length) {
    memo.recommendation = "NEEDS HUMAN CHECK";
    memo.recommendationReason = "Embedded model-control text was removed before analysis. Staff must inspect the removed span before relying on this memo.";
  }
  return memo;
}

function filingThinProfile(context, sponsorName) {
  if (context === "fiscal_sponsor") return {
    memoNote: `The filing describes ${sponsorName}, the fiscal sponsor, not the applicant project.`,
    signal: "Fiscal sponsor review path",
    claimQuestion: "What project-level record substantiates this claim, given that the sponsor filing does not isolate the project?",
    financialQuestion: "Obtain the fiscal sponsorship agreement, project-level budget, project-level staffing, and confirmation of whether the sponsor will hold the grant.",
    actions: pathActions(["Obtain the fiscal sponsorship agreement.", "Request a project-level budget and staffing schedule.", "Confirm whether the fiscal sponsor will receive and hold the grant."], "The sponsor filing does not isolate the project."),
  };
  if (context === "group_return") return {
    memoNote: "The filing describes the parent or group, not necessarily the applicant affiliate.",
    signal: "Group return review path",
    claimQuestion: "What affiliate-level record substantiates this claim, given that the group return does not isolate the affiliate?",
    financialQuestion: "Obtain affiliate-level financial statements, staffing, governance, and the allocation method used in the group return.",
    actions: pathActions(["Request affiliate-level financial statements.", "Confirm which parent-level figures apply to the affiliate."], "The group return cannot establish affiliate-level finances."),
  };
  if (context === "990_n") return {
    memoNote: "Form 990-N establishes filing status and a gross-receipts ceiling, but provides no detailed financial lines.",
    signal: "Form 990-N review path",
    claimQuestion: "What internal record substantiates this claim, given that Form 990-N contains no detailed financial lines?",
    financialQuestion: "Request the small filer's current budget, year-to-date statement, bank balance, staffing record, and board-approved controls appropriate to its size.",
    actions: pathActions(["Request a current budget and year-to-date financial statement.", "Confirm the records used to support the proposal's scale claims."], "Form 990-N provides no detailed financial lines."),
  };
  return {
    memoNote: "No comparable filed return is available, so the strategy review proceeds with substitute documents named explicitly.",
    signal: "No-return or early-stage review path",
    claimQuestion: "What current organizational record substantiates this claim without a comparable filed return?",
    financialQuestion: "Request formation documents, current and prior budgets, year-to-date statements, bank records, payroll or contractor records, governance records, and any fiscal-sponsorship agreement.",
    actions: pathActions(["Request formation and governance documents.", "Request current and prior budgets plus year-to-date financial statements.", "Request staffing or contractor records supporting delivery capacity."], "A filed return is unavailable or not yet comparable."),
  };
}

function pathActions(questions, basis) {
  return questions.map((question) => ({ question, basis, source: null }));
}

export function prepareInputs(input) {
  const inspectionTargets = [
    ["applicantName", input.applicantName, 2],
    ["proposal", input.proposal, 80],
    ["foundationStrategy", input.foundationStrategy, 80],
  ];
  if (input.fiscalSponsorName) inspectionTargets.push(["fiscalSponsorName", input.fiscalSponsorName, 2]);

  const inspected = inspectionTargets.map(([source, text, minimum]) => ({
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

  const qualityAssessment = assessProposalQuality(values.proposal);
  if (!qualityAssessment.ready) {
    return {
      values,
      strippedSpans,
      operationLog,
      terminalResult: terminalMemo({
        input: values,
        reasonCode: "insufficient_decision_content",
        explanation: qualityAssessment.reason,
        safeguard: { strippedSpans, operationLog },
      }),
    };
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
  if (reasonCode === "applicant_identity_mismatch") return "Confirm the applicant's exact legal name and EIN before relying on the returned filing.";
  if (reasonCode === "sponsor_identity_mismatch") return "Confirm the fiscal sponsor's exact legal name and EIN before relying on the returned filing.";
  if (reasonCode === "insufficient_decision_content") return "Replace placeholder or incoherent text with the decision-relevant proposal narrative before running another review.";
  return "Review the source material manually and document why automated review could not be relied upon.";
}

function lowercaseFirst(value) {
  const text = String(value || "the evidence could not be checked.").trim();
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
