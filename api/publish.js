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

    // ------------------------------------------------------------
    // LOCK STABLE KEYS to match your current stable URLs exactly.
    // Do NOT allow the client to override these with full URLs.
    // ------------------------------------------------------------
    const stableManifestKey = "manifest.json";
    const stableCatalogKey = "catalog.json";

    // If someone accidentally sends full URLs as keys, ignore them.
    // (This prevents "pathname cannot contain '//'" errors.)
    const maybeBadKey =
      payload.stableManifestKey?.includes("://") ||
      payload.stableCatalogKey?.includes("://");
    if (maybeBadKey) {
      console.warn(
        "publish payload attempted to override stable keys with URLs; ignoring."
      );
    }

    // Sanitize version so it’s a safe filename
    const rawVersion = payload.version ?? Date.now();
    const versionTag = String(rawVersion).replace(/[^a-zA-Z0-9._-]/g, "_");

    const catalog = {
      version: versionTag,
      publishedAt: payload.publishedAt || new Date().toISOString(),
      titles: payload.titles || [],
      loopChannel: payload.loopChannel || null,
      paymentPublic: payload.paymentPublic || null,
    };

    // Versioned catalog (new URL each publish)
    const versionedCatalogKey = `catalog-${versionTag}.json`;
    const catalogBlob = await put(
      versionedCatalogKey,
      JSON.stringify(catalog),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: true,
      }
    );

    // Stable catalog (same URL every publish) — must overwrite
    const stableCatalogBlob = await put(
      stableCatalogKey,
      JSON.stringify(catalog),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    );

    const manifest = {
      version: catalog.version,
      publishedAt: catalog.publishedAt,

      // Frontend reads latestCatalogUrl first:
      latestCatalogUrl: stableCatalogBlob.url,

      // Keep versioned URL too for rollback/debug:
      catalogUrl: catalogBlob.url,

      // Helpful introspection (optional but nice):
      stableCatalogUrl: stableCatalogBlob.url,
    };

    // Versioned manifest
    const versionedManifestKey = `manifest-${versionTag}.json`;
    const manifestBlob = await put(
      versionedManifestKey,
      JSON.stringify(manifest),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: true,
      }
    );

    // Stable manifest — must overwrite
    const stableManifestBlob = await put(
      stableManifestKey,
      JSON.stringify(manifest),
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    );

    res.status(200).json({
      stableManifestUrl: stableManifestBlob.url,
      stableCatalogUrl: stableCatalogBlob.url,
      manifestUrl: manifestBlob.url,
      catalogUrl: catalogBlob.url,
      version: versionTag,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err?.message || "Publish failed");
  }
}
