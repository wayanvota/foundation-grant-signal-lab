import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = [
  ["Mac", "Arthur"].join(""),
  ["100", "&", "Change"].join(""),
  ["100", " and ", "Change"].join(""),
  ["Lever", " for ", "Change"].join(""),
  ["Mc", "Govern"].join(""),
  ["Patrick J. ", "Mc", "Govern"].join(""),
  ["Intele", "health"].join(""),
];
const excluded = new Set([".git", "node_modules", "dist", "dist-static"]);
const failures = [];

walk(root);
if (failures.length) {
  console.error(`Forbidden publication strings found:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("Forbidden publication string check passed.");

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(target);
      continue;
    }
    if (!entry.isFile() || isBinary(target)) continue;
    const text = fs.readFileSync(target, "utf8");
    for (const value of forbidden) {
      if (text.includes(value)) failures.push(`${path.relative(root, target)}: ${value}`);
    }
  }
}

function isBinary(file) {
  return /\.(?:png|jpe?g|gif|webp|ico|pdf|docx)$/i.test(file);
}
