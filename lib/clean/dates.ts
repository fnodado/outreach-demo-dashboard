import type { DateFormat } from "@/lib/domain/types";

export interface ParsedDate {
  /** UTC instant. */
  instant: Date;
  /** Calendar date in the target timezone, YYYY-MM-DD. */
  localDate: string;
  format: DateFormat;
}

export type DateParseResult = { ok: true; value: ParsedDate } | { ok: false; reason: string };

const SHEETS_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/** Converts a wall-clock time in `timeZone` to a UTC instant (DST-aware). */
export function zonedToInstant(
  y: number, m: number, d: number, hh: number, mm: number, ss: number, timeZone: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const first = guess - tzOffsetMs(guess, timeZone);
  const second = guess - tzOffsetMs(first, timeZone);
  return new Date(second);
}

/** Calendar date (YYYY-MM-DD) of an instant in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function fromWallClock(
  y: number, m: number, d: number, hh: number, mm: number, ss: number, format: DateFormat, timeZone: string,
): DateParseResult {
  if (!isValidYmd(y, m, d) || hh > 23 || mm > 59 || ss > 59) {
    return { ok: false, reason: `invalid calendar date ${y}-${m}-${d} ${hh}:${mm}` };
  }
  return {
    ok: true,
    value: { instant: zonedToInstant(y, m, d, hh, mm, ss, timeZone), localDate: ymd(y, m, d), format },
  };
}

function to24h(h: number, ampm: string | undefined): number {
  if (!ampm) return h;
  const pm = ampm.toUpperCase() === "PM";
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

const RE_US = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/;
const RE_ISO_LOCAL = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const RE_ISO_ZONED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Parses a Created Date cell. Text dates and serials are wall-clock times in `timeZone`
 * (the spreadsheet's timezone). Never throws.
 */
export function parseSheetDate(value: unknown, timeZone: string): DateParseResult {
  if (value === null || value === undefined || value === "") return { ok: false, reason: "missing date" };

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: `invalid serial ${value}` };
    // Serial = days since 1899-12-30 as wall-clock time. Round to the second to absorb float noise.
    const wallMs = SHEETS_EPOCH_UTC + Math.round(value * 86_400) * 1000;
    const w = new Date(wallMs);
    return fromWallClock(
      w.getUTCFullYear(), w.getUTCMonth() + 1, w.getUTCDate(),
      w.getUTCHours(), w.getUTCMinutes(), w.getUTCSeconds(), "serial", timeZone,
    );
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { ok: false, reason: "invalid Date" };
    return { ok: true, value: { instant: value, localDate: localDateOf(value, timeZone), format: "iso" } };
  }

  const s = String(value).trim();
  if (s === "") return { ok: false, reason: "missing date" };

  let m = RE_US.exec(s);
  if (m) {
    const yRaw = m[3];
    const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    const hh = m[4] ? to24h(Number(m[4]), m[7]) : 0;
    const format: DateFormat = yRaw.length === 2 ? "mm/dd/yy" : "m/d/yyyy";
    return fromWallClock(y, Number(m[1]), Number(m[2]), hh, Number(m[5] ?? 0), Number(m[6] ?? 0), format, timeZone);
  }

  m = RE_ISO_LOCAL.exec(s);
  if (m) {
    const format: DateFormat = m[4] ? "yyyy-mm-dd hh:mm" : "yyyy-mm-dd";
    return fromWallClock(
      Number(m[1]), Number(m[2]), Number(m[3]),
      Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0), format, timeZone,
    );
  }

  if (RE_ISO_ZONED.test(s)) {
    const instant = new Date(s);
    if (!Number.isNaN(instant.getTime())) {
      return { ok: true, value: { instant, localDate: localDateOf(instant, timeZone), format: "iso" } };
    }
  }

  // A serial that arrived as text, e.g. "45678" or "45678.25".
  if (/^\d{4,6}(\.\d+)?$/.test(s)) return parseSheetDate(Number(s), timeZone);

  return { ok: false, reason: `unrecognized date "${s}"` };
}

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY);
