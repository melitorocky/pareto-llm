"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "@/lib/persist";
import {
  ComposedChart, XAxis, YAxis, Scatter, Legend, ZAxis, Label, Line, ReferenceLine,
} from "recharts";
import { NormalizedModel } from "@/lib/types";
import { IntelligenceMap, METRIC_OPTIONS, MetricKey, lookupIntelligence } from "@/lib/intelligence";
import { familyColor, HIGHLIGHT_FAMILIES, isHighlightedFamily } from "@/lib/families";

type Props = {
  data: NormalizedModel[];
  intelligenceMap: IntelligenceMap;
  onSelectModel?: (id: string) => void;
};

type Point = {
  id: string;
  name: string;
  family: string;
  x: number;
  y: number;
  z: number;
};

type HoveredPt = { x: number; y: number; name: string; family: string; cx: number; cy: number };

function getMetricValue(
  model: NormalizedModel,
  map: IntelligenceMap,
  metric: MetricKey
): number | null {
  const intel = lookupIntelligence(map, model.id);
  switch (metric) {
    case "inPerM":    return model.inPerM;
    case "outPerM":   return model.outPerM;
    case "costCombined": {
      const inp = model.inPerM;
      const out = model.outPerM;
      if (inp == null || out == null || inp < 0 || out < 0) return null;
      if (inp === 0 || out === 0) return 0;
      return Math.sqrt(inp * out);
    }
    case "context":   return model.context;
    case "aaScore":   return intel?.aaScore ?? null;
    case "arenaElo":  return intel?.arenaElo ?? null;
    case "aaSpeed":   return intel?.aaSpeed ?? null;
    case "aaLatency": return intel?.aaLatency ?? null;
  }
}

// Compact format for axis ticks and crosshair labels
function formatAxisValue(value: number, metric: MetricKey): string {
  if (!isFinite(value)) return "";
  switch (metric) {
    case "inPerM":
    case "outPerM":
    case "costCombined":
      if (value === 0)    return "$0";
      if (value < 0.001)  return `$${value.toExponential(0)}`;
      if (value < 0.01)   return `$${value.toFixed(3)}`;
      if (value < 0.1)    return `$${value.toFixed(2)}`;
      if (value < 1)      return `$${value.toFixed(1)}`;
      if (value >= 1000)  return `$${(value / 1000).toFixed(0)}K`;
      return `$${value.toFixed(0)}`;
    case "context":
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
      if (value >= 1000)      return `${(value / 1000).toFixed(0)}K`;
      return String(value);
    case "aaLatency":
      return `${value.toFixed(0)}ms`;
    case "aaSpeed":
      return `${value.toFixed(0)}`;
    default:
      return value.toFixed(0);
  }
}

// Full-precision format for the hover tooltip popup
function formatTooltipValue(value: number, metric: MetricKey): string {
  if (!isFinite(value)) return "—";
  switch (metric) {
    case "inPerM":
    case "outPerM":
    case "costCombined":
      if (value === 0) return "$0";
      return `$${parseFloat(value.toPrecision(5))}`;
    case "context":
      return value.toLocaleString();
    case "aaScore":
      return value.toFixed(2);
    case "arenaElo":
      return value.toFixed(1);
    case "aaSpeed":
      return `${value.toFixed(1)} tok/s`;
    case "aaLatency":
      return `${value.toFixed(0)} ms`;
    default:
      return String(value);
  }
}

function computeParetoFront(
  points: Point[],
  xHigherIsBetter: boolean,
  yHigherIsBetter: boolean
): Set<string> {
  const dominated = new Set<string>();
  for (const a of points) {
    if (dominated.has(a.id)) continue;
    for (const b of points) {
      if (a.id === b.id || dominated.has(b.id)) continue;
      const aGeqX = xHigherIsBetter ? a.x >= b.x : a.x <= b.x;
      const aGeqY = yHigherIsBetter ? a.y >= b.y : a.y <= b.y;
      const aGtX  = xHigherIsBetter ? a.x >  b.x : a.x <  b.x;
      const aGtY  = yHigherIsBetter ? a.y >  b.y : a.y <  b.y;
      if (aGeqX && aGeqY && (aGtX || aGtY)) dominated.add(b.id);
    }
  }
  return new Set(points.filter(p => !dominated.has(p.id)).map(p => p.id));
}

