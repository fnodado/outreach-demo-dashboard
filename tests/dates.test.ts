import { describe, expect, it } from "vitest";
import { parseSheetDate } from "@/lib/clean/dates";

const TZ = "America/New_York";
const ok = (v: unknown) => {
  const r = parseSheetDate(v, TZ);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
};

describe("parseSheetDate", () => {
  it("parses Sheets serial numbers as New York wall-clock time", () => {
    // 46000 = 2025-12-09; .75 = 18:00 local (EST, UTC-5)
    const d = ok(46000.75);
    expect(d.localDate).toBe("2025-12-09");
    expect(d.format).toBe("serial");
    expect(d.instant.toISOString()).toBe("2025-12-09T23:00:00.000Z");
  });

  it("keeps a late-evening serial on its local calendar day (no UTC rollover)", () => {
    // 2026-07-05 23:30 EDT is already 2026-07-06 in UTC
    const d = ok(46208 + 23.5 / 24);
    expect(d.localDate).toBe("2026-07-05");
    expect(d.instant.toISOString()).toBe("2026-07-06T03:30:00.000Z");
  });

  it.each([
    ["3/7/2026", "2026-03-07", "m/d/yyyy"],
    ["12/31/2025", "2025-12-31", "m/d/yyyy"],
    ["2026-03-07", "2026-03-07", "yyyy-mm-dd"],
    ["2026-03-07 14:05", "2026-03-07", "yyyy-mm-dd hh:mm"],
    ["03/07/26", "2026-03-07", "mm/dd/yy"],
    [" 3/7/2026 ", "2026-03-07", "m/d/yyyy"],
    ["3/7/2026 2:30 PM", "2026-03-07", "m/d/yyyy"],
  ])("parses %s", (input, localDate, format) => {
    const d = ok(input);
    expect(d.localDate).toBe(localDate);
    expect(d.format).toBe(format);
  });

  it("handles the DST spring-forward day", () => {
    // 2026-03-08 03:30 EDT (UTC-4)
    expect(ok("2026-03-08 03:30").instant.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    // 01:30 the same day is still EST (UTC-5)
    expect(ok("2026-03-08 01:30").instant.toISOString()).toBe("2026-03-08T06:30:00.000Z");
  });

  it("converts zoned ISO timestamps into the New York calendar day", () => {
    expect(ok("2026-03-10T02:00:00Z").localDate).toBe("2026-03-09");
  });

  it("accepts serials that arrived as text", () => {
    expect(ok("46000").localDate).toBe("2025-12-09");
  });

  it.each([[""], [null], [undefined], ["not a date"], ["2/30/2026"], ["13/1/2026"], [-5]])(
    "reports %s as unparseable instead of throwing",
    (input) => {
      expect(parseSheetDate(input, TZ).ok).toBe(false);
    },
  );
});
