// Island Pulse — Daily AI-generated SEO content about Big Island Hawaii
// Scheduled function: fetches Hawaii news + volcano data + trending search terms,
// generates a SERP-optimized article via Claude, stores in Netlify Blobs,
// and triggers a site rebuild.

import { getStore } from '@netlify/blobs';
import { callAI } from './ai-provider.js';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const STORE_NAME = 'island-pulse';
const MAX_ARTICLES = 90; // ~3 months of daily articles

// Rotating tone based on day of year
const TONES = [
  {
    name: 'casual',
    instruction: 'Write in a casual, warm tone with friendly Hawaiian hospitality vibes. Feel like a local sharing tips with a friend.'
  },
  {
    name: 'editorial',
    instruction: 'Write in a polished, professional travel blog style. Authoritative and editorial, like a travel magazine.'
  },
  {
    name: 'newsbites',
    instruction: 'Write in a quick news bites style — short, punchy sentences, just the facts. Like a morning briefing.'
  }
];

// Rotating topic focus to ensure variety (cycles every 7 days)
const TOPIC_FOCUS = [
  'volcano and geology updates',
  'beaches, snorkeling, and ocean activities',
  'local food, restaurants, and farmers markets',
  'hiking trails, waterfalls, and nature',
  'Hawaiian culture, history, and events',
  'day trips and scenic drives',
  'practical travel tips and visitor advice'
];

function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

