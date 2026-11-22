const ID_BYTES = 16;
const HEX = 16;
const HEX_DIGITS = 2;

function createId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(ID_BYTES)), (byte) =>
    byte.toString(HEX).padStart(HEX_DIGITS, "0"),
  ).join("");
}

export { createId };
