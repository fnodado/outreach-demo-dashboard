import "server-only";
import { google, type sheets_v4 } from "googleapis";

function requireEnv(name: "GOOGLE_SA_EMAIL" | "GOOGLE_SA_PRIVATE_KEY" | "SHEET_ID"): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

let cached: sheets_v4.Sheets | undefined;

function sheetsApi(): sheets_v4.Sheets {
  if (cached) return cached;
  const auth = new google.auth.JWT({
    email: requireEnv("GOOGLE_SA_EMAIL"),
    // Env vars store the PEM with literal "\n"; restore real newlines.
    key: requireEnv("GOOGLE_SA_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  cached = google.sheets({ version: "v4", auth });
  return cached;
}

const quote = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

/**
 * Reads several tabs in one batchGet. Real date cells come back as serial numbers
 * (UNFORMATTED_VALUE + SERIAL_NUMBER) so they parse without locale guessing.
 */
export async function fetchTabs(tabs: readonly string[]): Promise<Record<string, unknown[][]>> {
  const res = await withBackoff(() =>
    sheetsApi().spreadsheets.values.batchGet({
      spreadsheetId: requireEnv("SHEET_ID"),
      ranges: tabs.map(quote),
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    }),
  );
  const ranges = res.data.valueRanges ?? [];
  return Object.fromEntries(tabs.map((t, i) => [t, (ranges[i]?.values ?? []) as unknown[][]]));
}

export async function fetchSpreadsheetMeta(): Promise<{ title: string; timeZone: string; tabs: string[] }> {
  const res = await withBackoff(() =>
    sheetsApi().spreadsheets.get({
      spreadsheetId: requireEnv("SHEET_ID"),
      fields: "properties(title,timeZone),sheets(properties(title))",
    }),
  );
  return {
    title: res.data.properties?.title ?? "",
    timeZone: res.data.properties?.timeZone ?? "",
    tabs: (res.data.sheets ?? []).map((s) => s.properties?.title ?? ""),
  };
}

async function withBackoff<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { code?: number; status?: number }).code ?? (err as { status?: number }).status;
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      if (!retryable || i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 500));
    }
  }
}
