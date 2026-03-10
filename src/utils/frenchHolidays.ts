// French public holidays for a given year
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getFrenchHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  // Fixed holidays
  holidays.add(`${year}-01-01`); // Jour de l'An
  holidays.add(`${year}-05-01`); // Fête du travail
  holidays.add(`${year}-05-08`); // Victoire 1945
  holidays.add(`${year}-07-14`); // Fête nationale
  holidays.add(`${year}-08-15`); // Assomption
  holidays.add(`${year}-11-01`); // Toussaint
  holidays.add(`${year}-11-11`); // Armistice
  holidays.add(`${year}-12-25`); // Noël

  // Easter-based holidays
  const easter = easterSunday(year);
  holidays.add(fmt(addDays(easter, 1)));  // Lundi de Pâques
  holidays.add(fmt(addDays(easter, 39))); // Ascension
  holidays.add(fmt(addDays(easter, 50))); // Lundi de Pentecôte

  return holidays;
}

export function isHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return getFrenchHolidays(year).has(dateStr);
}
