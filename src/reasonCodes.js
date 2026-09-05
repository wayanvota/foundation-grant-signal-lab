export const REASON_CODES = Object.freeze([
  "GEO_INELIGIBLE",
  "ISSUE_AREA_OUT_OF_SCOPE",
  "ORG_TYPE_INELIGIBLE",
  "BUDGET_BELOW_FLOOR",
  "BUDGET_ABOVE_CEILING",
  "OPERATING_HISTORY_SHORT",
  "DUPLICATE_SUBMISSION",
  "INCOMPLETE_REQUIRED_ELEMENT",
  "IDENTITY_UNVERIFIED",
  "INDETERMINATE_MISSING_FACT",
]);

export const CUSTOM_REASON_CODE_PATTERN = /^CUSTOM_[A-Z0-9_]+$/;

export function isReasonCode(value, customReasonCodes = {}) {
  return REASON_CODES.includes(value) || (CUSTOM_REASON_CODE_PATTERN.test(value) && Object.hasOwn(customReasonCodes, value));
}
