const DATE_PART_LENGTH = 2;

const padDatePart = (value: number): string => String(value).padStart(DATE_PART_LENGTH, "0");

function localDate(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function calendarDate(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

export { calendarDate, localDate };
