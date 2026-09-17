/* The phone in the teacher's hand.
 *
 *  The question is on the board from the laptop; the teacher walks the room
 *  with a phone. The two meet in a broadcast channel named by a code that
 *  lives only as long as the game. Nothing is written down: a reading goes
 *  from the camera to the board and is gone.
 *
 *  This is a page of its own at /scan?c=CODE, reached by the QR code the board
 *  shows, so a phone never loads the whole suite to read a room. */
import { useEffect, useRef, useState } from "react";
import { browserSupabase } from "../lib/browserSupabase";
import { readCardsInFrame } from "../lib/answerCards";
import {
  HELLO_EVENT,
  isRoomCode,
  READ_EVENT,
  relayChannel,
  ROUND_EVENT,
  type CardRead,
  type RoundInfo,
} from "../lib/cardRelay";

type Status = "ready" | "starting" | "scanning" | "denied";
type WakeLockish = { release: () => Promise<void> };

/** A card still in view is sent again this often, so a child who keeps the
 *  same letter into the next question is counted for that one too. */
const RESEND_MS = 1500;

export default function CardScanner() {
  const room = new URLSearchParams(window.location.search).get("c");
  const [status, setStatus] = useState<Status>("ready");
  const [linked, setLinked] = useState(false);
  const [seen, setSeen] = useState<number[]>([]);
  const [round, setRound] = useState<RoundInfo | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => stopRef.current(), []);

  const start = async () => {
    if (!isRoomCode(room)) return;
    setStatus("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // The back camera, which faces the class.
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
    } catch {
      setStatus("denied");
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    await video.play().catch(() => {});

    const supabase = browserSupabase();
    const channel = supabase.channel(relayChannel(room));
    const sentAt: Record<number, number> = {};
    const sentLetter: Record<number, number> = {};
    const seenSet = new Set<number>();
    let open = true;
    let lastQ = 0;

    channel
      .on("broadcast", { event: ROUND_EVENT }, (m: { payload: RoundInfo }) => {
        const r = m.payload;
        setRound(r);
        // A new question opening wipes the slate: every card is read afresh.
        const fresh = r.open && (r.q !== lastQ || !open);
        open = r.open;
        lastQ = r.q;
        if (fresh) {
          seenSet.clear();
          for (const k of Object.keys(sentAt)) {
            delete sentAt[Number(k)];
            delete sentLetter[Number(k)];
          }
          setSeen([]);
        }
      })
      .subscribe((s: string) => {
        if (s === "SUBSCRIBED") {
          setLinked(true);
          void channel.send({ type: "broadcast", event: HELLO_EVENT, payload: {} });
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setLinked(false);
        }
      });

    // A phone held up to a class should not go to sleep mid-question.
    let lock: WakeLockish | null = null;
    try {
      const wl = (
        navigator as Navigator & {
          wakeLock?: { request: (t: "screen") => Promise<WakeLockish> };
        }
      ).wakeLock;
      lock = wl ? await wl.request("screen") : null;
    } catch {
      lock = null;
    }

    const hello = window.setInterval(() => {
      void channel.send({ type: "broadcast", event: HELLO_EVENT, payload: {} });
    }, 3000);

    const { default: jsQR } = await import("jsqr");
    let running = true;
    setStatus("scanning");

    const step = () => {
      if (!running) return;
      const canvas = canvasRef.current;
      if (video.videoWidth && canvas) {
        const w = 720;
        const h = Math.round((video.videoHeight / video.videoWidth) * w);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const found = readCardsInFrame(ctx, w, h, jsQR);
          const due: CardRead[] = [];
          const t = performance.now();
          let grew = false;
          for (const [k, letter] of Object.entries(found)) {
            const n = Number(k);
            if (!seenSet.has(n)) {
              seenSet.add(n);
              grew = true;
            }
            if (sentLetter[n] !== letter || t - (sentAt[n] ?? 0) > RESEND_MS) {
              sentLetter[n] = letter;
              sentAt[n] = t;
              due.push({ n, letter });
            }
          }
          if (grew) setSeen([...seenSet].sort((a, b) => a - b));
          if (due.length && open)
            void channel.send({
              type: "broadcast",
              event: READ_EVENT,
              payload: { reads: due },
            });
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);

    stopRef.current = () => {
      running = false;
      window.clearInterval(hello);
      stream.getTracks().forEach((tr) => tr.stop());
      void lock?.release().catch(() => {});
      void supabase.removeChannel(channel);
      setStatus("ready");
      setLinked(false);
    };
  };

  if (!isRoomCode(room)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#064E3B] px-6 text-center text-white">
        <div className="max-w-sm">
          <h1 className="text-2xl font-black">Scan answer cards</h1>
          <p className="mt-3 text-white/75">
            Open this page from the class screen: a lesson plan, a week, then{" "}
            <b>Answer Cards</b>. Point your phone&rsquo;s camera at the QR code it
            shows.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#064E3B] text-white">
      <header className="flex items-center gap-3 px-4 pb-2 pt-3">
        <span className="rounded bg-[#FACC15] px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#064E3B]">
          Cards
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold">
          {round ? `Question ${round.q} of ${round.of}` : "Answer cards"}
        </p>
        <span
          className={`flex items-center gap-1.5 text-[12px] font-bold ${
            linked ? "text-[#FACC15]" : "text-white/50"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${linked ? "bg-[#FACC15]" : "bg-white/30"}`}
          />
          {linked ? "Linked" : "Not linked"}
        </span>
      </header>

      <div className="relative mx-4 overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-[55vh] w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {status !== "scanning" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            {status === "ready" && (
              <button
                onClick={() => void start()}
                className="rounded-2xl bg-[#FACC15] px-6 py-4 text-lg font-black text-[#064E3B]"
              >
                Start scanning
              </button>
            )}
            {status === "starting" && (
              <p className="text-white/80">Starting the camera…</p>
            )}
            {status === "denied" && (
              <div>
                <p className="font-bold">The camera was blocked.</p>
                <p className="mt-2 text-[13px] text-white/70">
                  iPhone: Settings, Safari, Camera, Allow. Android: tap the icon
                  beside the address, then Camera, Allow. Then try again.
                </p>
                <button
                  onClick={() => void start()}
                  className="mt-4 rounded-xl bg-[#FACC15] px-5 py-3 font-black text-[#064E3B]"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 px-4 pb-6 pt-4">
        {status === "scanning" && (
          <>
            <p className="text-sm text-white/80">
              {round && !round.open ? (
                "Answer shown. Wait for the next question."
              ) : (
                <>
                  Walk slowly past the class.{" "}
                  <b className="text-white">{seen.length}</b>{" "}
                  {seen.length === 1 ? "card" : "cards"} read.
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {seen.map((n) => (
                <span
                  key={n}
                  className="grid h-9 min-w-9 place-items-center rounded-lg bg-white/15 px-2 text-sm font-black"
                >
                  {n}
                </span>
              ))}
            </div>
            <button
              onClick={() => stopRef.current()}
              className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold"
            >
              Stop
            </button>
          </>
        )}
        <p className="mt-4 text-[12px] text-white/40">Room {room}</p>
      </div>
    </main>
  );
}
