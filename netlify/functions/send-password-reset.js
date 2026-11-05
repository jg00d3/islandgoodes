// Emails an admin a link to set a new password. Requested by an owner or super admin.
import { blobStore, getAdminSession } from './lib/admin-auth.js';
import { sendPasswordResetEmail } from './lib/password-reset-email.js';

const respond = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') return respond(405, { error: 'Method not allowed' });

  const session = await getAdminSession(event);
  if (!session) return respond(401, { error: 'Login required' });

  try {
    const admins = (await blobStore('admins').get('data', { type: 'json' })) || [];
    const requester = admins.find(a => a.email?.toLowerCase() === session.email);
    if (requester?.role !== 'owner' && requester?.role !== 'superadmin') {
      return respond(403, { error: 'Only super admins can send password resets' });
    }

    const { email } = JSON.parse(event.body || '{}');
    const target = admins.find(a => a.email?.toLowerCase() === String(email || '').trim().toLowerCase());
    if (!target) return respond(404, { error: 'Admin not found' });

    await sendPasswordResetEmail(target);
    return respond(200, { success: true });
  } catch (err) {
    console.error('Password reset request error:', err);
    return respond(500, { error: 'Could not send the reset email' });
  }
}
