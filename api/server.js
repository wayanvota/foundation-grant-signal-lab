import "dotenv/config";
import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";
import multer from "multer";
import { generateGrantReview, reviewInputSchema } from "./review.js";
import { extractProposalText } from "./proposalFile.js";

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const reviewLimitWindowMs = Number.parseInt(process.env.REVIEW_RATE_LIMIT_WINDOW_MS || "600000", 10);
const reviewLimitMax = Number.parseInt(process.env.REVIEW_RATE_LIMIT_MAX || "8", 10);
const reviewBuckets = new Map();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
});

export function createApp({ generateReview = generateGrantReview } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "120kb" }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed: ${origin}`));
    },
  }));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      service: "foundation-grant-signal-lab-api",
      filingData: "configured",
      reviewEngine: Boolean(process.env.OPENAI_API_KEY),
      storage: "stateless",
    });
  });

  app.get("/api/meta", (_request, response) => {
    response.json({
      name: "Foundation Grant Signal Lab",
      decision: "Should this foundation advance this proposal to real diligence?",
      recommendations: ["ADVANCE", "HOLD FOR DILIGENCE", "DECLINE", "NEEDS HUMAN CHECK"],
      storage: "stateless",
      publicHistory: false,
      filingProvider: "ProPublica Nonprofit Explorer",
    });
  });

  app.post("/api/reviews", reviewRateLimit, upload.single("proposalFile"), async (request, response) => {
    let proposalFromFile = "";
    try {
      proposalFromFile = request.file ? await extractProposalText(request.file) : "";
    } catch (error) {
      response.status(error.statusCode || 400).json({ error: error.publicMessage || error.message });
      return;
    }

    const body = {
      ...request.body,
      proposal: [request.body?.proposal, proposalFromFile].filter(Boolean).join("\n\n"),
    };
    const parsed = reviewInputSchema.safeParse(body);
    if (!parsed.success) {
      response.status(400).json({
        error: "The review input is incomplete or invalid.",
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const memo = await generateReview(parsed.data);
      response.status(200).json(memo);
    } catch (error) {
      response.status(error.statusCode || 500).json({
        error: error.publicMessage || (error instanceof Error ? error.message : "Grant review failed"),
      });
    }
  });

  app.use((error, _request, response, next) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "The proposal file must be 6 MB or smaller." : error.message });
      return;
    }
    if (error) {
      response.status(400).json({ error: error.message || "The request could not be read." });
      return;
    }
    next();
  });

  app.use((_request, response) => response.status(404).json({ error: "Not found" }));
  return app;
}

export function startServer() {
  const port = process.env.PORT || 10000;
  const host = process.env.HOST || "0.0.0.0";
  const server = createApp().listen(port, host, () => {
    console.log(`Foundation Grant Signal Lab API listening on ${host}:${port}`);
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  return server;
}

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
    response.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    response.status(429).json({ error: "Too many review requests. Please wait before running another review." });
    return;
  }
  next();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startServer();
