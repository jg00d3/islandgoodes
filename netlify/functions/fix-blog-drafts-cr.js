// One-off: Fix Richardson Beach location and South Point description in blog drafts
// CR 1772474534217 from Garvin Goode
//
// Usage: curl -X POST https://islandgoodes.com/.netlify/functions/fix-blog-drafts-cr

import { getStore } from '@netlify/blobs';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';

const REPLACEMENTS = [
  {
    find: 'Richardson Beach in Kailua-Kona is a local favorite',
    replace: 'Richardson Beach in Hilo is a local favorite'
  },
  {
    find: 'offers pristine beaches and opportunities for stargazing, though its remote location requires careful planning.',
    replace: 'offers nice views of the Pacific Ocean, though its remote location requires careful planning.'
  }
];

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Check both stores
    const stores = [
      { name: 'blog-drafts', key: 'data' },
      { name: 'island-pulse', key: 'articles' }
    ];

    const results = [];

    for (const { name, key } of stores) {
      const store = getStore({ name, siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
      let items;
      try {
        items = await store.get(key, { type: 'json' });
        if (!Array.isArray(items)) continue;
      } catch (e) { continue; }

      let storeChanged = false;

      for (const item of items) {
        if (!item.body) continue;
        let changed = false;

        for (const rep of REPLACEMENTS) {
          if (item.body.includes(rep.find)) {
            item.body = item.body.replace(rep.find, rep.replace);
            changed = true;
            storeChanged = true;
          }
        }

        if (changed) {
          results.push({ store: name, id: item.id, title: item.title });
        }
      }

      if (storeChanged) {
        await store.setJSON(key, items);
      }
    }

    // Trigger rebuild if changes were made
    if (results.length > 0) {
      const hookUrl = process.env.NETLIFY_BUILD_HOOK;
      if (hookUrl) {
        await new Promise(r => setTimeout(r, 3000));
        await fetch(hookUrl, { method: 'POST', body: '{}' });
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, fixed: results.length, details: results }, null, 2)
    };
  } catch (err) {
    console.error('Fix failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
