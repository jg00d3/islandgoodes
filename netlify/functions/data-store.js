import { getStore } from "@netlify/blobs";
import { getAdminSession } from "./lib/admin-auth.js";

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
  imageOrder: 'image-order',
  photoContributors: 'photo-contributors',
  blogContributors: 'blog-contributors',
  planningWorkflow: 'planning-workflow',
  chatUsage: 'chat-usage',
  blogDrafts: 'blog-drafts',
  reviewHistory: 'review-history'
};

// Default admin (only used on first setup - password set via admin-set-password function)
const DEFAULT_ADMIN = {
  id: 1,
  username: 'jgoode',
  fullName: 'Jeremiah Goode',
  email: 'sysadmroot@gmail.com',
  twoFAEmail: 'sysadmroot@gmail.com',
  role: 'owner',
  created: '2026-01-01T00:00:00.000Z'
};

// Sanitize admin data - remove sensitive fields before sending to client
function sanitizeAdmin(admin) {
  if (!admin) return admin;
  const { passwordHash, passwordHashBcrypt, ...safeAdmin } = admin;
  return safeAdmin;
}

function sanitizeAdmins(admins) {
  if (!Array.isArray(admins)) return admins;
  return admins.map(sanitizeAdmin);
}

// Default site settings (keys match admin.astro settingsConfig)
const DEFAULT_SETTINGS = {
  chatEnabled: false,        // Live Chat Widget - OFF by default (not set up yet)
  lightboxEnabled: true,     // Image Lightbox
  weatherEnabled: true,      // Weather Widget
  camerasEnabled: true,      // Live Cameras
  shareEnabled: true,        // Social Share Buttons
  languageEnabled: true,     // Language Selector
  slideshowEnabled: false,   // Lightbox Slideshow
  announcementEnabled: false,
  announcementText: '',
  aiChatEnabled: false
};

const headers = { 'Content-Type': 'application/json' };

// Public pages read these. Every other read, and every write, needs an admin session.
const PUBLIC_READ_STORES = new Set(['settings', 'deletedImages', 'editedImages', 'imageOrder']);

const PASSWORD_FIELDS = ['passwordHash', 'passwordHashBcrypt'];

// Clients never see or set password hashes, so keep the stored ones when saving admins.
async function preparedAdmins(store, incoming) {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw Object.assign(new Error('Admin list cannot be empty'), { statusCode: 400 });
  }
  const existing = await store.get('data', { type: 'json' }) || [];
  return incoming.map(admin => {
    const clean = { ...admin };
    PASSWORD_FIELDS.forEach(field => delete clean[field]);
    const stored = existing.find(a => a.id === admin.id || a.email?.toLowerCase() === admin.email?.toLowerCase());
    PASSWORD_FIELDS.forEach(field => {
      if (stored?.[field]) clean[field] = stored[field];
    });
    return clean;
  });
}

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

    if (!(action === 'get' && PUBLIC_READ_STORES.has(storeName)) && !(await getAdminSession(event))) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required' })
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
        // Sanitize - never send password hashes to client
        return { statusCode: 200, headers, body: JSON.stringify(sanitizeAdmins([DEFAULT_ADMIN])) };
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
            // Sanitize - never send password hashes to client
            return { statusCode: 200, headers, body: JSON.stringify(sanitizeAdmins([DEFAULT_ADMIN])) };
          }
          if (storeName === 'settings') {
            return { statusCode: 200, headers, body: JSON.stringify(DEFAULT_SETTINGS) };
          }
          if (storeName === 'changeRequests' || storeName === 'activityLog' ||
              storeName === 'roadmap' || storeName === 'pendingAdmins' ||
              storeName === 'deletedImages' || storeName === 'newsletterSubscribers' ||
              storeName === 'contactInquiries' || storeName === 'chatUsage' ||
              storeName === 'blogDrafts' || storeName === 'reviewHistory') {
            return { statusCode: 200, headers, body: JSON.stringify([]) };
          }
          if (storeName === 'editedImages' || storeName === 'aiTraining' ||
              storeName === 'securitySettings' || storeName === 'imageOrder') {
            return { statusCode: 200, headers, body: JSON.stringify({}) };
          }
        }

        // Sanitize admins data - never send password hashes to client
        if (storeName === 'admins') {
          return { statusCode: 200, headers, body: JSON.stringify(sanitizeAdmins(value)) };
        }

        return { statusCode: 200, headers, body: JSON.stringify(value) };
      }

      case 'set': {
        try {
          const value = storeName === 'admins' ? await preparedAdmins(store, data) : data;
          await store.setJSON(key || 'data', value);
          return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        } catch (setError) {
          console.error(`SET failed for ${storeName}:`, setError.message);
          return { statusCode: setError.statusCode || 500, headers, body: JSON.stringify({ error: setError.statusCode ? setError.message : 'Failed to save' }) };
        }
      }

      case 'delete': {
        if (storeName === 'admins') {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Admin list cannot be deleted' }) };
        }
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
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
