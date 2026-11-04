import crypto from 'crypto';
import { Resend } from 'resend';
import { issueCodeToken, readLoginTicket } from './lib/admin-auth.js';


export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { loginTicket } = JSON.parse(event.body || '{}');
    const email = readLoginTicket(loginTicket);

    if (!email) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Login expired. Please sign in again.' })
      };
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 1000000).toString();

    // Signed token: proves which code was sent without storing or exposing it
    const token = issueCodeToken(loginTicket, code);

    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Send email
    const { data, error } = await resend.emails.send({
      from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
      to: [email],
      subject: 'Your Island Goodes Admin Login Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d5a27;">Island Goodes Admin Login</h2>
          <p>Your verification code is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2d5a27;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send email' })
      };
    }

    // Return token (code + timestamp encoded) - client will need this to verify
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        token,
        message: 'Verification code sent'
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
