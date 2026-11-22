interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TextLine extends Box {
  text: string;
}

interface PageLayout {
  index: number;
  width: number;
  height: number;
  lines: TextLine[];
  images: Box[];
}

const boxWidth = (box: Box): number => Math.max(0, box.x1 - box.x0);
const boxHeight = (box: Box): number => Math.max(0, box.y1 - box.y0);
const boxArea = (box: Box): number => boxWidth(box) * boxHeight(box);

function intersect(first: Box, second: Box): Box {
  return {
    x0: Math.max(first.x0, second.x0),
    y0: Math.max(first.y0, second.y0),
    x1: Math.min(first.x1, second.x1),
    y1: Math.min(first.y1, second.y1),
  };
}

function expand(box: Box, padding: number, bounds: Box): Box {
  return intersect(
    {
      x0: box.x0 - padding,
      y0: box.y0 - padding,
      x1: box.x1 + padding,
      y1: box.y1 + padding,
    },
    bounds,
  );
}

function normalizeBox(box: Box): Box {
  return {
    x0: Math.min(box.x0, box.x1),
    y0: Math.min(box.y0, box.y1),
    x1: Math.max(box.x0, box.x1),
    y1: Math.max(box.y0, box.y1),
  };
}

const pageBounds = (layout: Pick<PageLayout, "width" | "height">): Box => ({
  x0: 0,
  y0: 0,
  x1: layout.width,
  y1: layout.height,
});

export { boxWidth, boxHeight, boxArea, intersect, expand, normalizeBox, pageBounds };
export type { Box, TextLine, PageLayout };
