# Foundation Grant Signal Lab

Foundation Grant Signal Lab is a live AI-assisted grant screening tool for
foundation donors. It turns an applicant, proposal, and foundation strategy into
a saved review with:

- grant signal score
- recommended model route: Sol, Terra, or Luna
- board-ready recommendation line
- strongest visible evidence
- donor risks
- next diligence actions

The tool is intentionally skeptical. It is designed to help a grants manager
separate evidence from optimism, not to automate funding decisions.

## Architecture

- `frontend/`: static HTML, CSS, and JavaScript for upload to `wayan.com`
- `api/`: Express API for Render
- `database/schema.sql`: Neon Postgres schema
- `render.yaml`: Render blueprint
- `wayan-upload/grant-signal-lab/`: generated static files ready to upload
- `docs/site-writeup.md`: publication-seed writeup

## Local Setup

```bash
npm install
cp .env.example .env
```

Set these values in `.env`:

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

## Render Deployment

1. Create a Neon database and run `database/schema.sql`.
2. Create a Render web service from this repository.
3. Use the included `render.yaml` blueprint or set:
   - build command: `npm install`
   - start command: `npm start`
   - health check path: `/health`
4. Add environment variables:
   - `OPENAI_API_KEY`
   - `DATABASE_URL`
   - `FRONTEND_ORIGIN=https://wayan.com,https://www.wayan.com`
   - `OPENAI_MODEL=gpt-5.6-terra`
   - `OPENAI_REASONING_EFFORT=medium`

After deployment, check:

```bash
curl https://foundation-grant-signal-lab-api.onrender.com/health
curl https://foundation-grant-signal-lab-api.onrender.com/api/meta
```

## Upload to wayan.com

Build static files with the final Render API URL:

```bash
PUBLIC_API_BASE_URL=https://foundation-grant-signal-lab-api.onrender.com npm run build:frontend
```

Upload the contents of:

```text
wayan-upload/grant-signal-lab/
```

to the desired public path, for example:

```text
https://wayan.com/grant-signal-lab/
```

If the Render service URL changes, edit `config.js` in the upload folder or
rerun `npm run build:frontend` with the new `PUBLIC_API_BASE_URL`.

## API

### `GET /health`

Returns service status, database status, and whether the OpenAI key is present.

### `GET /api/meta`

Returns tool metadata.

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

Returns recent saved reviews.

### `GET /api/reviews/:id`

Returns one saved review.

## Why This Exists

Foundation AI grants need more than enthusiasm. They need structured judgment:
what evidence is visible, what still needs diligence, what risk trustees will
ask about, and what next action is defensible. This tool is a small operating
layer for that workflow.
