// Weekly Chat Insights Digest — summarizes the past week's AI chat activity
// Reads chat-usage logs from Blobs, aggregates stats, calls AI for summary,
// sends formatted HTML email digest to property managers.

import { getStore } from '@netlify/blobs';
import { Resend } from 'resend';
import { callAI } from './ai-provider.js';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const NOTIFY_EMAILS = ['sysadmroot@gmail.com', 'goodegarvin@gmail.com'];

async function getChatLogs() {
  const store = getStore({
    name: 'chat-usage',
    siteID: SITE_ID,
    token: process.env.NETLIFY_AUTH_TOKEN
  });

  const data = await store.get('data', { type: 'json' });
  return Array.isArray(data) ? data : [];
}

function filterLastWeek(logs) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return logs.filter(entry => new Date(entry.timestamp) >= oneWeekAgo);
}

function aggregateStats(logs) {
  const uniqueIPs = new Set(logs.map(l => l.ip));
  const totalTokens = logs.reduce((sum, l) => sum + (l.inputTokens || 0) + (l.outputTokens || 0), 0);
  const providers = {};
  logs.forEach(l => {
    const p = l.provider || 'unknown';
    providers[p] = (providers[p] || 0) + 1;
  });

  return {
    totalConversations: logs.length,
    uniqueVisitors: uniqueIPs.size,
    totalTokens,
    providers
  };
}

function buildDigestPrompt(logs) {
  // Extract Q&A pairs for AI analysis
  const qaPairs = logs
    .filter(l => l.question && l.answer)
    .map(l => `Q: ${l.question}\nA: ${l.answer.slice(0, 200)}`)
    .slice(0, 50); // Cap at 50 for prompt size

  if (qaPairs.length === 0) return null;

  return `You are analyzing chat logs from the AI concierge at Island Goodes, an adults-only oceanview vacation rental in Papaikou, Hawaii (near Hilo).

Below are the questions guests asked and brief answers from the past week. Analyze them and provide insights.

CHAT LOGS:
${qaPairs.join('\n---\n')}

Provide your analysis in this exact JSON format:
{
  "topTopics": ["topic1", "topic2", "topic3"],
  "commonQuestions": ["question1", "question2", "question3", "question4", "question5"],
  "sentiment": "A 1-2 sentence summary of overall visitor sentiment",
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}

For topTopics: 3-5 high-level themes visitors ask about most (e.g., "Room amenities", "Local dining", "Beach recommendations").
For commonQuestions: The 5 most frequently asked types of questions.
For sentiment: Overall mood — are visitors excited, confused, planning trips, etc.
For suggestions: 2-3 actionable suggestions for the website based on what visitors seem to need (e.g., "Add more info about checkout times to the rooms page").

Respond with ONLY valid JSON.`;
}

