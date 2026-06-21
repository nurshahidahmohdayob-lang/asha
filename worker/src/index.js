// Zera worksheet host — a tiny Cloudflare Worker that stores worksheet HTML in
// KV and serves it at a short public URL, so students on any device can open it.
//
//   POST /upload   body: { html, code? }  -> { code, url }   (publish)
//   GET  /s/<code>                        -> the worksheet HTML (view)
//
// Deploy: see worker/README.md.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Short, URL-safe random code (a–z, 0–9).
function randomCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36)).join("").replace(/[^a-z0-9]/g, "").slice(0, 5);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // Generate an image with Workers AI (Flux) — no token needed, the AI
    // binding handles auth. Returns { image: "data:image/jpeg;base64,..." }.
    if (request.method === "POST" && url.pathname === "/image") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body." }, 400);
      }
      const prompt = String(body?.prompt || "").slice(0, 2000);
      if (!prompt) return json({ error: "No prompt." }, 400);
      try {
        const out = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt });
        const b64 = out?.image;
        if (!b64) return json({ error: "No image returned." }, 502);
        return json({ image: `data:image/jpeg;base64,${b64}` });
      } catch (e) {
        return json({ error: `AI error: ${String(e?.message || e).slice(0, 160)}` }, 502);
      }
    }

    // Publish a worksheet.
    if (request.method === "POST" && url.pathname === "/upload") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body." }, 400);
      }
      const html = String(body?.html || "");
      if (!html || html.length < 20) {
        return json({ error: "No HTML to publish." }, 400);
      }
      // Optional custom code (a memorable word), else a random one.
      let code = String(body?.code || "")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 24);
      if (!code) code = randomCode();
      // Keep worksheets for 120 days.
      await env.WORKSHEETS.put(code, html, { expirationTtl: 60 * 60 * 24 * 120 });
      // Root-level link is shortest (e.g. w.zera.edu.my/cat).
      return json({ code, url: `${url.origin}/${code}` });
    }

    // View a worksheet — accept both /<code> (shortest) and /s/<code>.
    const m = url.pathname.match(/^\/(?:s\/)?([a-z0-9-]{1,24})\/?$/i);
    if (request.method === "GET" && m && m[1] !== "upload" && m[1] !== "favicon.ico") {
      const html = await env.WORKSHEETS.get(m[1]);
      if (!html) {
        return new Response(
          "<!doctype html><meta charset=utf-8><body style='font-family:sans-serif;text-align:center;padding:60px'><h2>Worksheet not found</h2><p>This link may have expired or the code is wrong.</p>",
          { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(
      "Zera worksheet host. POST /upload to publish a worksheet; open /s/<code> to view it.",
      { headers: { "Content-Type": "text/plain" } },
    );
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
