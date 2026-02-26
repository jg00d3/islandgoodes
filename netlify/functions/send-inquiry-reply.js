import { Resend } from 'resend';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { to, toName, replyText, originalMessage } = JSON.parse(event.body);

    if (!to || !replyText) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: 'Island Goodes <noreply@islandgoodes.com>',
      to: [to],
      replyTo: 'islandgoodes@gmail.com',
      subject: 'Re: Your Inquiry to Island Goodes',
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 0; background: #fff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1b6b5a 0%, #2d8a76 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 400; letter-spacing: 1px;">Island Goodes</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Adults-Only Retreat Near Hilo, Hawaii</p>
          </div>

          <!-- Main Content -->
          <div style="padding: 35px 30px;">
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
              Aloha${toName ? ` ${toName}` : ''},
            </p>

            <p style="color: #333; font-size: 16px; line-height: 1.8; margin: 0 0 25px;">
              Thank you for reaching out to us! We're delighted to respond to your inquiry.
            </p>

            <div style="color: #333; font-size: 16px; line-height: 1.8; white-space: pre-wrap; margin-bottom: 30px;">${escapeHtml(replyText)}</div>

            <!-- Original Message Box -->
            <div style="background: #f8f9fa; border-left: 4px solid #1b6b5a; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
              <p style="color: #666; font-size: 13px; margin: 0 0 10px; font-weight: 600;">Your original message:</p>
              <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${escapeHtml(originalMessage)}</p>
            </div>

            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
              If you have any more questions, please don't hesitate to reply to this email or give us a call.
            </p>

            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 20px 0 0;">
              Warm regards,<br>
              <strong style="color: #1b6b5a;">The Island Goodes Team</strong>
            </p>
          </div>

          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 25px 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="color: #888; font-size: 13px; margin: 0 0 8px;">
              27-2365 Hawaii Belt Rd, Papaikou, HI 96781
            </p>
            <p style="margin: 0;">
              <a href="https://islandgoodes.com" style="color: #1b6b5a; text-decoration: none; font-size: 13px;">islandgoodes.com</a>
              <span style="color: #ccc; margin: 0 10px;">|</span>
              <a href="tel:+18083157873" style="color: #1b6b5a; text-decoration: none; font-size: 13px;">(808) 315-7873</a>
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('Email error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}

// Helper function to escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
