import { KEYBOARD } from "../../shared/config/app-config.ts";

type SessionCommand = { kind: "previous" } | { kind: "next" } | { kind: "confirm" } | { kind: "toggle"; index: number };

const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const TOGGLE_INPUTS = new Set(["checkbox", "radio"]);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (!EDITABLE.has(target.tagName)) return false;
  return !(target instanceof HTMLInputElement && TOGGLE_INPUTS.has(target.type));
}

function commandFor(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">): SessionCommand | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === KEYBOARD.previous) return { kind: "previous" };
  if (event.key === KEYBOARD.next) return { kind: "next" };
  if (event.key === KEYBOARD.confirm) return { kind: "confirm" };
  const key = event.key.toLowerCase();
  if (key.length !== 1) return null;
  const letter = KEYBOARD.choiceLetters.indexOf(key);
  if (letter >= 0) return { kind: "toggle", index: letter };
  const digit = KEYBOARD.choiceDigits.indexOf(key);
  return digit >= 0 ? { kind: "toggle", index: digit } : null;
}

export { isTypingTarget, commandFor };
