/* ═══════════ How Answer Cards work, as slides on the board ════════════
   A teacher meets this five minutes before a class, or shows it to the rest
   of the department on the staffroom screen — so it is a deck, one idea to a
   slide, moved with the arrow keys, rather than a page to scroll.

   Every slide is in the DOM the whole time; only the one being shown is on
   screen. Printing lets the rest back in, a slide to a page, so the deck and
   the handout are the same thing. */
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Printer, X } from "lucide-react";

const TURNS = [
  { letter: "A", turn: "No turn", rest: "as it is printed." },
  { letter: "B", turn: "A quarter turn clockwise", rest: "" },
  { letter: "C", turn: "A half turn", rest: "upside down." },
  { letter: "D", turn: "A quarter turn anticlockwise", rest: "" },
];

/** The card, drawn as the sheet prints it: white, a square code in the middle
 *  that says which card it is, "Student 1" underneath, and one letter to each
 *  edge in the school green — each printed pre-turned by as much as the card
 *  must be turned to bring it to the top, which is the only place it reads
 *  upright. The yellow label is the diagram's own, not the card's. */
function CardFace() {
  /* The code, drawn as a likeness of the printed one: three finder squares
     and a scatter of modules, laid out on the 96–204 box the sheet uses and
     scaled into place. */
  const finders = [
    [102, 102],
    [172, 102],
    [102, 172],
  ];
  const modules = [
    [134, 102], [146, 108], [158, 102], [140, 120], [152, 126], [102, 140],
    [114, 146], [126, 140], [138, 152], [150, 146], [162, 158], [174, 146],
    [186, 152], [168, 134], [180, 140], [134, 170], [146, 182], [158, 176],
    [170, 188], [182, 176], [192, 164], [120, 164], [108, 158], [192, 188],
  ];
  const CARD_TOP = 38;
  const MID = 184;

  return (
    <svg
      viewBox="0 0 300 336"
      role="img"
      aria-label="A printed answer card: A at the top edge, B at the left, C at the bottom, D at the right, the code that names the card in the middle, and Student 1 underneath. The letter at the top is the answer."
      className="w-[15rem] max-w-full shrink-0"
    >
      {/* The diagram's own label — the card itself carries no yellow. */}
      <g>
        <rect x="62" y="0" width="176" height="26" rx="13" fill="#FACC15" />
        <path d="M144 26h12l-6 10z" fill="#FACC15" />
        <text
          x="150"
          y="18"
          textAnchor="middle"
          fontSize="12.5"
          fontWeight="800"
          fill="#064E3B"
        >
          at the top = the answer
        </text>
      </g>

      <rect
        x="4"
        y={CARD_TOP}
        width="292"
        height="292"
        rx="14"
        fill="#FFFFFF"
        stroke="#D1D5DB"
        strokeWidth="2"
      />

      <g fontWeight="800" fontSize="28" textAnchor="middle" fill="#064E3B">
        <text x="150" y="68">A</text>
        <text x="150" y="68" transform={`rotate(180 150 ${MID})`}>
          C
        </text>
        <text x="150" y="68" transform={`rotate(-90 150 ${MID})`}>
          B
        </text>
        <text x="150" y="68" transform={`rotate(90 150 ${MID})`}>
          D
        </text>
      </g>

      <rect x="68" y="90" width="164" height="164" fill="#FFFFFF" stroke="#E5E7EB" />
      <g fill="#111827" transform="translate(68 90) scale(1.5185) translate(-96 -96)">
        {finders.map(([x, y]) => (
          <g key={`f-${x}-${y}`}>
            <rect x={x} y={y} width="26" height="26" />
            <rect x={x + 6} y={y + 6} width="14" height="14" fill="#FFFFFF" />
            <rect x={x + 10} y={y + 10} width="6" height="6" />
          </g>
        ))}
        {modules.map(([x, y]) => (
          <rect key={`m-${x}-${y}`} x={x} y={y} width="6" height="6" />
        ))}
      </g>

      <text x="150" y="286" textAnchor="middle">
        <tspan fontSize="13" fontWeight="600" fill="#374151">
          Student{" "}
        </tspan>
        <tspan fontSize="26" fontWeight="800" fill="#064E3B">
          1
        </tspan>
      </text>
    </svg>
  );
}

/* ─────────────────────────── slide furniture ─────────────────────────── */

