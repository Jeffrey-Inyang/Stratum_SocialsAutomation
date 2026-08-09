// Each function takes a plain-object slide spec and returns the inner HTML
// for that slide type. Keep copy short: cover titles read best under 6 words,
// statement headlines under ~12 words, stat captions under ~10 words.

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Real SVG arrow instead of the "→" text glyph. The glyph looked off-center
// because font metrics for arrow characters aren't visually centered in
// their em box, flexbox was centering the box, not the ink. An SVG path
// centers exactly where drawn, no font-metric guesswork.
const ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// type: "cover" — the opening hook slide. bgImage is a local file path or URL
// to the book/film/album cover art driving the hook (falls back to a flat
// gradient if omitted). Aim for 2 short lines (~4 words each) for the best
// look, but the title auto-shrinks by measuring actual rendered width
// (not just character count) so it can never overflow into extra lines.
function cover({ kicker = 'Stratum', eyebrow = '', title, sub = '', bgImage = '', dotCount = 8 }) {
  const bg = bgImage ? `url('${bgImage}')` : 'linear-gradient(135deg,#2b2b28,#57544c)';
  const dots = Array.from({ length: dotCount }, (_, i) =>
    `<span class="${i === 0 ? 'active' : ''}"></span>`).join('');
  return `
  <div class="tpl-cover" style="--bg-image:${bg}">
    <div class="kicker">${esc(kicker)}</div>
    <div class="swipe">${ARROW_SVG}</div>
    <div class="body">
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      <h1 id="cover-title"><span id="cover-title-text">${title}</span></h1>
      ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
    </div>
    <div class="dots">${dots}</div>
  </div>
  <script>
    (function(){
      var h1 = document.getElementById('cover-title');
      var span = document.getElementById('cover-title-text');
      // Lines intended by whoever wrote the copy = number of <br> tags + 1.
      // Measuring line boxes (not just width) catches the real bug: normal
      // text wraps automatically instead of overflowing, so a too-long
      // segment silently becomes 3-4 lines rather than spilling sideways.
      var desiredLines = (span.innerHTML.match(/<br\\s*\\/?>/gi) || []).length + 1;
      function fit(){
        var size = 136;
        h1.style.fontSize = size + 'px';
        function lineCount(){ return span.getClientRects().length; }
        while (lineCount() > desiredLines && size > 56) {
          size -= 2;
          h1.style.fontSize = size + 'px';
        }
      }
      // Run only after the web font has actually finished loading. Fitting
      // against a temporary fallback font (during load, or if the font
      // request is ever blocked/slow) measures the wrong glyph widths and
      // locks in a size that's too small once the real font swaps in.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function(){ fit(); h1.dataset.fitted = 'true'; });
      } else {
        fit();
        h1.dataset.fitted = 'true';
      }
    })();
  </script>`;
}

// type: "statement" — informational / data body slide.
function statement({ index = '', byline = '', title, footerRight = 'Stratum' }) {
  return `
  <div class="tpl-statement">
    ${index ? `<div class="index">${esc(index)}</div>` : ''}
    <div class="swipe">${ARROW_SVG}</div>
    ${byline ? `<div class="byline">${esc(byline)}</div>` : ''}
    <div class="body"><h1>${title}</h1></div>
    <div class="footer"><span>Stratum</span><span>${esc(footerRight)}</span></div>
  </div>`;
}

// type: "stat" — the "X people rated this exactly like you" signature slide.
function stat({ kicker = 'Rated On Stratum', number, caption, index = '' }) {
  const numStr = String(number);
  // Safety net: auto-shrink the number if it's unexpectedly long (e.g. a
  // placeholder got left in, or a count grows past 6 digits) so it never
  // overflows the frame instead of failing silently at 170px.
  const size = numStr.length <= 6 ? 170 : Math.max(48, Math.floor(170 * 6 / numStr.length));
  return `
  <div class="tpl-stat">
    <div class="kicker">${esc(kicker)}</div>
    <div class="swipe">${ARROW_SVG}</div>
    <div class="rings">
      <svg viewBox="0 0 340 220" fill="none">
        <circle cx="130" cy="110" r="95" stroke="#FAFAF8" stroke-width="2" opacity="0.9"/>
        <circle cx="210" cy="110" r="95" stroke="#FAFAF8" stroke-width="2" opacity="0.5"/>
      </svg>
    </div>
    <div class="num" style="font-size:${size}px">${esc(numStr)}</div>
    <div class="cap">${esc(caption)}</div>
    <div class="footer"><span>Stratum</span><span>Swipe</span></div>
  </div>`;
}

// type: "quote" — a single relatable line, set big, breaks up the visual
// rhythm so every carousel doesn't read as the same three beats in the
// same order. Best used in place of "statement" every few carousels.
function quote({ index = '', line, footerRight = 'Stratum' }) {
  return `
  <div class="tpl-quote">
    ${index ? `<div class="index">${esc(index)}</div>` : ''}
    <div class="swipe">${ARROW_SVG}</div>
    <div class="mark">&#8220;</div>
    <div class="body"><p>${line}</p></div>
    <div class="footer"><span>Stratum</span><span>${esc(footerRight)}</span></div>
  </div>`;
}

// type: "prompt" — a direct question or call-to-action to the viewer,
// designed to sit right before the closing waitlist slide and drive
// comments/duets rather than just being read and swiped past.
function prompt({ index = '', eyebrow = '', title }) {
  return `
  <div class="tpl-prompt">
    ${index ? `<div class="index">${esc(index)}</div>` : ''}
    <div class="inner">
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      <h1>${title}</h1>
    </div>
    <div class="footer"><span>Stratum</span><span>Drop Yours Below</span></div>
  </div>`;
}

module.exports = { cover, statement, stat, quote, prompt };