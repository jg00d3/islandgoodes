// One-off: Remove all approved AI blog drafts from the site
// Usage: curl -X POST https://islandgoodes.com/.netlify/functions/remove-all-blog-drafts

import { getStore } from '@netlify/blobs';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const store = getStore({ name: 'blog-drafts', siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
    let drafts = await store.get('data', { type: 'json' });

    if (!Array.isArray(drafts) || drafts.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No drafts to remove' }) };
    }

    const removed = drafts.map(d => ({ id: d.id, title: d.title, status: d.status }));

    // Clear all drafts
    await store.setJSON('data', []);

    // Trigger rebuild
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
        removedCount: removed.length,
        removed,
        message: 'All blog drafts removed. Site rebuild triggered.'
      }, null, 2)
    };
  } catch (err) {
    console.error('Remove failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
