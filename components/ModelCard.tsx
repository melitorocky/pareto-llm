"use client";

import { useEffect } from "react";
import { NormalizedModel } from "@/lib/types";
import { IntelligenceData } from "@/lib/intelligence";
import { familyColor } from "@/lib/families";
import { formatPerM, formatContext } from "@/lib/normalize";

type Props = {
  model: NormalizedModel | null;
  intelligence: IntelligenceData | null;
  onClose: () => void;
};

function Score({ label, value, unit, digits = 0 }: { label: string; value: number | null; unit?: string; digits?: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {value != null ? `${value.toFixed(digits)}${unit ? " " + unit : ""}` : "—"}
      </span>
    </div>
  );
}

export default function ModelCard({ model, intelligence, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!model) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [model, onClose]);

  if (!model) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-96 max-w-full flex flex-col bg-white dark:bg-zinc-900 shadow-2xl overflow-y-auto"
        aria-label="Dettagli modello"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex-1 min-w-0">
            <h2
              className="font-semibold text-lg leading-tight truncate"
              style={{ color: familyColor(model.family) }}
            >
              {model.name}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {model.familyLabel} · {model.modality ?? "text"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 p-4 space-y-5">
          {/* Description */}
          {model.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {model.description}
            </p>
          )}

          {/* Intelligence scores — always shown */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Punteggi Intelligenza
            </h3>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3">
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">AA Intelligence</span>
                {intelligence?.aaScore != null
                  ? <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{intelligence.aaScore.toFixed(1)}</span>
                  : <span className="text-2xl font-bold text-zinc-300 dark:text-zinc-600">—</span>
                }
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Arena ELO{intelligence?.arenaRank != null ? ` · #${intelligence.arenaRank}` : ""}
                </span>
                {intelligence?.arenaElo != null
                  ? <span className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{intelligence.arenaElo.toFixed(0)}</span>
                  : <span className="text-2xl font-bold text-zinc-300 dark:text-zinc-600">—</span>
                }
              </div>
            </div>
          </section>

          {/* Performance — always shown */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Performance
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Score label="Velocità output" value={intelligence?.aaSpeed ?? null} unit="tok/s" digits={0} />
              <Score label="Latenza TTFT" value={intelligence?.aaLatency ?? null} unit="ms" digits={0} />
            </div>
          </section>

          {/* Pricing */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Prezzi
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Score label="Input / 1M token" value={model.inPerM} unit="$" digits={2} />
              <Score label="Output / 1M token" value={model.outPerM} unit="$" digits={2} />
            </div>
          </section>

          {/* Context & cutoff */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Capacità
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Finestra contesto</span>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{formatContext(model.context)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Knowledge cutoff</span>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{model.knowledgeCutoff ?? "—"}</span>
              </div>
            </div>
          </section>

          {/* Flags */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Peculiarità
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {model.flags.reasoning && <Chip color="emerald">Reasoning</Chip>}
              {model.flags.tools && <Chip color="blue">Tools</Chip>}
              {model.flags.structured && <Chip color="purple">Structured Output</Chip>}
              {model.flags.vision && <Chip color="amber">Vision</Chip>}
              {model.flags.audio && <Chip color="pink">Audio</Chip>}
              {model.flags.file && <Chip color="slate">File</Chip>}
              {model.flags.moderated && <Chip color="green">Moderated</Chip>}
              {!Object.values(model.flags).some(Boolean) && (
                <span className="text-xs text-zinc-400">Nessuna</span>
              )}
            </div>
          </section>

          {/* Supported parameters */}
          {(model.raw.supported_parameters ?? []).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                Parametri supportati
              </h3>
              <div className="flex flex-wrap gap-1">
                {(model.raw.supported_parameters ?? []).map(p => (
                  <span
                    key={p}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Tokenizer / max completion */}
          <section className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <div>Tokenizer: <span className="text-zinc-700 dark:text-zinc-300">{model.raw.architecture?.tokenizer ?? "—"}</span></div>
            <div>Max completion tokens: <span className="text-zinc-700 dark:text-zinc-300">{model.raw.top_provider?.max_completion_tokens ?? "—"}</span></div>
            <div>ID: <span className="font-mono text-zinc-700 dark:text-zinc-300">{model.id}</span></div>
          </section>
        </div>

        {/* Footer link */}
        {model.raw.links?.details && (
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
            <a
              href={`https://openrouter.ai${model.raw.links.details}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Apri su OpenRouter →
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

type ChipColor = "emerald" | "blue" | "purple" | "amber" | "pink" | "slate" | "green";

const chipClasses: Record<ChipColor, string> = {
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  blue:    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  purple:  "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  amber:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pink:    "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  slate:   "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  green:   "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800",
};

function Chip({ color, children }: { color: ChipColor; children: React.ReactNode }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${chipClasses[color]}`}>
      {children}
    </span>
  );
}
