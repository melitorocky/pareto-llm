export type IntelligenceData = {
  aaScore: number | null;     // Artificial Analysis intelligence index
  aaSpeed: number | null;     // output tokens/sec
  aaLatency: number | null;   // time to first token (ms)
  arenaElo: number | null;    // LMSYS Chatbot Arena ELO
  arenaRank: number | null;
};

export type IntelligenceMap = Record<string, IntelligenceData>;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function openRouterSlug(id: string): string {
  // "anthropic/claude-opus-4-8" -> "claude-opus-4-8"
  const parts = id.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : id;
}

// Given an OpenRouter model ID, try several key forms against the intelligence map.
export function lookupIntelligence(
  map: IntelligenceMap,
  openRouterId: string
): IntelligenceData | null {
  const slug = openRouterSlug(openRouterId).toLowerCase();
  const slugified = slugify(openRouterSlug(openRouterId));
  const full = openRouterId.toLowerCase();
  return map[slug] ?? map[slugified] ?? map[full] ?? null;
}

// Available metrics for the explorer chart axes.
export type MetricKey =
  | "inPerM"
  | "outPerM"
  | "context"
  | "aaScore"
  | "arenaElo"
  | "aaSpeed"
  | "aaLatency";

export const METRIC_OPTIONS: {
  key: MetricKey;
  label: string;
  unit: string;
  scale: "log" | "linear";
  higherIsBetter: boolean;
}[] = [
  { key: "inPerM",    label: "$/1M Input",    unit: "$",     scale: "log",    higherIsBetter: false },
  { key: "outPerM",   label: "$/1M Output",   unit: "$",     scale: "log",    higherIsBetter: false },
  { key: "context",   label: "Contesto",      unit: "tok",   scale: "log",    higherIsBetter: true },
  { key: "aaScore",   label: "AA Intelligence", unit: "pts", scale: "linear", higherIsBetter: true },
  { key: "arenaElo",  label: "Arena ELO",     unit: "pts",   scale: "linear", higherIsBetter: true },
  { key: "aaSpeed",   label: "Velocità",      unit: "tok/s", scale: "linear", higherIsBetter: true },
  { key: "aaLatency", label: "Latenza TTFT",  unit: "ms",    scale: "linear", higherIsBetter: false },
];
