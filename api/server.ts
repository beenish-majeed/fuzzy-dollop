import type { IncomingMessage, ServerResponse } from "node:http";

interface AppServer {
  fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response>;
}

async function getAppServer(): Promise<AppServer> {
  // @ts-ignore dist is generated at build time by vite build
  const mod = (await import("../dist/server/server.js")) as { default?: AppServer } & AppServer;
  return mod.default ?? mod;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const server = await getAppServer();
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const url = `${proto}://${host}${req.url ?? "/"}`;

    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val !== undefined) {
        if (Array.isArray(val)) {
          val.forEach((v: string) => headers.append(key, v));
        } else {
          headers.set(key, String(val));
        }
      }
    }

    let body: BodyInit | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : (chunk as Uint8Array));
      }
      if (chunks.length > 0) {
        body = Buffer.concat(chunks);
      }
    }

    const init: RequestInit = {
      method: req.method || "GET",
      headers,
    };
    if (body !== null) {
      init.body = body;
    }

    const webReq = new Request(url, init);
    const webRes = await server.fetch(webReq, {}, {});

    res.statusCode = webRes.status;
    webRes.headers.forEach((val: string, key: string) => {
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
