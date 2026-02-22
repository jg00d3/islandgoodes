// Review Response Generator — drafts professional replies to guest reviews
// Accepts review text, source, star rating, and guest name; returns AI-drafted reply

import { callAI } from './ai-provider.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function buildReplyPrompt(reviewText, source, starRating, guestName) {
  let toneGuidance;
  if (starRating >= 4) {
    toneGuidance = `This is a positive review (${starRating} stars). Express genuine gratitude, highlight specific things the guest enjoyed and mirror their enthusiasm. Warmly invite them to return.`;
  } else if (starRating === 3) {
    toneGuidance = `This is a mixed review (3 stars). Thank the guest sincerely, acknowledge any specific concerns they raised, and briefly mention any improvements being made. Stay positive without being dismissive.`;
  } else {
    toneGuidance = `This is a critical review (${starRating} star${starRating !== 1 ? 's' : ''}). Lead with empathy and a sincere apology. Acknowledge specific concerns without being defensive. Offer to discuss further by phone at 808-964-2291.`;
  }

  const greeting = guestName ? `Address the guest as "${guestName}"` : 'Do not address anyone by name';

  return `You are writing a review response on behalf of Island Goodes, an adults-only oceanview vacation rental in Papaikou, Hawaii (near Hilo on the Big Island).

REVIEW SOURCE: ${source || 'Unknown'}
STAR RATING: ${starRating}/5
${greeting}

GUEST REVIEW:
"${reviewText}"

RESPONSE GUIDELINES:
${toneGuidance}

REQUIREMENTS:
- Write 3-5 sentences in plain text (no markdown, no bullet points, no headers)
- Do NOT use emoji
- Use "Aloha" as a greeting and/or "Mahalo" as a thank you — naturally, not forced
- Be genuine and specific — reference details from the guest's review
- Keep a professional yet warm Hawaiian hospitality tone
- Sign off as "The Island Goodes Team" or "The Team at Island Goodes"
- For negative reviews, do NOT argue or make excuses — acknowledge and offer to make it right
- Do NOT include any subject line or formatting — just the reply text

Write the reply now.`;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { reviewText, source, starRating, guestName } = JSON.parse(event.body || '{}');

    if (!reviewText || !reviewText.trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Review text is required' }) };
    }

    const rating = parseInt(starRating) || 5;
    const prompt = buildReplyPrompt(reviewText.trim(), source, rating, guestName?.trim());

    const result = await callAI(null, [{ role: 'user', content: prompt }], { maxTokens: 500 });
    const reply = result.text || '';

    if (!reply) {
      throw new Error('Empty response from AI provider');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: reply.trim(),
        provider: result.provider,
        usage: result.usage
      })
    };
  } catch (err) {
    console.error('Review reply generation failed:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
}
