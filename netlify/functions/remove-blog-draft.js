// One-off: Remove a blog draft by title match and trigger rebuild
// Usage: curl -X POST https://islandgoodes.com/.netlify/functions/remove-blog-draft

import { getStore } from '@netlify/blobs';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const store = getStore({ name: 'blog-drafts', siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
    let drafts = await store.get('data', { type: 'json' });

    if (!Array.isArray(drafts)) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No drafts found' }) };
    }

    const target = "Discover the Big Island";
    const before = drafts.length;
    const removed = drafts.filter(d => d.title && d.title.includes(target));
    drafts = drafts.filter(d => !(d.title && d.title.includes(target)));
    const after = drafts.length;

    if (removed.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Article not found', titles: drafts.map(d => d.title) }) };
    }

    await store.setJSON('data', drafts);

    // Trigger rebuild to remove from site
    const hookUrl = process.env.NETLIFY_BUILD_HOOK;
    if (hookUrl) {
      await new Promise(r => setTimeout(r, 3000));
      await fetch(hookUrl, { method: 'POST', body: '{}' });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        removed: removed.map(d => ({ id: d.id, title: d.title, slug: d.slug })),
        remainingDrafts: after
      }, null, 2)
    };
  } catch (err) {
    console.error('Remove failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
