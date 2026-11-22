import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertLoopbackHost } from "../../server/http/http-security.ts";
import { createTestContext, multipartBody, type TestContext } from "../support/test-context.ts";
import { createFakeOcrClient } from "../support/fake-ocr-client.ts";

describe("backoffice HTTP security", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext(createFakeOcrClient());
  });

  afterAll(async () => {
    await context.close();
  });

  it("only listens on loopback", () => {
    expect(() => assertLoopbackHost("0.0.0.0", context.config.server.loopbackHosts)).toThrow("non-loopback");
    expect(() => assertLoopbackHost("127.0.0.1", context.config.server.loopbackHosts)).not.toThrow();
  });

  it("rejects foreign Host headers (DNS rebinding)", async () => {
    const response = await context.request({
      method: "GET",
      url: "/api/imports",
      headers: { host: "evil.example:4319" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("requires the anti-CSRF header and a local Origin for mutations", async () => {
    const headerName = context.config.server.csrfHeader.name;
    const missing = await context.request({ method: "POST", url: "/api/imports", headers: { [headerName]: "" } });
    expect(missing.statusCode).toBe(403);
    const foreign = await context.request({
      method: "POST",
      url: "/api/imports",
      headers: { origin: "https://evil.example" },
    });
    expect(foreign.statusCode).toBe(403);
  });

  it("sets defensive headers", async () => {
    const response = await context.request({ method: "GET", url: "/api/imports" });
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("validates identifiers in routes", async () => {
    for (const url of [
      "/api/imports/..%2F..%2Fetc/draft",
      "/api/imports/not-a-uuid",
      "/api/imports/0b9c5f9e-3d1c-4b5e-9f2a-1c2d3e4f5a6b/pages/-1",
    ]) {
      const response = await context.request({ method: "GET", url });
      expect([400, 404]).toContain(response.statusCode);
    }
  });

  it("refuses files that are not PDFs", async () => {
    const fake = multipartBody(
      "file",
      "cours.pdf",
      "application/pdf",
      new TextEncoder().encode("<html>not a pdf</html>"),
    );
    const response = await context.request({ method: "POST", url: "/api/imports", ...fake });
    expect(response.statusCode).toBe(415);
    const broken = multipartBody("file", "cours.pdf", "application/pdf", new TextEncoder().encode("%PDF-1.7\ngarbage"));
    expect((await context.request({ method: "POST", url: "/api/imports", ...broken })).statusCode).toBe(422);
  });
});
