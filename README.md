# Foundation Grant Signal Lab

Foundation Grant Signal Lab is a live AI-assisted review tool for foundation staff. It helps a grantmaker turn an applicant, proposal, and foundation strategy into a first-pass decision memo with visible evidence, funder risks, diligence questions, and board-ready language.

Live site: [wayan.com/grant-signal-lab](https://wayan.com/grant-signal-lab/)

Live API: [foundation-grant-signal-lab-api.onrender.com](https://foundation-grant-signal-lab-api.onrender.com)

Full overview: [docs/foundation-grant-signal-lab-overview.md](docs/foundation-grant-signal-lab-overview.md)

## What It Does

The tool accepts three text blocks:

- Applicant context
- Proposal summary
- Foundation strategy, priorities, and risk posture

It returns:

- `Score`: A 0-100 first-pass signal for staff triage.
- `Route`: Hard judgment, Portfolio work, or Volume screening.
- `Verdict`: A short recommendation on whether the opportunity is ready, weak, or needs revision.
- `Board line`: Trustee-ready language that can be used in an internal memo.
- `Strongest evidence`: The visible facts that support the opportunity.
- `Funder risks`: The risks hidden under optimistic proposal language.
- `Next actions`: Diligence questions staff can send the same day.

The public site also includes a one-click stored sample review. The sample is deterministic, renders instantly, and does not call the API. It uses a credible rural health nonprofit with a weak AI proposal because that is where review judgment matters most.

## What It Does Not Do

This tool does not make a funding decision. It structures the first pass so a human can make and defend the call.

It does not score an applicant's mission or worthiness. It reads one proposal against one strategy and reports what the pasted evidence supports.

It does not replace a program officer's read of people, relationships, local context, trust, politics, or history.

It does not verify claims against outside sources. The current version reviews only what a user pastes. A high score means the argument is well evidenced as written, not that the facts have been independently checked.

It does not expose public saved-review history. Public review browsing is disabled by default to avoid turning a demo into a confidentiality incident.

## Why Foundation Staff Would Use It

Foundation staff are seeing more AI-polished proposals. Cleaner writing can make weak evidence harder to spot. This tool helps staff separate evidence from assertion, name the risks optimistic language covers, and send better diligence questions before a proposal reaches trustees.

Useful workflows include:

- Screening letters of inquiry
- Preparing a program officer's first read
- Comparing similar opportunities
- Drafting trustee memo language
- Finding weak sustainability claims
- Identifying vendor-dependence risks
- Surfacing patient, community, or equity concerns in AI proposals
- Turning a vague "promising but risky" reaction into specific diligence questions

## Architecture

- `frontend/`: Static HTML, CSS, and JavaScript for `wayan.com`
- `api/`: Express API deployed on Render
- `database/schema.sql`: Neon Postgres schema
- `scripts/build-static.mjs`: Static build script for the public upload folder
- `wayan-upload/grant-signal-lab/`: Generated files ready to upload to `wayan.com/grant-signal-lab/`
- `docs/foundation-grant-signal-lab-overview.md`: Longer explanation of the site and its benefits

## Local Setup

Install dependencies:

```bash
npm install
cp .env.example .env
```

Set the required values in `.env`:

```bash
OPENAI_API_KEY=...
DATABASE_URL=...
FRONTEND_ORIGIN=http://localhost:4173
```

Run the Neon schema:

```bash
npm run migrate
```

Start the API:

```bash
npm start
```

Build the static frontend:

```bash
PUBLIC_API_BASE_URL=http://localhost:10000 npm run build:frontend
```

Serve `frontend/` or `dist-static/` with any static file server.

## Configuration

Required environment variables:

```bash
OPENAI_API_KEY=
DATABASE_URL=
FRONTEND_ORIGIN=https://wayan.com,https://www.wayan.com
```

Recommended production defaults:

```bash
OPENAI_MODEL=gpt-5.6-terra
OPENAI_REASONING_EFFORT=medium
DATABASE_SSL=true
ENABLE_PUBLIC_HISTORY=false
REVIEW_RATE_LIMIT_MAX=8
REVIEW_RATE_LIMIT_WINDOW_MS=600000
```

`ENABLE_PUBLIC_HISTORY` should stay `false` for public demos. Set it to `true` only for a controlled internal deployment.

## Render Deployment

The included `render.yaml` defines a paid Starter web service:

- Runtime: Node
- Region: Oregon
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`

After deployment, verify:

```bash
curl https://foundation-grant-signal-lab-api.onrender.com/health
curl https://foundation-grant-signal-lab-api.onrender.com/api/meta
```

## Upload To Wayan.com

Build static files with the final Render API URL:

```bash
PUBLIC_API_BASE_URL=https://foundation-grant-signal-lab-api.onrender.com npm run build:frontend
```

Upload the contents of:

```text
wayan-upload/grant-signal-lab/
```

to:

```text
https://wayan.com/grant-signal-lab/
```

If the API URL changes, rerun `npm run build:frontend` with the new `PUBLIC_API_BASE_URL`.

## API

### `GET /health`

Returns service status, database status, and whether the OpenAI key is present.

### `GET /api/meta`

Returns tool metadata, model name, storage mode, and whether public history is enabled.

### `POST /api/reviews`

Creates and saves a grant review.

Request body:

```json
{
  "applicant": "Applicant background...",
  "proposal": "Proposal details...",
  "foundationStrategy": "Foundation goals and concerns..."
}
```

### `GET /api/reviews`

Disabled by default for visitor privacy. Set `ENABLE_PUBLIC_HISTORY=true` only for a controlled internal deployment.

### `GET /api/reviews/:id`

Disabled by default for visitor privacy. Set `ENABLE_PUBLIC_HISTORY=true` only for a controlled internal deployment.

## Verification

Core checks:

```bash
npm run check
npm run build:frontend
```

Recent live acceptance tests covered:

- Cold visitor state
- Stored sample review
- High-volume LOI triage
- Sensitive patient-AI judgment calls
- Prompt-injection resistance
- Mobile layout and privacy behavior

## License

No license is declared yet. Treat this repository as source-visible, not open-source licensed, until a license file is added.
