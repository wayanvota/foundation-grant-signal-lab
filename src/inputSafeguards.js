const injectionPatterns = [
  /\b(?:ignore|disregard|forget|override)\b[^.!?\n]{0,240}\b(?:instructions?|prompt|system message|developer message)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:system|assistant|developer)\s*:\s*[^\n]+/gim,
  /\b(?:return|respond with|output)\s+(?:only|exactly)\b[^.!?\n]{0,180}\b(?:advance|hold|decline|fund|score|rank|json|verdict|decision|recommendation)\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:rank|score|rate|select|choose)\s+(?:us|me|this applicant|our (?:application|organization|proposal))\b[^.!?\n]*(?:[.!?]|$)/gim,
  /\b(?:mark|classify)\s+(?:us|me|this applicant|our (?:application|organization|proposal))\s+as\b[^.!?\n]*(?:[.!?]|$)/gim,
];

export function inspectAndStripInjection(text, { source }) {
  const original = String(text || "");
  const spans = mergeSpans(
    injectionPatterns.flatMap((pattern) => matchesFor(pattern, original)),
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
  return injectionPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(String(text || ""));
  });
}

function matchesFor(pattern, text) {
  pattern.lastIndex = 0;
  return Array.from(text.matchAll(pattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
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
