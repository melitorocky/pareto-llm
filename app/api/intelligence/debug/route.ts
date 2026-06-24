import { revalidateTag } from "next/cache";

async function tryAuth(apiKey: string, headers: Record<string, string>) {
  const res = await fetch("https://artificialanalysis.ai/api/v2/language/models", {
    headers: { accept: "application/json", ...headers },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export async function GET() {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY ?? "";
  const hasKey = !!apiKey;

  if (!hasKey) {
    return Response.json({ hasKey: false, note: "ARTIFICIAL_ANALYSIS_API_KEY not set." });
  }

  // Try all known auth formats in parallel
  const [bearer, xApiKey, plain] = await Promise.all([
    tryAuth(apiKey, { authorization: `Bearer ${apiKey}` }),
    tryAuth(apiKey, { "x-api-key": apiKey }),
    tryAuth(apiKey, { authorization: apiKey }),
  ]);

  const working = bearer.status === 200 ? "Bearer"
    : xApiKey.status === 200 ? "x-api-key"
    : plain.status === 200 ? "plain Authorization"
    : null;

  // If one worked, grab the first model's fields
  const successBody = bearer.status === 200 ? bearer.body
    : xApiKey.status === 200 ? xApiKey.body
    : plain.status === 200 ? plain.body
    : null;
  const arr = successBody && (Array.isArray(successBody) ? successBody : (successBody.models ?? successBody.data ?? []));
  const firstModel = Array.isArray(arr) ? arr[0] ?? null : null;

  revalidateTag("intelligence", { expire: 0 });

  return Response.json({
    hasKey,
    keyPrefix: apiKey.slice(0, 8) + "…",
    working,
    results: {
      "Bearer": { status: bearer.status },
      "x-api-key": { status: xApiKey.status },
      "plain": { status: plain.status },
    },
    firstModel,
    note: working
      ? `Use "${working}" header format. Cache invalidated.`
      : "No format worked — check if the key is valid on artificialanalysis.ai.",
  });
}
