import { appConfig } from "@/config/app.config";
import type { CleanedLeads, DataQualityReport, Lead } from "@/lib/domain/types";
import { parseSheetDate } from "./dates";
import { dedupe } from "./dedupe";
import { matchTestRow } from "./testRows";
import { leadRowSchema } from "./validate";

/** A Leads row after header mapping, before any cleaning. */
export interface RawLead {
  /** 1-based sheet row number (header = 1). */
  row: number;
  id?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  createdDate?: unknown;
  stage?: unknown;
  quizScore?: unknown;
  quizResult?: unknown;
  source?: unknown;
}

const text = (v: unknown) => (v === null || v === undefined ? undefined : String(v));

const isBlank = (r: RawLead) =>
  Object.entries(r).every(([k, v]) => k === "row" || v === undefined || v === null || String(v).trim() === "");

/** map → drop tests → parse dates → validate → dedupe. Never throws on bad rows. */
export function cleanLeads(rows: RawLead[], timeZone: string = appConfig.timeZone): CleanedLeads {
  const raw = rows.filter((r) => !isBlank(r));
  const quality: DataQualityReport = {
    rawRows: raw.length,
    testRowsRemoved: 0,
    duplicatesRemoved: 0,
    datesNormalized: 0,
    dateFormats: {},
    rowsRejected: 0,
    rejected: [],
    cleanRows: 0,
  };

  const valid: Lead[] = [];
  for (const r of raw) {
    if (matchTestRow({ name: text(r.name), email: text(r.email) })) {
      quality.testRowsRemoved++;
      continue;
    }

    const id = text(r.id)?.trim() || undefined;
    const date = parseSheetDate(r.createdDate, timeZone);
    if (!date.ok) {
      quality.rejected.push({ row: r.row, id, reason: date.reason });
      continue;
    }

    const parsed = leadRowSchema.safeParse(r);
    if (!parsed.success) {
      quality.rejected.push({ row: r.row, id, reason: parsed.error.issues.map((i) => i.message).join("; ") });
      continue;
    }

    const { format } = date.value;
    quality.dateFormats[format] = (quality.dateFormats[format] ?? 0) + 1;
    if (format !== "serial") quality.datesNormalized++;

    const v = parsed.data;
    valid.push({
      id: v.id ?? `row-${r.row}`,
      name: v.name ?? "",
      email: v.email,
      phone: v.phone,
      createdAt: date.value.instant,
      createdDate: date.value.localDate,
      stage: v.stage,
      quizScore: v.quizScore,
      quizResult: v.quizResult,
      source: v.source,
    });
  }
  quality.rowsRejected = quality.rejected.length;

  const { kept, removed } = dedupe(valid);
  quality.duplicatesRemoved = removed.length;
  quality.cleanRows = kept.length;

  return { leads: kept, quality };
}
