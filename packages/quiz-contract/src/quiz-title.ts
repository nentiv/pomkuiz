const TITLE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/;
const ISO_DATE_LENGTH = 10;

interface QuizTitle {
  name: string;
  date: string | null;
}

function isCalendarDate(iso: string): boolean {
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, ISO_DATE_LENGTH) === iso;
}

function parseQuizTitle(title: string): QuizTitle {
  const match = TITLE_DATE_PATTERN.exec(title);
  if (!match) return { name: title, date: null };
  const [, year, month, day, name] = match as unknown as [string, string, string, string, string];
  const iso = `${year}-${month}-${day}`;
  return isCalendarDate(iso) ? { name, date: iso } : { name: title, date: null };
}

function formatQuizTitle(date: string, name: string): string {
  return `${date} ${name}`;
}

export { formatQuizTitle, isCalendarDate, parseQuizTitle };
