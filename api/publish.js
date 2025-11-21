// api/publish.js
import { put } from "@vercel/blob";

export const config = { runtime: "nodejs20.x" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.STORAGE_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    return new Response("Missing BLOB_READ_WRITE_TOKEN env var", { status: 500 });
  }

  let payload = {};
  try {
    payload = await req.json();
  } catch {}

  if (!payload?.titles) {
    return new Response("Missing titles in payload", { status: 400 });
  }

  const ts = Date.now();

  // 1) Versioned catalog
  const catalogKey = `catalog-${ts}.json`;
  const catalogBlob = await put(
    catalogKey,
    JSON.stringify(payload, null, 2),
    {
      access: "public",
      contentType: "application/json",
      token,
    }
  );

  // 2) Versioned manifest
  const manifest = {
    version: payload.version || 1,
    publishedAt: new Date().toISOString(),
    latestCatalogUrl: catalogBlob.url,
  };

  const manifestKey = `manifest-${ts}.json`;
  const manifestBlob = await put(
    manifestKey,
    JSON.stringify(manifest, null, 2),
    {
      access: "public",
      contentType: "application/json",
      token,
    }
  );

  // 3) Stable overwrites
  const stableCatalogKey = payload.stableCatalogKey || "catalog.json";
  const stableManifestKey = payload.stableManifestKey || "manifest.json";

  const stableCatalogBlob = await put(
    stableCatalogKey,
    JSON.stringify(payload, null, 2),
    {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      token,
    }
  );

  const stableManifestBlob = await put(
    stableManifestKey,
    JSON.stringify(manifest, null, 2),
    {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      token,
    }
  );

  return Response.json({
    stableManifestUrl: stableManifestBlob.url,
    stableCatalogUrl: stableCatalogBlob.url,
    manifestUrl: manifestBlob.url,
    catalogUrl: catalogBlob.url,
  });
}
