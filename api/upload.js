import { put } from "@vercel/blob";
import formidable from "formidable";
import fs from "fs/promises";

export const config = {
  runtime: "nodejs",
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  try {
    // Basic CORS
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

    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      try {
        if (err) throw err;

        // formidable can return arrays in some versions
        const fileObj = Array.isArray(files.file) ? files.file[0] : files.file;
        const keyPrefix = (fields.keyPrefix || "watchvim").toString().replace(/^\/+/, "");

        if (!fileObj) {
          res.status(400).send("Missing file");
          return;
        }

        // Optional server-side size guard (index.html already checks)
        const maxBytes = 4.2 * 1024 * 1024;
        if (fileObj.size && fileObj.size > maxBytes) {
          res.status(413).send("File too large (limit ~4MB)");
          return;
        }

        const data = await fs.readFile(fileObj.filepath);
        const safeName = (fileObj.originalFilename || "upload").replace(/[^\w.\-]+/g, "_");
        const pathname = `${keyPrefix}/${safeName}`;

        const blob = await put(pathname, data, {
          access: "public",
          addRandomSuffix: true,
          contentType: fileObj.mimetype || "application/octet-stream",
        });

        res.status(200).json({ url: blob.url });
      } catch (innerErr) {
        console.error(innerErr);
        res.status(500).send(innerErr?.message || "Upload failed");
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err?.message || "Upload failed");
  }
}
