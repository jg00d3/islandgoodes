import crypto from 'crypto';
import {
  blobStore,
  codeTokenId,
  codeTokenMatches,
  createAdminSession,
  readLoginTicket,
  trustedDeviceCookie
} from './lib/admin-auth.js';

const MAX_FAILED_ATTEMPTS = 5;

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { loginTicket, code, token, rememberDevice } = JSON.parse(event.body || '{}');
    const email = readLoginTicket(loginTicket);

    if (!email) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Login expired. Please sign in again.' }) };
    }
    if (!code || !token) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Code and token are required' }) };
    }

    // Each failed attempt is its own key, so counting does not depend on read-after-write.
    const attempts = blobStore('admin-2fa-attempts');
    const prefix = `${codeTokenId(token)}/`;
    const { blobs } = await attempts.list({ prefix });
    if (blobs.length >= MAX_FAILED_ATTEMPTS) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Too many attempts. Please request a new code.' }) };
    }

    if (!codeTokenMatches(loginTicket, String(code), token)) {
      await attempts.set(`${prefix}${crypto.randomUUID()}`, String(Date.now()));
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid or expired code' }) };
    }

    const cookies = [await createAdminSession(email)];
    if (rememberDevice) cookies.push(trustedDeviceCookie(email));

    return {
      statusCode: 200,
      multiValueHeaders: { 'Set-Cookie': cookies },
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Code verified' })
    };
  } catch (err) {
    console.error('Verify 2FA error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
