import "dotenv/config";
import express from "express";
import cors from "cors";
import { checkDatabase, getReview, listReviews, saveReview } from "./db.js";
import { generateGrantReview, reviewInputSchema } from "./review.js";

const app = express();
const port = process.env.PORT || 10000;
const host = process.env.HOST || "0.0.0.0";
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const publicHistoryEnabled = process.env.ENABLE_PUBLIC_HISTORY === "true";
const reviewLimitWindowMs = Number.parseInt(
  process.env.REVIEW_RATE_LIMIT_WINDOW_MS || "600000",
  10,
);
const reviewLimitMax = Number.parseInt(process.env.REVIEW_RATE_LIMIT_MAX || "8", 10);
const reviewBuckets = new Map();

app.set("trust proxy", 1);

app.use(express.json({ limit: "80kb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed: ${origin}`));
    },
  }),
);

app.get("/health", async (_request, response) => {
  try {
    const database = await checkDatabase();
    response.json({
      ok: database.ok,
      service: "foundation-grant-signal-lab-api",
      database: database.mode,
      openai: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    response.status(503).json({
      ok: false,
      service: "foundation-grant-signal-lab-api",
      error: error instanceof Error ? error.message : "Health check failed",
    });
  }
});

app.get("/api/meta", (_request, response) => {
  response.json({
    name: "Foundation Grant Signal Lab",
    purpose:
      "AI-assisted grant screening for foundation funders, with evidence, risks, next actions, and board-ready rationale.",
    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
    storage: process.env.DATABASE_URL ? "neon" : "memory-or-unconfigured",
    publicHistory: publicHistoryEnabled,
  });
});

app.post("/api/reviews", reviewRateLimit, async (request, response) => {
  const parsed = reviewInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: "Invalid review input",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const generated = await generateGrantReview(parsed.data);
    const saved = await saveReview({
      applicant: parsed.data.applicant,
      proposal: parsed.data.proposal,
      foundationStrategy: parsed.data.foundationStrategy,
      ...generated,
    });

    response.status(201).json(saved);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Grant review failed",
    });
  }
});

app.get("/api/reviews", async (request, response) => {
  if (!publicHistoryEnabled) {
    response.status(403).json({
      error: "Public review history is disabled for visitor privacy.",
    });
    return;
  }

  const limit = Number.parseInt(String(request.query.limit || "12"), 10);
  response.json(await listReviews(Number.isFinite(limit) ? Math.min(limit, 50) : 12));
});

app.get("/api/reviews/:id", async (request, response) => {
  if (!publicHistoryEnabled) {
    response.status(403).json({
      error: "Public review history is disabled for visitor privacy.",
    });
    return;
  }

  const review = await getReview(request.params.id);
  if (!review) {
    response.status(404).json({ error: "Review not found" });
    return;
  }
  response.json(review);
});

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

const server = app.listen(port, host, () => {
  console.log(`Foundation Grant Signal Lab API listening on ${host}:${port}`);
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function reviewRateLimit(request, response, next) {
  const now = Date.now();
  const windowMs = Number.isFinite(reviewLimitWindowMs) ? reviewLimitWindowMs : 600_000;
  const max = Number.isFinite(reviewLimitMax) ? reviewLimitMax : 8;
  const key = request.ip || request.get("x-forwarded-for") || "unknown";
  const bucket = reviewBuckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  reviewBuckets.set(key, bucket);

  if (bucket.count > max) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    response.set("Retry-After", String(retryAfterSeconds));
    response.status(429).json({
      error: "Too many review requests. Please wait before running another review.",
    });
    return;
  }

  next();
}
