// /api/publish.js  (Node.js)
const { put } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method not allowed");
    }

    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body || "{}");

    if (!payload || !payload.titles) {
      res.statusCode = 400;
      return res.end("Missing titles in payload");
    }

    const ts = Date.now();
    const stableCatalogKey = payload.stableCatalogKey || "catalog.json";
    const stableManifestKey = payload.stableManifestKey || "manifest.json";

    // 1) Versioned catalog backup
    const catalogKey = `catalog-${ts}.json`;
    const catalogBlob = await put(catalogKey, JSON.stringify(payload, null, 2), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false
    });

    // 2) Stable catalog (overwrite)
    const stableCatalogBlob = await put(
      stableCatalogKey,
      JSON.stringify(payload, null, 2),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false
      }
    );

    // 3) Manifest object
    const manifest = {
      version: payload.version || 1,
      publishedAt: new Date().toISOString(),
      latestCatalogUrl: stableCatalogBlob.url
    };

    // 4) Versioned manifest backup
    const manifestKey = `manifest-${ts}.json`;
    const manifestBlob = await put(
      manifestKey,
      JSON.stringify(manifest, null, 2),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false
      }
    );

    // 5) Stable manifest (overwrite)
    const stableManifestBlob = await put(
      stableManifestKey,
      JSON.stringify(manifest, null, 2),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false
      }
    );

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        stableManifestUrl: stableManifestBlob.url,
        stableCatalogUrl: stableCatalogBlob.url,
        manifestUrl: manifestBlob.url,
        catalogUrl: catalogBlob.url
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.end(String(err?.message || err));
  }
};