async function fetchGoogleNewsHeadlines() {
  try {
    const url = 'https://news.google.com/rss/search?q=Hawaii+Big+Island+travel+tourism&hl=en&gl=US';
    const response = await fetch(url);
    if (!response.ok) return [];

    const xml = await response.text();

    // Simple XML parsing for RSS items — extract title and pubDate
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
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

async function fetchVolcanoData() {
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

// Free SERP intelligence — Google Autocomplete API (no key needed)
async function fetchTrendingSearchTerms() {
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

// Get previous article titles to avoid repetition
async function getRecentTitles() {
  try {
    const store = getStore({
      name: STORE_NAME,
      siteID: SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    const existing = await store.get('articles', { type: 'json' });
    if (!Array.isArray(existing)) return [];
    return existing.slice(0, 10).map(a => a.title);
  } catch (e) {
    return [];
  }
}

function buildArticlePrompt(headlines, volcanoData, trendingTerms, recentTitles, tone, topicFocus) {
  let context = '';

  if (headlines.length > 0) {
    context += `Recent Hawaii/Big Island news headlines:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;
  }

  if (volcanoData && volcanoData.length > 0) {
    context += `Current volcano activity:\n${volcanoData.map(v => `- ${v.name}: Alert Level ${v.alertLevel}, Aviation Color Code ${v.colorCode}`).join('\n')}\n\n`;
  }

  if (trendingTerms.length > 0) {
    context += `Trending Google search terms (what people are actually searching for — use these as SEO keywords):\n${trendingTerms.map(t => `- "${t}"`).join('\n')}\n\n`;
  }

  if (!context) {
    context = 'No specific news available today. Write about a general Big Island Hawaii travel topic — seasonal activities, local culture, natural beauty, or travel tips.\n\n';
  }

  let recentTitlesNote = '';
  if (recentTitles.length > 0) {
    recentTitlesNote = `\nIMPORTANT — These are recent article titles already published. Your title MUST be completely different — do NOT reuse similar wording:\n${recentTitles.map(t => `- "${t}"`).join('\n')}\n`;
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Pacific/Honolulu'
  });

  return `You are a travel content writer for Island Goodes, an adults-only oceanview vacation rental in Papaikou, Hawaii (near Hilo on the Big Island).

Today is ${today}.
Today's topic focus: ${topicFocus}

${tone.instruction}

Based on the following real data, write a short article (250-350 words, 2-4 paragraphs) about the Big Island of Hawaii, focusing on today's topic.

${context}
SEO STRATEGY:
- Incorporate the trending search terms naturally into your article where they fit
- Target long-tail keywords that travelers actually search for
- The title should match a search query someone might type into Google
${recentTitlesNote}
REQUIREMENTS:
- Create a unique, SEO-friendly title (include specific keywords from the trending terms)
- Write a meta description under 160 characters
- Write 2-4 paragraphs of plain text (no markdown, no bullet points, no headers)
- Naturally mention Island Goodes as an ideal home base for exploring the Big Island when it fits (don't force it — only if relevant)
- Focus on what travelers and potential visitors would find interesting
- Be factual — don't invent specific details not provided in the data above
- Do NOT use emoji

Respond in this exact JSON format:
{
  "title": "Your SEO-Optimized Title Here",
  "metaDescription": "Under 160 chars meta description here",
  "body": "Your 2-4 paragraph article text here. Separate paragraphs with double newlines."
}

Respond with ONLY valid JSON, nothing else.`;
}

async function generateArticle(headlines, volcanoData, trendingTerms, recentTitles) {
  const dayOfYear = getDayOfYear();
  const toneIndex = dayOfYear % TONES.length;
  const topicIndex = dayOfYear % TOPIC_FOCUS.length;
  const tone = TONES[toneIndex];
  const topicFocus = TOPIC_FOCUS[topicIndex];

  const prompt = buildArticlePrompt(headlines, volcanoData, trendingTerms, recentTitles, tone, topicFocus);

  const result = await callAI(null, [{ role: 'user', content: prompt }], { maxTokens: 1024 });
  const text = result.text;
  if (!text) throw new Error('Empty response from AI provider');
  console.log(`Article generated by provider: ${result.provider}`);

  // Parse JSON response — extract fields via regex to handle literal newlines
  // Claude often puts literal newlines in JSON string values which breaks JSON.parse
  let article;
  const titleMatch = text.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const metaMatch = text.match(/"metaDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]*?)"\s*\}$/);

  if (titleMatch && bodyMatch) {
    article = {
      title: titleMatch[1].replace(/\\"/g, '"'),
      metaDescription: metaMatch ? metaMatch[1].replace(/\\"/g, '"') : '',
      body: bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
    };
  } else {
    // Try direct parse as fallback
    try {
      article = JSON.parse(text);
    } catch (e) {
      throw new Error('Could not parse Claude response: ' + text.slice(0, 200));
    }
  }

  if (!article.title || !article.body) {
    throw new Error('Invalid article format from Claude');
  }

  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: article.title,
    metaDescription: article.metaDescription || '',
    body: article.body,
    tone: tone.name,
    topicFocus,
    date: new Date().toISOString(),
    generatedFrom: {
      headlineCount: headlines.length,
      hasVolcanoData: !!volcanoData,
      trendingTermCount: trendingTerms.length
    }
  };
}

async function storeArticle(article) {
  const store = getStore({
    name: STORE_NAME,
    siteID: SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN
  });

  // Read existing articles
  let articles = [];
  try {
    const existing = await store.get('articles', { type: 'json' });
    if (Array.isArray(existing)) articles = existing;
  } catch (e) {
    // First run — empty store
  }

  // Prepend new article (newest first)
  articles.unshift(article);

  // Cap at MAX_ARTICLES
  if (articles.length > MAX_ARTICLES) {
    articles = articles.slice(0, MAX_ARTICLES);
  }

  await store.setJSON('articles', articles);
  console.log(`Stored article: "${article.title}" (${articles.length} total)`);
}

async function triggerBuild() {
  const hookUrl = process.env.NETLIFY_BUILD_HOOK;
  if (!hookUrl) {
    console.warn('NETLIFY_BUILD_HOOK not set — skipping build trigger');
    return;
  }

  const response = await fetch(hookUrl, {
    method: 'POST',
    body: '{}'
  });

  if (!response.ok) {
    console.error(`Build hook failed: ${response.status}`);
  } else {
    console.log('Build triggered successfully');
  }
}

// Invoked daily by GitHub Actions cron at 4:00 PM UTC (6:00 AM HST / 11:00 AM EST)
// Also callable via HTTP POST for manual invocation
export const handler = async () => {
  console.log('Island Pulse: Starting daily article generation...');

  try {
    // Fetch all data sources in parallel
    const [headlines, volcanoData, trendingTerms, recentTitles] = await Promise.all([
      fetchGoogleNewsHeadlines(),
      fetchVolcanoData(),
      fetchTrendingSearchTerms(),
      getRecentTitles()
    ]);

    console.log(`Fetched: ${headlines.length} headlines, volcano: ${volcanoData ? 'yes' : 'no'}, ${trendingTerms.length} trending terms, ${recentTitles.length} recent titles`);

    // Generate article
    const article = await generateArticle(headlines, volcanoData, trendingTerms, recentTitles);
    console.log(`Generated: "${article.title}" (tone: ${article.tone}, topic: ${article.topicFocus})`);

    // Store in Blobs
    await storeArticle(article);

    // Trigger rebuild
    await triggerBuild();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, title: article.title })
    };
  } catch (err) {
    console.error('Island Pulse generation failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
