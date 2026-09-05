# Test and repair report: hardening pass 2

## Outcome

- Run status: COMPLETE
- Tool and purpose: Foundation Grant Signal Lab, a stateless call-design and foundation diligence tool.
- Run date and report location: September 5, 2026; this file.
- Initial revision: `3b048794b9a7c03859f4c4f55317222bd951feca`.
- Final tested state: the initial revision plus the uncommitted hardening-pass-2 changes listed by `git status --short`.
- Environment: macOS workspace, Node.js 26.5.0; local unit, artifact-build, static-interface, and loopback HTTP tests.
- Authorization and isolation: synthetic and fictional data only. Provider calls were mocked. HTTP attacks targeted a temporary local listener.
- Fix location: local, not yet committed or deployed when this report was written.
- Remaining failures, blockers, or decisions: none within the PRD. The owner clarified the complete scenario as 1,000 applications, 20 grants, 40 applicant hours, $85 per hour, and a $10 million pool. The implemented calculation yields 34 cents per grant dollar.

| Coverage | Initial PASS | Initial FAIL | Initial BLOCKED | Initial NOT RUN | Final PASS | Final FAIL | Final BLOCKED | Final NOT RUN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User behavior, 10 categories | 5 | 5 | 0 | 0 | 10 | 0 | 0 | 0 |
| Adversarial, 10 categories | 10 | 0 | 0 | 0 | 10 | 0 | 0 | 0 |

## Scope and expectations

The PRD supplied the expected behavior for funnel defaults, two-stage reviewer effort, applicant-cost unit conversion, starter-profile composition, impact-report suppression, clause attribution, extreme-frequency findings, and public verification statements. Existing repository contracts supplied the expectations for stateless operation, deterministic eligibility, artifact integrity, upload limits, hostile-input handling, and human-check behavior.

The initial suite passed 83 tests and skipped four loopback checks inside the restricted sandbox. Direct inspection of the starting artifact confirmed all five PRD defects. After repair, the expanded suite passed 88 tests and skipped the same four sandbox-bound checks. Those four HTTP checks were then run outside the restricted sandbox and passed 4 of 4.

## Primary test matrix

| ID | Category | Initial status | Final status | Defect IDs | Evidence |
| --- | --- | --- | --- | --- | --- |
| U01 | First-use defaults and labels | FAIL | PASS | D01 | `test/hardeningUi.test.js`; generated `index.html` |
| U02 | Two-stage funnel correctness | FAIL | PASS | D01 | `test/ruleSpec.test.js`; generated worked example |
| U03 | Invalid structured-input recovery | PASS | PASS | | `test/serverCallDesign.test.js` |
| U04 | Threshold, missing-fact, and filing-structure representation | FAIL | PASS | D02 | `test/ruleSpec.test.js`; `fixtures/starter-profiles.json` |
| U05 | Artifact save, migration, and resumption | PASS | PASS | | `test/artifacts.test.js` |
| U06 | User-edited assumptions and explicit zero values | PASS | PASS | | `test/ruleSpec.test.js` |
| U07 | Provider interruption and safe recovery | PASS | PASS | | `test/provider.test.js`; `test/filingPaths.test.js` |
| U08 | Visible diagnostics and verification disclosure | FAIL | PASS | D04, D05 | `test/hardeningUi.test.js`; generated worked example |
| U09 | Impact comparison representation | FAIL | PASS | D03 | `test/ruleSpec.test.js`; generated worked example |
| U10 | Repeatability and self-screen parity | PASS | PASS | | `test/ruleSpec.test.js`; `test/selfScreenAgreement.test.js` |
| A01 | Required-input and EIN bypass | PASS | PASS | | `test/adversarialMatrix.test.js`; `test/irs990.test.js` |
| A02 | Cross-request data exposure, substituted for accounts | PASS | PASS | | `test/server.test.js`; stateless API response |
| A03 | Script and markup injection | PASS | PASS | | `test/adversarialMatrix.test.js`; text-only DOM rendering |
| A04 | Direct and encoded prompt injection | PASS | PASS | | `test/safeguards.test.js`; `test/adversarialMatrix.test.js` |
| A05 | Forged cross-origin request | PASS | PASS | | local `test/server.test.js` execution |
| A06 | Malicious or unsupported upload | PASS | PASS | | `test/proposalFile.test.js`; `test/adversarialMatrix.test.js` |
| A07 | Filing identity substitution, replacing inapplicable user URLs | PASS | PASS | | `test/inputQuality.test.js`; `test/irs990.test.js` |
| A08 | RuleSpec tampering and replay | PASS | PASS | | `test/artifacts.test.js` |
| A09 | Request, file, and batch-limit abuse | PASS | PASS | | `test/server.test.js`; `test/callDesign.test.js` |
| A10 | Synthetic confidential-marker exposure | PASS | PASS | | `test/frontendFixture.test.js`; stateless API test |

