import fs from "node:fs/promises";
import path from "node:path";
import { artifactMetadata, reportArtifact } from "../src/artifacts.js";
import { calculateFunnel, evaluateCandidateSet, finalizeRuleSpec, generateSelfScreen, starterProfiles } from "../src/ruleSpec.js";

const states = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia", "United States"];

export async function buildWorkedExample(target) {
  const generatedAt = "2026-09-05T12:00:00.000Z";
  const ruleSpec = finalizeRuleSpec({
    name: "Common Ground Opportunity Fund",
    clauses: [
      clause("C001", "Applicants must be based in the United States.", "geography", "contains_any", states, "GEO_INELIGIBLE", "Is your organization based in the United States?"),
      clause("C002", "Applicants must work in youth learning, food security, or maternal health.", "issue_area", "contains_any", ["youth learning", "food security", "maternal health"], "ISSUE_AREA_OUT_OF_SCOPE", "Does your proposed work address youth learning, food security, or maternal health?"),
      clause("C003", "Applicants must be a 501(c)(3) public charity or a fiscally sponsored project.", "org_type", "contains_any", ["501(c)(3)", "fiscally sponsored project"], "ORG_TYPE_INELIGIBLE", "Are you a 501(c)(3) public charity or a fiscally sponsored project?"),
      clause("C004", "Applicants must have operated for at least two years.", "years_operating", "gte", 2, "OPERATING_HISTORY_SHORT", "Has your organization or project operated for at least two years?"),
    ],
    uncompiledLanguage: [{ sourceSentence: "Priority will be given to community-rooted organizations with bold leadership.", reason: "Community-rootedness and bold leadership require judgment and cannot be verified as literal eligibility facts.", suggestion: "If local governance matters, name a factual test such as the required share of board members who live in the service area." }],
  }, { generatedAt });
  const evaluation = evaluateCandidateSet(ruleSpec, starterProfiles);
  const impact = reportArtifact("rule_impact_report", ruleSpec, evaluation.impactReport, { generatedAt });
  const exclusion = reportArtifact("exclusion_report", ruleSpec, { results: evaluation.results, clauseSummary: evaluation.clauseSummary, clauseFrequency: evaluation.clauseFrequency, impactReport: impact }, { generatedAt });
  const selfScreen = reportArtifact("self_screen", ruleSpec, generateSelfScreen(ruleSpec), { generatedAt });
  const funnel = reportArtifact("funnel_projection", ruleSpec, calculateFunnel({}), { generatedAt });
  const bundle = { ...artifactMetadata("worked_example", { generatedAt }), rule_hash: ruleSpec.rule_hash, ruleSpec, exclusionReport: exclusion, selfScreen, funnelProjection: funnel };

  await fs.writeFile(path.join(target, "worked-example-rule-spec.json"), `${JSON.stringify(ruleSpec, null, 2)}\n`);
  await fs.writeFile(path.join(target, "worked-example.json"), `${JSON.stringify(bundle, null, 2)}\n`);
  await fs.writeFile(path.join(target, "worked-example.html"), renderPage(bundle));
}

function clause(id, sourceSentence, fact, operator, value, reasonCode, selfScreenQuestion) {
  return { id, sourceSentence, fact, operator, value, mandatory: true, reasonCode, selfScreenQuestion };
}

