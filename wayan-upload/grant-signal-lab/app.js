const config = window.GRANT_SIGNAL_CONFIG || {};
const apiBaseUrl = (config.apiBaseUrl || "").replace(/\/$/, "");

const fields = Object.fromEntries([
  "review-form", "applicant-name", "ein", "filing-context", "sponsor-field", "fiscal-sponsor-name",
  "proposal", "proposal-file", "foundation-strategy", "submit-button", "sample-button", "sample-inline-button",
  "form-status", "review-progress", "progress-label", "readiness", "empty-state", "memo-content",
  "recommendation", "recommendation-reason", "filing-badge", "board-line", "human-boundary", "claim-checks",
  "financial-signals", "strategy-findings", "review-route", "review-route-why", "route-sources", "next-actions",
  "safeguard-notice", "safeguard-copy",
].map((id) => [id, document.querySelector(`#${id}`)]));

const sampleMemo = {
  recommendation: "HOLD FOR DILIGENCE",
  recommendationReason: "The proposal fits the stated program area, but its current scale and financial assumptions need reconciliation with the latest filing before full diligence.",
  boardLine: "The proposal addresses the foundation’s stated youth learning priority, while the claimed operating scale is materially above the latest filed revenue and requires current financial evidence before the request advances.",
  filingSource: { taxYear: 2024, filingLagYears: 2, sourceUrl: "", provider: "Public filing sample" },
  humanReviewBoundary: "This fictional memo demonstrates a first pass. It does not make a funding decision. Proposal-to-filing divergence is a diligence question, not a finding of fault. Staff must verify current facts, context, relationships, and source gaps before acting.",
  claimChecks: [
    { status: "contradicted", claim: "The organization operates on an annual budget of $4.8 million.", proposalQuote: "Our current annual operating budget is $4.8 million.", filingLine: "Total revenue", filingValue: 2960000, taxYear: 2024, filingLagYears: 2, question: "What explains why the proposal figure of $4.8 million is materially above the 2024 total revenue of $2.96 million?" },
    { status: "not_checkable", claim: "The program reaches families in five counties.", proposalQuote: "The program now reaches families in five counties.", filingLine: null, filingValue: null, taxYear: 2024, filingLagYears: 2, question: "What current evidence would substantiate this reach claim? The available filing does not contain a corresponding line." },
  ],
  financialSignals: [
    { signal: "Revenue concentration", taxYear: 2024, inputs: [{ filingLine: "Contributions and grants", value: 2210000 }, { filingLine: "Total revenue", value: 2960000 }], question: "Contributions and grants represent about 75% of reported total revenue. How exposed is the applicant to a change in that source?" },
    { signal: "Balance-sheet reserve proxy", taxYear: 2024, inputs: [{ filingLine: "Total assets, end of year", value: 950000 }, { filingLine: "Total liabilities, end of year", value: 280000 }, { filingLine: "Total functional expenses", value: 2840000 }], question: "Net assets equal about 2.8 months of annual expenses. What portion was liquid and available for operations?" },
  ],
  strategyFindings: [
    { status: "aligned", finding: "The proposed work addresses the stated program priority.", criterionQuote: "We support evidence-based youth learning programs in rural counties.", proposalQuote: "We will expand evidence-based tutoring for rural middle-school students.", diligenceQuestion: "Which outcome evidence is comparable across the proposed counties?" },
    { status: "unclear", finding: "The proposal does not establish the required plan for sustaining requests above the threshold.", criterionQuote: "Requests above $300,000 require a documented two-year sustainability plan.", proposalQuote: "", diligenceQuestion: "Where is the required two-year sustainability plan and who owns each future revenue commitment?" },
  ],
  reviewRoute: { route: "ELIGIBILITY CHECK", why: "Program fit is visible, but a mandatory sustainability criterion remains unresolved.", sources: [{ sourceType: "foundation_criterion", sourceQuote: "Requests above $300,000 require a documented two-year sustainability plan." }] },
  nextActions: [
    { question: "Request current year-to-date financials and the board-approved operating budget.", basis: "The proposal’s budget claim diverges from the latest filed total revenue.", source: { sourceType: "filing", sourceQuote: "2024 Total revenue" } },
    { question: "Obtain the required two-year sustainability plan.", basis: "A mandatory foundation criterion is not evidenced in the proposal.", source: { sourceType: "foundation_criterion", sourceQuote: "Requests above $300,000 require a documented two-year sustainability plan." } },
  ],
  safeguard: { status: "passed", strippedSpanCount: 0 },
};

