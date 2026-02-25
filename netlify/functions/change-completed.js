import { Resend } from 'resend';
import { getStore } from '@netlify/blobs';

const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { requestId, completedNotes, completedBy, affectedUrls } = JSON.parse(event.body);

    if (!requestId || !completedNotes) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request ID and completion notes are required' }) };
    }

    // affectedUrls should be an array of { url: string, label: string }

    // Get the change requests store
    const requestStore = getStore({
      name: 'change-requests',
      siteID: SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    // Get current requests
    const requests = await requestStore.get('data', { type: 'json' }) || [];

    // Find and update the request
    const requestIndex = requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Change request not found' }) };
    }

    const request = requests[requestIndex];
    request.status = 'completed';
    request.completedAt = new Date().toISOString();
    request.completedNotes = completedNotes;
    request.completedBy = completedBy || 'Claude Code';
    request.affectedUrls = affectedUrls || [];

    // Save updated requests
    await requestStore.setJSON('data', requests);

    // Log the activity
    try {
      const activityStore = getStore({
        name: 'activity-log',
        siteID: SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      const activityLog = await activityStore.get('data', { type: 'json' }) || [];
      activityLog.push({
        type: 'change-request',
        action: 'Completed change request',
        details: `${request.type}: ${request.description.substring(0, 50)}...`,
        admin: completedBy || 'System',
        timestamp: new Date().toISOString()
      });
      // Keep last 500 entries
      while (activityLog.length > 500) activityLog.shift();
      await activityStore.setJSON('data', activityLog);
    } catch (logError) {
      console.error('Failed to log activity:', logError);
    }

    // Look up requester's email from admins store
    let requesterEmail = null;
    let ownerEmail = null;
    try {
      const adminStore = getStore({
        name: 'admins',
        siteID: SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
      const admins = await adminStore.get('data', { type: 'json' }) || [];

      // Aliases for common nicknames
      const aliases = {
        'Dad': 'Garvin Goode',
        'dad': 'Garvin Goode',
        'Mom': 'Garvin Goode', // adjust if different
      };

      const requestedByName = aliases[request.requestedBy] || request.requestedBy;

      // Find admin by name (requestedBy field)
      const requester = admins.find(a =>
        a.fullName === requestedByName ||
        a.fullName === request.requestedBy ||
        a.username === request.requestedBy
      );
      if (requester) {
        requesterEmail = requester.email;
      }

      // Also get owner email to CC
      const owner = admins.find(a => a.role === 'owner');
      if (owner && owner.email !== requesterEmail) {
        ownerEmail = owner.email;
      }
    } catch (adminError) {
      console.error('Failed to look up requester:', adminError);
    }

    // Send completion email — fallback to both admin emails if requester not found
    const fallbackEmails = ['goodegarvin@gmail.com', 'sysadmroot@gmail.com'];
    {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

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
              ✅ Change Request Completed
            </h2>

            <p style="color: #555; font-size: 16px;">
              Good news! Your change request has been completed.
            </p>

            <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #166534;">Original Request:</h3>
              <p style="margin: 0; color: #555;"><strong>Type:</strong> ${typeLabels[request.type] || request.type}</p>
              <p style="margin: 5px 0; color: #555;"><strong>Page:</strong> ${request.page || 'Not specified'}</p>
              <p style="margin: 5px 0 0 0; color: #555; white-space: pre-wrap;">${request.description}</p>
            </div>

            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">What Was Done:</h3>
              <p style="margin: 0; color: #555; white-space: pre-wrap; line-height: 1.7;">${completedNotes}</p>
            </div>

            ${affectedUrls && affectedUrls.length > 0 ? `
            <div style="background: #eff6ff; border: 1px solid #93c5fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 15px 0; color: #1e40af;">🔗 Verify the Changes:</h3>
              <p style="margin: 0 0 15px 0; color: #555; font-size: 14px;">Click the links below to review the updates:</p>
              ${affectedUrls.map(item => `
                <a href="${item.url}" style="display: block; background: #fff; border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 8px; color: #1b6b5a; text-decoration: none; font-weight: 500;">
                  ${item.label} →
                  <span style="display: block; font-size: 12px; color: #666; font-weight: normal; margin-top: 4px;">${item.url}</span>
                </a>
              `).join('')}
            </div>
            ` : ''}

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Completed By:</strong></td>
                <td style="padding: 8px 0; color: #555;">${completedBy || 'System'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>Completed At:</strong></td>
                <td style="padding: 8px 0; color: #555;">${new Date().toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })} Hawaii Time</td>
              </tr>
            </table>

            <p style="color: #666; font-size: 14px;">
              <a href="https://www.islandgoodes.com/admin/change-requests" style="color: #1b6b5a;">View all change requests →</a>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; text-align: center;">
              Island Goodes Admin System
            </p>
          </div>
        `;

        let toAddresses;
        if (requesterEmail) {
          toAddresses = [requesterEmail];
          if (ownerEmail) toAddresses.push(ownerEmail);
        } else {
          toAddresses = [...fallbackEmails];
        }
        // Deduplicate
        toAddresses = [...new Set(toAddresses)];

        await resend.emails.send({
          from: 'Island Goodes Admin <noreply@islandgoodes.com>',
          to: toAddresses,
          subject: `✅ Change Request Completed: ${typeLabels[request.type] || request.type} - ${request.page || 'General'}`,
          html: emailHtml
        });

        console.log(`Completion email sent to ${requesterEmail}`);
      } catch (emailError) {
        console.error('Failed to send completion email:', emailError);
        // Don't fail the whole request if email fails
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Change request marked as completed',
        emailSent: true
      })
    };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
