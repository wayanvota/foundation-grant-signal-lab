const config = window.GRANT_SIGNAL_CONFIG || {};
const apiBaseUrl = (config.apiBaseUrl || "").replace(/\/$/, "");

const examples = {
  applicant:
    "Riverbend Community Health Partners is a 14-year-old nonprofit serving three counties in the rural Southeast, operating six community health clinics with a $9.2M annual budget and 84 staff. Roughly 60 percent of revenue comes from Medicaid reimbursement, the rest from state contracts and foundation grants. The organization has a stable leadership team, clean audits for the past five years, and a strong reputation with county health departments. It has no in-house technology staff. Its last major grant-funded technology project, a 2022 telehealth expansion, ended when the funding did.",
  proposal:
    "Riverbend requests $450,000 over 24 months to launch an AI-powered patient navigation assistant across its six clinics. The tool, built on a commercial large language model platform through a technology vendor, will answer patient questions, guide appointment scheduling, and reduce front-desk workload so staff can focus on complex cases. The proposal projects that the assistant will handle 70 percent of routine inquiries by month 12, improve patient satisfaction, and position Riverbend as a regional leader in equitable AI adoption. Year one covers vendor licensing, integration, and training. Year two covers expansion to Spanish-language support and a community advisory board. The proposal states that efficiency gains will allow the program to sustain itself after the grant period.",
  foundationStrategy:
    "We are a regional health foundation making $18M in annual grants, focused on access to care in underserved rural communities. Our board has approved a technology funding pillar but has asked staff to distinguish durable capability from pilot projects that disappear when our money does. We prioritize evidence of outcomes over adoption metrics, require a credible sustainability plan for anything above $250,000, and our trustees have raised concerns about AI tools handling patient communication in low-income communities. Risk posture: moderate. We will fund earlier-stage work when the learning is designed to be captured and shared.",
};

const sampleReview = {
  id: "riverbend-sample",
  score: 41,
  route: "Sol",
  routeDisplay:
    "Hard judgment. Board-facing decision, contested evidence, vulnerable population. This review should not be resolved at the screening tier.",
  verdict:
    "Do not invite a full proposal in current form. The applicant is credible; the proposal is not yet. Return with specific revision requests before a site visit.",
  boardLine:
    "Riverbend is a strong access-to-care operator with a weak technology track record asking us to fund a vendor-dependent AI pilot. The proposal measures adoption, not health outcomes, and its sustainability plan is an assertion, not a budget. Staff recommend a structured revision request rather than a decline: the underlying need is real and inside our strategy.",
  strongestEvidence: [
    "Fourteen years of stable operation and clean audits.",
    "Established trust with county health departments, which most technology pilots in this region lack.",
    "The request sits squarely inside the foundation's rural access strategy.",
    "Spanish-language expansion and a community advisory board show awareness of the equity concern, even if neither is yet designed.",
  ],
  funderRisks: [
    "The 70 percent inquiry-handling projection has no baseline behind it; current inquiry volume and staffing cost are never stated, so the efficiency claim cannot be checked.",
    '"Efficiency gains will sustain the program" is the same claim that preceded the 2022 telehealth project, which ended with its funding.',
    "The applicant has no technology staff, so the vendor owns the capability and the foundation would be funding a licensing relationship, not organizational capacity.",
    "Patient-facing AI in a Medicaid population raises the exact concern this board has already flagged, and the proposal offers no error-handling, escalation, or monitoring design.",
    "Success is defined by adoption and satisfaction, not by any health or access outcome the foundation's strategy names.",
  ],
  nextActions: [
    "Request current inquiry volume, front-desk staffing costs, and the calculation behind the 70 percent projection.",
    "Ask what happens to a patient when the assistant is wrong, and who reviews its answers.",
    "Require a sustainability budget with named revenue sources, not projected efficiencies.",
    "Ask the vendor's other nonprofit clients for retention data after grant funding ended.",
    "Ask what Riverbend would build first if the grant were $150,000 instead of $450,000; the answer will reveal whether this is their plan or the vendor's.",
  ],
};

const fields = {
  applicant: document.querySelector("#applicant"),
  proposal: document.querySelector("#proposal"),
  foundationStrategy: document.querySelector("#foundationStrategy"),
  form: document.querySelector("#review-form"),
  sampleButton: document.querySelector("#sample-button"),
  sampleInlineButton: document.querySelector("#sample-inline-button"),
  submitButton: document.querySelector("#submit-button"),
  status: document.querySelector("#form-status"),
  readiness: document.querySelector("#readiness"),
  apiStatus: document.querySelector("#api-status"),
  storageStatus: document.querySelector("#storage-status"),
  score: document.querySelector("#score"),
  route: document.querySelector("#route"),
  verdict: document.querySelector("#verdict"),
  boardLine: document.querySelector("#board-line"),
  evidence: document.querySelector("#strongest-evidence"),
  risks: document.querySelector("#funder-risks"),
  actions: document.querySelector("#next-actions"),
};

