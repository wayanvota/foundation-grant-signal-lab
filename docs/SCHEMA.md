# Foundation Grant Signal Lab artifact schema

Schema version `1.0.0` is the public contract for files created by Foundation Grant Signal Lab. Minor and patch releases may add backward-compatible behavior. A future incompatible shape requires a new major version.

Every artifact begins with:

```json
{
  "artifact": "rule_spec",
  "schema_version": "1.0.0",
  "generated_at": "2026-09-05T12:00:00.000Z",
  "generator": "foundation-grant-signal-lab",
  "generator_version": "d992963"
}
```

`generator_version` is the deployed Git commit when the hosting environment supplies it. Local development builds use `development`.

## Load and migration behavior

The loader reads `schema_version` before inspecting artifact contents.

- Version 1 files load after complete schema and `rule_hash` validation.
- A missing version is treated as `0.x`. The current pre-freeze RuleSpec and SessionBundle shapes migrate to 1.0.0 and produce a visible warning.
- Older major versions are migrated only when an explicit migration exists.
- Files with a major version newer than 1 are refused before their other fields are parsed. The error names the found and supported versions.
- A SessionBundle upload extracts and validates its enclosed RuleSpec using the same rules.

## RuleSpec

`RuleSpec` is the compiled, deterministic rule contract. `clauses` are sorted by clause ID only when calculating the hash; their stored source order is preserved.

```json
{
  "artifact": "rule_spec",
  "schema_version": "1.0.0",
  "generated_at": "2026-09-05T12:00:00.000Z",
  "generator": "foundation-grant-signal-lab",
  "generator_version": "d992963",
  "rule_hash": "sha256:4ecb938e6bcaa62b076b942643f532a78018d2c9067d3aa9ec2b6d09aa2aa402",
  "name": "Fictional Virginia call",
  "clauses": [
    {
      "id": "C001",
      "sourceSentence": "Applicants must operate in Virginia.",
      "fact": "geography",
      "operator": "contains_any",
      "value": ["Virginia"],
      "mandatory": true,
      "reasonCode": "GEO_INELIGIBLE",
      "selfScreenQuestion": "Does your organization operate in Virginia?"
    }
  ],
  "uncompiledLanguage": [
    {
      "sourceSentence": "We prioritize community-rooted organizations.",
      "reason": "Community-rootedness requires human judgment.",
      "suggestion": "If local governance matters, state a required share of board members who live in the service area."
    }
  ],
  "custom_reason_codes": {},
  "batch_id": null,
  "submission_id": null,
  "stage_timestamps": null,
  "referral_source": null,
  "self_screen_outcome": null,
  "final_disposition": null
}
```

### Clause fields

- `id`: unique `C` plus three digits.
- `sourceSentence`: exact language from the foundation rule.
- `fact`: `geography`, `issue_area`, `org_type`, `annual_budget`, `years_operating`, or `filing_relationship`.
- `operator`: `equals`, `in`, `not_in`, `contains_any`, `gte`, or `lte`.
- `value`: string, number, or a list of no more than 60 strings.
- `mandatory`: only mandatory clause failures exclude.
- `reasonCode`: one shipped code or a declared custom code.
- `selfScreenQuestion`: applicant-facing wording for the identical test.

### Frozen reason codes

The shipped enum is append-only. Codes are never renamed, repurposed, or deleted:

```text
GEO_INELIGIBLE
ISSUE_AREA_OUT_OF_SCOPE
ORG_TYPE_INELIGIBLE
BUDGET_BELOW_FLOOR
BUDGET_ABOVE_CEILING
OPERATING_HISTORY_SHORT
DUPLICATE_SUBMISSION
INCOMPLETE_REQUIRED_ELEMENT
IDENTITY_UNVERIFIED
INDETERMINATE_MISSING_FACT
```

Foundations may add `custom_reason_codes` as a code-to-description map. Every custom key must start with `CUSTOM_`, and a clause cannot use a custom code unless the map defines it.

### Reserved fields

`batch_id`, `submission_id`, `stage_timestamps`, `referral_source`, `self_screen_outcome`, and `final_disposition` are reserved for later intake and cohort work. They must be present and `null` in schema 1.0.0 RuleSpecs. Consumers must not assign another meaning to them.

### Rule hash

`rule_hash` is SHA-256 over the complete clause set after sorting clauses by `id` and recursively sorting object keys. Artifact metadata, timestamps, rule name, uncompiled language, and reserved fields are excluded. Every exclusion report, impact report, self-screen, funnel projection, and SessionBundle repeats this hash.

## SessionBundle

A SessionBundle preserves the complete stateless run:

```json
{
  "artifact": "session_bundle",
  "schema_version": "1.0.0",
  "generated_at": "2026-09-05T12:00:00.000Z",
  "generator": "foundation-grant-signal-lab",
  "generator_version": "d992963",
  "rule_hash": "sha256:4ecb938e6bcaa62b076b942643f532a78018d2c9067d3aa9ec2b6d09aa2aa402",
  "ruleSpec": { "artifact": "rule_spec", "schema_version": "1.0.0" },
  "candidateSetSource": "user",
  "exclusionReport": { "artifact": "exclusion_report", "schema_version": "1.0.0" },
  "selfScreen": { "artifact": "self_screen", "schema_version": "1.0.0" },
  "funnelProjection": { "artifact": "funnel_projection", "schema_version": "1.0.0" },
  "instrumentationPlan": []
}
```

The abbreviated nested objects above identify their shapes. Actual bundles contain each complete object.

## Exported reports

Every report uses the common metadata header plus `rule_hash`:

```json
{
  "artifact": "exclusion_report",
  "schema_version": "1.0.0",
  "generated_at": "2026-09-05T12:00:00.000Z",
  "generator": "foundation-grant-signal-lab",
  "generator_version": "d992963",
  "rule_hash": "sha256:4ecb938e6bcaa62b076b942643f532a78018d2c9067d3aa9ec2b6d09aa2aa402",
  "results": [],
  "clauseSummary": [],
  "clauseFrequency": [],
  "impactReport": {},
  "footer": {
    "rule_hash": "sha256:4ecb938e6bcaa62b076b942643f532a78018d2c9067d3aa9ec2b6d09aa2aa402",
    "schema_version": "1.0.0",
    "generated_at": "2026-09-05T12:00:00.000Z",
    "generator_version": "d992963"
  }
}
```

`clauseFrequency` tests every clause independently against every profile. It therefore answers how many applicants each clause would exclude, even when an earlier clause determined an applicant's final outcome.

The `rule_impact_report`, `self_screen`, and `funnel_projection` artifacts follow the same header. The plain-text self-screen contains numbered questions and clause IDs for pasting into a call document. Visible report footers print the rule hash, schema version, run time, and generator version.
