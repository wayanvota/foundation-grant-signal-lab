const config = window.GRANT_SIGNAL_CONFIG || {};
const apiBaseUrl = (config.apiBaseUrl || "").replace(/\/$/, "");

const examples = {
  applicant:
    "BrightStart Health Alliance is a 9-year-old nonprofit running community health worker programs in rural North Carolina and South Carolina.",
  proposal:
    "They are asking for $750,000 over 24 months to deploy AI-assisted case navigation for maternal health referrals, train 80 community health workers, and publish implementation evidence for Medicaid agencies.",
  foundationStrategy:
    "The foundation funds health equity, public benefit technology, and evidence that can influence public systems. Trustees worry about vendor lock-in, weak evaluation plans, and pilots that do not survive after grant funding.",
};

const fields = {
  applicant: document.querySelector("#applicant"),
  proposal: document.querySelector("#proposal"),
  foundationStrategy: document.querySelector("#foundationStrategy"),
  form: document.querySelector("#review-form"),
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
  risks: document.querySelector("#donor-risks"),
  actions: document.querySelector("#next-actions"),
  history: document.querySelector("#history-list"),
  loadHistoryButton: document.querySelector("#load-history-button"),
};

fields.applicant.value = examples.applicant;
fields.proposal.value = examples.proposal;
fields.foundationStrategy.value = examples.foundationStrategy;

updateReadiness();
checkHealth();

fields.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runReview();
});

fields.loadHistoryButton.addEventListener("click", loadHistory);

for (const field of [fields.applicant, fields.proposal, fields.foundationStrategy]) {
  field.addEventListener("input", updateReadiness);
}

async function runReview() {
  if (!apiBaseUrl) {
    setStatus("Set apiBaseUrl in config.js before running reviews.", true);
    return;
  }

  fields.submitButton.disabled = true;
  fields.submitButton.textContent = "Reviewing...";
  setStatus("Sending grant context to the live review API.", false);

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
    await loadHistory();
  } catch (error) {
    setStatus(error.message || "Review failed.", true);
  } finally {
    fields.submitButton.disabled = false;
    fields.submitButton.textContent = "Run grant signal review";
  }
}

async function checkHealth() {
  if (!apiBaseUrl) {
    fields.apiStatus.textContent = "API URL missing";
    fields.storageStatus.textContent = "Config needed";
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/health`);
    const data = await response.json();
    fields.apiStatus.textContent = data.ok ? "Live" : "Needs setup";
    fields.storageStatus.textContent = data.database === "neon" ? "Neon connected" : data.database;
  } catch {
    fields.apiStatus.textContent = "Unavailable";
    fields.storageStatus.textContent = "Check Render";
  }
}

async function loadHistory() {
  if (!apiBaseUrl) return;

  fields.history.innerHTML = '<p class="status-message">Loading saved reviews...</p>';

  try {
    const response = await fetch(`${apiBaseUrl}/api/reviews?limit=12`);
    const reviews = await response.json();
    fields.history.innerHTML = "";

    if (!reviews.length) {
      fields.history.innerHTML = '<p class="status-message">No saved reviews yet.</p>';
      return;
    }

    for (const review of reviews) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "history-card";
      item.innerHTML = `
        <span>${new Date(review.createdAt).toLocaleString()}</span>
        <strong>${escapeHtml(review.verdict)}</strong>
        <small>${Number(review.score).toFixed(0)}/100 · ${escapeHtml(review.route)}</small>
        <p>${escapeHtml(review.boardLine)}</p>
      `;
      item.addEventListener("click", () => fetchReview(review.id));
      fields.history.append(item);
    }
  } catch {
    fields.history.innerHTML =
      '<p class="status-message error">Could not load saved reviews.</p>';
  }
}

async function fetchReview(id) {
  const response = await fetch(`${apiBaseUrl}/api/reviews/${id}`);
  const review = await response.json();
  renderReview(review);
  document.querySelector("#analysis").scrollIntoView({ behavior: "smooth" });
}

function renderReview(review) {
  fields.score.textContent = Number(review.score).toFixed(0);
  fields.route.textContent = `${review.route} route · ${scoreBand(review.score)}`;
  fields.verdict.textContent = review.verdict;
  fields.boardLine.textContent = review.boardLine;
  renderList(fields.evidence, review.strongestEvidence);
  renderList(fields.risks, review.donorRisks);
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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
