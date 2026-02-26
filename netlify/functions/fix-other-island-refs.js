// One-off cleanup function: scans Island Pulse articles and Blog Drafts
// for references to other Hawaiian islands (Oahu, Maui, Kauai, etc.)
// and uses AI to rewrite affected paragraphs to be Big Island-only.
//
// Usage after deploy:
//   curl -X POST https://islandgoodes.com/.netlify/functions/fix-other-island-refs
//
// Dry-run (preview changes without saving):
//   curl -X POST https://islandgoodes.com/.netlify/functions/fix-other-island-refs?dry=true
//
// Safe to delete after running.

import { getStore } from '@netlify/blobs';
import { callAI } from './ai-provider.js';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';

// Regex to detect other-island references
const OTHER_ISLAND_PATTERN = /\b(Oahu|O['']ahu|Maui|Kauai|Kaua['']i|Lanai|Lana['']i|Molokai|Moloka['']i|Waikiki|Honolulu|Napali|Na Pali|Lahaina|Hana Highway|North Shore Oahu|Haleiwa|Kapolei|Pearl Harbor|Diamond Head|Wailea|Ka['']anapali|Kaanapali|Princeville|Poipu)\b/gi;

function hasOtherIslandRefs(text) {
  OTHER_ISLAND_PATTERN.lastIndex = 0;
  return OTHER_ISLAND_PATTERN.test(text);
}

function findMatches(text) {
  OTHER_ISLAND_PATTERN.lastIndex = 0;
  const matches = [];
  let m;
  while ((m = OTHER_ISLAND_PATTERN.exec(text)) !== null) {
    matches.push(m[0]);
  }
  return [...new Set(matches)];
}

async function rewriteText(text, field) {
  const prompt = `You are editing content for Island Goodes, a vacation rental on the Big Island of Hawaii near Hilo.

The following ${field} contains references to other Hawaiian islands that need to be removed. Rewrite it so ALL content is about the Big Island of Hawaii ONLY.

Rules:
- Remove or replace any mention of Oahu, Maui, Kauai, Lanai, Molokai, Waikiki, Honolulu, Diamond Head, Lahaina, Ka'anapali, Wailea, Napali Coast, Poipu, Princeville, Hana Highway, North Shore Oahu, Pearl Harbor, or any other non-Big-Island location.
- Replace with equivalent Big Island content where possible (e.g. if comparing beaches to Maui, just describe Big Island beaches positively).
- Keep the same length, tone, and style.
- Keep all Big Island references exactly as they are.
- Do NOT add emoji.
- Return ONLY the rewritten text, nothing else — no quotes, no explanation.

Text to rewrite:
${text}`;

  const result = await callAI(null, [{ role: 'user', content: prompt }], {
    maxTokens: 2048,
    timeoutMs: 30000
  });

  return result.text.trim();
}

async function processStore(storeName, dataKey, labelName) {
  const store = getStore({ name: storeName, siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
  const results = { storeName, checked: 0, fixed: 0, items: [] };

  let items;
  try {
    items = await store.get(dataKey, { type: 'json' });
    if (!Array.isArray(items)) return results;
  } catch (e) {
    return results;
  }

  results.checked = items.length;
  let changed = false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fieldsToCheck = ['title', 'body', 'metaDescription', 'excerpt'];
    const fixes = [];

    for (const field of fieldsToCheck) {
      if (item[field] && hasOtherIslandRefs(item[field])) {
        const matches = findMatches(item[field]);
        const original = item[field];
        const rewritten = await rewriteText(item[field], field);
        item[field] = rewritten;
        fixes.push({ field, matches, original: original.slice(0, 200), rewritten: rewritten.slice(0, 200) });
        changed = true;
      }
    }

    if (fixes.length > 0) {
      results.fixed++;
      results.items.push({ title: item.title, id: item.id, fixes });
    }
  }

  if (changed) {
    results.data = items;
    results.dataKey = dataKey;
    results.store = store;
  }

  return results;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const dryRun = event.queryStringParameters?.dry === 'true';

  try {
    console.log(`Scanning Blobs for other-island references (dry run: ${dryRun})...`);

    const [pulseResults, blogResults] = await Promise.all([
      processStore('island-pulse', 'articles', 'Island Pulse'),
      processStore('blog-drafts', 'data', 'Blog Drafts')
    ]);

    // Save changes unless dry run
    if (!dryRun) {
      if (pulseResults.data) {
        await pulseResults.store.setJSON(pulseResults.dataKey, pulseResults.data);
        console.log(`Saved ${pulseResults.fixed} fixed Island Pulse articles`);
      }
      if (blogResults.data) {
        await blogResults.store.setJSON(blogResults.dataKey, blogResults.data);
        console.log(`Saved ${blogResults.fixed} fixed Blog Drafts`);
      }

      // Trigger rebuild if anything changed
      const hookUrl = process.env.NETLIFY_BUILD_HOOK;
      if (hookUrl && (pulseResults.fixed > 0 || blogResults.fixed > 0)) {
        await new Promise(r => setTimeout(r, 3000));
        await fetch(hookUrl, { method: 'POST', body: '{}' });
        console.log('Build triggered after fixes');
      }
    }

    const summary = {
      dryRun,
      islandPulse: {
        checked: pulseResults.checked,
        fixed: pulseResults.fixed,
        items: pulseResults.items
      },
      blogDrafts: {
        checked: blogResults.checked,
        fixed: blogResults.fixed,
        items: blogResults.items
      }
    };

    console.log(`Done. Pulse: ${pulseResults.fixed}/${pulseResults.checked} fixed. Blogs: ${blogResults.fixed}/${blogResults.checked} fixed.`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary, null, 2)
    };
  } catch (err) {
    console.error('Fix failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
