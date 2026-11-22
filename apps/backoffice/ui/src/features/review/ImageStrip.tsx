import { useRef } from "preact/hooks";
import { UI_CONFIG } from "../../ui-config.ts";
import { UI_MESSAGES } from "../../ui-messages.ts";
import { api } from "../../shared/api-client.ts";
import { ArrowLeft, ArrowRight, Crop, ImagePlus, RefreshCw, Trash2 } from "@pomkuiz/design-system/icons";
import { Button } from "@pomkuiz/design-system";
import type { DraftAction, ImageOwner } from "./draft-actions.ts";

interface ImageRequests {
  requestCrop: (owner: ImageOwner, replace: string | null) => void;
  upload: (owner: ImageOwner, file: File, replace: string | null) => void;
}

interface ImageStripProps {
  importId: string;
  owner: ImageOwner;
  images: readonly string[];
  dispatch: (action: DraftAction) => void;
  requests: ImageRequests;
}

function ImageStrip({ importId, owner, images, dispatch, requests }: ImageStripProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);
  const messages = UI_MESSAGES.editor;

  const pickFile = (replace: string | null) => {
    replacing.current = replace;
    fileInput.current?.click();
  };

  return (
    <div class="image-strip">
      {images.map((assetId, index) => (
        <figure key={assetId} class="thumb">
          <img src={api.assetUrl(importId, assetId)} alt={`${messages.images} ${index + 1}`} />
          <figcaption class="thumb-actions">
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              label={messages.moveUp}
              disabled={index === 0}
              onClick={() => dispatch({ type: "move-image", owner, assetId, offset: -1 })}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowRight}
              label={messages.moveDown}
              disabled={index === images.length - 1}
              onClick={() => dispatch({ type: "move-image", owner, assetId, offset: 1 })}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={Crop}
              label={messages.recrop}
              onClick={() => requests.requestCrop(owner, assetId)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              label={messages.replace}
              onClick={() => pickFile(assetId)}
            />
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              label={messages.remove}
              onClick={() => dispatch({ type: "remove-image", owner, assetId })}
            />
          </figcaption>
        </figure>
      ))}
      <div class="thumb-add">
        <Button
          variant="ghost"
          size="sm"
          icon={Crop}
          iconPosition="start"
          onClick={() => requests.requestCrop(owner, null)}
        >
          {messages.cropFromPage}
        </Button>
        <Button variant="ghost" size="sm" icon={ImagePlus} iconPosition="start" onClick={() => pickFile(null)}>
          {messages.upload}
        </Button>
        <input
          ref={fileInput}
          class="visually-hidden"
          type="file"
          accept={UI_CONFIG.acceptedImages}
          tabIndex={-1}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) requests.upload(owner, file, replacing.current);
          }}
        />
      </div>
    </div>
  );
}

export { ImageStrip };
export type { ImageRequests };
