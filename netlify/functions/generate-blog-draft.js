// Weekly AI Blog Draft Generator
// Generates ~800-1200 word blog posts, stores as pending drafts in Blobs,
// sends notification emails for admin review/approval.

import { getStore } from '@netlify/blobs';
import { Resend } from 'resend';
import { callAI } from './ai-provider.js';
import { fetchGoogleNewsHeadlines, fetchVolcanoData, fetchTrendingSearchTerms } from './data-sources.js';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const STORE_NAME = 'blog-drafts';
const NOTIFY_EMAILS = ['sysadmroot@gmail.com', 'goodegarvin@gmail.com'];

// Rotating tones (cycle every 3 weeks)
const TONES = [
  { name: 'casual', instruction: 'Write in a casual, warm tone with friendly Hawaiian hospitality vibes. Feel like a local sharing tips with a friend.' },
  { name: 'editorial', instruction: 'Write in a polished, professional travel blog style. Authoritative and editorial, like a travel magazine.' },
  { name: 'newsbites', instruction: 'Write in an engaging, informative style — mix facts with personal recommendations. Like a well-traveled friend giving you the inside scoop.' }
];

// Blog categories matching the existing blog
const CATEGORIES = ['Attractions', 'Nature', 'Activities', 'Local Guide', 'Food & Dining', 'Events & Culture'];

// Existing static blog titles (to avoid repetition)
const STATIC_BLOG_TITLES = [
  "Hawaii Volcanoes National Park: Complete Visitor's Guide",
  "Best Poke in Hilo: A Local's Guide to Fresh Fish",
  "Whale Watching Season in Hawaii: Your Complete Guide",
  "Uncle Robert's Wednesday Night Market: The Real Puna Experience",
  "Stargazing on Mauna Kea: What to Know Before You Go",
  "Hidden Swimming Holes Near Hilo",
  "Black Sand Beaches of the Big Island",
  "Chasing Waterfalls on the Hamakua Coast",
  "Hilo Farmers Market: A Complete Guide",
  "Big Island Coffee Farm Tours: From Bean to Cup",
  "Snorkeling at Richardson Beach: What to Expect",
  "Guide to Akaka Falls & the Pepe'ekeo Scenic Route"
];

function getWeekOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/-$/, '');
}

