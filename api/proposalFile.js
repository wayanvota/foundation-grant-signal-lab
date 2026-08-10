const allowedTypes = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function extractProposalText(file) {
  if (!file?.buffer?.length) return "";
  if (!allowedTypes.has(file.mimetype)) throw publicFileError("Upload a TXT, Markdown, PDF, or DOCX proposal.");

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
  if (normalized.length < 80) throw publicFileError("The uploaded proposal did not contain enough readable text. Paste the text instead.");
  if (normalized.length > 40_000) throw publicFileError("The readable proposal text exceeds 40,000 characters. Upload a shorter decision-relevant excerpt.");
  return normalized;
}

function publicFileError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  return error;
}
