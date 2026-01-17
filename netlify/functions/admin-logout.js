import { getStore } from '@netlify/blobs';

const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";

export async function handler(event) {
  // Allow POST and GET for easier logout
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get session token from cookie
    const cookies = event.headers.cookie || '';
    const sessionMatch = cookies.match(/admin_session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : null;

    if (sessionToken) {
      // Delete session from Netlify Blobs
      const sessionStore = getStore({
        name: 'admin-sessions',
        siteID: SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });

      try {
        await sessionStore.delete(sessionToken);
      } catch (deleteError) {
        console.log('Session may not exist:', deleteError.message);
      }
    }

    // Clear the cookie by setting it to expire in the past
    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': 'admin_session=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, message: 'Logged out' })
    };

  } catch (error) {
    console.error('Logout error:', error);
    // Still clear the cookie even on error
    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': 'admin_session=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, message: 'Logged out' })
    };
  }
}
