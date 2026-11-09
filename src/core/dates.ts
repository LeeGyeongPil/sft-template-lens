/** Locale- and timezone-independent subset of `strftime` (English names only, no `Intl`). */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n: number, width = 2): string => String(n).padStart(width, "0");

export interface FixedDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Parse `YYYY-MM-DD`; throws an error that tells the user the expected format. */
export function parseFixedDate(text: string): FixedDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new Error(`Invalid date "${text}". Use YYYY-MM-DD, for example 2026-01-01.`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Invalid date "${text}": that calendar day does not exist.`);
  }
  return { year, month, day };
}

/** Format a fixed date. Supports %d %e %m %B %b %Y %y %A %a %j %H %M %S %% ; unknown codes are kept as-is. */
export function strftime(fmt: string, date: FixedDate): string {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const weekday = utc.getUTCDay();
  const dayOfYear = Math.round((utc.getTime() - Date.UTC(date.year, 0, 1)) / 86400000) + 1;
  return fmt.replace(/%([a-zA-Z%])/g, (whole, code: string) => {
    switch (code) {
      case "d": return pad(date.day);
      case "e": return String(date.day).padStart(2, " ");
      case "m": return pad(date.month);
      case "B": return MONTHS[date.month - 1]!;
      case "b": return MONTHS[date.month - 1]!.slice(0, 3);
      case "Y": return String(date.year);
      case "y": return pad(date.year % 100);
      case "A": return DAYS[weekday]!;
      case "a": return DAYS[weekday]!.slice(0, 3);
      case "j": return pad(dayOfYear, 3);
      case "H":
      case "M":
      case "S": return "00";
      case "%": return "%";
      default: return whole;
    }
  });
}
