const config = window.GRANT_SIGNAL_CONFIG || {};
const apiBaseUrl = (config.apiBaseUrl || "").replace(/\/$/, "");
let latestDesign = null;
let uploadedRuleArtifact = null;

const byId = (id) => document.querySelector(`#${id}`);
const fields = new Proxy({}, { get: (_target, key) => byId(String(key)) });

const sampleMemo = {
  recommendation: "HOLD FOR DILIGENCE",
  recommendationReason: "The proposal fits the stated program area, but its current scale and financial assumptions need reconciliation with the latest filing before full diligence.",
  boardLine: "The proposal addresses the foundation’s stated youth learning priority, while the claimed operating scale is materially above the latest filed revenue and requires current financial evidence before the request advances.",
  filingSource: { taxYear: 2024, filingLagYears: 2, sourceUrl: "", provider: "Public filing sample" },
  humanReviewBoundary: "This fictional memo demonstrates a first pass. It does not make a funding decision. Proposal-to-filing divergence is a diligence question, not a finding of fault. Staff must verify current facts, context, relationships, and source gaps before acting.",
  askToRevenueThreshold: { value: 0.25, setBy: "foundation input" },
  claimChecks: [
    { status: "contradicted", claim: "The organization operates on an annual budget of $4.8 million.", proposalQuote: "Our current annual operating budget is $4.8 million.", filingLine: "Total revenue", filingValue: 2960000, taxYear: 2024, filingLagYears: 2, question: "What explains why the proposal figure of $4.8 million is materially above the 2024 total revenue of $2.96 million?" },
    { status: "not_checkable", claim: "The program reaches families in five counties.", proposalQuote: "The program now reaches families in five counties.", filingLine: null, filingValue: null, taxYear: 2024, filingLagYears: 2, question: "What current evidence would substantiate this reach claim? The available filing does not contain a corresponding line." },
  ],
  financialSignals: [{ signal: "Revenue concentration", taxYear: 2024, inputs: [{ filingLine: "Contributions and grants", value: 2210000 }, { filingLine: "Total revenue", value: 2960000 }], question: "Contributions and grants represent about 75% of reported total revenue. How exposed is the applicant to a change in that source?" }],
  strategyFindings: [{ status: "aligned", finding: "The proposed work addresses the stated program priority.", criterionQuote: "We support evidence-based youth learning programs in rural counties.", proposalQuote: "We will expand evidence-based tutoring for rural middle-school students.", diligenceQuestion: "Which outcome evidence is comparable across the proposed counties?" }],
  reviewRoute: { route: "ELIGIBILITY CHECK", why: "Program fit is visible, but a mandatory sustainability criterion remains unresolved.", sources: [{ sourceType: "foundation_criterion", sourceQuote: "Requests above $300,000 require a documented two-year sustainability plan." }] },
  nextActions: [{ question: "Request current year-to-date financials and the board-approved operating budget.", basis: "The proposal’s budget claim diverges from the latest filed total revenue.", source: { sourceType: "filing", sourceQuote: "2024 Total revenue" } }],
  safeguard: { status: "passed", strippedSpanCount: 0 },
};

for (const tab of document.querySelectorAll("[data-mode]")) tab.addEventListener("click", () => switchMode(tab.dataset.mode));
fields["call-design-form"].addEventListener("submit", runCallDesign);
fields["starter-profiles-button"].addEventListener("click", loadStarterProfiles);
fields["add-profile-button"].addEventListener("click", () => addProfileRow({}));
fields["profiles-csv"].addEventListener("change", importProfilesCsv);
fields["rule-text"].addEventListener("input", () => { if (fields["rule-text"].value.trim()) clearUploadedRuleArtifact(); updateDesignReadiness(); });
fields["rule-file"].addEventListener("change", () => { if (fields["rule-file"].files.length) clearUploadedRuleArtifact(); updateDesignReadiness(); });
fields["rule-spec-file"].addEventListener("change", importRuleArtifact);
fields["download-rulespec"].addEventListener("click", () => latestDesign && downloadJson("foundation-rule-spec.json", latestDesign.ruleSpec));
fields["download-bundle"].addEventListener("click", () => latestDesign && downloadJson("foundation-signal-lab-session.json", latestDesign.sessionBundle));
fields["download-self-screen"].addEventListener("click", () => latestDesign && downloadJson("foundation-self-screen.json", latestDesign.selfScreen));
fields["download-exclusion-report"].addEventListener("click", () => latestDesign && downloadJson("foundation-exclusion-report.json", latestDesign.exclusionReport));
fields["download-impact-report"].addEventListener("click", () => latestDesign && downloadJson("foundation-rule-impact-report.json", latestDesign.exclusionReport.impactReport));
fields["download-funnel-report"].addEventListener("click", () => latestDesign && downloadJson("foundation-funnel-projection.json", latestDesign.funnelProjection));
fields["download-self-screen-text"].addEventListener("click", () => latestDesign && downloadText("foundation-self-screen.txt", `${latestDesign.selfScreen.plainText}\n\n---\n${artifactFooter(latestDesign.selfScreen)}\n`));
fields["copy-self-screen"].addEventListener("click", async () => { if (!latestDesign) return; await navigator.clipboard.writeText(latestDesign.selfScreen.plainText); setDesignStatus("Self-screen questions copied."); });

