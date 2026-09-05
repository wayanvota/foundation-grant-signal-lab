import { z } from "zod";
import { artifactMetadata, computeRuleHash, inspectArtifactVersion, migrationNotice, RESERVED_FIELDS, SCHEMA_VERSION } from "./artifacts.js";
import { CUSTOM_REASON_CODE_PATTERN, isReasonCode, REASON_CODES } from "./reasonCodes.js";

export { REASON_CODES } from "./reasonCodes.js";
const MISSING_FACT_REASON_CODE = REASON_CODES[REASON_CODES.length - 1];

export const FACT_FIELDS = Object.freeze([
  "geography",
  "issue_area",
  "org_type",
  "annual_budget",
  "years_operating",
  "filing_relationship",
]);

export const ruleClauseSchema = z.object({
  id: z.string().regex(/^C\d{3}$/),
  sourceSentence: z.string().min(1).max(1200),
  fact: z.enum(FACT_FIELDS),
  operator: z.enum(["equals", "in", "not_in", "contains_any", "gte", "lte"]),
  value: z.union([z.string(), z.number(), z.array(z.string()).min(1).max(60)]),
  mandatory: z.boolean(),
  reasonCode: z.string().refine((value) => REASON_CODES.includes(value) || CUSTOM_REASON_CODE_PATTERN.test(value), "Reason code must be shipped or start with CUSTOM_."),
  selfScreenQuestion: z.string().min(1).max(500),
}).strict();

export const uncompiledLanguageSchema = z.object({
  sourceSentence: z.string().min(1).max(1200),
  reason: z.string().min(1).max(500),
  suggestion: z.string().min(1).max(500).default("If this matters to eligibility, replace it with a fact an applicant can answer and staff can verify."),
}).strict();

export const ruleSpecSchema = z.object({
  artifact: z.literal("rule_spec"),
  schema_version: z.string().regex(/^1\.(?:\d+)\.(?:\d+)$/),
  generated_at: z.string().datetime(),
  generator: z.literal("foundation-grant-signal-lab"),
  generator_version: z.string().min(1).max(80),
  rule_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  name: z.string().min(1).max(160),
  clauses: z.array(ruleClauseSchema).max(40),
  uncompiledLanguage: z.array(uncompiledLanguageSchema).max(40),
  custom_reason_codes: z.record(z.string(), z.string().min(1).max(500)).default({}),
  batch_id: z.null(),
  submission_id: z.null(),
  stage_timestamps: z.null(),
  referral_source: z.null(),
  self_screen_outcome: z.null(),
  final_disposition: z.null(),
}).passthrough().superRefine((spec, context) => {
  const ids = new Set();
  for (const [index, clause] of spec.clauses.entries()) {
    if (ids.has(clause.id)) context.addIssue({ code: "custom", path: ["clauses", index, "id"], message: "Clause IDs must be unique." });
    ids.add(clause.id);
    if (["gte", "lte"].includes(clause.operator) && typeof clause.value !== "number") {
      context.addIssue({ code: "custom", path: ["clauses", index, "value"], message: "Numeric operators require a numeric value." });
    }
    if (!isReasonCode(clause.reasonCode, spec.custom_reason_codes)) {
      context.addIssue({ code: "custom", path: ["clauses", index, "reasonCode"], message: "Custom reason codes must be defined in custom_reason_codes." });
    }
  }
  for (const code of Object.keys(spec.custom_reason_codes)) {
    if (!CUSTOM_REASON_CODE_PATTERN.test(code)) context.addIssue({ code: "custom", path: ["custom_reason_codes", code], message: "Custom reason codes must start with CUSTOM_." });
  }
  if (spec.rule_hash !== computeRuleHash(spec.clauses)) context.addIssue({ code: "custom", path: ["rule_hash"], message: "rule_hash does not match the compiled clauses." });
});

export const compiledRuleDraftSchema = z.object({
  version: z.literal("1.0").optional(),
  name: z.string().min(1).max(160),
  clauses: z.array(ruleClauseSchema).max(40),
  uncompiledLanguage: z.array(uncompiledLanguageSchema).max(40),
  custom_reason_codes: z.record(z.string(), z.string().min(1).max(500)).default({}),
}).strict();

