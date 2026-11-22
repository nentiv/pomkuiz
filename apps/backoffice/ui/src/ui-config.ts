import { SERVER_DEFAULTS } from "../../server/config/server-settings.ts";

const UI_CONFIG = Object.freeze({
  apiPrefix: SERVER_DEFAULTS.apiPrefix,
  csrfHeader: SERVER_DEFAULTS.csrfHeader,
  eventsPath: `${SERVER_DEFAULTS.apiPrefix}/events`,
  progressEvent: "progress",
  autosaveDelayMs: 800,
  savedBadgeMs: 1500,
  snippetCharacters: 70,
  acceptedPdf: "application/pdf,.pdf",
  acceptedImages: "image/png,image/jpeg",
  tagSeparator: ",",
  minCropPx: 8,
  sourceScrollMarginRatio: 0.15,
});

const SHORTCUTS = Object.freeze({
  nextCode: "ArrowDown",
  previousCode: "ArrowUp",
  needsReviewCode: "KeyR",
  unverifiedCode: "KeyU",
  nextToReviewCode: "KeyN",
  verifyKey: "Enter",
  saveCode: "KeyS",
  cancelKey: "Escape",
});

export { UI_CONFIG, SHORTCUTS };
