"use client";

import { useMemo, useState } from "react";

type Analysis = {
  score: number;
  route: "Sol" | "Terra" | "Luna";
  verdict: string;
  boardLine: string;
  strongestEvidence: string[];
  donorRisks: string[];
  nextActions: string[];
  apiMode: "live" | "demo";
};

const examples = {
  applicant:
    "BrightStart Health Alliance is a 9-year-old nonprofit running community health worker programs in rural North Carolina and South Carolina.",
  proposal:
    "They are asking for $750,000 over 24 months to deploy AI-assisted case navigation for maternal health referrals, train 80 community health workers, and publish implementation evidence for Medicaid agencies.",
  foundation:
    "The foundation funds health equity, public benefit technology, and evidence that can influence public systems. Trustees worry about vendor lock-in, weak evaluation plans, and pilots that do not survive after grant funding.",
};

const fallbackAnalysis: Analysis = {
  score: 84,
  route: "Sol",
  verdict: "Invite full proposal with conditions",
  boardLine:
    "This is a plausible AI-for-public-benefit grant because the applicant ties the technology to a known service bottleneck, names a public systems audience, and has a training plan. The weak point is sustainability evidence.",
  strongestEvidence: [
    "Clear beneficiary pathway: community health workers, referral navigation, and maternal health outcomes are connected in one operational chain.",
    "Policy relevance is visible because the proposal commits to implementation evidence for Medicaid agencies.",
    "The ask size and 24-month window are large enough to test adoption, training, and cost evidence, not just produce a demo.",
  ],
  donorRisks: [
    "The proposal does not yet prove that the AI system reduces staff burden without increasing review work.",
    "Vendor dependence is unresolved unless the applicant can export data, prompts, and evaluation logic.",
    "Equity claims need subgroup reporting and a failure plan for low-connectivity or low-literacy contexts.",
  ],
  nextActions: [
    "Ask for a budget that separates software, training, evaluation, and ongoing operating costs.",
    "Require a data governance memo before approval, including consent, human review, and escalation rules.",
    "Fund a 90-day design grant first if the applicant cannot show baseline referral time, completion rates, and staff workload.",
  ],
  apiMode: "demo",
};

function scoreBand(score: number) {
  if (score >= 82) return "High signal";
  if (score >= 68) return "Promising";
  if (score >= 50) return "Needs diligence";
  return "Weak fit";
}

