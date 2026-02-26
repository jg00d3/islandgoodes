// One-off function to fix ALL fabricated/incorrect place names across Island Pulse articles.
// Replaces entire articles that have hallucinated locations with factual Big Island content.
//
// Usage: curl -X POST https://islandgoodes.com/.netlify/functions/fix-beach-article

import { getStore } from '@netlify/blobs';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';

// ── Article fixes ──────────────────────────────────────────────────────
// Each key is an article ID. We replace body (and optionally metaDescription)
// with hand-written, factually verified content.

const FIXES = {
  // "Big Island Hawaii Beaches: Your Hilo-Based Guide to Snorkel, Surf, and Sunset"
  // Fabrications: Hawiʻē Beach, Pupunapi Bay, Kapahulu Bay, Aba a Heli Beach, Hilo Pier tide pools
  'mm3ph9spf6oy': {
    body: `The Big Island of Hawaii offers some of the most unique beaches in the world, and staying near Hilo puts you within easy reach of both the windward and leeward coasts. Whether you're after black sand, green sand, or classic white sand, the Big Island delivers experiences you won't find anywhere else.

On the Hilo side, Richardson Ocean Park (also called Richardson Beach) is the local favorite. This black sand beach has calm, protected waters perfect for snorkeling — you'll regularly spot sea turtles feeding on the reef just offshore. It's only about 10 minutes from Island Goodes. Nearby, Carlsmith Beach Park (Four Mile Beach) offers calm ponds sheltered by a natural lava rock barrier, making it ideal for relaxed swimming.

For a truly one-of-a-kind experience, make the drive south to Papakōlea (Green Sand Beach) near South Point. It's one of only four green sand beaches on Earth, colored by olivine crystals from the surrounding volcanic cone. The hike in is about 2.5 miles each way across open terrain, so bring water and sun protection. Punalu'u Black Sand Beach is another must-see on the southern coast, famous for Hawaiian green sea turtles basking on the jet-black sand.

On the Kona side, Hapuna Beach State Recreation Area consistently ranks among the best beaches in the United States. The wide stretch of white sand and clear turquoise water is perfect for swimming, bodyboarding, and sunbathing. For snorkeling, Kahalu'u Beach Park in Kailua-Kona has a protected reef where you'll see tropical fish and turtles just steps from shore.

Back on the Hilo side, Honoli'i Beach Park is the Big Island's go-to surf spot — a beautiful black sand cove where you can watch local surfers ride the break. It's just a few minutes north of Hilo and a short drive from Island Goodes.`,
    metaDescription: "Discover the Big Island's best beaches near Hilo and Kona — from black sand at Richardson Beach to the green sand of Papakōlea."
  }
};

// ── Text replacements for smaller fixes in other articles ──────────────
// These fix specific incorrect sentences without rewriting the whole article.
const TEXT_REPLACEMENTS = [
  {
    // Foodie article: Highway Inn is on Oahu, not Big Island. Paula's on the Beach is fabricated.
    match: /The Highway Inn.*?locals swear by\./s,
    replacement: "Hilo Bay Cafe, a popular spot downtown, serves up hearty local plates including loco moco, fresh fish, and classic Hawaiian comfort food that locals swear by."
  },
  {
    match: /If you're craving fusion, Paula's on the Beach.*?Hawaiian\./s,
    replacement: "If you're craving something different, Moon and Turtle offers a creative farm-to-table menu that highlights Big Island ingredients with international flair."
  },
  {
    // Day trips article: Hapuna is white sand, not black. Mokuaikaua Church is real (Kona) but the geography is wrong — it's not on the Hamakua Highway.
    match: /past the famed Mokuaikaua Church and the Black Sand Beach at Hapuna/,
    replacement: "through lush rainforest past Akaka Falls and the stunning Hamakua coastline"
  },
  {
    // Weather article: "Volcano Discovery Center" should be "Kilauea Visitor Center"
    match: /Volcano Discovery Center/g,
    replacement: "Kilauea Visitor Center"
  }
];

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
      const fixes = [];

      // Full article replacements
      if (FIXES[article.id]) {
        const fix = FIXES[article.id];
        article.body = fix.body;
        if (fix.metaDescription) article.metaDescription = fix.metaDescription;
        fixes.push('Full body replaced (fabricated place names)');
      }

      // Text replacements across all articles
      for (const rep of TEXT_REPLACEMENTS) {
        if (rep.match.test(article.body)) {
          article.body = article.body.replace(rep.match, rep.replacement);
          fixes.push(`Replaced: "${rep.match.source.slice(0, 50)}..."`);
        }
      }

      if (fixes.length > 0) {
        results.push({ id: article.id, title: article.title, fixes });
      }
    }

    // Save
    await store.setJSON('articles', articles);

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
        articlesFixed: results.length,
        details: results
      }, null, 2)
    };
  } catch (err) {
    console.error('Fix failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
