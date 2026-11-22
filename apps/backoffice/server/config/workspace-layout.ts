const WORKSPACE_LAYOUT = Object.freeze({
  importsDirectory: "imports",
  importFile: "import.json",
  sourceFile: "source.pdf",
  pagesDirectory: "pages",
  segmentsDirectory: "segments",
  planFile: "plan.json",
  jobFile: "job.json",
  draftFile: "draft.json",
  assetsDirectory: "assets",
  assetsIndexFile: "assets.json",
  pngExtension: ".png",
  jsonExtension: ".json",
  temporarySuffix: ".tmp",
  exportTemporaryPrefix: ".pomkuiz-tmp-",
  exportPreviousPrefix: ".pomkuiz-old-",
});

const JOB_SETTINGS = Object.freeze({
  autoResumeInterrupted: false,
  progressThrottleMs: 200,
});

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export { WORKSPACE_LAYOUT, JOB_SETTINGS, ID_PATTERN };
