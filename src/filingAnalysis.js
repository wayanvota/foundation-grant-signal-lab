import { filingLine, filingLines } from "./irs990.js";

const CHECKABLE_CATEGORIES = new Set(["annual_budget", "grant_request", "staff_size", "program_scale", "years_of_operation"]);

export function compareClaimsToFiling(claims, irsRecord, { askToRevenueThreshold = 0.25 } = {}) {
  const filing = irsRecord.latestFiling;
  const taxYear = Number(filing.tax_prd_yr || String(filing.tax_prd).slice(0, 4));
  return claims.map((claim) => compareClaim(claim, { filing, taxYear, irsRecord, askToRevenueThreshold }));
}

export function calculateFinancialSignals(irsRecord) {
  const [latest, previous] = irsRecord.filings;
  const taxYear = Number(latest.tax_prd_yr || String(latest.tax_prd).slice(0, 4));
  const revenue = filingLine(latest, filingLines.totalRevenue, "Total revenue");
  const expenses = filingLine(latest, filingLines.totalExpenses, "Total functional expenses");
  const assets = filingLine(latest, filingLines.totalAssets, "Total assets, end of year");
  const liabilities = filingLine(latest, filingLines.totalLiabilities, "Total liabilities, end of year");
  const program = filingLine(latest, filingLines.programExpenses, "Program service expenses");
  const management = filingLine(latest, filingLines.managementExpenses, "Management and general expenses");
  const questions = [];

  questions.push(revenueConcentrationQuestion(latest, revenue, taxYear));
  questions.push(reserveQuestion({ revenue, expenses, assets, liabilities, taxYear }));
  questions.push(spendingTrendQuestion({ latest, previous, program, management, taxYear }));
  questions.push(...flaggedReturnQuestions({ revenue, expenses, assets, liabilities, taxYear }));

  return questions.filter(Boolean);
}

function compareClaim(claim, { filing, taxYear, irsRecord, askToRevenueThreshold }) {
  const base = {
    claim: claim.claim,
    proposalQuote: claim.proposalQuote,
    category: claim.category,
    taxYear,
    filingLagYears: irsRecord.filingLagYears,
  };

  if (!CHECKABLE_CATEGORIES.has(claim.category)) {
    return {
      ...base,
      status: "not_checkable",
      filingLine: null,
      filingValue: null,
      question: `What current evidence would substantiate this claim? The available filing does not contain a corresponding line.`,
    };
  }

  if (claim.value === null) {
    const line = lineForCategory(claim.category, filing);
    return line
      ? {
          ...base,
          status: "unsupported",
          filingLine: line.label,
          filingField: line.key,
          filingValue: line.value,
          question: `What evidence connects this unquantified proposal claim to the ${taxYear} ${line.label.toLowerCase()} of ${formatNumber(line.value)}?`,
        }
      : notCheckable(base, null);
  }

  if (claim.category === "annual_budget") {
    return compareNumericClaim(base, claim.value, filingLine(filing, filingLines.totalRevenue, "Total revenue"), {
      tolerance: 0.2,
      questionLabel: "annual budget and reported total revenue",
      format: formatCurrency,
    });
  }

  if (claim.category === "grant_request") {
    const revenue = filingLine(filing, filingLines.totalRevenue, "Total revenue");
    if (!revenue || claim.value === null) return notCheckable(base, revenue?.label || null);
    const ratio = revenue.value === 0 ? null : claim.value / Math.abs(revenue.value);
    const ratioText = ratio === null ? "not calculable because filed revenue is zero" : formatPercent(ratio);
    const fired = ratio === null || ratio > askToRevenueThreshold;
    return {
      ...base,
      status: fired ? "contradicted" : "supported",
      filingLine: revenue.label,
      filingField: revenue.key,
      filingValue: revenue.value,
      question: fired
        ? `The request-to-revenue ratio is ${ratioText}, above or unable to satisfy the foundation-set ${formatPercent(askToRevenueThreshold)} review threshold. What current revenue, cash-flow, and delivery evidence supports an award at this scale?`
        : `The request equals ${ratioText} of ${taxYear} total revenue, within the foundation-set ${formatPercent(askToRevenueThreshold)} review threshold. What changed since the filing period?`,
      comparisonBasis: "grant request as a share of reported total revenue",
      threshold: { value: askToRevenueThreshold, setBy: "foundation input", fired },
    };
  }

  if (claim.category === "staff_size") {
    return compareNumericClaim(base, claim.value, filingLine(filing, filingLines.employees, "Total employees"), {
      tolerance: 0.15,
      questionLabel: "current staff count and reported employee count",
      format: formatNumber,
    });
  }

  if (claim.category === "program_scale") {
    return compareNumericClaim(base, claim.value, filingLine(filing, filingLines.programExpenses, "Program service expenses"), {
      tolerance: 0.25,
      questionLabel: "claimed program scale and reported program service expenses",
      format: formatCurrency,
    });
  }

  const rulingYear = Number(String(irsRecord.organization?.ruling || "").slice(0, 4));
  if (!Number.isFinite(rulingYear) || rulingYear < 1800) {
    return notCheckable(base, "IRS ruling year");
  }
  const reportedYears = new Date().getUTCFullYear() - rulingYear;
  return compareNumericClaim(base, claim.value, { label: "IRS ruling year", key: "ruling", value: reportedYears }, {
    tolerance: 0.1,
    questionLabel: "claimed operating history and the IRS ruling date",
    format: formatNumber,
  });
}

function lineForCategory(category, filing) {
  if (category === "annual_budget") return filingLine(filing, filingLines.totalRevenue, "Total revenue");
  if (category === "staff_size") return filingLine(filing, filingLines.employees, "Total employees");
  if (category === "program_scale") return filingLine(filing, filingLines.programExpenses, "Program service expenses");
  return null;
}

