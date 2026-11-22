import { readFile } from "node:fs/promises";
import type { AppConfig } from "../../config/app-config.ts";
import { throwIfAborted } from "../../shared/app-error.ts";
import { readJsonIfExists, writeFileAtomic, writeJsonAtomic } from "../../shared/safe-file-system.ts";
import { compileSchema } from "../../shared/json-schema-validation.ts";
import type { ImportStore } from "../upload/import-store.ts";
import type { Box } from "./page-geometry.ts";
import { openPdf, type PdfHandle } from "./pdf-document.ts";
import {
  compilePatterns,
  intervalsFromInk,
  intervalsFromLayout,
  planPageSegments,
  segmentRows,
  type PlannedSegment,
} from "./plan-segments.ts";

const PDF_MIME_TYPE = "application/pdf";

interface PlanPage {
  index: number;
  width: number;
  height: number;
  previewScale: number;
  images: Box[];
}

interface PlanSegment extends PlannedSegment {
  index: number;
  widthPx: number;
  heightPx: number;
  rows: string[];
}

interface ImportPlan {
  planVersion: 1;
  pages: PlanPage[];
  segments: PlanSegment[];
}

const box = {
  type: "object",
  required: ["x0", "y0", "x1", "y1"],
  properties: {
    x0: { type: "number" },
    y0: { type: "number" },
    x1: { type: "number" },
    y1: { type: "number" },
  },
};

const validatePlan = compileSchema<ImportPlan>({
  type: "object",
  required: ["planVersion", "pages", "segments"],
  properties: {
    planVersion: { const: 1 },
    pages: {
      type: "array",
      items: {
        type: "object",
        required: ["index", "width", "height", "previewScale", "images"],
        properties: {
          index: { type: "integer" },
          width: { type: "number" },
          height: { type: "number" },
          previewScale: { type: "number" },
          images: { type: "array", items: box },
        },
      },
    },
    segments: {
      type: "array",
      items: {
        type: "object",
        required: ["index", "page", "scale", "widthPx", "heightPx", "rows", "forcedCut", ...box.required],
        properties: {
          ...box.properties,
          index: { type: "integer" },
          page: { type: "integer" },
          scale: { type: "number" },
          widthPx: { type: "integer" },
          heightPx: { type: "integer" },
          forcedCut: { type: "boolean" },
          rows: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
});

async function loadPlan(store: ImportStore, importId: string): Promise<ImportPlan | null> {
  const raw = await readJsonIfExists(store.paths.plan(importId));
  return raw === null ? null : validatePlan.assert(raw, "unexpected");
}

function planPage(pdf: PdfHandle, pageIndex: number, render: AppConfig["render"]) {
  const layout = pdf.layout(pageIndex, render.structuredTextOptions);
  const patterns = compilePatterns(render.segment.questionStartPatterns);
  const hasStructure = layout.lines.length > 0 || layout.images.length > 0;
  const intervals = hasStructure
    ? intervalsFromLayout(layout, patterns)
    : intervalsFromInk(
        pdf.inkRows(pageIndex, render.ink.scale, render.ink.darknessThreshold),
        1 / render.ink.scale,
        render.ink.maxInkRatio,
      );
  return { layout, segments: planPageSegments(layout, intervals, render.segment) };
}

async function prepareImport(
  store: ImportStore,
  importId: string,
  config: AppConfig,
  signal?: AbortSignal,
): Promise<ImportPlan> {
  const existing = await loadPlan(store, importId);
  if (existing) return existing;
  const { render } = config;
  const pdf = openPdf(await readFile(store.paths.source(importId)), PDF_MIME_TYPE);
  try {
    const pages: PlanPage[] = [];
    const segments: PlanSegment[] = [];
    for (let pageIndex = 0; pageIndex < pdf.pageCount; pageIndex += 1) {
      throwIfAborted(signal);
      const { layout, segments: planned } = planPage(pdf, pageIndex, render);
      const previewScale = render.previewWidthPx / layout.width;
      await writeFileAtomic(store.paths.page(importId, pageIndex), pdf.renderPage(pageIndex, previewScale));
      pages.push({ index: pageIndex, width: layout.width, height: layout.height, previewScale, images: layout.images });
      for (const segment of planned) {
        throwIfAborted(signal);
        const index = segments.length;
        const png = pdf.renderRegion(pageIndex, segment, segment.scale);
        await writeFileAtomic(store.paths.segmentImage(importId, index), png);
        segments.push({
          ...segment,
          index,
          widthPx: Math.ceil(segment.x1 * segment.scale) - Math.floor(segment.x0 * segment.scale),
          heightPx: Math.ceil(segment.y1 * segment.scale) - Math.floor(segment.y0 * segment.scale),
          rows: segmentRows(layout.lines, segment, render.segment.rowToleranceRatio, render.segment.columnSeparator),
        });
      }
    }
    const plan: ImportPlan = { planVersion: 1, pages, segments };
    await writeJsonAtomic(store.paths.plan(importId), plan);
    return plan;
  } finally {
    pdf.close();
  }
}

function previousRows(plan: ImportPlan, segmentIndex: number, count: number): string[] {
  return plan.segments[segmentIndex - 1]?.rows.slice(-count) ?? [];
}

export { PDF_MIME_TYPE, loadPlan, prepareImport, previousRows };
export type { ImportPlan };
