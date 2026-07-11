# Foundation Grant Signal Lab Overview

Foundation Grant Signal Lab is a live AI-assisted review tool for foundation staff who need a sharper first pass on grant opportunities before committing program officer, executive, or trustee time to full diligence.

The tool turns three inputs into a board-ready decision memo:

- Applicant context
- Proposal summary
- Foundation strategy, priorities, and risk posture

It returns a first-pass signal score, a review route, a board line, visible evidence, funder risks, and next actions. The point is not to automate grantmaking. The point is to make early review judgment visible, testable, and easier to defend.

## What The Site Does

The site gives foundation staff a practical way to pressure-test a grant idea against a funder's own strategy. A user can paste a short applicant profile, a proposal description, and the foundation's decision criteria. The review engine then produces:

- `Score`: A 0-100 first-pass signal for staff triage.
- `Route`: A plain-language review mode: Hard judgment, Portfolio work, or Volume screening.
- `Verdict`: A short recommendation on whether the opportunity is ready, weak, or needs revision.
- `Board line`: A sentence or paragraph that can be used in a trustee or executive memo.
- `Strongest evidence`: The visible facts that support the opportunity.
- `Funder risks`: The risks hidden under optimistic proposal language.
- `Next actions`: Diligence questions staff can send the same day.

The site also includes a one-click stored sample review. The sample uses Riverbend Community Health Partners, a credible rural health nonprofit with a weak AI proposal. It is deliberately scored at `41/100` because that is where judgment matters: the applicant is plausible, the need is real, and the proposal is not ready.

## What It Does Not Do

Foundation Grant Signal Lab does not make the funding decision. That belongs to accountable people.

It does not score an applicant's mission or worthiness. It reads one proposal against one strategy and reports what the evidence supports.

It does not replace a program officer's read of the people, relationships, local context, trust, politics, and history that never appear in a written proposal.

It does not verify claims against outside sources. The current version reviews only what the user pastes. A high score means the argument is well evidenced as written, not that the facts have been independently checked.

It does not expose public saved-review history. Public visitors cannot browse other users' review records.

## Why Foundation Staff Would Use It

Foundation staff are seeing more AI-polished proposals. Cleaner writing can make weak evidence harder to spot. The old signals in a proposal draft, how clearly a team thinks, where the gaps are, whether a claim is earned, are easier to blur when applicants use AI writing tools.

This tool helps restore signal on the funder side. It asks: What is actually visible? What is asserted but unsupported? What would trustees worry about? What diligence should staff send before inviting a full proposal?

For a program officer, the value is faster triage without surrendering judgment.

For a grants manager, the value is a more consistent first-pass review structure.

For an executive, the value is cleaner board language and earlier risk detection.

For trustees, the value is knowing that staff are not confusing polished proposal language with readiness.

## Core Functionality

### One-Click Sample Review

The sample review is stored in the frontend and renders instantly. It does not call the live API, so it is deterministic and reliable for visitors, screenshots, and launch posts.

The sample shows:

- A credible applicant
- A real strategic fit
- A weak technology implementation plan
- A vendor-dependence risk
- A sustainability claim without a budget
- Patient-facing AI risks in a Medicaid population
- Diligence questions that a foundation staffer could send immediately

The strongest sample question is: What would Riverbend build first if the grant were `$150,000` instead of `$450,000`? That question reveals whether the plan belongs to the applicant or the vendor.

### Live Review Form

The live review form accepts three text blocks:

- Applicant
- Proposal
- Foundation strategy

The public form includes input length caps and a confidentiality notice. It is intended for public, hypothetical, or non-confidential material.

### Review Routes

The tool uses three review routes:

- `Hard judgment`: For high-stakes, board-facing, contested, sensitive, or values-heavy decisions.
- `Portfolio work`: For ordinary staff workflows, comparisons, summaries, and diligence planning.
- `Volume screening`: For high-volume intake, eligibility review, missing-field checks, and triage.

The principle is simple: spend more intelligence where judgment matters and less where the work is repeatable.

### Privacy Guardrail

The public page does not show a saved-review history. The API also blocks public review-history browsing by default. That matters because public grant-review tools can become confidentiality traps if users paste real applicant information and the next visitor can read it.

### Cold-Start Handling

The site checks the live backend status and shows a waking state if the review engine takes time to respond. This avoids leaving visitors with an indefinite `Checking...` state.

### Rate Limiting

The API includes basic per-IP rate limiting so the public endpoint is not an unlimited free inference service.

## Benefits For Foundation Staff

### Better First-Pass Discipline

The tool forces a clean separation between evidence, risk, and next action. That is useful because early review often gets muddied by an applicant's reputation, a compelling need, or a polished proposal.

### Faster Diligence Questions

The output gives staff specific questions to send back. Instead of saying "please strengthen the sustainability plan," the tool asks for the budget, revenue source, baseline, cost calculation, vendor retention evidence, or escalation protocol that would make the plan credible.

### Stronger Board Communication

The board line compresses the staff judgment into a trustee-ready frame. It helps staff explain why a proposal should advance, pause, revise, or decline.

### More Consistent Review Across Staff

Different program officers may read proposals differently. The tool gives them a common structure for first-pass analysis while keeping final judgment human.

### Better AI Governance Posture

The site demonstrates responsible use of AI in grantmaking. It is explicit about what the tool will not do, blocks public history, warns against confidential inputs, and treats the score as a triage signal rather than a funding decision.

## Best Use Cases

Foundation Grant Signal Lab is strongest for:

- Screening letters of inquiry
- Preparing a program officer's first read
- Comparing several similar opportunities
- Drafting trustee memo language
- Finding weak sustainability claims
- Identifying vendor-dependence risks
- Surfacing patient, community, or equity concerns in AI proposals
- Turning a vague "promising but risky" reaction into concrete diligence questions

It is less appropriate for final grant decisions, confidential applicant data, legal review, audited financial analysis, or external fact-checking against 990s, public records, or evaluation reports.

## Current Limitations

The current version reviews only pasted text. It does not yet pull IRS Form 990s, annual reports, public websites, evaluation studies, prior grants, or news coverage.

It does not authenticate users or provide a private workspace. Public users should not paste confidential applicant information.

It saves generated reviews in the backend database for operating purposes, but public browsing of saved reviews is disabled.

It is best understood as a working proof of what a funder-side AI review layer should feel like: skeptical, structured, explicit about limits, and designed to help humans make better calls.
