import {
  DATA_LAYOUT,
  slugify,
  QUIZ_SCHEMA_VERSION,
  type Choice,
  type Question,
  type Quiz,
} from "@pomkuiz/quiz-contract";
import { localDate } from "../../shared/local-date.ts";
import type { DraftContent, DraftQuestion } from "../review/draft-types.ts";

interface AssetFile {
  assetId: string;
  path: string;
}

const CHOICE_IDS = "abcdefghijklmnopqrstuvwxyz";
const QUESTION_PREFIX = "q";
const NAME_SEPARATOR = "-";

function resolveQuizId(content: DraftContent): string {
  return content.meta.id.trim() || slugify(content.meta.title);
}

function assetPath(...parts: (string | number)[]): string {
  return `${DATA_LAYOUT.assetsDirectory}/${parts.join(NAME_SEPARATOR)}${DATA_LAYOUT.assetExtension}`;
}

function convertQuestion(question: DraftQuestion, position: number, files: AssetFile[]): Question {
  const questionId = `${QUESTION_PREFIX}${position}`;
  const attach = (assetIds: readonly string[], ...prefix: string[]) =>
    assetIds.map((assetId, index) => {
      const path = assetPath(questionId, ...prefix, index + 1);
      files.push({ assetId, path });
      return path;
    });
  const choices = question.choices.map((choice, index): Choice => {
    const id = CHOICE_IDS[index] ?? `${QUESTION_PREFIX}${index}`;
    const images = attach(choice.images, id);
    const explanation = choice.explanation.trim();
    return {
      id,
      text: choice.text.trim(),
      correct: choice.correct,
      ...(images.length > 0 ? { images } : {}),
      ...(explanation ? { explanation } : {}),
    };
  });
  const images = attach(question.images);
  const explanation = question.explanation.trim();
  return {
    id: questionId,
    type: question.type,
    prompt: question.prompt.trim(),
    ...(images.length > 0 ? { images } : {}),
    choices,
    ...(explanation ? { explanation } : {}),
  };
}

function draftToQuiz(content: DraftContent, today: Date): { quiz: Quiz; files: AssetFile[] } {
  const files: AssetFile[] = [];
  const description = content.meta.description.trim();
  const section = content.meta.section?.trim() ?? "";
  const tags = [...new Set(content.meta.tags.map((tag) => tag.trim()).filter(Boolean))];
  const quiz: Quiz = {
    schemaVersion: QUIZ_SCHEMA_VERSION,
    id: resolveQuizId(content),
    title: content.meta.title.trim(),
    ...(description ? { description } : {}),
    ...(section ? { section } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    updatedAt: localDate(today),
    questions: content.questions.map((question, index) => convertQuestion(question, index + 1, files)),
  };
  return { quiz, files };
}

export { draftToQuiz };
