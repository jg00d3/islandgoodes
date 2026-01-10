import { getStore } from "@netlify/blobs";

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
  editedImages: 'edited-images'
};

// Default admin (only used on first setup)
const DEFAULT_ADMIN = {
  id: 1,
  username: 'jgoode',
  fullName: 'Jeremiah Goode',
  email: 'jeremiah.goode@gmail.com',
  twoFAEmail: 'jeremiah.goode@gmail.com',
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
  aiChatEnabled: false
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

    const store = getStore(STORES[storeName]);

    switch (action) {
      case 'get': {
        const value = await store.get(key || 'data', { type: 'json' });

        // Return defaults if no data exists
        if (!value) {
          if (storeName === 'admins') {
            return { statusCode: 200, headers, body: JSON.stringify([DEFAULT_ADMIN]) };
          }
          if (storeName === 'settings') {
            return { statusCode: 200, headers, body: JSON.stringify(DEFAULT_SETTINGS) };
          }
          if (storeName === 'changeRequests' || storeName === 'activityLog' ||
              storeName === 'roadmap' || storeName === 'pendingAdmins' ||
              storeName === 'deletedImages') {
            return { statusCode: 200, headers, body: JSON.stringify([]) };
          }
          if (storeName === 'editedImages' || storeName === 'aiTraining' ||
              storeName === 'securitySettings') {
            return { statusCode: 200, headers, body: JSON.stringify({}) };
          }
        }

        return { statusCode: 200, headers, body: JSON.stringify(value) };
      }

      case 'set': {
        await store.setJSON(key || 'data', data);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}
