import { MEBIBYTE } from "./measurement-units.ts";

const UPLOAD_LIMITS = Object.freeze({
  maxPdfBytes: 150 * MEBIBYTE,
  maxPages: 300,
  pdfSignature: "%PDF-",
  pdfSignatureSearchBytes: 1024,
  pdfMimeTypes: Object.freeze(["application/pdf", "application/x-pdf"]),
  pdfExtension: ".pdf",
  maxImageBytes: 20 * MEBIBYTE,
  maxImagePixels: 40_000_000,
  imageMimeTypes: Object.freeze(["image/png", "image/jpeg"]),
  originalNameCharacters: 200,
  multipartFields: 4,
  multipartFiles: 1,
  multipartFieldBytes: 4096,
});

export { UPLOAD_LIMITS };
