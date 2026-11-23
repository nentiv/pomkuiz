import { CONTRACT_LIMITS, QUESTION_TYPES } from "@pomkuiz/quiz-contract";
import { ID_SCHEMA } from "../../shared/identifiers.ts";
import { compileSchema } from "../../shared/json-schema-validation.ts";
import { DRAFT_LIMITS, QUESTION_STATUSES, type Draft, type DraftContent } from "./draft-types.ts";

const richText = { type: "string", maxLength: CONTRACT_LIMITS.richTextCharacters };
const assetIds = { type: "array", maxItems: CONTRACT_LIMITS.maxImages, uniqueItems: true, items: ID_SCHEMA };

const choiceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "text", "correct", "explanation", "images"],
  properties: {
    key: ID_SCHEMA,
    text: richText,
    correct: { type: "boolean" },
    explanation: richText,
    images: assetIds,
  },
};

const questionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "status", "number", "type", "prompt", "explanation", "images", "choices", "source", "issues"],
  properties: {
    key: ID_SCHEMA,
    status: { enum: [...QUESTION_STATUSES] },
    number: { type: ["integer", "null"], minimum: 1 },
    type: { enum: [...QUESTION_TYPES] },
    prompt: richText,
    explanation: richText,
    images: assetIds,
    choices: { type: "array", maxItems: CONTRACT_LIMITS.maxChoices, items: choiceSchema },
    source: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["page", "y0", "y1"],
          properties: {
            page: { type: "integer", minimum: 0 },
            y0: { type: "number" },
            y1: { type: "number" },
          },
        },
      ],
    },
    issues: {
      type: "array",
      maxItems: DRAFT_LIMITS.maxIssues,
      items: { type: "string", maxLength: DRAFT_LIMITS.issueCharacters },
    },
  },
};

const metaSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "description", "tags"],
  properties: {
    id: { type: "string", maxLength: CONTRACT_LIMITS.slugCharacters },
    title: { type: "string", maxLength: CONTRACT_LIMITS.titleCharacters },
    description: { type: "string", maxLength: CONTRACT_LIMITS.descriptionCharacters },
    section: { type: "string", maxLength: CONTRACT_LIMITS.sectionCharacters },
    tags: {
      type: "array",
      maxItems: CONTRACT_LIMITS.maxTags,
      items: { type: "string", minLength: 1, maxLength: CONTRACT_LIMITS.tagCharacters },
    },
  },
};

const validateDraftUpdate = compileSchema<DraftContent & { revision: number }>({
  type: "object",
  additionalProperties: false,
  required: ["revision", "meta", "questions"],
  properties: {
    revision: { type: "integer", minimum: 0 },
    meta: metaSchema,
    questions: { type: "array", maxItems: CONTRACT_LIMITS.maxQuestions, items: questionSchema },
  },
});

const validateDraft = compileSchema<Draft>({
  type: "object",
  additionalProperties: false,
  required: ["draftVersion", "importId", "revision", "updatedAt", "meta", "questions", "lastExport"],
  properties: {
    draftVersion: { const: 1 },
    importId: ID_SCHEMA,
    revision: { type: "integer", minimum: 0 },
    updatedAt: { type: "string" },
    meta: metaSchema,
    questions: { type: "array", maxItems: CONTRACT_LIMITS.maxQuestions, items: questionSchema },
    lastExport: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["quizId", "at"],
          properties: { quizId: { type: "string" }, at: { type: "string" } },
        },
      ],
    },
  },
});

export { validateDraftUpdate, validateDraft };
