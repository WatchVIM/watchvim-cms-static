import { put } from "@vercel/blob";

export const config = {
  api: { bodyParser: false } // IMPORTANT for binary/video uploads
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { filename } = req.query;
    if (!filename) {
      return res.status(400).json({ error: "Missing filename" });
    }

    const contentType =
      req.headers["content-type"] || "application/octet-stream";

    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true
    });

    return res.status(200).json({ url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

