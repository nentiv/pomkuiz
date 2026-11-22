const RENDER_SETTINGS = Object.freeze({
  previewWidthPx: 1200,
  figureScale: 2.5,
  maxFigurePixels: 16_000_000,
  figurePaddingPt: 6,
  snappedFigurePaddingPt: 2,
  minFigureSizePt: 24,
  figureSnapMinCoverage: 0.3,
  segment: Object.freeze({
    maxLongEdgePx: 1568,
    maxPixels: 1_150_000,
    maxScale: 2,
    minHeightRatio: 0.35,
    contentPaddingPt: 8,
    mergeGapPt: 2,
    rowToleranceRatio: 0.5,
    columnSeparator: "\t",
    questionStartPatterns: Object.freeze([String.raw`^\s*Question\s+\d+\b`]),
    contextRows: 4,
  }),
  ink: Object.freeze({
    scale: 0.25,
    darknessThreshold: 160,
    maxInkRatio: 0.002,
  }),
  structuredTextOptions: "preserve-images,preserve-whitespace",
});

export { RENDER_SETTINGS };
