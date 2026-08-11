const injectionPatterns = [
  /\b(?:ignore|disregard|forget|override)\b[^.!?\n]{0,240}\b(?:instructions?|prompt|system message|developer message)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\bi\s+g\s+n\s+o\s+r\s+e\b[^.!?\n]{0,240}\b(?:instructions?|prompt|system message|developer message)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:system|assistant|developer)\s*:\s*[^\n]+/gim,
  /["']?role["']?\s*:\s*["']?(?:system|assistant|developer)\b[^}\n]*(?:}|$)/gim,
  /<\s*\/?\s*(?:system|assistant|developer)\b[^>]*>/gim,
  /\b(?:return|respond with|output)\s+(?:only|exactly)\b[^.!?\n]{0,180}\b(?:advance|hold|decline|fund|score|rank|json|verdict|decision|recommendation)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:rank|score|rate|select|choose)\s+(?:us|me|this applicant|our (?:application|organization|proposal))\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:mark|classify)\s+(?:us|me|this applicant|our (?:application|organization|proposal))\s+as\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:act|pretend|behave)\s+as\b[^.!?\n]{0,180}\b(?:system|assistant|developer|administrator|(?:grant\s+)?decision\s+maker|grant\s+(?:reviewer|officer|maker))\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:reveal|print|show|expose|repeat)\b[^.!?\n]{0,120}\b(?:hidden\s+)?(?:system|developer|original)\b[^.!?\n]{0,80}\b(?:prompt|instructions?|message)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:bypass|disable|circumvent|evade)\b[^.!?\n]{0,120}\b(?:safeguards?|guardrails?|filters?|validation|security|schema)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:new|highest[- ]priority|authoritative|replacement)\s+(?:system\s+|developer\s+)?instructions?\s*:[^\n]+/gim,
  /\b(?:decode|interpret)\b[^.!?\n]{0,160}\b(?:base\s*64|rot\s*13|encoded)\b[^.!?\n]{0,200}\b(?:command|prompt|instructions?)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:decode|interpret)\b[^.!?\n]{0,80}\b(?:base\s*64|rot\s*13|encoded)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:use|call|invoke)\b[^.!?\n]{0,80}\b(?:tool|function|browser|shell)\b[^.!?\n]{0,180}\b(?:hidden|instructions?|prompt|secret|send|upload|execute|server)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /<\s*\/?\s*untrusted_(?:proposal|foundation_strategy)_data\s*>/gim,
];

export function inspectAndStripInjection(text, { source }) {
  const original = String(text || "");
  const view = securityView(original);
  const spans = mergeSpans(
    injectionPatterns.flatMap((pattern) => matchesFor(pattern, view)),
  );

  if (!spans.length) {
    return {
      text: original,
      strippedSpans: [],
      operationLog: [operation("input_validated", source, "No embedded model-control instruction was detected.")],
    };
  }

  let cleaned = original;
  for (const span of [...spans].reverse()) {
    cleaned = `${cleaned.slice(0, span.start)}${cleaned.slice(span.end)}`;
  }
  cleaned = cleaned.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const strippedSpans = spans.map(({ start, end }) => ({
    source,
    start,
    end,
    text: original.slice(start, end),
  }));

  return {
    text: cleaned,
    strippedSpans,
    operationLog: [
      operation("input_validated", source, "Input passed initial validation before safeguards ran."),
      operation("injection_detected", source, `${spans.length} embedded model-control span${spans.length === 1 ? " was" : "s were"} detected.`),
      ...strippedSpans.map((span) => operation(
        "span_stripped",
        source,
        `Removed characters ${span.start}-${span.end}.`,
      )),
      operation("input_revalidated", source, "The remaining content was revalidated once after stripping."),
    ],
  };
}

export function containsInjection(text) {
  const view = securityView(String(text || ""));
  return injectionPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(view.text);
  });
}

function matchesFor(pattern, view) {
  pattern.lastIndex = 0;
  return Array.from(view.text.matchAll(pattern), (match) => {
    const normalizedStart = match.index;
    const normalizedEnd = match.index + match[0].length;
    return {
      start: view.indexMap[normalizedStart] ?? 0,
      end: (view.indexMap[normalizedEnd - 1] ?? view.originalLength - 1) + 1,
    };
  });
}

function securityView(original) {
  let text = "";
  const indexMap = [];
  for (let index = 0; index < original.length; index += 1) {
    const character = original[index];
    if (/[\u200B-\u200F\u2060\uFEFF]/u.test(character)) continue;
    const normalized = character.normalize("NFKC");
    for (const outputCharacter of normalized) {
      text += /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(outputCharacter) ? " " : outputCharacter;
      indexMap.push(index);
    }
  }
  return { text, indexMap, originalLength: original.length };
}

function mergeSpans(spans) {
  const ordered = spans
    .filter((span) => Number.isInteger(span.start) && span.end > span.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  for (const span of ordered) {
    const previous = merged.at(-1);
    if (previous && span.start <= previous.end) {
      previous.end = Math.max(previous.end, span.end);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

function operation(name, source, detail) {
  return { operation: name, source, detail };
}
