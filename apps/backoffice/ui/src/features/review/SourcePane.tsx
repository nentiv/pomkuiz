import { useEffect, useRef, useState } from "preact/hooks";
import type { SourceLocation } from "../../../../server/features/review/draft-types.ts";
import { SHORTCUTS, UI_CONFIG } from "../../ui-config.ts";
import { UI_MESSAGES } from "../../ui-messages.ts";
import { api } from "../../shared/api-client.ts";
import { Button, Icon } from "@pomkuiz/design-system";
import { Crop, X } from "@pomkuiz/design-system/icons";

interface PageInfo {
  index: number;
  width: number;
  height: number;
}

interface CropBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface SourcePaneProps {
  importId: string;
  pages: readonly PageInfo[];
  source: SourceLocation | null;
  cropping: boolean;
  onCrop: (page: number, box: CropBox) => void;
  onCancelCrop: () => void;
}

interface Drag {
  startX: number;
  startY: number;
  x: number;
  y: number;
}

function pointerPosition(event: PointerEvent): { x: number; y: number } {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function SourcePane({ importId, pages, source, cropping, onCrop, onCancelCrop }: SourcePaneProps) {
  const [pageIndex, setPageIndex] = useState(source?.page ?? 0);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const page = pages.find((item) => item.index === pageIndex) ?? pages[0];
  const scale = page && displayWidth ? displayWidth / page.width : 0;

  useEffect(() => {
    if (source) setPageIndex(source.page);
  }, [source]);

  useEffect(() => {
    const element = image.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setDisplayWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageIndex]);

  useEffect(() => {
    const container = scroller.current;
    if (!container || !source || source.page !== pageIndex || !scale) return;
    const margin = container.clientHeight * UI_CONFIG.sourceScrollMarginRatio;
    container.scrollTo({ top: Math.max(0, source.y0 * scale - margin), behavior: "smooth" });
  }, [source, pageIndex, scale]);

  useEffect(() => {
    if (!cropping) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== SHORTCUTS.cancelKey) return;
      setDrag(null);
      onCancelCrop();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [cropping, onCancelCrop]);

  const finishDrag = () => {
    if (!drag || !scale || !page) return;
    setDrag(null);
    const width = Math.abs(drag.x - drag.startX);
    const height = Math.abs(drag.y - drag.startY);
    if (width < UI_CONFIG.minCropPx || height < UI_CONFIG.minCropPx) return;
    onCrop(page.index, {
      x0: Math.min(drag.x, drag.startX) / scale,
      y0: Math.min(drag.y, drag.startY) / scale,
      x1: Math.max(drag.x, drag.startX) / scale,
      y1: Math.max(drag.y, drag.startY) / scale,
    });
  };

  if (!page) return null;
  const highlight =
    source && source.page === page.index && scale
      ? { top: source.y0 * scale, height: Math.max(0, source.y1 - source.y0) * scale }
      : null;
  const selection = drag
    ? {
        left: Math.min(drag.x, drag.startX),
        top: Math.min(drag.y, drag.startY),
        width: Math.abs(drag.x - drag.startX),
        height: Math.abs(drag.y - drag.startY),
      }
    : null;

  return (
    <section class="source-pane" aria-label={UI_MESSAGES.source.title}>
      <div class="pane-toolbar">
        {pages.length > 1 ? (
          <select value={page.index} onChange={(event) => setPageIndex(Number(event.currentTarget.value))}>
            {pages.map((item) => (
              <option key={item.index} value={item.index}>
                {UI_MESSAGES.source.page(item.index + 1, pages.length)}
              </option>
            ))}
          </select>
        ) : (
          <span>{UI_MESSAGES.source.page(1, 1)}</span>
        )}
        {cropping && (
          <span class="crop-hint">
            <Icon icon={Crop} size="sm" />
            {UI_MESSAGES.source.cropping}
            <Button variant="ghost" size="sm" icon={X} iconPosition="start" onClick={onCancelCrop}>
              {UI_MESSAGES.source.cancel}
            </Button>
          </span>
        )}
      </div>
      <div ref={scroller} class="source-scroller">
        <div
          class={`source-page${cropping ? " is-cropping" : ""}`}
          onPointerDown={(event) => {
            if (!cropping) return;
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            const { x, y } = pointerPosition(event);
            setDrag({ startX: x, startY: y, x, y });
          }}
          onPointerMove={(event) => {
            if (!drag) return;
            const { x, y } = pointerPosition(event);
            setDrag({ ...drag, x, y });
          }}
          onPointerUp={finishDrag}
        >
          <img
            ref={image}
            src={api.pageUrl(importId, page.index)}
            alt={UI_MESSAGES.source.page(page.index + 1, pages.length)}
            draggable={false}
          />
          {highlight && (
            <div class="source-highlight" style={{ top: `${highlight.top}px`, height: `${highlight.height}px` }} />
          )}
          {selection && (
            <div
              class="crop-selection"
              style={{
                left: `${selection.left}px`,
                top: `${selection.top}px`,
                width: `${selection.width}px`,
                height: `${selection.height}px`,
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export { SourcePane };
export type { CropBox };
