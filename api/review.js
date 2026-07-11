import { z } from "zod";

export const reviewInputSchema = z.object({
  applicant: z.string().trim().min(20).max(5000),
  proposal: z.string().trim().min(20).max(7000),
  foundationStrategy: z.string().trim().min(20).max(5000),
});

const reviewOutputSchema = z.object({
  claim: z.string().min(20).optional().nullable(),
  score: z.number().min(0).max(100),
  route: z.enum(["Sol", "Terra", "Luna"]),
  verdict: z.string().min(5),
  boardLine: z.string().min(20),
  strongestEvidence: z.array(z.string()).min(3).max(5),
  donorRisks: z.array(z.string()).min(3).max(5),
  nextActions: z.array(z.string()).min(3).max(5),
});

export async function generateGrantReview(input) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for live grant review.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.6-terra";
  const prompt = buildPrompt(input);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "medium" },
      text: {
        format: {
          type: "json_schema",
          name: "grant_review",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "claim",
              "score",
              "route",
              "verdict",
              "boardLine",
              "strongestEvidence",
              "donorRisks",
              "nextActions",
            ],
            properties: {
              claim: { type: "string" },
              score: { type: "number", minimum: 0, maximum: 100 },
              route: { type: "string", enum: ["Sol", "Terra", "Luna"] },
              verdict: { type: "string" },
              boardLine: { type: "string" },
              strongestEvidence: {
                type: "array",
                minItems: 3,
                maxItems: 5,
                items: { type: "string" },
              },
              donorRisks: {
                type: "array",
                minItems: 3,
                maxItems: 5,
                items: { type: "string" },
              },
              nextActions: {
                type: "array",
                minItems: 3,
                maxItems: 5,
                items: { type: "string" },
              },
            },
          },
        },
      },
      input: prompt,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI review failed: ${response.status} ${detail.slice(0, 280)}`);
  }

  const result = await response.json();
  const parsed = parseOutputText(extractOutputText(result));
  const review = reviewOutputSchema.parse(parsed);

  return {
    ...review,
    modelUsed: model,
    raw: result,
  };
}

function buildPrompt(input) {
  return [
    "You are a foundation AI grants manager reviewing an opportunity for C-level foundation leaders.",
    "Your job is to help a funder decide what to do next, not to sell the applicant.",
    "Be skeptical, specific, and evidence-dependent.",
    "Separate visible evidence from claims that still need diligence.",
    "Do not invent facts, funders, outcomes, budgets, audits, 990 details, or citations.",
    "Use Sol as the route when the decision is judgment-heavy, Terra for normal portfolio operations, and Luna for high-volume screening.",
    'Begin with "claim": one sentence restating the proposal in this form: what change, for whom, by when, for how much. Use only what the proposal states. Do not evaluate, praise, or criticize in this sentence. Plain declarative prose. Do not use em dashes.',
    "Make the boardLine usable in a trustee memo.",
    "",
    "<applicant>",
    input.applicant,
    "</applicant>",
    "",
    "<proposal>",
    input.proposal,
    "</proposal>",
    "",
    "<foundation_strategy>",
    input.foundationStrategy,
    "</foundation_strategy>",
  ].join("\n");
}

function parseOutputText(text) {
  if (!text) {
    throw new Error("OpenAI response did not include output_text.");
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("OpenAI response did not include parseable JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function extractOutputText(result) {
  if (result.output_text) {
    return result.output_text;
  }

  const textParts = [];
  for (const item of result.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join("\n").trim();
}
