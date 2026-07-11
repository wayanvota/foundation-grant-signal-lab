const config = window.GRANT_SIGNAL_CONFIG || {};
const apiBaseUrl = (config.apiBaseUrl || "").replace(/\/$/, "");

const examples = {
  applicant:
    "SureStart AI Navigation is a two-year-old nonprofit affiliated with a commercial care-navigation software vendor. It has a small advisory board, one clinic pilot, and no published evaluation or audited financial statements yet.",
  proposal:
    "The applicant requests $850,000 over 24 months to deploy a proprietary AI referral chatbot across community clinics, train clinic staff, and publish a learning memo. The proposal says the tool will reduce missed referrals and improve access, but it does not include baseline data, model performance evidence, data-sharing terms, a vendor exit plan, or a named public-sector adoption partner.",
  foundationStrategy:
    "The foundation funds responsible AI for health equity when there is credible governance, local ownership, public benefit, and evidence that can influence public systems. Trustees worry about vendor lock-in, weak evaluation plans, and pilots that do not survive after grant funding.",
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
  setStatus("Loaded a deliberately weak sample. Running review now.", false);
  await runReview({ source: "sample" });
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
  fields.route.textContent = `${routeLabel(review.route)} · ${review.route} route · ${scoreBand(
    review.score,
  )}`;
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
