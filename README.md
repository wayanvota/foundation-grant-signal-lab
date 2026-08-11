# Foundation Grant Signal Lab

Foundation Grant Signal Lab helps a foundation program officer answer one screening question: should this proposal advance to real diligence?

The tool reads a proposal against the applicant's public Form 990 data and the foundation's stated strategy. It returns one traceable memo with a fixed recommendation, a board line, proposal-to-filing claim checks, financial diligence questions, strategy findings, an internal review route, and next actions.

Live site: [wayan.com/grant-signal-lab](https://wayan.com/grant-signal-lab/)

API data source: [ProPublica Nonprofit Explorer API](https://projects.propublica.org/nonprofits/api/)

## Decision boundary

The four recommendations are:

- `ADVANCE`
- `HOLD FOR DILIGENCE`
- `DECLINE`
- `NEEDS HUMAN CHECK`

These recommendations concern whether a proposal should enter real diligence. They are not grant-award decisions. The tool does not score, rank, or compare applicants.

Proposal-to-filing divergence is always phrased as a program officer's question. A current proposal may differ legitimately from a public filing that describes an older tax year.

## Inputs

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

- no filed return with extracted financial detail is available
- the applicant files Form 990-N
- a fiscal year change creates a short period
- the filing is a group return
- the applicant operates through a fiscal sponsor
- source safeguards cannot produce reliable input
- the review engine times out
- structured output fails validation after one retry

Each condition returns `NEEDS HUMAN CHECK` with a reason and a concrete next step.

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

The current suite covers filing exceptions, claim comparison, financial input visibility, prompt injection handling, provider retries, fixture privacy, and publication constraints.

The adversarial matrix adds source-quality stops, legal-name/EIN identity checks, Unicode and zero-width prompt obfuscation, role tags, encoded commands, prompt extraction, literal XSS and SQL strings, malformed and oversized requests, hostile origins, excessive multipart fields, unsupported uploads, multilingual proposals, complex claims, and explicit eligibility conflicts. Run deterministic coverage with `npm test` and paid end-to-end provider coverage with `npm run test:adversarial:live`.

## API

`GET /health` reports service readiness and the stateless storage policy.

`GET /api/meta` reports the decision, recommendation set, filing provider, and privacy posture.

`POST /api/reviews` accepts JSON or multipart form data and returns the memo directly. It does not create or save a review record.

## Release verification

The API and the public `wayan.com` frontend are separate deployment targets. Verify the stateless API metadata first, then publish `wayan-upload/grant-signal-lab/` to the Apache host and verify the public page independently.
