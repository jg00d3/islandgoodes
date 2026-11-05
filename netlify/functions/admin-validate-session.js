import { readSessionToken } from './lib/admin-auth.js';

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

    const session = await readSessionToken(sessionToken);

    if (!session) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid: false, reason: 'Session not found' })
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
