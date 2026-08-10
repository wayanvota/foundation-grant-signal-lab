import test from "node:test";
import assert from "node:assert/strict";
import { extractProposalText } from "../api/proposalFile.js";

test("reads a text proposal from memory without persisting it", async () => {
  const text = "Fictional proposal text ".repeat(8);
  const result = await extractProposalText({ mimetype: "text/plain", buffer: Buffer.from(text) });
  assert.equal(result, text.trim());
});

test("rejects an unsupported upload type", async () => {
  await assert.rejects(
    extractProposalText({ mimetype: "application/octet-stream", buffer: Buffer.from("x".repeat(100)) }),
    /TXT, Markdown, PDF, or DOCX/,
  );
});
