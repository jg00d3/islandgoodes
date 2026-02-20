// AI Provider Config — Admin CRUD for provider management
// Credentials stored server-side in Netlify Blobs, never sent to browser unmasked.

import { getStore } from '@netlify/blobs';
import { clearProviderCache } from './ai-provider.js';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const STORE_NAME = 'ai-providers';

function getProviderStore() {
  return getStore({
    name: STORE_NAME,
    siteID: SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN
  });
}

/** Mask a credential string: show only last 4 chars */
function maskCredential(value) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= 4) return value;
  return '\u2022'.repeat(8) + value.slice(-4);
}

/** Mask all sensitive fields in a provider config */
function maskProvider(provider) {
  const masked = { ...provider };
  masked.apiKey = maskCredential(provider.apiKey);
  if (provider.extraHeaders && typeof provider.extraHeaders === 'object') {
    masked.extraHeaders = {};
    for (const [key, val] of Object.entries(provider.extraHeaders)) {
      masked.extraHeaders[key] = maskCredential(val);
    }
  }
  return masked;
}

async function loadProviders() {
  const store = getProviderStore();
  try {
    const data = await store.get('data', { type: 'json' });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveProviders(providers) {
  const store = getProviderStore();
  await store.setJSON('data', providers);
  clearProviderCache();
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { action, provider, id, orderedIds } = JSON.parse(event.body);

    // ── LIST (returns masked credentials) ──
    if (action === 'list') {
      const providers = await loadProviders();
      return {
        statusCode: 200,
        body: JSON.stringify(providers.map(maskProvider))
      };
    }

    // ── SAVE (create or update) ──
    if (action === 'save') {
      if (!provider || !provider.name || !provider.type) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Provider name and type are required' }) };
      }

      const providers = await loadProviders();

      if (provider.id) {
        // Update existing — merge credentials (keep existing if masked value sent)
        const idx = providers.findIndex(p => p.id === provider.id);
        if (idx === -1) {
          return { statusCode: 404, body: JSON.stringify({ error: 'Provider not found' }) };
        }

        const existing = providers[idx];

        // If apiKey looks masked (starts with bullet chars), keep the existing one
        if (provider.apiKey && provider.apiKey.startsWith('\u2022')) {
          provider.apiKey = existing.apiKey;
        }

        // Same for extra headers
        if (provider.extraHeaders && existing.extraHeaders) {
          for (const [key, val] of Object.entries(provider.extraHeaders)) {
            if (typeof val === 'string' && val.startsWith('\u2022')) {
              provider.extraHeaders[key] = existing.extraHeaders[key] || '';
            }
          }
        }

        providers[idx] = { ...existing, ...provider };
      } else {
        // New provider — assign ID and priority
        provider.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        provider.priority = providers.length > 0
          ? Math.max(...providers.map(p => p.priority || 0)) + 1
          : 1;
        if (provider.enabled === undefined) provider.enabled = true;
        providers.push(provider);
      }

      await saveProviders(providers);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, provider: maskProvider(provider) })
      };
    }

    // ── DELETE ──
    if (action === 'delete') {
      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Provider ID required' }) };
      }

      let providers = await loadProviders();
      providers = providers.filter(p => p.id !== id);
      await saveProviders(providers);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // ── REORDER ──
    if (action === 'reorder') {
      if (!Array.isArray(orderedIds)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'orderedIds array required' }) };
      }

      const providers = await loadProviders();

      // Assign priority based on position in orderedIds
      for (const p of providers) {
        const idx = orderedIds.indexOf(p.id);
        p.priority = idx >= 0 ? idx + 1 : 999;
      }

      await saveProviders(providers);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // ── TEST ──
    if (action === 'test') {
      if (!provider) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Provider config required' }) };
      }

      // If testing an existing saved provider, resolve masked credentials
      if (provider.id && provider.apiKey && provider.apiKey.startsWith('\u2022')) {
        const providers = await loadProviders();
        const existing = providers.find(p => p.id === provider.id);
        if (existing) {
          provider.apiKey = existing.apiKey;
          if (provider.extraHeaders && existing.extraHeaders) {
            for (const [key, val] of Object.entries(provider.extraHeaders)) {
              if (typeof val === 'string' && val.startsWith('\u2022')) {
                provider.extraHeaders[key] = existing.extraHeaders[key] || '';
              }
            }
          }
        }
      }

      const start = Date.now();

      try {
        let response;

        if (provider.type === 'anthropic') {
          const headers = {
            'Content-Type': 'application/json',
            'x-api-key': provider.apiKey,
            'anthropic-version': '2023-06-01',
            ...(provider.extraHeaders || {})
          };

          response = await fetch(provider.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: provider.model,
              max_tokens: 20,
              messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }]
            }),
            signal: AbortSignal.timeout(10_000)
          });
        } else {
          // OpenAI-compatible
          const headers = {
            'Content-Type': 'application/json',
            ...(provider.extraHeaders || {})
          };
          if (provider.apiKey) {
            headers['Authorization'] = `Bearer ${provider.apiKey}`;
          }

          response = await fetch(provider.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: provider.model,
              max_tokens: 20,
              messages: [{ role: 'user', content: 'Say "OK" and nothing else.' }]
            }),
            signal: AbortSignal.timeout(10_000)
          });
        }

        const elapsed = Date.now() - start;

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          return {
            statusCode: 200,
            body: JSON.stringify({ success: false, error: `HTTP ${response.status}: ${errText.slice(0, 200)}`, elapsed })
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, elapsed })
        };
      } catch (err) {
        const elapsed = Date.now() - start;
        return {
          statusCode: 200,
          body: JSON.stringify({ success: false, error: err.message, elapsed })
        };
      }
    }

    return { statusCode: 400, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
  } catch (err) {
    console.error('AI provider config error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
