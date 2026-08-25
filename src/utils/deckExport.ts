/* ═══════════ Downloading the projected lesson ════════════════════════════
   The teaching deck is React and CSS, not data — its slides are timers,
   quizzes, spinners and drawing pads, so there is no text model to write out
   the way Slide Studio writes a PPTX from its slide objects. Instead we
   photograph each slide exactly as it projects and bind the pictures into a
   PDF or a PowerPoint. What the teacher downloads is what the class saw.     */

/** Tailwind v4 writes colours in oklch, which html2canvas cannot parse — it
 *  throws on the first one it meets. Everything here exists to hand it plain
 *  rgb instead. */
export function oklchToRgb(oklchStr: string): string {
  try {
    const regex =
      /oklch\(\s*([\d.]+%?|none)\s+([\d.]+|none)\s+([\d.]+|none)(?:\s*\/\s*([\d.]+%?|none))?\s*\)/i;
    const match = oklchStr.match(regex);
    if (!match) return "#3b82f6";

    const getVal = (str: string, isPercent = false) => {
      if (!str || str.toLowerCase() === "none") return 0;
      if (str.endsWith("%")) return parseFloat(str) / 100;
      return parseFloat(str) / (isPercent ? 100 : 1);
    };

    const L = getVal(match[1], match[1].endsWith("%"));
    const C = getVal(match[2]);
    const h = getVal(match[3]);
    const alphaVal = match[4];
    const alpha = alphaVal
      ? alphaVal.endsWith("%")
        ? parseFloat(alphaVal) / 100
        : parseFloat(alphaVal)
      : 1;

    const hRad = (h * Math.PI) / 180;
    const aOriginal = C * Math.cos(hRad);
    const bOriginal = C * Math.sin(hRad);

    const l_ = L + 0.3963377774 * aOriginal + 0.2158037573 * bOriginal;
    const m_ = L - 0.1055613458 * aOriginal - 0.0638541728 * bOriginal;
    const s_ = L - 0.0894841775 * aOriginal - 1.291485548 * bOriginal;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const rLinear = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    const toSRGB = (c: number) =>
      c <= 0.0031308
        ? 12.92 * c
        : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;

    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
    return `rgba(${clamp(toSRGB(rLinear))}, ${clamp(toSRGB(gLinear))}, ${clamp(
      toSRGB(bLinear),
    )}, ${alpha})`;
  } catch {
    return "#3b82f6";
  }
}

/** Every property html2canvas reads that can carry a colour.
 *
 *  HYPHENATED, and that matters: getComputedStyle().getPropertyValue only
 *  answers to the CSS name, so asking it for "backgroundColor" returns an
 *  empty string. Three copies of this code asked exactly that, which is why
 *  background colours were never converted at all.
 *
 *  background-image and box-shadow are here because a Tailwind gradient or
 *  ring is a whole expression with colours buried inside it, not a colour. */
const COLOUR_PROPS = [
  "color",
  "background-color",
  "background-image",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "column-rule-color",
  "caret-color",
  "-webkit-text-fill-color",
  "box-shadow",
  "fill",
  "stroke",
  "stop-color",
];

/** The colour syntaxes html2canvas 1.4 cannot parse.
 *
 *  It is not just oklch. Tailwind 4 writes EVERY opacity modifier as
 *  `color-mix(in oklab, …)` — 302 of them in this app's stylesheet against 185
 *  oklch — and puts `in oklab` interpolation hints in gradients. Converting
 *  oklch alone fixed the first crash and left the second waiting. */
