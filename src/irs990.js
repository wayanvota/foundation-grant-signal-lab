const DEFAULT_BASE_URL = "https://projects.propublica.org/nonprofits/api/v2";

export const FILING_REVIEW_STATES = Object.freeze({
  READY: "ready",
  NO_FILED_RETURN: "no_filed_return",
  LIMITED_990_N: "limited_990_n",
  SHORT_PERIOD: "short_period",
  GROUP_RETURN: "group_return",
  FISCAL_SPONSORSHIP: "fiscal_sponsorship",
});

export function normalizeEin(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!/^\d{9}$/.test(digits)) {
    const error = new Error("Enter a valid nine-digit EIN.");
    error.statusCode = 400;
    error.publicMessage = error.message;
    throw error;
  }
  return digits;
}

export function formatEin(value) {
  const digits = normalizeEin(value);
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export async function fetchIrs990(ein, {
  fetchImpl = fetch,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = 12_000,
} = {}) {
  const normalizedEin = normalizeEin(ein);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const sourceUrl = `${baseUrl}/organizations/${normalizedEin}.json`;

  try {
    const response = await fetchImpl(sourceUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (response.status === 404) {
      return normalizeIrsResponse(normalizedEin, null, sourceUrl);
    }
    if (!response.ok) {
      throw new Error(`Filing lookup failed with status ${response.status}.`);
    }
    return normalizeIrsResponse(normalizedEin, await response.json(), sourceUrl);
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("The filing lookup timed out.");
      timeoutError.code = "IRS_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeIrsResponse(ein, payload, sourceUrl = "") {
  const filings = [...(payload?.filings_with_data || [])]
    .filter((filing) => filing && filing.tax_prd)
    .sort((left, right) => Number(right.tax_prd) - Number(left.tax_prd));
  const filingsWithoutData = [...(payload?.filings_without_data || [])]
    .sort((left, right) => Number(right.tax_prd) - Number(left.tax_prd));
  const latestFiling = filings[0] || null;

  return {
    ein: formatEin(ein),
    organization: payload?.organization || null,
    filings,
    filingsWithoutData,
    latestFiling,
    sourceUrl,
    dataSource: payload?.data_source || "ProPublica Nonprofit Explorer API and IRS annual extracts",
    filingLagYears: latestFiling
      ? Math.max(0, new Date().getUTCFullYear() - Number(latestFiling.tax_prd_yr || String(latestFiling.tax_prd).slice(0, 4)))
      : null,
  };
}

export function assessFilingUsability(irsRecord, applicantContext = {}) {
  const filingContext = applicantContext.filingContext || "standalone";

  if (filingContext === "fiscal_sponsor") {
    const sponsor = String(applicantContext.fiscalSponsorName || "the named fiscal sponsor").trim();
    return {
      state: FILING_REVIEW_STATES.FISCAL_SPONSORSHIP,
      reason: `The applicant operates through ${sponsor}. Its finances sit inside the sponsor's return and cannot be checked against a filing of its own.`,
    };
  }

  if (filingContext === "990_n") {
    return {
      state: FILING_REVIEW_STATES.LIMITED_990_N,
      reason: "The applicant reports filing Form 990-N, which contains no financial detail for claim checking or financial diligence.",
    };
  }

  if (filingContext === "group_return" || isGroupReturn(irsRecord?.latestFiling)) {
    return {
      state: FILING_REVIEW_STATES.GROUP_RETURN,
      reason: "The available filing is a group return. Parent-level figures cannot be treated as the applicant affiliate's finances.",
    };
  }

  if (!irsRecord?.latestFiling) {
    const hasDocumentOnlyReturn = Boolean(irsRecord?.filingsWithoutData?.length);
    return {
      state: FILING_REVIEW_STATES.NO_FILED_RETURN,
      reason: hasDocumentOnlyReturn
        ? "A return document exists, but the API has no extracted financial data for a reviewable filing."
        : "No filed return with financial detail was found for this EIN.",
    };
  }

  if (isShortPeriod(irsRecord.filings)) {
    return {
      state: FILING_REVIEW_STATES.SHORT_PERIOD,
      reason: "The latest return appears to cover a short fiscal period after a fiscal year change. Annual ratios would be distorted.",
    };
  }

  return { state: FILING_REVIEW_STATES.READY, reason: null };
}

export function isShortPeriod(filings) {
  const [latest, previous] = filings || [];
  if (!latest) return false;

  const explicitMonths = numberFrom(latest, ["taxperiodmonths", "tax_period_months"]);
  if (explicitMonths !== null) return explicitMonths < 10;

  const start = dateFrom(latest, ["taxperiodbegindt", "tax_prd_begin", "tax_period_begin"]);
  const end = dateFrom(latest, ["taxperiodenddt", "tax_prd_end", "tax_period_end"]);
  if (start && end) return monthDifference(start, end) < 10;

  if (!previous) return false;
  const latestPeriod = periodDate(latest.tax_prd);
  const previousPeriod = periodDate(previous.tax_prd);
  return latestPeriod && previousPeriod
    ? monthDifference(previousPeriod, latestPeriod) < 10
    : false;
}

export function filingLine(filing, aliases, label) {
  for (const key of aliases) {
    const value = numericValue(filing?.[key]);
    if (value !== null) return { key, label, value };
  }
  return null;
}

export const filingLines = Object.freeze({
  totalRevenue: ["totrevenue", "totrevnue", "totrcptperbks"],
  totalExpenses: ["totfuncexpns", "totexpnss", "totexpnsexempt"],
  totalAssets: ["totassetsend", "totassetsendofyr"],
  totalLiabilities: ["totliabend", "totliabendofyr"],
  employees: ["totemployees", "totalemployeevari"],
  programExpenses: ["totprgmserviceexpns", "totprgmservexpns", "programserviceexpenses"],
  managementExpenses: ["totmgmtgenexpns", "managementandgeneralexpenses"],
  contributions: ["totcntrbgfts", "totcntrbs", "contributionsgiftsgrants"],
  programRevenue: ["totprgmrevnue", "programservicerevenue"],
  investmentIncome: ["invstmntinc", "investmentincome"],
});

function isGroupReturn(filing) {
  return ["grpretn", "groupreturnind", "group_return"].some((key) => {
    const value = filing?.[key];
    return value === true || value === 1 || String(value || "").toUpperCase() === "X";
  });
}

function numberFrom(object, keys) {
  for (const key of keys) {
    const value = numericValue(object?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function numericValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateFrom(object, keys) {
  for (const key of keys) {
    if (!object?.[key]) continue;
    const date = new Date(object[key]);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function periodDate(period) {
  const value = String(period || "");
  if (!/^\d{6}$/.test(value)) return null;
  return new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, 1));
}

function monthDifference(start, end) {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth();
}
