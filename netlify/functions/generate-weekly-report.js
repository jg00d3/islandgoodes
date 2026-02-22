// Weekly Visitor Stats Email Report — queries GA4 for the past 7 days,
// compares to the prior week, and sends a formatted HTML email digest
// with booking interest, top pages, traffic sources, devices, and daily trend.

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { Resend } from 'resend';

const NOTIFY_EMAILS = ['sysadmroot@gmail.com', 'goodegarvin@gmail.com'];

const ROOM_PATHS = {
  '/rooms/hilo-bay': 'Hilo Bay',
  '/rooms/mauna-kea': 'Mauna Kea',
  '/rooms/ginger': 'Ginger',
  '/rooms/orchid': 'Orchid'
};

function initGA4Client() {
  const credentials = JSON.parse(process.env.GA_CREDENTIALS);
  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
  });
}

function formatDuration(seconds) {
  const s = Math.round(parseFloat(seconds) || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function pctChange(current, previous) {
  const cur = parseFloat(current) || 0;
  const prev = parseFloat(previous) || 0;
  if (prev === 0 && cur === 0) return { text: '—', color: '#999' };
  if (prev === 0) return { text: '↑ new', color: '#27ae60' };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: '—', color: '#999' };
  if (pct > 0) return { text: `↑ ${pct}%`, color: '#27ae60' };
  return { text: `↓ ${Math.abs(pct)}%`, color: '#e74c3c' };
}

function getDateRange() {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1); // yesterday
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6); // 7 days ending yesterday

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return {
    label: `${fmt(startDate)} – ${fmtFull(endDate)}`,
    // GA4 date strings
    thisWeekStart: '7daysAgo',
    thisWeekEnd: 'yesterday',
    prevWeekStart: '14daysAgo',
    prevWeekEnd: '8daysAgo',
  };
}

