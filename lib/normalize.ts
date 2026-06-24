import { OpenRouterModel, NormalizedModel } from "./types";
import { detectFamily } from "./families";

export function toNumberOrNull(v: string | number | null | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeModel(m: OpenRouterModel): NormalizedModel {
  const inTokUSD = toNumberOrNull(m.pricing?.prompt ?? null);
  const outTokUSD = toNumberOrNull(m.pricing?.completion ?? null);
  const inPerM = inTokUSD != null ? inTokUSD * 1e6 : null;
  const outPerM = outTokUSD != null ? outTokUSD * 1e6 : null;
  const context = m.top_provider?.context_length ?? m.context_length ?? null;
  const inputs = m.architecture?.input_modalities ?? [];
  const outputs = m.architecture?.output_modalities ?? [];
  const modality = m.architecture?.modality ?? undefined;

  const supported = m.supported_parameters ?? [];
  const hasParam = (key: string) => supported?.includes(key) ?? false;

  const flags = {
    reasoning: hasParam("include_reasoning") || hasParam("reasoning"),
    tools: hasParam("tools") || hasParam("tool_choice"),
    structured: hasParam("structured_outputs") || hasParam("response_format"),
    vision: (inputs ?? []).includes("image"),
    audio: (inputs ?? []).includes("audio"),
    file: (inputs ?? []).includes("file"),
    moderated: m.top_provider?.is_moderated === true,
  } as const;

  const fam = detectFamily(m.id);

  return {
    id: m.id,
    family: fam.key,
    familyLabel: fam.label,
    name: m.name,
    description: m.description ?? undefined,
    context: context ?? null,
    inTokUSD,
    outTokUSD,
    inPerM,
    outPerM,
    modality,
    inputs: inputs ?? [],
    outputs: outputs ?? [],
    flags,
    knowledgeCutoff: m.knowledge_cutoff ?? null,
    raw: m,
  };
}

export function formatUSD(n: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const decimals = opts.decimals ?? (n < 0.01 ? 5 : 3);
  return `$${n.toFixed(decimals)}`;
}

export function formatPerM(n: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const decimals = opts.decimals ?? 2;
  return `$${n.toFixed(decimals)}`;
}

export function formatContext(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}
