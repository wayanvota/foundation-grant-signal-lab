import { modelReviewJsonSchema, modelReviewSchema, assertTraceability } from "./reviewSchema.js";
import { buildReviewPrompt, systemPrompt } from "./reviewPrompt.js";

export async function runValidatedReview({
  input,
  filingSummary,
  fetchImpl = fetch,
  timeoutMs = Number.parseInt(process.env.REVIEW_TIMEOUT_MS || "120000", 10),
}) {
  const deadline = Date.now() + timeoutMs;
  let validationError;
  let attempts = 0;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    attempts += 1;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return timeoutResult(attempts);

    try {
      const result = await callOpenAi({
        input,
        filingSummary,
        validationError,
        timeoutMs: remainingMs,
        fetchImpl,
      });
      return { result, attempts };
    } catch (error) {
      if (error?.code === "PROVIDER_TIMEOUT") return timeoutResult(attempts);
      if (error?.code !== "SCHEMA_VALIDATION_FAILED") throw error;
      validationError = String(error.validationDetail || error.message).slice(0, 1200);
      if (attempt === 0) continue;
      return {
        result: {
          state: "NEEDS HUMAN CHECK",
          reasonCode: "schema_failed_after_retry",
          explanation: "The review engine failed to return a traceable structured memo after one retry.",
        },
        attempts,
      };
    }
  }
}

export async function callOpenAi({ input, filingSummary, validationError, timeoutMs, fetchImpl = fetch }) {
  if (!process.env.OPENAI_API_KEY) throw providerError("The review engine is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "high" },
        text: {
          format: {
            type: "json_schema",
            name: "foundation_grant_signal_memo",
            strict: true,
            schema: modelReviewJsonSchema,
          },
        },
        instructions: systemPrompt,
        input: buildReviewPrompt({ ...input, filingSummary, validationError }),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw providerError(`Review provider failed: ${response.status} ${detail.slice(0, 280)}`);
    }

    const payload = await response.json();
    const parsed = parseOutputText(extractOutputText(payload));
    const validated = modelReviewSchema.safeParse(parsed);
    if (!validated.success) {
      throw validationFailure(validated.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    }
    return assertTraceability(validated.data, input);
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("The review engine timed out.");
      timeoutError.code = "PROVIDER_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function providerError(message) {
  const error = new Error(message);
  error.publicMessage = "The review engine could not complete this memo. Try again or review the sources manually.";
  return error;
}

function parseOutputText(text) {
  if (!text) throw validationFailure("The response did not include output text.");
  try {
    return JSON.parse(text);
  } catch {
    throw validationFailure("The response was not valid JSON.");
  }
}

function extractOutputText(result) {
  if (result.output_text) return result.output_text;
  return (result.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim();
}

function validationFailure(detail) {
  const error = new Error(`Provider output failed validation: ${detail}`);
  error.code = "SCHEMA_VALIDATION_FAILED";
  error.validationDetail = detail;
  return error;
}

function timeoutResult(attempts) {
  return {
    result: {
      state: "NEEDS HUMAN CHECK",
      reasonCode: "timeout",
      explanation: "The review did not finish within the request time limit. A program officer must review the material manually.",
    },
    attempts,
  };
}
