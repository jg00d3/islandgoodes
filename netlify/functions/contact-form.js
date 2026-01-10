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
    const { name, email, phone, dates, message } = JSON.parse(event.body);

    if (!name || !email || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name, email, and message are required' })
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

    // Send notification to Island Goodes
    const { data: notifyData, error: notifyError } = await resend.emails.send({
      from: 'Island Goodes Website (No Reply) <onboarding@resend.dev>',
      to: ['sysadmroot@gmail.com'], // Your notification email
      replyTo: email,
      subject: `New Contact Form: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1b6b5a; border-bottom: 2px solid #c5a572; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Name:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Phone:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="tel:${phone}">${phone}</a></td>
            </tr>
            ` : ''}
            ${dates ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Desired Dates:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${dates}</td>
            </tr>
            ` : ''}
          </table>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Message:</h3>
            <p style="margin: 0; color: #555; white-space: pre-wrap; line-height: 1.7;">${message}</p>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Submitted at ${new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })} Hawaii Time
          </p>
        </div>
      `
    });

    if (notifyError) {
      console.error('Resend notification error:', notifyError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send message' })
      };
    }

    // Send confirmation to the visitor
    const { data: confirmData, error: confirmError } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <onboarding@resend.dev>',
      to: [email],
      subject: 'Thank you for contacting Island Goodes!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Adults-Only Retreat Near Hilo, Hawaii</p>
          </div>

          <h2 style="color: #333;">Aloha ${name}!</h2>

          <p style="color: #555; line-height: 1.7;">
            Thank you for reaching out! We've received your message and will get back to you within 24 hours.
          </p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Your message:</h3>
            <p style="margin: 0; color: #555; white-space: pre-wrap; line-height: 1.7;">${message}</p>
          </div>

          <p style="color: #555; line-height: 1.7;">
            <strong>Need immediate assistance?</strong><br>
            Call us at <a href="tel:+18089642291" style="color: #1b6b5a;">808-964-2291</a>
          </p>

          <div style="background: linear-gradient(135deg, #1b6b5a 0%, #2d8a76 100%); padding: 25px; border-radius: 12px; text-align: center; margin: 30px 0;">
            <p style="color: #fff; margin: 0 0 15px 0; font-size: 18px;">Ready to book?</p>
            <a href="https://www.islandgoodes.com/book" style="display: inline-block; background: #c5a572; color: #1a1a1a; padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: bold;">Check Availability</a>
          </div>

          <p style="color: #555;">
            Mahalo,<br>
            <strong>Laura & Garvin</strong><br>
            Your Hosts at Island Goodes
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            Island Goodes | 27-2365 Hawaii Belt Rd, Papaikou, HI 96781<br>
            <a href="https://www.islandgoodes.com" style="color: #1b6b5a;">www.islandgoodes.com</a>
          </p>
        </div>
      `
    });

    // Log if confirmation email failed (but don't fail the whole request)
    if (confirmError) {
      console.error('Confirmation email error:', confirmError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Message sent! We\'ll get back to you within 24 hours.'
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
