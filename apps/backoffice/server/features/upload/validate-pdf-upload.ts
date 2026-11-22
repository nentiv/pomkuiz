import { extname } from "node:path";
import type { AppConfig } from "../../config/app-config.ts";
import { AppError } from "../../shared/app-error.ts";
import { cleanSingleLine } from "../../shared/text-cleaning.ts";
import { openPdf } from "../render/pdf-document.ts";

interface PdfUpload {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}

const PDF_MIME = "application/pdf";

function hasPdfSignature(bytes: Uint8Array, signature: string, searchBytes: number): boolean {
  const head = Buffer.from(bytes.subarray(0, searchBytes)).toString("latin1");
  return head.includes(signature);
}

function displayName(fileName: string, maxCharacters: number): string {
  return cleanSingleLine(fileName.replaceAll(/[\\/]/g, " "), maxCharacters);
}

function validatePdfUpload(upload: PdfUpload, limits: AppConfig["upload"]): number {
  if (upload.bytes.byteLength === 0) throw new AppError("invalidPdf");
  if (upload.bytes.byteLength > limits.maxPdfBytes) throw new AppError("payloadTooLarge");
  const extensionMatches = extname(upload.fileName).toLowerCase() === limits.pdfExtension;
  if (!limits.pdfMimeTypes.includes(upload.mimeType) && !extensionMatches) throw new AppError("unsupportedMedia");
  if (!hasPdfSignature(upload.bytes, limits.pdfSignature, limits.pdfSignatureSearchBytes))
    throw new AppError("unsupportedMedia");
  const pdf = openPdf(upload.bytes, PDF_MIME);
  try {
    if (pdf.pageCount < 1) throw new AppError("invalidPdf");
    if (pdf.pageCount > limits.maxPages) throw new AppError("tooManyPages");
    return pdf.pageCount;
  } finally {
    pdf.close();
  }
}

export { displayName, validatePdfUpload };
