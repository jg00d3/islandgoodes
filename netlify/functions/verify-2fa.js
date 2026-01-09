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
      return {
        statusCode: 200,
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
