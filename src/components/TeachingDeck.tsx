/* ═══════════ Interactive teaching deck ═══════════════════════════════════
   A ready-to-project lesson built from one week of a lesson plan — the same
   deck the Life Competencies app gives its teachers, wired to this app's
   LessonPlan data. The week's own fields become the slides:

     introduction → Do Now      learningObjective → Our learning
     activities   → one slide each (numbered steps where the text has them)
     assessment   → Check understanding
     resources    → Teacher notes

   Live classroom tools are built in: countdown timer, tickable success
   criteria, random picker, thumbs poll and reveal-on-tap prompts. Nothing is
   generated here — every slide comes from what the teacher already wrote. */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  captureSlide,
  slidesToPdf,
  slidesToPptx,
  waitForStage,
} from "../utils/deckExport";
import { translateContent } from "../services/geminiService";
import type {
  LessonActivityPack,
  LessonPlan,
  LessonTile,
  QuizQuestion,
  SlideContent,
  WeeklyPlan,
} from "../types";

/* ── Icons ── stroked 24px paths, same set as the Life Competencies deck. */
const I = {
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" />
      <path d="M20 18v3H6.5A2.5 2.5 0 014 18.5" />
      <path d="M8 7h8M8 10.5h6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </>
  ),
  check: <path d="M4 12l5 5L20 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  star: (
    <path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.2l5.9-.9L12 3z" />
  ),
  present: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v4M8 20h8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  play: <path d="M8 5l11 7-11 7V5z" />,
  pause: <path d="M9 5v14M15 5v14" />,
  reset: (
    <>
      <path d="M3.5 12a8.5 8.5 0 108.5-8.5A8.5 8.5 0 006 6.5" />
      <path d="M3.5 3v4h4" />
    </>
  ),
  hand: (
    <>
      <path d="M9 11V5.5a1.5 1.5 0 013 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 013 0V11" />
      <path d="M15 11V6.5a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-.5a6 6 0 01-4.6-2.2L3.6 15a1.6 1.6 0 012.3-2.2L9 15" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4l10-10a2.8 2.8 0 10-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 17.5V19a2 2 0 002 2h12a2 2 0 002-2v-1.5" />
    </>
  ),
};

/* ── Editing the lesson on the board ──────────────────────────────────────
   The generated wording is a first draft, and a teacher knows their class
   better than the model does. With Edit on, every piece of text on the deck
   becomes editable in place and the interactive bits stop firing, so tapping
   a quiz option puts a caret in it instead of marking the class wrong. */
type DeckEditor = {
  on: boolean;
  /** Apply a change to a copy of the pack and hand it back to the app. */
  edit: (mutate: (draft: LessonActivityPack) => void) => void;
  /** Put a file on the share host and hand back its link. Absent when the
   *  app hasn't wired uploading, in which case no picture controls appear. */
  upload?: (file: File) => Promise<string>;
};

export const EditCtx = createContext<DeckEditor | null>(null);
const useEditor = () => useContext(EditCtx);

/** A picture slot: shows the picture if there is one, and while editing lets
 *  the teacher put one in, swap it, or take it out again. Falls back to the
 *  slide's emoji so a lesson without pictures still looks finished. */
