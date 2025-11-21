// api/upload.js
import { put } from "@vercel/blob";

// IMPORTANT: Node runtime (not edge)
export const config = { runtime: "nodejs20.x" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Support either unprefixed or STORAGE_ prefixed env var
  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.STORAGE_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    return new Response(
      "Missing BLOB_READ_WRITE_TOKEN env var in this project",
      { status: 500 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const keyPrefix = form.get("keyPrefix") || "watchvim";

  if (!file) {
    return new Response("Missing file", { status: 400 });
  }

  const pathname = `${keyPrefix}/${file.name}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
    token, // <-- passes token explicitly
  });

  return Response.json({ url: blob.url });
}
