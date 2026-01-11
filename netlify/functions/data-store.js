import { getStore } from "@netlify/blobs";

// Netlify Blobs configuration
const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";

// All shared data stores
const STORES = {
  admins: 'admins',
  settings: 'settings',
  changeRequests: 'change-requests',
  activityLog: 'activity-log',
  roadmap: 'roadmap',
  aiTraining: 'ai-training',
  securitySettings: 'security-settings',
  pendingAdmins: 'pending-admins',
  deletedImages: 'deleted-images',
  editedImages: 'edited-images',
  newsletterSubscribers: 'newsletter-subscribers',
  contactInquiries: 'contact-inquiries',
  imageOrder: 'image-order'
};

// Default admin (only used on first setup)
const DEFAULT_ADMIN = {
  id: 1,
  username: 'jgoode',
  fullName: 'Jeremiah Goode',
  email: 'sysadmroot@gmail.com',
  twoFAEmail: 'sysadmroot@gmail.com',
  passwordHash: 'SXNsYW5kR29vZGVzMjAyNiE=',
  role: 'owner',
  created: '2026-01-01T00:00:00.000Z'
};

// Default site settings
const DEFAULT_SETTINGS = {
  liveChatEnabled: true,
  weatherWidgetEnabled: true,
  tripAdvisorEnabled: true,
  announcementEnabled: false,
  announcementText: '',
  aiChatEnabled: false,
  slideshowEnabled: false
};

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

export async function handler(event, context) {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const { store: storeName, action, key, data } = JSON.parse(event.body || '{}');

    if (!storeName || !STORES[storeName]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid store name' })
      };
    }

    let store;
    try {
      store = getStore({
        name: STORES[storeName],
        siteID: SITE_ID,
        token: process.env.NETLIFY_AUTH_TOKEN
      });
    } catch (storeError) {
      console.error('Failed to get store:', storeError);
      // Return defaults if blob store fails
      if (storeName === 'admins') {
        return { statusCode: 200, headers, body: JSON.stringify([DEFAULT_ADMIN]) };
      }
      if (storeName === 'settings') {
        return { statusCode: 200, headers, body: JSON.stringify(DEFAULT_SETTINGS) };
      }
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }

    switch (action) {
      case 'get': {
        let value = null;
        try {
          value = await store.get(key || 'data', { type: 'json' });
        } catch (getError) {
          console.error('Failed to get from blob store:', getError);
          // Return defaults on error
        }

        // Return defaults if no data exists OR if admins array is empty
        if (!value || (storeName === 'admins' && Array.isArray(value) && value.length === 0)) {
          if (storeName === 'admins') {
            return { statusCode: 200, headers, body: JSON.stringify([DEFAULT_ADMIN]) };
          }
          if (storeName === 'settings') {
            return { statusCode: 200, headers, body: JSON.stringify(DEFAULT_SETTINGS) };
          }
          if (storeName === 'changeRequests' || storeName === 'activityLog' ||
              storeName === 'roadmap' || storeName === 'pendingAdmins' ||
              storeName === 'deletedImages' || storeName === 'newsletterSubscribers' ||
              storeName === 'contactInquiries') {
            return { statusCode: 200, headers, body: JSON.stringify([]) };
          }
          if (storeName === 'editedImages' || storeName === 'aiTraining' ||
              storeName === 'securitySettings' || storeName === 'imageOrder') {
            return { statusCode: 200, headers, body: JSON.stringify({}) };
          }
        }

        return { statusCode: 200, headers, body: JSON.stringify(value) };
      }

      case 'set': {
        console.log(`SET: store=${storeName}, key=${key || 'data'}, data=`, JSON.stringify(data));
        try {
          await store.setJSON(key || 'data', data);
          console.log(`SET success for ${storeName}`);
          return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        } catch (setError) {
          console.error(`SET failed for ${storeName}:`, setError);
          return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save', details: setError.message }) };
        }
      }

      case 'delete': {
        await store.delete(key || 'data');
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action. Use: get, set, delete' })
        };
    }
  } catch (error) {
    console.error('Data store error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message,
        stack: error.stack
      })
    };
  }
}
