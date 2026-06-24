import { NormalizedModel } from "./types";

type FeatureScores = {
  priceIn: number | null;
  priceOut: number | null;
  context: number | null;
  reasoning: number;
  tools: number;
  structured: number;
};

// Compute robust normalized scales based on dataset percentiles (approx via min/max clamp)
export function computeFeatureScores(models: NormalizedModel[]): Record<string, FeatureScores> {
  const validIn = models.map(m => m.inPerM).filter((v): v is number => v != null && Number.isFinite(v));
  const validOut = models.map(m => m.outPerM).filter((v): v is number => v != null && Number.isFinite(v));
  const validCtx = models.map(m => m.context).filter((v): v is number => v != null && Number.isFinite(v));

  const pmin = (arr: number[]) => Math.min(...arr);
  const pmax = (arr: number[]) => Math.max(...arr);

  const minIn = validIn.length ? Math.max(1e-9, pmin(validIn)) : 1e-6;
  const maxIn = validIn.length ? pmax(validIn) : 1e2;
  const minOut = validOut.length ? Math.max(1e-9, pmin(validOut)) : 1e-6;
  const maxOut = validOut.length ? pmax(validOut) : 1e2;
  const minCtx = validCtx.length ? Math.max(1, pmin(validCtx)) : 1e3;
  const maxCtx = validCtx.length ? pmax(validCtx) : 1e6;

  const log = (x: number) => Math.log10(Math.max(x, 1e-12));
  const norm = (x: number, a: number, b: number) => {
    const lx = log(x), la = log(a), lb = log(b);
    if (lb - la === 0) return 0.5;
    let v = (lx - la) / (lb - la);
    return Math.min(1, Math.max(0, v));
  };

  const out: Record<string, FeatureScores> = {};
  for (const m of models) {
    const priceIn = m.inPerM != null ? 1 - norm(m.inPerM, minIn, maxIn) : null; // cheaper => higher score
    const priceOut = m.outPerM != null ? 1 - norm(m.outPerM, minOut, maxOut) : null;
    const context = m.context != null ? norm(m.context, minCtx, maxCtx) : null;
    out[m.id] = {
      priceIn,
      priceOut,
      context,
      reasoning: m.flags.reasoning ? 1 : 0,
      tools: m.flags.tools ? 1 : 0,
      structured: m.flags.structured ? 1 : 0,
    };
  }
  return out;
}

export type Task = "plan" | "build" | "code";

const BASE_WEIGHTS: Record<Task, Record<keyof FeatureScores, number>> = {
  plan:      { reasoning: 0.40, context: 0.25, priceIn: 0.20, priceOut: 0.05, structured: 0.05, tools: 0.05 },
  build:     { tools: 0.30, structured: 0.20, priceOut: 0.20, context: 0.20, reasoning: 0.10, priceIn: 0.00 },
  code:      { priceIn: 0.35, priceOut: 0.25, structured: 0.15, tools: 0.15, reasoning: 0.10, context: 0.00 },
};

// q in [0,1], 0 = cost focus, 1 = quality focus
export function modulateWeights(task: Task, q: number, alpha = 0.6): Record<keyof FeatureScores, number> {
  const base = { ...BASE_WEIGHTS[task] } as Record<keyof FeatureScores, number>;
  const costFactors: (keyof FeatureScores)[] = ["priceIn", "priceOut"];
  const qualityFactors: (keyof FeatureScores)[] = ["reasoning", "context", "tools", "structured"];
  for (const k of costFactors) base[k] = (base[k] ?? 0) * (1 + alpha * (1 - q));
  for (const k of qualityFactors) base[k] = (base[k] ?? 0) * (1 + alpha * q);
  const sum = (Object.values(base) as number[]).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(base) as (keyof FeatureScores)[]) base[k] = base[k] / sum;
  return base;
}

export function scoreModels(models: NormalizedModel[], task: Task, q: number) {
  const features = computeFeatureScores(models);
  const weights = modulateWeights(task, q);
  return models.map(m => {
    const f = features[m.id];
    // Skip missing features by redistributing weights
    const availableEntries = (Object.entries(f) as [keyof FeatureScores, number | null][]) 
      .filter(([, v]) => v != null) as [keyof FeatureScores, number][];
    const sumW = availableEntries.reduce((acc, [k]) => acc + (weights[k] ?? 0), 0) || 1;
    let s = 0;
    for (const [k, v] of availableEntries) {
      s += (weights[k] ?? 0) * v / sumW; 
    }
    // Small bump for obviously lightweight variants in code edits
    if (task === "code" && /\b(fast|mini|lite)\b/i.test(m.name)) s = Math.min(1, s + 0.03);
    return { model: m, score: s };
  }).sort((a, b) => b.score - a.score);
}
