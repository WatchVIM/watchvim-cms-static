import { put } from "@vercel/blob";

export const config = { runtime: "nodejs" }; // <-- IMPORTANT

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const keyPrefix = form.get("keyPrefix") || "watchvim";

  if (!file || typeof file === "string") {
    return new Response("Missing file", { status: 400 });
  }

  const pathname = `${keyPrefix}/${file.name}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true
    // token not needed here IF env var is set
  });

  return Response.json({ url: blob.url });
}
