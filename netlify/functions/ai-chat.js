// AI Chat Assistant powered by Claude
// Handles both public guest chat and admin test chat

import { knowledgeBase } from './knowledge-base.js';

// Simple in-memory rate limiting (resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { message, messages, training, source, checkOnly } = JSON.parse(event.body);

    // Check if API is configured
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (checkOnly) {
      return {
        statusCode: 200,
        body: JSON.stringify({ configured: !!apiKey })
      };
    }

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'AI Chat is not configured. Please add ANTHROPIC_API_KEY to environment variables.' })
      };
    }

    // Rate limiting for public requests
    if (source === 'public') {
      const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || event.headers['client-ip']
        || 'unknown';

      if (!checkRateLimit(clientIp)) {
        return {
          statusCode: 429,
          body: JSON.stringify({ error: 'Too many requests. Please wait a moment before sending another message.' })
        };
      }
    }

    // Build conversation messages
    let conversationMessages;

    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Multi-turn: use the provided messages array
      conversationMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 2000)
      }));
    } else if (message) {
      // Single message (backward compat)
      conversationMessages = [{ role: 'user', content: String(message).slice(0, 2000) }];
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Build system prompt based on source
    const systemPrompt = source === 'public'
      ? buildPublicSystemPrompt()
      : buildSystemPrompt(training || {});

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: systemPrompt,
        messages: conversationMessages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Claude API error:', errorData);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get AI response' })
      };
    }

    const data = await response.json();
    const aiResponse = data.content?.[0]?.text || 'Sorry, I could not generate a response.';

    return {
      statusCode: 200,
      body: JSON.stringify({
        response: aiResponse,
        usage: data.usage
      })
    };

  } catch (err) {
    console.error('AI Chat error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

function buildPublicSystemPrompt() {
  return `You are the friendly virtual concierge for Island Goodes, an adults-only (18+) oceanview vacation rental in Papaikou, Hawaii, just minutes from Hilo.

PERSONALITY & TONE:
- Warm, welcoming Hawaiian hospitality. Use "Aloha" as a greeting when starting conversations.
- Keep responses concise — 2-4 sentences is ideal, no more than a short paragraph.
- Be enthusiastic but honest. Never make up information.
- If you're unsure about something specific, suggest contacting the hosts.
- NEVER use markdown formatting (no **bold**, *italic*, bullet points, or headers). Write in plain text only.
- NEVER use emoji. Keep responses clean and professional.

WHAT TO SAY IF ASKED ABOUT:
- Availability or specific dates: "I don't have real-time availability — please check islandgoodes.com/book or call 808-964-2291."
- Cancellation policy: Direct them to the booking page or to call.
- Things outside your knowledge: Suggest contacting the hosts directly.

PROPERTY KNOWLEDGE BASE (extracted from the actual website):
${knowledgeBase}`;
}

function buildSystemPrompt(training) {
  const defaultTone = 'Friendly, warm Hawaiian hospitality. Use "Aloha" as a greeting occasionally. Be helpful and concise.';

  let prompt = `You are a helpful virtual concierge for Island Goodes, an adults-only vacation rental in Papaikou, Hawaii (near Hilo).

Your role is to answer questions from potential guests and current guests about the property, local area, and their stay.

PERSONALITY & TONE:
${training.toneInfo || defaultTone}

IMPORTANT GUIDELINES:
- Keep responses concise (2-4 sentences usually)
- Be accurate - only share information you know
- For booking questions, direct them to: islandgoodes.com/book or call 808-964-2291
- If you don't know something specific, suggest they contact the hosts
- Never make up information about rates, availability, or policies
- Be warm and welcoming - you represent Hawaiian hospitality

`;

  if (training.propertyInfo) {
    prompt += `\nPROPERTY INFORMATION:\n${training.propertyInfo}\n`;
  }

  if (training.locationInfo) {
    prompt += `\nLOCATION & ATTRACTIONS:\n${training.locationInfo}\n`;
  }

  if (training.faqInfo) {
    prompt += `\nFREQUENTLY ASKED QUESTIONS:\n${training.faqInfo}\n`;
  }

  prompt += `
CONTACT INFORMATION:
- Website: www.islandgoodes.com
- Phone: 808-964-2291
- Booking: islandgoodes.com/book
- Address: 27-2365 Hawaii Belt Rd, Papaikou, HI 96781

If asked about current availability or specific dates, always direct them to check online or call, as you don't have real-time availability data.`;

  return prompt;
}
