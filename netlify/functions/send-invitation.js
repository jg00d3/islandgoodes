import { Resend } from 'resend';

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, activationUrl } = JSON.parse(event.body);

    if (!email || !activationUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and activation URL are required' })
      };
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send invitation email with activation link
    const { data, error } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
      to: [email],
      subject: "You're Invited: Island Goodes Admin Access",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Admin Dashboard Invitation</p>
          </div>

          <h2 style="color: #333;">Aloha!</h2>

          <p style="color: #555; line-height: 1.7;">
            You've been invited to become an administrator for the Island Goodes website.
            Click the button below to set up your account and create your password.
          </p>

          <div style="background: linear-gradient(135deg, #1b6b5a 0%, #2d8a76 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0;">
            <p style="color: #fff; margin: 0 0 20px 0; font-size: 18px;">Ready to get started?</p>
            <a href="${activationUrl}" style="display: inline-block; background: #c5a572; color: #1a1a1a; padding: 14px 35px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 1.1rem;">Set Up My Account</a>
          </div>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 12px; margin: 25px 0;">
            <p style="margin: 0 0 10px 0; color: #333; font-weight: bold;">During setup, you'll:</p>
            <ul style="color: #555; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Enter your name</li>
              <li>Set your login email for 2FA verification</li>
              <li>Create a secure password</li>
            </ul>
          </div>

          <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
            <p style="margin: 0; color: #92400E; font-size: 0.9rem;">
              <strong>Note:</strong> This invitation link expires in 7 days.
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>

          <p style="color: #555; line-height: 1.7;">
            If you have any questions, please contact your administrator.
          </p>

          <p style="color: #555;">
            Mahalo,<br>
            <strong>Island Goodes Team</strong>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Island Goodes | 27-2365 Hawaii Belt Rd, Papaikou, HI 96781<br>
            <a href="https://www.islandgoodes.com" style="color: #1b6b5a;">www.islandgoodes.com</a>
          </p>

          <p style="color: #bbb; font-size: 11px; text-align: center; margin-top: 20px;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${activationUrl}" style="color: #1b6b5a; word-break: break-all;">${activationUrl}</a>
          </p>
        </div>
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send invitation email' })
      };
    }

    console.log(`Invitation email sent to ${email}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Invitation email sent successfully!'
      })
    };

  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
