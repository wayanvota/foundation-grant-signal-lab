# Foundation Grant Signal Lab: a practical AI grants manager for foundation donors

Foundation Grant Signal Lab is a working prototype of the kind of AI tool I think foundations actually need: not a chatbot that flatters every proposal, but a grants-management layer that makes judgment visible.

The tool takes three inputs:

- the applicant
- the proposal
- the foundation strategy

It returns a saved review with a grant signal score, a recommended model route, a board-ready recommendation line, the strongest visible evidence, donor risks, and next diligence actions. The review is saved to a Neon Postgres database through a Render-hosted API, while the frontend is static HTML/CSS/JavaScript that can run on Wayan.com.

## What the tool does

Foundation Grant Signal Lab is built for the early review moment when a funder has enough information to form a first judgment, but not enough information to pretend the decision is settled.

The user pastes in:

1. Applicant context: who the organization is, what it does, and what is known.
2. Proposal context: what the applicant wants funded, over what time horizon, and for what outcome.
3. Foundation strategy: the donor’s goals, constraints, risk posture, and board concerns.

The API sends that context to OpenAI and asks for a structured review. The output is intentionally constrained. It does not ask the model to write a glowing summary. It asks for evidence, risks, and next actions.

Each review includes:

- Score: a 0-100 signal score for first-pass grant fit.
- Route: whether this is a Sol, Terra, or Luna type of workflow.
- Verdict: a plain recommendation such as “invite full proposal with conditions.”
- Board line: a short paragraph a grants manager could adapt for a trustee memo.
- Strongest evidence: the best visible reasons to keep reviewing.
- Donor risks: the issues a serious funder should not ignore.
- Next actions: specific diligence questions or review steps.

## Why this is different from a generic grants chatbot

Most AI demos in philanthropy stop at summarization. That is useful, but it is not enough. Foundation leaders do not only need shorter applications. They need better judgment under uncertainty.

The hard part of grantmaking is not describing the applicant. The hard part is deciding what the evidence supports, what the applicant has not proved, what risks are being hidden by optimistic language, and what due diligence should happen before trustees are asked to approve funding.

That is why this tool is framed as a grant signal lab. It does not make the grant decision. It makes the decision surface inspectable.

## Why foundation donors should care

Foundation donors are being asked to fund AI pilots, capacity-building projects, evaluation tools, public-benefit technology, and nonprofit AI adoption. Many of these proposals will sound plausible. Some will be useful. Some will be expensive theater.

The donor problem is not a lack of enthusiasm. The donor problem is separating credible public-benefit use from vendor narrative, vague efficiency claims, and pilots that will disappear when grant funding ends.

Foundation Grant Signal Lab helps by forcing a review into a disciplined structure:

- What is the claim?
- What evidence is visible?
- What would make the claim stronger?
- What risk would trustees ask about?
- What should staff request next?
- Is this a high-judgment case or a routine screening case?

That structure matters because AI grantmaking will punish funders who confuse adoption with impact. A nonprofit using AI is not automatically producing public value. A foundation funding AI is not automatically funding innovation. The work has to be tied to outcomes, costs, governance, equity, and sustainability.

## How the OpenAI model routing works

The tool uses a simple version of the GPT-5.6 Sol, Terra, and Luna framing:

- Sol is for judgment-heavy reviews where the stakes are high, evidence is contested, or the output may shape a board decision.
- Terra is for everyday production workflows such as summarizing applications, comparing grant opportunities, drafting diligence questions, and preparing staff notes.
- Luna is for high-volume screening such as eligibility checks, missing-field detection, duplicates, and routing.

That model-routing layer is not decoration. It is a product discipline. Not every grant task deserves the same model cost or latency. A grants platform should spend more intelligence where judgment matters and less where the task is constrained and repeatable.

## Current implementation

The current version has three parts:

- Static frontend: uploadable files for Wayan.com.
- Render API: an Express service with health, metadata, review creation, and review history endpoints.
- Neon database: a Postgres table that stores grant reviews and creates a lightweight decision record.

The important API endpoints are:

- `GET /health`
- `GET /api/meta`
- `POST /api/reviews`
- `GET /api/reviews`
- `GET /api/reviews/:id`

The frontend is deliberately simple. It can be hosted as static files and pointed at any compatible API URL through `config.js`.

## What this proves about me as a builder

This tool is meant to demonstrate a specific kind of AI grants leadership. I am not trying to show that I can make a flashy demo. I am trying to show that I can build tools foundation staff could actually use.

The builder signal is:

- I understand donor incentives and board scrutiny.
- I do not treat AI adoption as impact.
- I can turn a foundation workflow into a working product.
- I can separate frontend distribution, backend hosting, and database persistence.
- I can design an AI system that is skeptical by default.
- I can make the output useful to both grants staff and decision-makers.

That is the role I want: not just writing about AI and philanthropy, but building the operating tools foundations need to fund AI responsibly.

## Next improvements

The next version should add:

- source-attached review packets
- 990 and audited financial upload
- applicant website and public-source checks
- multi-reviewer notes
- board packet export
- risk taxonomy by foundation strategy
- portfolio-level comparison
- evaluation plan scoring

The larger opportunity is a foundation AI grants workbench: intake, triage, diligence, decision memos, portfolio learning, and post-grant evidence tracking.

Foundation donors need AI tools that make them harder to fool. That is the bar this project is built toward.
