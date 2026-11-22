import { MEBIBYTE, SECOND_MS } from "./measurement-units.ts";

const SERVER_DEFAULTS = Object.freeze({
  host: "127.0.0.1",
  port: 4319,
  minimumPort: 1024,
  maximumPort: 65535,
  loopbackHosts: Object.freeze(["127.0.0.1", "::1", "localhost"]),
  allowedHostnames: Object.freeze(["127.0.0.1", "localhost"]),
  csrfHeader: Object.freeze({ name: "x-pomkuiz-request", value: "1" }),
  jsonBodyLimitBytes: 8 * MEBIBYTE,
  sseHeartbeatMs: 15 * SECOND_MS,
  safeMethods: Object.freeze(["GET", "HEAD", "OPTIONS"]),
  apiPrefix: "/api",
  securityHeaders: Object.freeze({
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "cache-control": "no-store",
  }),
});

export { SERVER_DEFAULTS };