function renderPage({ ruleSpec, exclusionReport, selfScreen, funnelProjection }) {
  const outcomes = exclusionReport.results.map(({ profile, outcome }) => `<tr><td>${escape(profile.organizationName)}</td><td><strong>${escape(outcome.status)}</strong></td><td>${escape(outcome.reasonCode || "")}</td><td>${escape(outcome.decidingClauseId || "All mandatory clauses passed")}</td></tr>`).join("");
  const clauses = ruleSpec.clauses.map((item) => `<article><h3>${escape(item.id)}: ${escape(item.sourceSentence)}</h3><p><code>${escape(item.fact)} ${escape(item.operator)} ${escape(Array.isArray(item.value) ? item.value.join(", ") : item.value)}</code></p><p>Failure code: ${escape(item.reasonCode)}</p></article>`).join("");
  const frequencies = exclusionReport.clauseFrequency.map((item) => `<tr><td>${escape(item.clauseId)}</td><td>${item.excluded}</td><td>${item.indeterminate}</td><td>${escape(item.sourceSentence)}</td></tr>`).join("");
  const metadata = footer(exclusionReport);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="A complete fictional Call Design example from Foundation Grant Signal Lab."><title>Worked example | Foundation Grant Signal Lab</title><link rel="stylesheet" href="./styles.css"><link rel="stylesheet" href="./mode1.css"><style>main{max-width:1180px;margin:auto;padding:42px 24px 80px}.example-section{margin:36px 0}.example-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.example-grid article{border:1px solid var(--line);border-radius:7px;background:#fff;padding:16px}code{overflow-wrap:anywhere}h1{max-width:850px}.downloads{display:flex;gap:10px;flex-wrap:wrap}@media(max-width:760px){.example-grid{grid-template-columns:1fr}}</style></head>
<body><header class="topbar"><a class="brand-lockup" href="./index.html"><span class="brand-mark">GS</span><span><strong>Foundation Grant Signal Lab</strong><small>Fictional worked example</small></span></a><nav><a href="./index.html">Open the tool</a></nav></header><main>
<p class="eyebrow accent">Static worked example</p><h1>Common Ground Opportunity Fund</h1><p class="lede">This invented $10 million pooled fund supports youth learning, food security, and maternal health in the United States. Applicants must be a 501(c)(3) public charity or fiscally sponsored project and must have operated for at least two years. No model or applicant data is used to display this page.</p>
<div class="downloads"><a class="button" href="./worked-example-rule-spec.json" download>Download RuleSpec</a><a class="button ghost" href="./worked-example.json" download>Download full example</a></div>
<section class="example-section"><p class="eyebrow">Compiled rule</p><h2>Four deterministic clauses</h2><div class="example-grid">${clauses}</div></section>
<section class="example-section"><p class="eyebrow">Uncompiled language</p><h2>${escape(ruleSpec.uncompiledLanguage[0].sourceSentence)}</h2><p>${escape(ruleSpec.uncompiledLanguage[0].reason)}</p><p><strong>Possible testable substitute:</strong> ${escape(ruleSpec.uncompiledLanguage[0].suggestion)}</p></section>
<section class="example-section"><p class="eyebrow">Twelve fictional profiles</p><h2>Exclusion report</h2><div class="table-wrap"><table><thead><tr><th>Organization</th><th>Outcome</th><th>Reason code</th><th>Deciding clause</th></tr></thead><tbody>${outcomes}</tbody></table></div></section>
<section class="example-section"><p class="eyebrow">Retrospective view</p><h2>Clause frequency</h2><div class="table-wrap"><table><thead><tr><th>Clause</th><th>Would exclude</th><th>Missing fact</th><th>Source language</th></tr></thead><tbody>${frequencies}</tbody></table></div></section>
<section class="example-section"><p class="eyebrow">Filing-thin comparison</p><h2>Rule Impact Report</h2><div class="metric-grid"><article class="metric-card"><small>Filing-thin exclusion rate</small><strong>${percent(exclusionReport.impactReport.filingThin.exclusionRate)}</strong></article><article class="metric-card"><small>Other profiles</small><strong>${percent(exclusionReport.impactReport.other.exclusionRate)}</strong></article><article class="metric-card"><small>Difference</small><strong>${exclusionReport.impactReport.differentialPercentagePoints} points</strong></article></div></section>
<section class="example-section"><p class="eyebrow">Applicant-facing copy</p><h2>Self-screen questions</h2><pre>${escape(selfScreen.plainText)}</pre></section>
<section class="example-section"><p class="eyebrow">Visible arithmetic</p><h2>Funnel projection</h2><div class="metric-grid"><article class="metric-card"><small>Pool</small><strong>$10M</strong></article><article class="metric-card"><small>Grants available</small><strong>${funnelProjection.outputs.grantsAvailable}</strong></article><article class="metric-card"><small>Applicant labor cost</small><strong>$${Number(funnelProjection.outputs.applicantCost).toLocaleString("en-US")}</strong></article></div><ol>${funnelProjection.arithmetic.map((line) => `<li>${escape(line)}</li>`).join("")}</ol></section>
<footer class="artifact-footer">${escape(metadata)}</footer></main></body></html>`;
}

function footer(value) { return `Rule hash: ${value.rule_hash} | Schema: ${value.schema_version} | Run: ${value.generated_at} | Generator: ${value.generator_version}`; }
function percent(value) { return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value); }
function escape(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
