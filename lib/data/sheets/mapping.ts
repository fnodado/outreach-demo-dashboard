// Maps sheet tabs (header row + values) to typed records. Headers are matched by alias,
// case- and whitespace-insensitive, so column order in the sheet does not matter.
import { STAGES, type StageName } from "@/config/app.config";
import { parseSheetDate } from "@/lib/clean/dates";
import type { RawLead } from "@/lib/clean/pipeline";
import type { WeeklyAdSpend } from "@/lib/domain/types";
import { weekStartOf } from "@/lib/metrics/weeks";

type Grid = unknown[][];

const norm = (h: unknown) => String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function indexHeaders<A extends Record<string, readonly string[]>>(
  header: unknown[],
  aliases: A,
  required: readonly (keyof A & string)[],
  tab: string,
): Record<keyof A, number> {
  const normalized = header.map(norm);
  const idx = {} as Record<keyof A, number>;
  for (const key of Object.keys(aliases) as (keyof A & string)[]) {
    idx[key] = normalized.findIndex((h) => aliases[key].includes(h));
  }
  const missing = required.filter((k) => idx[k] < 0);
  if (missing.length) {
    throw new Error(`Tab "${tab}" is missing column(s): ${missing.join(", ")}. Found: ${normalized.join(" | ")}`);
  }
  return idx;
}

const cell = (row: unknown[], i: number) => (i >= 0 ? row[i] : undefined);

const LEAD_ALIASES = {
  id: ["lead id", "id"],
  name: ["full name", "name"],
  email: ["email", "email address"],
  phone: ["phone", "phone number"],
  createdDate: ["created date", "created", "date created"],
  stage: ["stage"],
  quizScore: ["quiz score"],
  quizResult: ["quiz result"],
  source: ["source"],
} as const;

export function mapLeads(grid: Grid, tab = "Leads"): RawLead[] {
  const [header = [], ...rows] = grid;
  const idx = indexHeaders(header, LEAD_ALIASES, ["createdDate", "stage", "email", "phone"], tab);
  return rows.map((r, i) => ({
    row: i + 2,
    id: cell(r, idx.id),
    name: cell(r, idx.name),
    email: cell(r, idx.email),
    phone: cell(r, idx.phone),
    createdDate: cell(r, idx.createdDate),
    stage: cell(r, idx.stage),
    quizScore: cell(r, idx.quizScore),
    quizResult: cell(r, idx.quizResult),
    source: cell(r, idx.source),
  }));
}

const WEEK_ALIASES = ["week start", "week", "week of", "week starting", "week start date", "week start (mon)"];

export function parseMoney(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function weekOf(v: unknown, timeZone: string): string | undefined {
  const d = parseSheetDate(v, timeZone);
  return d.ok ? weekStartOf(d.value.localDate) : undefined;
}

export function mapAdSpend(grid: Grid, timeZone: string, tab = "Weekly Ad Spend"): WeeklyAdSpend[] {
  const [header = [], ...rows] = grid;
  const idx = indexHeaders(
    header,
    { weekStart: WEEK_ALIASES, amount: ["ad spend", "spend", "amount", "ad spend ($)", "spend ($)", "amount (usd)"] },
    ["weekStart", "amount"],
    tab,
  );
  const byWeek = new Map<string, number>();
  for (const r of rows) {
    const week = weekOf(cell(r, idx.weekStart), timeZone);
    const amount = parseMoney(cell(r, idx.amount));
    if (!week || amount === undefined) continue;
    byWeek.set(week, (byWeek.get(week) ?? 0) + amount);
  }
  return [...byWeek].map(([weekStart, amount]) => ({ weekStart, amount })).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface ReportedWeek {
  weekStart: string;
  counts: Partial<Record<StageName, number>>;
  total?: number;
}

/** Reads the client's own Weekly Stats tab: a week column plus one column per stage. */
export function mapWeeklyStats(grid: Grid, timeZone: string, tab = "Weekly Stats"): ReportedWeek[] {
  const [header = [], ...rows] = grid;
  const stageAliases = Object.fromEntries(STAGES.map((s) => [s, [norm(s)]])) as Record<StageName, string[]>;
  const idx = indexHeaders(
    header,
    { weekStart: WEEK_ALIASES, total: ["total", "total leads", "leads", "new leads (total)"], ...stageAliases },
    ["weekStart"],
    tab,
  );
  const out: ReportedWeek[] = [];
  for (const r of rows) {
    const week = weekOf(cell(r, idx.weekStart), timeZone);
    if (!week) continue;
    const counts: ReportedWeek["counts"] = {};
    for (const s of STAGES) {
      const n = parseMoney(cell(r, idx[s]));
      if (n !== undefined) counts[s] = n;
    }
    out.push({ weekStart: week, counts, total: parseMoney(cell(r, idx.total)) });
  }
  return out;
}
