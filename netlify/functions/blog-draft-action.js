// Blog Draft Action — approve or reject AI-generated blog drafts
// On approve: updates status, triggers Netlify rebuild so the post goes live
// On reject: updates status with rejection reason

import { getStore } from '@netlify/blobs';
import { Resend } from 'resend';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const STORE_NAME = 'blog-drafts';
const NOTIFY_EMAILS = ['sysadmroot@gmail.com', 'goodegarvin@gmail.com'];

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { action, draftId, rejectionReason } = JSON.parse(event.body || '{}');

    if (!action || !draftId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing action or draftId' }) };
    }

    if (action !== 'approve' && action !== 'reject') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action must be approve or reject' }) };
    }

    const store = getStore({ name: STORE_NAME, siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });

    let drafts = [];
    try {
      const existing = await store.get('data', { type: 'json' });
      if (Array.isArray(existing)) drafts = existing;
    } catch (e) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No drafts found' }) };
    }

    const draftIndex = drafts.findIndex(d => d.id === draftId);
    if (draftIndex === -1) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Draft not found' }) };
    }

    const draft = drafts[draftIndex];

    if (action === 'approve') {
      draft.status = 'approved';
      draft.reviewedAt = new Date().toISOString();
    } else {
      draft.status = 'rejected';
      draft.reviewedAt = new Date().toISOString();
      draft.rejectionReason = rejectionReason || 'No reason provided';
    }

    drafts[draftIndex] = draft;
    await store.setJSON('data', drafts);

    // Send confirmation email
    await sendConfirmationEmail(draft, action);

    // Trigger rebuild on approve (so the post goes live)
    if (action === 'approve') {
      const hookUrl = process.env.NETLIFY_BUILD_HOOK;
      if (hookUrl) {
        // Brief delay to ensure Blobs data is consistent
        await new Promise(r => setTimeout(r, 3000));
        await fetch(hookUrl, { method: 'POST', body: '{}' });
        console.log('Build triggered for approved blog draft');
      } else {
        console.warn('NETLIFY_BUILD_HOOK not set — skipping build trigger');
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, action, title: draft.title })
    };
  } catch (err) {
    console.error('Blog draft action error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}

async function sendConfirmationEmail(draft, action) {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const isApproved = action === 'approve';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
        <p style="color: #666; margin: 5px 0;">Blog Draft ${isApproved ? 'Approved' : 'Rejected'}</p>
      </div>
      <div style="background: ${isApproved ? '#e8f5e9' : '#fce4ec'}; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="color: #2d3436; margin: 0 0 8px;">${draft.title}</h2>
        <p style="color: ${isApproved ? '#2e7d32' : '#c62828'}; font-weight: bold; margin: 0;">
          ${isApproved ? 'Approved — a site rebuild has been triggered. The post will be live shortly.' : 'Rejected'}
        </p>
        ${!isApproved && draft.rejectionReason ? `<p style="color: #636e72; margin: 8px 0 0;">Reason: ${draft.rejectionReason}</p>` : ''}
      </div>
      ${isApproved ? `<p style="color: #555; line-height: 1.7;">The blog post will appear on <a href="https://islandgoodes.com/blog" style="color: #1b6b5a;">islandgoodes.com/blog</a> after the rebuild completes (usually 1-2 minutes).</p>` : ''}
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">
        Island Goodes | 27-2365 Hawaii Belt Rd, Papaikou, HI 96781<br>
        <a href="https://www.islandgoodes.com" style="color: #1b6b5a;">www.islandgoodes.com</a>
      </p>
    </div>`;

  for (const email of NOTIFY_EMAILS) {
    try {
      await resend.emails.send({
        from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
        to: [email],
        subject: `Blog Draft ${isApproved ? 'Approved' : 'Rejected'}: ${draft.title}`,
        html
      });
    } catch (err) {
      console.error(`Failed to send confirmation to ${email}:`, err.message);
    }
  }
}
