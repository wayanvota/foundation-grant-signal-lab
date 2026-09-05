import { z } from "zod";
import { compileRuleText } from "../src/ruleCompiler.js";
import { artifactMetadata, reportArtifact } from "../src/artifacts.js";
import { applicantProfileSchema, calculateFunnel, evaluateProfile, finalizeRuleSpec, funnelInputSchema, generateSelfScreen, instrumentationPlan, loadRuleArtifact, starterProfiles, summarizeCandidateResults } from "../src/ruleSpec.js";

export const callDesignInputSchema = z.object({
  ruleText: z.string().trim().max(40_000).default(""),
  ruleArtifact: z.unknown().optional(),
  candidateProfiles: z.array(applicantProfileSchema).max(500).default([]),
  funnel: funnelInputSchema.default({}),
}).strict().superRefine((value, context) => {
  if (!value.ruleArtifact && value.ruleText.length < 20) context.addIssue({ code: "custom", path: ["ruleText"], message: "Provide draft rule text or an uploaded RuleSpec." });
});

export async function generateCallDesign(input, { compileRule = compileRuleText } = {}) {
  const parsed = callDesignInputSchema.parse(input);
  const compilation = parsed.ruleArtifact
    ? { ...loadRuleArtifact(parsed.ruleArtifact), safeguard: { status: "artifact_loaded", strippedSpanCount: 0 } }
    : await compileRule(parsed.ruleText);
  const ruleSpec = compilation.ruleSpec.artifact === "rule_spec" ? compilation.ruleSpec : finalizeRuleSpec(compilation.ruleSpec);
  const profiles = parsed.candidateProfiles.length ? parsed.candidateProfiles : starterProfiles;
  const evaluation = await evaluateCandidateSetInChunks(ruleSpec, profiles);
  const generatedAt = new Date().toISOString();
  const impactReport = reportArtifact("rule_impact_report", ruleSpec, evaluation.impactReport, { generatedAt });
  const exclusionReport = reportArtifact("exclusion_report", ruleSpec, {
    results: evaluation.results,
    clauseSummary: evaluation.clauseSummary,
    clauseFrequency: evaluation.clauseFrequency,
    impactReport,
  }, { generatedAt });
  const selfScreen = reportArtifact("self_screen", ruleSpec, generateSelfScreen(ruleSpec), { generatedAt });
  const funnelProjection = reportArtifact("funnel_projection", ruleSpec, calculateFunnel(parsed.funnel), { generatedAt });
  const result = {
    ruleSpec,
    safeguard: compilation.safeguard,
    migrationNotice: compilation.notice || null,
    candidateSetSource: parsed.candidateProfiles.length ? "user" : "fictional_starter_set",
    exclusionReport,
    selfScreen,
    funnelProjection,
    instrumentationPlan: instrumentationPlan(),
    method: parsed.ruleArtifact
      ? "The saved RuleSpec was version-checked before deterministic code evaluated every candidate profile. No model participated in an admit, exclude, or indeterminate outcome."
      : "The model compiled the prose into a RuleSpec. Deterministic code evaluated every candidate profile. No model participated in an admit, exclude, or indeterminate outcome.",
    privacy: "Nothing was saved on the server. Download the RuleSpec or SessionBundle if you want to use this work in another session.",
  };
  result.sessionBundle = {
    ...artifactMetadata("session_bundle", { generatedAt }),
    rule_hash: ruleSpec.rule_hash,
    ruleSpec,
    candidateSetSource: result.candidateSetSource,
    exclusionReport,
    selfScreen,
    funnelProjection,
    instrumentationPlan: result.instrumentationPlan,
  };
  return result;
}

async function evaluateCandidateSetInChunks(ruleSpec, profiles, chunkSize = 50) {
  const results = [];
  for (let index = 0; index < profiles.length; index += chunkSize) {
    for (const raw of profiles.slice(index, index + chunkSize)) {
      const profile = applicantProfileSchema.parse(raw);
      results.push({ profile, outcome: evaluateProfile(ruleSpec, profile) });
    }
    if (index + chunkSize < profiles.length) await new Promise((resolve) => setImmediate(resolve));
  }
  return summarizeCandidateResults(ruleSpec, results);
}
