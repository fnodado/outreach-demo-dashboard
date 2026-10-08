import { describe, expect, it } from "vitest";
import { parseSheetDate } from "@/lib/clean/dates";
import type { Lead } from "@/lib/domain/types";
import { metrics, weeksMissingSpend } from "@/lib/metrics/registry";
import { countByWeekAndStage, weekStartOf, weeksIn } from "@/lib/metrics/weeks";

const lead = (id: string, createdDate: string, stage: Lead["stage"] = "New Lead"): Lead => ({
  id,
  name: id,
  createdAt: new Date(`${createdDate}T12:00:00Z`),
  createdDate,
  stage,
});

describe("weekStartOf (Monday weeks)", () => {
  it.each([
    ["2026-10-05", "2026-10-05"], // Monday
    ["2026-10-08", "2026-10-05"], // Thursday
    ["2026-10-11", "2026-10-05"], // Sunday belongs to the previous Monday
    ["2026-10-12", "2026-10-12"],
    ["2026-01-01", "2025-12-29"], // crosses a year boundary
    ["2026-03-08", "2026-03-02"], // DST start Sunday
    ["2026-11-01", "2026-10-26"], // DST end Sunday
  ])("%s -> %s", (date, week) => {
    expect(weekStartOf(date)).toBe(week);
  });

  it("buckets a Sunday 11:30pm New York lead into that week, not the next (UTC is already Monday)", () => {
    const parsed = parseSheetDate("2026-10-11 23:30", "America/New_York");
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.instant.getUTCDay()).toBe(1);
    expect(weekStartOf(parsed.value.localDate)).toBe("2026-10-05");
  });
});

describe("countByWeekAndStage", () => {
  const leads = [
    lead("a", "2026-09-28"),
    lead("b", "2026-10-04", "Hired"),
    lead("c", "2026-10-05", "Disqualified"),
    lead("d", "2026-10-25", "Hired"),
  ];
  const range = { from: "2026-09-28", to: "2026-10-12" };

  it("lists every week in range, zero-filled", () => {
    expect(weeksIn(range)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    const rows = countByWeekAndStage(leads, range);
    expect(rows.map((r) => r.total)).toEqual([2, 1, 0]);
    expect(rows[0].counts["Hired"]).toBe(1);
    expect(rows[0].counts["New Lead"]).toBe(1);
    expect(rows[1].counts["Disqualified"]).toBe(1);
  });

  it("excludes leads outside the range", () => {
    const total = countByWeekAndStage(leads, range).reduce((s, r) => s + r.total, 0);
    expect(total).toBe(3);
  });
});

describe("metrics registry", () => {
  const leads = [lead("a", "2026-09-28"), lead("b", "2026-09-29", "Hired"), lead("c", "2026-10-05", "Disqualified"), lead("d", "2026-10-06")];
  const adSpend = [
    { weekStart: "2026-09-28", amount: 1000 },
    { weekStart: "2026-10-05", amount: 600 },
    { weekStart: "2026-10-12", amount: 999 },
  ];
  const ctx = { leads, adSpend, range: { from: "2026-09-28", to: "2026-10-05" } };

  it("computes hire rate over all clean leads (Disqualified included)", () => {
    expect(metrics.hireRate.compute(ctx)).toBe(0.25);
  });

  it("computes cost per lead and cost per hire from spend within the range", () => {
    expect(metrics.adSpend.compute(ctx)).toBe(1600);
    expect(metrics.costPerLead.compute(ctx)).toBe(400);
    expect(metrics.costPerHire.compute(ctx)).toBe(1600);
  });

  it("returns null instead of dividing by zero", () => {
    expect(metrics.costPerHire.compute({ ...ctx, leads: [lead("a", "2026-09-28")] })).toBeNull();
  });
});

describe("cost metrics when a week's ad spend is not entered", () => {
  const leads = [
    lead("a", "2026-09-14"),
    lead("b", "2026-09-15", "Hired"),
    lead("c", "2026-09-21"),
    lead("d", "2026-09-22", "Hired"),
    lead("e", "2026-09-28"),
    lead("f", "2026-09-29", "Hired"),
    lead("g", "2026-09-30"),
  ];
  const range = { from: "2026-09-14", to: "2026-09-28" };
  const adSpend = [
    { weekStart: "2026-09-14", amount: 300 },
    { weekStart: "2026-09-21", amount: 500 },
  ];
  const ctx = { leads, adSpend, range };

  it("keeps total ad spend as the sum of entered weeks", () => {
    expect(metrics.adSpend.compute(ctx)).toBe(800);
  });

  it("excludes leads and hires from weeks without a spend row", () => {
    expect(metrics.costPerLead.compute(ctx)).toBe(200); // 800 / 4 leads, not 800 / 7
    expect(metrics.costPerHire.compute(ctx)).toBe(400); // 800 / 2 hires, not 800 / 3
  });

  it("does not change total leads or hire rate", () => {
    expect(metrics.totalLeads.compute(ctx)).toBe(7);
    expect(metrics.hireRate.compute(ctx)).toBeCloseTo(3 / 7);
  });

  it("names the missing week in the note", () => {
    expect(weeksMissingSpend(ctx)).toEqual(["2026-09-28"]);
    expect(metrics.costPerLead.note(ctx)).toBe("Excludes week of 9/28 (spend not entered)");
    expect(metrics.costPerHire.note(ctx)).toBe("Excludes week of 9/28 (spend not entered)");
  });

  it("lists every missing week, in order", () => {
    const one = { ...ctx, adSpend: [{ weekStart: "2026-09-21", amount: 500 }] };
    expect(metrics.costPerLead.note(one)).toBe("Excludes weeks of 9/14, 9/28 (spend not entered)");
  });

  it("treats a $0 spend row as entered", () => {
    const zero = { ...ctx, adSpend: [...adSpend, { weekStart: "2026-09-28", amount: 0 }] };
    expect(metrics.costPerLead.note(zero)).toBeNull();
    expect(metrics.costPerLead.compute(zero)).toBeCloseTo(800 / 7);
  });

  it("has no note when every week with leads has spend", () => {
    expect(metrics.costPerLead.note({ ...ctx, range: { from: "2026-09-14", to: "2026-09-21" } })).toBeNull();
  });
});
