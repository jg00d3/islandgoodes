import { getStore } from '@netlify/blobs';
import crypto from 'crypto';

const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Simple hash function - must match send-2fa.js
function createToken(code, email, timestamp, secret) {
  const data = `${code}:${email}:${timestamp}:${secret}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Generate secure session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
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
    const { email, code, token } = JSON.parse(event.body);

    if (!email || !code || !token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email, code, and token are required' })
      };
    }

    // Parse token to get timestamp
    const [originalToken, timestamp] = token.split(':');
    const timestampNum = parseInt(timestamp, 10);

    // Check if code expired (10 minutes)
    const TEN_MINUTES = 10 * 60 * 1000;
    if (Date.now() - timestampNum > TEN_MINUTES) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Code expired. Please request a new one.' })
      };
    }

    // Recreate token with user-provided code
    const secret = process.env.RESEND_API_KEY.slice(-10);
    const expectedToken = createToken(code, email, timestampNum, secret);

    // Verify
    if (expectedToken === originalToken) {
      // Create server-side session
      const sessionToken = generateSessionToken();
      const expiresAt = Date.now() + SESSION_DURATION;

      // Store session in Netlify Blobs
      const sessionStore = getStore({
        name: 'admin-sessions',
        siteID: SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });

      await sessionStore.setJSON(sessionToken, {
        email: email.toLowerCase(),
        createdAt: Date.now(),
        expiresAt: expiresAt
      });

      // Set secure HTTP-only cookie
      const cookieExpires = new Date(expiresAt).toUTCString();
      const isProduction = process.env.URL?.includes('netlify.app') || process.env.URL?.includes('islandgoodes.com');
      const secureCookie = isProduction ? '; Secure' : '';

      return {
        statusCode: 200,
        headers: {
          'Set-Cookie': `admin_session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict${secureCookie}; Expires=${cookieExpires}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: true, message: 'Code verified' })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid code' })
      };
    }

  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
