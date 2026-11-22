import { OCR_PROMPT } from "../../config/ocr-prompt.ts";
import { cleanMultiline, fillTemplate } from "../../shared/text-cleaning.ts";

interface SegmentPromptInput {
  imageFile: string;
  width: number;
  height: number;
  textRows: readonly string[];
  previousRows: readonly string[];
  maxTextCharacters: number;
}

const ROW_SEPARATOR = "\n";

function buildSegmentPrompt(input: SegmentPromptInput): string {
  const textLayer = cleanMultiline(input.textRows.join(ROW_SEPARATOR), input.maxTextCharacters);
  const previousLines = cleanMultiline(input.previousRows.join(ROW_SEPARATOR), input.maxTextCharacters);
  return fillTemplate(OCR_PROMPT.instructions, {
    imageFile: input.imageFile,
    width: Math.round(input.width),
    height: Math.round(input.height),
    textLayer: textLayer || OCR_PROMPT.emptyTextLayer,
    previousContext: previousLines ? fillTemplate(OCR_PROMPT.previousContext, { previousLines }) : "",
  }).trimEnd();
}

function buildRetryPrompt(basePrompt: string, error: string): string {
  return `${basePrompt}\n\n${fillTemplate(OCR_PROMPT.retry, { error })}`;
}

export { buildSegmentPrompt, buildRetryPrompt };
