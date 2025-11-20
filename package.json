import { put } from "@vercel/blob";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const catalog = req.body; // full content array from CMS
    const version = Date.now();

    // 1) publish versioned catalog
    const catalogBlob = await put(
      `catalog-${version}.json`,
      JSON.stringify(catalog, null, 2),
      { access: "public", contentType: "application/json" }
    );

    // 2) stable manifest that always points to latest
    const manifest = {
      latestCatalogUrl: catalogBlob.url,
      version
    };

    const manifestBlob = await put(
      "manifest.json",
      JSON.stringify(manifest, null, 2),
      { access: "public", contentType: "application/json" }
    );

    return res.status(200).json({
      manifestUrl: manifestBlob.url,
      catalogUrl: catalogBlob.url,
      version
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

