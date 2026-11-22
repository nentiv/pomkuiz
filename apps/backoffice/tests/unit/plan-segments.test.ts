import { describe, expect, it } from "vitest";
import { RENDER_SETTINGS } from "../../server/config/render-settings.ts";
import { placeFigure } from "../../server/features/ocr/place-figure.ts";
import type { PageLayout, TextLine } from "../../server/features/render/page-geometry.ts";
import {
  compilePatterns,
  intervalsFromInk,
  intervalsFromLayout,
  planPageSegments,
  segmentRows,
} from "../../server/features/render/plan-segments.ts";

const settings = RENDER_SETTINGS.segment;
const patterns = compilePatterns(settings.questionStartPatterns);

function line(text: string, y: number, x = 100): TextLine {
  return { text, x0: x, x1: x + 300, y0: y, y1: y + 14 };
}

function moodlePage(questions: number, spacing: number): PageLayout {
  const lines: TextLine[] = [];
  for (let index = 0; index < questions; index += 1) {
    const top = 40 + index * spacing;
    lines.push(line(`Question ${index + 1}`, top, 20), line("Énoncé", top));
    for (let row = 1; row <= 6; row += 1) lines.push(line(`${row}. choix`, top + row * 20));
  }
  return { index: 0, width: 600, height: 40 + questions * spacing, lines, images: [] };
}

describe("segment planning", () => {
  it("cuts right above question labels and covers the content", () => {
    const layout = moodlePage(10, 200);
    const segments = planPageSegments(layout, intervalsFromLayout(layout, patterns), settings);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((segment) => !segment.forcedCut)).toBe(true);
    for (let index = 1; index < segments.length; index += 1) expect(segments[index]?.y0).toBe(segments[index - 1]?.y1);
    for (const segment of segments.slice(1)) {
      const rows = segmentRows(layout.lines, segment, settings.rowToleranceRatio, settings.columnSeparator);
      expect(rows[0]).toMatch(/^Question \d+\tÉnoncé$/);
    }
    const maxHeightPx = Math.min(
      settings.maxLongEdgePx,
      settings.maxPixels / ((segments[0]!.x1 - segments[0]!.x0) * segments[0]!.scale),
    );
    for (const segment of segments)
      expect((segment.y1 - segment.y0) * segment.scale).toBeLessThanOrEqual(maxHeightPx + 1);
  });

  it("forces a cut when a block is taller than the limit", () => {
    const layout: PageLayout = {
      index: 0,
      width: 600,
      height: 6000,
      lines: [],
      images: [{ x0: 50, x1: 550, y0: 10, y1: 5990 }],
    };
    const segments = planPageSegments(layout, intervalsFromLayout(layout, patterns), settings);
    expect(segments.some((segment) => segment.forcedCut)).toBe(true);
    expect(segments.at(-1)?.y1).toBeCloseTo(5990 + settings.contentPaddingPt);
  });

  it("falls back to ink rows for scanned pages", () => {
    const rows = Array.from({ length: 400 }, (_, row) => (row % 40 < 30 ? 0.2 : 0));
    const intervals = intervalsFromInk(rows, 4, RENDER_SETTINGS.ink.maxInkRatio);
    const layout: PageLayout = { index: 0, width: 600, height: 1600, lines: [], images: [] };
    const segments = planPageSegments(layout, intervals, settings);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((segment) => !segment.forcedCut)).toBe(true);
  });

  it("returns nothing for an empty page", () => {
    expect(planPageSegments({ index: 0, width: 600, height: 800, lines: [], images: [] }, [], settings)).toEqual([]);
  });
});

describe("figure placement", () => {
  const bounds = { x0: 0, y0: 0, x1: 600, y1: 800 };
  const image = { x0: 100, y0: 100, x1: 300, y1: 250 };

  it("snaps an approximate box onto the PDF image block", () => {
    const placed = placeFigure({ x0: 90, y0: 120, x1: 260, y1: 260 }, [image], bounds, RENDER_SETTINGS);
    expect(placed?.snapped).toBe(true);
    const padding = RENDER_SETTINGS.snappedFigurePaddingPt;
    expect(placed?.box).toEqual({ x0: 100 - padding, y0: 100 - padding, x1: 300 + padding, y1: 250 + padding });
  });

  it("keeps the estimate when nothing matches and ignores tiny boxes", () => {
    const placed = placeFigure({ x0: 400, y0: 400, x1: 500, y1: 500 }, [image], bounds, RENDER_SETTINGS);
    expect(placed?.snapped).toBe(false);
    expect(placeFigure({ x0: 400, y0: 400, x1: 405, y1: 405 }, [image], bounds, RENDER_SETTINGS)).toBeNull();
  });
});
