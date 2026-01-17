import { getStore } from '@netlify/blobs';

const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { sessionToken } = JSON.parse(event.body || '{}');

    if (!sessionToken) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: false, reason: 'No session token' })
      };
    }

    // Get session from Netlify Blobs
    const sessionStore = getStore({
      name: 'admin-sessions',
      siteID: SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    const session = await sessionStore.get(sessionToken, { type: 'json' });

    if (!session) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: false, reason: 'Session not found' })
      };
    }

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      // Clean up expired session
      await sessionStore.delete(sessionToken);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: false, reason: 'Session expired' })
      };
    }

    // Session is valid
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: true,
        email: session.email,
        expiresAt: session.expiresAt
      })
    };

  } catch (error) {
    console.error('Session validation error:', error);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false, reason: 'Validation error' })
    };
  }
}