## Test evidence

### U01 to U10: program-officer behavior

- Persona and purpose: a program officer designs a call, loads or omits past profiles, inspects exclusions, downloads artifacts, and relies on the Method section before publishing guidelines.
- Preconditions: the PRD, the committed worked example at the initial revision, the shared twelve-profile fixture, and deterministic test RuleSpecs.
- Actions: inspect initial defaults and outputs; calculate known funnel values independently; test 0, 1.99, 2, and upper-volume boundaries; exercise absent and loaded candidate sets; build the static interface; read the resulting HTML and JSON; repeat eligibility twenty times; compare evaluator and self-screen outcomes for 100 profiles.
- Expected result: defaults match the PRD; later review applies only to admitted profiles; both labor-cost units appear; the starter set contains seven admits, four exclusions, and one indeterminate result; small groups suppress rates; large groups show clause-level attribution; extreme-frequency clauses are named; verification results are printed.
- Initial observation: U01, U02, U04, U08, and U09 failed against revision `3b04879`. The old artifact used 24 hours and $35, applied eight later-review hours to all applications, concentrated exclusions on issue area, computed rates for groups below ten, omitted extreme-frequency interpretation, and did not print the two suite results in the required format.
- Final observation: all ten categories passed through `npm test`, `npm run check`, `npm run build:frontend`, direct artifact inspection, and `git diff --check`.

### A01 to A10: controlled hostile behavior

- Attacker goal and boundaries: bypass required facts, expose another request, execute markup or model-control text, forge an origin, smuggle an unsupported file, attach the wrong filing, tamper with a hashed rule, exceed limits, or reveal synthetic private data.
- Preconditions: synthetic inputs, mocked providers, and temporary local HTTP listeners. The public service has no account or user-supplied URL surface, so A02 and A07 use the closest real trust boundaries rather than inventing features.
- Actions: run the repository's hostile-input corpus; submit malformed and oversized JSON; submit excessive multipart fields; send a hostile Origin header; upload disguised binary data; alter a RuleSpec after hashing; pair an EIN with an unrelated legal name; inspect public fixtures and API responses for unintended state.
- Expected result: harmful actions are rejected, stripped, or routed to `NEEDS HUMAN CHECK`; legitimate controls continue to work; no request history or synthetic private marker is exposed.
- Initial and final observation: all ten categories passed. The four HTTP cases that the workspace sandbox skipped passed in a separate unrestricted local run with zero failures.

## Defects and repairs

### D01: Published funnel used contradictory defaults and overstated reviewer effort

