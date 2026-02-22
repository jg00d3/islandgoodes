// Shared data-fetching helpers for AI content generation
// Used by generate-island-pulse.js and generate-blog-draft.js

/**
 * Fetch recent Hawaii/Big Island news headlines from Google News RSS
 * @param {number} limit - Max headlines to return (default 5)
 * @returns {Promise<string[]>} Array of headline strings
 */
export async function fetchGoogleNewsHeadlines(limit = 5) {
  try {
    const url = 'https://news.google.com/rss/search?q=Hawaii+Big+Island+travel+tourism&hl=en&gl=US';
    const response = await fetch(url);
    if (!response.ok) return [];

    const xml = await response.text();

    // Simple XML parsing for RSS items — extract title and pubDate
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const titleMatch = match[1].match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
      const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
      if (title) {
        items.push(title);
      }
    }
    return items;
  } catch (err) {
    console.error('Failed to fetch Google News:', err.message);
    return [];
  }
}

/**
 * Fetch current volcano activity for Hawaii volcanoes from USGS
 * @returns {Promise<Array|null>} Array of volcano objects or null
 */
export async function fetchVolcanoData() {
  try {
    const url = 'https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes';
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data)) return null;

    // Filter for Hawaii volcanoes (HVO observatory)
    const hawaiiVolcanoes = data.filter(v =>
      v.volcano_name && (v.volcano_name.includes('Kilauea') || v.volcano_name.includes('Mauna Loa'))
    );

    if (hawaiiVolcanoes.length === 0) return null;

    return hawaiiVolcanoes.map(v => ({
      name: v.volcano_name,
      alertLevel: v.alert_level || 'unknown',
      colorCode: v.color_code || 'unknown'
    }));
  } catch (err) {
    console.error('Failed to fetch volcano data:', err.message);
    return null;
  }
}

/**
 * Fetch trending Google search suggestions for Hawaii travel queries
 * @returns {Promise<string[]>} Array of search suggestion strings
 */
export async function fetchTrendingSearchTerms() {
  const queries = [
    'big island hawaii',
    'hilo hawaii',
    'hawaii vacation',
    'things to do big island'
  ];

  const allSuggestions = [];

  for (const q of queries) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?q=${encodeURIComponent(q)}&client=firefox`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      // Response format: [query, [suggestion1, suggestion2, ...]]
      if (Array.isArray(data[1])) {
        allSuggestions.push(...data[1].slice(0, 5));
      }
    } catch (e) {
      // Skip failed queries
    }
  }

  // Deduplicate and return
  return [...new Set(allSuggestions)].slice(0, 15);
}
