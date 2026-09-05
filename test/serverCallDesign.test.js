import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../api/server.js";

test("call-design endpoint accepts stateless JSON and returns a compiled package", async (context) => {
  const generated = { ruleSpec: { version: "1.0", name: "Fixture", clauses: [], uncompiledLanguage: [] }, privacy: "Nothing was saved." };
  const server = createApp({ generateDesign: async () => generated }).listen(0, "127.0.0.1");
  const listening = await new Promise((resolve) => {
    server.once("listening", () => resolve(true));
    server.once("error", (error) => resolve(error));
  });
  if (listening?.code === "EPERM") {
    context.skip("The local test sandbox blocks loopback listeners; CI exercises this transport.");
    return;
  }
  if (listening instanceof Error) throw listening;
  context.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/call-designs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ruleText: "Applicants must operate in North Carolina.", candidateProfiles: [], funnel: {} }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), generated);
});

test("call-design endpoint rejects malformed structured fields without running compilation", async (context) => {
  let called = false;
  const server = createApp({ generateDesign: async () => { called = true; return {}; } }).listen(0, "127.0.0.1");
  const listening = await new Promise((resolve) => {
    server.once("listening", () => resolve(true));
    server.once("error", (error) => resolve(error));
  });
  if (listening?.code === "EPERM") { context.skip("Loopback unavailable."); return; }
  if (listening instanceof Error) throw listening;
  context.after(() => server.close());
  const { port } = server.address();
  const form = new FormData();
  form.set("ruleText", "Applicants must operate in North Carolina.");
  form.set("candidateProfiles", "{not json}");
  const response = await fetch(`http://127.0.0.1:${port}/api/call-designs`, { method: "POST", body: form });
  assert.equal(response.status, 400);
  assert.equal(called, false);
});