/** A numbered step, as the lesson is actually run. */
function Step({ n, lead, children }: { n: number; lead: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-black text-[#FACC15]">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-bold leading-snug">{lead}</p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-white/70">{children}</p>
      </div>
    </li>
  );
}

/** A thing worth knowing on its own, led by the words that carry it. */
function Point({ lead, children }: { lead: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-[13.5px] leading-relaxed text-white/75">
      <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-sm bg-[#FACC15]" />
      <span>
        <b className="text-white">{lead}.</b> {children}
      </span>
    </li>
  );
}

/** A screen from the game, so the words point at something the reader sees. */
function Shot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-xl border border-white/15 shadow-lg shadow-black/30"
      />
      <figcaption className="text-[12px] leading-relaxed text-white/50">{caption}</figcaption>
    </figure>
  );
}

function Slide({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-[clamp(1.4rem,2.6vw,2rem)] font-black leading-tight text-[#FACC15]">
          {title}
        </h3>
        {tag && (
          <span className="rounded border border-white/20 px-2 py-0.5 text-[12px] text-white/50">
            {tag}
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

/* ────────────────────────────── the deck ─────────────────────────────── */

const SLIDES: { title: string; render: () => ReactNode }[] = [
  {
    title: "Answer cards",
    render: () => (
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col justify-center gap-6 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FACC15]">
          A teacher&rsquo;s guide
        </p>
        <h2 className="text-[clamp(2.2rem,6vw,4rem)] font-black leading-[1.05]">
          The whole class answers at once, on paper
        </h2>
        <p className="mx-auto max-w-2xl text-[clamp(1rem,1.6vw,1.2rem)] leading-relaxed text-white/75">
          The lesson&rsquo;s own questions, one printed card per child, and your phone reads the
          room — no pupil devices, no logins, nothing to collect in.
        </p>
        <p className="text-[13px] text-white/45">
          Arrow keys or the buttons below to move · Esc closes · Print gives you the whole deck
        </p>
      </div>
    ),
  },
  {
    title: "Print the cards once, then keep them",
    render: () => (
      <Slide title="Print the cards once, then keep them" tag="start of term">
        <div className="grid h-full gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex min-w-0 flex-col gap-4">
            <ol className="space-y-4">
              <Step n={1} lead="Print the set from this screen">
                Choose 20, 30 or 40 cards and press Print cards. An HTML file lands in your
                Downloads; open it and print it. A4 portrait, one card to a sheet — that is what
                lets the code be read from the back of the room, so there is nothing to cut out.
                Card stock, or paper glued to card, lasts the year.
              </Step>
              <Step n={2} lead="Hand them out in register order">
                The cards carry a number, not a name, so one printed set serves every class: card
                1 goes to the first child on the register, card 2 to the second. Keep the spare
                numbers for a new child or a lost card.
              </Step>
            </ol>
            <p className="rounded-r-xl border-l-2 border-[#FACC15] bg-white/5 px-4 py-3 text-[13.5px]">
              The one thing to get right: if the cards go out in a different order from the
              register, the marks on the board belong to the wrong children.
            </p>
          </div>
          <Shot
            src="/guide/cards-lobby.png"
            alt="The Answer Cards opening screen, with the card-count buttons, the QR code for a phone, and the buttons Print cards, How it works, Edit questions and Start."
            caption="The opening screen: how many cards are out, the code your phone scans, and the four buttons."
          />
        </div>
      </Slide>
    ),
  },
  {
    title: "How a child answers",
    render: () => (
      <Slide title="How a child answers" tag="turn, don't tick">
        <div className="flex h-full flex-col gap-5">
          <p className="max-w-3xl text-[15px] leading-relaxed text-white/75">
            All four letters are on every card, one to an edge.{" "}
            <b className="text-white">
              The answer is whichever letter is at the top, reading the right way up
            </b>{" "}
            — so a child answers by turning the card, then holding it in the air. A card held a
            little crookedly still reads.
          </p>
          <div className="flex flex-wrap items-center gap-8">
            <CardFace />
            <ol className="min-w-[15rem] flex-1 space-y-3">
              {TURNS.map((t) => (
                <li key={t.letter} className="flex items-center gap-3 text-[15px] text-white/75">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FACC15] text-base font-black text-[#064E3B]">
                    {t.letter}
                  </span>
                  <span>
                    <b className="text-white">{t.turn}</b>
                    {t.rest ? ` — ${t.rest}` : "."}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <p className="max-w-3xl text-[13px] leading-relaxed text-white/55">
            Say it to the class once, in these words: &ldquo;Turn your card so your letter is at
            the top and you can read it. Then hold it up high, flat, and don&rsquo;t look at
            anyone else&rsquo;s.&rdquo; The letters are printed small on purpose — from two desks
            away nobody can see which way up a neighbour&rsquo;s card is.
          </p>
        </div>
      </Slide>
    ),
  },
  {
    title: "The lesson, step by step",
    render: () => (
      <Slide title="The lesson, step by step" tag="about 15 minutes">
        <ol className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
          <Step n={1} lead="Open the week and press Cards">
            The game fills the screen and names the lesson in the bar. Project it.
          </Step>
          <Step n={2} lead="Choose how many cards are out">
            20, 30 or 40 — enough to cover the register in front of you.
          </Step>
          <Step n={3} lead="Link your phone, or use this device's camera">
            Point your phone&rsquo;s camera at the QR code and open the link. The dot turns yellow
            when it is connected. A tablet&rsquo;s back camera works too.
          </Step>
          <Step n={4} lead="Press Start, and read the question out">
            Four options, lettered A to D. Read it aloud, give the class a moment, then ask for
            cards up. The bar counts them in as they are read.
          </Step>
          <Step n={5} lead="Sweep the room">
            Walk the aisles slowly with the phone held up, a few rows at a time. Each card&rsquo;s
            latest reading counts, so a child who changes their mind simply turns it again.
          </Step>
          <Step n={6} lead="Show the answer, then move on">
            The right option lights, the readings freeze, and your line is read out underneath.
            Next question clears the room; the last one ends on the marks.
          </Step>
        </ol>
      </Slide>
    ),
  },
  {
    title: "What the screen is telling you",
    render: () => (
      <Slide title="What the screen is telling you">
        <div className="grid h-full gap-6 lg:grid-cols-[1fr_1.05fr]">
          <ul className="space-y-3.5">
            <Point lead="The numbers are who has answered">
              Numbers only, never letters, so nobody in the room can read an answer off the board.
            </Point>
            <Point lead="The marks move as you scan">
              A card read on the right letter scores the moment it is read, highest first. While
              the question is open the mark follows the card, so turning away from the right
              letter loses it again.
            </Point>
            <Point lead="The reveal freezes it">
              Whatever is showing when you press Show the answer is what is banked.
            </Point>
            <Point lead="Nothing about the children is saved">
              Readings go from the camera to this screen and are gone; the marks live only while
              the game is open. Note the board before you close it if you want a record.
            </Point>
          </ul>
          <Shot
            src="/guide/cards-question.png"
            alt="A question on the board with four lettered options, the class numbers underneath, and the marks listed down the right."
            caption="A question on the board, mid-sweep."
          />
        </div>
      </Slide>
    ),
  },
  {
    title: "Making the questions your own",
    render: () => (
      <Slide title="Making the questions your own" tag="saved as you type">
        <div className="grid h-full gap-6 lg:grid-cols-[1fr_1.05fr]">
          <ul className="space-y-3.5">
            <Point lead="Press Edit questions — in the opening screen, or mid-game">
              The quiz is written from your lesson plan, which makes it a starting point. Reword a
              question, change an option, mark a different answer as the right one, add a question
              or remove one. There is no save button to forget.
            </Point>
            <Point lead="Your set is the one it asks">
              The questions are saved into the lesson itself, so the cards ask them the next time
              this week is opened, on whichever device the plan is opened on.
            </Point>
            <Point lead="Start writes whatever the lesson is short of">
              A lesson built with three questions is filled out to ten from the plan when you
              press Start, the first time — your own wording stays first, and the written ones
              go behind it. After that the set is yours.
            </Point>
            <Point lead="A question with no words is not asked">
              Nor is one with fewer than two options. The editor says so while you type.
            </Point>
          </ul>
          <Shot
            src="/guide/cards-editor.png"
            alt="The question editor: the question in a box, its four options lettered A to D with A marked as the right answer, and a box for the line read out after the reveal."
            caption="Edit questions, opened at the question that is on the board."
          />
        </div>
      </Slide>
    ),
  },
  {
    title: "When something goes wrong",
    render: () => (
      <Slide title="When something goes wrong">
        <dl className="grid gap-x-10 gap-y-0 sm:grid-cols-2">
          {[
            [
              "The camera was blocked",
              "Allow it from the icon beside the address bar, then press the camera button again. iPhone: Settings, Safari, Camera, Allow. Android: the icon beside the address, Camera, Allow.",
            ],
            [
              "One card will not read",
              "Hold it higher, flat and still, with no fingers over the code; stand a metre or two closer; turn away from a light reflecting off the paper. A creased card reads badly — swap it for a spare.",
            ],
            [
              "The marks are against the wrong children",
              "The cards are out of register order. Check card 1 is with the first child on the register.",
            ],
            [
              "The phone will not connect",
              "It needs the same internet connection as this screen. Re-scan the QR code — and re-scan if you closed and reopened Cards, since that makes a new room.",
            ],
            [
              "There are only a few questions",
              "Press Start: a short quiz is filled out to ten from the lesson plan the first time, with your own questions kept in front. After that the set is yours — press Edit questions to add more.",
            ],
            [
              "Children can see each other's answers",
              "Ask for cards held high and flat rather than tilted towards a neighbour. The count in the bar tells you everyone has answered without anyone's answer being on show.",
            ],
          ].map(([problem, fix]) => (
            <div key={problem} className="border-b border-white/10 py-3">
              <dt className="text-[13.5px] font-bold">{problem}</dt>
              <dd className="mt-0.5 text-[13px] leading-relaxed text-white/65">{fix}</dd>
            </div>
          ))}
        </dl>
      </Slide>
    ),
  },
  {
    title: "The whole thing, in three lines",
    render: () => (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center gap-7 text-center">
        <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black leading-tight">
          The whole thing, in three lines
        </h2>
        <ol className="space-y-4 text-left">
          {[
            "Print the set once and hand it out in register order.",
            "Read the question; the class turns the card so their letter is at the top.",
            "Sweep the room, show the answer, move on.",
          ].map((line, i) => (
            <li key={line} className="flex items-center gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FACC15] text-base font-black text-[#064E3B]">
                {i + 1}
              </span>
              <span className="text-[clamp(1rem,1.8vw,1.25rem)] font-bold">{line}</span>
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-white/45">
          Two minutes at the end on what the class got wrong is worth more than the scoreboard.
        </p>
      </div>
    ),
  },
];

export default function AnswerCardsGuide({ onClose }: { onClose: () => void }) {
  const n = SLIDES.length;
  const [i, setI] = useState(0);
  const back = () => setI((c) => Math.max(0, c - 1));
  const on = () => setI((c) => Math.min(n - 1, c + 1));

  /* The deck is driven from the board, so it answers the keys a presenter
     already uses — and Escape gives the game back. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
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

  return (
    <div className="absolute inset-0 z-[10] flex flex-col bg-[#053D2E] print:static print:h-auto print:bg-white print:text-black">
      {/* Printing wants the deck as a handout: every slide back on the page,
          one to a sheet, and none of the furniture that moves between them. */}
      <style>{`
        @media print {
          .cards-guide-slide { display: block !important; break-after: page; page-break-after: always; }
          .cards-guide-slide:last-child { break-after: auto; page-break-after: auto; }
          .cards-guide-chrome { display: none !important; }
        }
      `}</style>

      <div className="cards-guide-chrome flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#FACC15]">
          Guide
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">How Answer Cards work</p>
        <button
          onClick={() => window.print()}
          title="Print the whole deck, a slide to a page"
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold hover:bg-white/20"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold hover:bg-white/20"
        >
          <X className="h-4 w-4" />
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 print:overflow-visible">
        {SLIDES.map((s, k) => (
          <div
            key={s.title}
            className={`cards-guide-slide h-full ${k === i ? "block" : "hidden"}`}
            aria-hidden={k === i ? undefined : true}
          >
            {s.render()}
          </div>
        ))}
      </div>

      <div className="cards-guide-chrome flex shrink-0 items-center gap-4 border-t border-white/10 px-4 py-3">
        <button
          onClick={back}
          disabled={i === 0}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {/* One mark a slide: where the deck is, and how much of it is left. */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          {SLIDES.map((s, k) => (
            <button
              key={s.title}
              onClick={() => setI(k)}
              title={s.title}
              aria-label={s.title}
              aria-current={k === i ? "true" : undefined}
              className={`h-2 rounded-full transition-all ${
                k === i ? "w-7 bg-[#FACC15]" : "w-2 bg-white/25 hover:bg-white/45"
              }`}
            />
          ))}
        </div>

        <span className="shrink-0 text-[12px] font-bold tabular-nums text-white/50">
          {i + 1} of {n}
        </span>
        <button
          onClick={on}
          disabled={i === n - 1}
          className="flex items-center gap-1.5 rounded-lg bg-[#FACC15] px-4 py-2 text-sm font-black text-[#064E3B] hover:bg-yellow-300 disabled:opacity-30 disabled:hover:bg-[#FACC15]"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
