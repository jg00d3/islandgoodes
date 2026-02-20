// AI Chat Assistant — multi-provider with failover
// Handles both public guest chat and admin test chat

import { getStore } from '@netlify/blobs';
import { knowledgeBase } from './knowledge-base.js';
import { callAI } from './ai-provider.js';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';

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

// Daily per-IP rate limiting (in-memory, resets on cold start)
const dailyLimitMap = new Map();
const DAILY_LIMIT = 50;

function checkDailyLimit(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = dailyLimitMap.get(ip);

  if (!entry || entry.date !== today) {
    dailyLimitMap.set(ip, { date: today, count: 1 });
    return true;
  }

  if (entry.count >= DAILY_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Log chat usage to Netlify Blobs (fire-and-forget)
function logChatUsage(ip, messageCount, usage, lastUserMessage, aiResponse) {
  try {
    const store = getStore({
      name: 'chat-usage',
      siteID: SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    // Mask last octet of IP for privacy
    const maskedIp = ip.replace(/\.\d+$/, '.x');

    const entry = {
      ip: maskedIp,
      timestamp: new Date().toISOString(),
      messageCount,
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
      question: String(lastUserMessage || '').slice(0, 500),
      answer: String(aiResponse || '').slice(0, 500)
    };

    // Read, append, cap, write — fire-and-forget
    store.get('data', { type: 'json' }).then(existing => {
      const log = Array.isArray(existing) ? existing : [];
      log.push(entry);
      // Cap at 5000 entries
      while (log.length > 5000) log.shift();
      return store.setJSON('data', log);
    }).catch(err => {
      console.error('Failed to log chat usage:', err);
    });
  } catch (err) {
    console.error('Failed to init chat usage store:', err);
  }
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

    if (checkOnly) {
      // Check if any provider is available (env var or configured providers)
      const { getProviderConfig } = await import('./ai-provider.js');
      const providers = await getProviderConfig();
      const configured = providers.some(p => p.enabled);
      return {
        statusCode: 200,
        body: JSON.stringify({ configured })
      };
    }

    // Rate limiting for public requests
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || event.headers['client-ip']
      || 'unknown';

    if (source === 'public') {
      if (!checkRateLimit(clientIp)) {
        return {
          statusCode: 429,
          body: JSON.stringify({ error: 'Too many requests. Please wait a moment before sending another message.' })
        };
      }

      if (!checkDailyLimit(clientIp)) {
        return {
          statusCode: 429,
          body: JSON.stringify({ error: 'You\'ve reached the daily message limit. Please try again tomorrow, or contact us at 808-964-2291.' })
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

    // Call AI via provider abstraction (failover across configured providers)
    const result = await callAI(systemPrompt, conversationMessages, { maxTokens: 500 });
    const aiResponse = result.text || 'Sorry, I could not generate a response.';

    // Log usage for public requests (fire-and-forget)
    if (source === 'public') {
      const lastUserMsg = conversationMessages.filter(m => m.role === 'user').pop()?.content || '';
      logChatUsage(clientIp, conversationMessages.length, result.usage, lastUserMsg, aiResponse);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        response: aiResponse,
        usage: result.usage,
        provider: result.provider
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
