/// <reference types="vite/client" />

/* What the browser is allowed to know.
 *
 *  Only these two, and only because the answer-card game needs a Supabase
 *  broadcast channel from the browser: a phone reads the room, the board shows
 *  the question. The anon key is public by design and reaches no table this
 *  app keeps — every table is served by this app's own server with the secret
 *  key, which never leaves it. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
