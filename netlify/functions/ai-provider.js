// AI Provider Abstraction with Failover
// Reads provider configs from Netlify Blobs, tries each in priority order.
// Falls back to ANTHROPIC_API_KEY env var if no providers configured.

import { getStore } from '@netlify/blobs';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const STORE_NAME = 'ai-providers';
const TIMEOUT_MS = 10_000; // 10 seconds per provider attempt

// Simple in-memory cache (per cold start)
let providerCache = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 60 seconds

/**
 * Load provider configs from Blobs. If none exist, falls back to
 * a default Anthropic provider using the ANTHROPIC_API_KEY env var.
 */
export async function getProviderConfig() {
  if (providerCache && Date.now() - cacheTime < CACHE_TTL) {
    return providerCache;
  }

  try {
    const store = getStore({
      name: STORE_NAME,
      siteID: SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    const providers = await store.get('data', { type: 'json' });

    if (Array.isArray(providers) && providers.length > 0) {
      providerCache = providers;
      cacheTime = Date.now();
      return providers;
    }
  } catch (err) {
    console.warn('Failed to load AI providers from Blobs:', err.message);
  }

  // Fallback: create a default Anthropic provider from env var
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (!envKey) {
    return [];
  }

  const fallback = [{
    id: 'env-anthropic',
    name: 'Claude (env var)',
    type: 'anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-haiku-4-5-20251001',
    apiKey: envKey,
    extraHeaders: {},
    enabled: true,
    priority: 1
  }];

  providerCache = fallback;
  cacheTime = Date.now();
  return fallback;
}

/** Clear the in-memory provider cache (call after config changes) */
export function clearProviderCache() {
  providerCache = null;
  cacheTime = 0;
}

/**
 * Call AI with failover across configured providers.
 *
 * @param {string|null} systemPrompt - System prompt (null to omit)
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {object} options
 * @param {number} [options.maxTokens=500] - Max tokens to generate
 * @returns {Promise<{text: string, usage: object|null, provider: string}>}
 */
export async function callAI(systemPrompt, messages, options = {}) {
  const { maxTokens = 500 } = options;
  const providers = await getProviderConfig();

  // Sort by priority (lowest first), filter to enabled
  const active = providers
    .filter(p => p.enabled)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  if (active.length === 0) {
    throw new Error('No AI providers configured. Add a provider in Admin > AI Chat, or set the ANTHROPIC_API_KEY environment variable.');
  }

  const errors = [];

  for (const provider of active) {
    try {
      const result = await callProvider(provider, systemPrompt, messages, maxTokens);
      return { ...result, provider: provider.name };
    } catch (err) {
      const msg = `${provider.name}: ${err.message}`;
      console.warn(`AI provider failed — ${msg}`);
      errors.push(msg);
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}

/**
 * Call a single provider. Handles both Anthropic and OpenAI-compatible APIs.
 */
async function callProvider(provider, systemPrompt, messages, maxTokens) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    if (provider.type === 'anthropic') {
      return await callAnthropic(provider, systemPrompt, messages, maxTokens, controller.signal);
    } else {
      return await callOpenAI(provider, systemPrompt, messages, maxTokens, controller.signal);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Anthropic API adapter
 */
async function callAnthropic(provider, systemPrompt, messages, maxTokens, signal) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': provider.apiKey,
    'anthropic-version': '2023-06-01',
    ...(provider.extraHeaders || {})
  };

  const body = {
    model: provider.model,
    max_tokens: maxTokens,
    messages
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(provider.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return {
    text: data.content?.[0]?.text || '',
    usage: data.usage || null
  };
}

/**
 * OpenAI-compatible API adapter (vLLM, OpenAI, Ollama, etc.)
 */
async function callOpenAI(provider, systemPrompt, messages, maxTokens, signal) {
  const headers = {
    'Content-Type': 'application/json',
    ...(provider.extraHeaders || {})
  };

  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  // Build messages array with system as first message
  const fullMessages = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);

  const body = {
    model: provider.model,
    max_tokens: maxTokens,
    messages: fullMessages
  };

  const response = await fetch(provider.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  // Map OpenAI usage format to a common shape
  const usage = data.usage ? {
    input_tokens: data.usage.prompt_tokens || 0,
    output_tokens: data.usage.completion_tokens || 0
  } : null;

  return {
    text: data.choices?.[0]?.message?.content || '',
    usage
  };
}
