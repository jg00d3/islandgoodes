// Finishes an emailed admin invitation. This is the only public way to create an admin,
// and it needs a signed invite issued by send-invitation.
import bcrypt from 'bcryptjs';
import { blobStore, codeTokenId, readInviteToken } from './lib/admin-auth.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const respond = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });

  try {
    const { invite: token, checkOnly, fullName, twoFAEmail, password } = JSON.parse(event.body || '{}');
    const invite = readInviteToken(token);
    if (!invite) return respond(400, { error: 'This invitation is invalid or has expired.' });

    const usedInvites = blobStore('used-admin-invites');
    const inviteId = codeTokenId(token);
    if (await usedInvites.get(inviteId)) {
      return respond(409, { error: 'This invitation has already been used.' });
    }

    const adminStore = blobStore('admins');
    const admins = (await adminStore.get('data', { type: 'json' })) || [];
    if (admins.some(a => a.email?.toLowerCase() === invite.email)) {
      return respond(409, { error: 'This email is already an admin. Please log in instead.' });
    }

    if (checkOnly) return respond(200, { valid: true, email: invite.email });

    const name = String(fullName || '').trim();
    const codeEmail = String(twoFAEmail || '').trim() || invite.email;
    if (!name) return respond(400, { error: 'Please enter your full name.' });
    if (typeof password !== 'string' || password.length < 8) {
      return respond(400, { error: 'Password must be at least 8 characters.' });
    }
    if (!EMAIL_PATTERN.test(codeEmail)) {
      return respond(400, { error: 'Please enter a valid 2FA email address.' });
    }

    admins.push({
      id: Date.now(),
      username: invite.email.split('@')[0].replace(/[^a-z0-9]/g, ''),
      fullName: name,
      email: invite.email,
      twoFAEmail: codeEmail,
      passwordHashBcrypt: await bcrypt.hash(password, 12),
      role: 'admin',
      created: new Date().toISOString(),
      invitedBy: invite.invitedBy
    });
    await adminStore.setJSON('data', admins);
    await usedInvites.set(inviteId, new Date().toISOString());

    return respond(200, { success: true });
  } catch (error) {
    console.error('Admin activation error:', error);
    return respond(500, { error: 'Could not activate this account. Please try again.' });
  }
}