fields["review-form"].addEventListener("submit", runReview);
fields["filing-context"].addEventListener("change", updateFilingContext);
for (const id of ["applicant-name", "ein", "proposal", "foundation-strategy"]) fields[id].addEventListener("input", updateReadiness);
fields["proposal-file"].addEventListener("change", updateReadiness);
for (const id of ["sample-button", "sample-inline-button"]) fields[id].addEventListener("click", showSample);
updateFilingContext();
updateReadiness();
warmBackend();

async function runReview(event) {
  event.preventDefault();
  if (!apiBaseUrl) return setStatus("The review service is not configured.", true);
  setRunning(true);
  const timer = window.setTimeout(() => setProgress("Still working. The filing and source checks may take a minute."), 9000);
  try {
    const formData = new FormData(fields["review-form"]);
    if (!fields["proposal-file"].files.length) formData.delete("proposalFile");
    const response = await fetch(`${apiBaseUrl}/api/reviews`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The review could not be completed.");
    renderMemo(data);
    setStatus("Memo complete. Inputs and results were not saved.", false);
  } catch (error) {
    setStatus(error.message || "The review could not be completed.", true);
  } finally {
    clearTimeout(timer);
    setRunning(false);
  }
}

function showSample() {
  renderMemo(sampleMemo);
  setStatus("Opened a fictional stored fixture. No applicant data was submitted.", false);
  fields["memo-content"].scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderMemo(memo) {
  fields["empty-state"].hidden = true;
  fields["memo-content"].hidden = false;
  fields.recommendation.textContent = memo.recommendation;
  fields["recommendation-reason"].textContent = memo.recommendationReason;
  fields["board-line"].textContent = memo.boardLine;
  fields["human-boundary"].textContent = memo.humanReviewBoundary;
  fields["filing-badge"].textContent = memo.filingSource?.taxYear
    ? `Filing year ${memo.filingSource.taxYear} · ${memo.filingSource.filingLagYears}-year lag`
    : "Filing evidence unavailable";
  renderClaimChecks(memo.claimChecks || []);
  renderFinancialSignals(memo.financialSignals || []);
  renderStrategyFindings(memo.strategyFindings || []);
  fields["review-route"].textContent = memo.reviewRoute?.route || "Human review";
  fields["review-route-why"].textContent = memo.reviewRoute?.why || memo.recommendationReason;
  renderSources(fields["route-sources"], memo.reviewRoute?.sources || []);
  renderActions(memo.nextActions || []);
  const triggered = memo.safeguard?.status === "human_check_required";
  fields["safeguard-notice"].hidden = !triggered;
  fields["safeguard-copy"].textContent = triggered ? `${memo.safeguard.strippedSpanCount} embedded model-control span${memo.safeguard.strippedSpanCount === 1 ? " was" : "s were"} removed. Inspect the source before relying on this memo.` : "";
}

function renderClaimChecks(items) {
  clear(fields["claim-checks"]);
  if (!items.length) return appendEmpty(fields["claim-checks"], "No claim comparison is available for this human-check result.");
  for (const item of items) {
    const card = element("article", "evidence-card");
    card.append(tag(item.status.replace("_", " "), `status-tag ${item.status}`));
    card.append(textElement("h3", item.claim));
    card.append(sourceBlock("Proposal", item.proposalQuote));
    if (item.filingLine) card.append(sourceBlock(`Form 990 · ${item.taxYear} · ${item.filingLine}`, formatValue(item.filingValue)));
    card.append(textElement("p", `${item.question} Filing lag: ${item.filingLagYears} year${item.filingLagYears === 1 ? "" : "s"}.`, "question"));
    fields["claim-checks"].append(card);
  }
}

function renderFinancialSignals(items) {
  clear(fields["financial-signals"]);
  if (!items.length) return appendEmpty(fields["financial-signals"], "Financial ratios were withheld for this human-check result.");
  for (const item of items) {
    const card = element("article", "evidence-card");
    card.append(textElement("p", `Tax year ${item.taxYear}`, "eyebrow"), textElement("h3", item.signal));
    const inputs = element("div", "input-chips");
    for (const input of item.inputs || []) inputs.append(tag(`${input.filingLine}: ${formatValue(input.value)}`, "input-chip"));
    if (inputs.childElementCount) card.append(inputs);
    card.append(textElement("p", item.question, "question"));
    fields["financial-signals"].append(card);
  }
}

function renderStrategyFindings(items) {
  clear(fields["strategy-findings"]);
  if (!items.length) return appendEmpty(fields["strategy-findings"], "Strategy fit was withheld for this human-check result.");
  for (const item of items) {
    const card = element("article", "evidence-card");
    card.append(tag(item.status, `status-tag ${item.status}`), textElement("h3", item.finding));
    card.append(sourceBlock("Foundation criterion", item.criterionQuote));
    if (item.proposalQuote) card.append(sourceBlock("Proposal", item.proposalQuote));
    card.append(textElement("p", item.diligenceQuestion, "question"));
    fields["strategy-findings"].append(card);
  }
}

function renderActions(items) {
  clear(fields["next-actions"]);
  for (const item of items) {
    const li = element("li");
    li.append(textElement("strong", item.question), textElement("p", item.basis));
    if (item.source) li.append(sourceBlock(sourceLabel(item.source.sourceType), item.source.sourceQuote));
    fields["next-actions"].append(li);
  }
}

function renderSources(container, sources) {
  clear(container);
  for (const source of sources) container.append(sourceBlock(sourceLabel(source.sourceType), source.sourceQuote));
}

function updateFilingContext() {
  const sponsored = fields["filing-context"].value === "fiscal_sponsor";
  fields["sponsor-field"].hidden = !sponsored;
  fields["fiscal-sponsor-name"].required = sponsored;
}

function updateReadiness() {
  const complete = fields["applicant-name"].value.trim().length > 1
    && /^\d{2}-?\d{7}$/.test(fields.ein.value.trim())
    && (fields.proposal.value.trim().length >= 80 || fields["proposal-file"].files.length > 0)
    && fields["foundation-strategy"].value.trim().length >= 80;
  fields.readiness.textContent = complete ? "Ready for filing check" : "Needs source material";
}

function setRunning(running) {
  fields["submit-button"].disabled = running;
  fields["sample-button"].disabled = running;
  fields["sample-inline-button"].disabled = running;
  fields["submit-button"].textContent = running ? "Generating memo…" : "Generate diligence memo";
  fields["review-progress"].hidden = !running;
  if (running) setProgress("Checking the filing and source text.");
}

function setProgress(message) { fields["progress-label"].textContent = message; }
function setStatus(message, error) { fields["form-status"].textContent = message; fields["form-status"].classList.toggle("error", Boolean(error)); }
function clear(node) { node.replaceChildren(); }
function element(name, className = "") { const node = document.createElement(name); if (className) node.className = className; return node; }
function textElement(name, text, className = "") { const node = element(name, className); node.textContent = text || ""; return node; }
function tag(text, className) { return textElement("span", text, className); }
function sourceBlock(label, quote) { const node = element("div", "source-block"); node.append(textElement("span", label), textElement("q", quote)); return node; }
function appendEmpty(node, text) { node.append(textElement("p", text, "empty-copy")); }
function sourceLabel(value) { return value === "foundation_criterion" ? "Foundation criterion" : value === "filing" ? "Filing" : "Proposal"; }
function formatValue(value) { return typeof value === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value) : String(value ?? "Not available"); }

async function warmBackend(attempt = 0) {
  if (!apiBaseUrl) return;
  try { await fetch(`${apiBaseUrl}/health`); } catch { if (attempt < 2) window.setTimeout(() => warmBackend(attempt + 1), 3500); }
}