- Affected tests: U01, U02.
- Severity and impact: high for publication credibility. Readers could reproduce an indefensible reviewer-hour total and see assumptions that contradicted the stated sector estimate.
- Reproduction: inspect the initial funnel defaults and calculate 200 applications times 20 minutes plus eight hours. The tool applied advanced review to all 200 applications.
- Cause: one field represented later review as hours per application, with no admitted-count source or expected-admit-rate fallback.
- Fix: introduced first-read and advanced-review stages, an observed admitted count when profiles are supplied, a visible 20 percent fallback, 1,000 expected applications, 20 grants at $500,000 each, 40 applicant hours, $85 applicant labor cost, and dollar-to-cent arithmetic.
- Regression coverage: dedicated default, observed-count, zero-cost, UI-label, and worked-example assertions.
- Final status: FIXED AND VERIFIED.

### D02: Starter profiles did not exercise the evaluator's meaningful boundaries

- Affected test: U04.
- Severity and impact: high for demonstrations. The published page hid `INDETERMINATE`, numeric thresholds, and successful filing-thin applicants.
- Cause: the starter set was embedded in code and nine profiles missed the issue-area rule.
- Fix: moved all profiles to one JSON fixture used by both the API and worked-example generator. The set now produces seven admits, two operating-history exclusions, one organization-type exclusion, one issue-area exclusion, and one missing-fact result. It includes exact and below-threshold values plus fiscal sponsor, 990-N, group return, and no-filing structures.
- Regression coverage: one composition and boundary test validates all required outcomes and structures.
- Final status: FIXED AND VERIFIED.

### D03: Impact rates implied meaning from groups smaller than ten

- Affected test: U09.
- Severity and impact: high for analytical integrity. The old page displayed a 12.5-point gap based on eight and four profiles.
- Cause: the report calculated a rate for every nonempty group and aggregated clause drivers across both groups.
- Fix: rates and differences are null unless both groups have at least ten profiles. Computed reports show group sizes, deciding-clause counts and rates, and a plain-language attribution when the largest gap comes from a non-filing clause.
- Regression coverage: small-group suppression and two 10-profile group tests.
- Final status: FIXED AND VERIFIED.

### D04: Clause-frequency extremes lacked an interpretation

- Affected test: U08.
- Severity and impact: medium. Users could see zero or universal exclusion without being told why either result warranted review.
- Cause: the report returned counts only.
- Fix: added structured findings for clauses that never fire and clauses that exclude every tested profile. The app and worked example render the finding beneath the table.
- Regression coverage: isolated zero-frequency and all-frequency cases.
- Final status: FIXED AND VERIFIED.

### D05: Release-gate verification was not printed in the required form

- Affected test: U08.
- Severity and impact: high for the planned article's central parity claim.
- Cause: the Method section combined both results in one narrative sentence.
- Fix: printed `Self-screen parity: 100/100, boundary-value suite, run 2026-09-05` and `Determinism: 20/20 repeated evaluations, run 2026-09-05` as separate statements after rerunning both suites.
- Regression coverage: static-interface assertions plus the 100-profile and 20-repeat executable suites.
- Final status: FIXED AND VERIFIED.

## Final verification and handoff

- Final user categories: 10 PASS, 0 FAIL, 0 BLOCKED, 0 NOT RUN.
- Final adversarial categories: 10 PASS, 0 FAIL, 0 BLOCKED, 0 NOT RUN.
- Expanded repository suite: 88 pass, 0 fail, 4 sandbox skips. Separate loopback run: 4 pass, 0 fail, 0 skip.
- Required checks: syntax and publication constraint checks passed; static frontend and worked example rebuilt; whitespace validation passed.
- Generated artifact: seven admits, four exclusions, one indeterminate; impact comparison suppressed at n=8 and n=4; C001 identified as never firing; 20 grants and 34 cents of applicant labor per grant dollar; RuleSpec hash unchanged at `sha256:dc6445c1587256bab9b2ded1ac80f4ddb75d6d39affd0446f3da402b3fc5b9df`.
- Fixtures are retained intentionally in `fixtures/starter-profiles.json` as the single source for the app and published example.
- Deployment and live verification status: not yet performed when this report was written.

This evidence establishes the PRD's bounded release gates. It does not establish that every possible grant rule, browser, or hostile input is defect-free.
