/* ══════════════ The whole class answers at once ══════════════════════
   Every child holds up a printed card, turned so their answer is the letter
   at the top. One camera reads the room: the teacher's phone, or this
   device's own camera if no phone joins. Nobody needs a device but the
   teacher, and nobody can copy — the letters are small and the answers stay
   hidden until the reveal.

   The questions are the lesson's own quiz, written from the teacher's plan,
   so the game asks about the lesson the class has just had. */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { LessonActivityPack, QuizQuestion } from "../types";
import { browserSupabase, relayConfigured } from "../lib/browserSupabase";
import { buildCardsHtml, readCardsInFrame } from "../lib/answerCards";
import {
  HELLO_EVENT,
  newRoomCode,
  READ_EVENT,
  relayChannel,
  ROUND_EVENT,
  scanUrl,
  type CardRead,
} from "../lib/cardRelay";

type Phase = "lobby" | "asking" | "revealed" | "done";
type Camera = "off" | "starting" | "on" | "denied";

/** How many cards a class might need. One printed set serves every class. */
const CARD_COUNTS = [20, 30, 40];
/** How many questions a game asks. Fixed: a teacher setting up in front of a
 *  class has enough to decide already, and fifteen is a lesson's worth. */
const QUIZ_COUNT = 15;

export default function AnswerCardsGame({
  title,
  subject,
  academicYear,
  pack,
  onWriteQuiz,
  onClose,
}: {
  /** What the class is answering about — the week's topic. */
  title: string;
  subject: string;
  academicYear: string;
  /** The lesson, whose quiz the game asks. */
  pack?: LessonActivityPack;
  /** Write the quiz from the plan, for a lesson that has none yet. */
  onWriteQuiz?: (wanted: number) => Promise<QuizQuestion[]>;
  onClose: () => void;
}) {
  const stored: QuizQuestion[] = useMemo(
    () => (pack?.questions || []).filter((q) => q?.text && (q.options || []).length >= 2),
    [pack],
  );
  /* A lesson built before the quiz was kept has none. Rather than sending the
     teacher away to rebuild the lesson — which would replace slides they may
     have edited — the game writes the questions from the plan itself. */
  const [written, setWritten] = useState<QuizQuestion[] | null>(null);
  const [writing, setWriting] = useState(false);
  const [writeFailed, setWriteFailed] = useState<string | null>(null);
  const available = written ?? stored;
  const rounds = available.slice(0, QUIZ_COUNT);

  /** Write the questions from the plan. Asked for on opening, and again if the
   *  teacher wants more than the lesson has. */
  const writeQuiz = (count: number) => {
    if (!onWriteQuiz) return;
    setWriting(true);
    setWriteFailed(null);
    onWriteQuiz(count)
      .then((qs) => {
        if (qs.length) setWritten(qs);
        else setWriteFailed("No questions came back. Try again in a moment.");
      })
      .catch((err: unknown) =>
        setWriteFailed((err as Error)?.message || String(err)),
      )
      .finally(() => setWriting(false));
  };

  const askedRef = useRef(false);
  useEffect(() => {
    if (stored.length || !onWriteQuiz || askedRef.current) return;
    askedRef.current = true;
    writeQuiz(QUIZ_COUNT);
    // Only on opening; asking for more is a deliberate press afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.length, onWriteQuiz]);

  const [classSize, setClassSize] = useState(20);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<Phase>("lobby");
  /** This question's answers: card number → the letter it showed. */
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<Record<number, number>>({});
  const [camera, setCamera] = useState<Camera>("off");
  const [note, setNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanning = useRef(false);
  /* The scan loop runs outside React and needs to know whether a question is
     still open; a ref carries that across. */
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /* ── The phone ────────────────────────────────────────────────────── */
  const relayOn = relayConfigured();
  const [room] = useState(newRoomCode);
  const [phoneQr, setPhoneQr] = useState<string | null>(null);
  const [phoneSeen, setPhoneSeen] = useState(0);
  const [now, setNow] = useState(0);
  const relayRef = useRef<RealtimeChannel | null>(null);
  const roundRef = useRef({ q: 0, of: rounds.length, open: false });

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(t);
  }, []);
  const phoneLive = phoneSeen > 0 && now - phoneSeen < 8000;

  // Tell the phone which question is up, and whether it is still open.
  useEffect(() => {
    roundRef.current = { q: qi, of: rounds.length, open: phase === "asking" };
    void relayRef.current?.send({
      type: "broadcast",
      event: ROUND_EVENT,
      payload: { q: qi + 1, of: rounds.length, open: phase === "asking" },
    });
  }, [phase, qi, rounds.length]);

  useEffect(() => {
    if (!relayOn) return;
    let live = true;
    void import("qrcode")
      .then(({ default: QR }) =>
        QR.toDataURL(scanUrl(window.location.origin, room), {
          margin: 1,
          scale: 6,
          errorCorrectionLevel: "M",
        }),
      )
      .then((d) => {
        if (live) setPhoneQr(d);
      })
      .catch(() => {});

    const supabase = browserSupabase();
    const ch = supabase.channel(relayChannel(room));
    ch.on("broadcast", { event: READ_EVENT }, (m: { payload: { reads?: CardRead[] } }) => {
      setPhoneSeen(Date.now());
      if (phaseRef.current !== "asking") return;
      const found: Record<number, number> = {};
      for (const r of m.payload?.reads ?? [])
        if (
          Number.isInteger(r.n) &&
          r.n >= 1 &&
          r.n <= classSize &&
          Number.isInteger(r.letter) &&
          r.letter >= 0 &&
          r.letter <= 3
        )
          found[r.n] = r.letter;
      if (Object.keys(found).length) setAnswers((a) => ({ ...a, ...found }));
    })
      .on("broadcast", { event: HELLO_EVENT }, () => {
        setPhoneSeen(Date.now());
        // A phone joining mid-question learns which question it is.
        const r = roundRef.current;
        void ch.send({
          type: "broadcast",
          event: ROUND_EVENT,
          payload: { q: r.q + 1, of: r.of, open: r.open },
        });
      })
      .subscribe();
    relayRef.current = ch;
    return () => {
      live = false;
      relayRef.current = null;
      void supabase.removeChannel(ch);
    };
  }, [relayOn, room, classSize]);

  /* ── Points ───────────────────────────────────────────────────────
     A card read with the right letter scores the moment it is read, and
     follows the card's latest reading while the question is open — turning to
     the right letter gains the point, turning away loses it. `score` holds
     what finished questions banked; this question's point is worked out from
     the reading, never added per read, since a card is read many times a
     second. */
  const round = rounds[qi];
  const answered = Object.keys(answers).length;
  const liveRight = (n: number) =>
    Boolean(round) &&
    (phase === "asking" || phase === "revealed") &&
    answers[n] === round.correctIndex;
  const pointsOf = (n: number) => (score[n] ?? 0) + (liveRight(n) ? 1 : 0);

  /* ── This device's camera, for when no phone joins ────────────────── */
  const stop = () => {
    scanning.current = false;
    const v = videoRef.current;
    const s = v?.srcObject as MediaStream | null;
    s?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
  };
  useEffect(() => stop, []);

  const startCamera = async () => {
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // The back camera on a tablet faces the class; a laptop has only one.
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      setCamera("on");
      scanning.current = true;
      void loop();
    } catch {
      setCamera("denied");
    }
  };

  const loop = async () => {
    const { default: jsQR } = await import("jsqr");
    const step = () => {
      if (!scanning.current) return;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.videoWidth) {
        const w = 720;
        const h = Math.round((v.videoHeight / v.videoWidth) * w);
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const found: Record<number, number> = {};
          for (const [k, letter] of Object.entries(readCardsInFrame(ctx, w, h, jsQR)))
            if (Number(k) <= classSize) found[Number(k)] = letter;
          // A child may turn the card again; the latest reading is the answer.
          if (Object.keys(found).length && phaseRef.current === "asking")
            setAnswers((a) => ({ ...a, ...found }));
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ── The round ────────────────────────────────────────────────────── */
  const reveal = () => setPhase("revealed");

  const next = () => {
    // Bank this question's points before its readings are cleared.
    const r = rounds[qi];
    if (r)
      setScore((s) => {
        const banked = { ...s };
        for (const [num, letter] of Object.entries(answers))
          if (letter === r.correctIndex) banked[Number(num)] = (banked[Number(num)] ?? 0) + 1;
        return banked;
      });
    setAnswers({});
    if (qi + 1 >= rounds.length) setPhase("done");
    else {
      setQi(qi + 1);
      setPhase("asking");
    }
  };

  const printCards = async () => {
    setNote("Making the cards…");
    try {
      const html = await buildCardsHtml(classSize, { subject, academicYear });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Answer Cards 1 to ${classSize}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote(`Cards 1 to ${classSize} downloaded — print once, use with every class`);
    } catch (err) {
      setNote(`The cards could not be made: ${(err as Error)?.message || err}`);
    }
  };

  const ranked = Array.from({ length: classSize }, (_, i) => i + 1)
    .map((n) => ({ n, points: pointsOf(n) }))
    .sort((a, b) => b.points - a.points || a.n - b.n);

  /** The same list, marking who has just scored on this question, so the
   *  board shows a mark landing rather than only its total. */
  const scoreboard = Array.from({ length: classSize }, (_, i) => i + 1)
    .map((n) => ({ n, points: pointsOf(n), justScored: liveRight(n) }))
    .sort((a, b) => b.points - a.points || a.n - b.n);

  const letters = ["A", "B", "C", "D"];

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#064E3B] text-white font-sans">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="rounded bg-[#FACC15] px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#064E3B]">
          Cards
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{title}</p>
        {phase === "asking" && (
          <span className="text-sm font-black text-[#FACC15]">
            {answered} of {classSize} answered
          </span>
        )}
        <button
          onClick={() => {
            stop();
            onClose();
          }}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold hover:bg-white/20"
        >
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        {phase === "lobby" && (
          <div className="mx-auto w-full max-w-2xl space-y-5 text-center">
            <h2 className="text-3xl font-black">Answer cards</h2>
            <p className="text-white/75">
              Every child holds up their card, turned so their answer is the
              letter at the top. You sweep the room with your phone&rsquo;s
              camera, or this device&rsquo;s, and the answers tick in. Nobody
              can copy: the letters are small and the answers stay hidden until
              the reveal.
            </p>
            <p className="text-[13px] text-white/60">
              The cards are numbered, so one printed set serves every class:{" "}
              <b className="text-white">card 1 goes to the first child on the register</b>, card 2
              to the second.
            </p>

            {rounds.length === 0 ? (
              <p className="rounded-2xl bg-white/10 p-4 text-[13px] text-white/80">
                {writing ? (
                  <>Writing the questions from your lesson plan…</>
                ) : writeFailed ? (
                  <>The questions could not be written: {writeFailed}</>
                ) : (
                  <>This lesson has no questions to ask yet.</>
                )}
              </p>
            ) : (
              <>
                {writing && (
                  <p className="text-[12px] text-white/60">
                    Writing the questions…
                  </p>
                )}

                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#FACC15]">
                    How many cards
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {CARD_COUNTS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setClassSize(c)}
                        className={`rounded-lg px-4 py-2 text-sm font-bold ${
                          classSize === c
                            ? "bg-[#FACC15] text-[#064E3B]"
                            : "bg-white/10 hover:bg-white/20"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {relayOn && (
                  <div className="mx-auto flex max-w-md items-center gap-4 rounded-2xl bg-white/10 p-4 text-left">
                    {phoneQr && (
                      <img
                        src={phoneQr}
                        alt="Scan to use your phone"
                        className="h-28 w-28 shrink-0 rounded-lg bg-white p-1.5"
                      />
                    )}
                    <div className="min-w-0 text-[13px] text-white/80">
                      <p className="font-bold text-white">Scan the room with your phone</p>
                      <p className="mt-1">
                        Point your phone&rsquo;s camera at this code and open
                        the link. The question stays on this screen; the phone
                        only reads the cards.
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-[12px]">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            phoneLive ? "bg-[#FACC15]" : "bg-white/30"
                          }`}
                        />
                        {phoneLive ? "Phone connected" : "No phone yet"} · room {room}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => void printCards()}
                    className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20"
                  >
                    Print cards 1–{classSize}
                  </button>
                  <button
                    onClick={() => setPhase("asking")}
                    className="rounded-xl bg-[#FACC15] px-6 py-3 text-base font-black text-[#064E3B] hover:bg-yellow-300"
                  >
                    Start · {rounds.length} question{rounds.length === 1 ? "" : "s"}
                  </button>
                </div>
              </>
            )}
            {note && <p className="text-[12px] text-white/60">{note}</p>}
          </div>
        )}

        {(phase === "asking" || phase === "revealed") && round && (
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-5">
            <p className="text-center text-sm font-bold uppercase tracking-wider text-[#FACC15]">
              Question {qi + 1} of {rounds.length}
            </p>
            <h2 className="text-center text-3xl font-black leading-tight sm:text-4xl">
              {round.text}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {round.options.slice(0, 4).map((opt, i) => {
                const right = phase === "revealed" && i === round.correctIndex;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-lg font-bold ${
                      right
                        ? "border-[#FACC15] bg-[#FACC15] text-[#064E3B]"
                        : "border-white/20 bg-white/5"
                    }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${
                        right ? "bg-[#064E3B] text-white" : "bg-white/15"
                      }`}
                    >
                      {letters[i]}
                    </span>
                    <span>{opt}</span>
                  </div>
                );
              })}
            </div>

            {phase === "revealed" && round.why && (
              <p className="rounded-2xl bg-white/10 p-4 text-center text-[15px] text-white/85">
                {round.why}
              </p>
            )}

            {/* Who has answered — numbers only, never the letters, so nobody
                in the room can read an answer off the board. */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {Array.from({ length: classSize }, (_, i) => i + 1).map((n) => {
                const inHand = answers[n] != null;
                const correct = phase === "revealed" && answers[n] === round.correctIndex;
                return (
                  <span
                    key={n}
                    className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-black ${
                      correct
                        ? "bg-[#FACC15] text-[#064E3B]"
                        : inHand
                          ? "bg-white/25"
                          : "bg-white/5 text-white/35"
                    }`}
                  >
                    {n}
                  </span>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!phoneLive && camera !== "on" && (
                <button
                  onClick={() => void startCamera()}
                  className="rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20"
                >
                  {camera === "starting"
                    ? "Starting the camera…"
                    : camera === "denied"
                      ? "Camera blocked — try again"
                      : "Use this device's camera"}
                </button>
              )}
              {phase === "asking" ? (
                <button
                  onClick={reveal}
                  className="rounded-xl bg-[#FACC15] px-6 py-3 text-base font-black text-[#064E3B] hover:bg-yellow-300"
                >
                  Show the answer
                </button>
              ) : (
                <button
                  onClick={next}
                  className="rounded-xl bg-[#FACC15] px-6 py-3 text-base font-black text-[#064E3B] hover:bg-yellow-300"
                >
                  {qi + 1 >= rounds.length ? "Finish" : "Next question"}
                </button>
              )}
            </div>

            <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={camera === "on" ? "h-44 w-full object-cover" : "hidden"}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* The marks, beside the question rather than saved for the end.
              A card read with the right letter scores the moment it is read,
              so the board moves while the class watches, highest first. */}
          <aside className="w-full shrink-0 lg:w-72">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#FACC15]">
                  Marks
                </p>
                <p className="text-[11px] font-bold text-white/50">
                  {answered} of {classSize} in
                </p>
              </div>
              <div className="mt-3 max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
                {scoreboard.map((r, i) => (
                  <div
                    key={r.n}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${
                      r.justScored
                        ? "bg-[#FACC15] text-[#064E3B]"
                        : r.points > 0
                          ? "bg-white/15"
                          : "bg-white/5 text-white/45"
                    }`}
                  >
                    <span className="w-5 text-[12px] font-black opacity-70">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-bold">Student {r.n}</span>
                    <span className="text-sm font-black">{r.points}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          </div>
        )}

        {phase === "done" && (
          <div className="mx-auto w-full max-w-lg space-y-4 text-center">
            <h2 className="text-3xl font-black">Well done</h2>
            <p className="text-white/70">
              {rounds.length} question{rounds.length === 1 ? "" : "s"} answered.
            </p>
            <div className="space-y-1.5 text-left">
              {ranked
                .filter((r) => r.points > 0)
                .slice(0, 12)
                .map((r, i) => (
                  <div
                    key={r.n}
                    className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5"
                  >
                    <span className="w-6 text-sm font-black text-[#FACC15]">{i + 1}</span>
                    <span className="flex-1 font-bold">Student {r.n}</span>
                    <span className="font-black">{r.points}</span>
                  </div>
                ))}
              {ranked.every((r) => r.points === 0) && (
                <p className="text-center text-white/60">No cards were read.</p>
              )}
            </div>
            <button
              onClick={() => {
                setScore({});
                setAnswers({});
                setQi(0);
                setPhase("lobby");
              }}
              className="rounded-xl bg-white/10 px-5 py-3 font-bold hover:bg-white/20"
            >
              Play again
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
