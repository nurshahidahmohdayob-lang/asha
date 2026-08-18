import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      // Supabase. Both are safe in the browser: the anon key is public by
      // design and every table is guarded by row-level security. The
      // service_role key must NEVER appear here.
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || ''),
    },
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
