import { put } from "@vercel/blob";

export const config = { runtime: "nodejs" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.json();

  const stableManifestKey = payload.stableManifestKey || "manifest.json";
  const stableCatalogKey = payload.stableCatalogKey || "catalog.json";
  const versionTag = payload.version || Date.now();

  const catalog = {
    version: payload.version,
    publishedAt: payload.publishedAt,
    titles: payload.titles,
    loopChannel: payload.loopChannel,
    paymentPublic: payload.paymentPublic
  };

  const versionedCatalogKey = `catalog-${versionTag}.json`;
  const catalogBlob = await put(versionedCatalogKey, JSON.stringify(catalog), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true
  });

  const stableCatalogBlob = await put(stableCatalogKey, JSON.stringify(catalog), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false
  });

  const manifest = {
    version: catalog.version,
    publishedAt: catalog.publishedAt,
    latestCatalogUrl: stableCatalogBlob.url,
    catalogUrl: catalogBlob.url
  };

  const versionedManifestKey = `manifest-${versionTag}.json`;
  const manifestBlob = await put(versionedManifestKey, JSON.stringify(manifest), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true
  });

  const stableManifestBlob = await put(stableManifestKey, JSON.stringify(manifest), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false
  });

  return Response.json({
    stableManifestUrl: stableManifestBlob.url,
    stableCatalogUrl: stableCatalogBlob.url,
    manifestUrl: manifestBlob.url,
    catalogUrl: catalogBlob.url
  });
}
