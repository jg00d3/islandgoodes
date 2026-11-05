// Sets a new password from an emailed reset link. The link needs no login.
import bcrypt from 'bcryptjs';
import { blobStore, passwordResetTokenMatches, readPasswordResetEmail } from './lib/admin-auth.js';

const respond = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });

  try {
    const { token, checkOnly, password } = JSON.parse(event.body || '{}');
    const email = readPasswordResetEmail(token);
    const store = blobStore('admins');
    const admins = email ? (await store.get('data', { type: 'json' })) || [] : [];
    const admin = admins.find(a => a.email?.toLowerCase() === email);

    if (!admin || !passwordResetTokenMatches(token, admin)) {
      return respond(400, { error: 'This reset link is invalid, expired, or has already been used.' });
    }

    if (checkOnly) return respond(200, { valid: true, email: admin.email });

    if (typeof password !== 'string' || password.length < 8) {
      return respond(400, { error: 'Password must be at least 8 characters.' });
    }

    admin.passwordHashBcrypt = await bcrypt.hash(password, 12);
    delete admin.passwordHash;
    await store.setJSON('data', admins);

    console.log(`Password reset by link for admin: ${admin.email}`);
    return respond(200, { success: true });
  } catch (error) {
    console.error('Password reset error:', error);
    return respond(500, { error: 'Could not reset the password. Please try again.' });
  }
}