function buildStaircase(paretoPoints: Point[]): { x: number; y: number }[] {
  if (paretoPoints.length === 0) return [];
  const sorted = [...paretoPoints].sort((a, b) => a.x - b.x);
  const line: { x: number; y: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    line.push({ x: sorted[i].x, y: sorted[i].y });
    if (i < sorted.length - 1) {
      line.push({ x: sorted[i + 1].x, y: sorted[i].y });
    }
  }
  return line;
}

function CrosshairXLabel({ viewBox, text }: { viewBox?: { x: number; y: number; height: number }; text: string }) {
  if (!viewBox) return null;
  const { x, y, height } = viewBox;
  const w = Math.max(text.length * 6.5 + 10, 28);
  return (
    <g>
      <rect x={x - w / 2} y={y + height + 3} width={w} height={15} fill="#3b82f6" rx={2} />
      <text x={x} y={y + height + 14} textAnchor="middle" fill="white" fontSize={10} fontWeight={600}>{text}</text>
    </g>
  );
}

function CrosshairYLabel({ viewBox, text }: { viewBox?: { x: number; y: number }; text: string }) {
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const w = Math.max(text.length * 6.5 + 10, 28);
  return (
    <g>
      <rect x={x - w - 3} y={y - 8} width={w} height={15} fill="#3b82f6" rx={2} />
      <text x={x - w / 2 - 3} y={y + 3} textAnchor="middle" fill="white" fontSize={10} fontWeight={600}>{text}</text>
    </g>
  );
}

