import { Resend } from 'resend';

const SUBSCRIBERS_KEY = 'newsletter_subscribers';

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send welcome/confirmation email
    const { data, error } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <onboarding@resend.dev>',
      to: [email],
      subject: 'Welcome to Island Goodes Updates!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Adults-Only Retreat Near Hilo, Hawaii</p>
          </div>

          <h2 style="color: #333;">Aloha!</h2>

          <p style="color: #555; line-height: 1.7;">
            Thank you for subscribing to Island Goodes updates! You'll be the first to know about:
          </p>

          <ul style="color: #555; line-height: 2;">
            <li>Special seasonal discounts (up to 55% off!)</li>
            <li>Big Island travel tips and hidden gems</li>
            <li>Local events and festivals</li>
            <li>New room features and property updates</li>
          </ul>

          <div style="background: linear-gradient(135deg, #1b6b5a 0%, #2d8a76 100%); padding: 25px; border-radius: 12px; text-align: center; margin: 30px 0;">
            <p style="color: #fff; margin: 0 0 15px 0; font-size: 18px;">Ready to book your Hawaiian getaway?</p>
            <a href="https://www.islandgoodes.com/book" style="display: inline-block; background: #c5a572; color: #1a1a1a; padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: bold;">Check Availability</a>
          </div>

          <p style="color: #555; line-height: 1.7;">
            We're located just minutes from downtown Hilo, with easy access to Hawaii Volcanoes National Park,
            stunning waterfalls, and beautiful beaches.
          </p>

          <p style="color: #555;">
            Mahalo,<br>
            <strong>Laura & Garvin</strong><br>
            Your Hosts at Island Goodes
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Island Goodes | 27-2365 Hawaii Belt Rd, Papaikou, HI 96781<br>
            <a href="tel:+18089642291" style="color: #1b6b5a;">808-964-2291</a> |
            <a href="https://www.islandgoodes.com" style="color: #1b6b5a;">www.islandgoodes.com</a>
          </p>
        </div>
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send confirmation email' })
      };
    }

    // Log subscription (you could also save to a database/spreadsheet)
    console.log(`New subscriber: ${email} at ${new Date().toISOString()}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Successfully subscribed! Check your email for confirmation.'
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
