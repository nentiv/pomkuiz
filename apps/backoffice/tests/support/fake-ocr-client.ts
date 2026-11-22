import type { ClaudeClient, StructuredRequest } from "../../server/features/ocr/claude-client.ts";
import type { ExtractedQuestion } from "../../server/features/ocr/extraction-schema.ts";

const TEXT_LAYER = /<text_layer>\n([\s\S]*?)\n<\/text_layer>/;
const SIZE = /\((\d+)x(\d+) pixels\)/;
const QUESTION_LABEL = /^Question\s+(\d+)$/;
const CHOICE = /^([a-z])\.\s+(.*)$/;
const STATEMENT = /^(La reponse correcte est|Les reponses correctes sont)\s*:\s*(.*)$/;
const FIGURE_HINT = "suivante";

function emptyQuestion(number: number | null, continuesFromPrevious: boolean, height: number): ExtractedQuestion {
  return {
    number,
    continuesFromPrevious,
    continuesOnNext: false,
    type: "single",
    prompt: "",
    choices: [],
    explanation: null,
    correctAnswerStatement: null,
    figures: [],
    region: { top: 0, bottom: height },
    confidence: "high",
    issues: [],
  };
}

function parseFakeExtraction(prompt: string) {
  const [, widthText = "0", heightText = "0"] = SIZE.exec(prompt) ?? [];
  const width = Number(widthText);
  const height = Number(heightText);
  const rows = (TEXT_LAYER.exec(prompt)?.[1] ?? "").split("\n");
  const questions: ExtractedQuestion[] = [];
  let current: ExtractedQuestion | null = null;
  for (const row of rows) {
    const cells = row
      .split("\t")
      .map((cell) => cell.trim())
      .filter(Boolean);
    for (const cell of cells) {
      const label = QUESTION_LABEL.exec(cell);
      if (label) {
        current = emptyQuestion(Number(label[1]), false, height);
        questions.push(current);
        continue;
      }
      if (!current) {
        current = emptyQuestion(null, true, height);
        questions.push(current);
      }
      const choice = CHOICE.exec(cell);
      const statement = STATEMENT.exec(cell);
      if (choice)
        current.choices.push({ label: choice[1] ?? "", text: choice[2] ?? "", correct: false, explanation: null });
      else if (statement) {
        current.correctAnswerStatement = cell;
        current.type = statement[1]?.startsWith("Les") ? "multiple" : "single";
        const named = statement[2] ?? "";
        for (const item of current.choices) item.correct = named.split(", ").includes(item.text);
      } else if (current.choices.length === 0) {
        current.prompt = [current.prompt, cell].filter(Boolean).join("\n");
        if (cell.includes(FIGURE_HINT))
          current.figures.push({ left: 0, top: 0, right: width, bottom: height, target: "prompt" });
      }
    }
  }
  const last = questions.at(-1);
  if (last && last.correctAnswerStatement === null) last.continuesOnNext = true;
  for (const question of questions)
    if (question.correctAnswerStatement === null && !question.continuesOnNext) question.type = "multiple";
  return { questions };
}

function createFakeOcrClient(options: { failFirst?: number } = {}): ClaudeClient & { calls: StructuredRequest[] } {
  const calls: StructuredRequest[] = [];
  let failures = options.failFirst ?? 0;
  return {
    calls,
    async status() {
      return { executable: "/fake/claude", loggedIn: true, authMethod: "claude.ai", subscription: "pro" };
    },
    async requestStructured(request) {
      calls.push(request);
      if (failures > 0) {
        failures -= 1;
        return { questions: "not-an-array" };
      }
      return parseFakeExtraction(request.prompt);
    },
  };
}

export { createFakeOcrClient };
