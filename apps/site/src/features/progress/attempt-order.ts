import type { Question, Quiz } from "@pomkuiz/quiz-contract";

interface AttemptOrder {
  questions: string[];
  choices: Record<string, string[]>;
}

type RandomSource = () => number;

const UINT32_RANGE = 2 ** 32;

const secureRandom: RandomSource = () => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / UINT32_RANGE;

function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
  }
  return copy;
}

function createOrder(quiz: Quiz, random: RandomSource): AttemptOrder {
  return {
    questions: shuffled(
      quiz.questions.map((question) => question.id),
      random,
    ),
    choices: Object.fromEntries(
      quiz.questions.map((question) => [
        question.id,
        shuffled(
          question.choices.map((choice) => choice.id),
          random,
        ),
      ]),
    ),
  };
}

function arrange<T extends { id: string }>(items: readonly T[], order: readonly string[] | undefined): T[] {
  if (!order) return [...items];
  const position = new Map(order.map((id, index) => [id, index]));
  return items
    .map((item, index) => ({ item, rank: position.get(item.id) ?? order.length + index }))
    .toSorted((first, second) => first.rank - second.rank)
    .map(({ item }) => item);
}

function applyOrder(questions: readonly Question[], order: AttemptOrder | null): Question[] {
  if (!order) return [...questions];
  return arrange(questions, order.questions).map((question) => ({
    ...question,
    choices: arrange(question.choices, order.choices[question.id]),
  }));
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function parseOrder(value: unknown): AttemptOrder | null {
  if (typeof value !== "object" || value === null) return null;
  const { questions, choices } = value as Record<string, unknown>;
  if (!isStringArray(questions) || typeof choices !== "object" || choices === null) return null;
  const parsed: Record<string, string[]> = {};
  for (const [questionId, ids] of Object.entries(choices)) if (isStringArray(ids)) parsed[questionId] = ids;
  return { questions, choices: parsed };
}

export { secureRandom, shuffled, createOrder, applyOrder, parseOrder };
export type { AttemptOrder, RandomSource };
