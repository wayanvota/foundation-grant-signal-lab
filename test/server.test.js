import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../api/server.js";

test("API reports stateless operation and returns reviews without creating history", async (context) => {
  const generated = {
    recommendation: "NEEDS HUMAN CHECK",
    recommendationReason: "Fixture response.",
    boardLine: "Fixture response for API transport verification only.",
  };
  const server = createApp({ generateReview: async () => generated }).listen(0, "127.0.0.1");
  const listening = await new Promise((resolve) => {
    server.once("listening", () => resolve(true));
    server.once("error", (error) => resolve(error));
  });
  if (listening?.code === "EPERM") {
    context.skip("The local test sandbox blocks loopback listeners; CI and the browser smoke test exercise this transport.");
    return;
  }
  if (listening instanceof Error) throw listening;
  context.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const meta = await fetch(`${base}/api/meta`).then((response) => response.json());
  assert.equal(meta.storage, "stateless");
  assert.equal(meta.publicHistory, false);

  const response = await fetch(`${base}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicantName: "Fictional Applicant",
      ein: "12-3456789",
      filingContext: "standalone",
      proposal: "A fictional applicant requests support for a measurable community program with a stated budget, delivery plan, and outcome target.",
      foundationStrategy: "The foundation supports measurable community programs and requires a documented budget, an accountable delivery lead, and a credible sustainability plan.",
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), generated);
  assert.equal((await fetch(`${base}/api/reviews`)).status, 404);
});
