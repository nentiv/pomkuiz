import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef } from "preact/hooks";
import { DESIGN_MESSAGES } from "../design-settings.ts";
import { Button } from "./Button.tsx";
import { closeModal, openModal } from "./modal-dialog.ts";
import { X } from "./icons.ts";
import "./bottom-sheet.css";

const LIGHT_DISMISS = Object.freeze({ attribute: "closedby", value: "any" });

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialog.current?.setAttribute(LIGHT_DISMISS.attribute, LIGHT_DISMISS.value);
  }, []);

  useEffect(() => {
    if (open) openModal(dialog.current);
    else closeModal(dialog.current);
  }, [open]);

  return (
    <dialog ref={dialog} class="sheet" aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      <div class="sheet-body">
        <header class="sheet-header">
          <h2 id={titleId} class="sheet-title">
            {title}
          </h2>
          <Button variant="ghost" size="sm" icon={X} label={DESIGN_MESSAGES.close} onClick={onClose} />
        </header>
        {children}
      </div>
    </dialog>
  );
}

export { BottomSheet };
