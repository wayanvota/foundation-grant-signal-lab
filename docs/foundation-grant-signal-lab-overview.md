# Foundation Grant Signal Lab v2 overview

## The decision

Should this foundation advance this proposal to real diligence?

Foundation Grant Signal Lab is for program officers reviewing incoming proposals. It separates polished proposal language from evidence that can be checked against public filings and the foundation's own stated criteria.

## The memo

The tool returns one recommendation from a fixed set, followed by a board line and four review blocks:

1. Proposal claims checked against named filing lines.
2. Financial diligence questions with the underlying inputs visible.
3. Fit and departure against quoted foundation criteria.
4. An internal review route and sourced next actions.

The memo always states that a divergence is a question, not a finding of fault. It also shows the filing tax year and lag beside the comparison.

## What remains human work

Program officers still have to verify current financials, understand relationships and local context, assess organizational leadership, review sensitive supporting documents, and decide whether to recommend funding. The tool cannot infer those facts from proposal text and public filing extracts.

## Consolidated behavior

The v2 review route and source discipline replace the grantmaker path previously housed in the seeker-side tool. The financial block incorporates the useful diligence questions from the standalone financial analyzer without carrying forward a context-free risk score.

No separate repository for the standalone financial analyzer appeared in the owner's full public repository listing on August 10, 2026, so there is no repository to archive. Retiring its public page and updating the portfolio remain publication actions outside this branch.

## Privacy

The API does not persist inputs or memo results. File parsing happens in memory for the current request. Public filing data is fetched by EIN and returned with source metadata.
