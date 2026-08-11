const legalNameNoise = new Set([
  "and", "co", "company", "corp", "corporation", "inc", "incorporated", "llc", "ltd", "of", "the",
]);

const fillerPattern = /\b(?:lorem\s+ipsum|gibberish|placeholder(?:\s+text)?|random\s+words?|test(?:ing)?\s+only|satisfy\s+(?:the\s+)?(?:form|minimum|length)|asdf+|qwerty+)\b/iu;
const decisionPattern = /\b(?:requests?|seeks?|propos(?:e|es|al)|programs?|projects?|campaigns?|initiatives?|activities|services?|grants?|support|expand|deliver|serve|provide|operate|fund|budget|outcomes?|solicita|programa|proyecto|campaña|actividades|servicios|apoyo|ampliar|atendi[oó]|presupuesto|resultados?)\b/iu;

export function assessProposalQuality(value) {
  const text = String(value || "").normalize("NFKC");
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  const normalizedWords = words.map((word) => word.toLocaleLowerCase());
  const counts = new Map();
  for (const word of normalizedWords) counts.set(word, (counts.get(word) || 0) + 1);
  const highestRepetition = counts.size ? Math.max(...counts.values()) / normalizedWords.length : 1;
  const letterCount = (text.match(/\p{L}/gu) || []).length;
  const visibleCount = (text.match(/\S/gu) || []).length || 1;

  if (fillerPattern.test(text)) return insufficient("The proposal contains obvious placeholder or form-filler text instead of reviewable source material.");
  if (/(.)\1{20,}/u.test(text)) return insufficient("The proposal contains repeated characters instead of reviewable source material.");
  if (words.length < 12 || letterCount / visibleCount < 0.45) return insufficient("The proposal does not contain enough coherent language for a diligence review.");
  if (highestRepetition > 0.4) return insufficient("The proposal repeats too little distinct content for a diligence review.");
  if (!decisionPattern.test(text)) return insufficient("The proposal does not identify a reviewable request, program, project, budget, service, or outcome.");
  return { ready: true, reason: null };
}

export function assessApplicantIdentity(applicantName, filingName) {
  if (!filingName) return { ready: true, reason: null };
  const supplied = significantNameTokens(applicantName);
  const filed = significantNameTokens(filingName);
  if (!supplied.length || !filed.length) return mismatch(applicantName, filingName);

  const suppliedText = supplied.join(" ");
  const filedText = filed.join(" ");
  if (suppliedText.includes(filedText) || filedText.includes(suppliedText)) return { ready: true, reason: null };

  const filedSet = new Set(filed);
  const overlap = supplied.filter((token) => filedSet.has(token));
  const overlapRatio = overlap.length / Math.min(supplied.length, filed.length);
  const hasDistinctiveOverlap = overlap.some((token) => token.length >= 4);
  if (overlapRatio >= 0.6 && hasDistinctiveOverlap) return { ready: true, reason: null };
  return mismatch(applicantName, filingName);
}

function significantNameTokens(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((token) => token.length > 1 && !legalNameNoise.has(token)) || [];
}

function insufficient(reason) {
  return { ready: false, reason };
}

function mismatch(applicantName, filingName) {
  return {
    ready: false,
    reason: `The supplied legal name, ${String(applicantName).trim()}, does not reasonably match the organization name returned for this EIN, ${String(filingName).trim()}.`,
  };
}
