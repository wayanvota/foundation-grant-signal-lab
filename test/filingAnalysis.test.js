import test from "node:test";
import assert from "node:assert/strict";
import { compareClaimsToFiling, calculateFinancialSignals } from "../src/filingAnalysis.js";

const irsRecord = {
  organization: { ruling: 200801 },
  filingLagYears: 2,
  latestFiling: {
    tax_prd: 202412,
    tax_prd_yr: 2024,
    totrevenue: 3_000_000,
    totemployees: 40,
    totprgmserviceexpns: 2_000_000,
    totfuncexpns: 2_800_000,
    totassetsend: 900_000,
    totliabend: 200_000,
    totcntrbgfts: 2_100_000,
    totmgmtgenexpns: 400_000,
  },
  filings: [
    {
      tax_prd: 202412,
      tax_prd_yr: 2024,
      totrevenue: 3_000_000,
      totfuncexpns: 2_800_000,
      totassetsend: 900_000,
      totliabend: 200_000,
      totcntrbgfts: 2_100_000,
      totprgmserviceexpns: 2_000_000,
      totmgmtgenexpns: 400_000,
    },
    {
      tax_prd: 202312,
      tax_prd_yr: 2023,
      totprgmserviceexpns: 1_600_000,
      totmgmtgenexpns: 350_000,
    },
  ],
};

test("a materially higher proposal budget is contradicted with figures, line, year, and lag", () => {
  const [result] = compareClaimsToFiling([{
    claim: "Annual budget is $5 million.",
    proposalQuote: "Our annual budget is $5 million.",
    category: "annual_budget",
    value: 5_000_000,
    unit: "usd",
  }], irsRecord);
  assert.equal(result.status, "contradicted");
  assert.equal(result.filingLine, "Total revenue");
  assert.equal(result.filingValue, 3_000_000);
  assert.equal(result.taxYear, 2024);
  assert.equal(result.filingLagYears, 2);
  assert.match(result.question, /What explains/);
});

test("a claim without a corresponding line is not checkable and never guessed", () => {
  const [result] = compareClaimsToFiling([{
    claim: "The organization serves five counties.",
    proposalQuote: "We serve five counties.",
    category: "geographic_reach",
    value: 5,
    unit: "sites",
  }], irsRecord);
  assert.equal(result.status, "not_checkable");
  assert.equal(result.filingValue, null);
});

test("financial signals expose their inputs and use questions instead of verdicts", () => {
  const signals = calculateFinancialSignals(irsRecord);
  assert.ok(signals.length >= 3);
  assert.ok(signals.every((signal) => Array.isArray(signal.inputs) && signal.question.endsWith("?")));
  assert.match(signals.find((signal) => signal.signal === "Balance-sheet reserve proxy").question, /unrestricted cash reserves/);
});
