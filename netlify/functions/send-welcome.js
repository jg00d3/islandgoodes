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
    const { email, fullName, username, password } = JSON.parse(event.body);

    if (!email || !fullName || !username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'All fields are required' })
      };
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send welcome email with credentials
    const { data, error } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
      to: [email],
      subject: 'Welcome to Island Goodes Admin!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Admin Dashboard Access</p>
          </div>

          <h2 style="color: #333;">Aloha ${fullName}!</h2>

          <p style="color: #555; line-height: 1.7;">
            You have been added as an administrator for the Island Goodes website.
            Below are your login credentials:
          </p>

          <div style="background: #f5f5f5; padding: 25px; border-radius: 12px; margin: 25px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: bold; width: 120px;">Username:</td>
                <td style="padding: 10px 0; color: #1b6b5a; font-weight: bold; font-size: 1.1rem;">${username}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: bold;">Password:</td>
                <td style="padding: 10px 0; color: #1b6b5a; font-weight: bold; font-size: 1.1rem;">${password}</td>
              </tr>
            </table>
          </div>

          <div style="background: linear-gradient(135deg, #1b6b5a 0%, #2d8a76 100%); padding: 25px; border-radius: 12px; text-align: center; margin: 30px 0;">
            <p style="color: #fff; margin: 0 0 15px 0; font-size: 18px;">Ready to get started?</p>
            <a href="https://www.islandgoodes.com/admin" style="display: inline-block; background: #c5a572; color: #1a1a1a; padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: bold;">Login to Admin Dashboard</a>
          </div>

          <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D97706;">
            <p style="margin: 0; color: #92400E; font-size: 0.9rem;">
              <strong>Security Note:</strong> When you log in, you'll receive a 6-digit verification code
              via email for two-factor authentication. Please change your password after your first login.
            </p>
          </div>

          <p style="color: #555; line-height: 1.7;">
            If you have any questions about using the admin dashboard, please contact Jeremiah.
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
        </div>
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send welcome email' })
      };
    }

    console.log(`Welcome email sent to ${email} for new admin ${fullName}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Welcome email sent successfully!'
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
