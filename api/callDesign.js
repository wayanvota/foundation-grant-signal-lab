import { z } from "zod";
import { compileRuleText } from "../src/ruleCompiler.js";
import { applicantProfileSchema, calculateFunnel, evaluateCandidateSet, funnelInputSchema, generateSelfScreen, instrumentationPlan, starterProfiles } from "../src/ruleSpec.js";

export const callDesignInputSchema = z.object({
  ruleText: z.string().trim().min(20).max(40_000),
  candidateProfiles: z.array(applicantProfileSchema).max(200).default([]),
  funnel: funnelInputSchema.default({}),
}).strict();

export async function generateCallDesign(input, { compileRule = compileRuleText } = {}) {
  const parsed = callDesignInputSchema.parse(input);
  const compilation = await compileRule(parsed.ruleText);
  const profiles = parsed.candidateProfiles.length ? parsed.candidateProfiles : starterProfiles;
  const evaluation = evaluateCandidateSet(compilation.ruleSpec, profiles);
  return {
    ruleSpec: compilation.ruleSpec,
    safeguard: compilation.safeguard,
    candidateSetSource: parsed.candidateProfiles.length ? "user" : "fictional_starter_set",
    exclusionReport: evaluation,
    selfScreen: generateSelfScreen(compilation.ruleSpec),
    funnelProjection: calculateFunnel(parsed.funnel),
    instrumentationPlan: instrumentationPlan(),
    method: "The model compiled the prose into a RuleSpec. Deterministic code evaluated every candidate profile. No model participated in an admit, exclude, or indeterminate outcome.",
    privacy: "Nothing was saved on the server. Download the RuleSpec or SessionBundle if you want to use this work in another session.",
  };
}

