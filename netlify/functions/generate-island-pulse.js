// Island Pulse — Daily AI-generated SEO content about Big Island Hawaii
// Scheduled function: fetches Hawaii news + volcano data, generates article via Claude,
// stores in Netlify Blobs, and triggers a site rebuild.

import { getStore } from '@netlify/blobs';

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
    const url = 'https://volcanoes.usgs.gov/hans-public/api/volcano/activityStatus/elevated';
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    // Filter for Hawaii volcanoes
    const hawaiiVolcanoes = data.filter(v =>
      v.vName && (v.vName.includes('Kilauea') || v.vName.includes('Mauna Loa'))
    );

    if (hawaiiVolcanoes.length === 0) return null;

    return hawaiiVolcanoes.map(v => ({
      name: v.vName,
      alertLevel: v.alertLevel || 'unknown',
      colorCode: v.colorCode || 'unknown'
    }));
  } catch (err) {
    console.error('Failed to fetch volcano data:', err.message);
    return null;
  }
}

function buildArticlePrompt(headlines, volcanoData, tone) {
  let context = '';

  if (headlines.length > 0) {
    context += `Recent Hawaii/Big Island news headlines:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;
  }

  if (volcanoData && volcanoData.length > 0) {
    context += `Current volcano activity:\n${volcanoData.map(v => `- ${v.name}: Alert Level ${v.alertLevel}, Aviation Color Code ${v.colorCode}`).join('\n')}\n\n`;
  }

  if (!context) {
    context = 'No specific news available today. Write about a general Big Island Hawaii travel topic — seasonal activities, local culture, natural beauty, or travel tips.\n\n';
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

${tone.instruction}

Based on the following real data, write a short article (250-350 words, 2-4 paragraphs) about what's happening on the Big Island of Hawaii.

${context}
REQUIREMENTS:
- Create an SEO-friendly title (include "Big Island Hawaii" or similar keywords naturally)
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

async function generateArticle(headlines, volcanoData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const toneIndex = getDayOfYear() % TONES.length;
  const tone = TONES[toneIndex];

  const prompt = buildArticlePrompt(headlines, volcanoData, tone);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude');

  // Parse JSON response
  const article = JSON.parse(text);

  if (!article.title || !article.body) {
    throw new Error('Invalid article format from Claude');
  }

  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: article.title,
    metaDescription: article.metaDescription || '',
    body: article.body,
    tone: tone.name,
    date: new Date().toISOString(),
    generatedFrom: {
      headlineCount: headlines.length,
      hasVolcanoData: !!volcanoData
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
  } catch {
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

const handler = async () => {
  console.log('Island Pulse: Starting daily article generation...');

  try {
    // Fetch data in parallel
    const [headlines, volcanoData] = await Promise.all([
      fetchGoogleNewsHeadlines(),
      fetchVolcanoData()
    ]);

    console.log(`Fetched ${headlines.length} headlines, volcano data: ${volcanoData ? 'yes' : 'no'}`);

    // Generate article
    const article = await generateArticle(headlines, volcanoData);
    console.log(`Generated: "${article.title}" (tone: ${article.tone})`);

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

// Run daily at 4:00 PM UTC (6:00 AM HST)
export { handler };
export const config = {
  schedule: '0 16 * * *'
};
