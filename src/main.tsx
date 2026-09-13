import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/* A tab left open across a deploy is still running the build it loaded, and
   the pieces of that build it fetches later — the PDF export, the deck HTML —
   no longer exist once the new one is live. Vite raises this when one of
   them fails to load; reloading picks up the current build, whose pieces do
   exist. Once per session, so a genuinely missing file cannot loop. */
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('zera_reloaded_for_new_build')) return;
    sessionStorage.setItem('zera_reloaded_for_new_build', '1');
  } catch {
    // Storage unavailable: reload anyway — better once than a dead button.
  }
  event.preventDefault();
  window.location.reload();
});

/* Registering this is what makes a browser offer to install the suite, so it
   can be opened from a dock or a home screen like any other app. The worker
   itself is network-first and caches only the last page, so an installed copy
   never serves yesterday's build back.

   Registered after the app has painted: it is not needed to show anything, and
   fetching it during start-up competes with the bundle for the connection. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // An install that cannot be offered is a missing convenience, not a
      // broken app — so this is noted and nothing else happens.
      console.warn('Service worker registration failed:', err);
    });
  });
}
