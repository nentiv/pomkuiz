import type { Plugin } from "vite";
import { DATA_LAYOUT } from "@pomkuiz/quiz-contract";
import { loadDataDirectory } from "./load-quiz-data.ts";
import { findPublishViolations, listFiles } from "./publish-guard.ts";

const MIME_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
});

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function quizDataPlugin(options: { dataDirectory: string }): Plugin {
  const publicPrefix = `/${DATA_LAYOUT.publicDirectory}/`;
  return {
    name: "pomkuiz-quiz-data",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url?.split("?")[0] ?? "";
        const base = server.config.base.replace(/\/$/, "");
        const path = url.startsWith(`${base}${publicPrefix}`) ? url.slice(base.length + publicPrefix.length) : null;
        if (path === null) return next();
        try {
          const { files } = await loadDataDirectory(options.dataDirectory);
          const file = files.find((candidate) => candidate.path === decodeURIComponent(path));
          if (!file) {
            response.statusCode = 404;
            return response.end();
          }
          const extension = file.path.slice(file.path.lastIndexOf("."));
          response.setHeader("content-type", MIME_TYPES[extension] ?? "application/octet-stream");
          response.setHeader("cache-control", "no-store");
          return response.end(Buffer.from(file.bytes));
        } catch (error) {
          server.config.logger.error((error as Error).message);
          response.statusCode = 500;
          return response.end((error as Error).message);
        }
      });
    },
    async generateBundle() {
      const { files, index } = await loadDataDirectory(options.dataDirectory);
      for (const file of files)
        this.emitFile({ type: "asset", fileName: `${DATA_LAYOUT.publicDirectory}/${file.path}`, source: file.bytes });
      this.info(`${index.quizzes.length} QCM publié(s)`);
    },
  };
}

function contentSecurityPolicyPlugin(): Plugin {
  return {
    name: "pomkuiz-csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
        injectTo: "head-prepend",
      },
    ],
  };
}

function publishGuardPlugin(options: { outDir: string }): Plugin {
  return {
    name: "pomkuiz-publish-guard",
    apply: "build",
    async closeBundle() {
      const violations = findPublishViolations(await listFiles(options.outDir));
      if (violations.length > 0) throw new Error(`Publication refusée :\n${violations.join("\n")}`);
    },
  };
}

export { quizDataPlugin, contentSecurityPolicyPlugin, publishGuardPlugin };
