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

// ── Arena ELO (LMSYS Chatbot Arena via HuggingFace dataset) ───────────────────

type ArenaRow = {
  key?: string | null;
  Model?: string | null;
  model?: string | null;
  "Arena Elo"?: number | null;
  elo_rating?: number | null;
  rating?: number | null;
  Rank?: number | null;
  rank?: number | null;
};

async function fetchArenaElo(): Promise<ArenaRow[]> {
  // Primary: HuggingFace datasets-server (public, no auth needed)
  try {
    const url =
      "https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fchatbot-arena-leaderboard&config=default&split=train&offset=0&length=500";
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: ArenaRow[] = (json.rows ?? []).map((r: any) => r.row as ArenaRow);
      if (rows.length > 0) return rows;
    }
  } catch {}

  // Fallback: try lmarena.ai public API
  try {
    const res = await fetch("https://lmarena.ai/api/leaderboard", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : (data.models ?? data.data ?? []);
    }
  } catch {}

  return [];
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
    const key = (r.key ?? r.Model ?? r.model ?? "").toLowerCase();
    if (!key) continue;
    const data: Partial<IntelligenceData> = {
      arenaElo: r["Arena Elo"] ?? r.elo_rating ?? r.rating ?? null,
      arenaRank: r.Rank ?? r.rank ?? null,
    };
    set(key, data);
    set(slugify(key), data);
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
