import { Resend } from 'resend';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { to, subject, message } = JSON.parse(event.body);

    if (!to || !subject || !message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Adults-Only Retreat Near Hilo, Hawaii</p>
          </div>
          <div style="color: #555; line-height: 1.8; white-space: pre-wrap;">${message}</div>
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

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
