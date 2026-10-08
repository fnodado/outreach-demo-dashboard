import type { DataQualityReport, DateFormat } from "@/lib/domain/types";

const FORMAT_LABEL: Record<DateFormat, string> = {
  serial: "Real date cell",
  "m/d/yyyy": "M/D/YYYY",
  "mm/dd/yy": "MM/DD/YY",
  "yyyy-mm-dd": "YYYY-MM-DD",
  "yyyy-mm-dd hh:mm": "YYYY-MM-DD HH:mm",
  iso: "ISO timestamp",
};

function Row({ label, value, sign, hint }: { label: string; value: number; sign?: "−"; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-ink-2">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </dt>
      <dd className="text-sm font-semibold tabular-nums text-ink">
        {sign && value > 0 ? `${sign} ` : ""}
        {value.toLocaleString("en-US")}
      </dd>
    </div>
  );
}

export function DataQualityPanel({ quality }: { quality: DataQualityReport }) {
  const formats = Object.entries(quality.dateFormats) as [DateFormat, number][];
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-grid">
        <Row label="Raw rows" value={quality.rawRows} hint="Non-blank rows in the Leads tab" />
        <Row label="Test rows removed" value={quality.testRowsRemoved} sign="−" hint="test, asdf, example.com, delete me" />
        <Row label="Rows rejected" value={quality.rowsRejected} sign="−" hint="Unreadable date or unknown stage" />
        <Row label="Duplicates removed" value={quality.duplicatesRemoved} sign="−" hint="Same email or phone; earliest kept" />
        <div className="flex items-baseline justify-between gap-3 border-t border-axis py-2">
          <dt className="text-sm font-semibold text-ink">Clean leads</dt>
          <dd className="text-sm font-semibold tabular-nums text-ink">{quality.cleanRows.toLocaleString("en-US")}</dd>
        </div>
      </dl>

      <div>
        <p className="text-sm text-ink-2">
          <span className="font-semibold text-ink tabular-nums">{quality.datesNormalized}</span> text dates normalized
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {formats.map(([f, n]) => (
            <li key={f} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-2">
              {FORMAT_LABEL[f]} <span className="tabular-nums text-ink">{n}</span>
            </li>
          ))}
        </ul>
      </div>

      {quality.rejected.length > 0 && (
        <details className="text-xs text-ink-2">
          <summary className="cursor-pointer py-1 text-sm text-ink">Why rows were rejected</summary>
          <ul className="mt-2 space-y-1">
            {quality.rejected.map((r, i) => (
              <li key={i}>
                <span className="tabular-nums text-ink">Row {r.row}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
