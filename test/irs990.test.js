import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEin,
  normalizeIrsResponse,
  assessFilingUsability,
  FILING_REVIEW_STATES,
  isShortPeriod,
} from "../src/irs990.js";

test("normalizes a formatted EIN and rejects malformed identifiers", () => {
  assert.equal(normalizeEin("12-3456789"), "123456789");
  assert.throws(() => normalizeEin("123"), /nine-digit EIN/);
});

test("sorts filings newest first and preserves a visible filing source", () => {
  const record = normalizeIrsResponse("123456789", {
    organization: { name: "Fictional Community Services" },
    filings_with_data: [
      { tax_prd: 202212, tax_prd_yr: 2022, totrevenue: 20 },
      { tax_prd: 202412, tax_prd_yr: 2024, totrevenue: 30 },
    ],
  }, "https://example.test/filing");
  assert.equal(record.latestFiling.tax_prd_yr, 2024);
  assert.equal(record.sourceUrl, "https://example.test/filing");
});

test("fiscal sponsorship returns a named human-check reason", () => {
  const result = assessFilingUsability(null, {
    filingContext: "fiscal_sponsor",
    fiscalSponsorName: "Fictional Community Sponsor",
  });
  assert.equal(result.state, FILING_REVIEW_STATES.FISCAL_SPONSORSHIP);
  assert.match(result.reason, /Fictional Community Sponsor/);
});

test("990-N and group returns stop automated diligence", () => {
  assert.equal(assessFilingUsability(null, { filingContext: "990_n" }).state, FILING_REVIEW_STATES.LIMITED_990_N);
  assert.equal(assessFilingUsability({ latestFiling: { tax_prd: 202412 }, filings: [] }, { filingContext: "group_return" }).state, FILING_REVIEW_STATES.GROUP_RETURN);
});

test("a fiscal-year change producing a short period is detected", () => {
  const filings = [
    { tax_prd: 202406, tax_prd_yr: 2024 },
    { tax_prd: 202312, tax_prd_yr: 2023 },
  ];
  assert.equal(isShortPeriod(filings), true);
  const result = assessFilingUsability({ latestFiling: filings[0], filings, filingsWithoutData: [] }, { filingContext: "standalone" });
  assert.equal(result.state, FILING_REVIEW_STATES.SHORT_PERIOD);
});

test("no extracted return stops automated diligence", () => {
  const result = assessFilingUsability({ latestFiling: null, filings: [], filingsWithoutData: [] }, { filingContext: "standalone" });
  assert.equal(result.state, FILING_REVIEW_STATES.NO_FILED_RETURN);
});
