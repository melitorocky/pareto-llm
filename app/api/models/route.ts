import { NextRequest } from "next/server";

// Simple proxy to OpenRouter public models API.
// Allows client-side fetch without CORS issues and centralizes caching.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const noCache = url.searchParams.get("noCache") === "1";

  const res = await fetch("https://openrouter.ai/api/v1/models", {
    // If noCache, bypass caching entirely; else allow short revalidation window.
    cache: noCache ? "no-store" : "force-cache",
    next: noCache ? undefined : { revalidate: 60 * 60 * 24 }, // 24h
    headers: { "accept": "application/json" },
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Upstream error", status: res.status }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