function MetricSelect({
  label, value, onChange,
}: { label: string; value: MetricKey; onChange: (v: MetricKey) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value as MetricKey)}
        className="border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-sm bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
      >
        {METRIC_OPTIONS.map(o => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function ExplorerChart({ data, intelligenceMap, onSelectModel }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  const h = 360;

  const [xMetric, setXMetric] = usePersistentState<MetricKey>("chart_xMetric", "costCombined");
  const [yMetric, setYMetric] = usePersistentState<MetricKey>("chart_yMetric", "context");
  const [hovered, setHovered] = useState<HoveredPt | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      if (ref.current) setW(ref.current.clientWidth);
    });
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const xOpt = METRIC_OPTIONS.find(o => o.key === xMetric)!;
  const yOpt = METRIC_OPTIONS.find(o => o.key === yMetric)!;

  const points = useMemo<Point[]>(() => {
    const pts: Point[] = [];
    for (const m of data) {
      const x = getMetricValue(m, intelligenceMap, xMetric);
      const y = getMetricValue(m, intelligenceMap, yMetric);
      if (x == null || y == null) continue;
      if (xOpt.scale === "log" && x <= 0) continue;
      if (yOpt.scale === "log" && y <= 0) continue;
      pts.push({ id: m.id, name: m.name, family: m.family, x, y, z: isHighlightedFamily(m) ? 1 : 0 });
    }
    return pts;
  }, [data, intelligenceMap, xMetric, yMetric, xOpt.scale, yOpt.scale]);

  const highlightedSeries = useMemo(
    () => Array.from(HIGHLIGHT_FAMILIES).map(fam => ({
      fam,
      pts: points.filter(p => p.family === fam),
    })).filter(s => s.pts.length > 0),
    [points]
  );
  const otherPts = useMemo(
    () => points.filter(p => !HIGHLIGHT_FAMILIES.has(p.family)),
    [points]
  );

  const paretoIds = useMemo(
    () => computeParetoFront(points, xOpt.higherIsBetter, yOpt.higherIsBetter),
    [points, xOpt.higherIsBetter, yOpt.higherIsBetter]
  );

  const staircaseLine = useMemo(() => {
    const paretoPoints = points.filter(p => paretoIds.has(p.id));
    return buildStaircase(paretoPoints);
  }, [points, paretoIds]);

  const xTicks = useMemo(() => {
    const vals = points.map(p => p.x).filter(v => isFinite(v) && (xOpt.scale !== "log" || v > 0));
    if (vals.length < 2) return undefined;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) return [min];
    const N = 10;
    if (xOpt.scale === "log") {
      const l0 = Math.log10(min), l1 = Math.log10(max);
      return Array.from({ length: N }, (_, i) => Math.pow(10, l0 + (i / (N - 1)) * (l1 - l0)));
    }
    return Array.from({ length: N }, (_, i) => min + (i / (N - 1)) * (max - min));
  }, [points, xOpt.scale]);

  // Custom dot: fires onMouseEnter/onMouseLeave only when directly on the dot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dot = useCallback((props: any) => {
    const { cx, cy, r, fill, stroke, payload } = props;
    if (cx == null || cy == null) return null;
    return (
      <circle
        key={payload.id}
        cx={cx} cy={cy} r={r ?? 5}
        fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.85}
        style={{ cursor: onSelectModel ? "pointer" : "default" }}
        onMouseEnter={() => setHovered({ x: payload.x, y: payload.y, name: payload.name, family: payload.family, cx, cy })}
        onMouseLeave={() => setHovered(null)}
        onClick={() => onSelectModel?.(payload.id)}
      />
    );
  }, [onSelectModel]);

  if (points.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-4 items-center">
          <MetricSelect label="Asse X" value={xMetric} onChange={setXMetric} />
          <MetricSelect label="Asse Y" value={yMetric} onChange={setYMetric} />
        </div>
        <div className="flex items-center justify-center text-sm text-zinc-400" style={{ height: h }}>
          Nessun dato disponibile per questa combinazione di metriche.
        </div>
      </div>
    );
  }

  // Tooltip positioning: flip horizontally if near right edge
  const tipLeft = hovered ? (hovered.cx + 170 > w ? hovered.cx - 170 : hovered.cx + 14) : 0;
  const tipTop  = hovered ? Math.max(4, hovered.cy - 56) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 items-center">
        <MetricSelect label="Asse X" value={xMetric} onChange={setXMetric} />
        <MetricSelect label="Asse Y" value={yMetric} onChange={setYMetric} />
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {points.length} modelli con entrambi i dati disponibili
        </span>
      </div>

      <div ref={ref} className="relative w-full min-w-0" style={{ height: h }}>
        {w > 0 && (
          <ComposedChart width={w} height={h} margin={{ top: 10, right: 20, bottom: 55, left: 70 }}>
            <XAxis
              type="number" dataKey="x" name={xOpt.label}
              scale={xOpt.scale} domain={["auto", "auto"]}
              tickFormatter={v => formatAxisValue(Number(v), xMetric)}
              tick={{ fontSize: 11, fill: "#6b7280", angle: -35, textAnchor: "end" }}
              ticks={xTicks}
            >
              <Label value={xOpt.label} position="bottom" offset={28} style={{ fontSize: 12, fill: "#6b7280" }} />
            </XAxis>
            <YAxis
              type="number" dataKey="y" name={yOpt.label}
              scale={yOpt.scale} domain={["auto", "auto"]}
              tickFormatter={v => formatAxisValue(Number(v), yMetric)}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickCount={Math.max(3, Math.min(6, Math.floor(h / 60)))}
            >
              <Label value={yOpt.label} angle={-90} position="insideLeft" offset={-52} style={{ fontSize: 12, fill: "#6b7280" }} />
            </YAxis>
            <ZAxis type="number" dataKey="z" range={[55, 130]} />
            <Legend />
            {highlightedSeries.map(({ fam, pts }) => (
              <Scatter key={fam} name={fam} data={pts} fill={familyColor(fam)} stroke={familyColor(fam)} shape={dot} />
            ))}
            {otherPts.length > 0 && (
              <Scatter name="altre" data={otherPts} fill="#9ca3af" stroke="#9ca3af" shape={dot} />
            )}
            {hovered && (
              <ReferenceLine
                x={hovered.x} stroke="#3b82f6" strokeDasharray="4 2" strokeOpacity={0.45} strokeWidth={1}
                label={<CrosshairXLabel text={formatAxisValue(hovered.x, xMetric)} />}
              />
            )}
            {hovered && (
              <ReferenceLine
                y={hovered.y} stroke="#3b82f6" strokeDasharray="4 2" strokeOpacity={0.45} strokeWidth={1}
                label={<CrosshairYLabel text={formatAxisValue(hovered.y, yMetric)} />}
              />
            )}
            {staircaseLine.length >= 2 && (
              <Line
                data={staircaseLine} dataKey="y" dot={false} activeDot={false}
                stroke="#ef4444" strokeWidth={2.5} strokeDasharray="6 3" strokeOpacity={0.8}
                isAnimationActive={false} name="Frontiera Pareto" legendType="plainline"
              />
            )}
          </ComposedChart>
        )}
        {w === 0 && <div style={{ height: h }} />}

        {/* Custom tooltip — shown only when directly on a dot */}
        {hovered && (
          <div
            className="absolute z-10 pointer-events-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-lg"
            style={{ left: tipLeft, top: tipTop }}
          >
            <p className="font-semibold text-sm mb-1" style={{ color: familyColor(hovered.family) }}>
              {hovered.name}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {xOpt.label}: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{formatTooltipValue(hovered.x, xMetric)}</span>
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
              {yOpt.label}: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{formatTooltipValue(hovered.y, yMetric)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
