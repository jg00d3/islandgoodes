// Island Pulse — Daily AI-generated SEO content about Big Island Hawaii
// Scheduled function: fetches Hawaii news + volcano data + trending search terms,
// generates a SERP-optimized article via Claude, stores in Netlify Blobs,
// and triggers a site rebuild.

import { getStore } from '@netlify/blobs';
import { Resend } from 'resend';
import { callAI } from './ai-provider.js';
import { fetchGoogleNewsHeadlines, fetchVolcanoData, fetchTrendingSearchTerms } from './data-sources.js';

const NOTIFY_EMAILS = ['sysadmroot@gmail.com', 'goodegarvin@gmail.com'];

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

  const result = await callAI(null, [{ role: 'user', content: prompt }], {
    maxTokens: 2048,
    validateResponse: (text) => {
      if (!text) throw new Error('Empty response');
      // Must contain all three JSON fields to be considered complete
      if (!text.includes('"title"')) throw new Error('Response missing title field');
      if (!text.includes('"body"')) throw new Error('Response missing body field');
      // Must have a closing brace (not truncated mid-JSON)
      const trimmed = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
      if (!trimmed.endsWith('}')) throw new Error('Response appears truncated (no closing brace)');
    }
  });
  let text = result.text;
  console.log(`Article generated by provider: ${result.provider}`);

  // Strip markdown code fences if present (vLLM often wraps JSON in ```json ... ```)
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');

  // Parse JSON response — extract fields via regex to handle literal newlines
  // Some models put literal newlines in JSON string values which breaks JSON.parse
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
      throw new Error('Could not parse AI response: ' + text.slice(0, 200));
    }
  }

  if (!article.title || !article.body) {
    throw new Error('Invalid article format from AI response');
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

async function sendNotificationEmail(article) {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const date = new Date(article.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Pacific/Honolulu'
  });
  const previewBody = article.body.split('\n\n').slice(0, 2).join('\n\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
        <p style="color: #666; margin: 5px 0;">New Island Pulse Article</p>
        <p style="color: #999; font-size: 13px;">${date}</p>
      </div>
      <div style="background: #f7f5f2; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #1b6b5a; margin: 0 0 8px;">${article.title}</h2>
        <p style="color: #999; font-size: 13px; margin: 0 0 16px;">Tone: ${article.tone} · Topic: ${article.topicFocus}</p>
        <p style="color: #555; line-height: 1.7; white-space: pre-line;">${previewBody}</p>
      </div>
      <div style="text-align: center; margin: 24px 0;">
        <a href="https://islandgoodes.com/island-pulse" style="background: #1b6b5a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">View on Site</a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">
        Island Goodes | 27-2365 Hawaii Belt Rd, Papaikou, HI 96781<br>
        <a href="https://islandgoodes.com" style="color: #1b6b5a;">islandgoodes.com</a>
      </p>
    </div>`;

  for (const email of NOTIFY_EMAILS) {
    try {
      await resend.emails.send({
        from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
        to: [email],
        subject: `Island Pulse: ${article.title}`,
        html
      });
    } catch (err) {
      console.error(`Failed to send notification to ${email}:`, err.message);
    }
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

    // Notify property managers
    await sendNotificationEmail(article);

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