function compareNumericClaim(base, claimedValue, line, { tolerance, questionLabel, format }) {
  if (!line) return notCheckable(base, null);
  const denominator = Math.max(Math.abs(line.value), 1);
  const difference = Math.abs(claimedValue - line.value) / denominator;
  const status = difference <= tolerance ? "supported" : "contradicted";
  const direction = claimedValue > line.value ? "above" : "below";
  return {
    ...base,
    status,
    filingLine: line.label,
    filingField: line.key,
    filingValue: line.value,
    question: status === "supported"
      ? `What changed since the ${base.taxYear} filing, given that the proposal figure of ${format(claimedValue)} is broadly consistent with ${line.label.toLowerCase()} of ${format(line.value)}?`
      : `What explains why the proposal figure of ${format(claimedValue)} is materially ${direction} the ${base.taxYear} ${line.label.toLowerCase()} of ${format(line.value)}?`,
    comparisonBasis: questionLabel,
  };
}

function notCheckable(base, filingLineName) {
  return {
    ...base,
    status: "not_checkable",
    filingLine: filingLineName,
    filingValue: null,
    question: "What current evidence would substantiate this claim? The available filing does not contain a usable corresponding value.",
  };
}

function revenueConcentrationQuestion(filing, revenue, taxYear) {
  if (!revenue || revenue.value === 0) {
    return unavailableSignal("Revenue concentration", taxYear, "Total revenue and source lines are not available together.");
  }
  const sources = [
    filingLine(filing, filingLines.contributions, "Contributions and grants"),
    filingLine(filing, filingLines.programRevenue, "Program service revenue"),
    filingLine(filing, filingLines.investmentIncome, "Investment income"),
  ].filter(Boolean);
  if (!sources.length) return unavailableSignal("Revenue concentration", taxYear, "No extracted revenue-source lines are available.");
  const largest = sources.sort((left, right) => Math.abs(right.value) - Math.abs(left.value))[0];
  const share = Math.abs(largest.value / revenue.value);
  return {
    signal: "Revenue concentration",
    taxYear,
    inputs: [lineInput(revenue), lineInput(largest)],
    question: `${largest.label} represents about ${formatPercent(share)} of reported total revenue. How exposed is the applicant to a change in that source, and what evidence shows the concentration is manageable?`,
  };
}

function reserveQuestion({ expenses, assets, liabilities, taxYear }) {
  if (!expenses || !assets || !liabilities || expenses.value <= 0) {
    return unavailableSignal("Balance-sheet reserve proxy", taxYear, "Assets, liabilities, and annual expenses are not all available.");
  }
  const netAssets = assets.value - liabilities.value;
  const months = netAssets / (expenses.value / 12);
  return {
    signal: "Balance-sheet reserve proxy",
    taxYear,
    inputs: [lineInput(assets), lineInput(liabilities), lineInput(expenses)],
    question: `Net assets equal about ${formatNumber(months)} months of annual expenses. Because the filing extract does not identify unrestricted cash reserves, what portion was liquid and available for operations?`,
  };
}

function spendingTrendQuestion({ previous, program, management, taxYear }) {
  if (!previous || !program || !management) {
    return unavailableSignal("Program and management spending trend", taxYear, "Comparable program and management expense lines are not available for two years.");
  }
  const previousProgram = filingLine(previous, filingLines.programExpenses, "Program service expenses");
  const previousManagement = filingLine(previous, filingLines.managementExpenses, "Management and general expenses");
  if (!previousProgram || !previousManagement) {
    return unavailableSignal("Program and management spending trend", taxYear, "The prior filing lacks comparable expense lines.");
  }
  const programChange = change(previousProgram.value, program.value);
  const managementChange = change(previousManagement.value, management.value);
  return {
    signal: "Program and management spending trend",
    taxYear,
    inputs: [lineInput(program), lineInput(management), lineInput(previousProgram), lineInput(previousManagement)],
    question: `Program service expenses changed ${formatSignedPercent(programChange)} while management and general expenses changed ${formatSignedPercent(managementChange)}. What operating changes explain the difference?`,
  };
}

function flaggedReturnQuestions({ revenue, expenses, assets, liabilities, taxYear }) {
  const results = [];
  if (revenue && expenses && expenses.value > revenue.value) {
    results.push({
      signal: "Expenses exceeded revenue",
      taxYear,
      inputs: [lineInput(revenue), lineInput(expenses)],
      question: `Expenses exceeded revenue by ${formatCurrency(expenses.value - revenue.value)}. Was this planned use of reserves, a timing issue, or an operating deficit?`,
    });
  }
  if (assets && liabilities && liabilities.value > assets.value) {
    results.push({
      signal: "Liabilities exceeded assets",
      taxYear,
      inputs: [lineInput(assets), lineInput(liabilities)],
      question: `Reported liabilities exceeded assets by ${formatCurrency(liabilities.value - assets.value)}. What is management's plan and current position?`,
    });
  }
  return results;
}

function unavailableSignal(signal, taxYear, reason) {
  return {
    signal,
    taxYear,
    inputs: [],
    question: `${reason} What source should staff request before assessing this signal?`,
    status: "not_available",
  };
}

function lineInput(line) {
  return { filingLine: line.label, filingField: line.key, value: line.value };
}

function change(previous, current) {
  return previous === 0 ? null : (current - previous) / Math.abs(previous);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function formatSignedPercent(value) {
  if (value === null) return "by an unavailable percentage";
  const formatted = formatPercent(Math.abs(value));
  return value >= 0 ? `up ${formatted}` : `down ${formatted}`;
}
