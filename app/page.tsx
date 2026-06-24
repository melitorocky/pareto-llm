"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OpenRouterModelsResponse, NormalizedModel } from "@/lib/types";
import { IntelligenceMap } from "@/lib/intelligence";
import { normalizeModel, formatUSD, formatPerM, formatContext } from "@/lib/normalize";
import { familyColor, isHighlightedFamily, HIGHLIGHT_FAMILIES } from "@/lib/families";
import { scoreModels, Task } from "@/lib/scoring";
import { lookupIntelligence } from "@/lib/intelligence";
import { usePersistentState } from "@/lib/persist";
import ExplorerChart from "@/components/ExplorerChart";
import BarTop from "@/components/BarTop";
import ModelCard from "@/components/ModelCard";
import ThemeToggle from "@/components/ThemeToggle";

type Filters = {
  search: string;
  showReasoning: boolean;
  showVision: boolean;
  showTools: boolean;
  families: string[];
  onlyHighlighted: boolean;
};

async function fetchModels(): Promise<NormalizedModel[]> {
  const res = await fetch("/api/models");
  if (!res.ok) throw new Error("Errore caricamento modelli");
  const json = (await res.json()) as OpenRouterModelsResponse;
  return (json.data || []).map(normalizeModel);
}

async function fetchIntelligence(): Promise<IntelligenceMap> {
  const res = await fetch("/api/intelligence");
  if (!res.ok) return {};
  return res.json();
}

