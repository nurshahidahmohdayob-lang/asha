/* The ONLY Supabase the browser is trusted with.
 *
 *  Everything this app stores goes through its own /api/data/* endpoints with
 *  the teacher's sign-in token, and the service key never leaves the server.
 *  That stays true. This client exists for one thing: the answer-card game,
 *  where a phone reading the room and the board showing the question meet in a
 *  Supabase broadcast channel. Broadcast carries no rows and touches no table.
 *
 *  The key here is the anon key, which is public by design — it is what any
 *  browser would be given — and it reaches no table this app keeps, because
 *  every table is served by the server instead. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Whether the phone relay can work at all. Without it the game still runs
 *  on the board's own camera, so this is a question, not an error. */
export const relayConfigured = (): boolean => Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function browserSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("The answer-card relay is not configured for this site.");
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // One message a card, many cards a second — but only while a question
      // is open, and nothing is ever written down.
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}