export function finalizeRuleSpec(raw, options = {}) {
  const draft = compiledRuleDraftSchema.parse(raw);
  const spec = {
    ...artifactMetadata("rule_spec", options),
    rule_hash: computeRuleHash(draft.clauses),
    name: draft.name,
    clauses: draft.clauses,
    uncompiledLanguage: draft.uncompiledLanguage,
    custom_reason_codes: draft.custom_reason_codes,
    ...RESERVED_FIELDS,
  };
  return ruleSpecSchema.parse(spec);
}

export function loadRuleArtifact(input, options = {}) {
  const parsed = typeof input === "string" ? parseArtifactJson(input) : input;
  const outerVersion = inspectArtifactVersion(parsed);
  const contained = parsed.artifact === "session_bundle" || parsed.ruleSpec ? parsed.ruleSpec : parsed;
  if (!contained || typeof contained !== "object") throw artifactLoadError("The uploaded session bundle does not contain a RuleSpec.");
  const version = parsed.artifact === "session_bundle" || parsed.ruleSpec ? inspectArtifactVersion(contained) : outerVersion;
  if (!outerVersion.migrationRequired && !version.migrationRequired) return { ruleSpec: parseCurrentRuleSpec(contained), notice: null };
  const legacy = contained;
  try {
    return { ruleSpec: finalizeRuleSpec({
      name: legacy.name,
      clauses: legacy.clauses,
      uncompiledLanguage: legacy.uncompiledLanguage || [],
      custom_reason_codes: legacy.custom_reason_codes || {},
    }, options), notice: migrationNotice(version.found) };
  } catch {
    throw artifactLoadError("The older artifact could not be migrated safely. Its rule fields are incomplete or invalid.");
  }
}

const optionalText = (maximum) => z.preprocess((value) => value === null || value === undefined ? "" : value, z.string().trim().max(maximum));
const optionalNumber = z.preprocess((value) => value === null || value === "" ? undefined : value, z.coerce.number().nonnegative().optional());

export const applicantProfileSchema = z.object({
  organizationName: z.string().trim().min(1).max(240),
  ein: optionalText(20),
  filingRelationship: optionalText(120),
  annualBudget: optionalNumber,
  yearsOperating: optionalNumber,
  geography: optionalText(300),
  issueArea: optionalText(300),
  orgType: optionalText(160),
  description: optionalText(2000),
}).strict();

export const funnelInputSchema = z.object({
  grantSize: z.coerce.number().positive().default(250000),
  totalPool: z.coerce.number().positive().default(10000000),
  expectedApplications: z.coerce.number().int().nonnegative().default(200),
  minutesPerFirstRead: z.coerce.number().nonnegative().default(20),
  hoursPerApplication: z.coerce.number().nonnegative().default(8),
  loadedHourlyCost: z.coerce.number().nonnegative().default(65),
  applicantHoursPerApplication: z.coerce.number().nonnegative().default(24),
  applicantHourlyValue: z.coerce.number().nonnegative().default(35),
}).strict();

export function evaluateProfile(ruleSpec, profile) {
  const spec = normalizeRuleSpecInput(ruleSpec);
  return evaluateParsedProfile(spec, applicantProfileSchema.parse(profile));
}

function evaluateParsedProfile(spec, profile) {
  const facts = normalizeProfile(profile);
  const evaluations = [];

  for (const clause of spec.clauses) {
    const actual = facts[clause.fact];
    if (isMissing(actual)) {
      if (clause.mandatory) {
        return {
          status: "INDETERMINATE",
          decidingClauseId: clause.id,
          decidingClause: clause.sourceSentence,
          reasonCode: MISSING_FACT_REASON_CODE,
          missingFact: clause.fact,
          evaluations,
        };
      }
      evaluations.push({ clauseId: clause.id, result: "UNKNOWN", actual: null });
      continue;
    }

    const passed = applyOperator(actual, clause.operator, clause.value, clause.fact);
    evaluations.push({ clauseId: clause.id, result: passed ? "PASS" : "FAIL", actual });
    if (!passed && clause.mandatory) {
      return {
        status: "EXCLUDE",
        decidingClauseId: clause.id,
        decidingClause: clause.sourceSentence,
        reasonCode: clause.reasonCode,
        missingFact: null,
        evaluations,
      };
    }
  }

  return {
    status: "ADMIT",
    decidingClauseId: null,
    decidingClause: null,
    reasonCode: null,
    missingFact: null,
    evaluations,
  };
}

