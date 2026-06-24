export type OpenRouterModel = {
  id: string;
  canonical_slug?: string | null;
  name: string;
  description?: string | null;
  context_length?: number | null;
  architecture?: {
    modality?: string | null;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
    tokenizer?: string | null;
  } | null;
  pricing?: {
    prompt?: string | null; // USD / token
    completion?: string | null; // USD / token
    web_search?: string | null;
    input_cache_read?: string | null;
    input_cache_write?: string | null;
  } | null;
  top_provider?: {
    context_length?: number | null;
    max_completion_tokens?: number | null;
    is_moderated?: boolean | null;
  } | null;
  supported_parameters?: string[] | null;
  default_parameters?: Record<string, unknown> | null;
  knowledge_cutoff?: string | null;
  links?: { details?: string | null } | null;
};

export type OpenRouterModelsResponse = {
  data: OpenRouterModel[];
};

export type NormalizedModel = {
  id: string;
  family: string; // e.g., openai, anthropic, xai, etc.
  familyLabel: string; // Human-readable label
  name: string;
  description?: string;
  context: number | null; // tokens
  inTokUSD: number | null; // USD/token
  outTokUSD: number | null; // USD/token
  inPerM: number | null; // USD per 1M tokens
  outPerM: number | null; // USD per 1M tokens
  modality?: string;
  inputs: string[];
  outputs: string[];
  flags: {
    reasoning: boolean;
    tools: boolean;
    structured: boolean;
    vision: boolean;
    audio: boolean;
    file: boolean;
    moderated: boolean;
  };
  knowledgeCutoff?: string | null;
  raw: OpenRouterModel; // keep full reference for details panel
};
