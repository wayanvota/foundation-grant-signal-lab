import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "frontend");
const dist = path.join(root, "dist-static");
const upload = path.join(root, "wayan-upload", "grant-signal-lab");
const apiBaseUrl =
  process.env.PUBLIC_API_BASE_URL ||
  "https://foundation-grant-signal-lab-api.onrender.com";

async function copyStatic(target) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });

  for (const file of ["index.html", "styles.css", "app.js"]) {
    await fs.copyFile(path.join(source, file), path.join(target, file));
  }

  await fs.writeFile(
    path.join(target, "config.js"),
    `window.GRANT_SIGNAL_CONFIG = {\n  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},\n};\n`,
  );
}

await copyStatic(dist);
await copyStatic(upload);

console.log(`Static frontend ready: ${dist}`);
console.log(`Wayan upload folder ready: ${upload}`);
console.log(`API base URL: ${apiBaseUrl}`);
