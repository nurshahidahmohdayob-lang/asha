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

/** Rewrite every oklch colour in a cloned document to rgb, and freeze the
 *  deck's entrance animations so a slide is never photographed mid-pop. */
function prepareClone(clonedDoc: Document) {
  clonedDoc.querySelectorAll("style").forEach((tag) => {
    if (tag.textContent?.includes("oklch")) {
      tag.textContent = tag.textContent.replace(/oklch\([^)]+\)/gi, (m) =>
        oklchToRgb(m),
      );
    }
  });

  for (let i = 0; i < clonedDoc.styleSheets.length; i++) {
    const sheet = clonedDoc.styleSheets[i];
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;
      for (let j = rules.length - 1; j >= 0; j--) {
        const rule = rules[j] as CSSStyleRule;
        if (!rule.cssText?.includes("oklch")) continue;
        try {
          const style = rule.style;
          if (!style) continue;
          for (let k = 0; k < style.length; k++) {
            const prop = style[k];
            const val = style.getPropertyValue(prop);
            if (val?.includes("oklch"))
              style.setProperty(prop, oklchToRgb(val));
          }
        } catch {
          // Write-protected rule — dropping it beats crashing the capture.
          try {
            sheet.deleteRule(j);
          } catch {
            /* cross-origin sheet; nothing to do */
          }
        }
      }
    } catch {
      /* cross-origin stylesheet — not ours to fix */
    }
  }

  const probe = clonedDoc.createElement("canvas").getContext("2d");
  const els = clonedDoc.getElementsByTagName("*");
  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    const computed = clonedDoc.defaultView?.getComputedStyle(el);
    if (!computed) continue;
    for (const prop of ["color", "backgroundColor", "borderColor", "fill", "stroke"]) {
      const val = computed.getPropertyValue(prop);
      if (!val?.includes("oklch")) continue;
      let safe = oklchToRgb(val);
      if (probe) {
        try {
          probe.fillStyle = val;
          safe = probe.fillStyle as string;
        } catch {
          /* keep the converted value */
        }
      }
      el.style.setProperty(prop, safe, "important");
    }
  }

  // Slides animate in. Without this a capture lands at whatever frame the
  // entrance happened to be on — half-faded, slightly scaled.
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
