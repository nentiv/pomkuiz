import { boxHeight, type Box, type PageLayout, type TextLine } from "./page-geometry.ts";

interface SegmentPlanSettings {
  maxLongEdgePx: number;
  maxPixels: number;
  maxScale: number;
  minHeightRatio: number;
  contentPaddingPt: number;
  mergeGapPt: number;
  questionStartPatterns: readonly string[];
}

interface PlannedSegment extends Box {
  page: number;
  scale: number;
  forcedCut: boolean;
}

interface Interval {
  start: number;
  end: number;
  questionStart: boolean;
}

interface Cut {
  position: number;
  size: number;
  questionStart: boolean;
}

function contentBounds(layout: PageLayout, blocked: readonly Interval[], padding: number): Box {
  const boxes: Box[] = [...layout.lines, ...layout.images];
  const clampX = (value: number) => Math.min(layout.width, Math.max(0, value));
  const clampY = (value: number) => Math.min(layout.height, Math.max(0, value));
  if (boxes.length === 0) {
    const first = blocked[0];
    const last = blocked.at(-1);
    if (!first || !last) return { x0: 0, x1: 0, y0: 0, y1: 0 };
    return { x0: 0, x1: layout.width, y0: clampY(first.start - padding), y1: clampY(last.end + padding) };
  }
  return {
    x0: clampX(Math.min(...boxes.map((box) => box.x0)) - padding),
    x1: clampX(Math.max(...boxes.map((box) => box.x1)) + padding),
    y0: clampY(Math.min(...boxes.map((box) => box.y0)) - padding),
    y1: clampY(Math.max(...boxes.map((box) => box.y1)) + padding),
  };
}

function mergeIntervals(intervals: Interval[], mergeGap: number): Interval[] {
  const sorted = intervals.toSorted((first, second) => first.start - second.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end + mergeGap) {
      last.end = Math.max(last.end, interval.end);
      last.questionStart ||= interval.questionStart;
    } else merged.push({ ...interval });
  }
  return merged;
}

function intervalsFromLayout(layout: PageLayout, patterns: readonly RegExp[]): Interval[] {
  const isQuestionStart = (line: TextLine) => patterns.some((pattern) => pattern.test(line.text));
  return [
    ...layout.lines.map((line) => ({ start: line.y0, end: line.y1, questionStart: isQuestionStart(line) })),
    ...layout.images.map((image) => ({ start: image.y0, end: image.y1, questionStart: false })),
  ].filter((interval) => interval.end > interval.start);
}

function intervalsFromInk(rows: readonly number[], rowHeightPt: number, maxInkRatio: number): Interval[] {
  const intervals: Interval[] = [];
  rows.forEach((ink, row) => {
    if (ink <= maxInkRatio) return;
    intervals.push({ start: row * rowHeightPt, end: (row + 1) * rowHeightPt, questionStart: false });
  });
  return intervals;
}

function listCuts(merged: readonly Interval[]): Cut[] {
  const cuts: Cut[] = [];
  for (let index = 1; index < merged.length; index += 1) {
    const previous = merged[index - 1] as Interval;
    const next = merged[index] as Interval;
    cuts.push({
      position: (previous.end + next.start) / 2,
      size: next.start - previous.end,
      questionStart: next.questionStart,
    });
  }
  return cuts;
}

function chooseCut(cuts: readonly Cut[], from: number, to: number): Cut | null {
  const window = cuts.filter((cut) => cut.position > from && cut.position <= to);
  const questionStarts = window.filter((cut) => cut.questionStart);
  if (questionStarts.length > 0) return questionStarts.at(-1) ?? null;
  return window.reduce<Cut | null>((best, cut) => (!best || cut.size >= best.size ? cut : best), null);
}

function planPageSegments(
  layout: PageLayout,
  blocked: readonly Interval[],
  settings: SegmentPlanSettings,
): PlannedSegment[] {
  const merged = mergeIntervals([...blocked], settings.mergeGapPt);
  const bounds = contentBounds(layout, merged, settings.contentPaddingPt);
  const contentWidth = bounds.x1 - bounds.x0;
  if (contentWidth <= 0 || boxHeight(bounds) <= 0) return [];
  const scale = Math.min(settings.maxScale, settings.maxLongEdgePx / contentWidth);
  const widthPx = contentWidth * scale;
  const maxHeightPx = Math.min(settings.maxLongEdgePx, settings.maxPixels / widthPx);
  const maxHeight = maxHeightPx / scale;
  const minHeight = maxHeight * settings.minHeightRatio;
  const cuts = listCuts(merged);
  const segments: PlannedSegment[] = [];
  let top = bounds.y0;
  while (bounds.y1 - top > 0) {
    if (bounds.y1 - top <= maxHeight) {
      segments.push({ ...bounds, y0: top, page: layout.index, scale, forcedCut: false });
      break;
    }
    const cut = chooseCut(cuts, top + minHeight, top + maxHeight);
    const bottom = cut?.position ?? top + maxHeight;
    segments.push({ ...bounds, y0: top, y1: bottom, page: layout.index, scale, forcedCut: !cut });
    top = bottom;
  }
  return segments;
}

function compilePatterns(patterns: readonly string[]): RegExp[] {
  return patterns.map((pattern) => new RegExp(pattern, "u"));
}

function segmentRows(lines: readonly TextLine[], segment: Box, toleranceRatio: number, separator: string): string[] {
  const inside = lines
    .filter((line) => {
      const center = (line.y0 + line.y1) / 2;
      return center >= segment.y0 && center < segment.y1;
    })
    .toSorted((first, second) => first.y0 - second.y0 || first.x0 - second.x0);
  const rows: TextLine[][] = [];
  for (const line of inside) {
    const row = rows.at(-1);
    const anchor = row?.[0];
    const tolerance = boxHeight(line) * toleranceRatio;
    if (row && anchor && Math.abs(anchor.y0 - line.y0) <= tolerance) row.push(line);
    else rows.push([line]);
  }
  return rows.map((row) =>
    row
      .toSorted((first, second) => first.x0 - second.x0)
      .map((line) => line.text.trim())
      .join(separator),
  );
}

export { intervalsFromLayout, intervalsFromInk, planPageSegments, compilePatterns, segmentRows };
export type { PlannedSegment };
