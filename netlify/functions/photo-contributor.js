import { Resend } from 'resend';
import { getStore } from '@netlify/blobs';

const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { name, email, social, location, photoLink, notes, honeypot, formLoadTime } = JSON.parse(event.body);

    // SPAM PROTECTION

    // 1. Honeypot check - if honeypot field is filled, it's a bot
    if (honeypot) {
      console.log('Spam blocked: honeypot triggered');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Thank you for your submission!' })
      };
    }

    // 2. Time-based check - form must take at least 3 seconds to fill
    if (formLoadTime) {
      const elapsed = Date.now() - parseInt(formLoadTime);
      if (elapsed < 3000) {
        console.log('Spam blocked: form submitted too fast (' + elapsed + 'ms)');
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, message: 'Thank you for your submission!' })
        };
      }
    }

    // 3. Gibberish detection - check for random character strings
    const gibberishPattern = /^[a-zA-Z]{15,}$/;
    if (gibberishPattern.test(name) || gibberishPattern.test(location)) {
      console.log('Spam blocked: gibberish detected');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Thank you for your submission!' })
      };
    }

    // 4. Check for spam patterns in notes
    const spamPatterns = [
      /\b(viagra|cialis|casino|lottery|winner|bitcoin|crypto|investment opportunity)\b/i,
      /\b(click here|act now|limited time|free money)\b/i
    ];
    if (notes && spamPatterns.some(pattern => pattern.test(notes))) {
      console.log('Spam blocked: spam keywords detected');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Thank you for your submission!' })
      };
    }

    if (!name || !email || !location || !photoLink) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Name, email, location, and photo link are required' })
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

    const submission = {
      id: Date.now(),
      name,
      email,
      social: social || null,
      location,
      photoLink,
      notes: notes || null,
      submittedAt: new Date().toISOString(),
      status: 'new' // new, reviewed, accepted, rejected
    };

    // Save to Netlify Blobs
    try {
      const store = getStore({
        name: 'photo-contributors',
        siteID: SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      const submissions = await store.get('data', { type: 'json' }) || [];
      submissions.push(submission);
      await store.setJSON('data', submissions);
    } catch (blobError) {
      console.error('Netlify Blobs error (non-fatal):', blobError);
    }

    // Get notification email from settings (or use default)
    let notificationEmail = 'sysadmroot@gmail.com';
    try {
      const settingsStore = getStore({
        name: 'settings',
        siteID: SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      const settings = await settingsStore.get('data', { type: 'json' });
      if (settings?.photoContributorEmail) {
        notificationEmail = settings.photoContributorEmail;
      }
    } catch (e) {
      console.log('Could not get settings, using default email');
    }

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send notification email
    const { data: notifyData, error: notifyError } = await resend.emails.send({
      from: 'Island Goodes Website (No Reply) <noreply@islandgoodes.com>',
      to: [notificationEmail],
      replyTo: email,
      subject: `New Photo Contribution: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1b6b5a; border-bottom: 2px solid #c5a572; padding-bottom: 10px;">
            New Photo Contribution
          </h2>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 140px;">Name:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            ${social ? `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Social/Website:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="${social}">${social}</a></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Location(s):</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${location}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Photo Link:</td>
              <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="${photoLink}">${photoLink}</a></td>
            </tr>
          </table>

          ${notes ? `
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Notes:</h3>
            <p style="margin: 0; color: #555; white-space: pre-wrap; line-height: 1.7;">${notes}</p>
          </div>
          ` : ''}

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Submitted at ${new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })} Hawaii Time
          </p>
        </div>
      `
    });

    if (notifyError) {
      console.error('Resend notification error:', notifyError);
    }

    // Send confirmation to contributor
    const { error: confirmError } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
      to: [email],
      subject: 'Thank you for your photo contribution!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
            <p style="color: #666; margin: 5px 0;">Adults-Only Retreat Near Hilo, Hawaii</p>
          </div>

          <h2 style="color: #333;">Mahalo, ${name}!</h2>

          <p style="color: #555; line-height: 1.7;">
            Thank you for sharing your photos with us! We've received your submission and will review it within 3-5 business days.
          </p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">What happens next:</h3>
            <ul style="color: #555; line-height: 2; margin: 0; padding-left: 20px;">
              <li>We'll review your photos for quality and fit</li>
              <li>If selected, we'll add them to our destination guides</li>
              <li>Your name and social media link will be credited</li>
              <li>We'll email you when your photos go live!</li>
            </ul>
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

    if (confirmError) {
      console.error('Confirmation email error:', confirmError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Thank you! We\'ll review your photos and get back to you within 3-5 days.'
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
