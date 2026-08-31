/** The projected lesson as ONE file that looks exactly like the projection.
 *
 *  The slides are the deck's OWN markup, copied out of the running deck, and
 *  the page carries the app's own stylesheet — so the file is the lesson as it
 *  is on the board, not a second rendering of it. Writing the slides again by
 *  hand produced a near-miss: different type, different colours, different
 *  layout, and it would have drifted further with every change to the deck.
 *
 *  What is added on top is behaviour. React's event handlers do not survive
 *  being copied out as HTML, so the handful of things a lesson does — ticking
 *  a criterion, answering a question, revealing a story's answer — are
 *  reattached by matching the deck's own classes.
 */

/** Every rule the page is using, inlined so the file needs no network.
 *
 *  Same-origin sheets only. A cross-origin one cannot be read at all, and
 *  there are none here that matter — the fonts are system faces by design. */
function collectCss(): string {
  const out: string[] = [];
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i] as CSSStyleSheet;
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (let j = 0; j < rules.length; j++) out.push(rules[j].cssText);
    } catch {
      /* cross-origin sheet — not readable, and not ours */
    }
  }
  return out.join("\n");
}

export function buildProjectedDeckHTML(
  slidesMarkup: string[],
  title: string,
): string {
  const esc = (v: any) =>
    (v ?? "")
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const slides = slidesMarkup
    .map((m, i) => `<section class="zx-slide" data-i="${i}">${m}</section>`)
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${collectCss()}</style>
<style>
  /* The shell around the captured slides. Everything inside them is styled by
     the app's own rules above. */
  html,body{margin:0;background:#063A1E}
  .zx-stage{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px 20px 88px}
  .zx-slide{display:none}
  .zx-slide.on{display:block}
  /* The slide was captured at projector size; scale it to whatever screen it
     is opened on rather than letting it overflow. */
  .zx-slide > div{transform-origin:top left;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.45)}
  .zx-bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;align-items:center;justify-content:center;
          padding:12px;background:rgba(6,58,30,.72)}
  .zx-bar button{font:inherit;font-family:system-ui,sans-serif;font-size:.72rem;font-weight:800;text-transform:uppercase;
                 letter-spacing:.09em;border:0;border-radius:12px;padding:10px 16px;cursor:pointer;
                 background:rgba(255,255,255,.16);color:#fff}
  .zx-bar button:hover{background:rgba(255,255,255,.3)}
  .zx-bar .go{background:#F7B917;color:#3a2b00}
  .zx-bar span{color:#fff;opacity:.75;font-size:.72rem;margin:0 6px;font-weight:700;font-family:system-ui,sans-serif}
  /* Ticked and answered states, drawn the way the deck draws them. */
  .zx-ticked{background:#0A4F29 !important;border-color:#0A4F29 !important;color:#fff !important}
  .zx-right{outline:3px solid #0A4F29;outline-offset:2px}
  .zx-wrong{opacity:.45}
  .zx-picked{outline:3px solid #F7B917;outline-offset:2px;opacity:1}
  @media print{
    body{background:#fff}.zx-bar{display:none}
    .zx-stage{display:block;padding:0;min-height:0}
    .zx-slide{display:block !important;page-break-after:always}
    .zx-slide > div{transform:none !important;box-shadow:none;border-radius:0}
  }
</style></head>
<body>
<div class="zx-stage">${slides}</div>
<div class="zx-bar">
  <button onclick="zxGo(-1)">&#8592; Back</button>
  <span id="zx-count"></span>
  <button onclick="zxGo(1)">Next &#8594;</button>
  <button class="go" onclick="zxFull()">Fullscreen</button>
  <button onclick="window.print()">Print</button>
</div>
<script>
(function(){
  var slides = [].slice.call(document.querySelectorAll('.zx-slide')), at = 0;
  function fit(){
    var s = slides[at]; if (!s) return;
    var inner = s.firstElementChild; if (!inner) return;
    // Captured at 1280x720. Fit it to the window without cropping.
    var pad = 40, barH = 88;
    var k = Math.min((window.innerWidth - pad) / 1280, (window.innerHeight - barH - pad) / 720);
    inner.style.transform = 'scale(' + k + ')';
    s.style.width = (1280 * k) + 'px';
    s.style.height = (720 * k) + 'px';
  }
  window.zxShow = function(n){
    at = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function(s,i){ s.classList.toggle('on', i === at); });
    document.getElementById('zx-count').textContent = (at + 1) + ' / ' + slides.length;
    fit();
  };
  window.zxGo = function(d){ zxShow(at + d); };
  window.zxFull = function(){
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };
  window.addEventListener('resize', fit);
  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); zxGo(1); }
    if (e.key === 'ArrowLeft'  || e.key === 'PageUp')  { e.preventDefault(); zxGo(-1); }
    if (e.key === 'Home') zxShow(0);
    if (e.key === 'End')  zxShow(slides.length - 1);
    if (e.key === 'f') zxFull();
  });

  /* React's handlers do not survive being copied out, so the lesson's own
     behaviour is written again here, driven by the data- attributes the deck
     puts on the parts that do something. Anything not recognised falls back
     to marking what was tapped, which is the right failure: a slide that was
     only ever read still reads. */

  /* ── Tap to see the question ──────────────────────────────────────────
     The text was never in the copied markup — it lived in React state — so
     the deck now carries it on the element and this puts it on screen. */
  function reveal(btn){
    var text = btn.getAttribute('data-zx-reveal');
    if (text === null || btn.hasAttribute('data-zx-shown')) return;
    btn.setAttribute('data-zx-shown', '');
    btn.className = btn.className
      .replace(/border-dashed|border-silver|bg-white|hover:[^\\s]+/g, '')
      .trim() + ' border-brand-300 bg-brand-50 shadow-xl';
    var span = document.createElement('span');
    span.className = 'anim-pop block text-2xl font-semibold leading-snug text-brand-900 sm:text-3xl';
    span.textContent = text;
    btn.innerHTML = '';
    btn.appendChild(span);
  }

  /* ── The timer ────────────────────────────────────────────────────────
     A whole clock, because a picture of one is no use to a class. */
  function wireTimer(root){
    if (root.hasAttribute('data-zx-live')) return;
    root.setAttribute('data-zx-live', '');

    var ring   = root.querySelector('[data-zx-timer-ring]');
    var face   = root.querySelector('[data-zx-timer-face]');
    var toggle = root.querySelector('[data-zx-timer-toggle]');
    var reset  = root.querySelector('[data-zx-timer-reset]');
    var presets = [].slice.call(root.querySelectorAll('[data-zx-timer-preset]'));
    if (!face || !toggle) return;

    var C = ring ? parseFloat(ring.getAttribute('data-zx-timer-ring')) : 0;
    var total = parseInt(root.getAttribute('data-zx-timer'), 10) || 180;
    var left = total, running = false, tick = null;

    function paint(){
      var done = left === 0;
      var two = function(n){ return (n < 10 ? '0' : '') + n; };
      face.textContent = done ? 'Time!' : two(Math.floor(left / 60)) + ':' + two(left % 60);
      if (ring) {
        var pct = total > 0 ? left / total : 0;
        ring.setAttribute('stroke-dashoffset', String(C * (1 - pct)));
        ring.setAttribute('stroke', done || left <= 10 ? '#f7b917' : '#0a4f29');
      }
      // The label is the second text node in the button; the icon is an svg
      // and is left alone.
      var label = [].filter.call(toggle.childNodes, function(n){
        return n.nodeType === 3 && n.textContent.trim();
      })[0];
      if (label) label.textContent = done ? 'Again' : running ? 'Pause' : 'Start';
      presets.forEach(function(b){
        var mine = parseInt(b.getAttribute('data-zx-timer-preset'), 10) * 60 === total;
        b.style.background = mine ? '#0a4f29' : '';
        b.style.color = mine ? '#fff' : '';
      });
    }
    function stop(){ if (tick) { clearInterval(tick); tick = null; } }
    function run(){
      stop();
      tick = setInterval(function(){
        left = Math.max(0, left - 1);
        if (left === 0) { running = false; stop(); }
        paint();
      }, 1000);
    }
    function set(mins, start){
      total = mins * 60; left = total; running = !!start;
      running ? run() : stop();
      paint();
    }

    toggle.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      if (left === 0) { set(total / 60, true); return; }
      running = !running;
      running ? run() : stop();
      paint();
    });
    if (reset) reset.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      running = false; stop(); left = total; paint();
    });
    presets.forEach(function(b){
      b.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        set(parseInt(b.getAttribute('data-zx-timer-preset'), 10), false);
      });
    });
    paint();
  }
  /* The lesson goes up BEFORE any of this. Every slide is hidden until
     zxShow marks one, so anything that threw on the way to it left a blank
     file — which is exactly what one stray apostrophe in a string did. The
     slides no longer depend on the widgets working. */
  zxShow(0);

  function wireAll(sel, fn){
    [].forEach.call(document.querySelectorAll(sel), function(el){
      // One widget that cannot be wired must not take the others with it.
      try { fn(el); } catch (err) { }
    });
  }
  wireAll('[data-zx-timer]', wireTimer);

  /* ── Tap a word, then tap its picture ─────────────────────────────────
     Both columns came across in the markup; which word goes with which
     picture did not, because the pairing lived in the deck's click handler.
     The elements now name their pair, so the match can be checked here. */
  function wireMatch(root){
    if (root.hasAttribute('data-zx-live')) return;
    root.setAttribute('data-zx-live', '');

    var words = [].slice.call(root.querySelectorAll('[data-zx-match]'));
    var faces = [].slice.call(root.querySelectorAll('[data-zx-face]'));
    var msg = root.querySelector('[data-zx-match-msg]');
    var picked = null, matched = [];
    function say(t){ if (msg) msg.textContent = t; }
    function isDone(label){ return matched.indexOf(label) > -1 };

    function markDone(el){
      el.className = el.className.replace(/border-dashed|border-silver|bg-white|border-sky/g, '')
        + ' border-brand-600 bg-brand-50';
    }

    words.forEach(function(w){
      w.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        var label = w.getAttribute('data-zx-match');
        if (isDone(label)) return;
        // Only one word is held at a time, the way the deck holds it.
        words.forEach(function(o){
          if (!isDone(o.getAttribute('data-zx-match')))
            o.className = o.className.replace(/\\sborder-sky|\\sbg-\\[#eaf4f7\\]/g, '');
        });
        picked = label;
        w.className += ' border-sky bg-[#eaf4f7]';
        say('Now tap the picture for ' + label + '.');
      });
    });

    faces.forEach(function(f){
      f.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        var label = f.getAttribute('data-zx-face');
        if (isDone(label)) return;
        if (!picked) { say('Tap a word first.'); return; }
        if (picked === label) {
          matched.push(label);
          markDone(f);
          words.forEach(function(w){
            if (w.getAttribute('data-zx-match') === label) markDone(w);
          });
          picked = null;
          say(matched.length === faces.length
            ? '\uD83C\uDF89 All matched! Well done.'
            : "\u{1F389} Yes! That is a match.");
        } else {
          // Wobble, the same class the deck uses, then settle.
          f.classList.add('anim-wiggle');
          setTimeout(function(){ f.classList.remove('anim-wiggle'); }, 400);
          say('Not that one — try again.');
        }
      });
    });
  }
  wireAll('[data-zx-match-game]', wireMatch);

  /* ── The spinner ──────────────────────────────────────────────────────
     One item is ever on screen, so the pool travels with it as data. */
  function wireSpinner(root){
    if (root.hasAttribute('data-zx-live')) return;
    root.setAttribute('data-zx-live', '');

    var pool = [];
    try { pool = JSON.parse(root.getAttribute('data-zx-spin') || '[]'); } catch (err) { pool = []; }
    var face  = root.querySelector('[data-zx-spin-face]');
    var label = root.querySelector('[data-zx-spin-label]');
    var go    = root.querySelector('[data-zx-spin-go]');
    if (!go || !face || !label || !pool.length) return;

    var spinning = false;
    go.addEventListener('click', function(e){
      e.preventDefault(); e.stopPropagation();
      if (spinning) return;
      spinning = true;
      go.style.opacity = '.6';
      var ticks = 0;
      // Ten flicks at 80ms, the same as the deck, so it reads as a spin
      // rather than an answer appearing.
      var id = setInterval(function(){
        var pick = pool[Math.floor(Math.random() * pool.length)];
        face.textContent = pick.emoji;
        label.textContent = pick.label;
        if (++ticks >= 10) {
          clearInterval(id);
          spinning = false;
          go.style.opacity = '';
        }
      }, 80);
    });
  }
  wireAll('[data-zx-spin]', wireSpinner);

  document.addEventListener('click', function(e){
    if (!e.target || !e.target.closest) return;
    var btn = e.target.closest('.zx-slide button');
    if (!btn) return;
    // These wire their own buttons and have already handled the tap.
    if (btn.closest('[data-zx-timer]')) return;
    if (btn.closest('[data-zx-match-game]')) return;
    if (btn.closest('[data-zx-spin]')) return;

    if (btn.hasAttribute('data-zx-reveal')) { reveal(btn); return; }

    // A quiz option: mark the whole question once, the way the deck does,
    // so a wrong answer stays on screen to be talked about.
    if (btn.hasAttribute('data-zx-answer')) {
      var list = btn.closest('ul');
      if (!list || list.hasAttribute('data-zx-answered')) return;
      list.setAttribute('data-zx-answered', '');
      [].forEach.call(list.querySelectorAll('[data-zx-answer]'), function(o){
        if (o.getAttribute('data-zx-answer') === 'right') o.classList.add('zx-right');
        else if (o !== btn) o.classList.add('zx-wrong');
      });
      if (btn.getAttribute('data-zx-answer') === 'wrong') btn.classList.add('zx-picked');
      return;
    }

    // Everything else the class taps — a criterion to tick off, a card to
    // turn — is marked as chosen.
    btn.classList.toggle('zx-ticked');
  });
})();
</script>
</body></html>`;
}

import type { LessonPlan, WeeklyPlan, LessonActivityPack, SlideContent } from "../types";

/** The lesson written out from its own content — the fallback for when
 *  the slides could not be copied out of the running deck.
 *
 *  Plainer than the projection, and honest about it: it opens, it presents,
 *  it prints. Better than handing a teacher nothing.
 *
 *  Original note follows.
 *
 *  The projected lesson as ONE interactive HTML file.
 *
 *  Not pictures of the slides. The lesson is meant to be used — the criteria
 *  are ticked as the class meets them, the quiz is answered and marked, the
 *  story's questions are revealed one at a time — and a photograph does none
 *  of that. This writes the lesson's own content into a page that does.
 *
 *  Everything is inline: no framework, no fonts to fetch, no network. It opens
 *  from a memory stick on a classroom machine that has never seen this app.
 *  Pictures are the exception — those are URLs the pack already holds, so a
 *  machine with no network shows the emoji the tile was built around instead.
 */

const esc = (v: any) =>
  (v ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Activities and objectives arrive as one string with newlines or bullets. */
const lines = (v: any): string[] =>
  (v ?? "")
    .toString()
    .split(/\r?\n|(?:^|\s)[•\-–]\s+/)
    .map((l) => l.trim())
    .filter(Boolean);

const tile = (t: any) =>
  `<div class="tile">${
    t?.image
      ? `<img src="${esc(t.image)}" alt="">`
      : `<span class="emoji">${esc(t?.emoji || "✨")}</span>`
  }<span class="tile-label">${esc(t?.label || "")}</span></div>`;

const slide = (kicker: string, body: string, feature = false) =>
  `<section class="slide${feature ? " feature" : ""}"><div class="kicker">${esc(
    kicker,
  )}</div><div class="body">${body}</div></section>`;

export function buildInteractiveDeckHTML(
  plan: LessonPlan,
  week: WeeklyPlan,
  pack?: LessonActivityPack,
  studioSlides: SlideContent[] = [],
): string {
  const title =
    [plan?.subject, plan?.class, week?.week && `Week ${week.week}`]
      .filter(Boolean)
      .join(" · ") || "Lesson";
  const focus =
    (week?.subTopic || week?.topic || plan?.overallTopic || "Today's lesson").trim();

  const out: string[] = [];

  // 1 · Title
  out.push(
    slide(
      [plan?.subject, plan?.class, plan?.term && `Term ${plan.term}`]
        .filter(Boolean)
        .join(" · "),
      `<h1>${esc(focus)}</h1>${
        week?.unit ? `<p class="lede">${esc(week.unit)}</p>` : ""
      }`,
      true,
    ),
  );

  // 2 · Do now
  if (week?.introduction?.trim()) {
    out.push(slide("Let's begin", `<h2>Do now</h2><p class="lede">${esc(week.introduction)}</p>`));
  }

  // 3 · The big idea, then the teaching itself
  if (pack?.bigIdea?.title) {
    out.push(
      slide(
        "Let's learn",
        `<h2>${esc(pack.bigIdea.title)}</h2>${
          pack.bigIdea.explain ? `<p class="lede">${esc(pack.bigIdea.explain)}</p>` : ""
        }`,
      ),
    );
  }
  (pack?.teach || []).forEach((t: any, i: number) => {
    out.push(
      slide(
        `Teaching ${i + 1} of ${(pack?.teach || []).length}`,
        `<div class="split"><div class="art">${
          t?.image ? `<img src="${esc(t.image)}" alt="">` : `<span class="emoji big">${esc(t?.emoji || "✨")}</span>`
        }</div><div><h2>${esc(t?.title)}</h2>${(t?.lines || [])
          .map((l: string) => `<p class="lede">${esc(l)}</p>`)
          .join("")}</div></div>`,
      ),
    );
  });
  if (pack?.keyIdeas?.length) {
    out.push(
      slide(
        "The things we are learning",
        `<div class="tiles">${pack.keyIdeas.map(tile).join("")}</div>`,
      ),
    );
  }
  if (pack?.sequence?.steps?.length) {
    out.push(
      slide(
        pack.sequence.title || "How it changes",
        `<div class="tiles seq">${pack.sequence.steps.map(tile).join("")}</div>`,
      ),
    );
  }

  // 4 · Story, with answers revealed on tap
  if (pack?.story?.scenes?.length) {
    out.push(
      slide(
        pack.story.title || "Story time",
        `<div class="tiles">${pack.story.scenes.map(tile).join("")}</div>`,
      ),
    );
    (pack.story.questions || []).forEach((q: any) => {
      out.push(
        slide(
          "What the story showed us",
          `<h2>${esc(q?.q)}</h2><button class="reveal" data-answer="${esc(
            q?.a,
          )}">Show the answer</button>`,
        ),
      );
    });
  }

  // 5 · Talk it over
  if (pack?.discussion?.length) {
    out.push(
      slide(
        "Talk it over",
        `<ul class="big-list">${pack.discussion
          .map((d: string) => `<li>${esc(d)}</li>`)
          .join("")}</ul>`,
      ),
    );
  }

  // 6 · The week's own activities
  const acts = lines(week?.activities);
  acts.forEach((a, i) =>
    out.push(
      slide(
        acts.length > 1 ? `Activity ${i + 1} of ${acts.length}` : "Activity",
        `<p class="lede big">${esc(a)}</p>`,
      ),
    ),
  );

  // 7 · Slide Studio's own slides, as written
  studioSlides
    .filter((s: any) => s && (s.title?.trim() || s.content?.length))
    .forEach((s: any) =>
      out.push(
        slide(
          "From your slides",
          `<h2>${esc(s.title)}</h2>${
            (s.content || []).length
              ? `<ul class="big-list">${(s.content || [])
                  .map((c: string) => `<li>${esc(c)}</li>`)
                  .join("")}</ul>`
              : ""
          }`,
        ),
      ),
    );

  // 8 · Quiz — tap to answer, marked as you go
  (pack?.questions || []).forEach((q: any, i: number) => {
    const opts = (q?.options || [])
      .map(
        (o: string, oi: number) =>
          `<button class="opt" data-correct="${oi === q?.correctIndex ? "1" : "0"}">${esc(o)}</button>`,
      )
      .join("");
    out.push(
      slide(
        `Question ${i + 1} of ${(pack?.questions || []).length}`,
        `<h2>${esc(q?.text)}</h2><div class="opts">${opts}</div>${
          q?.why ? `<p class="why" hidden>${esc(q.why)}</p>` : ""
        }`,
      ),
    );
  });

  // 9 · Recall
  if (pack?.review?.length) {
    out.push(
      slide(
        "Before we finish",
        `<ul class="big-list">${pack.review
          .map((r: string) => `<li>${esc(r)}</li>`)
          .join("")}</ul>`,
      ),
    );
  }

  // 10 · Exit ticket
  if (week?.assessment?.trim()) {
    out.push(slide("Exit ticket", `<h2>Show me what you know</h2><p class="lede">${esc(week.assessment)}</p>`));
  }

  // 11 · Well done
  if (pack?.celebrate?.title) {
    out.push(
      slide(
        "Well done",
        `<h1>${esc(pack.celebrate.title)}</h1>${
          pack.celebrate.line ? `<p class="lede">${esc(pack.celebrate.line)}</p>` : ""
        }`,
        true,
      ),
    );
  }

  // Last · The goal board, ticked from memory now the lesson has been taught
  const criteria = lines(week?.learningObjective).concat(lines((week as any)?.successCriteria));
  out.push(
    slide(
      "What we learned",
      `<h2>${esc(week?.learningObjective?.trim() || focus)}</h2>${
        criteria.length
          ? `<p class="sub">We'll know we've done it when… <span class="hint">tap each one</span></p>
             <div class="checks">${criteria
               .map((c) => `<button class="check"><span class="box"></span><span>${esc(c)}</span></button>`)
               .join("")}</div>
             <p class="tally"><span id="ticked">0</span> of ${criteria.length} ticked</p>`
          : ""
      }`,
    ),
  );

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root{
    --paper:#FAF5E9; --card:#FFFDF6; --ink:#16221B; --ink-soft:#4C5B51;
    --forest:#0A4F29; --forest-2:#063A1E; --gold:#F7B917; --line:rgba(22,34,27,.14);
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--forest-2);color:var(--ink);
       font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  h1,h2{font-family:var(--serif);font-weight:600;letter-spacing:-.015em;margin:0 0 .4em}
  h1{font-size:clamp(2.2rem,6vw,4.4rem);line-height:1.02}
  h2{font-size:clamp(1.5rem,3.4vw,2.7rem);line-height:1.1}
  .stage{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 24px 92px}
  .slide{display:none;width:min(1180px,100%);min-height:min(64vh,640px);background:var(--card);
         border-radius:24px;padding:clamp(24px,4vw,56px);box-shadow:0 24px 60px rgba(0,0,0,.35)}
  .slide.on{display:block}
  .slide.feature{background:linear-gradient(155deg,#0B5730,var(--forest-2));color:#F6EFDC}
  .slide.feature h1,.slide.feature h2{color:#F6EFDC}
  .slide.feature .lede{color:rgba(246,239,220,.78)}
  .kicker{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.14em;
          color:var(--forest);opacity:.75;margin-bottom:1.2rem}
  .slide.feature .kicker{color:var(--gold);opacity:1}
  .lede{font-size:clamp(1rem,1.7vw,1.5rem);line-height:1.5;color:var(--ink-soft);margin:.3em 0}
  .lede.big{font-size:clamp(1.2rem,2.4vw,2rem);color:var(--ink)}
  .sub{font-weight:700;color:var(--forest);margin:1.2rem 0 .2rem}
  .hint{font-weight:600;color:var(--ink-soft);opacity:.7;font-size:.85em}
  .split{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.6fr);gap:clamp(18px,3vw,42px);align-items:center}
  .art{display:grid;place-items:center}
  .art img{max-width:100%;max-height:38vh;border-radius:18px}
  .emoji{font-size:2.6rem;line-height:1}
  .emoji.big{font-size:clamp(4rem,11vw,8rem)}
  .tiles{display:flex;flex-wrap:wrap;gap:clamp(12px,2vw,24px)}
  .tiles.seq .tile:not(:last-child)::after{content:"→";position:absolute;right:-1.1em;top:50%;
       transform:translateY(-50%);color:var(--forest);opacity:.5;font-size:1.4rem}
  .tile{position:relative;flex:1 1 150px;max-width:230px;background:var(--paper);border:1px solid var(--line);
        border-radius:18px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:.5rem;text-align:center}
  .tile img{width:100%;height:110px;object-fit:contain}
  .tile-label{font-weight:700;font-size:clamp(.85rem,1.3vw,1.05rem)}
  .big-list{margin:0;padding-left:1.1em;font-size:clamp(1rem,1.9vw,1.6rem);line-height:1.5}
  .big-list li{margin-bottom:.5em}
  .opts{display:grid;gap:12px;margin-top:1.2rem}
  .opt{font:inherit;font-size:clamp(1rem,1.7vw,1.4rem);font-weight:700;text-align:left;cursor:pointer;
       background:var(--paper);border:2px solid var(--line);border-radius:16px;padding:14px 18px;color:inherit}
  .opt:hover{border-color:var(--forest)}
  .opt.right{background:#E8F5EC;border-color:var(--forest);color:var(--forest)}
  .opt.wrong{background:#FDECEC;border-color:#B4423C;color:#8C332E}
  .why{margin-top:1rem;font-weight:700;color:var(--forest)}
  .checks{display:grid;gap:12px;margin-top:.6rem}
  .check{font:inherit;font-size:clamp(1rem,1.7vw,1.4rem);font-weight:700;text-align:left;cursor:pointer;
         background:var(--paper);border:2px solid var(--line);border-radius:16px;padding:14px 18px;
         display:flex;align-items:center;gap:14px;color:inherit}
  .check .box{width:28px;height:28px;border-radius:9px;border:2px solid var(--line);flex:0 0 auto}
  .check.done{background:#E8F5EC;border-color:var(--forest)}
  .check.done .box{background:var(--forest);border-color:var(--forest);position:relative}
  .check.done .box::after{content:"✓";color:#fff;position:absolute;inset:0;display:grid;place-items:center;font-weight:900}
  .tally{margin-top:1rem;font-weight:800;color:var(--forest)}
  .reveal{font:inherit;font-weight:800;cursor:pointer;background:var(--gold);color:#3a2b00;border:0;
          border-radius:999px;padding:12px 22px;font-size:1rem;margin-top:1rem}
  .answer{margin-top:1rem;font-size:clamp(1rem,1.7vw,1.4rem);font-weight:700;color:var(--forest)}
  .bar{position:fixed;left:0;right:0;bottom:0;display:flex;gap:10px;align-items:center;justify-content:center;
       padding:12px;background:rgba(6,58,30,.72);backdrop-filter:blur(6px)}
  .bar button{font:inherit;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;
              border:0;border-radius:12px;padding:10px 16px;cursor:pointer;background:rgba(255,255,255,.16);color:#fff}
  .bar button:hover{background:rgba(255,255,255,.3)}
  .bar .go{background:var(--gold);color:#3a2b00}
  .bar span{color:#fff;opacity:.75;font-size:.72rem;margin:0 6px;font-weight:700}
  @media print{
    body{background:#fff}.bar{display:none}.stage{display:block;padding:0;min-height:0}
    .slide{display:block !important;page-break-after:always;box-shadow:none;border-radius:0;min-height:0}
  }
</style></head>
<body>
<div class="stage">${out.join("")}</div>
<div class="bar">
  <button onclick="go(-1)">&#8592; Back</button>
  <span id="count"></span>
  <button onclick="go(1)">Next &#8594;</button>
  <button class="go" onclick="full()">Fullscreen</button>
  <button onclick="window.print()">Print</button>
</div>
<script>
  var slides = [].slice.call(document.querySelectorAll('.slide')), at = 0;
  function show(n){
    at = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function(s,i){ s.classList.toggle('on', i === at); });
    document.getElementById('count').textContent = (at + 1) + ' / ' + slides.length;
  }
  function go(d){ show(at + d); }
  function full(){
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft'  || e.key === 'PageUp')  { e.preventDefault(); go(-1); }
    if (e.key === 'Home') show(0);
    if (e.key === 'End')  show(slides.length - 1);
    if (e.key === 'f') full();
  });
  // Tick a criterion off as the class meets it.
  document.addEventListener('click', function(e){
    var c = e.target.closest && e.target.closest('.check');
    if (c) {
      c.classList.toggle('done');
      var t = document.getElementById('ticked');
      if (t) t.textContent = document.querySelectorAll('.check.done').length;
      return;
    }
    // Answer a question. Marked at once, and the rest are shown so a class can
    // see WHY, not merely that they were wrong.
    var o = e.target.closest && e.target.closest('.opt');
    if (o && !o.parentNode.classList.contains('answered')) {
      o.parentNode.classList.add('answered');
      [].slice.call(o.parentNode.children).forEach(function(b){
        b.classList.add(b.dataset.correct === '1' ? 'right' : 'wrong');
      });
      var why = o.closest('.body').querySelector('.why');
      if (why) why.hidden = false;
      return;
    }
    var r = e.target.closest && e.target.closest('.reveal');
    if (r) {
      var a = document.createElement('p');
      a.className = 'answer';
      a.textContent = r.dataset.answer || '';
      r.replaceWith(a);
    }
  });
  show(0);
</script>
</body></html>`;
}
