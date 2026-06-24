import { revalidateTag } from "next/cache";

// Utility endpoint: invalidates the 24h intelligence cache and reports AA API status.
// Useful after changing ARTIFICIAL_ANALYSIS_API_KEY in Vercel env vars.
export async function GET() {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY ?? "";
  const hasKey = !!apiKey;

  let aaStatus = 0;
  let aaBody: unknown = null;
  if (hasKey) {
    try {
      const res = await fetch("https://artificialanalysis.ai/api/v2/language/models", {
        headers: { accept: "application/json", "x-api-key": apiKey },
        cache: "no-store",
      });
      aaStatus = res.status;
      aaBody = await res.json().catch(() => null);
    } catch (e) {
      aaBody = String(e);
    }
  }

  revalidateTag("intelligence", { expire: 0 });

  const isPro = aaStatus === 200;
  return Response.json({
    hasKey,
    keyPrefix: hasKey ? apiKey.slice(0, 8) + "…" : null,
    aaStatus,
    aaBody: isPro ? "(ok — models loaded)" : aaBody,
    status: isPro
      ? "AA Pro active — cache invalidated, reload /api/intelligence to rebuild."
      : !hasKey
      ? "No API key set. Arena ELO still works without a key."
      : "AA requires a Pro subscription. Arena ELO still works without it.",
  });
}