export default function Home() {
  const [applicant, setApplicant] = useState(examples.applicant);
  const [proposal, setProposal] = useState(examples.proposal);
  const [foundation, setFoundation] = useState(examples.foundation);
  const [analysis, setAnalysis] = useState<Analysis>(fallbackAnalysis);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const readiness = useMemo(() => {
    const length = `${applicant} ${proposal} ${foundation}`.length;
    if (length > 680) return "Board-ready context";
    if (length > 360) return "Enough for first-pass review";
    return "Needs more context";
  }, [applicant, proposal, foundation]);

  async function runAnalysis() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicant, proposal, foundation }),
      });

      if (!response.ok) {
        throw new Error("The analysis route did not return a usable result.");
      }

      const data = (await response.json()) as Analysis;
      setAnalysis(data);
    } catch (runError) {
      setAnalysis(fallbackAnalysis);
      setError(
        runError instanceof Error
          ? runError.message
          : "The live analysis failed, so the demo result is shown.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#111111]">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">F</span>
          <div>
            <p className="eyebrow">Foundation Grant Signal Lab</p>
            <p className="brand-subtitle">AI grants manager proof site</p>
          </div>
        </div>
        <nav className="nav-links" aria-label="Sections">
          <a href="#review">Review</a>
          <a href="#api">API design</a>
          <a href="#donor-proof">Donor proof</a>
        </nav>
      </header>

      <section className="hero-shell" id="review">
        <div className="hero-copy">
          <p className="eyebrow orange">Built with GPT-5.6 patterns</p>
          <h1>Turn a messy grant idea into a donor-ready judgment.</h1>
          <p className="lede">
            This proof site shows the tool I would build for a foundation:
            screen opportunities, surface risks, route work to Sol, Terra, or
            Luna, and produce a board-facing rationale that does not overclaim
            impact.
          </p>
        </div>

        <div className="status-strip" aria-label="Prototype status">
          <div>
            <span>Model route</span>
            <strong>Sol for judgment</strong>
          </div>
          <div>
            <span>Workflow</span>
            <strong>Screen to diligence</strong>
          </div>
          <div>
            <span>Evidence posture</span>
            <strong>Skeptical by default</strong>
          </div>
        </div>
      </section>

      <section className="workspace" aria-label="Grant review workspace">
        <form className="input-panel" onSubmit={(event) => event.preventDefault()}>
          <div className="panel-heading">
            <p className="eyebrow">Grant context</p>
            <span>{readiness}</span>
          </div>
          <label>
            Applicant
            <textarea
              value={applicant}
              onChange={(event) => setApplicant(event.target.value)}
              rows={5}
            />
          </label>
          <label>
            Proposal
            <textarea
              value={proposal}
              onChange={(event) => setProposal(event.target.value)}
              rows={7}
            />
          </label>
          <label>
            Foundation strategy
            <textarea
              value={foundation}
              onChange={(event) => setFoundation(event.target.value)}
              rows={6}
            />
          </label>
          <button type="button" onClick={runAnalysis} disabled={loading}>
            {loading ? "Reviewing..." : "Run grant signal review"}
          </button>
          {error ? <p className="route-note">{error}</p> : null}
        </form>

        <article className="analysis-panel">
          <div className="score-row">
            <div className="score-dial" aria-label={`Score ${analysis.score}`}>
              <span>{analysis.score}</span>
              <small>/100</small>
            </div>
            <div>
              <p className="eyebrow">Recommendation</p>
              <h2>{analysis.verdict}</h2>
              <p className="score-band">{scoreBand(analysis.score)}</p>
            </div>
          </div>

          <div className="board-line">
            <p className="eyebrow">Board line</p>
            <p>{analysis.boardLine}</p>
          </div>

          <div className="evidence-grid">
            <SignalList title="Strongest evidence" items={analysis.strongestEvidence} />
            <SignalList title="Donor risks" items={analysis.donorRisks} />
            <SignalList title="Next actions" items={analysis.nextActions} />
          </div>
        </article>
      </section>

      <section className="api-section" id="api">
        <div>
          <p className="eyebrow orange">New API fit</p>
          <h2>Why this would interest foundation donors</h2>
        </div>
        <div className="api-grid">
          <ApiCard
            title="Sol"
            label="Quality-first review"
            body="Use Sol for the hard judgment: fit, risk, diligence questions, and board language where a weak claim can damage trust."
          />
          <ApiCard
            title="Terra"
            label="Portfolio operations"
            body="Use Terra for everyday grant manager work: summarizing applications, comparing portfolios, drafting follow-up questions, and preparing meeting notes."
          />
          <ApiCard
            title="Luna"
            label="High-volume screening"
            body="Use Luna for well-defined triage: eligibility checks, missing-field detection, duplicate application flags, and routing queues."
          />
          <ApiCard
            title="Programmatic Tool Calling"
            label="Evidence-heavy workflows"
            body="Use bounded tool orchestration for repeatable checks: pull filings, normalize grants, rank gaps, and return compact signals."
          />
          <ApiCard
            title="Multi-agent"
            label="Parallel diligence"
            body="Split review into program fit, financial risk, evaluation quality, and public-interest risk, then synthesize the result."
          />
          <ApiCard
            title="Persisted reasoning"
            label="Long-horizon grants"
            body="Carry stable foundation priorities across grant cycles so the tool remembers strategy without restating the whole operating model."
          />
        </div>
      </section>

      <section className="proof-section" id="donor-proof">
        <div className="proof-copy">
          <p className="eyebrow">What this proves</p>
          <h2>Donors do not need another chatbot. They need a judgment system.</h2>
          <p>
            The compelling product is not automated grantmaking. It is a
            defensible operating layer that separates evidence from optimism,
            flags risk before trustees ask, and turns messy intake into decisions
            a foundation can stand behind.
          </p>
        </div>
        <div className="proof-meter">
          <div>
            <span>Live API route</span>
            <strong>{analysis.apiMode === "live" ? "Enabled" : "Demo fallback"}</strong>
          </div>
          <div>
            <span>Current OpenAI pattern</span>
            <strong>Responses API</strong>
          </div>
          <div>
            <span>Builder signal</span>
            <strong>Usable, critical, donor-aware</strong>
          </div>
        </div>
      </section>

      <footer>
        <p>
          Source framing: GPT-5.6 model guide and OpenAI web search guide.
          Built as a proof for foundation AI grants work.
        </p>
        <div>
          <a href="https://developers.openai.com/api/docs/guides/latest-model.md">
            Latest model guide
          </a>
          <a href="https://developers.openai.com/api/docs/guides/tools-web-search.md">
            Web search guide
          </a>
        </div>
      </footer>
    </main>
  );
}

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="signal-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ApiCard({
  title,
  label,
  body,
}: {
  title: string;
  label: string;
  body: string;
}) {
  return (
    <article className="api-card">
      <span>{title}</span>
      <h3>{label}</h3>
      <p>{body}</p>
    </article>
  );
}
