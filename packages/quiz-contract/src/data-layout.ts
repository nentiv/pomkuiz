const DATA_LAYOUT = Object.freeze({
  indexFile: "index.json",
  quizzesDirectory: "quizzes",
  quizFile: "quiz.json",
  assetsDirectory: "assets",
  assetExtension: ".png",
  publicDirectory: "data",
});

const PNG_SIGNATURE = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function hasPngSignature(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

function quizDirectoryPath(quizId: string): string {
  return `${DATA_LAYOUT.quizzesDirectory}/${quizId}`;
}

function quizFilePath(quizId: string): string {
  return `${quizDirectoryPath(quizId)}/${DATA_LAYOUT.quizFile}`;
}

function quizAssetPath(quizId: string, assetPath: string): string {
  return `${quizDirectoryPath(quizId)}/${assetPath}`;
}

export { DATA_LAYOUT, PNG_SIGNATURE, hasPngSignature, quizFilePath, quizAssetPath };
