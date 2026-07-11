import pg from "pg";

const { Pool } = pg;

let pool;
let reviewSchemaReady = false;
const memoryReviews = new Map();

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function usingMemoryStore() {
  return !process.env.DATABASE_URL && process.env.ALLOW_MEMORY_STORE === "true";
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function checkDatabase() {
  const db = getPool();
  if (!db) {
    return { ok: usingMemoryStore(), mode: usingMemoryStore() ? "memory" : "missing" };
  }

  await ensureReviewSchema(db);
  return { ok: true, mode: "neon" };
}

export async function saveReview(review) {
  const db = getPool();
  const now = new Date().toISOString();

  if (!db) {
    if (!usingMemoryStore()) {
      throw new Error("DATABASE_URL is required unless ALLOW_MEMORY_STORE=true.");
    }

    const id = crypto.randomUUID();
    const record = publicReviewRecord({ ...review, id, createdAt: now });
    memoryReviews.set(id, record);
    return record;
  }

  await ensureReviewSchema(db);

  const result = await db.query(
    `insert into grant_reviews (
      applicant,
      proposal,
      foundation_strategy,
      claim,
      score,
      model_route,
      verdict,
      board_line,
      strongest_evidence,
      donor_risks,
      next_actions,
      model_used,
      response_json
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    returning
      id,
      applicant,
      proposal,
      foundation_strategy as "foundationStrategy",
      claim,
      score,
      model_route as "route",
      verdict,
      board_line as "boardLine",
      strongest_evidence as "strongestEvidence",
      donor_risks as "funderRisks",
      next_actions as "nextActions",
      model_used as "modelUsed",
      created_at as "createdAt"`,
    [
      review.applicant,
      review.proposal,
      review.foundationStrategy,
      review.claim ?? null,
      review.score,
      review.route,
      review.verdict,
      review.boardLine,
      JSON.stringify(review.strongestEvidence),
      JSON.stringify(review.donorRisks),
      JSON.stringify(review.nextActions),
      review.modelUsed,
      JSON.stringify(review.raw),
    ],
  );

  return result.rows[0];
}

async function ensureReviewSchema(db) {
  if (reviewSchemaReady) {
    return;
  }

  await db.query("alter table grant_reviews add column if not exists claim text");
  reviewSchemaReady = true;
}

function publicReviewRecord(review) {
  return {
    id: review.id,
    applicant: review.applicant,
    proposal: review.proposal,
    foundationStrategy: review.foundationStrategy,
    claim: review.claim ?? null,
    score: review.score,
    route: review.route,
    verdict: review.verdict,
    boardLine: review.boardLine,
    strongestEvidence: review.strongestEvidence,
    funderRisks: review.donorRisks,
    nextActions: review.nextActions,
    modelUsed: review.modelUsed,
    createdAt: review.createdAt,
  };
}

export async function getReview(id) {
  const db = getPool();
  if (!db) {
    return memoryReviews.get(id) ?? null;
  }

  const result = await db.query(
    `select
      id,
      applicant,
      proposal,
      foundation_strategy as "foundationStrategy",
      claim,
      score,
      model_route as "route",
      verdict,
      board_line as "boardLine",
      strongest_evidence as "strongestEvidence",
      donor_risks as "funderRisks",
      next_actions as "nextActions",
      model_used as "modelUsed",
      created_at as "createdAt"
    from grant_reviews
    where id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function listReviews(limit = 12) {
  const db = getPool();
  if (!db) {
    return [...memoryReviews.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  const result = await db.query(
    `select
      id,
      applicant,
      score,
      model_route as "route",
      verdict,
      board_line as "boardLine",
      created_at as "createdAt"
    from grant_reviews
    order by created_at desc
    limit $1`,
    [limit],
  );

  return result.rows;
}