const COLOUR_FN = /(oklch|oklab|lch|lab|color-mix|color)\(/i;

/** Gradient interpolation hints: `linear-gradient(in oklab, …)`. Valid CSS,
 *  meaningless to html2canvas, and removable without changing the stops. */
const INTERPOLATION =
  /\bin\s+(?:oklab|oklch|srgb(?:-linear)?|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz(?:-d50|-d65)?|hsl|hwb|lab|lch)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?\s*,\s*/gi;

/** Anything worth rewriting before a capture. */
const needsWork = (value: string): boolean =>
  /oklch|oklab|\blch\(|\blab\(|color-mix|color\(/i.test(value);

let sharedProbe: CanvasRenderingContext2D | null | undefined;
const colourProbe = (): CanvasRenderingContext2D | null => {
  if (sharedProbe === undefined) {
    try {
      sharedProbe = document.createElement("canvas").getContext("2d");
    } catch {
      sharedProbe = null;
    }
  }
  return sharedProbe;
};

/** Ask the browser what a colour actually is, and know when it could not say.
 *
 *  Assigning an unsupported value to fillStyle leaves the previous one in
 *  place, so a single read cannot tell "this is black" from "this did not
 *  parse". Running it twice from opposite sentinels can: a value that parsed
 *  gives the same answer both times, one that did not gives back whichever
 *  sentinel preceded it. */
function probeColour(value: string): string | null {
  const ctx = colourProbe();
  if (!ctx) return null;
  try {
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    const fromBlack = String(ctx.fillStyle);
    ctx.fillStyle = "#ffffff";
    ctx.fillStyle = value;
    const fromWhite = String(ctx.fillStyle);
    return fromBlack === fromWhite ? fromBlack : null;
  } catch {
    return null;
  }
}

/** Replace every modern colour call in a value with plain rgb, leaving the
 *  rest of the expression — a gradient's stops, a shadow's offsets — alone. */
function replaceColourCalls(value: string): string {
  let out = value;
  // Bounded: each pass removes one call, and a stylesheet value never holds
  // anywhere near this many.
  for (let guard = 0; guard < 64; guard++) {
    const m = COLOUR_FN.exec(out);
    if (!m) break;
    const start = m.index;
    let depth = 0;
    let end = -1;
    for (let k = start + m[0].length - 1; k < out.length; k++) {
      if (out[k] === "(") depth++;
      else if (out[k] === ")") {
        depth--;
        if (depth === 0) {
          end = k;
          break;
        }
      }
    }
    if (end < 0) break; // unbalanced; leave it rather than mangle it
    const call = out.slice(start, end + 1);
    const rgb = probeColour(call) || oklchToRgb(call);
    out = out.slice(0, start) + rgb + out.slice(end + 1);
  }
  return out;
}

/** A value html2canvas can read. */
const plainColour = (value: string): string =>
  replaceColourCalls(value).replace(INTERPOLATION, "");

/** Walk a stylesheet, including inside @media / @supports / @layer.
 *
 *  Nested rules used to fall into the catch and get the whole block deleted,
 *  which took most of Tailwind's styles with it. Recursing keeps the styles
 *  and still removes the colours html2canvas chokes on. */
function scrubRules(rules: CSSRuleList, sheet: CSSStyleSheet) {
  for (let j = rules.length - 1; j >= 0; j--) {
    const rule = rules[j] as any;
    if (!rule?.cssText || !needsWork(rule.cssText)) continue;
    if (rule.cssRules) {
      scrubRules(rule.cssRules as CSSRuleList, sheet);
      continue;
    }
    const style = rule.style as CSSStyleDeclaration | undefined;
    if (!style) continue;
    try {
      for (let k = 0; k < style.length; k++) {
        const prop = style[k];
        const val = style.getPropertyValue(prop);
        // Custom properties are enumerated here too, which is the important
        // part: Tailwind holds its palette in --color-* variables, so fixing
        // them at the source fixes everything that refers to them.
        if (val && needsWork(val)) {
          style.setProperty(
            prop,
            plainColour(val),
            style.getPropertyPriority(prop),
          );
        }
      }
    } catch {
      try {
        sheet.deleteRule(j);
      } catch {
        /* cross-origin sheet; nothing to do */
      }
    }
  }
}

/** Rewrite every colour html2canvas cannot parse in a cloned document.
 *
 *  Shared by every capture in the app — the deck, the timetable, the lesson
 *  plan and the image download — because separate copies drifted, two of them
 *  looked properties up by a name the DOM does not answer to, and one had no
 *  conversion at all. */
export function stripUnsupportedColours(clonedDoc: Document) {
  clonedDoc.querySelectorAll("style").forEach((tag) => {
    if (tag.textContent && needsWork(tag.textContent)) {
      tag.textContent = plainColour(tag.textContent);
    }
  });

  for (let i = 0; i < clonedDoc.styleSheets.length; i++) {
    const sheet = clonedDoc.styleSheets[i];
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (rules) scrubRules(rules, sheet);
    } catch {
      /* cross-origin stylesheet — not ours to fix */
    }
  }

  const view = clonedDoc.defaultView || window;
  const els = clonedDoc.getElementsByTagName("*");
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    let computed: CSSStyleDeclaration;
    try {
      computed = view.getComputedStyle(el);
    } catch {
      continue;
    }
    for (const prop of COLOUR_PROPS) {
      const val = computed.getPropertyValue(prop);
      if (!val || !needsWork(val)) continue;
      el.style.setProperty(prop, plainColour(val), "important");
    }
  }
}

/** The deck's own clone step: colours, then freeze the entrance animations so
 *  a slide is never photographed mid-pop. */
function prepareClone(clonedDoc: Document) {
  stripUnsupportedColours(clonedDoc);
  const freeze = clonedDoc.createElement("style");
  freeze.textContent = `*,*::before,*::after{animation:none !important;transition:none !important;}`;
  clonedDoc.head.appendChild(freeze);
}

/** Photograph one slide element at 16:9. */
export async function captureSlide(
  el: HTMLElement,
  scale = 2,
): Promise<string> {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: null,
    width: el.offsetWidth,
    height: el.offsetHeight,
    windowWidth: el.offsetWidth,
    windowHeight: el.offsetHeight,
    onclone: prepareClone,
  });
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Wait until the fonts and every picture inside the stage have landed —
 *  otherwise the first slides export with fallback type and blank images. */
export async function waitForStage(el: HTMLElement, settleMs = 120) {
  await document.fonts?.ready.catch(() => {});
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            // A picture that never answers must not hold up the whole export.
            setTimeout(done, 4000);
          }),
    ),
  );
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  await new Promise<void>((r) => setTimeout(r, settleMs));
}

const SAFE = (s: string) => (s || "Lesson").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");

/** One landscape page per slide, sized to the slide so nothing is letterboxed. */
export async function slidesToPdf(images: string[], title: string) {
  const { jsPDF } = await import("jspdf");
  const W = 960; // 1280px at 0.75pt/px
  const H = 540;
  const pdf = new jsPDF({ orientation: "l", unit: "pt", format: [W, H] });
  images.forEach((img, i) => {
    if (i > 0) pdf.addPage([W, H], "l");
    pdf.addImage(img, "JPEG", 0, 0, W, H);
  });
  pdf.save(`${SAFE(title)}.pdf`);
}

/** Each slide as a full-bleed picture on a 16:9 PowerPoint slide, so the deck
 *  opens on any classroom machine without this app. */
export async function slidesToPptx(images: string[], title: string) {
  const pptxgen = (await import("pptxgenjs")).default;
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  images.forEach((img) => {
    const s = pres.addSlide();
    s.addImage({ data: img, x: 0, y: 0, w: 10, h: 5.625 });
  });
  await pres.writeFile({ fileName: `${SAFE(title)}.pptx` });
}
