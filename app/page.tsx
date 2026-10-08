import { StackedBarByWeek } from "@/components/charts/StackedBarByWeek";
import { Card } from "@/components/ui/Card";
import { DataQualityPanel } from "@/components/ui/DataQualityPanel";
import { KpiCard } from "@/components/ui/KpiCard";
import { WeeklyStageTable } from "@/components/ui/WeeklyStageTable";
import { appConfig } from "@/config/app.config";
import { getDataSource } from "@/lib/data";
import { metrics, type MetricDef } from "@/lib/metrics/registry";
import { addDays, countByWeekAndStage, rangeOfLeads } from "@/lib/metrics/weeks";

export const revalidate = 60;

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function DashboardPage() {
  const ds = getDataSource();
  const [{ leads, quality }, adSpend] = await Promise.all([ds.getLeads(), ds.getAdSpend()]);

  const range = rangeOfLeads(leads);
  const rows = range ? countByWeekAndStage(leads, range) : [];
  const ctx = range ? { leads, adSpend, range } : null;
  const kpis: MetricDef[] = [metrics.totalLeads, metrics.hireRate, metrics.adSpend, metrics.costPerLead, metrics.costPerHire];

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Recruiting Pipeline</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {range
              ? `${longDate(range.from)} – ${longDate(addDays(range.to, 6))}`
              : "No leads yet"}
            {" · "}weeks start Monday (ET)
          </p>
        </div>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">Source: {ds.name}</span>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((m, i) => (
          <KpiCard
            key={m.id}
            metric={m}
            value={ctx ? m.compute(ctx) : null}
            note={ctx ? m.note?.(ctx) : null}
            className={i === 0 ? "col-span-2 sm:col-span-1" : ""} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Leads by stage, week by week"
          subtitle="Each lead counted once, in the week it was created, at its current stage."
          className="min-w-0 lg:col-span-2"
        >
          <StackedBarByWeek rows={rows} />
        </Card>
        <Card title="Data quality" subtitle="How raw sheet rows became clean leads.">
          <DataQualityPanel quality={quality} />
        </Card>
      </div>

      <Card title="Weekly breakdown" subtitle="Same numbers as the chart.">
        <WeeklyStageTable rows={rows} />
      </Card>

      <footer className="pb-4 text-xs text-muted">
        Data refreshes every {appConfig.revalidateSeconds}s. Only aggregated, de-identified numbers are sent to the browser.
      </footer>
    </main>
  );
}
