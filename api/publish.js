import { put } from "@vercel/blob";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    const stableManifestKey = payload.stableManifestKey || "manifest.json";
    const stableCatalogKey  = payload.stableCatalogKey  || "catalog.json";
    const versionTag        = payload.version || Date.now();

    const catalog = {
      version: versionTag,
      publishedAt: payload.publishedAt || new Date().toISOString(),
      titles: payload.titles || [],
      loopChannel: payload.loopChannel || null,
      paymentPublic: payload.paymentPublic || null
    };

    // Versioned catalog
    const versionedCatalogKey = `catalog-${versionTag}.json`;
    const catalogBlob = await put(versionedCatalogKey, JSON.stringify(catalog), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: true
    });

    // Stable catalog (same URL every publish)
    const stableCatalogBlob = await put(stableCatalogKey, JSON.stringify(catalog), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false
    });

    // Manifest points to latest stable catalog
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

    res.status(200).json({
      stableManifestUrl: stableManifestBlob.url,
      stableCatalogUrl: stableCatalogBlob.url,
      manifestUrl: manifestBlob.url,
      catalogUrl: catalogBlob.url
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err?.message || "Publish failed");
  }
}
