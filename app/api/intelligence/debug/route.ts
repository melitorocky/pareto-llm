import { revalidateTag } from "next/cache";

export async function GET() {
  const hasKey = !!process.env.ARTIFICIAL_ANALYSIS_API_KEY;
  const keyPrefix = hasKey
    ? process.env.ARTIFICIAL_ANALYSIS_API_KEY!.slice(0, 8) + "…"
    : null;

  // Fetch AA API directly (no cache)
  let aaStatus = 0;
  let aaFirstModel: unknown = null;
  let aaError: string | null = null;
  let aaCount = 0;

  try {
    const headers: HeadersInit = { accept: "application/json" };
    if (hasKey) headers["authorization"] = `Bearer ${process.env.ARTIFICIAL_ANALYSIS_API_KEY}`;
    const res = await fetch("https://artificialanalysis.ai/api/v2/language/models", {
      headers,
      cache: "no-store",
    });
    aaStatus = res.status;
    const body = await res.json();
    const arr = Array.isArray(body) ? body : (body.models ?? body.data ?? body);
    if (Array.isArray(arr)) {
      aaCount = arr.length;
      aaFirstModel = arr[0] ?? null; // exposes all field names
    } else {
      aaFirstModel = body; // show whatever came back
    }
  } catch (e) {
    aaError = String(e);
  }

  // Invalidate the 24h cache so the next /api/intelligence call rebuilds with the current key
  revalidateTag("intelligence", { expire: 0 });

  return Response.json({
    hasKey,
    keyPrefix,
    aaStatus,
    aaCount,
    aaFirstModel,
    aaError,
    note: "Cache invalidated — open /api/intelligence now to rebuild with fresh data.",
  });
}
