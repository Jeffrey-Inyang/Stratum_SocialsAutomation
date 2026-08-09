// Renders each carousel defined in content.json to numbered PNG slides,
// ready to drop into your posting pipeline (steps 3-5).
//
// Setup:
//   npm install
//   npm run render
//
// Expects, next to this file:
//   Mockup/          your book/film/album art, named to match each cover
//                     slide's bgImage (e.g. "book_1"), any of
//                     .jpg/.jpeg/.png/.webp
//   closing-slide.png  your waitlist closing slide, auto-appended as the
//                       last image of every carousel
//
// Output:
//   out/<carousel-slug>/slide-01.png, slide-02.png, ..., slide-0N.png (closing)

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer');
const templates = require('./templates.js');

const CSS = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const CONTENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'content.json'), 'utf8'));
const MOCKUP_DIR = path.join(__dirname, 'Mockup');
const CLOSING_SLIDE = path.join(__dirname, 'closing-slide.png');
const TMP_DIR = path.join(__dirname, '.tmp');
const IMG_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

// bgImage in content.json is just a base filename like "book_1", find the
// real file regardless of extension and return an absolute file:// URL.
function resolveMockupImage(base) {
  for (const ext of IMG_EXTENSIONS) {
    const p = path.join(MOCKUP_DIR, `${base}.${ext}`);
    if (fs.existsSync(p)) return pathToFileURL(p).href;
  }
  throw new Error(
    `Missing art: couldn't find Mockup/${base}.(jpg|jpeg|png|webp). ` +
    `Check the file exists in the Mockup folder and the name matches exactly.`
  );
}

function buildHtml(slide) {
  const body = templates[slide.type](slide);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${CSS}</style></head><body>${body}</body></html>`;
}

async function main() {
  // Guard: refuse to render anything that still contains an unfilled
  // {{...}} placeholder, catches it before it becomes a PNG.
  const raw = JSON.stringify(CONTENT);
  const placeholder = raw.match(/\{\{[^}]*\}\}/);
  if (placeholder) {
    console.error(`Blocked: unfilled placeholder ${placeholder[0]} found in content.json. Fill in the real value before rendering.`);
    process.exit(1);
  }

  const hasClosingSlide = fs.existsSync(CLOSING_SLIDE);
  if (!hasClosingSlide) {
    console.warn(`Warning: closing-slide.png not found next to render.js, carousels will render without a closing slide.`);
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 }); // 2x for crisp export

  for (const carousel of CONTENT.carousels) {
    const dir = path.join(__dirname, 'out', carousel.slug);
    fs.mkdirSync(dir, { recursive: true });

    for (let i = 0; i < carousel.slides.length; i++) {
      const slide = { ...carousel.slides[i] };
      if (slide.type === 'cover' && slide.bgImage) {
        slide.bgImage = resolveMockupImage(slide.bgImage);
      }
      const html = buildHtml(slide);

      // Write to a temp .html file and navigate with goto(), rather than
      // page.setContent(). Chromium blocks file:// image loads from a
      // setContent() document (it has no real origin), but a page loaded
      // via goto('file://...') has a file:// origin itself and can load
      // sibling local images without any security flags.
      const tmpFile = path.join(TMP_DIR, `${carousel.slug}-${i}.html`);
      fs.writeFileSync(tmpFile, html);
      await page.goto(pathToFileURL(tmpFile).href, { waitUntil: 'networkidle0' });
      if (slide.type === 'cover') {
        // Wait for the title auto-fit script to actually finish (it runs
        // after the web font loads), rather than trusting that networkidle0
        // happened to land after it. Closes a real race condition, not a
        // hypothetical one, caught this shrinking a title to nothing when
        // font loading was slow.
        await page.waitForFunction(
          () => document.getElementById('cover-title')?.dataset.fitted === 'true',
          { timeout: 5000 }
        ).catch(() => console.warn(`  warning: title fit didn't confirm in time for slide ${i + 1} of ${carousel.slug}, check this one`));
      }

      const filename = `slide-${String(i + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(dir, filename) });
      console.log(`${carousel.slug} -> ${filename}`);
    }

    if (hasClosingSlide) {
      const closingFilename = `slide-${String(carousel.slides.length + 1).padStart(2, '0')}.png`;
      fs.copyFileSync(CLOSING_SLIDE, path.join(dir, closingFilename));
      console.log(`${carousel.slug} -> ${closingFilename} (closing slide)`);
    }
  }

  await browser.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});