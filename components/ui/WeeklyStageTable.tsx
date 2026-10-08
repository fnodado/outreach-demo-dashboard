import { STAGES } from "@/config/app.config";
import type { WeekRow } from "@/lib/metrics/weeks";
import { stageColor } from "@/components/charts/stageColors";

const shortDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return `${m}/${day}/${String(y).slice(2)}`;
};

export function WeeklyStageTable({ rows }: { rows: WeekRow[] }) {
  const totals = Object.fromEntries(STAGES.map((s) => [s, rows.reduce((n, r) => n + r.counts[s], 0)]));
  const grand = rows.reduce((n, r) => n + r.total, 0);

  return (
    // Scrolls inside its own box so the page never scrolls sideways at 375px.
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[640px] border-collapse text-xs tabular-nums">
        <caption className="sr-only">Leads by week of Created Date and current stage</caption>
        <thead>
          <tr className="border-b border-axis text-ink-2">
            <th scope="col" className="sticky left-0 bg-surface py-2 pr-3 text-left font-medium">Week of</th>
            {STAGES.map((s) => (
              <th key={s} scope="col" className="px-2 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm" style={{ background: stageColor[s] }} aria-hidden />
                  {s}
                </span>
              </th>
            ))}
            <th scope="col" className="py-2 pl-2 text-right font-semibold text-ink">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.weekStart} className="border-b border-grid">
              <th scope="row" className="sticky left-0 bg-surface py-2 pr-3 text-left font-medium text-ink">{shortDate(r.weekStart)}</th>
              {STAGES.map((s) => (
                <td key={s} className={`px-2 py-2 text-right ${r.counts[s] ? "text-ink" : "text-muted"}`}>{r.counts[s]}</td>
              ))}
              <td className="py-2 pl-2 text-right font-semibold text-ink">{r.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-axis font-semibold text-ink">
            <th scope="row" className="sticky left-0 bg-surface py-2 pr-3 text-left">All weeks</th>
            {STAGES.map((s) => (
              <td key={s} className="px-2 py-2 text-right">{totals[s]}</td>
            ))}
            <td className="py-2 pl-2 text-right">{grand}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
