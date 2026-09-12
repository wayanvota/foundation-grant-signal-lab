# Foundation Grant Signal Lab end-to-end test report

## Scope

The browser harness serves the production static interface and sends requests
through the real Express routes. Call Design uses the production RuleSpec
validator, evaluator, exclusion report, self-screen generator, impact report,
and funnel arithmetic. Only model compilation and public-filing retrieval are
replaced by deterministic synthetic fixtures.

No live credential is required or read by the deterministic suite or GitHub
Actions. The repository's existing paid provider matrix remains separate and
opt-in.

## Required categories

| ID | Category | Expected behavior |
| --- | --- | --- |
| U01 | Public purpose and privacy | Decision boundary and stateless posture are visible |
| U02 | Mode navigation | Call Design and Diligence Memo switch correctly |
| U03 | Starter profiles | Exactly 12 fictional profiles load through the API |
| U04 | Manual profiles | Candidate rows can be added and removed |
| U05 | Rule readiness | Readiness requires sufficient source language |
| U06 | Deterministic evaluation | Prose compiles and 12 profiles receive inspectable outcomes |
| U07 | Call-design outputs | Exclusions, self-screen, funnel math, and rule hash render |
| U08 | Rule-file upload | Supported text file drives the stateless design flow |
| U09 | Fictional sample | Stored sample opens without submitting applicant data |
| U10 | Diligence workflow | Complete submission returns traceable findings and sources |
| A01 | Missing rule | Trivial Call Design request is rejected |
| A02 | Malformed structured field | Invalid candidate JSON is rejected |
| A03 | Oversized JSON | Body above 120 KB is rejected |
| A04 | Hostile origin | Disallowed origin is denied before route handling |
| A05 | Excessive multipart fields | Multipart field and part caps fail closed |
| A06 | Unsupported upload | Executable proposal upload is rejected |
| A07 | Invalid EIN | Schema rejects malformed applicant identity |
| A08 | Prompt injection | Embedded model-control text yields `NEEDS HUMAN CHECK` |
| A09 | Route abuse | Unknown route, method, and encoded traversal return 404 |
| A10 | Rate abuse | Repeated review attempts reach the bounded request limit |

## Verification record

Status: passed locally on 2026-09-11 with Node 22.16.0.

- Existing deterministic tests: 92 passed
- New deterministic E2E categories: 20 passed, exactly U01-U10 and A01-A10
- Syntax, publication constraint, and static build checks: passed
- High-severity dependency audit: 0 vulnerabilities at all severities
- Optional paid provider smoke using the authorized local `github` key:
  `simple-aligned` passed in one provider attempt

The first E2E run found and reproduced a production integration defect: the
Diligence Memo form submits seven text fields, while the Express multipart
limit allowed only six. The API now allows the form's seven fields and one
optional file, while the regression suite confirms that an eighth field is
still rejected.

```bash
npm ci
npx playwright install chromium
npm run test:ci
npm audit --audit-level=high
```

Optional one-case provider smoke, using only an authorized local key:

```bash
ADVERSARIAL_CASES=simple-aligned npm run test:adversarial:live
```
