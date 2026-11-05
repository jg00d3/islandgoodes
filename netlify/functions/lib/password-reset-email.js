import { Resend } from 'resend';
import { issuePasswordResetToken } from './admin-auth.js';

// Emails an admin a one-time link to set a new password. Throws if the email cannot be sent.
export async function sendPasswordResetEmail(admin) {
  const token = issuePasswordResetToken(admin);
  const resetUrl = `${process.env.URL || 'https://islandgoodes.com'}/admin/reset-password?token=${token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
    to: [admin.email],
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

  if (error) throw new Error(`Password reset email failed: ${error.message || error}`);
}
