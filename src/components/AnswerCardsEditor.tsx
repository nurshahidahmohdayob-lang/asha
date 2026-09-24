/* ═══════════ The questions the cards ask, in your own words ═══════════
   The quiz is written from the lesson plan, which makes it a starting point
   and not the last word: a class that met an idea in other words should be
   asked in those words. Typing here saves into the lesson itself, so the
   next time these cards are opened they ask the teacher's questions and
   nothing is written again. */
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { QuizQuestion } from "../types";

const LETTERS = ["A", "B", "C", "D"];

/** Four rows to type into whatever the question arrived with: a question with
 *  two options can be given two more, and a row left empty is not an option. */
const pad = (q: QuizQuestion): QuizQuestion => ({
  ...q,
  options: [...(q.options || []), "", "", "", ""].slice(0, 4),
  correctIndex: q.correctIndex >= 0 ? q.correctIndex : 0,
});

/** What is handed back: the empty option rows dropped, and the right answer
 *  kept on the option it was marked on. */
const tidy = (q: QuizQuestion): QuizQuestion => {
  const kept = (q.options || [])
    .map((text, i) => ({ text, i }))
    .filter((o) => o.text.trim() !== "");
  const at = kept.findIndex((o) => o.i === q.correctIndex);
  return {
    text: q.text,
    options: kept.map((o) => o.text),
    correctIndex: at >= 0 ? at : 0,
    ...(q.why?.trim() ? { why: q.why } : {}),
  };
};

