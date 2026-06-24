import { revalidateTag } from "next/cache";

// Utility: shows AA API status and invalidates the 24h intelligence cache.
// Call this after changing ARTIFICIAL_ANALYSIS_API_KEY in Vercel env vars.
export async function GET() {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY ?? "";
  if (!apiKey) {
    return Response.json({ hasKey: false, note: "ARTIFICIAL_ANALYSIS_API_KEY not set." });
  }

  let status = 0;
  let firstModel: unknown = null;
  let totalModels = 0;
  let rateLimit: Record<string, string> = {};

  try {
    const res = await fetch("https://artificialanalysis.ai/api/v2/language/models/free?page=1", {
      headers: { accept: "application/json", "x-api-key": apiKey },
      cache: "no-store",
    });
    status = res.status;
    rateLimit = {
      limit: res.headers.get("X-RateLimit-Limit") ?? "?",
      remaining: res.headers.get("X-RateLimit-Remaining") ?? "?",
      reset: res.headers.get("X-RateLimit-Reset") ?? "?",
    };
    if (res.ok) {
      const body = await res.json();
      totalModels = (body.pagination?.total_pages ?? 0) * (body.pagination?.page_size ?? 0);
      firstModel = body.data?.[0] ?? null;
    } else {
      firstModel = await res.json().catch(() => null);
    }
  } catch (e) {
    firstModel = String(e);
  }

  revalidateTag("intelligence", { expire: 0 });

  return Response.json({
    keyPrefix: apiKey.slice(0, 8) + "…",
    status,
    rateLimit,
    totalModels,
    firstModel,
    note: status === 200
      ? "OK — cache invalidated. Open /api/intelligence to rebuild."
      : "Check status and firstModel for error details.",
  });
}
