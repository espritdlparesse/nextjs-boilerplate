export function formatShortDate(input?: string) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }).replace(" г.", "");
}

export function getItemDateValue(item: { consumed_at?: string | null; created_at?: string }) {
  return item.consumed_at || item.created_at || "";
}

export function dayKey(input: string | Date) {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

export function parseDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

export function calendarGrid(month: Date) {
  const monthStart = startOfMonth(month);
  const startWeekday = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -startWeekday);
  const todayKey = dayKey(new Date());
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const key = dayKey(date);
    return { key, date, inMonth: date.getMonth() === month.getMonth(), isToday: key === todayKey };
  });
}
