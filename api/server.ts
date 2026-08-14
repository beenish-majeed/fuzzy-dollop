import type { IncomingMessage, ServerResponse } from "node:http";

async function getAppServer() {
  // @ts-expect-error dist is generated at build time by vite build
  const mod = await import("../dist/server/server.js");
  return mod.default || mod;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const server = await getAppServer();
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const url = `${proto}://${host}${req.url || "/"}`;

    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val !== undefined) {
        if (Array.isArray(val)) {
          val.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, val);
        }
      }
    }

    let body: Uint8Array | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
      }
      if (chunks.length > 0) {
        body = Buffer.concat(chunks);
      }
    }

    const webReq = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    const webRes = await server.fetch(webReq, {}, {});

    res.statusCode = webRes.status;
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });

    const arrayBuffer = await webRes.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Vercel Serverless Function Error:", err);
    res.statusCode = 500;
    res.end(err instanceof Error ? err.message : "Internal Server Error");
  }
}