export function evaluateCandidateSet(ruleSpec, profiles) {
  const spec = normalizeRuleSpecInput(ruleSpec);
  const results = profiles.map((raw) => {
    const profile = applicantProfileSchema.parse(raw);
    return { profile, outcome: evaluateParsedProfile(spec, profile) };
  });
  return summarizeCandidateResults(spec, results);
}

export function summarizeCandidateResults(ruleSpec, results) {
  const spec = normalizeRuleSpecInput(ruleSpec);
  return {
    results,
    clauseSummary: summarizeClauses(spec, results),
    clauseFrequency: buildClauseFrequency(spec, results),
    impactReport: buildImpactReport(spec, results),
  };
}

export function generateSelfScreen(ruleSpec) {
  const spec = normalizeRuleSpecInput(ruleSpec);
  const questions = spec.clauses.filter((clause) => clause.mandatory).map((clause) => ({
    clauseId: clause.id,
    question: clause.selfScreenQuestion,
    fact: clause.fact,
    operator: clause.operator,
    value: clause.value,
  }));
  const plainText = questions.map((item, index) => `${index + 1}. ${item.question} [${item.clauseId}]`).join("\n");
  const html = `<ol>\n${questions.map((item) => `  <li data-clause-id="${escapeHtml(item.clauseId)}">${escapeHtml(item.question)}</li>`).join("\n")}\n</ol>`;
  return { rule_hash: spec.rule_hash, questions, plainText, html };
}

export function evaluateSelfScreen(ruleSpec, profile) {
  const spec = normalizeRuleSpecInput(ruleSpec);
  const facts = normalizeProfile(applicantProfileSchema.parse(profile));
  for (const clause of spec.clauses.filter((item) => item.mandatory)) {
    const actual = facts[clause.fact];
    if (isMissing(actual)) return { status: "INDETERMINATE", decidingClauseId: clause.id, reasonCode: MISSING_FACT_REASON_CODE, missingFact: clause.fact };
    if (!applyOperator(actual, clause.operator, clause.value, clause.fact)) return { status: "EXCLUDE", decidingClauseId: clause.id, reasonCode: clause.reasonCode, missingFact: null };
  }
  return { status: "ADMIT", decidingClauseId: null, reasonCode: null, missingFact: null };
}

export function calculateFunnel(rawInputs) {
  const provided = new Set(Object.keys(rawInputs || {}));
  const inputs = funnelInputSchema.parse(rawInputs || {});
  const defaultSources = {
    grantSize: "Tool planning default: $250,000",
    totalPool: "Tool planning default: $10 million",
    expectedApplications: "Tool planning default: 200 applications",
    minutesPerFirstRead: "Tool planning default: 20 minutes",
    hoursPerApplication: "Tool planning default: 8 hours",
    loadedHourlyCost: "Tool planning default: $65 per hour",
    applicantHoursPerApplication: "Tool planning default: 24 hours",
    applicantHourlyValue: "Tool planning default: $35 per hour",
  };
  const grantsAvailable = Math.floor(inputs.totalPool / inputs.grantSize);
  const reviewerHours = inputs.expectedApplications * (inputs.minutesPerFirstRead / 60 + inputs.hoursPerApplication);
  const applicantHours = inputs.expectedApplications * inputs.applicantHoursPerApplication;
  const applicantCost = applicantHours * inputs.applicantHourlyValue;
  const reviewerCost = reviewerHours * inputs.loadedHourlyCost;
  const applicantCostPerDollarGranted = inputs.totalPool > 0 ? applicantCost / inputs.totalPool : null;
  return {
    inputs,
    inputSources: Object.fromEntries(Object.keys(inputs).map((key) => [key, provided.has(key) ? "foundation_input" : "tool_default"])),
    defaultSources,
    outputs: { grantsAvailable, reviewerHours, reviewerCost, applicantHours, applicantCost, applicantCostPerDollarGranted },
    arithmetic: [
      `Grants available = floor(${inputs.totalPool} / ${inputs.grantSize}) = ${grantsAvailable}`,
      `Reviewer hours = ${inputs.expectedApplications} × (${inputs.minutesPerFirstRead} / 60 + ${inputs.hoursPerApplication}) = ${round(reviewerHours)}`,
      `Applicant hours = ${inputs.expectedApplications} × ${inputs.applicantHoursPerApplication} = ${round(applicantHours)}`,
      `Applicant cost = ${round(applicantHours)} × ${inputs.applicantHourlyValue} = ${round(applicantCost)}`,
      `Applicant labor cost per dollar granted = ${round(applicantCost)} / ${inputs.totalPool} = ${round(applicantCostPerDollarGranted, 4)}`,
    ],
  };
}

