const allowedTypes = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function extractDocumentText(file, {
  subject = "document",
  minimumLength = 20,
  maximumLength = 40_000,
} = {}) {
  if (!file?.buffer?.length) return "";
  if (!allowedTypes.has(file.mimetype)) throw publicFileError(`Upload a TXT, Markdown, PDF, or DOCX ${subject}.`);

  let text = "";
  if (file.mimetype === "text/plain" || file.mimetype === "text/markdown") {
    text = file.buffer.toString("utf8");
  } else if (file.mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    text = (await pdfParse(file.buffer)).text;
  } else {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: file.buffer })).value;
  }

  const normalized = String(text || "").replace(/\u0000/g, "").trim();
  if (normalized.length < minimumLength) throw publicFileError(`The uploaded ${subject} did not contain enough readable text. Paste the text instead.`);
  if (normalized.length > maximumLength) throw publicFileError(`The readable ${subject} text exceeds ${maximumLength.toLocaleString("en-US")} characters. Upload a shorter decision-relevant excerpt.`);
  return normalized;
}

export function extractProposalText(file) {
  return extractDocumentText(file, { subject: "proposal", minimumLength: 80, maximumLength: 40_000 });
}

function publicFileError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  return error;
}
