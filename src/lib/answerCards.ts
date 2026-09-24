/* ═══════════════ Answer cards the whole class can hold up ═════════════
   One printed card per student. A QR code in the middle says which student it
   is; the four edges are lettered A, B, C and D, and the letter that ends
   up at the top is the answer. A student turns the card rather than owning a
   device, and one camera reads the whole room.

   The letters are laid out so that exactly one of them reads the right way
   up at any time — the one at the top. Turning the card a quarter turn
   clockwise brings the left edge up, so the letters run A (top), B (left),
   C (bottom), D (right), each printed to read upright when it is the one
   at the top. */

import QRCode from "qrcode";
import type jsQRType from "jsqr";
import { ZERA_LOGO_B64 } from "../constants/zeraLogo";

export type CardStudent = { number: number; name: string };

/** A, B, C, D — in the order the card presents them as it turns. */
export const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];

/**
 * Which letter is at the top, from how far the card has been turned.
 *
 * The angle is the QR code's own rotation on screen, measured clockwise
 * from upright. Anything within 45° of a quarter turn counts as that turn,
 * so a card held a little crookedly still reads.
 */
export function letterForAngle(deg: number): Letter {
  const turns = Math.round(((deg % 360) + 360) % 360 / 90) % 4;
  return LETTERS[turns];
}

