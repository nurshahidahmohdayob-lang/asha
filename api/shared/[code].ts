// Reads a published lesson back for the shared-link viewer.
//
// The page itself lives on the worksheet host, which answers a CORS preflight
// but does NOT put Access-Control-Allow-Origin on the actual GET — so the
// browser fetched it, was refused, and the viewer showed "Failed to fetch".
//
// Fetching it here instead sidesteps the browser's rule entirely: this runs on
// the same origin as the app, and a server has no same-origin policy to break.
// The alternative was redeploying the Cloudflare host for one header, and its
// own README warns that deploying to the wrong account there orphans every
// worksheet link already handed out. Not worth it for a read.

const HOST = "https://zera-4ag.pages.dev";

export const config = { maxDuration: 15 };

export default async function handler(req: any, res: any) {
  const code = String(req.query?.code || "");
  // The code is put into a URL, so it may only be what a code can be.
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(code)) {
    res.status(400).json({ error: "That is not a valid lesson code." });
    return;
  }

  try {
    const upstream = await fetch(`${HOST}/${encodeURIComponent(code)}`, {
      redirect: "follow",
    });
    if (!upstream.ok) {
      res
        .status(upstream.status === 404 ? 404 : 502)
        .json({ error: `This link could not be opened (${upstream.status}).` });
      return;
    }

    const html = await upstream.text();
    const block =
      /<script[^>]*id=["']zera-deck["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (!block) {
      res.status(404).json({ error: "This link does not hold a lesson." });
      return;
    }

    // Undo the one escape publishing had to make: a literal "</script>" inside
    // the lesson would otherwise have closed the block early.
    const raw = block[1].replace(/<\\\/script/gi, "</script");
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      res.status(422).json({ error: "This lesson could not be read." });
      return;
    }
    if (!data?.plan || !data?.week) {
      // Name the gap. "Incomplete" told whoever opened the link nothing, and
      // told whoever sent it even less.
      const missing = [!data?.plan && "plan", !data?.week && "week"]
        .filter(Boolean)
        .join(" and ");
      res.status(422).json({
        error: `This link is missing the lesson's ${missing}. It was made before sharing worked properly — ask for a new link.`,
      });
      return;
    }

    // A published lesson never changes, so it is worth caching hard — a class
    // of thirty opening the same link should not be thirty fetches.
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
    res.status(200).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: err?.message || "This link could not be opened." });
  }
}
