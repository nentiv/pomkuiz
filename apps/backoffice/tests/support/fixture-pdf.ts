import * as mupdf from "mupdf";

interface FixtureQuestion {
  number: number;
  prompt: string;
  choices: string[];
  correct: number[];
  figure?: { width: number; height: number };
}

interface FixtureOptions {
  pageWidth: number;
  pageHeight: number;
  pages: FixtureQuestion[][];
  splitLast?: boolean;
}

const LINE = 18;
const LEFT_LABEL = 40;
const LEFT_CONTENT = 120;
const LEFT_CHOICE = 130;
const TOP_MARGIN = 60;
const QUESTION_GAP = 60;
const FONT_SIZE = 11;

function escapePdf(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function statement(question: FixtureQuestion): string {
  const texts = question.correct.map((index) => question.choices[index] ?? "");
  return texts.length === 1
    ? `La reponse correcte est : ${texts[0]}`
    : `Les reponses correctes sont : ${texts.join(", ")}`;
}

interface PageBuilder {
  text(x: number, y: number, value: string): void;
  image(x: number, y: number, width: number, height: number): void;
  commands: string[];
}

function createPageBuilder(pageHeight: number): PageBuilder {
  const commands: string[] = [];
  return {
    commands,
    text(x, y, value) {
      commands.push(`BT /F1 ${FONT_SIZE} Tf ${x} ${pageHeight - y} Td (${escapePdf(value)}) Tj ET`);
    },
    image(x, y, width, height) {
      commands.push(`q ${width} 0 0 ${height} ${x} ${pageHeight - y - height} cm /I1 Do Q`);
    },
  };
}

function writeQuestion(
  page: PageBuilder,
  question: FixtureQuestion,
  top: number,
  part: "all" | "head" | "tail",
): number {
  let y = top;
  if (part !== "tail") {
    page.text(LEFT_LABEL, y, `Question ${question.number}`);
    page.text(LEFT_CONTENT, y, question.prompt);
    y += LINE;
    if (question.figure) {
      page.image(LEFT_CONTENT, y, question.figure.width, question.figure.height);
      y += question.figure.height + LINE;
    }
  }
  const half = Math.ceil(question.choices.length / 2);
  const choices = question.choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ index }) => part === "all" || (part === "head" ? index < half : index >= half));
  for (const { choice, index } of choices) {
    page.text(LEFT_CHOICE, y, `${String.fromCodePoint(97 + index)}. ${choice}`);
    y += LINE;
  }
  if (part !== "head") {
    y += LINE / 2;
    page.text(LEFT_CONTENT, y, "Votre reponse est correcte.");
    y += LINE;
    page.text(LEFT_CONTENT, y, statement(question));
    y += LINE;
  }
  return y + QUESTION_GAP;
}

function createFigurePng(): Uint8Array {
  const pixmap = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, 64, 48], false);
  try {
    pixmap.clear(96);
    return pixmap.asPNG();
  } finally {
    pixmap.destroy();
  }
}

function buildMoodleLikePdf(options: FixtureOptions): Uint8Array {
  const document = new mupdf.PDFDocument();
  try {
    const font = document.addSimpleFont(new mupdf.Font("Helvetica"));
    const image = document.addImage(new mupdf.Image(createFigurePng()));
    const resources = document.addObject({ Font: { F1: font }, XObject: { I1: image } });
    options.pages.forEach((questions, pageIndex) => {
      const page = createPageBuilder(options.pageHeight);
      let y = TOP_MARGIN;
      const isLastPage = pageIndex === options.pages.length - 1;
      const previousSplit = options.splitLast && pageIndex > 0;
      questions.forEach((question, index) => {
        const isLast = index === questions.length - 1;
        if (previousSplit && index === 0) y = writeQuestion(page, question, y, "tail");
        else if (options.splitLast && isLast && !isLastPage) y = writeQuestion(page, question, y, "head");
        else y = writeQuestion(page, question, y, "all");
      });
      const contents = page.commands.join("\n");
      document.insertPage(-1, document.addPage([0, 0, options.pageWidth, options.pageHeight], 0, resources, contents));
    });
    return document.saveToBuffer("compress").asUint8Array().slice();
  } finally {
    document.destroy();
  }
}

const SAMPLE_QUESTIONS: FixtureQuestion[] = [
  {
    number: 1,
    prompt: "A propos des acides amines :",
    choices: ["Il en existe 40", "Certains sont des neuromediateurs", "Ils sont tous chiraux"],
    correct: [1],
  },
  {
    number: 2,
    prompt: "Concernant la molecule suivante :",
    choices: ["Elle est polaire", "Elle est chirale", "Elle est aromatique", "Elle est un ose"],
    correct: [0, 2],
    figure: { width: 160, height: 110 },
  },
  {
    number: 3,
    prompt: "Quelle est la concentration en H3O+ ?",
    choices: ["0,0033 mol/L", "3,3 mol/L", "0,33 mol/L"],
    correct: [0],
  },
  {
    number: 4,
    prompt: "Cochez les propositions exactes :",
    choices: [
      "Le carbone sp3 a 4 liaisons simples",
      "Le carbone sp a une liaison triple",
      "Le carbone sp2 a 2 doubles liaisons",
      "Aucune",
    ],
    correct: [0, 1],
  },
  {
    number: 5,
    prompt: "Concernant les acides forts :",
    choices: ["HCl est un acide fort", "CH3COOH est un acide fort", "Un acide fort est totalement dissocie"],
    correct: [0, 2],
  },
];

function buildSamplePdf(): Uint8Array {
  const [q1, q2, q3, q4, q5] = SAMPLE_QUESTIONS as [
    FixtureQuestion,
    FixtureQuestion,
    FixtureQuestion,
    FixtureQuestion,
    FixtureQuestion,
  ];
  return buildMoodleLikePdf({
    pageWidth: 595,
    pageHeight: 1400,
    pages: [
      [q1, q2, q3, q4],
      [q4, q5],
    ],
    splitLast: true,
  });
}

export { SAMPLE_QUESTIONS, buildSamplePdf };
