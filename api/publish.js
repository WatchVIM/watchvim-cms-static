import { put } from "@vercel/blob";

export const config = {
  runtime: "nodejs",
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  try {
    // Basic CORS (safe even if same-origin)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) {
      res.status(400).send("Missing JSON body");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      res.status(400).send("Invalid JSON");
      return;
    }

    const stableManifestKey = (payload.stableManifestKey || "manifest.json").replace(/^\/+/, "");
    const stableCatalogKey  = (payload.stableCatalogKey  || "catalog.json").replace(/^\/+/, "");
    const versionTag        = payload.version || Date.now();

    const catalog = {
      version: versionTag,
      publishedAt: payload.publishedAt || new Date().toISOString(),
      titles: payload.titles || [],
      loopChannel: payload.loopChannel || null,
      paymentPublic: payload.paymentPublic || null,
    };

    // Versioned catalog (new URL each publish)
    const versionedCatalogKey = `catalog-${versionTag}.json`;
    const catalogBlob = await put(versionedCatalogKey, JSON.stringify(catalog), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: true,
    });

    // Stable catalog (same URL every publish) — must overwrite
    const stableCatalogBlob = await put(stableCatalogKey, JSON.stringify(catalog), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true, // IMPORTANT for stable URLs
    });

    const manifest = {
      version: catalog.version,
      publishedAt: catalog.publishedAt,
      latestCatalogUrl: stableCatalogBlob.url,
      catalogUrl: catalogBlob.url,
    };

    // Versioned manifest
    const versionedManifestKey = `manifest-${versionTag}.json`;
    const manifestBlob = await put(versionedManifestKey, JSON.stringify(manifest), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: true,
    });

    // Stable manifest — must overwrite
    const stableManifestBlob = await put(stableManifestKey, JSON.stringify(manifest), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    res.status(200).json({
      stableManifestUrl: stableManifestBlob.url,
      stableCatalogUrl: stableCatalogBlob.url,
      manifestUrl: manifestBlob.url,
      catalogUrl: catalogBlob.url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err?.message || "Publish failed");
  }
}
