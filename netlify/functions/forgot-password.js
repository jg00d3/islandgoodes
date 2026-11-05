// Public "Forgot password?" request. The response is the same whether or not the email
// belongs to an admin, and takes the same minimum time, so it cannot reveal who has an account.
import crypto from 'crypto';
import { blobStore } from './lib/admin-auth.js';
import { sendPasswordResetEmail } from './lib/password-reset-email.js';

const MIN_RESPONSE_MS = 1500;
const MAX_EMAILS_PER_HOUR = 3;

async function sendIfAllowed(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  const admins = (await blobStore('admins').get('data', { type: 'json' })) || [];
  const admin = admins.find(a => a.email?.toLowerCase() === email);
  if (!admin) return;

  // Each send is its own key, so counting does not depend on read-after-write.
  const requests = blobStore('password-reset-requests');
  const emailId = crypto.createHash('sha256').update(email).digest('hex');
  const prefix = `${emailId}/${Math.floor(Date.now() / 3600000)}/`;
  const { blobs } = await requests.list({ prefix });
  if (blobs.length >= MAX_EMAILS_PER_HOUR) return;

  await requests.set(`${prefix}${crypto.randomUUID()}`, String(Date.now()));
  await sendPasswordResetEmail(admin);
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const finished = new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_MS));
  try {
    const { email } = JSON.parse(event.body || '{}');
    await sendIfAllowed(email);
  } catch (error) {
    console.error('Forgot password error:', error.message);
  }
  await finished;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  };
}
