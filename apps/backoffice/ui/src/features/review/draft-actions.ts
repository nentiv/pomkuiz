import type {
  DraftChoice,
  DraftContent,
  DraftMeta,
  DraftQuestion,
  QuestionStatus,
} from "../../../../server/features/review/draft-types.ts";

interface ImageOwner {
  questionKey: string;
  choiceKey: string | null;
}

type DraftAction =
  | { type: "meta"; patch: Partial<DraftMeta> }
  | { type: "question"; key: string; patch: Partial<Omit<DraftQuestion, "key" | "choices">> }
  | { type: "choice"; questionKey: string; choiceKey: string; patch: Partial<Omit<DraftChoice, "key">> }
  | { type: "add-question"; afterKey: string | null; question: DraftQuestion }
  | { type: "remove-question"; key: string }
  | { type: "move-question"; key: string; offset: number }
  | { type: "add-choice"; questionKey: string; choice: DraftChoice }
  | { type: "remove-choice"; questionKey: string; choiceKey: string }
  | { type: "move-choice"; questionKey: string; choiceKey: string; offset: number }
  | { type: "status"; key: string; status: QuestionStatus }
  | { type: "add-image"; owner: ImageOwner; assetId: string }
  | { type: "replace-image"; owner: ImageOwner; previous: string; assetId: string }
  | { type: "remove-image"; owner: ImageOwner; assetId: string }
  | { type: "move-image"; owner: ImageOwner; assetId: string; offset: number };

function move<T>(items: readonly T[], index: number, offset: number): T[] {
  const target = index + offset;
  if (index < 0 || target < 0 || target >= items.length) return [...items];
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item as T);
  return copy;
}

function mapQuestion(
  content: DraftContent,
  key: string,
  change: (question: DraftQuestion) => DraftQuestion,
): DraftContent {
  return {
    ...content,
    questions: content.questions.map((question) => (question.key === key ? change(question) : question)),
  };
}

function mapImages(content: DraftContent, owner: ImageOwner, change: (images: string[]) => string[]): DraftContent {
  return mapQuestion(content, owner.questionKey, (question) =>
    owner.choiceKey === null
      ? { ...question, images: change(question.images) }
      : {
          ...question,
          choices: question.choices.map((choice) =>
            choice.key === owner.choiceKey ? { ...choice, images: change(choice.images) } : choice,
          ),
        },
  );
}

function enforceSingle(question: DraftQuestion, choiceKey: string, correct: boolean | undefined): DraftQuestion {
  if (question.type !== "single" || correct !== true) return question;
  return { ...question, choices: question.choices.map((choice) => ({ ...choice, correct: choice.key === choiceKey })) };
}

function applyDraftAction(content: DraftContent, action: DraftAction): DraftContent {
  switch (action.type) {
    case "meta":
      return { ...content, meta: { ...content.meta, ...action.patch } };
    case "question":
      return mapQuestion(content, action.key, (question) => ({ ...question, ...action.patch }));
    case "choice":
      return mapQuestion(content, action.questionKey, (question) =>
        enforceSingle(
          {
            ...question,
            choices: question.choices.map((choice) =>
              choice.key === action.choiceKey ? { ...choice, ...action.patch } : choice,
            ),
          },
          action.choiceKey,
          action.patch.correct,
        ),
      );
    case "add-question": {
      const index =
        action.afterKey === null ? -1 : content.questions.findIndex((question) => question.key === action.afterKey);
      const questions = [...content.questions];
      questions.splice(index + 1, 0, action.question);
      return { ...content, questions };
    }
    case "remove-question":
      return { ...content, questions: content.questions.filter((question) => question.key !== action.key) };
    case "move-question":
      return {
        ...content,
        questions: move(
          content.questions,
          content.questions.findIndex((question) => question.key === action.key),
          action.offset,
        ),
      };
    case "add-choice":
      return mapQuestion(content, action.questionKey, (question) => ({
        ...question,
        choices: [...question.choices, action.choice],
      }));
    case "remove-choice":
      return mapQuestion(content, action.questionKey, (question) => ({
        ...question,
        choices: question.choices.filter((choice) => choice.key !== action.choiceKey),
      }));
    case "move-choice":
      return mapQuestion(content, action.questionKey, (question) => ({
        ...question,
        choices: move(
          question.choices,
          question.choices.findIndex((choice) => choice.key === action.choiceKey),
          action.offset,
        ),
      }));
    case "status":
      return mapQuestion(content, action.key, (question) => ({ ...question, status: action.status }));
    case "add-image":
      return mapImages(content, action.owner, (images) =>
        images.includes(action.assetId) ? images : [...images, action.assetId],
      );
    case "replace-image":
      return mapImages(content, action.owner, (images) =>
        images.map((image) => (image === action.previous ? action.assetId : image)),
      );
    case "remove-image":
      return mapImages(content, action.owner, (images) => images.filter((image) => image !== action.assetId));
    case "move-image":
      return mapImages(content, action.owner, (images) => move(images, images.indexOf(action.assetId), action.offset));
    default:
      return content;
  }
}

function newChoice(key: string): DraftChoice {
  return { key, text: "", correct: false, explanation: "", images: [] };
}

function newQuestion(key: string, choiceKeys: readonly string[]): DraftQuestion {
  return {
    key,
    status: "unverified",
    number: null,
    type: "multiple",
    prompt: "",
    explanation: "",
    images: [],
    choices: choiceKeys.map(newChoice),
    source: null,
    issues: [],
  };
}

function nextIndexWithStatus(questions: readonly DraftQuestion[], from: number, status: QuestionStatus): number | null {
  for (let offset = 1; offset <= questions.length; offset += 1) {
    const index = (from + offset) % questions.length;
    if (questions[index]?.status === status) return index;
  }
  return null;
}

export { move, applyDraftAction, newChoice, newQuestion, nextIndexWithStatus };
export type { ImageOwner, DraftAction };
