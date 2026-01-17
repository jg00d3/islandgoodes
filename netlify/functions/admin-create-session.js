import { getStore } from '@netlify/blobs';
import crypto from 'crypto';

const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days for trusted devices

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
    const { email, trustedDevice } = JSON.parse(event.body || '{}');

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Verify this is a valid admin (extra security check)
    const adminStore = getStore({
      name: 'admins',
      siteID: SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    const admins = await adminStore.get('data', { type: 'json' }) || [];
    const admin = admins.find(a => a.email?.toLowerCase() === email.toLowerCase());

    if (!admin) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid admin' })
      };
    }

    // Create session
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
      trustedDevice: trustedDevice || false,
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
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('Create session error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
