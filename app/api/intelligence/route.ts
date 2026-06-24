import { unstable_cache } from "next/cache";
import type { IntelligenceData, IntelligenceMap } from "@/lib/intelligence";

// ── Artificial Analysis ────────────────────────────────────────────────────────

type AAModel = {
  id?: string | null;
  name?: string | null;
  quality_index?: number | null;
  intelligence_index?: number | null;
  median_output_tokens_per_second?: number | null;
  // median_time_to_first_token is in seconds on their API
  median_time_to_first_token?: number | null;
};

async function fetchArtificialAnalysis(): Promise<AAModel[]> {
  const headers: HeadersInit = { accept: "application/json" };
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;

  const res = await fetch("https://artificialanalysis.ai/api/v2/language/models", {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data.models ?? data.data ?? []);
}

// ── Arena ELO (lmarena-ai/leaderboard-dataset on HuggingFace) ─────────────────

type ArenaRow = {
  model_name: string;
  rating: number;
  rank: number;
  category: string;
};

async function fetchArenaEloPage(offset: number): Promise<ArenaRow[]> {
  const url = `https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset&config=text&split=latest&offset=${offset}&length=100`;
  const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.rows ?? []).map((r: any) => r.row as ArenaRow);
}

async function fetchArenaElo(): Promise<ArenaRow[]> {
  // "overall" category rows appear first in the dataset (rows 0–~590).
  // Fetch 6 pages in parallel to cover all overall-ranked models.
  const offsets = [0, 100, 200, 300, 400, 500];
  const pages = await Promise.all(offsets.map(fetchArenaEloPage));
  const all = pages.flat();
  // Keep only "overall" category — one entry per model, most recent ranking
  return all.filter(r => r.category === "overall");
}

// ── Normalization ──────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function buildMap(): Promise<IntelligenceMap> {
  const [aaResult, arenaResult] = await Promise.allSettled([
    fetchArtificialAnalysis(),
    fetchArenaElo(),
  ]);

  const aaModels = aaResult.status === "fulfilled" ? aaResult.value : [];
  const arenaRows = arenaResult.status === "fulfilled" ? arenaResult.value : [];

  const map: IntelligenceMap = {};

  const set = (key: string, data: Partial<IntelligenceData>) => {
    if (!key) return;
    const existing = map[key] ?? {
      aaScore: null, aaSpeed: null, aaLatency: null, arenaElo: null, arenaRank: null,
    };
    map[key] = { ...existing, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v != null)) } as IntelligenceData;
  };

  for (const m of aaModels) {
    if (!m.id) continue;
    const data: Partial<IntelligenceData> = {
      aaScore: m.intelligence_index ?? m.quality_index ?? null,
      aaSpeed: m.median_output_tokens_per_second ?? null,
      // AA returns TTFT in seconds → convert to ms
      aaLatency:
        m.median_time_to_first_token != null
          ? Math.round(m.median_time_to_first_token * 1000)
          : null,
    };
    const id = m.id.toLowerCase();
    set(id, data);
    set(slugify(m.id), data);
    if (m.name) set(slugify(m.name), data);
  }

  for (const r of arenaRows) {
    const name = (r.model_name ?? "").toLowerCase().trim();
    if (!name) continue;
    const data: Partial<IntelligenceData> = {
      arenaElo: r.rating ?? null,
      arenaRank: r.rank ?? null,
    };
    set(name, data);
    set(slugify(name), data);
    // Also store "-thinking" suffix as ":thinking" to match OpenRouter IDs
    // e.g. "claude-opus-4-6-thinking" → also stored as "claude-opus-4-6:thinking"
    if (name.endsWith("-thinking")) {
      const withColon = name.slice(0, -"-thinking".length) + ":thinking";
      set(withColon, data);
      set(slugify(withColon), data);
    }
  }

  return map;
}

// Cache for 24 hours
const getCachedMap = unstable_cache(buildMap, ["intelligence-map"], {
  revalidate: 60 * 60 * 24,
  tags: ["intelligence"],
});

export async function GET() {
  try {
    const data = await getCachedMap();
    return Response.json(data);
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to fetch intelligence data" }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}
