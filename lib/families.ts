import { NormalizedModel } from "./types";

export function detectFamily(id: string): { key: string; label: string } {
  // Some OpenRouter alias IDs are prefixed with "~" (e.g. "~anthropic/claude-opus-latest");
  // strip it so they fold into the normal family instead of a separate "~anthropic" bucket.
  const clean = id.replace(/^~/, "");
  const lower = clean.toLowerCase();
  if (lower.startsWith("openai/")) return { key: "openai", label: "OpenAI" };
  if (lower.startsWith("anthropic/")) return { key: "anthropic", label: "Anthropic" };
  if (lower.startsWith("xai/") || lower.includes("/grok")) return { key: "grok", label: "Grok" };
  if (lower.startsWith("google/")) return { key: "google", label: "Google" };
  if (lower.startsWith("meta/")) return { key: "meta", label: "Meta" };
  if (lower.startsWith("mistral/")) return { key: "mistral", label: "Mistral" };
  if (lower.startsWith("qwen/")) return { key: "qwen", label: "Qwen" };
  if (lower.startsWith("deepseek/")) return { key: "deepseek", label: "DeepSeek" };
  return { key: lower.split("/")[0] || "other", label: (clean.split("/")[0] || "Altro") };
}

export const HIGHLIGHT_FAMILIES = new Set(["openai", "anthropic", "grok", "google"]);

export function familyColor(key: string): string {
  switch (key) {
    case "openai":
      return "#10b981"; // emerald
    case "anthropic":
      return "#ef4444"; // red (Anthropic)
    case "grok":
      return "#f59e0b"; // amber
    case "google":
      return "#3b82f6";
    case "meta":
      return "#06b6d4";
    case "mistral":
      return "#ef4444";
    case "qwen":
      return "#84cc16";
    case "deepseek":
      return "#a855f7";
    default:
      return "#9ca3af"; // gray
  }
}

export function isHighlightedFamily(model: NormalizedModel): boolean {
  return HIGHLIGHT_FAMILIES.has(model.family);
}
