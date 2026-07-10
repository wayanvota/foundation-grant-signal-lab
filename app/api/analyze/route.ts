import { NextResponse } from "next/server";

type RequestBody = {
  applicant?: string;
  proposal?: string;
  foundation?: string;
};

const demoResult = {
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(demoResult);
  }

  const prompt = [
    "You are reviewing a grant opportunity for a foundation donor.",
    "Be skeptical, evidence-dependent, and concise. Do not invent facts.",
    "Return only valid JSON with these keys:",
    "score number 0-100, route one of Sol Terra Luna, verdict string, boardLine string, strongestEvidence string array, donorRisks string array, nextActions string array.",
    "",
    `Applicant: ${body.applicant ?? ""}`,
    `Proposal: ${body.proposal ?? ""}`,
    `Foundation strategy: ${body.foundation ?? ""}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.6-terra",
      reasoning: { effort: "medium" },
      input: prompt,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(demoResult);
  }

  const result = (await response.json()) as { output_text?: string };
  const parsed = parseJson(result.output_text);

  if (!parsed) {
    return NextResponse.json(demoResult);
  }

  return NextResponse.json({
    ...demoResult,
    ...parsed,
    apiMode: "live",
  });
}

function parseJson(text?: string) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
