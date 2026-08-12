// Zera worksheet host — Cloudflare Pages Functions (advanced mode) version of
// the worker. Same behaviour, but served from <project>.pages.dev so the public
// link has no long account name:
//
//   POST /upload   body: { html, code? }      -> { code, url }   (publish)
//   GET  /<code>  or  /s/<code>               -> the worksheet HTML (view)
//   POST /file     multipart form field "file" -> { code, name, url } (upload)
//   GET  /f/<code>                            -> that file, with its own type
//
// Reuses the SAME KV namespace as the original worker, so links stay valid.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Short, URL-safe random code (a–z, 0–9).
function randomCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36)).join("").replace(/[^a-z0-9]/g, "").slice(0, 5);
}

// A longer code for uploaded files. These links are handed out rather than
// typed, so make guessing one impractical.
function randomFileCode() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
}

// Keep a filename safe to put in a header: no quotes, no line breaks.
function safeFilename(name) {
  return String(name || "file").replace(/[^\w .\-()\[\]]/g, "_").slice(0, 120) || "file";
}

// Files a teacher attaches to a lesson plan. 20 MB is comfortably inside the
// 25 MB KV value limit and far bigger than any real handout.
const MAX_FILE_BYTES = 20 * 1024 * 1024;

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

    // Upload a file a teacher picked from their device — a picture, PDF, Word
    // document, spreadsheet or slides. Stored as-is in KV and served back from
    // /f/<code>, so the lesson plan only ever has to remember a short link.
    if (request.method === "POST" && url.pathname === "/file") {
      let form;
      try {
        form = await request.formData();
      } catch {
        return json({ error: "Send the file as multipart form data." }, 400);
      }
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return json({ error: "No file was sent." }, 400);
      }
      const bytes = await file.arrayBuffer();
      if (!bytes.byteLength) return json({ error: "That file is empty." }, 400);
      if (bytes.byteLength > MAX_FILE_BYTES) {
        return json({ error: "That file is bigger than 20 MB." }, 413);
      }
      const name = safeFilename(file.name);
      const code = randomFileCode();
      // Keep attached files for a school year.
      await env.WORKSHEETS.put(`f:${code}`, bytes, {
        expirationTtl: 60 * 60 * 24 * 365,
        metadata: { name, type: file.type || "application/octet-stream" },
      });
      return json({ code, name, size: bytes.byteLength, url: `${url.origin}/f/${code}` });
    }

    // Serve an uploaded file.
    const fileMatch = url.pathname.match(/^\/f\/([a-z0-9]{1,32})\/?$/i);
    if ((request.method === "GET" || request.method === "HEAD") && fileMatch) {
      const { value, metadata } = await env.WORKSHEETS.getWithMetadata(
        `f:${fileMatch[1].toLowerCase()}`,
        { type: "arrayBuffer" },
      );
      if (!value) {
        return new Response(
          "<!doctype html><meta charset=utf-8><body style='font-family:sans-serif;text-align:center;padding:60px'><h2>File not found</h2><p>This link may have expired or the code is wrong.</p>",
          { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
      return new Response(value, {
        headers: {
          ...CORS,
          "Content-Type": metadata?.type || "application/octet-stream",
          "Content-Disposition": `inline; filename="${safeFilename(metadata?.name)}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
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
      // Root-level link is shortest (e.g. zera.pages.dev/cat).
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

    // Nothing matched. Answer with CORS headers so a browser can actually read
    // this reply — otherwise a call to a route this build doesn't have looks
    // like an unexplained network failure on the other end.
    return new Response(
      "Zera worksheet host. POST /upload to publish a worksheet; open /<code> to view it. POST /file to upload a file; open /f/<code> to fetch it.",
      { headers: { ...CORS, "Content-Type": "text/plain" } },
    );
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
