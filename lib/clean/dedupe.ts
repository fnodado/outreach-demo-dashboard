import { appConfig } from "@/config/app.config";

export function normalizeEmail(email: string | undefined): string | undefined {
  const e = email?.trim().toLowerCase();
  return e ? e : undefined;
}

export function normalizePhone(
  phone: string | number | undefined,
  opts: { minPhoneDigits: number; stripUsCountryCode: boolean } = appConfig.dedupe,
): string | undefined {
  if (phone === undefined || phone === null) return undefined;
  let digits = String(phone).replace(/\D/g, "");
  if (opts.stripUsCountryCode && digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length >= opts.minPhoneDigits ? digits : undefined;
}

export interface Dedupable {
  email?: string;
  phone?: string;
  createdAt: Date;
}

export interface DedupeResult<T> {
  kept: T[];
  removed: { record: T; duplicateOf: T }[];
}

/**
 * Removes duplicates by normalized email OR phone digits. The earliest record (by createdAt,
 * then input order) is kept as-is; later matches are dropped.
 * Matching is transitive: a dropped record's keys still claim later records.
 */
export function dedupe<T extends Dedupable>(records: T[]): DedupeResult<T> {
  const ordered = records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => a.record.createdAt.getTime() - b.record.createdAt.getTime() || a.index - b.index);

  const owner = new Map<string, T>();
  const kept: T[] = [];
  const removed: DedupeResult<T>["removed"] = [];

  for (const { record } of ordered) {
    const keys = [
      normalizeEmail(record.email) && `e:${normalizeEmail(record.email)}`,
      normalizePhone(record.phone) && `p:${normalizePhone(record.phone)}`,
    ].filter((k): k is string => Boolean(k));

    const match = keys.map((k) => owner.get(k)).find(Boolean);
    if (match) removed.push({ record, duplicateOf: match });
    else kept.push(record);

    const survivor = match ?? record;
    for (const k of keys) if (!owner.has(k)) owner.set(k, survivor);
  }
  return { kept, removed };
}
