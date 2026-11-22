import { boxArea, boxHeight, boxWidth, expand, intersect, type Box } from "../render/page-geometry.ts";
import type { PlannedSegment } from "../render/plan-segments.ts";
import type { ExtractedFigure } from "./extraction-schema.ts";

interface FigureSnapSettings {
  minFigureSizePt: number;
  figureSnapMinCoverage: number;
  figurePaddingPt: number;
  snappedFigurePaddingPt: number;
}

interface PlacedFigure {
  box: Box;
  snapped: boolean;
}

function figureToPage(figure: ExtractedFigure, segment: PlannedSegment): Box {
  return {
    x0: segment.x0 + figure.left / segment.scale,
    y0: segment.y0 + figure.top / segment.scale,
    x1: segment.x0 + figure.right / segment.scale,
    y1: segment.y0 + figure.bottom / segment.scale,
  };
}

const isSignificant = (box: Box, minimum: number) => boxWidth(box) >= minimum && boxHeight(box) >= minimum;

function union(boxes: readonly Box[]): Box {
  return {
    x0: Math.min(...boxes.map((box) => box.x0)),
    y0: Math.min(...boxes.map((box) => box.y0)),
    x1: Math.max(...boxes.map((box) => box.x1)),
    y1: Math.max(...boxes.map((box) => box.y1)),
  };
}

function placeFigure(
  estimate: Box,
  pageImages: readonly Box[],
  pageBounds: Box,
  settings: FigureSnapSettings,
): PlacedFigure | null {
  const matches = pageImages.filter((image) => {
    if (!isSignificant(image, settings.minFigureSizePt)) return false;
    const overlap = boxArea(intersect(estimate, image));
    return overlap / boxArea(image) >= settings.figureSnapMinCoverage;
  });
  if (matches.length > 0)
    return { box: expand(union(matches), settings.snappedFigurePaddingPt, pageBounds), snapped: true };
  if (!isSignificant(estimate, settings.minFigureSizePt)) return null;
  return { box: expand(estimate, settings.figurePaddingPt, pageBounds), snapped: false };
}

export { figureToPage, placeFigure };
