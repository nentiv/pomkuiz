import { RichText } from "@pomkuiz/design-system";
import { UI_MESSAGES } from "../../ui-messages.ts";

const MIN_ROWS = 2;
const LINE_BREAK = "\n";

interface RichFieldProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
  minRows?: number;
  preview?: boolean;
  id: string;
}

function RichField({ label, value, onInput, minRows = MIN_ROWS, preview = true, id }: RichFieldProps) {
  const rows = Math.max(minRows, value.split(LINE_BREAK).length);
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <textarea id={id} rows={rows} value={value} spellcheck onInput={(event) => onInput(event.currentTarget.value)} />
      {preview && value.trim() && (
        <div class="preview" aria-label={UI_MESSAGES.editor.preview}>
          <RichText text={value} />
        </div>
      )}
    </div>
  );
}

export { RichField };