export function instrumentationPlan() {
  return [
    { field: "submission_id", purpose: "Join intake, review, and final disposition without storing applicant text in the tool." },
    { field: "reason_code", purpose: "Count why submissions were excluded or left indeterminate." },
    { field: "deciding_clause_id", purpose: "Trace each exclusion or indeterminate result to the rule text." },
    { field: "stage_entered_at", purpose: "Measure when a submission entered each stage." },
    { field: "stage_exited_at", purpose: "Calculate elapsed time by stage." },
    { field: "referral_source", purpose: "Compare outreach channels with the admitted pool." },
    { field: "self_screen_used", purpose: "Measure whether the applicant used the published self-screen." },
    { field: "self_screen_outcome", purpose: "Compare self-screen outcomes with intake evaluation." },
    { field: "final_disposition", purpose: "Compare the opening funnel with later human decisions." },
  ];
}

export const starterProfiles = Object.freeze([
  profile("Harbor Youth Learning", "standalone", 2400000, 7, "United States", "youth learning", "501(c)(3)"),
  profile("Mesa Food Futures", "fiscal_sponsor", 180000, 1, "Arizona", "food security", "fiscally sponsored project"),
  profile("Great Lakes Housing Lab", "group_return", 920000, 4, "Michigan", "housing", "501(c)(3) affiliate"),
  profile("Delta Maternal Health Circle", "990_n", 46000, 2, "Mississippi", "maternal health", "501(c)(3)"),
  profile("Appalachian Broadband Cooperative", "standalone", 3600000, 5, "Kentucky", "digital access", "cooperative"),
  profile("Pacific Climate Justice Network", "fiscal_sponsor", 640000, 3, "California", "climate justice", "fiscally sponsored project"),
  profile("Prairie Arts Exchange", "990_n", 38000, 8, "Kansas", "arts", "501(c)(3)"),
  profile("Metro Reentry Partnership", "standalone", 5100000, 12, "New York", "reentry", "501(c)(3)"),
  profile("Border Water Commons", "group_return", 1300000, 2, "New Mexico", "water access", "501(c)(3) affiliate"),
  profile("Rural Disability Advocates", "standalone", 870000, 1, "West Virginia", "disability rights", "501(c)(3)"),
  profile("Coastal Workforce Guild", "standalone", 7400000, 16, "North Carolina", "workforce development", "501(c)(6)"),
  profile("Neighborhood Data Stewards", "fiscal_sponsor", 290000, 0.5, "Illinois", "data justice", "fiscally sponsored project"),
]);

function normalizeProfile(profile) {
  return {
    geography: normalizeText(profile.geography),
    issue_area: normalizeText(profile.issueArea),
    org_type: normalizeText(profile.orgType),
    annual_budget: profile.annualBudget,
    years_operating: profile.yearsOperating,
    filing_relationship: normalizeText(profile.filingRelationship),
  };
}

function applyOperator(actual, operator, expected, fact) {
  if (operator === "gte") return Number(actual) >= Number(expected);
  if (operator === "lte") return Number(actual) <= Number(expected);
  const actualText = normalizeForFact(actual, fact);
  const values = (Array.isArray(expected) ? expected : [expected]).map((value) => normalizeForFact(value, fact));
  if (operator === "equals") return values.some((value) => actualText === value);
  if (operator === "in") return values.some((value) => actualText === value || actualText.includes(value));
  if (operator === "not_in") return values.every((value) => actualText !== value && !actualText.includes(value));
  if (operator === "contains_any") return values.some((value) => actualText.includes(value));
  return false;
}

