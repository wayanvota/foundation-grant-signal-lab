import { createHash } from "node:crypto";

export const SCHEMA_VERSION = "1.0.0";
export const GENERATOR = "foundation-grant-signal-lab";
export const RESERVED_FIELDS = Object.freeze({
  batch_id: null,
  submission_id: null,
  stage_timestamps: null,
  referral_source: null,
  self_screen_outcome: null,
  final_disposition: null,
});

export function artifactMetadata(artifact, { generatedAt = new Date().toISOString(), generatorVersion = currentGeneratorVersion() } = {}) {
  return {
    artifact,
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    generator: GENERATOR,
    generator_version: generatorVersion,
  };
}

export function currentGeneratorVersion() {
  const value = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.SOURCE_VERSION;
  return value ? String(value).slice(0, 7) : "development";
}

export function computeRuleHash(clauses) {
  const sortedClauses = [...clauses]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((clause) => sortObject(clause));
  return `sha256:${createHash("sha256").update(JSON.stringify(sortedClauses)).digest("hex")}`;
}

export function reportArtifact(artifact, ruleSpec, body, options = {}) {
  const metadata = artifactMetadata(artifact, options);
  return {
    ...metadata,
    rule_hash: ruleSpec.rule_hash,
    ...body,
    footer: {
      rule_hash: ruleSpec.rule_hash,
      schema_version: metadata.schema_version,
      generated_at: metadata.generated_at,
      generator_version: metadata.generator_version,
    },
  };
}

export function inspectArtifactVersion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw artifactError("The uploaded artifact must be a JSON object.");
  const found = typeof input.schema_version === "string" ? input.schema_version : "0.x";
  const major = found === "0.x" ? 0 : parseMajor(found);
  const supportedMajor = parseMajor(SCHEMA_VERSION);
  if (major > supportedMajor) {
    throw artifactError(`This file uses schema version ${found}; this tool supports ${SCHEMA_VERSION}. The newer file was not loaded.`);
  }
  return { found, major, supportedMajor, migrationRequired: major < supportedMajor || found === "0.x" };
}

export function migrationNotice(fromVersion) {
  return `This file was migrated from schema version ${fromVersion} to ${SCHEMA_VERSION}. Review and download the updated artifact before relying on it.`;
}

function parseMajor(value) {
  const match = /^(\d+)(?:\.|$)/.exec(String(value));
  if (!match) throw artifactError(`The uploaded artifact has an invalid schema_version: ${value}.`);
  return Number(match[1]);
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function artifactError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  error.code = "ARTIFACT_VERSION_ERROR";
  return error;
}