async function getRecentDraftTitles() {
  try {
    const store = getStore({ name: STORE_NAME, siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
    const existing = await store.get('data', { type: 'json' });
    if (!Array.isArray(existing)) return [];
    return existing.slice(0, 20).map(d => d.title);
  } catch (e) {
    return [];
  }
}

function buildBlogPrompt(headlines, volcanoData, trendingTerms, recentTitles, tone, category) {
  let context = '';

  if (headlines.length > 0) {
    context += `Recent Hawaii/Big Island news headlines:\n${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;
  }

  if (volcanoData && volcanoData.length > 0) {
    context += `Current volcano activity:\n${volcanoData.map(v => `- ${v.name}: Alert Level ${v.alertLevel}, Aviation Color Code ${v.colorCode}`).join('\n')}\n\n`;
  }

  if (trendingTerms.length > 0) {
    context += `Trending Google search terms:\n${trendingTerms.map(t => `- "${t}"`).join('\n')}\n\n`;
  }

  if (!context) {
    context = 'No specific news available. Write about a compelling Big Island Hawaii travel topic related to the category below.\n\n';
  }

  const allTitles = [...STATIC_BLOG_TITLES, ...recentTitles];
  let titlesNote = '';
  if (allTitles.length > 0) {
    titlesNote = `\nIMPORTANT — These titles already exist. Your title MUST be completely different:\n${allTitles.map(t => `- "${t}"`).join('\n')}\n`;
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Pacific/Honolulu'
  });

  return `You are a travel content writer for Island Goodes, an adults-only oceanview vacation rental in Papaikou, Hawaii (near Hilo on the Big Island).

Today is ${today}.
Blog category: ${category}

${tone.instruction}

Based on the following real data, write a detailed blog article (800-1200 words) about the Big Island of Hawaii, fitting the "${category}" category.

${context}
SEO STRATEGY:
- Incorporate trending search terms naturally where they fit
- Target long-tail keywords travelers actually search for
- The title should match a search query someone might type into Google
${titlesNote}
REQUIREMENTS:
- Create a unique, SEO-friendly title (include specific keywords from trending terms if relevant)
- Write a compelling excerpt (under 160 characters) for the blog listing card
- Write a meta description (under 160 characters) for search engines
- Write 800-1200 words organized with ## subheadings (use markdown ## for section headings)
- Include 3-5 sections with ## headings
- Naturally mention Island Goodes as an ideal home base when relevant (don't force it)
- Be factual — don't invent specific details not in the data above
- Do NOT use emoji
- Write engaging, helpful content that travelers would bookmark and share

Respond in this exact JSON format:
{
  "title": "Your SEO-Optimized Title Here",
  "excerpt": "Under 160 chars card excerpt",
  "metaDescription": "Under 160 chars meta description",
  "body": "Full article with ## subheadings. Use double newlines between paragraphs."
}

Respond with ONLY valid JSON, nothing else.`;
}

async function generateDraft(headlines, volcanoData, trendingTerms, recentTitles) {
  const weekOfYear = getWeekOfYear();
  const toneIndex = weekOfYear % TONES.length;
  const categoryIndex = weekOfYear % CATEGORIES.length;
  const tone = TONES[toneIndex];
  const category = CATEGORIES[categoryIndex];

  const prompt = buildBlogPrompt(headlines, volcanoData, trendingTerms, recentTitles, tone, category);

  const result = await callAI(null, [{ role: 'user', content: prompt }], {
    maxTokens: 2048,
    timeoutMs: 60_000, // 60s — blog posts are 800-1200 words
    validateResponse: (text) => {
      if (!text) throw new Error('Empty response');
      if (!text.includes('"title"')) throw new Error('Response missing title field');
      if (!text.includes('"body"')) throw new Error('Response missing body field');
      const trimmed = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
      if (!trimmed.endsWith('}')) throw new Error('Response appears truncated (no closing brace)');
    }
  });
  let text = result.text;
  console.log(`Blog draft generated by provider: ${result.provider}`);

  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');

  // Parse JSON response — regex extraction to handle literal newlines
  let article;
  const titleMatch = text.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const excerptMatch = text.match(/"excerpt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const metaMatch = text.match(/"metaDescription"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]*?)"\s*\}$/);

  if (titleMatch && bodyMatch) {
    article = {
      title: titleMatch[1].replace(/\\"/g, '"'),
      excerpt: excerptMatch ? excerptMatch[1].replace(/\\"/g, '"') : '',
      metaDescription: metaMatch ? metaMatch[1].replace(/\\"/g, '"') : '',
      body: bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
    };
  } else {
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
    slug: slugify(article.title),
    excerpt: article.excerpt || article.metaDescription || '',
    metaDescription: article.metaDescription || article.excerpt || '',
    category,
    body: article.body,
    date: new Date().toISOString(),
    status: 'pending',
    tone: tone.name,
    generatedFrom: {
      headlineCount: headlines.length,
      trendingTermCount: trendingTerms.length
    },
    reviewedAt: null,
    rejectionReason: null
  };
}

async function storeDraft(draft) {
  const store = getStore({ name: STORE_NAME, siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });

  let drafts = [];
  try {
    const existing = await store.get('data', { type: 'json' });
    if (Array.isArray(existing)) drafts = existing;
  } catch (e) {
    // First run
  }

  drafts.unshift(draft);

  // Keep max 50 drafts
  if (drafts.length > 50) drafts = drafts.slice(0, 50);

  await store.setJSON('data', drafts);
  console.log(`Stored blog draft: "${draft.title}" (${drafts.length} total)`);
}

async function sendNotificationEmail(draft) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping notification email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const adminUrl = 'https://islandgoodes.com/admin/blog-drafts';

  // Convert markdown ## headings to HTML for email preview
  const previewBody = draft.body
    .split('\n\n')
    .slice(0, 3)
    .map(p => {
      if (p.startsWith('## ')) return `<h3 style="color: #1b6b5a; margin: 16px 0 8px;">${p.replace('## ', '')}</h3>`;
      return `<p style="color: #555; line-height: 1.7; margin: 0 0 12px;">${p}</p>`;
    })
    .join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
        <p style="color: #666; margin: 5px 0;">New Blog Draft Ready for Review</p>
      </div>
      <div style="background: #f7f5f2; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #2d3436; margin: 0 0 8px;">${draft.title}</h2>
        <p style="color: #636e72; margin: 0 0 4px; font-size: 14px;">Category: ${draft.category} | Tone: ${draft.tone}</p>
        <p style="color: #636e72; margin: 0; font-size: 14px;">${draft.body.split(/\s+/).length} words</p>
      </div>
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2d3436; margin: 0 0 12px;">Preview:</h3>
        ${previewBody}
        <p style="color: #999; font-style: italic;">... (click below to read the full draft)</p>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${adminUrl}" style="background: #1b6b5a; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Review & Approve Draft</a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">
        Island Goodes | 27-2365 Hawaii Belt Rd, Papaikou, HI 96781<br>
        <a href="https://www.islandgoodes.com" style="color: #1b6b5a;">www.islandgoodes.com</a>
      </p>
    </div>`;

  for (const email of NOTIFY_EMAILS) {
    try {
      await resend.emails.send({
        from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
        to: [email],
        subject: `New Blog Draft: ${draft.title}`,
        html
      });
    } catch (err) {
      console.error(`Failed to send notification to ${email}:`, err.message);
    }
  }
}

export const handler = async () => {
  console.log('Blog Draft Generator: Starting weekly generation...');

  try {
    const [headlines, volcanoData, trendingTerms, recentTitles] = await Promise.all([
      fetchGoogleNewsHeadlines(),
      fetchVolcanoData(),
      fetchTrendingSearchTerms(),
      getRecentDraftTitles()
    ]);

    console.log(`Fetched: ${headlines.length} headlines, volcano: ${volcanoData ? 'yes' : 'no'}, ${trendingTerms.length} trending terms, ${recentTitles.length} recent draft titles`);

    const draft = await generateDraft(headlines, volcanoData, trendingTerms, recentTitles);
    console.log(`Generated: "${draft.title}" (tone: ${draft.tone}, category: ${draft.category}, ${draft.body.split(/\s+/).length} words)`);

    await storeDraft(draft);
    await sendNotificationEmail(draft);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, title: draft.title, id: draft.id })
    };
  } catch (err) {
    console.error('Blog draft generation failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
