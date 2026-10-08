import { HIRED_STAGE } from "@/config/app.config";
import type { Lead, WeeklyAdSpend } from "@/lib/domain/types";
import { inRange, spendInRange, weekStartOf, type WeekRange } from "./weeks";

export interface MetricContext {
  leads: Lead[];
  adSpend: WeeklyAdSpend[];
  range: WeekRange;
}

export interface MetricDef {
  id: string;
  label: string;
  format: "number" | "percent" | "currency";
  description: string;
  /** null = not computable (e.g. division by zero). */
  compute: (ctx: MetricContext) => number | null;
  /** Optional caveat shown under the value, e.g. which weeks were excluded. */
  note?: (ctx: MetricContext) => string | null;
}

const leadsInRange = ({ leads, range }: MetricContext) =>
  leads.filter((l) => inRange(weekStartOf(l.createdDate), range));

const isHired = (l: Lead) => l.stage === HIRED_STAGE;

const hiresInRange = (ctx: MetricContext) => leadsInRange(ctx).filter(isHired).length;

const ratio = (num: number, den: number) => (den === 0 ? null : num / den);

/**
 * Cost metrics only count leads from weeks that have an ad spend row,
 * so a week whose spend is not entered yet doesn't deflate cost per lead/hire.
 * A row with amount 0 counts as entered.
 */
const spendWeeks = (ctx: MetricContext) => new Set(ctx.adSpend.map((s) => s.weekStart));

const leadsInSpendWeeks = (ctx: MetricContext) => {
  const weeks = spendWeeks(ctx);
  return leadsInRange(ctx).filter((l) => weeks.has(weekStartOf(l.createdDate)));
};

/** Weeks in range that have leads but no ad spend row, ascending. */
export function weeksMissingSpend(ctx: MetricContext): string[] {
  const weeks = spendWeeks(ctx);
  const missing = new Set(leadsInRange(ctx).map((l) => weekStartOf(l.createdDate)).filter((w) => !weeks.has(w)));
  return [...missing].sort();
}

const shortWeek = (w: string) => {
  const [, m, d] = w.split("-").map(Number);
  return `${m}/${d}`;
};

const missingSpendNote = (ctx: MetricContext) => {
  const missing = weeksMissingSpend(ctx);
  if (missing.length === 0) return null;
  const label = missing.length === 1 ? "week" : "weeks";
  return `Excludes ${label} of ${missing.map(shortWeek).join(", ")} (spend not entered)`;
};

export const metrics = {
  totalLeads: {
    id: "totalLeads",
    label: "Total leads",
    format: "number",
    description: "Clean leads created in the period",
    compute: (ctx) => leadsInRange(ctx).length,
  },
  hireRate: {
    id: "hireRate",
    label: "Hire rate",
    format: "percent",
    description: "Leads currently Hired ÷ total leads",
    compute: (ctx) => ratio(hiresInRange(ctx), leadsInRange(ctx).length),
  },
  adSpend: {
    id: "adSpend",
    label: "Ad spend",
    format: "currency",
    description: "Weekly ad spend in the period",
    compute: (ctx) => spendInRange(ctx.adSpend, ctx.range),
  },
  costPerLead: {
    id: "costPerLead",
    label: "Cost per lead",
    format: "currency",
    description: "Ad spend ÷ leads, in weeks with spend entered",
    compute: (ctx) => ratio(spendInRange(ctx.adSpend, ctx.range), leadsInSpendWeeks(ctx).length),
    note: missingSpendNote,
  },
  costPerHire: {
    id: "costPerHire",
    label: "Cost per hire",
    format: "currency",
    description: "Ad spend ÷ hires, in weeks with spend entered",
    compute: (ctx) => ratio(spendInRange(ctx.adSpend, ctx.range), leadsInSpendWeeks(ctx).filter(isHired).length),
    note: missingSpendNote,
  },
} satisfies Record<string, MetricDef>;

export type MetricId = keyof typeof metrics;

export function formatMetric(format: MetricDef["format"], value: number | null): string {
  if (value === null) return "—";
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "currency":
      return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value >= 1000 ? 0 : 2,
      });
    default:
      return value.toLocaleString("en-US");
  }
}
