/* ═══════════════ How to run Answer Cards, for the teacher ═════════════
   The cards only work if the printed set goes out in register order and the
   class knows that the answer is the letter at the top. Both are one
   sentence, and both are easy to get wrong the first time — so the guide
   opens over the game, where the teacher already is, rather than living in
   a folder somewhere. */
import { Printer } from "lucide-react";

const TURNS = [
  { letter: "A", turn: "No turn", rest: "as it is printed." },
  { letter: "B", turn: "A quarter turn clockwise", rest: "" },
  { letter: "C", turn: "A half turn", rest: "upside down." },
  { letter: "D", turn: "A quarter turn anticlockwise", rest: "" },
];

/** The screen this section is talking about, so a teacher reading it away from
 *  the class can see what they are being pointed at. Taken from the game
 *  itself with a made-up lesson — no class's work is in them. */
type Shot = { src: string; alt: string; caption: string };

type Section = { title: string; tag?: string; shot?: Shot } & (
  | { kind: "steps"; steps: { lead: string; body: string }[]; warn?: string }
  | { kind: "card"; note: string }
  | { kind: "points"; points: { lead: string; body: string }[]; note?: string }
  | { kind: "fixes"; fixes: { problem: string; fix: string }[] }
);

const SECTIONS: Section[] = [
  {
    kind: "steps",
    title: "Print the cards once, then keep them",
    tag: "start of term",
    steps: [
      {
        lead: "Print the set from this screen",
        body:
          "Choose 20, 30 or 40 cards and press Print cards. An HTML file lands in your Downloads; open it and print it. A4 portrait, one card to a sheet — that is what lets the code be read from the back of the room, so there is nothing to cut out. Card stock, or paper glued to card, lasts the year.",
      },
      {
        lead: "Hand them out in register order",
        body:
          "The cards carry a number, not a name, so one printed set serves every class: card 1 goes to the first child on the register, card 2 to the second. Keep the spare numbers for a new child or a lost card, and collect them in number order at the end.",
      },
    ],
    warn:
      "The one thing to get right: if the cards go out in a different order from the register, the marks on the board belong to the wrong children.",
    shot: {
      src: "/guide/cards-lobby.png",
      alt: "The Answer Cards opening screen, with the card-count buttons, the QR code for a phone, and the buttons Print cards, How it works, Edit questions and Start.",
      caption:
        "The opening screen: how many cards are out, the code your phone scans, and the four buttons — Print cards, How it works, Edit questions, and Start.",
    },
  },
  {
    kind: "card",
    title: "How a child answers",
    tag: "turn, don't tick",
    note:
      "Say it to the class once, in these words: “Turn your card so your letter is at the top and you can read it. Then hold it up high, flat, and don't look at anyone else's.” The letters are printed small on purpose — from two desks away nobody can see which way up a neighbour's card is.",
  },
  {
    kind: "steps",
    title: "The lesson, step by step",
    tag: "about 15 minutes",
    steps: [
      {
        lead: "Open the week and press Cards",
        body: "The game fills the screen and names the lesson in the bar. Project it.",
      },
      {
        lead: "Choose how many cards are out",
        body: "20, 30 or 40 — enough to cover the register in front of you. The board lists that many numbers.",
      },
      {
        lead: "Link your phone, or use this device's camera",
        body:
          "Point your phone's camera at the QR code and open the link. The dot turns yellow when it is connected. No phone? Press “Use this device's camera” — a tablet's back camera faces the class.",
      },
      {
        lead: "Press Start, and read the question out",
        body:
          "Four options, lettered A to D on screen. Read it aloud, give the class a moment, then ask for cards up. The bar counts them in as they are read.",
      },
      {
        lead: "Sweep the room",
        body:
          "Walk the aisles slowly with the phone held up, taking in a few rows at a time. The camera reads a block of cards at once, and each card's latest reading is the one that counts — a child who changes their mind simply turns the card again while the question is open.",
      },
      {
        lead: "Show the answer, then move on",
        body:
          "Show the answer lights the right option and freezes the readings; the line you wrote for it is read out underneath. Next question clears the room for the next one, and the last question ends on the marks.",
      },
    ],
    shot: {
      src: "/guide/cards-question.png",
      alt: "A question on the board with four lettered options, the class numbers underneath, and the marks listed down the right.",
      caption:
        "A question on the board. The numbers underneath are who has answered — numbers only, never letters — and the marks build down the right as the cards are read.",
    },
  },
  {
    kind: "points",
    title: "Making the questions your own",
    tag: "saved as you type",
    points: [
      {
        lead: "Press Edit questions — in the opening screen, or mid-game",
        body:
          "The quiz is written from your lesson plan, which makes it a starting point. Reword a question so it matches the words your class met, change an option, mark a different answer as the right one, add a question or remove one. There is no save button to forget.",
      },
      {
        lead: "Your set is the one it asks",
        body:
          "The questions are saved into the lesson itself, beside its slides and activities, so the cards ask them the next time this week is opened — on whichever device you open the plan on — and nothing is written again.",
      },
      {
        lead: "A question with no words is not asked",
        body:
          "Nor is one with fewer than two options. The editor says so at the time, so a half-finished question never reaches the board.",
      },
    ],
    shot: {
      src: "/guide/cards-editor.png",
      alt: "The question editor: the question in a box, its four options lettered A to D with A marked as the right answer, and a box for the line read out after the reveal.",
      caption:
        "Edit questions, opened at the question that is on the board. Tap a letter to mark the right answer; the last box is the line read out once the answer is shown.",
    },
  },
  {
    kind: "points",
    title: "What the screen is telling you",
    points: [
      {
        lead: "The numbers are who has answered",
        body: "Numbers only, never letters, so nobody in the room can read an answer off the board.",
      },
      {
        lead: "The marks move as you scan",
        body:
          "A card read on the right letter scores the moment it is read, highest first. While the question is open the mark follows the card, so turning away from the right letter loses it again — the reveal is what freezes it.",
      },
      {
        lead: "Nothing about the children is saved",
        body:
          "Readings go from the camera to this screen and are gone; the marks live only while the game is open. Note the board before you close it if you want a record.",
      },
    ],
  },
  {
    kind: "fixes",
    title: "When something goes wrong",
    fixes: [
      {
        problem: "The camera was blocked",
        fix:
          "Allow it from the icon beside the address bar, then press the camera button again. On a phone: iPhone — Settings, Safari, Camera, Allow; Android — tap the icon beside the address, Camera, Allow.",
      },
      {
        problem: "One card will not read",
        fix:
          "Hold it higher, flat and still, with no fingers over the code; stand a metre or two closer; turn away from a window or a light reflecting off the paper. A creased card reads badly — swap it for a spare number.",
      },
      {
        problem: "The marks are against the wrong children",
        fix: "The cards are out of register order. Check card 1 is with the first child on the register.",
      },
      {
        problem: "The phone will not connect",
        fix:
          "It needs the same internet connection as this screen. Re-scan the QR code — and re-scan if you closed and reopened Cards, since that makes a new room.",
      },
      {
        problem: "There are only a few questions",
        fix:
          "A lesson built with a short quiz is filled out to ten from the plan the first time its cards are opened — you can start while it writes. After that the set is yours: press Edit questions to add your own, and it stays as you leave it.",
      },
    ],
  },
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

export default function AnswerCardsGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[10] flex flex-col bg-[#053D2E]">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#FACC15]">
          Guide
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">How Answer Cards work</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold hover:bg-white/20"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold hover:bg-white/20"
        >
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-9">
          <p className="text-[15px] leading-relaxed text-white/80">
            The whole class answers at once, on paper. The lesson&rsquo;s own questions, one
            printed card per child, and your phone reads the room — no pupil devices, no logins,
            nothing to collect in.
          </p>

          {SECTIONS.map((sec, i) => (
            <section key={i} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <h3 className="text-lg font-black text-[#FACC15]">{sec.title}</h3>
                {sec.tag && (
                  <span className="rounded border border-white/20 px-1.5 py-0.5 text-[11px] text-white/50">
                    {sec.tag}
                  </span>
                )}
              </div>

              {sec.kind === "steps" && (
                <>
                  <ol className="space-y-3.5">
                    {sec.steps.map((st, n) => (
                      <li key={st.lead} className="flex gap-3">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-black text-[#FACC15]">
                          {n + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold">{st.lead}</p>
                          <p className="mt-0.5 text-[13.5px] leading-relaxed text-white/70">
                            {st.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {sec.warn && (
                    <p className="rounded-r-xl border-l-2 border-[#FACC15] bg-white/5 px-4 py-3 text-[13.5px]">
                      {sec.warn}
                    </p>
                  )}
                </>
              )}

              {sec.kind === "card" && (
                <>
                  <p className="text-[13.5px] leading-relaxed text-white/70">
                    All four letters are on every card, one to an edge.{" "}
                    <b className="text-white">
                      The answer is whichever letter is at the top, reading the right way up
                    </b>{" "}
                    — so a child answers by turning the card, then holding it in the air. A card
                    held a little crookedly still reads.
                  </p>
                  <div className="flex flex-wrap items-center gap-6">
                    <CardFace />
                    <ol className="min-w-[14rem] flex-1 space-y-2.5">
                      {TURNS.map((t) => (
                        <li
                          key={t.letter}
                          className="flex items-center gap-3 text-[13.5px] text-white/70"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FACC15] text-sm font-black text-[#064E3B]">
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
                  <p className="text-[13px] leading-relaxed text-white/55">{sec.note}</p>
                </>
              )}

              {sec.kind === "points" && (
                <>
                  <ul className="space-y-2.5">
                    {sec.points.map((pt) => (
                      <li
                        key={pt.lead}
                        className="flex gap-3 text-[13.5px] leading-relaxed text-white/70"
                      >
                        <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-sm bg-[#FACC15]" />
                        <span>
                          <b className="text-white">{pt.lead}.</b> {pt.body}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {sec.note && (
                    <p className="text-[13px] leading-relaxed text-white/55">{sec.note}</p>
                  )}
                </>
              )}

              {sec.kind === "fixes" && (
                <dl className="divide-y divide-white/10 border-t border-white/10">
                  {sec.fixes.map((f) => (
                    <div
                      key={f.problem}
                      className="grid gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4"
                    >
                      <dt className="text-[13.5px] font-bold">{f.problem}</dt>
                      <dd className="text-[13px] leading-relaxed text-white/65">{f.fix}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {sec.shot && (
                <figure className="m-0 space-y-2 pt-1">
                  <img
                    src={sec.shot.src}
                    alt={sec.shot.alt}
                    loading="lazy"
                    className="w-full rounded-xl border border-white/15 shadow-lg shadow-black/30"
                  />
                  <figcaption className="text-[12px] leading-relaxed text-white/50">
                    {sec.shot.caption}
                  </figcaption>
                </figure>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
