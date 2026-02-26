import { Resend } from 'resend';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
      to: ['sysadmroot@gmail.com'],
      subject: 'Action Required: Update Google Business Profile URL',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Adults-Only Retreat Near Hilo, Hawaii</p>
          </div>

          <h2 style="color: #1b6b5a;">Update Google Business Profile Website URL</h2>
          <p style="color: #555; line-height: 1.6;">
            The website URL on Google Business Profile currently points to <strong>https://www.islandgoodes.com</strong> which redirects to <strong>https://islandgoodes.com</strong>. To avoid the redirect and improve SEO, update it to the canonical non-www URL.
          </p>

          <div style="background: #f7f5f2; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1b6b5a; margin-top: 0;">Steps to Update:</h3>
            <ol style="color: #555; line-height: 2;">
              <li>Go to <a href="https://business.google.com" style="color: #1b6b5a;">business.google.com</a></li>
              <li>Sign in with the account that manages the Island Goodes listing</li>
              <li>Select the <strong>Island Goodes</strong> business profile</li>
              <li>Click <strong>"Edit profile"</strong></li>
              <li>Click the <strong>"Contact"</strong> tab</li>
              <li>Find the <strong>"Website"</strong> field</li>
              <li>Change the URL from <code style="background: #e8e4df; padding: 2px 6px; border-radius: 3px;">https://www.islandgoodes.com</code> to <code style="background: #e8e4df; padding: 2px 6px; border-radius: 3px;">https://islandgoodes.com</code></li>
              <li>Click <strong>"Save"</strong></li>
            </ol>
          </div>

          <p style="color: #555; line-height: 1.6;">
            <strong>Why this matters:</strong> Google treats www and non-www as different URLs. Our canonical URL is <code style="background: #e8e4df; padding: 2px 6px; border-radius: 3px;">https://islandgoodes.com</code> (without www). Having the GBP link match the canonical URL avoids an unnecessary redirect and sends a consistent signal to Google's crawlers.
          </p>

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

    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'GBP instructions email sent' }) };
  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
