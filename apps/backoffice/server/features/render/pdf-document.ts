import * as mupdf from "mupdf";
import { AppError } from "../../shared/app-error.ts";
import type { Box, PageLayout, TextLine } from "./page-geometry.ts";

interface StructuredBlock {
  type: "text" | "image";
  bbox: { x: number; y: number; w: number; h: number };
  lines?: { bbox: { x: number; y: number; w: number; h: number }; text: string }[];
}

interface Destroyable {
  destroy(): void;
}

function using<T extends Destroyable, R>(resource: T, action: (resource: T) => R): R {
  try {
    return action(resource);
  } finally {
    resource.destroy();
  }
}

const toBox = (bbox: StructuredBlock["bbox"]): Box => ({
  x0: bbox.x,
  y0: bbox.y,
  x1: bbox.x + bbox.w,
  y1: bbox.y + bbox.h,
});

interface PdfHandle {
  pageCount: number;
  layout(pageIndex: number, structuredTextOptions: string): PageLayout;
  renderRegion(pageIndex: number, region: Box, scale: number): Uint8Array;
  renderPage(pageIndex: number, scale: number): Uint8Array;
  inkRows(pageIndex: number, scale: number, darknessThreshold: number): number[];
  metadata(key: string): string | undefined;
  close(): void;
}

function openPdf(bytes: Uint8Array, mimeType: string): PdfHandle {
  let document: mupdf.Document;
  try {
    document = mupdf.Document.openDocument(bytes, mimeType);
  } catch (error) {
    throw new AppError("invalidPdf", (error as Error).message);
  }
  if (!document.isPDF()) {
    document.destroy();
    throw new AppError("invalidPdf");
  }
  if (document.needsPassword()) {
    document.destroy();
    throw new AppError("encryptedPdf");
  }
  const pageCount = document.countPages();
  const withPage = <R>(pageIndex: number, action: (page: mupdf.Page) => R): R =>
    using(document.loadPage(pageIndex), action);

  return {
    pageCount,
    layout(pageIndex, structuredTextOptions) {
      return withPage(pageIndex, (page) => {
        const [x0, y0, x1, y1] = page.getBounds();
        const structured = using(
          page.toStructuredText(structuredTextOptions),
          (text) => JSON.parse(text.asJSON()) as { blocks: StructuredBlock[] },
        );
        const lines: TextLine[] = [];
        const images: Box[] = [];
        for (const block of structured.blocks) {
          if (block.type === "image") images.push(toBox(block.bbox));
          for (const line of block.lines ?? [])
            if (line.text.trim()) lines.push({ ...toBox(line.bbox), text: line.text });
        }
        return { index: pageIndex, width: x1 - x0, height: y1 - y0, lines, images };
      });
    },
    renderRegion(pageIndex, region, scale) {
      return withPage(pageIndex, (page) => {
        const bbox: mupdf.Rect = [
          Math.floor(region.x0 * scale),
          Math.floor(region.y0 * scale),
          Math.ceil(region.x1 * scale),
          Math.ceil(region.y1 * scale),
        ];
        return using(new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, bbox, false), (pixmap) => {
          pixmap.clear(255);
          using(new mupdf.DrawDevice(mupdf.Matrix.identity, pixmap), (device) => {
            page.run(device, mupdf.Matrix.scale(scale, scale));
            device.close();
          });
          return pixmap.asPNG();
        });
      });
    },
    renderPage(pageIndex, scale) {
      return withPage(pageIndex, (page) =>
        using(page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true), (pixmap) =>
          pixmap.asPNG(),
        ),
      );
    },
    inkRows(pageIndex, scale, darknessThreshold) {
      return withPage(pageIndex, (page) =>
        using(page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceGray, false, true), (pixmap) => {
          const width = pixmap.getWidth();
          const stride = pixmap.getStride();
          const pixels = pixmap.getPixels();
          return Array.from({ length: pixmap.getHeight() }, (_, row) => {
            let ink = 0;
            const offset = row * stride;
            for (let column = 0; column < width; column += 1)
              if ((pixels[offset + column] ?? 255) < darknessThreshold) ink += 1;
            return ink / width;
          });
        }),
      );
    },
    metadata(key) {
      return document.getMetaData(key);
    },
    close() {
      document.destroy();
    },
  };
}

interface DecodedImage {
  png: Uint8Array;
  width: number;
  height: number;
}

function reencodeImage(bytes: Uint8Array, maxPixels: number): DecodedImage {
  let image: mupdf.Image;
  try {
    image = new mupdf.Image(bytes);
  } catch (error) {
    throw new AppError("invalidImage", (error as Error).message);
  }
  return using(image, (source) => {
    const width = source.getWidth();
    const height = source.getHeight();
    if (width < 1 || height < 1 || width * height > maxPixels) throw new AppError("invalidImage");
    return using(source.toPixmap(), (pixmap) => {
      const rgb =
        pixmap.getColorSpace()?.isRGB() && !pixmap.getAlpha()
          ? null
          : pixmap.convertToColorSpace(mupdf.ColorSpace.DeviceRGB, false);
      try {
        return { png: (rgb ?? pixmap).asPNG(), width, height };
      } finally {
        rgb?.destroy();
      }
    });
  });
}

export { openPdf, reencodeImage };
export type { PdfHandle };