updateReadiness();
checkHealth();

fields.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runReview();
});

for (const button of [fields.sampleButton, fields.sampleInlineButton]) {
  button.addEventListener("click", loadSampleReview);
}

for (const field of [fields.applicant, fields.proposal, fields.foundationStrategy]) {
  field.addEventListener("input", updateReadiness);
}

async function loadSampleReview() {
  fields.applicant.value = examples.applicant;
  fields.proposal.value = examples.proposal;
  fields.foundationStrategy.value = examples.foundationStrategy;
  updateReadiness();
  renderReview(sampleReview);
  setStatus("Loaded stored sample review. No API call needed.", false);
  document.querySelector("#analysis").scrollIntoView({ behavior: "smooth" });
}

async function runReview({ source = "manual" } = {}) {
  if (!apiBaseUrl) {
    setStatus("Set apiBaseUrl in config.js before running reviews.", true);
    return;
  }

  fields.submitButton.disabled = true;
  fields.sampleButton.disabled = true;
  fields.sampleInlineButton.disabled = true;
  fields.submitButton.textContent = "Reviewing...";
  setStatus(
    source === "sample"
      ? "Running the sample through the live review API."
      : "Sending grant context to the live review API.",
    false,
  );

  try {
    const response = await fetch(`${apiBaseUrl}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicant: fields.applicant.value,
        proposal: fields.proposal.value,
        foundationStrategy: fields.foundationStrategy.value,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Review failed.");
    }

    renderReview(data);
    setStatus(`Saved review ${data.id}.`, false);
  } catch (error) {
    setStatus(error.message || "Review failed.", true);
  } finally {
    fields.submitButton.disabled = false;
    fields.sampleButton.disabled = false;
    fields.sampleInlineButton.disabled = false;
    fields.submitButton.textContent = "Run grant signal review";
  }
}

async function checkHealth() {
  if (!apiBaseUrl) {
    fields.apiStatus.textContent = "API URL missing";
    fields.storageStatus.textContent = "Config needed";
    return;
  }

  const controller = new AbortController();
  const wakingTimer = window.setTimeout(() => {
    fields.apiStatus.textContent = "Waking review engine";
    fields.storageStatus.textContent = "About 20 seconds";
  }, 1200);
  const timeout = window.setTimeout(() => controller.abort(), 22000);

  try {
    const response = await fetch(`${apiBaseUrl}/health`, { signal: controller.signal });
    const data = await response.json();
    fields.apiStatus.textContent = data.ok ? "Live" : "Needs setup";
    fields.storageStatus.textContent = data.database === "neon" ? "Neon connected" : data.database;
  } catch {
    fields.apiStatus.textContent = "Still waking";
    fields.storageStatus.textContent = "Try review in a moment";
  } finally {
    window.clearTimeout(wakingTimer);
    window.clearTimeout(timeout);
  }
}

function renderReview(review) {
  fields.score.textContent = Number(review.score).toFixed(0);
  fields.route.textContent =
    review.routeDisplay ||
    `${routeLabel(review.route)} · ${review.route} route · ${scoreBand(review.score)}`;
  fields.verdict.textContent = review.verdict;
  fields.boardLine.textContent = review.boardLine;
  renderList(fields.evidence, review.strongestEvidence);
  renderList(fields.risks, review.funderRisks || review.donorRisks);
  renderList(fields.actions, review.nextActions);
}

function renderList(element, items = []) {
  element.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    element.append(li);
  }
}

function updateReadiness() {
  const length = [
    fields.applicant.value,
    fields.proposal.value,
    fields.foundationStrategy.value,
  ].join(" ").length;

  fields.readiness.textContent =
    length > 700
      ? "Board-ready context"
      : length > 360
        ? "Enough for first-pass review"
        : "Needs more context";
}

function setStatus(message, isError) {
  fields.status.textContent = message;
  fields.status.classList.toggle("error", Boolean(isError));
}

function scoreBand(score) {
  const value = Number(score);
  if (value >= 82) return "High signal";
  if (value >= 68) return "Promising";
  if (value >= 50) return "Needs diligence";
  return "Weak fit";
}

function routeLabel(route) {
  if (route === "Sol") return "Hard judgment";
  if (route === "Terra") return "Portfolio work";
  if (route === "Luna") return "Volume screening";
  return "Review route";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
