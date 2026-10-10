"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/views/components/icons";

/**
 * Small, dependency-free SVG/HTML charts following the data-viz rules:
 * thin square marks (the design system has no rounded corners), a 2px
 * surface gap between stacked segments, hairline solid grid, a legend for
 * 2+ series, hover + keyboard tooltips, and a table view for every chart.
 * Colours come from the validated neutral ramp in globals.css (.viz-root).
 */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = Math.ceil(value / (step * magnitude)) * step * magnitude;
    if (candidate / (step * magnitude) <= 5) return candidate;
  }
  return Math.ceil(value);
}

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  table: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <figure className={cn("viz-root glass animate-glass-in p-5 sm:p-6", className)}>
      <figcaption className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold tracking-[-0.01em]">{title}</p>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div role="group" aria-label="Display as" className="inline-flex shrink-0 border border-border p-0.5 text-xs">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "px-2.5 py-1 font-medium capitalize transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </figcaption>
      {legend && view === "chart" && <div className="mt-3">{legend}</div>}
      <div className="mt-4">{view === "chart" ? children : table}</div>
    </figure>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-block size-2.5" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Plans posted per day, split into "found a companion" (accent) and "no companion yet" (context). */
export function FulfilmentChart({
  days,
}: {
  days: { key: string; label: string; posted: number; fulfilled: number }[];
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const margin = { top: 16, right: 8, bottom: 24, left: 30 };
  const plotH = 170;
  const height = plotH + margin.top + margin.bottom;
  const plotW = Math.max(0, width - margin.left - margin.right);
  const yMax = niceMax(Math.max(...days.map((d) => d.posted), 1));
  const ticks = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i).filter((t) => Number.isInteger(t));
  const band = days.length ? plotW / days.length : 0;
  const barW = Math.min(22, band * 0.6);
  const y = (v: number) => margin.top + plotH - (v / yMax) * plotH;
  const labelEvery = Math.max(1, Math.ceil((days.length * 34) / Math.max(plotW, 1)));
  const last = days.length - 1;

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1.5 font-medium">Day</th>
          <th className="py-1.5 text-right font-medium">Posted</th>
          <th className="py-1.5 text-right font-medium">Found a companion</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {days.map((d) => (
          <tr key={d.key} className="border-t border-border">
            <td className="py-1.5">{d.label}</td>
            <td className="py-1.5 text-right">{d.posted}</td>
            <td className="py-1.5 text-right">{d.fulfilled}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartCard
      title="Plans posted, and how many found a companion"
      subtitle="Last 14 days"
      table={table}
      legend={
        <div className="flex flex-wrap gap-4">
          <LegendItem color="var(--viz-accent)" label="Found a companion" />
          <LegendItem color="var(--viz-context)" label="No companion" />
        </div>
      }
    >
      <div ref={ref} className="relative w-full" style={{ height }} onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label="Daily plans posted and fulfilled, last 14 days">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={margin.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-[10px] tabular-nums"
                >
                  {t}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              const cx = margin.left + band * i + band / 2;
              const x = cx - barW / 2;
              const fulfilledH = (d.fulfilled / yMax) * plotH;
              const restH = ((d.posted - d.fulfilled) / yMax) * plotH;
              const gap = d.fulfilled > 0 && d.posted - d.fulfilled > 0 ? 2 : 0;
              const base = margin.top + plotH;
              return (
                <g
                  key={d.key}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${d.posted} posted, ${d.fulfilled} found a companion`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                  opacity={active === null || active === i ? 1 : 0.5}
                  style={{ transition: "opacity 160ms ease" }}
                >
                  <rect x={margin.left + band * i} y={margin.top} width={band} height={plotH} fill="transparent" />
                  {fulfilledH > 0 && (
                    <rect
                      x={x}
                      y={base - fulfilledH}
                      width={barW}
                      height={fulfilledH}
                      fill="var(--viz-accent)"
                      shapeRendering="crispEdges"
                    />
                  )}
                  {restH > 0 && (
                    <rect
                      x={x}
                      y={base - fulfilledH - gap - restH}
                      width={barW}
                      height={restH}
                      fill="var(--viz-context)"
                      shapeRendering="crispEdges"
                    />
                  )}
                  {i === last && d.posted > 0 && (
                    <text
                      x={cx}
                      y={y(d.posted) - 6 - gap}
                      textAnchor="middle"
                      className="fill-foreground font-mono text-[11px] font-semibold"
                    >
                      {d.posted}
                    </text>
                  )}
                  {(i % labelEvery === 0 || i === last) && (
                    <text
                      x={cx}
                      y={height - 6}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px] tabular-nums"
                    >
                      {i === last ? "Today" : d.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {active !== null && days[active] && (
          <div
            role="status"
            className="glass-strong pointer-events-none absolute z-10 min-w-40 -translate-x-1/2 px-3 py-2 text-xs"
            style={{
              left: Math.min(Math.max(margin.left + band * active + band / 2, 80), width - 80),
              top: Math.max(0, y(days[active].posted) - 74),
            }}
          >
            <p className="label-caps text-[0.6rem] text-muted-foreground">
              {active === last ? "Today" : days[active].label}
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span className="inline-block size-2" style={{ background: "var(--viz-accent)" }} />
              <span className="font-semibold tabular-nums">{days[active].fulfilled}</span>
              <span className="text-muted-foreground">found a companion</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block size-2" style={{ background: "var(--viz-context)" }} />
              <span className="font-semibold tabular-nums">{days[active].posted}</span>
              <span className="text-muted-foreground">posted</span>
            </p>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

/** Plans per activity: one series, so one colour and no legend box. */
export function ActivityChart({ rows }: { rows: { id: string; label: string; icon: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1.5 font-medium">Activity</th>
          <th className="py-1.5 text-right font-medium">Plans</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border">
            <td className="py-1.5">{r.label}</td>
            <td className="py-1.5 text-right">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <ChartCard title="What people plan" subtitle="Plans posted per activity, last 14 days" table={table}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li
            key={r.id}
            tabIndex={0}
            title={`${r.label}: ${r.count} plans`}
            aria-label={`${r.label}: ${r.count} plans`}
            className="group grid grid-cols-[8.5rem_1fr] items-center gap-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <span className="flex items-center gap-2 truncate text-sm">
              <Icon name={r.icon} className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{r.label}</span>
            </span>
            <span className="flex items-center gap-2">
              {r.count > 0 && (
                <span
                  className="h-3.5 transition-[opacity,width] duration-500 group-hover:opacity-75"
                  style={{ width: `${(r.count / max) * 85}%`, background: "var(--viz-accent)" }}
                />
              )}
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{r.count}</span>
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/** A ratio against 100%: accent fill on a neutral track. */
export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label={label}
      className="viz-root mt-3 h-1.5 w-full overflow-hidden"
      style={{ background: "var(--viz-track)" }}
    >
      <div
        className="h-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.round(value * 100)}%`, background: "var(--viz-accent)" }}
      />
    </div>
  );
}
