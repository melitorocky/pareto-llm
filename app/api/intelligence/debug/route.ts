import { revalidateTag } from "next/cache";

async function probe(url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", ...headers },
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: String(e) };
  }
}

export async function GET() {
  const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY ?? "";
  if (!apiKey) return Response.json({ hasKey: false });

  const h = { "x-api-key": apiKey };
  const baseUrl = "https://artificialanalysis.ai/api";

  // Try different endpoint paths with x-api-key (the format that gave 403, not 401)
  const [v2lang, v2models, v1lang, v1models, root] = await Promise.all([
    probe(`${baseUrl}/v2/language/models`, h),
    probe(`${baseUrl}/v2/models`, h),
    probe(`${baseUrl}/v1/language/models`, h),
    probe(`${baseUrl}/v1/models`, h),
    probe(`${baseUrl}/models`, h),
  ]);

  revalidateTag("intelligence", { expire: 0 });

  return Response.json({
    keyPrefix: apiKey.slice(0, 8) + "…",
    endpoints: {
      "/api/v2/language/models": { status: v2lang.status, body: v2lang.body },
      "/api/v2/models":          { status: v2models.status, body: v2models.body },
      "/api/v1/language/models": { status: v1lang.status, body: v1lang.body },
      "/api/v1/models":          { status: v1models.status, body: v1models.body },
      "/api/models":             { status: root.status, body: root.body },
    },
  });
}
