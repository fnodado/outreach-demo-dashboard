"use client";

import { useEffect, useRef, useState } from "react";
import { STAGES } from "@/config/app.config";
import type { WeekRow } from "@/lib/metrics/weeks";
import { stageColor } from "./stageColors";

const HEIGHT = 240;
const M = { top: 8, right: 4, bottom: 24, left: 32 };
const GAP = 2;
const RADIUS = 4;

const shortDate = (d: string) => {
  const [, m, day] = d.split("-").map(Number);
  return `${m}/${day}`;
};

function niceMax(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 4, step: 1 };
  const raw = v / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  return { max: Math.ceil(v / step) * step, step };
}

/** Rect with rounded top corners only (the data end); square at the baseline. */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function StackedBarByWeek({ rows }: { rows: WeekRow[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = Math.max(width - M.left - M.right, 0);
  const plotH = HEIGHT - M.top - M.bottom;
  const { max, step } = niceMax(Math.max(0, ...rows.map((r) => r.total)));
  const y = (v: number) => M.top + plotH - (v / max) * plotH;
  const slot = rows.length ? plotW / rows.length : 0;
  const barW = Math.max(Math.min(slot * 0.62, 40), 4);
  const labelEvery = slot >= 34 ? 1 : slot >= 17 ? 2 : 4;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const activeRow = active !== null ? rows[active] : null;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Stages">
        {STAGES.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: stageColor[s] }} aria-hidden />
            {s}
          </li>
        ))}
      </ul>

      <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Leads per week, stacked by current stage. The table below lists the same numbers."
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} style={{ stroke: t === 0 ? "var(--axis)" : "var(--grid)" }} strokeWidth={1} />
                <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="text-[10px] tabular-nums" style={{ fill: "var(--muted)" }}>
                  {t}
                </text>
              </g>
            ))}

            {rows.map((row, i) => {
              const x = M.left + i * slot + (slot - barW) / 2;
              const nonZero = STAGES.filter((s) => row.counts[s] > 0);
              const top = nonZero[nonZero.length - 1];
              let acc = 0;
              return (
                <g key={row.weekStart} opacity={active === null || active === i ? 1 : 0.45}>
                  {nonZero.map((s, k) => {
                    const v = row.counts[s];
                    const y1 = y(acc + v);
                    const y0 = y(acc) - (k === 0 ? 0 : GAP);
                    acc += v;
                    const h = Math.max(y0 - y1, 1);
                    return s === top ? (
                      <path key={s} d={topRoundedRect(x, y1, barW, h, RADIUS)} style={{ fill: stageColor[s] }} />
                    ) : (
                      <rect key={s} x={x} y={y1} width={barW} height={h} style={{ fill: stageColor[s] }} />
                    );
                  })}
                  {(i % labelEvery === 0 || i === rows.length - 1) && (
                    <text x={x + barW / 2} y={HEIGHT - 6} textAnchor="middle" className="text-[10px] tabular-nums" style={{ fill: "var(--muted)" }}>
                      {shortDate(row.weekStart)}
                    </text>
                  )}
                  {/* Hit target: the whole column, larger than the bar. */}
                  <rect
                    x={M.left + i * slot}
                    y={M.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`Week of ${row.weekStart}: ${row.total} leads`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive(i)}
                    className="cursor-pointer outline-none"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {activeRow && active !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-44 rounded-lg border border-line bg-surface p-2.5 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(M.left + active * slot + slot / 2 - 88, 0), Math.max(width - 176, 0)),
            }}
          >
            <p className="mb-1.5 font-semibold text-ink">Week of {shortDate(activeRow.weekStart)}</p>
            <ul className="space-y-0.5">
              {[...STAGES].reverse().map((s) => (
                <li key={s} className="flex items-center justify-between gap-2 text-ink-2">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-sm" style={{ background: stageColor[s] }} aria-hidden />
                    {s}
                  </span>
                  <span className="tabular-nums text-ink">{activeRow.counts[s]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-semibold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{activeRow.total}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
