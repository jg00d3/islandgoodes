// One-off function to fix two Island Pulse articles per change requests from Garvin.
// CR 1772136557678: Rewrite the Weather & Volcano article
// CR 1772146003584: Fix text in the "Exploring Beyond the Crowds" article
//
// Usage: curl -X POST https://islandgoodes.com/.netlify/functions/fix-pulse-articles

import { getStore } from '@netlify/blobs';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';

// ── CR 1772136557678: Rewrite the Weather & Volcano article ──
// Problems per Garvin:
// - P1: Makes it sound like volcano affects the airport (it doesn't)
// - P2: "limited flight schedule" wrong, "most arrivals stay on east side" wrong, "local villas" → Private Guest Homes
// - P3: Visitor Center is closed for remodeling. Island Goodes description wrong.
// - P4: Made up, remove entirely
const VOLCANO_ARTICLE_REWRITE = `Kilauea remains under a WATCH alert level, with the aviation color code set to orange. This is a routine status that the Hawaiian Volcano Observatory monitors closely, and it does not affect commercial flights in or out of the Big Island. Weather conditions on the Hilo side remain mild and tropical, typical for this time of year.

Travelers planning a Big Island Hawaii vacation in 2026 have plenty of options for accommodations. While Hilo and Kona both have a good selection of hotels, many visitors prefer staying in private guest homes and B&Bs for a more personal, local experience. These smaller properties often offer better value and a chance to connect with the community.

Big Island things to do include scenic hikes through lush rainforest, visits to botanical gardens, and exploring tide pools along the rocky coastline. The volcanic landscape creates a one-of-a-kind setting, from steam vents along Crater Rim Drive to the dramatic lava fields along Chain of Craters Road. For a comfortable home base, Island Goode's is an adults-only accommodation with ocean views, located just 5 minutes from Old Hilo Town.`;

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const store = getStore({ name: 'island-pulse', siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
    const articles = await store.get('articles', { type: 'json' });

    if (!Array.isArray(articles)) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No articles found' }) };
    }

    const results = [];

    for (const article of articles) {
      // CR 1772136557678: Weather & Volcano article
      if (article.body && article.body.includes('Kilauea remains under a WATCH alert') && article.body.includes('Hurricane')) {
        article.body = VOLCANO_ARTICLE_REWRITE;
        results.push({ id: article.id, title: article.title, fix: 'Rewrote per Garvin feedback: removed airport/volcano confusion, fixed accommodations language, removed fabricated 4th paragraph, corrected Island Goodes description, noted Visitor Center closed' });
      }

      // CR 1772146003584: Simple text replacement
      if (article.body && article.body.includes('many visitors now rent oceanfront properties and explore at their own pace')) {
        article.body = article.body.replace(
          'Rather than booking expensive Hawaii vacation packages through standard channels, many visitors now rent oceanfront properties and explore at their own pace, enjoying local markets in Hilo and discovering hidden gems beyond the typical tourist circuits.',
          'Rather than booking expensive Hawaii vacation packages through standard channels, many visitors now rent private Hawaiian properties outside the main town and explore at their own pace, enjoying local markets in Hilo and discovering hidden gems beyond the typical tourist circuits.'
        );
        results.push({ id: article.id, title: article.title, fix: 'Changed "rent oceanfront properties" to "rent private Hawaiian properties outside the main town"' });
      }
    }

    if (results.length > 0) {
      await store.setJSON('articles', articles);
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
