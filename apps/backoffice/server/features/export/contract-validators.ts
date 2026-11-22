import type { Quiz, QuizIndex } from "@pomkuiz/quiz-contract";
import { CONTRACT_SCHEMAS } from "@pomkuiz/quiz-contract/schemas";
import { compileSchema, createAjv, type Validator } from "../../shared/json-schema-validation.ts";

interface ContractValidators {
  quiz: Validator<Quiz>;
  index: Validator<QuizIndex>;
}

function createContractValidators(): ContractValidators {
  const ajv = createAjv();
  return {
    quiz: compileSchema<Quiz>(CONTRACT_SCHEMAS.quiz, ajv),
    index: compileSchema<QuizIndex>(CONTRACT_SCHEMAS.index, ajv),
  };
}

export { createContractValidators };
export type { ContractValidators };
