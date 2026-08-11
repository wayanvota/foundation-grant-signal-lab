import test from "node:test";
import assert from "node:assert/strict";
import { assessApplicantIdentity, assessProposalQuality } from "../src/inputQuality.js";

test("accepts coherent decision-relevant proposal text", () => {
  const result = assessProposalQuality("The applicant requests $250,000 to expand a rural health program serving 4,200 residents. A named director will report outcomes quarterly during the two-year project.");
  assert.equal(result.ready, true);
});

test("accepts coherent Spanish proposal text", () => {
  const result = assessProposalQuality("La organización solicita 250.000 dólares para ampliar un programa de salud rural que atendió a 4.200 residentes. La directora informará resultados trimestralmente durante dos años.");
  assert.equal(result.ready, true);
});

test("accepts a coherent but plainly ineligible campaign", () => {
  const result = assessProposalQuality("The organization requests $400,000 for an exclusively urban arts-marketing campaign. All activities will occur in Los Angeles, with advertising and event sponsorships delivered during one calendar year.");
  assert.equal(result.ready, true);
});

test("rejects obvious random form filler", () => {
  const result = assessProposalQuality("Purple toaster banana orbit. Random words continue only to satisfy the form length requirement. Marble window comet spoon jacket river and more placeholder text.");
  assert.equal(result.ready, false);
});

test("rejects repeated-character garbage", () => {
  const result = assessProposalQuality(`The program requests support ${"x".repeat(100)} and contains no reviewable material.`);
  assert.equal(result.ready, false);
});

test("accepts reasonable legal-name variations", () => {
  assert.equal(assessApplicantIdentity("American Red Cross", "American National Red Cross").ready, true);
  assert.equal(assessApplicantIdentity("Save the Children", "Save the Children Federation Inc").ready, true);
});

test("stops an unrelated legal name paired with an EIN", () => {
  const result = assessApplicantIdentity("Completely Different Coastal Theatre", "American National Red Cross");
  assert.equal(result.ready, false);
  assert.match(result.reason, /does not reasonably match/);
});
