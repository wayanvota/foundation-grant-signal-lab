# Foundation Grant Signal Lab

Foundation Grant Signal Lab supports a program officer across an open call. The public product contains Call Design and Diligence Memo.

Call Design compiles draft eligibility prose into a readable `RuleSpec`, runs deterministic eligibility code against fictional or supplied candidate profiles, reports exclusion effects, generates self-screen questions, and projects reviewer and applicant burden. Diligence Memo reads a proposal against available Form 990 evidence and the foundation's stated strategy.

Intake Screen and Cohort Report remain outside the public interface until a live call can supply real submission and disposition data. The Method section states that boundary without presenting disabled controls.

Live site: [wayan.com/grant-signal-lab](https://wayan.com/grant-signal-lab/)

API data source: [ProPublica Nonprofit Explorer API](https://projects.propublica.org/nonprofits/api/)

## Decision boundary

Eligibility outcomes in Call Design come from `src/ruleSpec.js`. The model may compile prose into a structured specification, but no model participates in an `ADMIT`, `EXCLUDE`, or `INDETERMINATE` result. Each exclusion retains a reason code and deciding clause. Missing facts return `INDETERMINATE`; the evaluator never guesses.

The tool refuses to recommend an award, score or rank applicants by quality, assess community accountability or representation, predict funding probability, or compile language that cannot be stated as a testable fact.

The four recommendations are:

- `ADVANCE`
- `HOLD FOR DILIGENCE`
- `DECLINE`
- `NEEDS HUMAN CHECK`

These recommendations concern whether a proposal should enter real diligence. They are not grant-award decisions. The tool does not score, rank, or compare applicants.

Proposal-to-filing divergence is always phrased as a program officer's question. A current proposal may differ legitimately from a public filing that describes an older tax year.

## Call Design inputs and outputs

Inputs:

- Draft eligibility text, pasted or uploaded as TXT, Markdown, PDF, or DOCX
- Optional candidate profiles, entered manually or uploaded as CSV, up to 500 rows
- A saved RuleSpec or SessionBundle, with major-version checking and migration warnings
- Foundation-set grant pool, grant size, application volume, review-time, and labor-cost assumptions

Outputs:

- Versioned, hashed `RuleSpec`, including exact source sentences, uncompiled language, and suggested factual substitutes for human review
- Candidate exclusion report with reason codes and deciding clauses
- Clause-frequency table showing how many profiles each clause would independently exclude
- Rule Impact Report comparing filing-thin profiles with the rest of the candidate set
- Self-screen questions as JSON, plain text, and copy-ready HTML
- Funnel and burden projection with visible arithmetic
- Intake instrumentation plan
- Downloadable RuleSpec and session bundle; the server retains neither

The complete fictional [worked example](https://wayan.com/grant-signal-lab/worked-example.html) can be inspected without running the compiler. The artifact contract and migration behavior are documented in [`docs/SCHEMA.md`](docs/SCHEMA.md).

## Diligence inputs

- Applicant legal name
- EIN, required
- Filing relationship, including fiscal sponsorship, group returns, and Form 990-N
- Proposal text, pasted or uploaded as TXT, Markdown, PDF, or DOCX
- Foundation priorities, eligibility rules, and published criteria

## Evidence contract

Every displayed finding carries at least one visible source:

- an exact proposal quote
- a named filing line with tax year
- an exact foundation criterion quote

The filing layer uses the ProPublica organization endpoint through `src/irs990.js`. It preserves the source URL, filing tax year, tax period, and filing lag.

Financial signals expose their inputs. The operating-reserve measure is explicitly labeled a balance-sheet proxy because the API extract does not establish which net assets are liquid and unrestricted.

## Human-check conditions

Automated judgment stops when:

- a fiscal year change creates a short period
- source safeguards cannot produce reliable input
- the review engine times out
- structured output fails validation after one retry

Each condition returns `NEEDS HUMAN CHECK` with a reason and a concrete next step.

Normal filing-thin organizational forms now receive distinct review paths rather than a bare stop. Fiscal sponsorship uses the sponsor filing as context and requests project-level evidence. Group returns name the affiliate-level gap. Form 990-N establishes limited filing facts and produces small-filer document questions. Organizations under three years old or without a comparable return receive a strategy review plus a substitute-document list.

The ask-to-revenue review threshold is a visible foundation input. The memo prints the threshold used and states that the foundation set it.

## Safety and privacy

Proposal and strategy text are treated as untrusted data. Embedded model-control text is stripped once, the remainder is revalidated, and the review completes with judgment withheld for human inspection. Structured output is validated and retried once on the same provider.

The service is stateless. It does not create accounts, sessions, saved reviews, or a review database. Uploaded documents are held in memory only for the current request.

CI runs a repository-wide publication constraint check, syntax checks, tests, and the static build.

## Architecture

- `src/irs990.js`: EIN normalization, filing lookup, filing-lag metadata, and unusable-filing detection
- `src/filingAnalysis.js`: deterministic claim comparison and financial diligence questions
- `src/inputSafeguards.js`: injection detection, stripping, and revalidation
- `src/reviewPrompt.js`: prompt boundary for untrusted source material
- `src/reviewSchema.js`: structured memo and traceability validation
- `src/provider.js`: live review call, timeout, and same-provider schema retry
- `src/ruleCompiler.js`: constrained prose-to-RuleSpec compilation with quote validation
- `src/artifacts.js`: schema metadata, version inspection, report envelopes, and stable rule hashes
- `src/reasonCodes.js`: append-only shipped reason-code enum
- `src/ruleSpec.js`: deterministic evaluator, self-screen generator, impact report, starter profiles, and funnel arithmetic
- `api/callDesign.js`: stateless Mode 1 orchestration
- `api/review.js`: stateless orchestration and terminal human-check memos
- `api/proposalFile.js`: in-memory TXT, Markdown, PDF, and DOCX extraction
- `api/server.js`: Express API
- `frontend/`: public interface
- `test/`: acceptance and safety tests

## Local setup

```bash
npm install
cp .env.example .env
npm start
```

Build the static frontend:

```bash
PUBLIC_API_BASE_URL=http://localhost:10000 npm run build:frontend
```

## Verification

```bash
npm run check
npm test
npm run build:frontend
```

The current suite covers filing exceptions, claim comparison, financial input visibility, prompt injection handling, provider retries, fixture privacy, publication constraints, artifact migration, a byte-identical 20-run determinism gate, and 100-profile self-screen parity at boundaries and missing values.

The adversarial matrix adds source-quality stops, legal-name/EIN identity checks, Unicode and zero-width prompt obfuscation, role tags, encoded commands, prompt extraction, literal XSS and SQL strings, malformed and oversized requests, hostile origins, excessive multipart fields, unsupported uploads, multilingual proposals, complex claims, and explicit eligibility conflicts. Run deterministic coverage with `npm test` and paid end-to-end provider coverage with `npm run test:adversarial:live`.

## API

`GET /health` reports service readiness and the stateless storage policy.

`GET /api/meta` reports the decision, recommendation set, filing provider, and privacy posture.

`POST /api/reviews` accepts JSON or multipart form data and returns the memo directly. It does not create or save a review record.

## Release verification

The API and the public `wayan.com` frontend are separate deployment targets. Verify the stateless API metadata first, then publish `wayan-upload/grant-signal-lab/` to the Apache host and verify the public page independently.
