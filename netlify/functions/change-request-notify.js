import { Resend } from 'resend';
import { getStore } from '@netlify/blobs';

const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";
const ADMIN_EMAIL = 'sysadmroot@gmail.com';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { request, requesterEmail } = JSON.parse(event.body);

    if (!request) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request data is required' }) };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Build email content
    const priorityColors = {
      urgent: '#DC2626',
      high: '#F59E0B',
      medium: '#3B82F6',
      low: '#6B7280'
    };

    const typeLabels = {
      image: 'Image Change',
      text: 'Text/Content Change',
      bug: 'Bug/Error Fix',
      feature: 'New Feature',
      other: 'Other'
    };

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1b6b5a; border-bottom: 2px solid #c5a572; padding-bottom: 10px;">
          New Change Request Submitted
        </h2>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Type:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${typeLabels[request.type] || request.type}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Priority:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
              <span style="background: ${priorityColors[request.priority] || '#6B7280'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">
                ${request.priority}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Page/Location:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${request.page || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Requested By:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${request.requestedBy}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Submitted:</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(request.created).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })} Hawaii Time</td>
          </tr>
        </table>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #333;">Description:</h3>
          <p style="margin: 0; color: #555; white-space: pre-wrap; line-height: 1.7;">${request.description}</p>
        </div>

        <p style="color: #666; font-size: 14px;">
          <a href="https://www.islandgoodes.com/admin/change-requests" style="color: #1b6b5a;">View all change requests →</a>
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

        <p style="color: #999; font-size: 12px; text-align: center;">
          Island Goodes Admin System
        </p>
      </div>
    `;

    // Send to both admin and requester (if they have an email)
    const recipients = [ADMIN_EMAIL];
    if (requesterEmail && requesterEmail !== ADMIN_EMAIL) {
      recipients.push(requesterEmail);
    }

    const { error } = await resend.emails.send({
      from: 'Island Goodes Admin <noreply@islandgoodes.com>',
      to: recipients,
      subject: `[${request.priority.toUpperCase()}] Change Request: ${typeLabels[request.type] || request.type} - ${request.page || 'General'}`,
      html: emailHtml
    });

    if (error) {
      console.error('Resend error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send notification' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Notification sent' })
    };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
