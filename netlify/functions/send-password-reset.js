// Emails an admin a link to set a new password. Requested by an owner or super admin.
import { Resend } from 'resend';
import { blobStore, getAdminSession, issuePasswordResetToken } from './lib/admin-auth.js';

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

    const token = issuePasswordResetToken(target);
    const resetUrl = `${process.env.URL || 'https://islandgoodes.com'}/admin/reset-password?token=${token}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
      to: [target.email],
      subject: 'Reset Your Island Goodes Admin Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Admin Password Reset</p>
          </div>
          <p style="color: #555; line-height: 1.6;">A password reset was requested for your admin account. This link works once and expires in 1 hour.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #c5a572; color: #1a1a1a; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">Set a New Password</a>
          </p>
          <p style="color: #999; font-size: 13px;">If you weren't expecting this, you can ignore this email. Your password won't change.</p>
        </div>
      `
    });

    if (error) {
      console.error('Password reset email error:', error);
      return respond(500, { error: 'Could not send the reset email' });
    }
    return respond(200, { success: true });
  } catch (err) {
    console.error('Password reset request error:', err);
    return respond(500, { error: 'Could not send the reset email' });
  }
}