async function fetchAllData(client, propertyId) {
  const property = `properties/${propertyId}`;
  const { thisWeekStart, thisWeekEnd, prevWeekStart, prevWeekEnd } = getDateRange();

  const [
    [thisWeekOverview],
    [prevWeekOverview],
    [topPages],
    [trafficSources],
    [devices],
    [dailyTrend]
  ] = await Promise.all([
    // 1. This week overview
    client.runReport({
      property,
      dateRanges: [{ startDate: thisWeekStart, endDate: thisWeekEnd }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' }
      ],
    }),
    // 2. Previous week overview (for comparison)
    client.runReport({
      property,
      dateRanges: [{ startDate: prevWeekStart, endDate: prevWeekEnd }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' }
      ],
    }),
    // 3. Top pages (this week)
    client.runReport({
      property,
      dateRanges: [{ startDate: thisWeekStart, endDate: thisWeekEnd }],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20,
    }),
    // 4. Traffic sources (this week)
    client.runReport({
      property,
      dateRanges: [{ startDate: thisWeekStart, endDate: thisWeekEnd }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 8,
    }),
    // 5. Devices (this week)
    client.runReport({
      property,
      dateRanges: [{ startDate: thisWeekStart, endDate: thisWeekEnd }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    }),
    // 6. Daily trend (this week)
    client.runReport({
      property,
      dateRanges: [{ startDate: thisWeekStart, endDate: thisWeekEnd }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    }),
  ]);

  return { thisWeekOverview, prevWeekOverview, topPages, trafficSources, devices, dailyTrend };
}

function parseOverview(response) {
  const row = response.rows?.[0];
  if (!row) return { users: 0, sessions: 0, pageViews: 0, avgDuration: 0 };
  return {
    users: parseInt(row.metricValues[0].value) || 0,
    sessions: parseInt(row.metricValues[1].value) || 0,
    pageViews: parseInt(row.metricValues[2].value) || 0,
    avgDuration: parseFloat(row.metricValues[3].value) || 0,
  };
}

function parsePages(response) {
  return (response.rows || []).map(row => ({
    path: row.dimensionValues[0].value,
    title: row.dimensionValues[1].value,
    views: parseInt(row.metricValues[0].value) || 0,
    users: parseInt(row.metricValues[1].value) || 0,
  }));
}

function parseSources(response) {
  return (response.rows || []).map(row => ({
    source: row.dimensionValues[0].value,
    medium: row.dimensionValues[1].value,
    sessions: parseInt(row.metricValues[0].value) || 0,
  }));
}

function parseDevices(response) {
  return (response.rows || []).map(row => ({
    device: row.dimensionValues[0].value,
    users: parseInt(row.metricValues[0].value) || 0,
  }));
}

function parseDailyTrend(response) {
  return (response.rows || []).map(row => {
    const dateStr = row.dimensionValues[0].value; // YYYYMMDD
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(4, 6);
    const d = dateStr.slice(6, 8);
    const date = new Date(`${y}-${m}-${d}T00:00:00`);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return {
      day: dayName,
      users: parseInt(row.metricValues[0].value) || 0,
    };
  });
}

function extractBookingInterest(pages) {
  const bookPage = pages.find(p => p.path === '/book' || p.path === '/book/');
  const rooms = [];
  for (const p of pages) {
    const normalized = p.path.replace(/\/$/, '');
    if (ROOM_PATHS[normalized]) {
      rooms.push({ name: ROOM_PATHS[normalized], views: p.views });
    }
  }
  // Sort rooms by views descending
  rooms.sort((a, b) => b.views - a.views);
  return { bookPage, rooms };
}

function buildEmailHtml(dateLabel, thisWeek, prevWeek, pages, sources, devices, dailyTrend, booking) {
  const usersChange = pctChange(thisWeek.users, prevWeek.users);
  const sessionsChange = pctChange(thisWeek.sessions, prevWeek.sessions);
  const viewsChange = pctChange(thisWeek.pageViews, prevWeek.pageViews);

  // Stats grid
  const statsGrid = `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="text-align: center; padding: 16px; background: #f7f5f2; border-radius: 8px 0 0 8px;">
          <div style="font-size: 28px; font-weight: bold; color: #1b6b5a;">${thisWeek.users.toLocaleString()}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Visitors</div>
          <div style="font-size: 13px; color: ${usersChange.color}; margin-top: 4px;">${usersChange.text}</div>
        </td>
        <td style="text-align: center; padding: 16px; background: #f7f5f2;">
          <div style="font-size: 28px; font-weight: bold; color: #1b6b5a;">${thisWeek.sessions.toLocaleString()}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Sessions</div>
          <div style="font-size: 13px; color: ${sessionsChange.color}; margin-top: 4px;">${sessionsChange.text}</div>
        </td>
        <td style="text-align: center; padding: 16px; background: #f7f5f2;">
          <div style="font-size: 28px; font-weight: bold; color: #1b6b5a;">${thisWeek.pageViews.toLocaleString()}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Page Views</div>
          <div style="font-size: 13px; color: ${viewsChange.color}; margin-top: 4px;">${viewsChange.text}</div>
        </td>
        <td style="text-align: center; padding: 16px; background: #f7f5f2; border-radius: 0 8px 8px 0;">
          <div style="font-size: 28px; font-weight: bold; color: #1b6b5a;">${formatDuration(thisWeek.avgDuration)}</div>
          <div style="font-size: 12px; color: #666; text-transform: uppercase;">Avg Duration</div>
        </td>
      </tr>
    </table>`;

  // Booking interest box
  let bookingHtml = '';
  if (booking.bookPage || booking.rooms.length > 0) {
    const bookLine = booking.bookPage
      ? `<div style="margin-bottom: 8px;"><strong>Booking page</strong> (/book): <strong>${booking.bookPage.views}</strong> views from <strong>${booking.bookPage.users}</strong> visitors</div>`
      : '';
    const roomsLine = booking.rooms.length > 0
      ? `<div><strong>Room pages:</strong> ${booking.rooms.map(r => `${r.name} (${r.views})`).join(' &middot; ')}</div>`
      : '';
    bookingHtml = `
      <div style="background: #e8f5e9; border-left: 4px solid #27ae60; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <div style="font-weight: bold; color: #1b6b5a; margin-bottom: 8px; font-size: 15px;">Booking Interest</div>
        ${bookLine}
        ${roomsLine}
      </div>`;
  }

  // Daily trend table
  let trendHtml = '';
  if (dailyTrend.length > 0) {
    const trendCells = dailyTrend.map(d =>
      `<td style="text-align: center; padding: 10px 6px; background: #f7f5f2;">
        <div style="font-size: 12px; color: #666;">${d.day}</div>
        <div style="font-size: 18px; font-weight: bold; color: #1b6b5a; margin-top: 4px;">${d.users}</div>
      </td>`
    ).join('');
    trendHtml = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1b6b5a; margin: 0 0 8px;">Daily Visitors</h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
          <tr>${trendCells}</tr>
        </table>
      </div>`;
  }

  // Top pages table (limit to 10 for email)
  const topPagesSlice = pages.slice(0, 10);
  let pagesHtml = '';
  if (topPagesSlice.length > 0) {
    const pageRows = topPagesSlice.map((p, i) => {
      const title = p.title && p.title !== '(not set)' ? p.title : p.path;
      const bgColor = i % 2 === 0 ? '#ffffff' : '#f9f9f9';
      return `<tr style="background: ${bgColor};">
        <td style="padding: 8px 12px; color: #555; font-size: 14px;">${i + 1}.</td>
        <td style="padding: 8px 12px; color: #333; font-size: 14px;">${p.path} <span style="color: #999;">${title !== p.path ? `(${title})` : ''}</span></td>
        <td style="padding: 8px 12px; color: #555; font-size: 14px; text-align: right;">${p.views.toLocaleString()} views</td>
      </tr>`;
    }).join('');
    pagesHtml = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1b6b5a; margin: 0 0 8px;">Top Pages</h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
          ${pageRows}
        </table>
      </div>`;
  }

  // Traffic sources table
  let sourcesHtml = '';
  if (sources.length > 0) {
    const totalSessions = sources.reduce((sum, s) => sum + s.sessions, 0);
    const sourceRows = sources.map((s, i) => {
      const pct = totalSessions > 0 ? Math.round((s.sessions / totalSessions) * 100) : 0;
      const bgColor = i % 2 === 0 ? '#ffffff' : '#f9f9f9';
      return `<tr style="background: ${bgColor};">
        <td style="padding: 8px 12px; color: #333; font-size: 14px;">${s.source} / ${s.medium}</td>
        <td style="padding: 8px 12px; color: #555; font-size: 14px; text-align: right;">${s.sessions} sessions (${pct}%)</td>
      </tr>`;
    }).join('');
    sourcesHtml = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1b6b5a; margin: 0 0 8px;">Traffic Sources</h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
          ${sourceRows}
        </table>
      </div>`;
  }

  // Devices inline row
  let devicesHtml = '';
  if (devices.length > 0) {
    const totalDeviceUsers = devices.reduce((sum, d) => sum + d.users, 0);
    const deviceParts = devices.map(d => {
      const pct = totalDeviceUsers > 0 ? Math.round((d.users / totalDeviceUsers) * 100) : 0;
      const label = d.device.charAt(0).toUpperCase() + d.device.slice(1);
      return `<td style="text-align: center; padding: 12px; background: #f7f5f2;">
        <div style="font-size: 20px; font-weight: bold; color: #1b6b5a;">${pct}%</div>
        <div style="font-size: 12px; color: #666; text-transform: uppercase;">${label}</div>
      </td>`;
    }).join('');
    devicesHtml = `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #1b6b5a; margin: 0 0 8px;">Devices</h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
          <tr>${deviceParts}</tr>
        </table>
      </div>`;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
        <p style="color: #666; margin: 5px 0; font-size: 16px;">Weekly Visitor Report</p>
        <p style="color: #999; font-size: 13px;">${dateLabel}</p>
      </div>

      ${statsGrid}
      ${bookingHtml}
      ${trendHtml}
      ${pagesHtml}
      ${sourcesHtml}
      ${devicesHtml}

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://islandgoodes.com/admin" style="background: #1b6b5a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Full Dashboard</a>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #999; font-size: 12px; text-align: center;">
        Island Goodes | 27-2365 Hawaii Belt Rd, Papaikou, HI 96781<br>
        <a href="https://www.islandgoodes.com" style="color: #1b6b5a;">www.islandgoodes.com</a>
      </p>
    </div>`;
}

async function sendReportEmail(html, dateLabel) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  for (const email of NOTIFY_EMAILS) {
    try {
      await resend.emails.send({
        from: 'Island Goodes (No Reply) <noreply@islandgoodes.com>',
        to: [email],
        subject: `Weekly Visitor Report — ${dateLabel}`,
        html,
      });
    } catch (err) {
      console.error(`Failed to send report to ${email}:`, err.message);
    }
  }
}

async function sendNotConfiguredEmail() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — cannot send fallback email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1b6b5a; margin: 0;">Island Goodes</h1>
        <p style="color: #666; margin: 5px 0;">Weekly Visitor Report</p>
      </div>
      <div style="text-align: center; padding: 40px; background: #fef3cd; border-radius: 12px;">
        <p style="color: #856404; font-size: 16px; margin: 0;">Analytics Not Configured</p>
        <p style="color: #856404; font-size: 14px; margin: 8px 0 0;">GA_CREDENTIALS or GA_PROPERTY_ID environment variable is missing. Please configure these in the Netlify dashboard to enable weekly visitor reports.</p>
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
        subject: 'Weekly Visitor Report — Analytics Not Configured',
        html,
      });
    } catch (err) {
      console.error(`Failed to send not-configured email to ${email}:`, err.message);
    }
  }
}

