import { formatMetric, type MetricDef } from "@/lib/metrics/registry";

export function KpiCard({
  metric,
  value,
  note,
  className = "",
}: {
  metric: MetricDef;
  value: number | null;
  note?: string | null;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      <p className="text-xs font-medium text-ink-2">{metric.label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{formatMetric(metric.format, value)}</p>
      <p className="mt-1 text-xs text-muted">{metric.description}</p>
      {note && <p className="mt-1.5 text-xs font-medium text-ink-2">{note}</p>}
    </div>
  );
}