async function sendDigestEmail(stats, insights) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping digest email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Build provider breakdown
  const providerRows = Object.entries(stats.providers)
    .map(([name, count]) => `<tr><td style="padding: 4px 12px; color: #555;">${name}</td><td style="padding: 4px 12px; color: #555; text-align: right;">${count}</td></tr>`)
    .join('');

  // Build insights sections
  let insightsHtml = '';
  if (insights) {
    const topicsHtml = (insights.topTopics || []).map(t => `<li style="padding: 4px 0; color: #555;">${t}</li>`).join('');
    const questionsHtml = (insights.commonQuestions || []).map(q => `<li style="padding: 4px 0; color: #555;">${q}</li>`).join('');
    const suggestionsHtml = (insights.suggestions || []).map(s => `<li style="padding: 4px 0; color: #555;">${s}</li>`).join('');

    insightsHtml = `
      <h3 style="color: #1b6b5a; margin: 24px 0 8px;">Top Topics</h3>
      <ul style="margin: 0; padding-left: 20px;">${topicsHtml}</ul>

      <h3 style="color: #1b6b5a; margin: 24px 0 8px;">Most Common Questions</h3>
      <ol style="margin: 0; padding-left: 20px;">${questionsHtml}</ol>

      <h3 style="color: #1b6b5a; margin: 24px 0 8px;">Visitor Sentiment</h3>
      <p style="color: #555; line-height: 1.7;">${insights.sentiment || 'No sentiment data available.'}</p>

      <h3 style="color: #1b6b5a; margin: 24px 0 8px;">Website Improvement Suggestions</h3>
      <ul style="margin: 0; padding-left: 20px;">${suggestionsHtml}</ul>
    `;
  }

  const weekEnd = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
        <p style="color: #666; margin: 5px 0;">Weekly Chat Insights Digest</p>
        <p style="color: #999; font-size: 13px;">${weekStart} - ${weekEnd}</p>
      </div>

      <!-- Stats Grid -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="text-align: center; padding: 16px; background: #f7f5f2; border-radius: 8px 0 0 8px;">
            <div style="font-size: 28px; font-weight: bold; color: #1b6b5a;">${stats.totalConversations}</div>
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Conversations</div>
          </td>
          <td style="text-align: center; padding: 16px; background: #f7f5f2;">
            <div style="font-size: 28px; font-weight: bold; color: #1b6b5a;">${stats.uniqueVisitors}</div>
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Unique Visitors</div>
          </td>
          <td style="text-align: center; padding: 16px; background: #f7f5f2; border-radius: 0 8px 8px 0;">
            <div style="font-size: 28px; font-weight: bold; color: #1b6b5a;">${stats.totalTokens.toLocaleString()}</div>
            <div style="font-size: 12px; color: #666; text-transform: uppercase;">Total Tokens</div>
          </td>
        </tr>
      </table>

      ${Object.keys(stats.providers).length > 0 ? `
        <h3 style="color: #1b6b5a; margin: 24px 0 8px;">Provider Usage</h3>
        <table style="width: 100%; border-collapse: collapse; background: #f7f5f2; border-radius: 8px; overflow: hidden;">
          <thead><tr><th style="padding: 8px 12px; text-align: left; color: #333; font-size: 13px;">Provider</th><th style="padding: 8px 12px; text-align: right; color: #333; font-size: 13px;">Requests</th></tr></thead>
          <tbody>${providerRows}</tbody>
        </table>
      ` : ''}

      ${insightsHtml}

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://islandgoodes.com/admin/ai-chat" style="background: #1b6b5a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Full Chat Logs</a>
      </div>

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
        subject: `Chat Digest: ${stats.totalConversations} conversations this week`,
        html
      });
    } catch (err) {
      console.error(`Failed to send digest to ${email}:`, err.message);
    }
  }
}

async function sendNoActivityEmail() {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
        <p style="color: #666; margin: 5px 0;">Weekly Chat Insights Digest</p>
      </div>
      <div style="text-align: center; padding: 40px; background: #f7f5f2; border-radius: 12px;">
        <p style="color: #555; font-size: 16px; margin: 0;">No chat activity this week.</p>
        <p style="color: #999; font-size: 14px; margin: 8px 0 0;">The AI concierge had no visitor interactions in the past 7 days.</p>
      </div>
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
        subject: 'Chat Digest: No activity this week',
        html
      });
    } catch (err) {
      console.error(`Failed to send no-activity email to ${email}:`, err.message);
    }
  }
}

export const handler = async () => {
  console.log('Chat Digest: Starting weekly digest generation...');

  try {
    const allLogs = await getChatLogs();
    const weekLogs = filterLastWeek(allLogs);

    console.log(`Chat Digest: ${weekLogs.length} conversations in the past week (${allLogs.length} total)`);

    if (weekLogs.length === 0) {
      await sendNoActivityEmail();
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No activity — sent no-activity email' })
      };
    }

    const stats = aggregateStats(weekLogs);
    let insights = null;

    // Only call AI if we have actual Q&A data to analyze
    const prompt = buildDigestPrompt(weekLogs);
    if (prompt) {
      try {
        const result = await callAI(null, [{ role: 'user', content: prompt }], { maxTokens: 1024 });
        let text = result.text || '';
        text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
        insights = JSON.parse(text);
        console.log(`Chat Digest: AI analysis complete (provider: ${result.provider})`);
      } catch (err) {
        console.error('Chat Digest: AI analysis failed, sending stats-only digest:', err.message);
      }
    }

    await sendDigestEmail(stats, insights);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, conversations: stats.totalConversations })
    };
  } catch (err) {
    console.error('Chat Digest generation failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