export const handler = async () => {
  console.log('Weekly Report: Starting weekly visitor stats generation...');

  // Check for GA4 credentials
  if (!process.env.GA_CREDENTIALS || !process.env.GA_PROPERTY_ID) {
    console.warn('Weekly Report: GA_CREDENTIALS or GA_PROPERTY_ID not configured');
    await sendNotConfiguredEmail();
    return {
      statusCode: 200,
      body: JSON.stringify({ success: false, message: 'Analytics not configured — sent notification email' }),
    };
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('Weekly Report: RESEND_API_KEY not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
    };
  }

  try {
    const client = initGA4Client();
    const propertyId = process.env.GA_PROPERTY_ID;
    const dateRange = getDateRange();

    console.log('Weekly Report: Fetching GA4 data...');
    const data = await fetchAllData(client, propertyId);

    // Parse all responses
    const thisWeek = parseOverview(data.thisWeekOverview);
    const prevWeek = parseOverview(data.prevWeekOverview);
    const pages = parsePages(data.topPages);
    const sources = parseSources(data.trafficSources);
    const devices = parseDevices(data.devices);
    const dailyTrend = parseDailyTrend(data.dailyTrend);
    const booking = extractBookingInterest(pages);

    console.log(`Weekly Report: ${thisWeek.users} visitors, ${thisWeek.sessions} sessions, ${thisWeek.pageViews} page views`);

    // Build and send email
    const html = buildEmailHtml(dateRange.label, thisWeek, prevWeek, pages, sources, devices, dailyTrend, booking);
    await sendReportEmail(html, dateRange.label);

    console.log('Weekly Report: Email sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        visitors: thisWeek.users,
        sessions: thisWeek.sessions,
        pageViews: thisWeek.pageViews,
      }),
    };
  } catch (err) {
    console.error('Weekly Report: Generation failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
