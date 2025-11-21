import { put } from "@vercel/blob";

export const config = { runtime: "edge" };

const MANIFEST_KEY = "manifest-watchvim.json";

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.json();

  // 1) upload catalog
  const catalogKey = `catalog-${Date.now()}.json`;
  const catalogBlob = await put(
    catalogKey,
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
    { access: "public", addRandomSuffix: false }
  );

  // 2) update manifest pointing to latest catalog
  const manifest = {
    latestCatalogUrl: catalogBlob.url,
    version: payload.version,
    publishedAt: payload.publishedAt
  };

  const manifestBlob = await put(
    MANIFEST_KEY,
    new Blob([JSON.stringify(manifest)], { type: "application/json" }),
    { access: "public", addRandomSuffix: false }
  );

  return Response.json({
    catalogUrl: catalogBlob.url,
    manifestUrl: manifestBlob.url
  });
}
