import { appConfig } from "@/config/app.config";

export interface TestRowFields {
  name?: string;
  email?: string;
}

export type TestRowRules = Partial<Record<keyof TestRowFields, readonly RegExp[]>>;

/** Returns the first rule that matched, or null if the row is real. */
export function matchTestRow(
  row: TestRowFields,
  rules: TestRowRules = appConfig.testRowRules,
): string | null {
  for (const field of Object.keys(rules) as (keyof TestRowFields)[]) {
    const value = row[field]?.trim();
    if (!value) continue;
    const hit = rules[field]?.find((re) => re.test(value));
    if (hit) return `${field} matches ${hit}`;
  }
  return null;
}
