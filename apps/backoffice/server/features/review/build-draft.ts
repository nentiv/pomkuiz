import { slugify } from "@pomkuiz/quiz-contract";
import type { AppConfig } from "../../config/app-config.ts";
import { TITLE_DATES } from "../../config/title-dates.ts";
import { ISSUE_MESSAGES } from "../../config/user-messages.ts";
import { createId } from "../../shared/identifiers.ts";
import { defaultQuizTitle } from "./default-quiz-title.ts";
import { cleanSingleLine, fillTemplate } from "../../shared/text-cleaning.ts";
import { reviewAssembledQuestion } from "../ocr/question-checks.ts";
import { PROMPT_FIGURE_TARGET } from "../ocr/extraction-schema.ts";
import { figureToPage, placeFigure } from "../ocr/place-figure.ts";
import { assembleQuestions, type AssembledQuestion, type SegmentResult } from "../ocr/assemble-questions.ts";
import { pageBounds } from "../render/page-geometry.ts";
import type { PdfHandle } from "../render/pdf-document.ts";
import type { ImportPlan } from "../render/prepare-import.ts";
import type { ImportRecord } from "../upload/import-store.ts";
import type { AssetService } from "./asset-service.ts";
import { DRAFT_LIMITS, type Draft, type DraftQuestion, type SourceLocation } from "./draft-types.ts";

function sourceOf(assembled: AssembledQuestion, plan: ImportPlan): SourceLocation | null {
  const first = assembled.regions[0];
  const segment = first ? plan.segments[first.segmentIndex] : undefined;
  if (!first || !segment) return null;
  const samePage = assembled.regions.filter((region) => plan.segments[region.segmentIndex]?.page === segment.page);
  const last = samePage.at(-1) ?? first;
  const lastSegment = plan.segments[last.segmentIndex] ?? segment;
  return {
    page: segment.page,
    y0: segment.y0 + first.top / segment.scale,
    y1: lastSegment.y0 + last.bottom / lastSegment.scale,
  };
}

async function buildQuestion(
  assembled: AssembledQuestion,
  context: { plan: ImportPlan; pdf: PdfHandle; importId: string; assets: AssetService; config: AppConfig },
): Promise<DraftQuestion> {
  const { question } = assembled;
  const issues = [...question.issues, ...reviewAssembledQuestion(assembled)];
  const draft: DraftQuestion = {
    key: createId(),
    status: "unverified",
    number: question.number,
    type: question.type,
    prompt: question.prompt,
    explanation: question.explanation ?? "",
    images: [],
    choices: question.choices.map((choice) => ({
      key: createId(),
      text: choice.text,
      correct: choice.correct,
      explanation: choice.explanation ?? "",
      images: [],
    })),
    source: sourceOf(assembled, context.plan),
    issues: [],
  };
  for (const { segmentIndex, figure } of assembled.figures) {
    const segment = context.plan.segments[segmentIndex];
    const page = segment ? context.plan.pages[segment.page] : undefined;
    if (!segment || !page) continue;
    const placed = placeFigure(figureToPage(figure, segment), page.images, pageBounds(page), context.config.render);
    if (!placed) continue;
    if (!placed.snapped) issues.push(ISSUE_MESSAGES.figureNotSnapped);
    const asset = await context.assets.cropFromPdf(context.importId, context.pdf, page.index, placed.box, "auto");
    const choiceIndex = question.choices.findIndex((choice) => choice.label === figure.target);
    const owner = choiceIndex >= 0 ? draft.choices[choiceIndex] : undefined;
    if (owner) owner.images.push(asset.id);
    else {
      if (figure.target !== PROMPT_FIGURE_TARGET)
        issues.push(fillTemplate(ISSUE_MESSAGES.figureTargetUnknown, { target: figure.target }));
      draft.images.push(asset.id);
    }
  }
  draft.issues = [...new Set(issues)]
    .map((issue) => cleanSingleLine(issue, DRAFT_LIMITS.issueCharacters))
    .slice(0, DRAFT_LIMITS.maxIssues);
  draft.status = draft.issues.length > 0 ? "needs_review" : "unverified";
  return draft;
}

async function buildDraft(input: {
  record: ImportRecord;
  plan: ImportPlan;
  results: readonly SegmentResult[];
  pdf: PdfHandle;
  assets: AssetService;
  config: AppConfig;
  titleCharacters: number;
}): Promise<Draft> {
  const assembled = assembleQuestions(input.results);
  const questions: DraftQuestion[] = [];
  for (const item of assembled)
    questions.push(
      await buildQuestion(item, {
        plan: input.plan,
        pdf: input.pdf,
        importId: input.record.id,
        assets: input.assets,
        config: input.config,
      }),
    );
  const title = defaultQuizTitle({
    originalName: input.record.originalName,
    importedAt: input.record.createdAt,
    pdfCreationDate: input.pdf.metadata(TITLE_DATES.pdfCreationDateKey),
    maxCharacters: input.titleCharacters,
  });
  return {
    draftVersion: 1,
    importId: input.record.id,
    revision: 0,
    updatedAt: new Date().toISOString(),
    meta: { id: slugify(title), title, description: "", section: "", tags: [] },
    questions,
    lastExport: null,
  };
}

export { buildDraft };