function summarizeClauses(ruleSpec, results) {
  return ruleSpec.clauses.map((clause) => ({
    clauseId: clause.id,
    sourceSentence: clause.sourceSentence,
    excluded: results.filter((item) => item.outcome.status === "EXCLUDE" && item.outcome.decidingClauseId === clause.id).length,
    indeterminate: results.filter((item) => item.outcome.status === "INDETERMINATE" && item.outcome.decidingClauseId === clause.id).length,
  })).sort((left, right) => right.excluded - left.excluded || right.indeterminate - left.indeterminate || left.clauseId.localeCompare(right.clauseId));
}

function buildClauseFrequency(ruleSpec, results) {
  return ruleSpec.clauses.map((clause) => {
    let excluded = 0;
    let indeterminate = 0;
    for (const item of results) {
      const isolated = { ...ruleSpec, clauses: [clause], rule_hash: computeRuleHash([clause]) };
      const outcome = evaluateParsedProfile(isolated, item.profile);
      if (outcome.status === "EXCLUDE") excluded += 1;
      if (outcome.status === "INDETERMINATE") indeterminate += 1;
    }
    return { clauseId: clause.id, sourceSentence: clause.sourceSentence, excluded, indeterminate };
  }).sort((left, right) => right.excluded - left.excluded || right.indeterminate - left.indeterminate || left.clauseId.localeCompare(right.clauseId));
}

function buildImpactReport(ruleSpec, results) {
  const isThin = (profile) => ["fiscal_sponsor", "990_n", "group_return"].includes(normalizeText(profile.filingRelationship)) || Number(profile.yearsOperating) < 3;
  const thin = results.filter((item) => isThin(item.profile));
  const others = results.filter((item) => !isThin(item.profile));
  const rate = (items) => items.length ? items.filter((item) => item.outcome.status === "EXCLUDE").length / items.length : 0;
  const clauseDrivers = summarizeClauses(ruleSpec, results).filter((item) => item.excluded > 0);
  return {
    filingThin: { count: thin.length, excluded: thin.filter((item) => item.outcome.status === "EXCLUDE").length, exclusionRate: rate(thin) },
    other: { count: others.length, excluded: others.filter((item) => item.outcome.status === "EXCLUDE").length, exclusionRate: rate(others) },
    differentialPercentagePoints: round((rate(thin) - rate(others)) * 100, 1),
    clauseDrivers,
  };
}

function profile(organizationName, filingRelationship, annualBudget, yearsOperating, geography, issueArea, orgType) {
  return { organizationName, ein: "", filingRelationship, annualBudget, yearsOperating, geography, issueArea, orgType, description: "Fictional candidate profile for rule testing." };
}

function isMissing(value) { return value === undefined || value === null || value === ""; }
function normalizeText(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function normalizeForFact(value, fact) {
  let text = normalizeText(value)
    .replace(/[.]/g, "")
    .replace(/\bbased in\b/g, "")
    .replace(/-based\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (fact === "geography" && ["us", "usa", "united states of america"].includes(text)) text = "united states";
  if (fact === "org_type") text = text.replace(/\b(?:organization|organisation|nonprofit|charity)\b/g, "").replace(/\s+/g, " ").trim();
  if (fact === "filing_relationship") {
    if (/fiscal(?:ly)? sponsor/.test(text)) return "fiscal_sponsor";
    if (/group return/.test(text)) return "group_return";
    if (/990[- ]?n/.test(text)) return "990_n";
    if (/standalone|own return/.test(text)) return "standalone";
  }
  return text;
}
function round(value, digits = 2) { const factor = 10 ** digits; return Math.round((Number(value) + Number.EPSILON) * factor) / factor; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function normalizeRuleSpecInput(value) { return value?.artifact === "rule_spec" ? ruleSpecSchema.parse(value) : finalizeRuleSpec(value); }
function parseArtifactJson(value) { try { return JSON.parse(value); } catch { throw artifactLoadError("The uploaded artifact is not valid JSON."); } }
function parseCurrentRuleSpec(value) { const parsed = ruleSpecSchema.safeParse(value); if (!parsed.success) throw artifactLoadError("The uploaded RuleSpec failed schema or rule-hash validation."); return parsed.data; }
function artifactLoadError(message) { const error = new Error(message); error.statusCode = 400; error.publicMessage = message; error.code = "ARTIFACT_LOAD_ERROR"; return error; }
