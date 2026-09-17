import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Read the whole .env, not only VITE_* — these two are named without the
  // prefix because the server uses them as well.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // The answer-card game needs a Supabase channel from the browser: a
      // phone reads the room, the board shows the question. Broadcast only —
      // no table is reachable with this, and the service key stays on the
      // server. See src/lib/browserSupabase.ts.
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
      ),
    },
    // NOTHING secret is defined here, and nothing secret should be.
    //
    // GEMINI_API_KEY used to be inlined into the browser bundle, which put a
    // live billable key in a file anyone could open in devtools. Generation
    // already runs server-side through /api/ai/*, so the browser has no use
    // for it; src/services/geminiService.ts now reads it lazily and only the
    // Node bundles ever find it there.
    //
    // No Supabase values are exposed either. The browser holds no database key
    // at all: it calls this app's own /api/data/* endpoints with the teacher's
    // Firebase ID token, and the server does the talking with the service_role
    // key. See server/data-api.ts.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      // The app is served at https://suite.test (Caddy reverse-proxies 443 →
      // this dev server on :3004). Vite blocks unknown Host headers in dev, so
      // the proxied hostname must be allow-listed or the page shows
      // "Blocked request. This host is not allowed."
      allowedHosts: ['suite.test', 'localhost', '127.0.0.1'],
      // HMR rides the SAME HTTPS proxy: the page loads over https, so the HMR
      // socket must be wss on 443 (mixed-content rules block ws:// from an https
      // page). server.ts shares its HTTP server with Vite's HMR so the websocket
      // upgrade reaches Vite through Caddy.
      hmr:
        process.env.DISABLE_HMR === 'true'
          ? false
          : {
              protocol: 'wss',
              host: 'suite.test',
              clientPort: 443,
            },
    },
  };
});
