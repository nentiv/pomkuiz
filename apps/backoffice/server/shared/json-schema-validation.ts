import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { AppError, type ErrorCode } from "./app-error.ts";

const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;

function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  return ajv;
}

const sharedAjv = createAjv();

function describeErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? ""}`.trim()).join("; ");
}

interface Validator<T> {
  (value: unknown): value is T;
  assert(value: unknown, code?: ErrorCode): T;
}

function toValidator<T>(validate: ValidateFunction): Validator<T> {
  const check = ((value: unknown) => validate(value)) as Validator<T>;
  check.assert = (value: unknown, code: ErrorCode = "invalidRequest") => {
    if (!validate(value)) throw new AppError(code, describeErrors(validate.errors));
    return value as T;
  };
  return check;
}

function compileSchema<T>(schema: object, ajv: Ajv2020 = sharedAjv): Validator<T> {
  return toValidator<T>(ajv.compile(schema));
}

export { createAjv, compileSchema };
export type { Validator };
