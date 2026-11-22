import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import {
  buildQuizIndex,
  findIntegrityIssues,
  listReferencedAssets,
  DATA_LAYOUT,
  hasPngSignature,
  quizAssetPath,
  quizFilePath,
  isSlug,
  type Quiz,
  type QuizIndex,
} from "@pomkuiz/quiz-contract";
import { CONTRACT_SCHEMAS } from "@pomkuiz/quiz-contract/schemas";

const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;

interface PublishedFile {
  path: string;
  bytes: Uint8Array;
}

interface LoadedData {
  index: QuizIndex;
  files: PublishedFile[];
}

class DataError extends Error {
  constructor(location: string, reason: string) {
    super(`data/${location} : ${reason}`);
    this.name = "DataError";
  }
}

const IGNORED_PREFIX = ".";

function insideDirectory(base: string, path: string): string {
  const target = resolve(base, path);
  const relation = relative(base, target);
  if (relation.startsWith("..") || isAbsolute(relation)) throw new DataError(path, "chemin interdit");
  return target;
}

async function loadDataDirectory(dataDirectory: string): Promise<LoadedData> {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const validateQuiz = ajv.compile<Quiz>(CONTRACT_SCHEMAS.quiz);
  const validateIndex = ajv.compile<QuizIndex>(CONTRACT_SCHEMAS.index);
  const quizzesDirectory = join(dataDirectory, DATA_LAYOUT.quizzesDirectory);
  const entries = await readdir(quizzesDirectory, { withFileTypes: true }).catch(() => []);
  const quizzes: Quiz[] = [];
  const files: PublishedFile[] = [];

  for (const entry of entries.toSorted((first, second) => first.name.localeCompare(second.name))) {
    if (entry.name.startsWith(IGNORED_PREFIX) || !entry.isDirectory()) continue;
    if (!isSlug(entry.name))
      throw new DataError(entry.name, "nom de dossier invalide (attendu : minuscules, chiffres, tirets)");
    const directory = join(quizzesDirectory, entry.name);
    const location = `${DATA_LAYOUT.quizzesDirectory}/${entry.name}/${DATA_LAYOUT.quizFile}`;
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(join(directory, DATA_LAYOUT.quizFile), "utf8"));
    } catch (error) {
      throw new DataError(location, (error as Error).message);
    }
    if (!validateQuiz(raw)) throw new DataError(location, ajv.errorsText(validateQuiz.errors));
    const quiz = raw;
    const issues = findIntegrityIssues(quiz, entry.name);
    if (issues.length > 0)
      throw new DataError(location, issues.map((issue) => `${issue.path} ${issue.code}`).join(", "));
    for (const asset of listReferencedAssets(quiz)) {
      const bytes = await readFile(insideDirectory(directory, asset)).catch(() => {
        throw new DataError(`${DATA_LAYOUT.quizzesDirectory}/${entry.name}/${asset}`, "image manquante");
      });
      if (!hasPngSignature(bytes))
        throw new DataError(`${DATA_LAYOUT.quizzesDirectory}/${entry.name}/${asset}`, "PNG invalide");
      files.push({ path: quizAssetPath(quiz.id, asset), bytes });
    }
    files.push({ path: quizFilePath(quiz.id), bytes: new TextEncoder().encode(JSON.stringify(quiz)) });
    quizzes.push(quiz);
  }

  const index = buildQuizIndex(quizzes);
  if (!validateIndex(index)) throw new DataError(DATA_LAYOUT.indexFile, ajv.errorsText(validateIndex.errors));
  files.push({ path: DATA_LAYOUT.indexFile, bytes: new TextEncoder().encode(JSON.stringify(index)) });
  return { index, files };
}

export { loadDataDirectory };
