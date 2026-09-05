# Foundation Grant Signal Lab v2 implementation record

**PRD:** `PRD-foundation-grant-signal-lab-v2.md`  
**Release scope:** Mode 1, Call Design, plus the two specified Mode 3 corrections  
**State model:** Stateless server; user-held RuleSpec and session bundle

## Shipped in this phase

Call Design now accepts pasted or uploaded rule text, optional manually entered or CSV candidate profiles, and editable funnel assumptions. It returns:

- a readable RuleSpec with exact source sentences;
- an Uncompiled language block for values, judgments, ambiguity, and model-directed instructions;
- deterministic `ADMIT`, `EXCLUDE`, or `INDETERMINATE` results with reason codes and deciding clauses;
- a Rule Impact Report comparing filing-thin profiles with the rest of the candidate set;
- self-screen questions as JSON, plain text, and copy-ready HTML;
- a funnel and burden projection with visible arithmetic;
- an intake instrumentation plan;
- downloadable RuleSpec and session bundle JSON files.

The model is restricted to rule compilation. `src/ruleSpec.js` performs every eligibility evaluation. The evaluator cannot call a model, score quality, rank applicants, predict funding probability, or resolve a missing fact by inference.

Mode 3 now treats fiscal sponsorship, group returns, Form 990-N, and organizations without a comparable return as distinct evidence paths. These conditions receive a full strategy review and path-specific document questions. Identity mismatch, malformed input, injection detection, short filing periods, timeouts, and genuine indeterminacy still produce `NEEDS HUMAN CHECK`.

The ask-to-revenue threshold is a foundation-set input. The memo prints the value used and attributes it to the foundation input.

## Acceptance evidence

- 73 deterministic tests pass.
- The same RuleSpec and profile produced identical clause-level output across 20 runs.
- Values language remained uncompiled in both fixture and live provider checks.
- An instruction to admit a named organization was stripped, surfaced, and excluded from evaluation.
- A mixed candidate set correctly named the three-year operating-history clause as the exclusion driver after canonical geography and organization-type normalization.
- Self-screen and evaluator outcomes matched for 100 generated profiles.
- Fiscal-sponsor, Form 990-N, and no-return paths produced full review structures with the required document questions.
- The static site built successfully, the browser interaction smoke test passed, and the dependency audit reported zero known vulnerabilities.

## Deferred by the PRD build order

Mode 2, Intake Screen, and Mode 4, Cohort Report, remain later-phase work. Their shared reason-code and instrumentation foundations ship in Mode 1, but their disabled tabs were removed from the public interface during the September 2026 hardening pass. The Method section now states the boundary in prose.
