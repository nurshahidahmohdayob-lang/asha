/* ═══════════ The phone in the teacher's hand, the class screen ═════════
   The question is on the projector from the laptop; the teacher walks the
   room with a phone. The two meet in a Supabase broadcast channel named by a
   code that lives only as long as the game. Nothing is written to a table and
   nothing is kept: a reading goes from the phone's camera to the class screen
   and is gone. */

/** A card the phone has read: its number, and which letter was at the top. */
export type CardRead = { n: number; letter: number };
/** What the class screen tells the phone: which question, and whether it is
 *  still open for answers. */
export type RoundInfo = { q: number; of: number; open: boolean };

export const READ_EVENT = "read";
export const HELLO_EVENT = "hello";
export const ROUND_EVENT = "round";

export const relayChannel = (room: string) => `cards:${room}`;

/** No 0, O, 1, I or L: a code read off a projector has to survive being read aloud. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const isRoomCode = (s: string | null): s is string =>
  !!s && /^[A-HJKMNP-Z2-9]{6}$/.test(s);

export const scanUrl = (origin: string, room: string) => `${origin}/scan?c=${room}`;
