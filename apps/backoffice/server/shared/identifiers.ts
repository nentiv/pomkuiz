import { randomUUID } from "node:crypto";
import { ID_PATTERN } from "../config/workspace-layout.ts";
import { AppError } from "./app-error.ts";

const createId = (): string => randomUUID();

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function assertId(value: unknown): string {
  if (!isId(value)) throw new AppError("invalidRequest");
  return value;
}

const ID_SCHEMA = Object.freeze({ type: "string", pattern: ID_PATTERN.source });

export { createId, isId, assertId, ID_SCHEMA };
