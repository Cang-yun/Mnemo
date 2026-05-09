const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function todayIso(date = new Date()) {
  return toIsoDate(date);
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(isoDate: string, days: number) {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function daysBetween(startIso: string, endIso: string) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export function enumeratePlanDates(startDate: string, dayCount: number) {
  return Array.from({ length: dayCount }, (_, index) => addDays(startDate, index));
}

export function startOfMonthIso(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonthIso(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function enumerateCalendarMonth(isoDate: string) {
  const firstDate = parseIsoDate(startOfMonthIso(isoDate));
  const lastDate = parseIsoDate(endOfMonthIso(isoDate));
  const gridStart = new Date(firstDate);
  const firstDay = firstDate.getDay();
  gridStart.setDate(firstDate.getDate() - firstDay);

  const gridEnd = new Date(lastDate);
  const lastDay = lastDate.getDay();
  gridEnd.setDate(lastDate.getDate() + (6 - lastDay));

  const dates: string[] = [];
  for (let date = gridStart; date <= gridEnd; date = new Date(date.getTime() + MS_PER_DAY)) {
    dates.push(toIsoDate(date));
  }

  return dates;
}

export function formatMonthTitle(isoDate: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(parseIsoDate(isoDate));
}

export function formatChineseDate(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}