function Picture({
  url,
  emoji,
  size = "9rem",
  apply,
}: {
  url?: string;
  /** Shown when there is no picture. */
  emoji?: string;
  size?: string;
  /** Where this picture lives in the pack — undefined clears it. */
  apply: (draft: LessonActivityPack, next: string | undefined) => void;
}) {
  const editor = useEditor();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // An empty slot is only worth space while editing — otherwise a slide with
  // no picture would reserve a hole where one could go.
  const showable = Boolean(url || emoji || (editor?.on && editor.upload));

  const pick = async (file?: File | null) => {
    if (!file || !editor?.upload) return;
    setBusy(true);
    try {
      const link = await editor.upload(file);
      editor.edit((d) => apply(d, link));
      setFailed(false);
    } catch (e) {
      console.error("Picture upload failed:", e);
      alert(`That picture could not be uploaded:\n\n${(e as Error)?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!showable) return null;

  return (
    <div className="relative shrink-0" style={{ width: size }}>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          onError={() => setFailed(true)}
          className="w-full rounded-[1.5rem] object-cover shadow-lg"
          style={{ height: size }}
        />
      ) : (
        <span className="grid place-items-center leading-none" style={{ height: size, fontSize: `calc(${size} * 0.8)` }}>
          {emoji}
        </span>
      )}

      {editor?.on && editor.upload && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <label
            className={`cursor-pointer rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-brand-700 ${
              busy ? "opacity-60" : ""
            }`}
          >
            {busy ? "Uploading…" : url ? "Change" : "Add picture"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {url && (
            <button
              onClick={() => editor.edit((d) => apply(d, undefined))}
              className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow ring-2 ring-silver hover:ring-red-300"
            >
              Remove
            </button>
          )}
        </div>
      )}
      {url && failed && (
        <p className="mt-1 text-center text-xs font-bold text-red-500">Picture didn&rsquo;t load</p>
      )}
    </div>
  );
}

/** Text that can be corrected in place when Edit is on. */
function Ed({
  value,
  apply,
  as = "span",
  className = "",
  multiline = false,
}: {
  value: string;
  /** Where this text lives in the pack. */
  apply: (draft: LessonActivityPack, text: string) => void;
  as?: "span" | "p" | "h2" | "h3" | "div";
  className?: string;
  multiline?: boolean;
}) {
  const editor = useEditor();
  if (!editor?.on) return createElement(as, { className }, value);
  return createElement(
    as,
    {
      className: `${className} cursor-text rounded-lg outline-none ring-2 ring-dashed ring-sunny/70 focus:ring-4 focus:ring-sunny`,
      contentEditable: true,
      suppressContentEditableWarning: true,
      spellCheck: true,
      // Keep the click here — otherwise the slide's own tap handler fires and
      // the caret never lands.
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      onKeyDown: (e: React.KeyboardEvent) => {
        // Arrow keys move the caret; they must not turn the slide.
        e.stopPropagation();
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        const text = (e.currentTarget.textContent || "").trim();
        if (text && text !== value) editor.edit((d) => apply(d, text));
      },
    },
    value,
  );
}

function Icon({ d, className = "" }: { d: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {d}
    </svg>
  );
}

/* ── Reading the teacher's prose ──────────────────────────────────────────
   Plan fields are free text. These pull them apart without inventing
   anything: a blank field simply yields nothing to show. */

/** Pull the school year out of "Year 3", "Grade 4", "Y5"… A local copy of the
 *  same rule in geminiService — the deck stays free of the AI service so a
 *  projected lesson never depends on it. */
function yearNumberOf(yearGroup?: string): number | null {
  if (!yearGroup) return null;
  const m = String(yearGroup).match(/(\d{1,2})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 13 ? n : null;
}

/** Words that appear in a topic field but name nothing — a section label or a
 *  placeholder the teacher never filled in. Putting one of these into "What do
 *  you know about ___?" produces nonsense like "What do you know about
 *  Introduction?", so the deck looks further for something real to name. */
const PLACEHOLDER_TOPIC =
  /^(introduction|intro|topic|untitled|tbd|n\/?a|auto[- ]?assign(ed)?|week\s*\d+|lesson\s*\d+|-+)$/i;

/** Drop a sentence into mid-sentence position without a stray capital, but
 *  leave acronyms and proper nouns alone ("ICT", "Malaysia"). */
function lowerFirst(s: string): string {
  const t = s.replace(/[.\s]+$/, "");
  if (/^[A-Z]{2,}/.test(t)) return t;
  const [first = "", ...rest] = t.split(" ");
  // A capitalised word followed by another capitalised word is likely a name.
  if (rest[0] && /^[A-Z]/.test(rest[0])) return t;
  return first.charAt(0).toLowerCase() + first.slice(1) + (rest.length ? " " + rest.join(" ") : "");
}

function meaningful(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !PLACEHOLDER_TOPIC.test(t)) return t;
  }
  return "";
}

/** Split a newline/bullet list field (success criteria, competencies). */
function splitLines(s?: string): string[] {
  if (!s) return [];
  return s
    .split(/\r?\n|(?:^|\s)[•·‣]\s*/)
    // Strip a leading marker. Bullets are listed here as well as in the split
    // above: on "• one\n• two" the newline is consumed first, so the bullet
    // opening the next line never gets a chance to match as a separator.
    .map((x) => x.replace(/^\s*(?:\d+[.)]|[-–—*•·‣])\s*/, "").trim())
    .filter(Boolean);
}

/** Split the activities field into separate activities — one slide each.
 *  Lookahead only, no lookbehind: Safari below 16.4 throws a SyntaxError on
 *  lookbehind while parsing, which would take the whole bundle down on an
 *  older classroom iPad. */
export function splitActivities(s?: string): string[] {
  if (!s) return [];
  return s
    // Lines and bullets first…
    .split(/\r?\n|(?:^|\s)[•·‣]\s*/)
    // …then a run-on line that numbers its activities inline ("1. … 2. …").
    .flatMap((seg) => seg.split(/\s+(?=\d+[.)]\s)/))
    // Strip a leading marker. Bullets are listed here as well as in the split
    // above: on "• one\n• two" the newline is consumed first, so the bullet
    // opening the next line never gets a chance to match as a separator.
    .map((x) => x.replace(/^\s*(?:\d+[.)]|[-–—*•·‣])\s*/, "").trim())
    .filter((x) => x.length > 1);
}

/** Pull run-it steps out of one activity, when the teacher wrote any.
 *  Only splits on real step markers — never chops an ordinary sentence, so a
 *  one-line activity stays one line rather than becoming fake steps. */
function stepsFromActivity(text: string): { title: string; steps: string[] } {
  const arrowed = text.split(/\s*(?:→|->|;)\s*/).filter(Boolean);
  if (arrowed.length >= 2) {
    return { title: arrowed[0], steps: arrowed.slice(1).map((s) => s.trim()) };
  }
  // "Step 1 … Step 2 …" or "1. … 2. …" written inline.
  const numbered = text.split(/\s*(?:\bStep\s*\d+\s*[:.)-]|\(\d+\)|\b\d+[.)])\s+/i);
  if (numbered.length >= 3) {
    const head = numbered[0].trim();
    const steps = numbered.slice(1).map((s) => s.trim()).filter(Boolean);
    return { title: head || text, steps };
  }
  return { title: text, steps: [] };
}

/** A colon-led activity ("Group work: sort the cards") gets a short heading. */
function activityHeading(text: string): { head: string; body: string } {
  const m = text.match(/^([^:]{3,60}):\s*(.+)$/s);
  if (m) return { head: m[1].trim(), body: m[2].trim() };
  return { head: text, body: "" };
}

/* ── Slide colour tones ──
   Each kind of slide gets its own Zera sub-brand colour so children can see at
   a glance what part of the lesson they're in. */
type Tone = "start" | "donow" | "learn" | "activity" | "share" | "check" | "reflect" | "notes";

const TONE_BG: Record<Tone, string> = {
  start: "bg-brand-600",
  donow: "bg-sunny",
  learn: "bg-teal",
  activity: "bg-leaf",
  share: "bg-sky",
  check: "bg-sunny",
  reflect: "bg-brand-500",
  notes: "bg-zinc-200",
};

/** Slides on yellow need dark chrome text; the rest are on deep colour. */
const TONE_ON_LIGHT: Record<Tone, boolean> = {
  start: false,
  donow: true,
  learn: false,
  activity: false,
  share: false,
  check: true,
  reflect: false,
  notes: true,
};

const DECK_PATTERNS = [
  "deck-dots",
  "deck-grid",
  "deck-rings",
  "deck-waves",
  "deck-checks",
  "deck-confetti",
] as const;

type TeachSlide = { kicker: string; tone: Tone; content: ReactNode };

/** Slide design canvas. Content is laid out at this width, then scaled as a
 *  whole to fit the screen — so a slide never scrolls, however much it holds. */
const SLIDE_W = 1120;

function FitStage({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const fit = () => {
      // offsetWidth/Height are layout values — unaffected by our own transform,
      // so measuring can't feed back into itself.
      const bw = box.clientWidth;
      const bh = box.clientHeight;
      const cw = inner.offsetWidth || SLIDE_W;
      const ch = inner.offsetHeight || 1;
      const k = Math.min(bw / cw, bh / ch);
      setScale(Number.isFinite(k) && k > 0 ? Math.max(0.35, Math.min(1.4, k)) : 1);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    ro.observe(inner);
    // Fonts landing late change the measured height.
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      ref={boxRef}
      className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
        <div ref={innerRef} style={{ width: SLIDE_W }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Slide furniture ── */
function TeachHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-4xl font-bold leading-[1.1] text-ink sm:text-5xl">{children}</h2>;
}

function TeachBadge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full bg-white px-5 py-2.5 text-lg font-bold text-brand-700 shadow-md ring-2 ring-brand-100">
      <Icon d={icon} className="h-5 w-5" />
      {label}
    </span>
  );
}

/** The white card every slide's content sits on, floating on the tone colour. */
function TeachCard({
  children,
  wide = false,
  tight = false,
}: {
  children: ReactNode;
  wide?: boolean;
  /** Trim the padding for content-heavy slides so they fit without scrolling. */
  tight?: boolean;
}) {
  return (
    <div
      className={`anim-pop mx-auto w-full rounded-[2rem] bg-white shadow-2xl sm:rounded-[2.5rem] ${
        tight ? "p-6 sm:p-7" : "p-7 sm:p-10"
      } ${wide ? "max-w-5xl" : "max-w-4xl"}`}
    >
      {children}
    </div>
  );
}

/* ── Live classroom tools ── */

/** Countdown timer for timed classroom tasks. `compact` trims it down for
 *  slides that already carry a lot (a four-step activity, say). */
function TeachTimer({ minutes = 5, compact = false }: { minutes?: number; compact?: boolean }) {
  const PRESETS = [1, 2, 3, 5, 10];
  const [total, setTotal] = useState(minutes * 60);
  const [left, setLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);

  // Self-terminating tick: stops at zero without a cascading setState.
  useEffect(() => {
    if (!running || left === 0) return;
    const id = setTimeout(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearTimeout(id);
  }, [running, left]);

  const set = (m: number, start = false) => {
    setRunning(start);
    setTotal(m * 60);
    setLeft(m * 60);
  };

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const pct = total > 0 ? left / total : 0;
  const done = left === 0;
  const nearlyUp = !done && left <= 10;
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className={`flex flex-wrap items-center justify-center ${compact ? "gap-5" : "gap-7"}`}>
      <div
        className={`relative grid shrink-0 place-items-center ${
          compact ? "h-24 w-24" : "h-36 w-36"
        } ${done ? "anim-cheer" : nearlyUp ? "anim-wiggle" : ""}`}
      >
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(0,0,0,.09)" strokeWidth="11" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={done || nearlyUp ? "#f7b917" : "#0a4f29"}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span
          className={`relative font-mono font-bold tabular-nums ${
            done
              ? `${compact ? "text-2xl" : "text-3xl"} text-brand-700`
              : `${compact ? "text-2xl" : "text-4xl"} text-ink`
          }`}
        >
          {done ? "Time!" : `${mm}:${ss}`}
        </span>
      </div>

      <div className={`flex flex-col ${compact ? "gap-2.5" : "gap-3.5"}`}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => (done ? set(total / 60, true) : setRunning((r) => !r))}
            className={`flex items-center gap-2 rounded-2xl bg-brand-600 font-bold text-white shadow-lg transition-all hover:bg-brand-700 active:scale-95 ${
              compact ? "px-5 py-3 text-lg" : "px-7 py-4 text-xl"
            } ${done ? "anim-halo" : ""}`}
          >
            <Icon
              d={done ? I.reset : running ? I.pause : I.play}
              className={compact ? "h-5 w-5" : "h-6 w-6"}
            />
            {done ? "Again" : running ? "Pause" : "Start"}
          </button>
          <button
            onClick={() => set(total / 60)}
            className={`grid place-items-center rounded-2xl border-2 border-silver bg-white text-brand-700 transition-all hover:border-brand-400 active:scale-95 ${
              compact ? "h-11 w-11" : "h-14 w-14"
            }`}
            aria-label="Reset timer"
            title="Reset timer"
          >
            <Icon d={I.reset} className={compact ? "h-5 w-5" : "h-6 w-6"} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => set(m)}
              className={`rounded-xl font-bold transition-all active:scale-95 ${
                compact ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-base"
              } ${
                total === m * 60
                  ? "bg-brand-600 text-white shadow"
                  : "bg-white text-zinc-500 ring-2 ring-silver hover:text-brand-700"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tick-off list — success criteria the class works through together. */
function TeachChecklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const count = done.filter(Boolean).length;
  return (
    <div>
      <ul className="anim-stagger space-y-3.5">
        {items.map((it, i) => (
          <li key={i} style={{ "--i": i } as React.CSSProperties}>
            <button
              onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              aria-pressed={done[i]}
              className={`flex w-full items-center gap-4 rounded-3xl border-4 p-5 text-left transition-all active:scale-[0.98] ${
                done[i]
                  ? "border-brand-500 bg-brand-50 shadow-lg"
                  : "border-silver bg-white hover:border-brand-300 hover:shadow-md"
              }`}
            >
              <span
                key={String(done[i])}
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors ${
                  done[i] ? "anim-tick bg-brand-600 text-white" : "bg-zinc-100 text-zinc-300"
                }`}
              >
                <Icon d={I.check} className="h-7 w-7" />
              </span>
              <span
                className={`text-2xl font-semibold leading-snug sm:text-3xl ${
                  done[i] ? "text-brand-800" : "text-zinc-700"
                }`}
              >
                {it}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-center text-xl font-bold text-brand-700">
        {count === items.length ? "🎉 All done!" : `${count} of ${items.length} ticked`}
      </p>
    </div>
  );
}

/** Sentence starters revealed one tap at a time. */
function TeachReveal({
  items,
  tilted = false,
  label = "prompt",
  editItem,
}: {
  items: string[];
  tilted?: boolean;
  /** What the hidden thing is, so the placeholder reads naturally. */
  label?: string;
  editItem?: (index: number, text: string, draft: LessonActivityPack) => void;
}) {
  const editor = useEditor();
  const [shown, setShown] = useState<boolean[]>(() => items.map(() => false));
  // Nothing can be corrected while it is still hidden behind a tap.
  const reveal = (i: number) => editor?.on || shown[i];
  const TILTS = ["tilt-a", "tilt-b", "tilt-c"];
  return (
    <ul className="space-y-4">
      {items.map((it, i) => (
        <li key={i} className={tilted ? TILTS[i % TILTS.length] : ""}>
          <button
            onClick={() => setShown((s) => s.map((v, j) => (j === i ? true : v)))}
            className={`w-full rounded-3xl border-4 p-6 text-left transition-all active:scale-[0.98] ${
              reveal(i)
                ? "border-brand-300 bg-brand-50 shadow-xl"
                : "border-dashed border-silver bg-white hover:border-brand-400 hover:shadow-md"
            }`}
          >
            {reveal(i) ? (
              editItem ? (
                <Ed
                  className="anim-pop block text-2xl font-semibold leading-snug text-brand-900 sm:text-3xl"
                  value={it}
                  multiline
                  apply={(d, t) => editItem(i, t, d)}
                />
              ) : (
                <span className="anim-pop block text-2xl font-semibold leading-snug text-brand-900 sm:text-3xl">
                  {it}
                </span>
              )
            ) : (
              <span className="flex items-center gap-3 text-xl font-bold text-zinc-400">
                <Icon d={I.hand} className="h-7 w-7 anim-float" />
                Tap to see {label} {i + 1}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Mini-quiz question — the class picks an answer on the board and finds out
 *  straight away whether it was right. The teacher taps to lock in the class's
 *  choice; wrong answers stay on screen so the misconception can be talked
 *  about rather than skipped past. */
function QuizCard({
  q,
  index,
  total,
  qi,
}: {
  q: QuizQuestion;
  index: number;
  total: number;
  /** Position in pack.questions, so an edit knows what it is changing. */
  qi: number;
}) {
  const editor = useEditor();
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const right = picked === q.correctIndex;
  const LETTERS = ["A", "B", "C", "D", "E", "F"];
  return (
    <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-sunny px-5 py-2 text-lg font-bold text-brand-900">
            <Icon d={I.star} className="h-5 w-5" />
            Quiz {index} of {total}
          </span>
          <Ed
            as="h2"
            multiline
            className="mt-4 block text-[2.7rem] font-bold leading-[1.08] text-ink"
            value={q.text}
            apply={(d, t) => {
              if (d.questions?.[qi]) d.questions[qi].text = t;
            }}
          />
        </div>
        {answered && (
          <span
            className={`anim-pop shrink-0 rounded-3xl px-6 py-4 text-2xl font-bold shadow-lg ${
              right ? "bg-brand-600 text-white" : "bg-sun-soft text-brand-900"
            }`}
          >
            {right ? "🎉 Correct!" : "Not quite"}
          </span>
        )}
      </div>

      <ul className="anim-stagger mt-7 grid grid-cols-2 gap-4">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.correctIndex;
          // Once answered, always show where the right answer was.
          const state = !answered
            ? "border-silver bg-white hover:border-brand-400 hover:shadow-lg"
            : isAnswer
              ? "border-brand-600 bg-brand-50 shadow-xl"
              : i === picked
                ? "border-sunny bg-sun-soft"
                : "border-silver bg-white opacity-50";
          return (
            <li key={i} style={{ "--i": i } as React.CSSProperties}>
              <button
                onClick={() => {
                  // While editing, a tap is putting the caret in the option,
                  // not the class answering.
                  if (editor?.on) return;
                  setPicked((p) => (p === null ? i : p));
                }}
                className={`flex w-full items-center gap-4 rounded-3xl border-4 p-5 text-left transition-all active:scale-[0.98] ${state}`}
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl font-bold ${
                    answered && isAnswer ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {answered && isAnswer ? <Icon d={I.check} className="h-7 w-7" /> : LETTERS[i]}
                </span>
                <Ed
                  className="flex-1 text-2xl font-semibold leading-snug text-zinc-700"
                  value={opt}
                  apply={(d, t) => {
                    const target = d.questions?.[qi];
                    if (target) target.options[i] = t;
                  }}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {(answered || editor?.on) && q.why?.trim() && (
        <Ed
          as="p"
          multiline
          className="anim-pop mt-6 block rounded-2xl bg-brand-50 px-6 py-4 text-center text-xl leading-snug text-brand-900"
          value={q.why.trim()}
          apply={(d, t) => {
            if (d.questions?.[qi]) d.questions[qi].why = t;
          }}
        />
      )}
      {!answered && (
        <p className="mt-6 text-center text-lg font-bold text-zinc-400">
          Talk to your partner, then tap the answer
        </p>
      )}
    </div>
  );
}

/* ── Picture-first activity slides ────────────────────────────────────────
   A lesson is taught, not read. These are the doing slides: tiles to name,
   a story to tell a scene at a time, a game to match, something to act out,
   something to draw. Each is driven entirely by the generated pack, so the
   same components serve any subject. */

/** A row of labelled pictures — the deck's way of saying "here is what we are
 *  learning" without a paragraph. */
function TileRow({
  tiles,
  big = false,
  editLabel,
  editTile,
  removeTile,
}: {
  tiles: LessonTile[];
  big?: boolean;
  /** Where this row's labels live in the pack, when editing is on. */
  editLabel?: (index: number, text: string, draft: LessonActivityPack) => void;
  /** Swap a tile's emoji for an uploaded picture, or clear it again. */
  editTile?: (index: number, image: string | undefined, draft: LessonActivityPack) => void;
  /** Take this tile off the slide entirely. */
  removeTile?: (index: number, draft: LessonActivityPack) => void;
}) {
  const editor = useEditor();
  const cols = Math.min(tiles.length, 5);
  return (
    <div
      className="anim-stagger mt-7 grid gap-5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {tiles.map((t, i) => (
        <div
          key={i}
          style={{ "--i": i } as React.CSSProperties}
          className="relative rounded-[2rem] border-4 border-silver bg-white p-5 text-center shadow-lg"
        >
          {/* Take the whole tile off the slide. Sits on the corner so it is
              obviously about this one picture and not the row. */}
          {editor?.on && removeTile && (
            <button
              onClick={() => editor.edit((d) => removeTile(i, d))}
              title="Remove this from the slide"
              aria-label="Remove this from the slide"
              className="absolute -right-3 -top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:bg-red-600 active:scale-90"
            >
              <Icon d={I.close} className="h-5 w-5" />
            </button>
          )}
          {editTile ? (
            <Picture
              url={t.image}
              emoji={t.emoji}
              size={big ? "6rem" : "5rem"}
              apply={(d, next) => editTile(i, next, d)}
            />
          ) : t.image ? (
            <img
              src={t.image}
              alt=""
              className="mx-auto rounded-[1.2rem] object-cover"
              style={{ height: big ? "6rem" : "5rem", width: big ? "6rem" : "5rem" }}
            />
          ) : (
            <span className={big ? "block text-8xl leading-tight" : "block text-7xl leading-tight"}>
              {t.emoji}
            </span>
          )}
          {editLabel ? (
            <Ed
              className="mt-2 block text-2xl font-bold leading-tight text-ink"
              value={t.label}
              apply={(d, text) => editLabel(i, text, d)}
            />
          ) : (
            <span className="mt-2 block text-2xl font-bold leading-tight text-ink">{t.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Story told a scene at a time — tap a picture, read that line aloud. */
function StoryScenes({
  scenes,
  removeScene,
}: {
  scenes: LessonTile[];
  removeScene?: (index: number, draft: LessonActivityPack) => void;
}) {
  const editor = useEditor();
  const [open, setOpen] = useState<number | null>(null);
  // While editing, show the first scene so there is something to correct.
  const at = editor?.on ? (open ?? 0) : open;
  return (
    <div>
      <div
        className="mt-6 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${Math.min(scenes.length, 4)}, minmax(0, 1fr))` }}
      >
        {scenes.map((s, i) => (
          <div key={i} className="relative">
            {editor?.on && removeScene && (
              <button
                onClick={() => editor.edit((d) => removeScene(i, d))}
                title="Remove this scene"
                aria-label="Remove this scene"
                className="absolute -right-2.5 -top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 active:scale-90"
              >
                <Icon d={I.close} className="h-4 w-4" />
              </button>
            )}
          <button
            onClick={() => setOpen(i)}
            className={`rounded-[2rem] border-4 p-5 text-center transition-all active:scale-[0.98] ${
              at === i
                ? "border-brand-600 bg-brand-50 shadow-xl"
                : "border-dashed border-silver bg-white hover:border-brand-400"
            }`}
          >
            <span className="block text-7xl leading-tight">{s.emoji}</span>
            <span className="mt-1 block text-xl font-bold text-zinc-400">{i + 1}</span>
          </button>
          </div>
        ))}
      </div>
      {at === null ? (
        <p className="anim-pop mt-6 min-h-[5rem] rounded-[1.6rem] bg-sun-soft px-8 py-5 text-center text-3xl font-bold leading-snug text-brand-900">
          Tap picture 1 to begin the story.
        </p>
      ) : (
        <Ed
          as="p"
          multiline
          className="anim-pop mt-6 block min-h-[5rem] rounded-[1.6rem] bg-sun-soft px-8 py-5 text-center text-3xl font-bold leading-snug text-brand-900"
          value={scenes[at].label}
          apply={(d, t) => {
            if (d.story?.scenes?.[at]) d.story.scenes[at].label = t;
          }}
        />
      )}
    </div>
  );
}

/** Tap a word, then tap its picture. Matches lock in; wrong pairs wobble. */
function MatchGame({
  pairs,
  removePair,
}: {
  pairs: LessonTile[];
  removePair?: (label: string, draft: LessonActivityPack) => void;
}) {
  const editor = useEditor();
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  // Shuffled once per mount so the answer column never mirrors the prompts.
  const shuffled = useRef<LessonTile[] | null>(null);
  if (!shuffled.current) shuffled.current = [...pairs].sort(() => Math.random() - 0.5);

  const tapFace = (t: LessonTile) => {
    if (editor?.on || done.includes(t.label)) return;
    if (!picked) {
      setMsg("Tap a word first.");
      return;
    }
    if (picked === t.label) {
      setDone((d) => [...d, t.label]);
      setPicked(null);
      setMsg(done.length + 1 === pairs.length ? "🎉 All matched! Well done." : "🎉 Yes! That's a match.");
    } else {
      setWrong(t.label);
      setMsg("Not that one — try again.");
      setTimeout(() => setWrong(null), 400);
    }
  };

  return (
    <div>
      <div className="mt-6 grid grid-cols-2 gap-8">
        <div className="grid gap-3">
          {pairs.map((t) => {
            const isDone = done.includes(t.label);
            return (
              <button
                key={t.label}
                onClick={() =>
                  !editor?.on &&
                  !isDone &&
                  (setPicked(t.label), setMsg(`Now tap the picture for ${t.label}.`))
                }
                className={`rounded-[1.6rem] border-4 p-4 text-2xl font-bold transition-all active:scale-[0.98] ${
                  isDone
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : picked === t.label
                      ? "border-sky bg-[#eaf4f7] text-ink"
                      : "border-dashed border-silver bg-white text-ink hover:border-brand-400"
                }`}
              >
                <Ed
                  value={t.label}
                  apply={(d, text) => {
                    const target = d.matching?.pairs?.find((x) => x.label === t.label);
                    if (target) target.label = text;
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="grid gap-3">
          {shuffled.current.map((t) => {
            const isDone = done.includes(t.label);
            return (
              <button
                key={t.label}
                onClick={() => tapFace(t)}
                className={`relative w-full rounded-[1.6rem] border-4 p-2 transition-all active:scale-[0.98] ${
                  wrong === t.label ? "anim-wiggle" : ""
                } ${
                  isDone
                    ? "border-brand-600 bg-brand-50"
                    : "border-dashed border-silver bg-white hover:border-brand-400"
                }`}
              >
                {editor?.on && removePair && (
                  <span
                    role="button"
                    tabIndex={0}
                    title="Remove this pair"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.edit((d) => removePair(t.label, d));
                    }}
                    className="absolute -right-2.5 -top-2.5 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600"
                  >
                    <Icon d={I.close} className="h-4 w-4" />
                  </span>
                )}
                <span className="block text-6xl leading-tight">{t.emoji}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-5 min-h-[2.5rem] text-center text-2xl font-bold text-brand-700">{msg}</p>
    </div>
  );
}

/** Spinner that lands on one thing to perform. */
function ActSpinner({
  items,
  removeItem,
}: {
  items: LessonTile[];
  removeItem?: (index: number, draft: LessonActivityPack) => void;
}) {
  const editor = useEditor();
  const [at, setAt] = useState<LessonTile | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    let ticks = 0;
    const id = setInterval(() => {
      setAt(items[Math.floor(Math.random() * items.length)]);
      if (++ticks >= 10) {
        clearInterval(id);
        timer.current = null;
        setSpinning(false);
      }
    }, 80);
    timer.current = id;
  };

  return (
    <div className="mt-6 text-center">
      <div className="mx-auto w-[24rem] rounded-[2rem] border-[6px] border-leaf bg-brand-50 p-6">
        <span className="block text-8xl leading-tight">{at ? at.emoji : "🎲"}</span>
        <span className="mt-2 block text-3xl font-bold text-ink">
          {at ? at.label : "Tap the button!"}
        </span>
      </div>
      {/* While editing, the pool is listed so an unwanted one can be taken
          out — the spinner alone only ever shows one at a time. */}
      {editor?.on && removeItem && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {items.map((it, i) => (
            <span
              key={i}
              className="relative inline-flex items-center gap-2 rounded-xl border-2 border-silver bg-white px-3 py-1.5 text-lg font-bold"
            >
              {it.emoji} {it.label}
              <button
                onClick={() => editor.edit((d) => removeItem(i, d))}
                title="Remove this"
                aria-label={`Remove ${it.label}`}
                className="grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                <Icon d={I.close} className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <button
        onClick={spin}
        disabled={spinning}
        className="mt-5 rounded-2xl bg-brand-600 px-8 py-4 text-2xl font-bold text-white shadow-lg transition-all hover:bg-brand-700 active:scale-95 disabled:opacity-60"
      >
        🎲 Pick one
      </button>
    </div>
  );
}

/** A real drawing area for the board — finger or mouse. */
function DrawPad({
  examples,
  removeExample,
}: {
  examples: string[];
  removeExample?: (index: number, draft: LessonActivityPack) => void;
}) {
  const editor = useEditor();
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [colour, setColour] = useState("#12140f");
  const COLOURS = ["#12140f", "#f7b917", "#27829e", "#c1523f"];

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = ref.current!;
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
  };
  const ctxOf = () => {
    const c = ref.current!.getContext("2d")!;
    c.lineWidth = 8;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = colour;
    return c;
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-end gap-3">
        {COLOURS.map((c) => (
          <button
            key={c}
            onClick={() => setColour(c)}
            aria-label={`Draw in ${c}`}
            style={{ background: c }}
            className={`h-12 w-12 rounded-full border-4 border-white transition-all ${
              colour === c ? "ring-4 ring-brand-600" : "ring-2 ring-silver"
            }`}
          />
        ))}
        <button
          onClick={() => {
            const cv = ref.current!;
            cv.getContext("2d")!.clearRect(0, 0, cv.width, cv.height);
          }}
          className="rounded-xl bg-white px-5 py-3 text-lg font-bold text-brand-700 ring-2 ring-silver hover:ring-brand-300"
        >
          Clear
        </button>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] items-start gap-5">
        <canvas
          ref={ref}
          width={820}
          height={330}
          className="w-full touch-none rounded-[1.6rem] border-4 border-silver bg-white"
          onPointerDown={(e) => {
            drawing.current = true;
            const c = ctxOf();
            const p = at(e);
            c.beginPath();
            c.moveTo(p.x, p.y);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const c = ctxOf();
            const p = at(e);
            c.lineTo(p.x, p.y);
            c.stroke();
          }}
          onPointerUp={() => { drawing.current = false; }}
        />
        {examples.length > 0 && (
          <div className="grid gap-2">
            {examples.slice(0, 4).map((ex, i) => (
              <div
                key={i}
                className="relative rounded-2xl border-4 border-silver bg-white px-4 py-2 text-center"
              >
                {editor?.on && removeExample && (
                  <button
                    onClick={() => editor.edit((d) => removeExample(i, d))}
                    title="Remove this picture"
                    aria-label="Remove this picture"
                    className="absolute -right-2.5 -top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 active:scale-90"
                  >
                    <Icon d={I.close} className="h-4 w-4" />
                  </button>
                )}
                <span className="text-5xl leading-tight">{ex}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Deck layouts ─────────────────────────────────────────────────────────
   These ARE the teaching deck's designs. A week's own fields and a Slide
   Studio slide both render through them, so the class never sees two
   different-looking presentations — there is one design, used twice. */

/** The deck's numbered step spine: chips threaded on a line down the left.
 *  This is how the deck shows any list of things to do or notice. */
function StepSpine({ steps, accent = "leaf" }: { steps: string[]; accent?: "leaf" | "teal" }) {
  // A long list plus anything else is a lot of slide; step down the type
  // scale so the whole thing stays on screen without scrolling.
  const dense = steps.length >= 4;
  const chip = accent === "teal" ? "bg-teal" : "bg-leaf";
  const line = accent === "teal" ? "bg-teal/25" : "bg-leaf/25";
  return (
    <ol className="anim-stagger relative mt-7 space-y-3 pl-3">
      <span className={`absolute bottom-6 left-[2.15rem] top-6 w-1 rounded-full ${line}`} />
      {steps.map((st, i) => (
        <li
          key={i}
          style={{ "--i": i } as React.CSSProperties}
          className="relative flex items-center gap-5"
        >
          <span
            className={`relative z-10 grid shrink-0 place-items-center rounded-full ${chip} font-bold text-white shadow-lg ring-4 ring-white ${
              dense ? "h-12 w-12 text-xl" : "h-14 w-14 text-2xl"
            }`}
          >
            {i + 1}
          </span>
          <span
            className={`flex-1 rounded-2xl bg-brand-50/70 px-5 leading-snug text-zinc-700 ${
              dense ? "py-3 text-xl" : "py-4 text-2xl"
            }`}
          >
            {st}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The deck's activity card — leaf pill, big task name, step spine, timer.
 *  Used for the week's activities and for studio activity slides alike. */
function ActivitySlide({
  index,
  total,
  head,
  body,
  steps,
  needs,
  image,
}: {
  index: number;
  total: number;
  head: string;
  body?: string;
  steps: string[];
  needs?: string;
  image?: string;
}) {
  return (
    <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
      {/* Header band — name of the task, big and confident */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-leaf px-5 py-2 text-lg font-bold text-white">
            <Icon d={I.grid} className="h-5 w-5" />
            Activity {index} of {total}
          </span>
          <h2 className="mt-4 text-[3rem] font-bold leading-[1.02] text-ink">{head}</h2>
          {body && <p className="mt-2 text-2xl leading-snug text-zinc-500">{body}</p>}
        </div>
        <div className="shrink-0 rounded-3xl bg-brand-50/60 p-4">
          <TeachTimer minutes={10} compact />
        </div>
      </div>

      {steps.length > 0 && <StepSpine steps={steps} />}

      {image && (
        <img
          src={image}
          alt=""
          className="mx-auto mt-6 max-h-[320px] rounded-[1.5rem] object-cover shadow-lg"
        />
      )}

      {needs && (
        <p className="mt-6 rounded-2xl bg-sun-soft/70 px-6 py-3 text-center text-lg text-zinc-700">
          <span className="font-bold text-brand-700">You need:</span> {needs}
        </p>
      )}
    </div>
  );
}

/** The deck's teaching card — teal pill, big heading, step spine, picture.
 *  What a Slide Studio content slide becomes: the same furniture as the rest
 *  of the deck, never a bulleted slide. */
function TeachSlideCard({
  label,
  head,
  lead,
  points,
  image,
}: {
  label: string;
  head: string;
  lead?: string;
  points: string[];
  image?: string;
}) {
  const sideBySide = Boolean(image) && points.length > 0;
  return (
    <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
      <span className="inline-flex items-center gap-2.5 rounded-full bg-teal px-5 py-2 text-lg font-bold text-white">
        <Icon d={I.book} className="h-5 w-5" />
        {label}
      </span>
      <h2 className="mt-4 text-[3rem] font-bold leading-[1.02] text-ink">{head}</h2>
      {lead && <p className="mt-2 text-2xl leading-snug text-zinc-500">{lead}</p>}
      <div className={sideBySide ? "grid grid-cols-[1.35fr_1fr] items-start gap-7" : ""}>
        {points.length > 0 && <StepSpine steps={points} accent="teal" />}
        {image && (
          <img
            src={image}
            alt=""
            className={`w-full rounded-[1.5rem] object-cover shadow-lg ${
              sideBySide ? "mt-7 max-h-[430px]" : "mx-auto mt-7 max-h-[500px] max-w-3xl"
            }`}
          />
        )}
      </div>
    </div>
  );
}

/** A studio slide rendered in whichever deck layout suits its role. */
function StudioSlideView({
  s,
  index,
  total,
}: {
  s: SlideContent;
  /** Position in the combined activity run — activity slides only. */
  index?: number;
  total?: number;
}) {
  const points = (s.content || []).map((b) => String(b).trim()).filter(Boolean);
  const image = s.imageUrl || s.images?.find((i) => i.url)?.url || "";
  const lead = s.description?.trim() || undefined;

  if (s.type === "activity") {
    return (
      <ActivitySlide
        index={index || 1}
        total={total || 1}
        head={s.title}
        body={lead}
        steps={points}
        image={image}
      />
    );
  }

  // Objectives become the deck's goal board — the class ticks them off.
  if (s.type === "objective" && points.length > 0) {
    return (
      <div className="anim-pop grid grid-cols-[0.95fr_1.15fr] gap-7">
        <div className="flex flex-col justify-center rounded-[2rem] bg-white p-9 shadow-2xl">
          <span className="inline-flex w-fit items-center gap-2.5 rounded-full bg-teal px-5 py-2 text-lg font-bold text-white">
            <Icon d={I.book} className="h-5 w-5" />
            Today
          </span>
          <h2 className="mt-6 text-[2.9rem] font-bold leading-[1.05] text-ink">{s.title}</h2>
          {lead && <p className="mt-4 text-2xl leading-snug text-zinc-600">{lead}</p>}
        </div>
        <div className="rounded-[2rem] bg-white/95 p-8 shadow-2xl">
          <p className="text-xl font-bold text-teal">We&rsquo;ll know we&rsquo;ve done it when&hellip;</p>
          <p className="mt-1 text-base font-medium text-zinc-400">tap each one as we get there</p>
          <div className="mt-5">
            <TeachChecklist items={points} />
          </div>
        </div>
      </div>
    );
  }

  // Assessment questions become tap-to-reveal cards, like the exit ticket.
  if (s.type === "assessment" && points.length > 0) {
    return (
      <div className="anim-pop">
        <div className="text-center">
          <h2 className="text-[3.4rem] font-bold leading-none text-brand-900">{s.title}</h2>
          {lead && <p className="mx-auto mt-4 max-w-3xl text-2xl text-brand-900/70">{lead}</p>}
        </div>
        <div className="mx-auto mt-8 max-w-[940px]">
          <TeachReveal items={points} />
        </div>
      </div>
    );
  }

  return (
    <TeachSlideCard label="Let's learn" head={s.title} lead={lead} points={points} image={image} />
  );
}

/** Where each studio slide belongs in the teaching sequence. */
function studioTone(t: SlideContent["type"]): Tone {
  if (t === "activity") return "activity";
  if (t === "assessment") return "check";
  return "learn";
}

/* ── Building the week's deck ─────────────────────────────────────────── */

/** Build the ready-to-teach slide sequence for one week of a lesson plan.
 *
 *  `studio` are the Slide Studio slides. They are woven into this one deck by
 *  role rather than projected separately — teach slides after the learning
 *  goals, activity slides among the week's activities, assessment slides just
 *  before the class checks in — so there is only ever one thing on the board. */
export function buildWeekSlides(
  plan: LessonPlan,
  w: WeeklyPlan,
  studio: SlideContent[] = [],
  pack?: LessonActivityPack,
): TeachSlide[] {
  // The deck opens with its own title slide, so a leading studio title slide
  // would be the same curtain going up twice.
  const usable = studio.filter(
    (s, i) => s && (s.title?.trim() || s.content?.length) && !(i === 0 && s.type === "title"),
  );
  const studioOf = (types: SlideContent["type"][]) => usable.filter((s) => types.includes(s.type));
  const teachSlides = studioOf(["title", "content", "objective"]);
  const studioActivities = studioOf(["activity"]);
  const studioAssessment = studioOf(["assessment"]);

  // The week's activities and the studio's are one run of activities to the
  // class, so they are numbered as one — "Activity 3 of 4", not a fresh count.
  const weekActivityCount = splitActivities(w.activities).length;
  const activityTotal = weekActivityCount + studioActivities.length;

  const asDeck = (list: SlideContent[], label: string): TeachSlide[] =>
    list.map((s, i) => ({
      kicker: list.length > 1 ? `${label} ${i + 1} of ${list.length}` : label,
      tone: studioTone(s.type),
      content: <StudioSlideView s={s} />,
    }));

  return buildSequence(plan, w, {
    teach: asDeck(teachSlides, "Teaching"),
    activities: studioActivities.map((s, i) => ({
      kicker: `Activity ${weekActivityCount + i + 1} of ${activityTotal}`,
      tone: studioTone(s.type),
      content: (
        <StudioSlideView s={s} index={weekActivityCount + i + 1} total={activityTotal} />
      ),
    })),
    assessment: asDeck(studioAssessment, "Assessment"),
    activityTotal,
    // Only use a quiz that was built for THIS week — switching weeks must not
    // project the previous week's questions.
    pack: pack && pack.week === w.week ? pack : undefined,
  });
}

function buildSequence(
  plan: LessonPlan,
  w: WeeklyPlan,
  studio: {
    teach: TeachSlide[];
    activities: TeachSlide[];
    assessment: TeachSlide[];
    /** Week activities plus studio activities — they share one numbering. */
    activityTotal: number;
    pack?: LessonActivityPack;
  },
): TeachSlide[] {
  // What the lesson is about. Most specific field first, and never the school
  // subject — "Life Competencies" is a timetable label, not a thing to teach.
  const unitTopic = (w.unit || "")
    .replace(/^\s*(unit|chapter|module|topic)\s*\d+\s*[-–—:.]?\s*/i, "")
    .trim();
  const focus =
    meaningful(w.subTopic, w.topic, plan.overallTopic, unitTopic, w.learningObjective) ||
    w.topic?.trim() ||
    `Week ${w.week}`;
  // What to put after "What do you know about ___?" — never a section label
  // and never the subject.
  const namedThing = meaningful(w.subTopic, w.topic, plan.overallTopic, unitTopic);
  const activities = splitActivities(w.activities);
  const criteria = splitLines(plan.successCriteria).length
    ? splitLines(plan.successCriteria)
    : splitLines(w.learningObjective);
  const competencies = splitLines(plan.keyCompetencies).slice(0, 3);
  // A plan may leave the introduction blank — open on the week's own focus
  // rather than projecting an empty slide.
  // How old is this class? It decides the wording of everything the deck
  // writes for itself, so a Year 1 room never gets Year 9 sentences.
  const year = yearNumberOf(plan.class);
  const young = year !== null && year <= 2;
  const doNow =
    w.introduction?.trim() ||
    (young
      ? `Today we are learning about ${focus}. Tell your partner one thing you know.`
      : `Think about today's topic — "${focus}". Tell your partner one thing you already know, or one thing you'd like to find out.`);
  const slides: TeachSlide[] = [];

  // 1 · Title — full-bleed colour, no card, so it feels like a curtain going up
  slides.push({
    kicker: [plan.subject, plan.class, plan.term && `Term ${plan.term}`.replace(/Term Term/i, "Term")]
      .filter(Boolean)
      .join(" · "),
    tone: "start",
    content: (
      <div className="anim-pop mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center rounded-full bg-sunny px-7 py-3 text-2xl font-bold text-brand-900 shadow-lg">
          Week {w.week}
        </span>
        <h2 className="mt-8 text-5xl font-bold leading-[1.05] text-white sm:text-7xl">{focus}</h2>
        {/* Only show the unit line when it says something the title didn't —
            otherwise the same words appear twice, one above the other. */}
        {(() => {
          const sub = [w.unit?.trim(), plan.overallTopic?.trim()]
            .filter((x): x is string => Boolean(x) && x !== focus)
            .filter((x, i, a) => a.indexOf(x) === i)
            .join(" · ");
          return sub ? (
            <p className="mt-6 text-2xl font-medium text-white/70 sm:text-3xl">{sub}</p>
          ) : null;
        })()}
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          {competencies.map((c) => (
            <TeachBadge key={c} icon={I.star} label={c} />
          ))}
          {w.strand?.trim() && <TeachBadge icon={I.check} label={w.strand.trim()} />}
        </div>
      </div>
    ),
  });

  // 2 · Do Now — a sticky note pinned to the board, timer alongside
  slides.push({
    kicker: "Let's begin",
    tone: "donow",
    content: (
      <div className="anim-pop grid grid-cols-[1.45fr_1fr] items-stretch gap-7">
        <div className="tilt-a relative rounded-[2rem] bg-white p-10 shadow-2xl">
          {/* folded corner */}
          <span className="absolute right-0 top-0 h-14 w-14 rounded-bl-[2rem] rounded-tr-[2rem] bg-sun-soft" />
          <TeachBadge icon={I.clock} label="Do now" />
          <p className="mt-7 text-[2.6rem] font-semibold leading-[1.2] text-ink">{doNow}</p>
        </div>
        <div className="tilt-b flex flex-col items-center justify-center rounded-[2rem] bg-white/95 p-7 shadow-2xl">
          <p className="mb-5 text-xl font-bold uppercase tracking-wider text-brand-600">
            Talk time
          </p>
          <TeachTimer minutes={3} />
        </div>
      </div>
    ),
  });

  // 3 · Our learning — goal board: objective on the left, criteria ladder right
  slides.push({
    kicker: "Our learning today",
    tone: "learn",
    content: (
      <div
        className={`anim-pop grid gap-7 ${criteria.length ? "grid-cols-[0.95fr_1.15fr]" : "grid-cols-1"}`}
      >
        <div className="flex flex-col justify-center rounded-[2rem] bg-white p-9 shadow-2xl">
          <span className="inline-flex w-fit items-center gap-2.5 rounded-full bg-teal px-5 py-2 text-lg font-bold text-white">
            <Icon d={I.book} className="h-5 w-5" />
            Today
          </span>
          <h2 className="mt-6 text-[2.9rem] font-bold leading-[1.05] text-ink">
            What we&rsquo;re learning
          </h2>
          <p className="mt-4 text-2xl leading-snug text-zinc-600">
            {w.learningObjective?.trim() || focus}
          </p>
        </div>
        {criteria.length > 0 && (
          <div className="rounded-[2rem] bg-white/95 p-8 shadow-2xl">
            <p className="text-xl font-bold text-teal">
              We&rsquo;ll know we&rsquo;ve done it when&hellip;
            </p>
            <p className="mt-1 text-base font-medium text-zinc-400">tap each one as we get there</p>
            <div className="mt-5">
              <TeachChecklist items={criteria} />
            </div>
          </div>
        )}
      </div>
    ),
  });

  // 3a · The idea said once, plainly, with the things it is made of.
  const pack = studio.pack;
  if (pack?.bigIdea || pack?.keyIdeas?.length) {
    slides.push({
      kicker: pack?.bigIdea?.title || "What we are learning",
      tone: "learn",
      content: (
        <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-teal px-5 py-2 text-lg font-bold text-white">
            <Icon d={I.book} className="h-5 w-5" />
            Let&rsquo;s learn
          </span>
          <Ed
            as="h2"
            className="mt-4 block text-[3rem] font-bold leading-[1.02] text-ink"
            value={pack?.bigIdea?.title || focus}
            apply={(d, t) => {
              d.bigIdea = { title: t, explain: d.bigIdea?.explain || "" };
            }}
          />
          {pack?.bigIdea?.explain && (
            <Ed
              as="p"
              className="mt-3 block text-[2.4rem] font-semibold leading-snug text-zinc-600"
              value={pack.bigIdea.explain}
              apply={(d, t) => {
                if (d.bigIdea) d.bigIdea.explain = t;
              }}
            />
          )}
          <div className="mt-6 flex justify-center">
            <Picture
              url={pack?.bigIdea?.image}
              size="14rem"
              apply={(d, next) => {
                d.bigIdea = {
                  title: d.bigIdea?.title || "",
                  explain: d.bigIdea?.explain || "",
                  image: next,
                };
              }}
            />
          </div>
          {/* The tiles are only worth showing here when each one does NOT get
              its own teaching slide next — otherwise it is the same row of
              pictures twice in a row. They come back at review time. */}
          {pack?.keyIdeas?.length && !pack?.teach?.length ? (
            <TileRow tiles={pack.keyIdeas.slice(0, 5)} big
              editLabel={(i, t, d) => {
                if (d.keyIdeas?.[i]) d.keyIdeas[i].label = t;
              }}
              editTile={(i, img, d) => {
                if (d.keyIdeas?.[i]) d.keyIdeas[i].image = img;
              }}
              removeTile={(i, d) => {
                d.keyIdeas = (d.keyIdeas || []).filter((_, n) => n !== i);
              }}
            />
          ) : null}
        </div>
      ),
    });
  }

  // 3a-ii · THE TEACHING. One slide per concept: a big picture, the point in
  // the child's own words, what to do about it, and a question back to the
  // class. This is what makes the deck teachable straight off the board.
  (pack?.teach || []).forEach((p, ti) => {
    slides.push({
      kicker: p.title,
      tone: "learn",
      content: (
        <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
          <div className="grid grid-cols-[auto_1fr] items-center gap-9">
            <Picture
              url={p.image}
              emoji={p.emoji}
              apply={(d, next) => {
                if (d.teach?.[ti]) d.teach[ti].image = next;
              }}
            />
            <div className="min-w-0">
              <Ed
                as="h2"
                className="block text-[3.2rem] font-bold leading-[1.02] text-ink"
                value={p.title}
                apply={(d, t) => {
                  if (d.teach?.[ti]) d.teach[ti].title = t;
                }}
              />
              <div className="anim-stagger mt-4 grid gap-3">
                {p.lines.map((l, i) => (
                  <div key={i} style={{ "--i": i } as React.CSSProperties}>
                    <Ed
                      as="p"
                      multiline
                      className="block rounded-[1.4rem] bg-sun-soft px-6 py-4 text-[1.9rem] font-semibold leading-snug text-brand-900"
                      value={l}
                      apply={(d, t) => {
                        if (d.teach?.[ti]) d.teach[ti].lines[i] = t;
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {p.tiles && p.tiles.length > 0 && (
            <TileRow
              tiles={p.tiles}
              editLabel={(i, t, d) => {
                const tiles = d.teach?.[ti]?.tiles;
                if (tiles?.[i]) tiles[i].label = t;
              }}
              editTile={(i, img, d) => {
                const tiles = d.teach?.[ti]?.tiles;
                if (tiles?.[i]) tiles[i].image = img;
              }}
              removeTile={(i, d) => {
                const point = d.teach?.[ti];
                if (point?.tiles) point.tiles = point.tiles.filter((_, n) => n !== i);
              }}
            />
          )}
          {p.ask && (
            <p className="mt-6 text-center">
              <span className="inline-flex items-center gap-3 rounded-full bg-sunny px-8 py-4 text-[1.9rem] font-bold text-brand-900">
                🙋{" "}
                <Ed
                  value={p.ask}
                  apply={(d, t) => {
                    if (d.teach?.[ti]) d.teach[ti].ask = t;
                  }}
                />
              </span>
            </p>
          )}
        </div>
      ),
    });
  });

  // 3a-iii · How it changes — only when the topic actually has an order.
  if (pack?.sequence?.steps?.length) {
    slides.push({
      kicker: pack.sequence.title,
      tone: "start",
      content: (
        <div className="anim-pop text-center">
          <h2 className="text-[3.4rem] font-bold leading-none text-white">{pack.sequence.title}</h2>
          <div className="mt-8 flex items-center justify-center gap-6">
            {pack.sequence.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-6">
                {i > 0 && <span className="text-5xl text-white/80">→</span>}
                <div className="w-[15rem] rounded-[2rem] border-4 border-silver bg-white p-5">
                  <span className="block text-7xl leading-tight">{s.emoji}</span>
                  <span className="mt-2 block text-2xl font-bold text-ink">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
          {pack.sequence.line && (
            <p className="mt-8 text-3xl font-medium text-white/85">{pack.sequence.line}</p>
          )}
        </div>
      ),
    });
  }

  // 3b · Slide Studio's own slides, but ONLY when the pack has no teaching
  // slides of its own. With both, the class sees the same content twice —
  // once as a proper teaching slide and again as a bullet list.
  if (!pack?.teach?.length) slides.push(...studio.teach);

  // 3c · Talk it over — open questions about what was just taught. Prompts
  // come from the plan; the deck falls back to the week's own essential
  // questions and objective so there is always something to discuss.
  // Prompts written from this week's plan by the AI are always preferred —
  // they name the actual content. What follows is only the safety net for
  // when none were generated, and it still reaches for the teacher's own
  // words (their essential questions, their do-now, their first activity)
  // before falling back to anything generic.
  // Things one child says TO another, not questions about the lesson. The
  // point of this slide is that they turn to a real person and ask.
  const discussion = (
    studio.pack?.discussion?.length
      ? studio.pack.discussion
      : young
        ? [
            "How are you feeling today?",
            "Are you okay?",
            namedThing && `Tell me what you like about ${namedThing}.`,
            "What made you smile today?",
          ].filter(Boolean as unknown as (v: unknown) => v is string)
        : [
            "How are you feeling today?",
            "Are you okay? Is there anything you want to talk about?",
            namedThing && `What do you think about ${namedThing}?`,
            "What would you like to get better at?",
          ].filter(Boolean as unknown as (v: unknown) => v is string)
  ).slice(0, 3);

  slides.push({
    kicker: "Ask your partner",
    tone: "share",
    content: (
      <div className="anim-pop">
        <div className="text-center">
          <h2 className="text-[3.4rem] font-bold leading-none text-white">
            Turn to your partner 🗣️
          </h2>
          <p className="mt-4 text-2xl text-white/80">
            Tap a question and ask them. Listen to their answer, then swap over.
          </p>
        </div>
        <div className="mx-auto mt-8 grid max-w-[980px] grid-cols-[1.5fr_1fr] items-start gap-7">
          <TeachReveal
            items={discussion}
            tilted
            label="question"
            editItem={(i, t, d) => {
              d.discussion = [...(d.discussion || [])];
              d.discussion[i] = t;
            }}
          />
          <div className="rounded-[2rem] bg-white/95 p-6 shadow-2xl">
            <p className="mb-4 text-center text-lg font-bold uppercase tracking-wider text-brand-600">
              Talk time
            </p>
            <TeachTimer minutes={3} compact />
          </div>
        </div>
      </div>
    ),
  });

  // 3d · Story time, then what the story showed us. A story carries an idea
  // further than an explanation does at primary age.
  if (pack?.story?.scenes?.length) {
    slides.push({
      kicker: "Story time",
      tone: "share",
      content: (
        <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-sky px-5 py-2 text-lg font-bold text-white">
            📖 Story time
          </span>
          <h2 className="mt-4 text-[3rem] font-bold leading-[1.02] text-ink">{pack.story.title}</h2>
          <StoryScenes
            scenes={pack.story.scenes}
            removeScene={(i, d) => {
              if (d.story) d.story.scenes = d.story.scenes.filter((_, n) => n !== i);
            }}
          />
        </div>
      ),
    });
    if (pack.story.questions.length) {
      slides.push({
        kicker: "Think about the story",
        tone: "learn",
        content: (
          <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
            <span className="inline-flex items-center gap-2.5 rounded-full bg-teal px-5 py-2 text-lg font-bold text-white">
              💭 Think about it
            </span>
            <h2 className="mt-4 text-[3rem] font-bold leading-[1.02] text-ink">
              Let&rsquo;s think about the story
            </h2>
            <div className="mt-6">
              <TeachReveal
                items={pack.story.questions.map((x) => `${x.q}  →  ${x.a}`)}
                label="question"
                editItem={(i, t, d) => {
                  // Kept as one editable line: "question → answer".
                  const [q, a2] = t.split("→");
                  const target = d.story?.questions?.[i];
                  if (target) {
                    target.q = (q || "").trim();
                    target.a = (a2 || "").trim();
                  }
                }}
              />
            </div>
          </div>
        ),
      });
    }
  }

  // 4 · The week's own activities, one slide each. Skipped entirely when the
  // pack has real student activities, because the plan's wording is written
  // for the teacher ("Visual aids", "Role-playing") and the class already
  // gets the doing version of the same thing a few slides later.
  const hasStudentActivities = Boolean(
    pack?.actOut?.items?.length || pack?.draw || pack?.matching?.pairs?.length,
  );
  (hasStudentActivities ? [] : activities).forEach((raw, idx) => {
    const { title, steps } = stepsFromActivity(raw);
    const { head, body } = activityHeading(title);
    const total = studio.activityTotal || activities.length;
    slides.push({
      kicker: `Activity ${idx + 1} of ${total}`,
      tone: "activity",
      content: (
        <ActivitySlide
          index={idx + 1}
          total={total}
          head={head}
          body={body}
          steps={steps}
          needs={w.resources?.trim()}
        />
      ),
    });
  });

  // 4b · Studio activity slides run alongside the week's own activities.
  slides.push(...studio.activities);

  // 4c · Get them out of their seats: act it out, draw it, match it.
  if (pack?.actOut?.items?.length) {
    slides.push({
      kicker: "Act it out",
      tone: "activity",
      content: (
        <div className="anim-pop rounded-[2.5rem] bg-white p-9 text-center shadow-2xl">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-leaf px-5 py-2 text-lg font-bold text-white">
            🎭 Act it out
          </span>
          <h2 className="mt-4 text-[3rem] font-bold leading-[1.02] text-ink">{pack.actOut.title}</h2>
          {pack.actOut.steps.length > 0 && (
            <div
              className="anim-stagger mt-6 grid gap-4 text-left"
              style={{ gridTemplateColumns: `repeat(${Math.min(pack.actOut.steps.length, 3)}, minmax(0,1fr))` }}
            >
              {pack.actOut.steps.slice(0, 3).map((s, i) => (
                <div
                  key={i}
                  style={{ "--i": i } as React.CSSProperties}
                  className="flex items-center gap-4 rounded-2xl bg-brand-50 px-5 py-4"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-leaf text-xl font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-xl leading-snug text-zinc-700">{s}</span>
                </div>
              ))}
            </div>
          )}
          <ActSpinner
            items={pack.actOut.items}
            removeItem={(i, d) => {
              if (d.actOut) d.actOut.items = d.actOut.items.filter((_, n) => n !== i);
            }}
          />
        </div>
      ),
    });
  }

  if (pack?.draw) {
    slides.push({
      kicker: "Draw it",
      tone: "activity",
      content: (
        <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-leaf px-5 py-2 text-lg font-bold text-white">
            ✏️ Draw
          </span>
          <h2 className="mt-4 text-[2.8rem] font-bold leading-[1.02] text-ink">{pack.draw.title}</h2>
          <p className="mt-2 text-2xl leading-snug text-zinc-500">{pack.draw.instruction}</p>
          <DrawPad
            examples={pack.draw.examples || []}
            removeExample={(i, d) => {
              if (d.draw) d.draw.examples = (d.draw.examples || []).filter((_, n) => n !== i);
            }}
          />
        </div>
      ),
    });
  }

  if (pack?.matching?.pairs?.length) {
    slides.push({
      kicker: "Match it",
      tone: "check",
      content: (
        <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-sunny px-5 py-2 text-lg font-bold text-brand-900">
            🧩 Match it
          </span>
          <h2 className="mt-4 text-[2.8rem] font-bold leading-[1.02] text-ink">
            {pack.matching.title}
          </h2>
          <p className="mt-2 text-2xl leading-snug text-zinc-500">{pack.matching.instruction}</p>
          <MatchGame
            pairs={pack.matching.pairs}
            removePair={(label, d) => {
              if (d.matching) {
                d.matching.pairs = d.matching.pairs.filter((x) => x.label !== label);
              }
            }}
          />
        </div>
      ),
    });
  }

  // Share-back used to sit here with a register-number picker. Removed: it is
  // classroom management, not something a child learns from, and the deck is
  // for the children now. The same goes for the studio's assessment slides —
  // the mini quiz below covers checking, without repeating it in prose.

  // 5c · Mini quiz — one question per slide, tap to answer, marked on the
  // board. Built from this week of the plan, so it only asks about the lesson
  // that was actually taught.
  (studio.pack?.questions || []).forEach((q, idx, all) => {
    slides.push({
      kicker: `Mini quiz · ${idx + 1} of ${all.length}`,
      tone: "check",
      content: <QuizCard q={q} index={idx + 1} total={all.length} qi={idx} />,
    });
  });

  // 5d · What to DO with what they have learned — the transfer slide.
  if (pack?.strategies?.items?.length) {
    slides.push({
      kicker: "What can we do?",
      tone: "learn",
      content: (
        <div className="anim-pop rounded-[2.5rem] bg-white p-9 shadow-2xl">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-teal px-5 py-2 text-lg font-bold text-white">
            💪 Try it
          </span>
          <h2 className="mt-4 text-[3rem] font-bold leading-[1.02] text-ink">
            {pack.strategies.title}
          </h2>
          <TileRow
            tiles={pack.strategies.items.slice(0, 4)}
            editLabel={(i, t, d) => {
              const item = d.strategies?.items?.[i];
              if (item) item.label = t;
            }}
            editTile={(i, img, d) => {
              const item = d.strategies?.items?.[i];
              if (item) item.image = img;
            }}
            removeTile={(i, d) => {
              if (d.strategies) {
                d.strategies.items = d.strategies.items.filter((_, n) => n !== i);
              }
            }}
          />
          <p className="mt-6 text-center text-xl font-bold text-zinc-400">
            Let&rsquo;s practise one together
          </p>
        </div>
      ),
    });
  }

  // 5e · Recall, out loud, before the confidence check.
  if (pack?.review?.length) {
    slides.push({
      kicker: "Let's remember",
      tone: "check",
      content: (
        <div className="anim-pop">
          <div className="text-center">
            <h2 className="text-[3.4rem] font-bold leading-none text-brand-900">
              Let&rsquo;s remember 🌟
            </h2>
          </div>
          {pack.keyIdeas?.length ? (
            <div className="mx-auto max-w-[1000px]">
              <TileRow tiles={pack.keyIdeas.slice(0, 5)}
              editLabel={(i, t, d) => {
                if (d.keyIdeas?.[i]) d.keyIdeas[i].label = t;
              }}
              editTile={(i, img, d) => {
                if (d.keyIdeas?.[i]) d.keyIdeas[i].image = img;
              }}
              removeTile={(i, d) => {
                d.keyIdeas = (d.keyIdeas || []).filter((_, n) => n !== i);
              }}
            />
            </div>
          ) : null}
          <div
            className="anim-stagger mx-auto mt-6 grid max-w-[1000px] gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(pack.review.length, 3)}, minmax(0,1fr))` }}
          >
            {pack.review.slice(0, 3).map((q, i) => (
              <div key={i} style={{ "--i": i } as React.CSSProperties}>
                <Ed
                  as="p"
                  multiline
                  className="block rounded-[1.6rem] bg-white px-6 py-5 text-center text-2xl font-bold leading-snug text-brand-900 shadow-lg"
                  value={q}
                  apply={(d, t) => {
                    d.review = [...(d.review || [])];
                    d.review[i] = t;
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // The confidence poll used to sit here. Removed: the mini quiz already
  // checks understanding and the exit ticket already asks how they feel, so
  // it was the third "how did that go?" slide in a row.

  // 7 · Reflection / exit ticket
  slides.push({
    kicker: "Before we go",
    tone: "reflect",
    content: (
      <div className="anim-pop">
        <div className="text-center">
          <h2 className="text-[3.4rem] font-bold leading-none text-white">Before we go&hellip;</h2>
          <p className="mt-4 text-2xl text-white/80">
            Finish one of these sentences out loud or in your journal.
          </p>
        </div>
        {/* Sentence strips, each tilted a little like paper on a desk.
            Kept narrower than the canvas so the rotation has room — a rotated
            full-width strip would poke past the slide edges. */}
        <div className="mx-auto mt-9 max-w-[940px]">
          <TeachReveal
            tilted
            items={
              young
                ? ["Today I learned…", "I liked…", "Next time I want to try…"]
                : [
                    "Today I learned…",
                    "Something I found tricky was… and I kept going by…",
                    competencies[0]
                      ? `I showed ${competencies[0]} today when I…`
                      : `One thing I want to get better at is…`,
                  ]
            }
            label="sentence"
          />
        </div>
      </div>
    ),
  });

  // 7b · End on a win — the children see what they can now do.
  if (pack?.celebrate) {
    slides.push({
      kicker: "Well done",
      tone: "start",
      content: (
        <div className="anim-pop text-center">
          <span className="block text-[8rem] leading-none">🌟</span>
          <Ed
            as="h2"
            className="mt-4 block text-[4rem] font-bold leading-none text-white"
            value={pack.celebrate.title}
            apply={(d, t) => {
              if (d.celebrate) d.celebrate.title = t;
            }}
          />
          <Ed
            as="p"
            multiline
            className="mx-auto mt-6 block max-w-4xl text-3xl leading-snug text-white/85"
            value={pack.celebrate.line}
            apply={(d, t) => {
              if (d.celebrate) d.celebrate.line = t;
            }}
          />
        </div>
      ),
    });
  }

  // The teacher-notes slide used to sit here. Removed: this deck is projected
  // to the class, and a slide headed "not for projecting" has no business in
  // it. The week's resources and attachments stay on the lesson plan, where
  // the teacher already reads them.
  return slides;
}

/** Full-screen, ready-to-project deck for one week. */
export default function TeachingDeck({
  plan,
  week,
  studioSlides = [],
  pack,
  onPackChange,
  onUploadImage,
  onClose,
}: {
  plan: LessonPlan;
  week: WeeklyPlan;
  /** Slide Studio's slides, folded into this deck so only one thing projects. */
  studioSlides?: SlideContent[];
  /** The class-facing activities built from this week of the plan. */
  pack?: LessonActivityPack;
  /** Supply this to make the lesson editable on the board. */
  onPackChange?: (next: LessonActivityPack) => void;
  /** Supply this to allow pictures to be added to slides while editing. */
  onUploadImage?: (file: File) => Promise<string>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  /* ── The lesson in Mandarin ──────────────────────────────────────────
     A Mandarin class plans in English and teaches in Chinese, so the board
     needs the same lesson in the other language — not a different lesson.
     The deck is rebuilt from a translated copy of what it was already built
     from (the plan header, this week, the pack and any Studio slides), which
     is why the slides, their order and their pictures come out identical.

     The copy is kept, so flipping back and forth costs one translation. */
  const [zh, setZh] = useState(false);
  const [zhSource, setZhSource] = useState<{
    plan: LessonPlan;
    week: WeeklyPlan;
    pack?: LessonActivityPack;
    studioSlides: SlideContent[];
  } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  // A newly generated pack or a different week is a different lesson, so the
  // translation held for the last one no longer applies.
  useEffect(() => {
    setZhSource(null);
    setZh(false);
  }, [week?.week, pack]);

  // Editing writes back to the lesson itself — the English copy — so it is
  // offered in English only. Editing a translation would either be lost on
  // the next translate or, worse, change the English behind the teacher's back.
  const canEdit = Boolean(pack && onPackChange && !zh);
  const editor = useMemo<DeckEditor | null>(
    () =>
      canEdit
        ? {
            on: editing,
            upload: onUploadImage,
            edit: (mutate) => {
              // Work on a copy so React sees a new object and re-renders; the
              // pack is small and plain, so a structured clone is cheapest.
              const draft: LessonActivityPack = JSON.parse(JSON.stringify(pack));
              mutate(draft);
              onPackChange!(draft);
            },
          }
        : null,
    [canEdit, editing, pack, onPackChange, onUploadImage],
  );
  const toggleMandarin = async () => {
    if (translating) return;
    setTranslateError(null);
    if (zhSource) {
      setEditing(false);
      setZh((v) => !v);
      return;
    }
    setEditing(false);
    setTranslating(true);
    try {
      const translated = await translateContent(
        { plan, week, pack, studioSlides },
        "Simplified Chinese (Mandarin)",
      );
      setZhSource(translated as typeof zhSource);
      setZh(true);
    } catch (e: any) {
      setTranslateError(e?.message || "Could not translate this lesson.");
    } finally {
      setTranslating(false);
    }
  };

  const shown = zh && zhSource ? zhSource : { plan, week, pack, studioSlides };
  const slides = buildWeekSlides(
    shown.plan,
    shown.week,
    shown.studioSlides,
    shown.pack,
  );
  const n = slides.length;
  const [i, setI] = useState(0);
  const deckRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);

  /* ── Downloading the deck ──────────────────────────────────────────────
     The slides are live React, so there is nothing to serialise — each one
     is rendered off-screen at 16:9 and photographed, then the pictures are
     bound into a PDF or a PowerPoint. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [captureIdx, setCaptureIdx] = useState<number | null>(null);
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(
    null,
  );
  const captureRef = useRef<HTMLDivElement>(null);
  // The key handler is bound once; a ref is how it sees the live export state.
  const exportingRef = useRef(false);
  exportingRef.current = Boolean(exporting);

  const deckTitle = [
    plan.subject?.trim(),
    plan.class?.trim(),
    week.week ? `Week ${week.week}` : "",
    (week.subTopic || week.topic || plan.overallTopic || "").trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const runExport = async (mode: "pdf" | "pptx") => {
    if (exporting) return;
    setMenuOpen(false);
    setExporting({ done: 0, total: n });
    const shots: string[] = [];
    try {
      for (let k = 0; k < n; k++) {
        setCaptureIdx(k);
        // Let React mount the off-screen slide before reaching for it.
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );
        const el = captureRef.current;
        if (!el) continue;
        await waitForStage(el);
        shots.push(await captureSlide(el));
        setExporting({ done: k + 1, total: n });
      }
      if (!shots.length) throw new Error("Nothing was captured");
      setExporting({ done: n, total: n });
      if (mode === "pdf") await slidesToPdf(shots, deckTitle);
      else await slidesToPptx(shots, deckTitle);
    } catch (err: any) {
      console.error("Deck download failed:", err);
      alert(
        `Couldn't download the lesson — ${err?.message || "something went wrong"}. Please try again.`,
      );
    } finally {
      setCaptureIdx(null);
      setExporting(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      // A space or an arrow key while correcting text belongs to the text.
      if (el?.isContentEditable) return;
      // Arrow keys must not move the deck out from under a capture.
      if (exportingRef.current && e.key !== "Escape") {
        e.preventDefault();
        return;
      }
      if (e.key === "Escape" && !document.fullscreenElement) {
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setI((c) => Math.min(n - 1, c + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setI((c) => Math.max(0, c - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, onClose]);

  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Lock background scroll while presenting.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else deckRef.current?.requestFullscreen?.();
  };

  const s = slides[i];
  const onLight = TONE_ON_LIGHT[s.tone];
  // Each week gets its own backdrop so two weeks don't look alike.
  const pattern = DECK_PATTERNS[(week.week - 1 + DECK_PATTERNS.length) % DECK_PATTERNS.length];

  if (typeof document === "undefined") return null;

  // Portalled to <body>: this app animates `transform` on panels, which would
  // otherwise make them the containing block for `position: fixed` and trap
  // the deck inside a panel instead of filling the screen.
  return createPortal(
    <div
      ref={deckRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Teaching slides — Week ${week.week}`}
      className={`fixed inset-0 z-[100] flex flex-col font-sans transition-colors duration-500 ${TONE_BG[s.tone]}`}
    >
      {/* Top bar — sits on the tone colour */}
      <div
        className={`flex items-center justify-between gap-4 px-5 py-3.5 sm:px-8 ${
          onLight ? "text-brand-900" : "text-white"
        }`}
      >
        <p className="min-w-0 truncate text-sm font-bold uppercase tracking-wider opacity-80">
          {s.kicker}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-base font-bold opacity-70">
            {i + 1} / {n}
          </span>
          {canEdit && (
            <button
              onClick={() => setEditing((e) => !e)}
              className={`flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-bold backdrop-blur transition-all active:scale-90 ${
                editing
                  ? "bg-sunny text-brand-900"
                  : onLight
                    ? "bg-black/10 hover:bg-black/20"
                    : "bg-white/20 hover:bg-white/30"
              }`}
              title={editing ? "Finish editing" : "Edit this lesson"}
            >
              <Icon d={I.pencil} className="h-5 w-5" />
              {editing ? "Done" : "Edit"}
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              disabled={Boolean(exporting)}
              className={`grid h-11 w-11 place-items-center rounded-2xl backdrop-blur transition-all active:scale-90 disabled:opacity-60 ${
                onLight ? "bg-black/10 hover:bg-black/20" : "bg-white/20 hover:bg-white/30"
              }`}
              aria-label="Download this lesson"
              title="Download this lesson"
            >
              <Icon d={I.download} className="h-5 w-5" />
            </button>
            {menuOpen && !exporting && (
              <>
                {/* Click-away catcher, so the menu closes like a menu should. */}
                <button
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-0 cursor-default"
                />
                <div className="absolute right-0 top-full z-10 mt-2 w-64 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
                  <button
                    onClick={() => runExport("pdf")}
                    className="block w-full px-4 py-3 text-left transition-colors hover:bg-brand-50"
                  >
                    <span className="block text-sm font-bold text-ink">PDF</span>
                    <span className="block text-xs text-zinc-500">
                      One page per slide — print or share
                    </span>
                  </button>
                  <button
                    onClick={() => runExport("pptx")}
                    className="block w-full border-t border-zinc-100 px-4 py-3 text-left transition-colors hover:bg-brand-50"
                  >
                    <span className="block text-sm font-bold text-ink">
                      PowerPoint
                    </span>
                    <span className="block text-xs text-zinc-500">
                      Opens on any classroom machine
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={toggleMandarin}
            disabled={translating}
            className={`grid h-11 min-w-11 place-items-center rounded-2xl px-3 text-sm font-black backdrop-blur transition-all active:scale-90 disabled:opacity-60 ${
              zh
                ? "bg-brand-500 text-white hover:bg-brand-600"
                : onLight
                  ? "bg-black/10 hover:bg-black/20"
                  : "bg-white/20 hover:bg-white/30"
            }`}
            aria-label={zh ? "Show this lesson in English" : "Show this lesson in Mandarin"}
            title={
              translateError ||
              (translating
                ? "Translating…"
                : zh
                  ? "Back to English"
                  : "Teach this lesson in Mandarin")
            }
          >
            {translating ? "…" : zh ? "EN" : "中"}
          </button>
          <button
            onClick={toggleFs}
            className={`grid h-11 w-11 place-items-center rounded-2xl backdrop-blur transition-all active:scale-90 ${
              onLight ? "bg-black/10 hover:bg-black/20" : "bg-white/20 hover:bg-white/30"
            }`}
            aria-label={isFs ? "Exit fullscreen" : "Present fullscreen"}
            title={isFs ? "Exit fullscreen" : "Present fullscreen"}
          >
            <Icon d={I.present} className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className={`grid h-11 w-11 place-items-center rounded-2xl backdrop-blur transition-all active:scale-90 ${
              onLight ? "bg-black/10 hover:bg-black/20" : "bg-white/20 hover:bg-white/30"
            }`}
            aria-label="Close teaching slides"
            title="Close (Esc)"
          >
            <Icon d={I.close} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Slide stage — the week's backdrop over the tone colour. Content is
          scaled to fit, so nothing ever scrolls. */}
      <div
        className={`relative deck-glow ${pattern} flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4 sm:px-10 sm:py-6`}
      >
        <EditCtx.Provider value={editor}>
          <FitStage key={i}>{s.content}</FitStage>
        </EditCtx.Provider>
      </div>

      {/* Controls — big, thumb-friendly, high contrast on any tone */}
      <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <button
          onClick={() => setI((c) => Math.max(0, c - 1))}
          disabled={i === 0}
          className="flex items-center gap-2 rounded-2xl bg-white/90 px-6 py-4 text-xl font-bold text-brand-700 shadow-lg transition-all hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Icon d={I.chevron} className="h-6 w-6 rotate-180" />
          Back
        </button>

        {/* Step dots — the current slide blooms into a wide pill */}
        <div className="hidden flex-wrap items-center justify-center gap-2 sm:flex">
          {slides.map((sl, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Go to slide ${idx + 1}: ${sl.kicker}`}
              title={sl.kicker}
              className={`h-3.5 rounded-full transition-all ${
                idx === i
                  ? `w-10 ${onLight ? "bg-brand-800" : "bg-white"}`
                  : idx < i
                    ? `w-3.5 ${onLight ? "bg-black/40" : "bg-white/70"}`
                    : `w-3.5 ${onLight ? "bg-black/15" : "bg-white/30"} hover:bg-white/60`
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setI((c) => Math.min(n - 1, c + 1))}
          disabled={i === n - 1}
          className="flex items-center gap-2 rounded-2xl bg-white/90 px-6 py-4 text-xl font-bold text-brand-700 shadow-lg transition-all hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
          <Icon d={I.chevron} className="h-6 w-6" />
        </button>
      </div>

      {/* Download progress — a deck can be twenty slides, and each one is a
          real render plus a capture, so silence would look like a hang. */}
      {exporting && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-brand-900">
          <div className="w-80 rounded-3xl bg-white p-7 text-center shadow-2xl">
            <p className="text-lg font-bold text-ink">Preparing your download</p>
            <p className="mt-1 text-sm text-zinc-500">
              Slide {Math.min(exporting.done + 1, exporting.total)} of{" "}
              {exporting.total}
            </p>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] duration-200"
                style={{
                  width: `${Math.round((exporting.done / Math.max(1, exporting.total)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* The photo booth. Each slide is mounted here at a fixed 1280×720 so
          every page of the download is the same size whatever the window is.
          It sits at the deck's own top-left, under the opaque progress panel,
          rather than parked off-screen: html2canvas photographs a clone in a
          viewport-sized frame, and anything at a negative offset gets clipped
          out of it. Hidden by what's in front, not by where it is. */}
      {captureIdx !== null && slides[captureIdx] && (
        <div
          ref={captureRef}
          aria-hidden
          className={`absolute z-10 flex flex-col font-sans ${TONE_BG[slides[captureIdx].tone]}`}
          style={{
            left: 0,
            top: 0,
            width: 1280,
            height: 720,
            pointerEvents: "none",
          }}
        >
          <div
            className={`px-9 pt-5 ${
              TONE_ON_LIGHT[slides[captureIdx].tone] ? "text-brand-900" : "text-white"
            }`}
          >
            <p className="truncate text-sm font-bold uppercase tracking-wider opacity-80">
              {slides[captureIdx].kicker}
            </p>
          </div>
          <div
            className={`relative deck-glow ${pattern} flex min-h-0 flex-1 flex-col overflow-hidden px-10 py-6`}
          >
            <EditCtx.Provider value={null}>
              <FitStage key={`capture-${captureIdx}`}>
                {slides[captureIdx].content}
              </FitStage>
            </EditCtx.Provider>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
