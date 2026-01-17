const { BetaAnalyticsDataClient } = require('@google-analytics/data');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Check for credentials
  if (!process.env.GA_CREDENTIALS) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'GA_CREDENTIALS not configured' })
    };
  }

  try {
    // Parse credentials from environment variable
    const credentials = JSON.parse(process.env.GA_CREDENTIALS);

    // Initialize the client
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    });

    const propertyId = process.env.GA_PROPERTY_ID || '470aborgia719';

    // Get the report type from query params
    const reportType = event.queryStringParameters?.report || 'overview';

    let response;

    if (reportType === 'realtime') {
      // Real-time active users
      [response] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [{ name: 'activeUsers' }],
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          activeUsers: response.rows?.[0]?.metricValues?.[0]?.value || '0'
        })
      };
    }

    if (reportType === 'realtime-locations') {
      // Real-time active users by city for map display
      [response] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        dimensions: [
          { name: 'city' },
          { name: 'country' }
        ],
        metrics: [{ name: 'activeUsers' }],
      });

      const locations = (response.rows || []).map(row => ({
        city: row.dimensionValues?.[0]?.value || 'Unknown',
        country: row.dimensionValues?.[1]?.value || 'Unknown',
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0')
      })).filter(loc => loc.city !== '(not set)' && loc.activeUsers > 0);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ locations })
      };
    }

    if (reportType === 'overview') {
      // Get multiple metrics for the overview
      const [todayResponse] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' }
        ],
      });

      const [weekResponse] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' }
        ],
      });

      const [monthResponse] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' }
        ],
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          today: {
            users: todayResponse.rows?.[0]?.metricValues?.[0]?.value || '0',
            sessions: todayResponse.rows?.[0]?.metricValues?.[1]?.value || '0',
            pageViews: todayResponse.rows?.[0]?.metricValues?.[2]?.value || '0',
            avgDuration: todayResponse.rows?.[0]?.metricValues?.[3]?.value || '0',
            bounceRate: todayResponse.rows?.[0]?.metricValues?.[4]?.value || '0'
          },
          week: {
            users: weekResponse.rows?.[0]?.metricValues?.[0]?.value || '0',
            sessions: weekResponse.rows?.[0]?.metricValues?.[1]?.value || '0',
            pageViews: weekResponse.rows?.[0]?.metricValues?.[2]?.value || '0'
          },
          month: {
            users: monthResponse.rows?.[0]?.metricValues?.[0]?.value || '0',
            sessions: monthResponse.rows?.[0]?.metricValues?.[1]?.value || '0',
            pageViews: monthResponse.rows?.[0]?.metricValues?.[2]?.value || '0'
          }
        })
      };
    }

    if (reportType === 'countries') {
      // Geographic data by country
      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'country' }, { name: 'countryId' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 20
      });

      const countries = response.rows?.map(row => ({
        country: row.dimensionValues[0].value,
        countryCode: row.dimensionValues[1].value,
        users: row.metricValues[0].value,
        sessions: row.metricValues[1].value
      })) || [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ countries })
      };
    }

    if (reportType === 'cities') {
      // Geographic data by city with region/state
      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'city' }, { name: 'region' }, { name: 'country' }, { name: 'countryId' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 30
      });

      const cities = response.rows?.map(row => ({
        city: row.dimensionValues[0].value,
        region: row.dimensionValues[1].value,
        country: row.dimensionValues[2].value,
        countryCode: row.dimensionValues[3].value,
        users: row.metricValues[0].value,
        sessions: row.metricValues[1].value
      })) || [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ cities })
      };
    }

    if (reportType === 'pages') {
      // Top pages
      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10
      });

      const pages = response.rows?.map(row => ({
        path: row.dimensionValues[0].value,
        title: row.dimensionValues[1].value,
        views: row.metricValues[0].value,
        users: row.metricValues[1].value
      })) || [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ pages })
      };
    }

    if (reportType === 'sources') {
      // Traffic sources
      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10
      });

      const sources = response.rows?.map(row => ({
        source: row.dimensionValues[0].value,
        medium: row.dimensionValues[1].value,
        sessions: row.metricValues[0].value,
        users: row.metricValues[1].value
      })) || [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ sources })
      };
    }

    if (reportType === 'devices') {
      // Device categories
      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
      });

      const devices = response.rows?.map(row => ({
        device: row.dimensionValues[0].value,
        users: row.metricValues[0].value,
        sessions: row.metricValues[1].value
      })) || [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ devices })
      };
    }

    if (reportType === 'trend') {
      // Daily trend for last 30 days
      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }]
      });

      const trend = response.rows?.map(row => ({
        date: row.dimensionValues[0].value,
        users: row.metricValues[0].value,
        sessions: row.metricValues[1].value
      })) || [];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ trend })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid report type' })
    };

  } catch (error) {
    console.error('Analytics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
