// api/upload.js  (Node.js runtime, ESM)
// Parses multipart/form-data with Busboy, then uploads to Vercel Blob.

import busboy from "busboy";
import { put } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    res.statusCode = 400;
    return res.end("Expected multipart/form-data");
  }

  let fileBuffer = null;
  let fileName = "";
  let mimeType = "";
  let keyPrefix = "watchvim";

  const bb = busboy({
    headers: req.headers,
    limits: { fileSize: 4.2 * 1024 * 1024 } // 4.2MB
  });

  bb.on("field", (name, val) => {
    if (name === "keyPrefix" && val) keyPrefix = val;
  });

  bb.on("file", (_name, file, info) => {
    fileName = info.filename || "upload.bin";
    mimeType = info.mimeType || "application/octet-stream";

    const chunks = [];
    file.on("data", (d) => chunks.push(d));
    file.on("end", () => {
      fileBuffer = Buffer.concat(chunks);
    });

    file.on("limit", () => {
      res.statusCode = 413;
      res.end("File too large (limit 4.2MB)");
      file.resume();
    });
  });

  try {
    await new Promise((resolve, reject) => {
      bb.on("finish", resolve);
      bb.on("error", reject);
      req.pipe(bb);
    });

    if (!fileBuffer || !fileName) {
      res.statusCode = 400;
      return res.end("Missing file");
    }

    const pathname = `${keyPrefix}/${fileName}`;

    const blob = await put(pathname, fileBuffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: true
    });

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify({ url: blob.url }));
  } catch (err) {
    res.statusCode = 500;
    res.end(String(err?.message || err));
  }
}