/** The angle of a QR code on screen, clockwise from upright, in degrees. */
export function angleOf(topLeft: { x: number; y: number }, topRight: { x: number; y: number }) {
  // Image coordinates run downwards, so a clockwise turn increases this.
  const deg = (Math.atan2(topRight.y - topLeft.y, topRight.x - topLeft.x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** What a card's QR carries: the card's number and nothing else, so the code
 *  stays small enough to read from the back of a classroom. */
export const cardPayload = (n: number) => String(n);
export const numberFromPayload = (s: string): number | null => {
  const n = Number(String(s).trim());
  return Number.isInteger(n) && n > 0 && n < 1000 ? n : null;
};

const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

/** One card's QR as a data URI. Drawn large and with the heaviest error
 *  correction, since a card gets held at arm's length across a room. */
async function qrFor(n: number): Promise<string> {
  return QRCode.toDataURL(cardPayload(n), {
    errorCorrectionLevel: "H",
    margin: 1,
    scale: 12,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export type CardSheetMeta = {
  subject: string;
  academicYear: string;
};

/**
 * The printable sheet. The cards carry a number and nobody's name, so one set
 * serves every class: card 3 is the third student in whichever class is
 * playing, and the screen counts that number in as the card is read.
 */
export async function buildCardsHtml(count: number, meta: CardSheetMeta): Promise<string> {
  const numbers = Array.from({ length: count }, (_, i) => i + 1);
  const codes = await Promise.all(numbers.map((n) => qrFor(n)));
  const cards = numbers
    .map(
      (n, i) => `
    <div class="page"><div class="card">
      <span class="letter top">A</span>
      <span class="letter left">B</span>
      <span class="letter bottom">C</span>
      <span class="letter right">D</span>
      <div class="middle">
        <img class="qr" src="${codes[i]}" alt="Card ${n}">
      </div>
      <div class="who">Student <b>${n}</b></div>
    </div></div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Answer Cards — 1 to ${count}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:18px;background:#F0FDF4;color:#111827;
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  header{max-width:1000px;margin:0 auto 14px;display:flex;align-items:center;gap:14px}
  header img{height:34px;width:auto}
  header h1{margin:0;font-size:19px;font-weight:900;color:#064E3B}
  header p{margin:2px 0 0;font-size:12px;color:#4B5563}
  .how{max-width:1000px;margin:0 auto 16px;background:#fff;border:1px solid #D1FAE5;
       border-radius:12px;padding:12px 16px;font-size:12.5px;line-height:1.5;color:#374151}
  .how b{color:#064E3B}
  .sheet{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:22px}
  .page{display:flex;justify-content:center}
  /* One card to a sheet of A4: the code is as big as the paper allows, which
     is what lets a phone read it from across a classroom. Square, so it looks
     the same whichever way up it is held. */
  .card{position:relative;width:100%;aspect-ratio:1/1;background:#fff;
        border:2px solid #D1D5DB;border-radius:14px;display:flex;flex-direction:column;
        align-items:center;justify-content:center;padding:16%}
  .middle{display:flex;align-items:center;justify-content:center;width:100%}
  .qr{width:100%;height:auto;image-rendering:pixelated}
  .who{display:flex;align-items:baseline;gap:10px;font-size:22px;font-weight:600;
       color:#374151;margin-top:4%}
  .who b{font-size:44px;font-weight:900;color:#064E3B}
  /* One letter reads upright at a time — the one at the top. */
  .letter{position:absolute;font-size:56px;font-weight:900;color:#064E3B;line-height:1}
  .letter.top{top:3.5%;left:50%;transform:translateX(-50%)}
  .letter.bottom{bottom:3.5%;left:50%;transform:translateX(-50%) rotate(180deg)}
  /* Each letter is pre-turned by as much as the card must be turned to bring
     it to the top — so it lands upright there, and only there. Turning the
     card a quarter clockwise brings the LEFT edge up, so that letter is
     pre-turned anticlockwise, not clockwise. */
  .letter.left{left:3.5%;top:50%;transform:translateY(-50%) rotate(-90deg)}
  .letter.right{right:3.5%;top:50%;transform:translateY(-50%) rotate(90deg)}
  @page{size:A4 portrait;margin:10mm}
  @media print{
    *,*::before,*::after{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    body{background:#fff;padding:0}
    .how,header{display:none}
    .sheet{display:block;max-width:none;gap:0}
    /* The printable area of A4 less its margins, with the card centred in it
       and a fresh sheet after every one. */
    .page{height:277mm;align-items:center;break-after:page;page-break-after:always}
    .page:last-child{break-after:auto;page-break-after:auto}
    .card{width:190mm;height:190mm;aspect-ratio:auto;padding:30mm;border:0.4mm solid #9CA3AF;
          border-radius:4mm}
    .qr{width:118mm;height:118mm}
    .who{font-size:7mm;gap:3mm;margin-top:5mm}
    .who b{font-size:13mm}
    .letter{font-size:20mm}
    .letter.top{top:5mm}.letter.bottom{bottom:5mm}
    .letter.left{left:5mm}.letter.right{right:5mm}
  }
</style>
</head>
<body>
  <header>
    <img src="${ZERA_LOGO_B64}" alt="Zera International School">
    <div>
      <h1>Answer Cards &mdash; Student 1 to ${count}</h1>
      <p>${esc(meta.subject)} &middot; ${esc(meta.academicYear)} &middot; one set for every class</p>
    </div>
  </header>
  <div class="how">
    <b>How they work.</b> One card to a sheet of A4, so a phone can read it across the
    room &mdash; no cutting. <b>Card 1 goes to the first student, card 2 to the
    second</b>, and so on — the same cards work for every class, as long as they go out in
    the same order each lesson. To answer, a student turns the card so that <b>the letter
    they want is at the top, reading the right way
    up</b>, then holds it in the air. Card stock, or a glued-on piece of card, lasts the year.
  </div>
  <div class="sheet">${cards}</div>
</body>
</html>`;
}

/* ─────────────────── Reading a frame full of cards ───────────────────
   A QR reader finds one code per image and a classroom holds twenty, so the
   frame is read whole and then in nine overlapping tiles. The whole-frame
   pass is for a phone held close to one student, where a single card fills the
   picture and every tile would see only part of it. Shared by the class
   screen's own camera and the phone, so both read a room the same way. */
export function readCardsInFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  jsQR: typeof jsQRType,
): Record<number, number> {
  const found: Record<number, number> = {};
  const read = (x: number, y: number, ww: number, hh: number) => {
    const img = ctx.getImageData(x, y, ww, hh);
    const hit = jsQR(img.data, ww, hh, { inversionAttempts: "dontInvert" });
    if (!hit) return;
    const n = numberFromPayload(hit.data);
    if (!n) return;
    const deg = angleOf(hit.location.topLeftCorner, hit.location.topRightCorner);
    found[n] = LETTERS.indexOf(letterForAngle(deg));
  };
  read(0, 0, w, h);
  const tiles = 3;
  const tw = Math.floor(w / tiles);
  const th = Math.floor(h / tiles);
  const over = 0.25;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const x = Math.max(0, Math.floor(tx * tw - tw * over));
      const y = Math.max(0, Math.floor(ty * th - th * over));
      const ww = Math.min(w - x, Math.floor(tw * (1 + over * 2)));
      const hh = Math.min(h - y, Math.floor(th * (1 + over * 2)));
      if (ww >= 40 && hh >= 40) read(x, y, ww, hh);
    }
  }
  return found;
}