export default function DashboardPage() {
  const {
    data,
    isLoading,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["models"],
    queryFn: fetchModels,
    staleTime: 1000 * 60 * 10,
  });

  const { data: intelligenceMap = {} } = useQuery({
    queryKey: ["intelligence"],
    queryFn: fetchIntelligence,
    staleTime: 1000 * 60 * 60,  // 1h client-side stale (server caches 24h)
    retry: false,               // don't retry if the external APIs are unavailable
  });

  const [cq, setCq] = usePersistentState<number>("cqBalance", 0.5);
  const [task, setTask] = usePersistentState<Task>("task", "plan");
  const [filters, setFilters] = usePersistentState<Filters>("filters", {
    search: "",
    showReasoning: false,
    showVision: false,
    showTools: false,
    families: [],
    onlyHighlighted: false,
  });
  const [barMetric, setBarMetric] = usePersistentState<"in" | "out">("barMetric", "in");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const models = data ?? [];

  const familiesAll = useMemo(() => {
    const s = new Set<string>();
    for (const m of models) s.add(m.family);
    return Array.from(s.values());
  }, [models]);

  const filtered = useMemo(() => {
    const q = (filters.search || "").toLowerCase();
    return models.filter(m => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (filters.showReasoning && !m.flags.reasoning) return false;
      if (filters.showVision && !m.flags.vision) return false;
      if (filters.showTools && !m.flags.tools) return false;
      if (filters.onlyHighlighted && !isHighlightedFamily(m)) return false;
      if (filters.families.length > 0 && !filters.families.includes(m.family)) return false;
      return true;
    });
  }, [models, filters]);

  const ranked = useMemo(() => scoreModels(filtered, task, cq), [filtered, task, cq]);
  const top3 = ranked.slice(0, 3);

  const selectedModel = useMemo(
    () => ranked.find(r => r.model.id === selectedId)?.model ?? null,
    [ranked, selectedId]
  );
  const selectedIntelligence = useMemo(
    () => selectedModel ? lookupIntelligence(intelligenceMap, selectedModel.id) : null,
    [intelligenceMap, selectedModel]
  );

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString() : "—";

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <header className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold mr-auto dark:text-zinc-100">Dashboard Modelli OpenRouter</h1>
          <ThemeToggle />
          <button
            onClick={() => refetch()}
            className="px-3 py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm hover:opacity-90"
          >
            Aggiorna
          </button>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            Ultimo aggiornamento: {lastUpdated}
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
          {/* Left column — filters + charts */}
          <div className="col-span-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-4 min-w-0 w-full">
            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
                placeholder="Cerca modello..."
                className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 w-full sm:w-64 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
              />
              <FilterCheck
                label="Reasoning"
                checked={filters.showReasoning}
                onChange={v => setFilters({ ...filters, showReasoning: v })}
              />
              <FilterCheck
                label="Vision"
                checked={filters.showVision}
                onChange={v => setFilters({ ...filters, showVision: v })}
              />
              <FilterCheck
                label="Tools"
                checked={filters.showTools}
                onChange={v => setFilters({ ...filters, showTools: v })}
              />
              <FilterCheck
                label="Solo famiglie in evidenza"
                checked={filters.onlyHighlighted}
                onChange={v => setFilters({ ...filters, onlyHighlighted: v })}
              />
            </div>

            {/* Family chips */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Famiglie:</span>
              <div className="flex gap-1 flex-wrap">
                {familiesAll.map(f => {
                  const active = filters.families.includes(f);
                  return (
                    <button
                      key={f}
                      onClick={() => {
                        const sel = new Set(filters.families);
                        sel.has(f) ? sel.delete(f) : sel.add(f);
                        setFilters({ ...filters, families: Array.from(sel) });
                      }}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cost/quality slider */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium dark:text-zinc-200">Bilancia costo e qualità</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{(cq * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05}
                value={cq}
                onChange={e => setCq(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Costo</span><span>Qualità</span>
              </div>
            </div>

            {/* Explorer chart */}
            <div>
              <h3 className="text-sm font-medium mb-2 dark:text-zinc-200">Grafico esplorativo</h3>
              <ExplorerChart
                data={filtered}
                intelligenceMap={intelligenceMap}
                onSelectModel={id => setSelectedId(prev => prev === id ? null : id)}
              />
            </div>

            {/* Bar chart — cheapest models */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium mr-auto dark:text-zinc-200">Top economici</h3>
                <button
                  onClick={() => setBarMetric("in")}
                  className={`px-2 py-1 rounded-md text-xs border ${
                    barMetric === "in"
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                      : "bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  $/1M Input
                </button>
                <button
                  onClick={() => setBarMetric("out")}
                  className={`px-2 py-1 rounded-md text-xs border ${
                    barMetric === "out"
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                      : "bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  $/1M Output
                </button>
              </div>
              <BarTop data={filtered} metric={barMetric} />
            </div>
          </div>

          {/* Right column — recommendations */}
          <aside className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(["plan", "build", "code"] as Task[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTask(t)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    task === t
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900"
                      : "bg-white dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {t === "plan" ? "Pianificazione" : t === "build" ? "Sviluppo" : "Codice"}
                </button>
              ))}
            </div>
            <h3 className="text-sm font-medium dark:text-zinc-200">
              Consigli top per:{" "}
              {task === "plan" ? "Pianificazione" : task === "build" ? "Sviluppo" : "Modifiche Codice"}
            </h3>
            <ol className="space-y-3 list-decimal ml-4">
              {top3.map(({ model, score }) => {
                const intel = lookupIntelligence(intelligenceMap, model.id);
                return (
                  <li key={model.id} className="text-sm">
                    <button
                      className="font-semibold hover:underline text-left"
                      style={{ color: familyColor(model.family) }}
                      onClick={() => setSelectedId(prev => prev === model.id ? null : model.id)}
                    >
                      {model.name}
                    </button>
                    <span className="text-zinc-400 dark:text-zinc-500"> · {(score * 100).toFixed(0)}%</span>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      In {formatPerM(model.inPerM)} · Out {formatPerM(model.outPerM)} · Ctx {formatContext(model.context)}
                    </div>
                    {(intel?.aaScore != null || intel?.arenaElo != null) && (
                      <div className="text-xs text-zinc-400 dark:text-zinc-500">
                        {intel.aaScore != null && `AA: ${intel.aaScore.toFixed(0)}`}
                        {intel.aaScore != null && intel.arenaElo != null && " · "}
                        {intel.arenaElo != null && `ELO: ${intel.arenaElo.toFixed(0)}`}
                      </div>
                    )}
                  </li>
                );
              })}
              {top3.length === 0 && (
                <p className="text-xs text-zinc-400">Nessun modello corrisponde ai filtri correnti.</p>
              )}
            </ol>
          </aside>
        </section>

        {/* Model table */}
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto bg-white dark:bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <Th>Nome</Th>
                <Th>Famiglia</Th>
                <Th>$/1M In</Th>
                <Th>$/1M Out</Th>
                <Th>Contesto</Th>
                <Th>AA Score</Th>
                <Th>Arena ELO</Th>
                <Th>Velocità</Th>
                <Th>Peculiarità</Th>
                <Th>Cutoff</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-3 py-3 text-zinc-500" colSpan={10}>Caricamento…</td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td className="px-3 py-3 text-red-500" colSpan={10}>Errore nel caricamento dei modelli.</td>
                </tr>
              )}
              {!isLoading && !isError && ranked.map(({ model }) => {
                const intel = lookupIntelligence(intelligenceMap, model.id);
                const isSelected = model.id === selectedId;
                return (
                  <tr
                    key={model.id}
                    className={`border-t border-zinc-100 dark:border-zinc-800 ${isSelected ? "bg-zinc-50 dark:bg-zinc-800/60" : "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"}`}
                  >
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setSelectedId(prev => prev === model.id ? null : model.id)}
                        className="font-medium hover:underline text-left"
                        style={{ color: familyColor(model.family) }}
                      >
                        {model.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{model.familyLabel}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{formatPerM(model.inPerM)}</td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{formatPerM(model.outPerM)}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{formatContext(model.context)}</td>
                    <td className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                      {intel?.aaScore != null ? intel.aaScore.toFixed(1) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                      {intel?.arenaElo != null ? intel.arenaElo.toFixed(0) : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {intel?.aaSpeed != null ? `${intel.aaSpeed.toFixed(0)} t/s` : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="px-3 py-2 space-x-1">
                      {model.flags.reasoning && <FlagBadge color="emerald">Reasoning</FlagBadge>}
                      {model.flags.tools && <FlagBadge color="blue">Tools</FlagBadge>}
                      {model.flags.structured && <FlagBadge color="purple">Structured</FlagBadge>}
                      {model.flags.vision && <FlagBadge color="amber">Vision</FlagBadge>}
                      {model.flags.audio && <FlagBadge color="pink">Audio</FlagBadge>}
                      {model.flags.file && <FlagBadge color="slate">File</FlagBadge>}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{model.knowledgeCutoff ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      {/* Model detail slide-over */}
      <ModelCard
        model={selectedModel}
        intelligence={selectedIntelligence}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}

// ── Small shared components ────────────────────────────────────────────────────

function FilterCheck({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="accent-zinc-700 dark:accent-zinc-300"
      />
      {label}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  );
}

type BadgeColor = "emerald" | "blue" | "purple" | "amber" | "pink" | "slate";
const badgeClasses: Record<BadgeColor, string> = {
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  blue:    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  purple:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  amber:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pink:    "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  slate:   "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

function FlagBadge({ color, children }: { color: BadgeColor; children: React.ReactNode }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClasses[color]}`}>
      {children}
    </span>
  );
}
