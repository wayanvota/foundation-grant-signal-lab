import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "database", "schema.sql");

const db = getPool();

if (!db) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const sql = await fs.readFile(schemaPath, "utf8");
await db.query(sql);
await db.end();

console.log("Database schema is ready.");