fields["review-form"].addEventListener("submit", runReview);
fields["filing-context"].addEventListener("change", updateFilingContext);
for (const id of ["applicant-name", "ein", "proposal", "foundation-strategy"]) fields[id].addEventListener("input", updateReadiness);
fields["proposal-file"].addEventListener("change", updateReadiness);
fields["sample-inline-button"].addEventListener("click", () => { renderMemo(sampleMemo); setStatus("Opened a fictional stored fixture. No applicant data was submitted."); });

updateFilingContext();
updateReadiness();
updateDesignReadiness();
warmBackend();

function switchMode(mode) {
  fields["call-design-mode"].hidden = mode !== "call-design";
  fields["diligence-mode"].hidden = mode !== "diligence";
  for (const tab of document.querySelectorAll("[data-mode]")) {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  }
}

async function runCallDesign(event) {
  event.preventDefault();
  if (!apiBaseUrl) return setDesignStatus("The analysis service is not configured.", true);
  const hasRule = fields["rule-text"].value.trim().length >= 20 || fields["rule-file"].files.length || uploadedRuleArtifact;
  if (!hasRule) return setDesignStatus("Paste or upload a draft rule first.", true);
  setDesignRunning(true);
  try {
    const form = new FormData();
    form.set("ruleText", fields["rule-text"].value);
    if (fields["rule-file"].files.length) form.set("ruleFile", fields["rule-file"].files[0]);
    if (uploadedRuleArtifact) form.set("ruleArtifact", JSON.stringify(uploadedRuleArtifact));
    form.set("candidateProfiles", JSON.stringify(readProfileRows()));
    form.set("funnel", JSON.stringify(readFunnelInputs()));
    const response = await fetch(`${apiBaseUrl}/api/call-designs`, { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The draft rule could not be compiled.");
    latestDesign = data;
    renderCallDesign(data);
    setDesignStatus("Call design complete. Download the RuleSpec or session bundle before leaving.");
  } catch (error) { setDesignStatus(error.message || "The call design could not be completed.", true); }
  finally { setDesignRunning(false); }
}

function renderCallDesign(result) {
  fields["design-empty"].hidden = true;
  fields["design-results"].hidden = false;
  fields["rule-name"].textContent = result.ruleSpec.name;
  fields["design-method"].textContent = result.method;
  fields["migration-notice"].hidden = !result.migrationNotice;
  fields["migration-notice"].textContent = result.migrationNotice || "";
  fields["candidate-set-label"].textContent = result.candidateSetSource === "fictional_starter_set" ? "12 fictional profiles" : `${result.exclusionReport.results.length} supplied profiles`;

  clear(fields["compiled-clauses"]);
  for (const clause of result.ruleSpec.clauses) {
    const card = element("article", "evidence-card");
    card.append(tag(clause.mandatory ? "mandatory" : "preference", `status-tag ${clause.mandatory ? "departure" : "unclear"}`), textElement("h3", `${clause.id} · ${clause.fact.replaceAll("_", " ")}`));
    card.append(sourceBlock("Draft rule", clause.sourceSentence));
    card.append(textElement("p", `${clause.fact} ${clause.operator} ${formatRuleValue(clause.value)}`, "rule-expression"));
    card.append(textElement("p", `Failure code: ${clause.reasonCode}`, "question"));
    fields["compiled-clauses"].append(card);
  }

  clear(fields["uncompiled-language"]);
  if (!result.ruleSpec.uncompiledLanguage.length) appendEmpty(fields["uncompiled-language"], "No uncompiled language was returned.");
  for (const item of result.ruleSpec.uncompiledLanguage) {
    const card = element("article", "evidence-card uncompiled-card");
    card.append(sourceBlock("Draft rule", item.sourceSentence), textElement("p", item.reason, "question"), textElement("p", `Possible testable substitute: ${item.suggestion}`, "question"));
    fields["uncompiled-language"].append(card);
  }

  clear(fields["exclusion-report"]);
  for (const item of result.exclusionReport.results) {
    const row = document.createElement("tr");
    row.append(textElement("td", item.profile.organizationName), tableTag(item.outcome.status), textElement("td", item.outcome.reasonCode || ""), textElement("td", item.outcome.decidingClauseId || "All mandatory clauses passed"));
    fields["exclusion-report"].append(row);
  }

  clear(fields["clause-frequency"]);
  for (const item of result.exclusionReport.clauseFrequency) {
    const row = document.createElement("tr");
    row.append(textElement("td", item.clauseId), textElement("td", formatNumber(item.excluded)), textElement("td", formatNumber(item.indeterminate)), textElement("td", item.sourceSentence));
    fields["clause-frequency"].append(row);
  }
  clear(fields["clause-frequency-findings"]);
  for (const item of result.exclusionReport.clauseFrequencyFindings || []) fields["clause-frequency-findings"].append(infoCard(item.clauseId, item.message));

  const impact = result.exclusionReport.impactReport;
  if (impact.computed) {
    renderMetrics(fields["impact-metrics"], [
      [`Filing-thin exclusion rate (n=${impact.filingThin.count})`, formatPercent(impact.filingThin.exclusionRate)],
      [`Other profiles (n=${impact.other.count})`, formatPercent(impact.other.exclusionRate)],
      ["Difference", `${formatNumber(impact.differentialPercentagePoints)} percentage points`],
    ]);
  } else {
    clear(fields["impact-metrics"]);
    appendEmpty(fields["impact-metrics"], impact.message);
  }
  clear(fields["impact-drivers"]);
  if (!impact.clauseDrivers.length) appendEmpty(fields["impact-drivers"], "No clause excluded a candidate in this set.");
  if (impact.attribution) fields["impact-drivers"].append(infoCard("Largest observed gap", impact.attribution));
  for (const item of impact.clauseDrivers) {
    const counts = `Filing-thin: ${item.filingThinExcluded} of ${impact.filingThin.count}. Other: ${item.otherExcluded} of ${impact.other.count}.`;
    const difference = impact.computed ? ` Difference: ${formatNumber(item.differentialPercentagePoints)} percentage points.` : "";
    fields["impact-drivers"].append(infoCard(`${item.clauseId} · ${item.fact.replaceAll("_", " ")}`, `${counts}${difference} ${item.sourceSentence}`));
  }

  fields["self-screen-text"].value = result.selfScreen.plainText;
  fields["self-screen-html"].textContent = result.selfScreen.html;
  const funnel = result.funnelProjection.outputs;
  renderMetrics(fields["funnel-metrics"], [
    ["Grants available", formatNumber(funnel.grantsAvailable)], ["Projected applications", formatNumber(result.funnelProjection.inputs.expectedApplications)],
    ["Admitted for advanced review", formatNumber(funnel.admittedCount)], ["First-read hours", formatNumber(funnel.firstReadHours)],
    ["Advanced-review hours", formatNumber(funnel.advancedReviewHours)], ["Reviewer hours", formatNumber(funnel.reviewerHours)], ["Reviewer cost", formatCurrency(funnel.reviewerCost)],
    ["Applicant hours", formatNumber(funnel.applicantHours)], ["Applicant cost", formatCurrency(funnel.applicantCost)],
    ["Applicant labor per $1 granted", `${formatNumber(funnel.applicantCostCentsPerDollarGranted)} cents`],
  ]);
  clear(fields["funnel-arithmetic"]);
  for (const line of result.funnelProjection.arithmetic) fields["funnel-arithmetic"].append(textElement("li", line));
  clear(fields["instrumentation-plan"]);
  for (const item of result.instrumentationPlan) fields["instrumentation-plan"].append(infoCard(item.field, item.purpose));
  fields["artifact-footer"].textContent = artifactFooter(result.exclusionReport);
  fields["design-results"].scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadStarterProfiles() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/starter-profiles`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Starter profiles could not be loaded.");
    fields["profile-list"].replaceChildren();
    for (const profile of data.profiles) addProfileRow(profile);
    setDesignStatus("Loaded 12 fictional profiles.");
  } catch (error) { setDesignStatus(error.message, true); }
}

async function importProfilesCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("The CSV needs a header row and at least one profile.");
    const headers = rows[0].map(normalizeHeader);
    const profiles = rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
    if (profiles.length > 500) throw new Error(`The CSV contains ${profiles.length} profiles. The maximum is 500.`);
    fields["profile-list"].replaceChildren();
    for (const profile of profiles) addProfileRow({
      organizationName: profile.organizationname || profile.name,
      ein: profile.ein,
      filingRelationship: profile.filingrelationship,
      annualBudget: profile.annualbudget,
      yearsOperating: profile.yearsoperating,
      geography: profile.geography,
      issueArea: profile.issuearea,
      orgType: profile.orgtype,
      description: profile.description,
    });
    setDesignStatus(`Loaded ${profiles.length} profile${profiles.length === 1 ? "" : "s"} from CSV.`);
  } catch (error) { setDesignStatus(error.message || "The CSV could not be read.", true); }
  event.target.value = "";
}

async function importRuleArtifact(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    uploadedRuleArtifact = JSON.parse(await file.text());
    fields["rule-text"].value = "";
    fields["rule-file"].value = "";
    updateDesignReadiness();
    setDesignStatus(`Loaded ${file.name}. Version compatibility will be checked before any rule fields are used.`);
  } catch {
    uploadedRuleArtifact = null;
    setDesignStatus("The uploaded artifact is not valid JSON.", true);
  }
}

function clearUploadedRuleArtifact() {
  uploadedRuleArtifact = null;
  fields["rule-spec-file"].value = "";
}

function addProfileRow(profile) {
  const row = element("article", "profile-row");
  const fieldsForRow = [
    ["organizationName", "Organization name", "text"], ["filingRelationship", "Filing relationship", "text"], ["annualBudget", "Annual budget", "number"],
    ["yearsOperating", "Years operating", "number"], ["geography", "Geography", "text"], ["issueArea", "Issue area", "text"], ["orgType", "Organization type", "text"],
  ];
  for (const [name, label, type] of fieldsForRow) {
    const wrapper = element("label");
    wrapper.append(document.createTextNode(label));
    const input = document.createElement("input"); input.dataset.profileField = name; input.type = type; input.value = profile[name] ?? ""; if (type === "number") { input.min = "0"; input.step = "any"; }
    wrapper.append(input); row.append(wrapper);
  }
  const remove = textElement("button", "Remove", "button ghost compact remove-profile"); remove.type = "button"; remove.addEventListener("click", () => row.remove()); row.append(remove);
  fields["profile-list"].append(row);
}

function readProfileRows() {
  return [...fields["profile-list"].children].map((row) => {
    const profile = { ein: "", description: "" };
    for (const input of row.querySelectorAll("[data-profile-field]")) profile[input.dataset.profileField] = input.type === "number" && input.value !== "" ? Number(input.value) : input.value.trim();
    return profile;
  }).filter((profile) => profile.organizationName);
}

function readFunnelInputs() {
  return {
    totalPool: Number(fields["total-pool"].value), grantSize: Number(fields["grant-size"].value), expectedApplications: Number(fields["expected-applications"].value),
    minutesPerFirstRead: Number(fields["minutes-first-read"].value), advancedReviewHours: Number(fields["advanced-review-hours"].value), expectedAdmitRate: Number(fields["expected-admit-rate"].value) / 100, loadedHourlyCost: Number(fields["loaded-hourly-cost"].value),
    applicantHoursPerApplication: Number(fields["applicant-hours"].value), applicantHourlyValue: Number(fields["applicant-hourly-value"].value),
  };
}

async function runReview(event) {
  event.preventDefault();
  if (!apiBaseUrl) return setStatus("The review service is not configured.", true);
  setReviewRunning(true);
  try {
    const formData = new FormData(fields["review-form"]);
    if (!fields["proposal-file"].files.length) formData.delete("proposalFile");
    const response = await fetch(`${apiBaseUrl}/api/reviews`, { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The review could not be completed.");
    renderMemo(data); setStatus("Memo complete. Inputs and results were not saved.");
  } catch (error) { setStatus(error.message || "The review could not be completed.", true); }
  finally { setReviewRunning(false); }
}

function renderMemo(memo) {
  fields["empty-state"].hidden = true; fields["memo-content"].hidden = false;
  fields.recommendation.textContent = memo.recommendation; fields["recommendation-reason"].textContent = memo.recommendationReason; fields["board-line"].textContent = memo.boardLine; fields["human-boundary"].textContent = memo.humanReviewBoundary;
  fields["threshold-used"].textContent = memo.askToRevenueThreshold ? `Ask-to-revenue threshold used: ${formatPercent(memo.askToRevenueThreshold.value)}. Set by ${memo.askToRevenueThreshold.setBy}.` : "";
  fields["filing-badge"].textContent = memo.filingSource?.taxYear ? `Filing year ${memo.filingSource.taxYear} · ${memo.filingSource.filingLagYears}-year lag` : "Filing evidence unavailable";
  renderClaimChecks(memo.claimChecks || []); renderFinancialSignals(memo.financialSignals || []); renderStrategyFindings(memo.strategyFindings || []);
  fields["review-route"].textContent = memo.reviewRoute?.route || "Human review"; fields["review-route-why"].textContent = memo.reviewRoute?.why || memo.recommendationReason; renderSources(fields["route-sources"], memo.reviewRoute?.sources || []); renderActions(memo.nextActions || []);
  const triggered = memo.safeguard?.status === "human_check_required"; fields["safeguard-notice"].hidden = !triggered; fields["safeguard-copy"].textContent = triggered ? `${memo.safeguard.strippedSpanCount} embedded model-control span${memo.safeguard.strippedSpanCount === 1 ? " was" : "s were"} removed. Inspect the source before relying on this memo.` : "";
}

function renderClaimChecks(items) { clear(fields["claim-checks"]); if (!items.length) return appendEmpty(fields["claim-checks"], "No claim comparison is available for this result."); for (const item of items) { const card = element("article", "evidence-card"); card.append(tag(item.status.replace("_", " "), `status-tag ${item.status}`), textElement("h3", item.claim), sourceBlock("Proposal", item.proposalQuote)); if (item.filingLine) card.append(sourceBlock(`Form 990 · ${item.taxYear} · ${item.filingLine}`, formatValue(item.filingValue))); card.append(textElement("p", `${item.question}${item.filingLagYears === null || item.filingLagYears === undefined ? "" : ` Filing lag: ${item.filingLagYears} year${item.filingLagYears === 1 ? "" : "s"}.`}`, "question")); fields["claim-checks"].append(card); } }
function renderFinancialSignals(items) { clear(fields["financial-signals"]); if (!items.length) return appendEmpty(fields["financial-signals"], "No filing-derived financial calculation is available for this review path."); for (const item of items) { const card = element("article", "evidence-card"); card.append(textElement("p", item.taxYear ? `Tax year ${item.taxYear}` : "Review path", "eyebrow"), textElement("h3", item.signal)); const inputs = element("div", "input-chips"); for (const input of item.inputs || []) inputs.append(tag(`${input.filingLine}: ${formatValue(input.value)}`, "input-chip")); if (inputs.childElementCount) card.append(inputs); card.append(textElement("p", item.question, "question")); fields["financial-signals"].append(card); } }
function renderStrategyFindings(items) { clear(fields["strategy-findings"]); if (!items.length) return appendEmpty(fields["strategy-findings"], "Strategy findings were withheld for this result."); for (const item of items) { const card = element("article", "evidence-card"); card.append(tag(item.status, `status-tag ${item.status}`), textElement("h3", item.finding), sourceBlock("Foundation criterion", item.criterionQuote)); if (item.proposalQuote) card.append(sourceBlock("Proposal", item.proposalQuote)); card.append(textElement("p", item.diligenceQuestion, "question")); fields["strategy-findings"].append(card); } }
function renderActions(items) { clear(fields["next-actions"]); for (const item of items) { const row = element("li"); row.append(textElement("strong", item.question), textElement("p", item.basis)); if (item.source) row.append(sourceBlock(sourceLabel(item.source.sourceType), item.source.sourceQuote)); fields["next-actions"].append(row); } }
function renderSources(container, sources) { clear(container); for (const source of sources) container.append(sourceBlock(sourceLabel(source.sourceType), source.sourceQuote)); }

function updateFilingContext() { const sponsored = fields["filing-context"].value === "fiscal_sponsor"; fields["sponsor-field"].hidden = !sponsored; fields["fiscal-sponsor-name"].required = sponsored; }
function updateReadiness() { const complete = fields["applicant-name"].value.trim().length > 1 && /^\d{2}-?\d{7}$/.test(fields.ein.value.trim()) && (fields.proposal.value.trim().length >= 80 || fields["proposal-file"].files.length) && fields["foundation-strategy"].value.trim().length >= 80; fields.readiness.textContent = complete ? "Ready for filing check" : "Needs source material"; }
function updateDesignReadiness() { const complete = fields["rule-text"].value.trim().length >= 20 || fields["rule-file"].files.length || uploadedRuleArtifact; fields["design-readiness"].textContent = complete ? (uploadedRuleArtifact ? "Ready to load" : "Ready to compile") : "Needs a draft rule"; }
function setDesignRunning(running) { fields["compile-button"].disabled = running; fields["compile-button"].textContent = running ? "Compiling and testing…" : "Compile and test this call"; fields["design-progress"].hidden = !running; }
function setReviewRunning(running) { fields["submit-button"].disabled = running; fields["sample-inline-button"].disabled = running; fields["submit-button"].textContent = running ? "Generating memo…" : "Generate diligence memo"; fields["review-progress"].hidden = !running; }
function setDesignStatus(message, error = false) { fields["design-status"].textContent = message; fields["design-status"].classList.toggle("error", error); }
function setStatus(message, error = false) { fields["form-status"].textContent = message; fields["form-status"].classList.toggle("error", error); }

function parseCsv(text) { const rows = []; let row = [], cell = "", quoted = false; for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i += 1; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += char; } if (cell || row.length) { row.push(cell); rows.push(row); } return rows; }
function normalizeHeader(value) { return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, ""); }
function downloadJson(filename, value) { const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
function downloadText(filename, value) { const blob = new Blob([value], { type: "text/plain;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
function artifactFooter(value) { const footer = value.footer || value; return `Rule hash: ${footer.rule_hash} | Schema: ${footer.schema_version} | Run: ${footer.generated_at} | Generator: ${footer.generator_version}`; }
function renderMetrics(container, metrics) { clear(container); for (const [label, value] of metrics) { const card = element("article", "metric-card"); card.append(textElement("small", label), textElement("strong", value)); container.append(card); } }
function infoCard(title, body) { const card = element("article", "evidence-card"); card.append(textElement("h3", title), textElement("p", body)); return card; }
function tableTag(value) { const cell = document.createElement("td"); cell.append(tag(value, `status-tag ${value.toLowerCase()}`)); return cell; }
function clear(node) { node.replaceChildren(); }
function element(name, className = "") { const node = document.createElement(name); if (className) node.className = className; return node; }
function textElement(name, text, className = "") { const node = element(name, className); node.textContent = text ?? ""; return node; }
function tag(text, className) { return textElement("span", text, className); }
function sourceBlock(label, quote) { const node = element("div", "source-block"); node.append(textElement("span", label), textElement("q", quote)); return node; }
function appendEmpty(node, text) { node.append(textElement("p", text, "empty-copy")); }
function sourceLabel(value) { return value === "foundation_criterion" ? "Foundation criterion" : value === "filing" ? "Filing" : "Proposal"; }
function formatValue(value) { return typeof value === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value) : String(value ?? "Not available"); }
function formatRuleValue(value) { return Array.isArray(value) ? value.join(", ") : formatValue(value); }
function formatNumber(value) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value); }
function formatCurrency(value, digits = 0) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(value); }
function formatPercent(value) { return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value); }

async function warmBackend(attempt = 0) { if (!apiBaseUrl) return; try { await fetch(`${apiBaseUrl}/health`); } catch { if (attempt < 2) window.setTimeout(() => warmBackend(attempt + 1), 3500); } }
