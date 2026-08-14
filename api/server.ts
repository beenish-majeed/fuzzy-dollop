export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  try {
    // @ts-expect-error dist is generated at build time by vite build
    const mod = await import("../dist/server/server.js");
    const server = mod.default || mod;
    return await server.fetch(request, {}, {});
  } catch (error) {
    console.error("Vercel Edge Function SSR Error:", error);
    return new Response(
      `<!DOCTYPE html><html><head><title>Server Error</title></head><body><h1>Server Error</h1><p>${error instanceof Error ? error.message : "An unexpected error occurred."}</p></body></html>`,
      {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    );
  }
}
