// /api/publish.js
const { put } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("Method not allowed");
    }

    // Read JSON body
    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body || "{}");

    if (!payload || !payload.titles) {
      res.statusCode = 400;
      return res.end("Missing titles in payload");
    }

    const ts = Date.now();

    // 1) Upload catalog
    const catalogKey = `catalog-${ts}.json`;
    const catalogBlob = await put(
      catalogKey,
      JSON.stringify(payload, null, 2),
      {
        access: "public",
        contentType: "application/json"
      }
    );

    // 2) Upload manifest pointing to latest catalog
    const manifest = {
      version: payload.version || 1,
      publishedAt: new Date().toISOString(),
      latestCatalogUrl: catalogBlob.url
    };

    const manifestKey = `manifest-${ts}.json`;
    const manifestBlob = await put(
      manifestKey,
      JSON.stringify(manifest, null, 2),
      {
        access: "public",
        contentType: "application/json"
      }
    );

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        manifestUrl: manifestBlob.url,
        catalogUrl: catalogBlob.url
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.end(String(err?.message || err));
  }
};
