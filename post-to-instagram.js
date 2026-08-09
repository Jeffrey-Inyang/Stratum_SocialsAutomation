// Publishes the next scheduled carousel to Instagram via the official
// Graph API. Run once per day (see .github/workflows/daily-post.yml).
//
// Requires two GitHub Actions secrets (see README-posting.md for how to
// get these):
//   IG_USER_ID       your Instagram professional account's numeric ID
//   IG_ACCESS_TOKEN  a long-lived token with instagram_content_publish
//
// Requires the repo itself to be public, or served some other way, since
// Graph API needs a real public URL per image, it cannot accept a direct
// file upload the way you'd attach a file in a form.

const fs = require('fs');
const path = require('path');

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const IG_USER_ID = process.env.IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY; // e.g. "yourname/stratum-content", auto-set by Actions
const BRANCH = process.env.PUBLIC_BRANCH || 'main';

if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
  console.error('Missing IG_USER_ID or IG_ACCESS_TOKEN environment variables.');
  process.exit(1);
}

const CONTENT = JSON.parse(fs.readFileSync(path.join(__dirname, 'content.json'), 'utf8'));
const STATE_PATH = path.join(__dirname, 'state.json');
const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));

async function graphPost(endpoint, params) {
  const url = `${GRAPH_BASE}/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: IG_ACCESS_TOKEN }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Graph API error on ${endpoint}: ${JSON.stringify(data.error)}`);
  }
  return data;
}

// Poll a media container until Meta finishes processing it, images are
// usually near-instant but this is the officially recommended pattern so
// a slow one never gets published half-ready.
async function waitUntilFinished(containerId, { timeoutMs = 60000, intervalMs = 2000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${IG_ACCESS_TOKEN}`
    );
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`Container ${containerId} failed processing.`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Container ${containerId} timed out waiting to finish.`);
}

function rawUrlFor(slug, filename) {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/out/${slug}/${filename}`;
}

async function main() {
  if (state.nextIndex >= CONTENT.carousels.length) {
    console.log('All scheduled carousels have been posted. Nothing to do, add more to content.json to continue.');
    return;
  }

  const carousel = CONTENT.carousels[state.nextIndex];
  const dir = path.join(__dirname, 'out', carousel.slug);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();

  if (files.length < 2) {
    throw new Error(`${carousel.slug} has fewer than 2 images, Instagram carousels need at least 2.`);
  }
  if (files.length > 10) {
    throw new Error(`${carousel.slug} has more than 10 images, Instagram carousels max out at 10.`);
  }

  console.log(`Posting "${carousel.slug}" (${files.length} slides)...`);

  // Step 1: create a child container per image.
  const childIds = [];
  for (const file of files) {
    const imageUrl = rawUrlFor(carousel.slug, file);
    const res = await graphPost(`${IG_USER_ID}/media`, {
      image_url: imageUrl,
      is_carousel_item: 'true',
    });
    await waitUntilFinished(res.id);
    childIds.push(res.id);
    console.log(`  container created for ${file} -> ${res.id}`);
  }

  // Step 2: create the parent carousel container.
  const caption = carousel.caption || '';
  const parent = await graphPost(`${IG_USER_ID}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
  });
  await waitUntilFinished(parent.id);
  console.log(`  carousel container ready -> ${parent.id}`);

  // Step 3: publish.
  const published = await graphPost(`${IG_USER_ID}/media_publish`, {
    creation_id: parent.id,
  });
  console.log(`Published: https://www.instagram.com/p/${published.id} (id ${published.id})`);

  // Advance state so tomorrow's run posts the next carousel.
  state.nextIndex += 1;
  state.lastPosted = { slug: carousel.slug, publishedId: published.id, at: new Date().toISOString() };
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
