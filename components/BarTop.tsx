"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NormalizedModel } from "@/lib/types";
import { familyColor } from "@/lib/families";
import { formatPerM } from "@/lib/normalize";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

type Metric = "in" | "out";

export default function BarTop({
  data,
  metric,
  count = 10,
}: {
  data: NormalizedModel[];
  metric: Metric;
  count?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  const [showNegatives, setShowNegatives] = useState(false);
  const [showZeros, setShowZeros] = useState(true);
  const h = 320;

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      if (ref.current) setW(ref.current.clientWidth);
    });
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const priceKey: keyof Pick<NormalizedModel, "inPerM" | "outPerM"> =
    metric === "in" ? "inPerM" : "outPerM";
  const label = metric === "in" ? "$ / 1M input" : "$ / 1M output";

  const rows = useMemo(() => {
    return data
      .filter(m => {
        const val = m[priceKey];
        if (val == null || !Number.isFinite(val)) return false;
        if (!showNegatives && val < 0) return false;
        if (!showZeros && val === 0) return false;
        return true;
      })
      .slice()
      .sort((a, b) => (a[priceKey] as number) - (b[priceKey] as number))
      .slice(0, count)
      .map(m => ({
        id: m.id,
        name: m.name.length > 36 ? m.name.slice(0, 33) + "…" : m.name,
        family: m.family,
        value: m[priceKey] as number,
      }));
  }, [data, priceKey, count, showNegatives, showZeros]);

  if (w <= 0) return <div ref={ref} style={{ height: h }} className="w-full min-w-0" />;

  return (
    <div ref={ref} className="w-full min-w-0">
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowNegatives(s => !s)}
          className={`px-2 py-1 rounded-md text-xs border ${showNegatives ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-300"}`}
          aria-pressed={showNegatives}
        >
          {showNegatives ? "Nascondi negativi" : "Mostra negativi"}
        </button>
        <button
          onClick={() => setShowZeros(s => !s)}
          className={`px-2 py-1 rounded-md text-xs border ${showZeros ? "bg-black dark:bg-white text-white dark:text-black" : "bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-300"}`}
          aria-pressed={showZeros}
        >
          {showZeros ? "Nascondi zeri" : "Mostra zeri"}
        </button>
      </div>
      <BarChart width={w} height={h} data={rows} margin={{ top: 4, right: 20, bottom: 12, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis tickFormatter={v => `$${Number(v).toFixed(0)}`} width={70} />
        <Tooltip formatter={(val) => [formatPerM(val as number), label]} />
        <Bar name={label} dataKey="value" radius={[4, 4, 0, 0]}>
          {rows.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={familyColor(entry.family)} />
          ))}
        </Bar>
      </BarChart>
    </div>
  );
}