export default function AnswerCardsEditor({
  title,
  questions,
  max,
  onChange,
  onClose,
  at,
}: {
  /** The lesson these questions belong to. */
  title: string;
  questions: QuizQuestion[];
  /** How many of them the game will ask. */
  max: number;
  /** Called as the teacher types, with the whole set. */
  onChange: (questions: QuizQuestion[]) => void;
  onClose: () => void;
  /** The question that is up on the board, ringed and scrolled to. */
  at?: number;
}) {
  const [rows, setRows] = useState<QuizQuestion[]>(() => questions.map(pad));
  const [savedAt, setSavedAt] = useState<number | null>(0);

  /* Saving follows the typing by a beat, so a word in progress is not saved
     letter by letter — and the latest rows are held in a ref, so closing the
     editor mid-beat still saves them. */
  const latest = useRef(rows);
  const dirty = useRef(false);
  useEffect(() => {
    latest.current = rows;
  }, [rows]);
  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(() => {
      onChange(latest.current.map(tidy));
      setSavedAt(Date.now());
    }, 500);
    return () => window.clearTimeout(t);
    // onChange is rebuilt every render by the page above; the rows are what
    // this is watching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  useEffect(
    () => () => {
      if (dirty.current) onChange(latest.current.map(tidy));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const touch = () => {
    dirty.current = true;
    setSavedAt(null);
  };
  const edit = (i: number, patch: Partial<QuizQuestion>) => {
    touch();
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  };
  const setOption = (i: number, oi: number, text: string) => {
    touch();
    setRows((rs) =>
      rs.map((r, n) =>
        n === i ? { ...r, options: r.options.map((o, m) => (m === oi ? text : o)) } : r,
      ),
    );
  };
  const addQuestion = () => {
    touch();
    setRows((rs) => [...rs, pad({ text: "", options: [], correctIndex: 0 })]);
  };
  const removeQuestion = (i: number) => {
    touch();
    setRows((rs) => rs.filter((_, n) => n !== i));
  };

  const here = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    here.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div className="absolute inset-0 z-[10] flex flex-col bg-[#053D2E]">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#FACC15]">
          Questions
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{title}</p>
        <span className="text-[12px] font-bold text-white/50">
          {savedAt === null ? "Saving…" : "Saved with the lesson"}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg bg-[#FACC15] px-4 py-1.5 text-sm font-black text-[#064E3B] hover:bg-yellow-300"
        >
          Done
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-[13px] leading-relaxed text-white/65">
            Reword a question, change an option, or tap a letter to mark the right answer. It
            saves as you type, into this lesson, so{" "}
            <b className="text-white">the cards ask your questions next time too</b> — nothing is
            written again. The game asks the first {max}.
          </p>

          <ul className="mt-5 space-y-4">
            {rows.map((r, i) => {
              const filled = r.options.filter((o) => o.trim() !== "").length;
              const beyond = i >= max;
              return (
                <li
                  key={i}
                  ref={i === at ? here : null}
                  className={`rounded-2xl bg-white/5 p-4 ${
                    i === at ? "ring-2 ring-[#FACC15]/60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex-1 text-[11px] font-black uppercase tracking-wider text-[#FACC15]">
                      Question {i + 1}
                      {i === at && <span className="ml-2 text-white/45">on the board</span>}
                      {beyond && (
                        <span className="ml-2 text-white/45">not asked — past the first {max}</span>
                      )}
                    </p>
                    <button
                      onClick={() => removeQuestion(i)}
                      title="Remove this question"
                      className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/20 hover:text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>

                  <textarea
                    id={`cards-q-${i}`}
                    value={r.text}
                    onChange={(e) => edit(i, { text: e.target.value })}
                    rows={2}
                    placeholder="The question, as you will read it out"
                    aria-label={`Question ${i + 1}`}
                    className="mt-2 w-full resize-y rounded-xl bg-white/10 p-3 text-[15px] font-bold text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-[#FACC15]"
                  />

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {r.options.map((o, oi) => {
                      const right = r.correctIndex === oi;
                      return (
                        <div
                          key={oi}
                          className={`flex items-center gap-2 rounded-xl border-2 p-2 ${
                            right ? "border-[#FACC15] bg-[#FACC15]/10" : "border-white/15 bg-white/5"
                          }`}
                        >
                          <button
                            onClick={() => edit(i, { correctIndex: oi })}
                            title={`Mark ${LETTERS[oi]} as the right answer`}
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-black ${
                              right
                                ? "bg-[#FACC15] text-[#064E3B]"
                                : "bg-white/15 hover:bg-white/25"
                            }`}
                          >
                            {LETTERS[oi]}
                          </button>
                          <input
                            id={`cards-q-${i}-${oi}`}
                            value={o}
                            onChange={(e) => setOption(i, oi, e.target.value)}
                            placeholder={oi < 2 ? "An answer to choose from" : "Empty — not offered"}
                            aria-label={`Question ${i + 1}, option ${LETTERS[oi]}`}
                            className="min-w-0 flex-1 bg-transparent text-[14px] font-bold text-white outline-none placeholder:text-white/30"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <input
                    id={`cards-q-${i}-why`}
                    value={r.why || ""}
                    onChange={(e) => edit(i, { why: e.target.value })}
                    placeholder="Optional — the line you read out once the answer is shown"
                    aria-label={`Question ${i + 1}, the line after the answer`}
                    className="mt-2.5 w-full rounded-xl bg-white/5 px-3 py-2 text-[13px] text-white/85 outline-none placeholder:text-white/30 focus:ring-2 focus:ring-[#FACC15]"
                  />

                  {(!r.text.trim() || filled < 2) && (
                    <p className="mt-2.5 text-[12px] font-bold text-[#FACC15]">
                      {!r.text.trim()
                        ? "This question has no words yet — it will not be asked until it does."
                        : "Give at least two options, so there is something to choose between."}
                    </p>
                  )}
                  {!r.options[r.correctIndex]?.trim() && filled > 0 && (
                    <p className="mt-1.5 text-[12px] text-white/55">
                      The right answer is marked on an empty option, so it moves to the first one
                      with words in it.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <button
            onClick={addQuestion}
            className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20"
          >
            <Plus className="h-4 w-4" />
            Add a question
          </button>

          <p className="mt-5 text-[12px] leading-relaxed text-white/45">
            Saved into the lesson plan itself, beside its slides and activities — so the questions
            are there on whichever device you open the plan on.
          </p>
        </div>
      </div>
    </div>
  );
}
