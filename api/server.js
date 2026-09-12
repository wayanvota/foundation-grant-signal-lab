import "dotenv/config";
import { pathToFileURL } from "node:url";
import express from "express";
import cors from "cors";
import multer from "multer";
import { generateGrantReview, reviewInputSchema } from "./review.js";
import { extractDocumentText, extractProposalText } from "./proposalFile.js";
import { generateCallDesign, callDesignInputSchema } from "./callDesign.js";
import { starterProfiles } from "../src/ruleSpec.js";

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "https://wayan.com,https://www.wayan.com")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const reviewLimitWindowMs = Number.parseInt(process.env.REVIEW_RATE_LIMIT_WINDOW_MS || "600000", 10);
const reviewLimitMax = Number.parseInt(process.env.REVIEW_RATE_LIMIT_MAX || "8", 10);
const reviewBuckets = new Map();
let lastBucketPruneAt = 0;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
    files: 1,
    fields: 7,
    parts: 8,
    fieldNameSize: 100,
    fieldSize: 64 * 1024,
  },
});

const callDesignUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
    fieldNameSize: 100,
    fieldSize: 12 * 1024 * 1024,
  },
});

export function createApp({ generateReview = generateGrantReview, generateDesign = generateCallDesign } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.use("/api/call-designs", express.json({ limit: "12mb" }));
  app.use(express.json({ limit: "120kb" }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      const error = new Error("Origin not allowed");
      error.code = "CORS_NOT_ALLOWED";
      error.statusCode = 403;
      error.publicMessage = "This origin is not allowed to use the review API.";
      callback(error);
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
      modes: ["CALL DESIGN", "DILIGENCE MEMO"],
      availableModes: ["CALL DESIGN", "DILIGENCE MEMO"],
      recommendations: ["ADVANCE", "HOLD FOR DILIGENCE", "DECLINE", "NEEDS HUMAN CHECK"],
      storage: "stateless",
      publicHistory: false,
      filingProvider: "ProPublica Nonprofit Explorer",
    });
  });

  app.get("/api/starter-profiles", (_request, response) => {
    response.json({ profiles: starterProfiles, fictional: true });
  });

  app.post("/api/call-designs", reviewRateLimit, callDesignUpload.single("ruleFile"), async (request, response) => {
    let ruleFromFile = "";
    try {
      ruleFromFile = request.file ? await extractDocumentText(request.file, { subject: "draft rule", minimumLength: 20, maximumLength: 40_000 }) : "";
    } catch (error) {
      response.status(error.statusCode || 400).json({ error: error.publicMessage || error.message });
      return;
    }

    try {
      const candidateProfiles = parseJsonField(request.body?.candidateProfiles, []);
      const funnel = parseJsonField(request.body?.funnel, {});
      const ruleArtifact = parseJsonField(request.body?.ruleArtifact, undefined);
      const body = {
        ruleText: [request.body?.ruleText, ruleFromFile].filter(Boolean).join("\n\n"),
        ruleArtifact,
        candidateProfiles,
        funnel,
      };
      const parsed = callDesignInputSchema.safeParse(body);
      if (!parsed.success) {
        response.status(400).json({ error: "The call-design input is incomplete or invalid.", details: parsed.error.flatten() });
        return;
      }
      response.status(200).json(await generateDesign(parsed.data));
    } catch (error) {
      response.status(error.statusCode || 500).json({ error: error.publicMessage || (error instanceof Error ? error.message : "Call design failed") });
    }
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
      const messages = {
        LIMIT_FILE_SIZE: "The uploaded file must be 6 MB or smaller.",
        LIMIT_FILE_COUNT: "Upload only one proposal file.",
        LIMIT_FIELD_COUNT: "The review form contains too many fields.",
        LIMIT_PART_COUNT: "The review form contains too many parts.",
        LIMIT_FIELD_KEY: "A review form field name is too long.",
        LIMIT_FIELD_VALUE: "A review form field is too large.",
      };
      response.status(400).json({ error: messages[error.code] || "The uploaded review form could not be read." });
      return;
    }
    if (error?.type === "entity.too.large") {
      response.status(413).json({ error: "The JSON request body must be 120 KB or smaller." });
      return;
    }
    if (error?.type === "entity.parse.failed") {
      response.status(400).json({ error: "The request body is not valid JSON." });
      return;
    }
    if (error) {
      response.status(error.statusCode || 400).json({ error: error.publicMessage || "The request could not be read." });
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
  pruneReviewBuckets(now);
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

function pruneReviewBuckets(now) {
  if (now - lastBucketPruneAt < 60_000 && reviewBuckets.size < 1_000) return;
  for (const [key, bucket] of reviewBuckets) {
    if (now > bucket.resetAt) reviewBuckets.delete(key);
  }
  lastBucketPruneAt = now;
}

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch {
    const error = new Error("One of the structured form fields is not valid JSON.");
    error.statusCode = 400;
    error.publicMessage = error.message;
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startServer();
