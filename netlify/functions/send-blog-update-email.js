// One-off: Send email to Garvin explaining the AI blog changes
// Usage: curl -X POST https://islandgoodes.com/.netlify/functions/send-blog-update-email

import { Resend } from 'resend';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
      to: ['goodegarvin@gmail.com'],
      cc: ['sysadmroot@gmail.com'],
      subject: 'AI Blog Posts — Removed & Rebuilt',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Website Update</p>
          </div>

          <p style="color: #555; line-height: 1.7;">Dad,</p>

          <p style="color: #555; line-height: 1.7;">I wanted to let you know what we've done about the AI-generated blog posts:</p>

          <div style="background: #fdf2f2; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #c0392b; margin: 0 0 8px;">What We Removed</h3>
            <p style="color: #555; line-height: 1.6; margin: 0;">All AI-generated blog posts and Island Pulse articles have been removed from the live website. The issues you found were real — the AI was making up beach names, getting locations wrong (like putting Richardson Beach in Kona), referencing closed attractions (Jaggar Museum), and using Hawaiian words incorrectly.</p>
          </div>

          <div style="background: #fef9e7; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #e67e22; margin: 0 0 8px;">Why It Happened</h3>
            <p style="color: #555; line-height: 1.6; margin: 0;">The system was using a cheaper AI model that writes things that sound plausible but aren't always accurate, and it was publishing automatically with no human review. That was a bad setup.</p>
          </div>

          <div style="background: #f0faf0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin: 0 0 8px;">What's Changed</h3>
            <ul style="color: #555; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Switched to a better, more accurate AI model (Claude Sonnet 4.5)</li>
              <li>Added a second AI pass that fact-checks the article before sending it to you</li>
              <li><strong>Nothing will ever auto-publish again</strong> — every draft goes to "pending" status</li>
              <li>You'll get an email with a preview of the draft and any fact-check warnings</li>
              <li>You can approve or reject it from the admin dashboard</li>
              <li><strong>If you don't have time to review it, just ignore the email</strong> — the post stays unpublished and nothing happens</li>
            </ul>
          </div>

          <div style="background: #f7f5f2; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #1b6b5a; margin: 0 0 8px;">What's Still on the Site</h3>
            <p style="color: #555; line-height: 1.6; margin: 0;">The 9 original blog posts are still live — those were written with more care and have accurate information. The Island Pulse daily articles page has been turned off completely.</p>
          </div>

          <p style="color: #555; line-height: 1.7;">Sorry for the trouble. We should have had the review step in place from the beginning.</p>

          <p style="color: #555; line-height: 1.7;">— Jeremiah</p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Island Goodes | 27-2365 Hawaii Belt Rd, Papaikou, HI 96781<br>
            <a href="https://islandgoodes.com" style="color: #1b6b5a;">islandgoodes.com</a>
          </p>
        </div>
      `
    });

    if (error) {
      console.error('Email error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Email sent to Garvin (cc: Jeremiah)' }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
