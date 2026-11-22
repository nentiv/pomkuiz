import { createReadStream } from "node:fs";
import type { FastifyReply } from "fastify";
import { ID_PATTERN } from "../config/workspace-layout.ts";
import { AppError } from "../shared/app-error.ts";
import { pathExists } from "../shared/safe-file-system.ts";

const PNG_MIME_TYPE = "image/png";

const importParams = {
  type: "object",
  additionalProperties: false,
  required: ["importId"],
  properties: { importId: { type: "string", pattern: ID_PATTERN.source } },
} as const;

const pageParams = {
  type: "object",
  additionalProperties: false,
  required: ["importId", "page"],
  properties: {
    importId: { type: "string", pattern: ID_PATTERN.source },
    page: { type: "integer", minimum: 0 },
  },
} as const;

const assetParams = {
  type: "object",
  additionalProperties: false,
  required: ["importId", "assetId"],
  properties: {
    importId: { type: "string", pattern: ID_PATTERN.source },
    assetId: { type: "string", pattern: ID_PATTERN.source },
  },
} as const;

interface ImportParams {
  importId: string;
}

async function sendPng(reply: FastifyReply, path: string): Promise<FastifyReply> {
  if (!(await pathExists(path))) throw new AppError("notFound");
  return reply.type(PNG_MIME_TYPE).send(createReadStream(path));
}

export { importParams, pageParams, assetParams, sendPng };
export type { ImportParams };
