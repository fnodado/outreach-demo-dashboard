import { appConfig, STAGES, type StageName } from "@/config/app.config";
import type { Lead, WeeklyAdSpend } from "@/lib/domain/types";

/** Inclusive range of week starts (YYYY-MM-DD). */
export interface WeekRange {
  from: string;
  to: string;
}

const toUtcMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromUtcMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Week start for a calendar date (already in the configured timezone).
 * Pure calendar math, so DST cannot shift a lead into the wrong week.
 */
export function weekStartOf(localDate: string, weekStartsOn: number = appConfig.weekStartsOn): string {
  const ms = toUtcMs(localDate);
  const dow = new Date(ms).getUTCDay();
  const back = (dow - weekStartsOn + 7) % 7;
  return fromUtcMs(ms - back * 86_400_000);
}

export function addDays(date: string, n: number): string {
  return fromUtcMs(toUtcMs(date) + n * 86_400_000);
}

export function addWeeks(weekStart: string, n: number): string {
  return addDays(weekStart, n * 7);
}

/** Every week start from `range.from` to `range.to`, inclusive. */
export function weeksIn(range: WeekRange): string[] {
  const out: string[] = [];
  for (let w = range.from; w <= range.to; w = addWeeks(w, 1)) out.push(w);
  return out;
}

export function inRange(weekStart: string, range: WeekRange): boolean {
  return weekStart >= range.from && weekStart <= range.to;
}

/** The span of weeks covered by the leads, or null when there are none. */
export function rangeOfLeads(leads: Lead[]): WeekRange | null {
  if (leads.length === 0) return null;
  const weeks = leads.map((l) => weekStartOf(l.createdDate)).sort();
  return { from: weeks[0], to: weeks[weeks.length - 1] };
}

export type StageCounts = Record<StageName, number>;

export interface WeekRow {
  weekStart: string;
  counts: StageCounts;
  total: number;
}

const emptyCounts = (): StageCounts =>
  Object.fromEntries(STAGES.map((s) => [s, 0])) as StageCounts;

/** Leads per week (by Created Date) and current stage. Weeks with no leads are zero-filled. */
export function countByWeekAndStage(leads: Lead[], range: WeekRange): WeekRow[] {
  const rows = new Map(weeksIn(range).map((w) => [w, { weekStart: w, counts: emptyCounts(), total: 0 }]));
  for (const lead of leads) {
    const row = rows.get(weekStartOf(lead.createdDate));
    if (!row) continue;
    row.counts[lead.stage]++;
    row.total++;
  }
  return [...rows.values()];
}

export function spendInRange(adSpend: WeeklyAdSpend[], range: WeekRange): number {
  return adSpend.filter((s) => inRange(s.weekStart, range)).reduce((sum, s) => sum + s.amount, 0);
}
