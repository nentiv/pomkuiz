import { CONTRACT_LIMITS, CONTRACT_PATTERNS } from "./contract-limits.ts";

const DIACRITICS = /\p{Diacritic}/gu;
const NON_SLUG_RUNS = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

function isSlug(value: unknown): value is string {
  return (
    typeof value === "string" && value.length <= CONTRACT_LIMITS.slugCharacters && CONTRACT_PATTERNS.slug.test(value)
  );
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(NON_SLUG_RUNS, "-")
    .replace(EDGE_DASHES, "")
    .slice(0, CONTRACT_LIMITS.slugCharacters)
    .replace(EDGE_DASHES, "");
}

export { isSlug, slugify };
