import { put } from "@vercel/blob";
import formidable from "formidable";
import fs from "fs";

export const config = {
  runtime: "nodejs",
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      try {
        if (err) throw err;

        const file = files.file;
        const keyPrefix = (fields.keyPrefix || "watchvim").toString();

        if (!file) {
          res.status(400).send("Missing file");
          return;
        }

        const data = fs.readFileSync(file.filepath);
        const pathname = `${keyPrefix}/${file.originalFilename}`;

        const blob = await put(pathname, data, {
          access: "public",
          addRandomSuffix: true,
          contentType: file.mimetype || "application/octet-stream"
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
