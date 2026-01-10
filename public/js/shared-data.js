/**
 * Shared Data Store API
 * All admin data is stored in Netlify Blobs, NOT localStorage
 * This ensures all admins see the same data
 */

const DATA_API = '/.netlify/functions/data-store';

// Cache to reduce API calls (short TTL)
const cache = new Map();
const CACHE_TTL = 5000; // 5 seconds

async function apiCall(store, action, key = 'data', data = null) {
  const cacheKey = `${store}:${key}`;

  // Check cache for GET requests
  if (action === 'get') {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const response = await fetch(DATA_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, action, key, data })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    // Cache GET results
    if (action === 'get') {
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
    } else {
      // Invalidate cache on write
      cache.delete(cacheKey);
    }

    return result;
  } catch (error) {
    console.error('Shared data API error:', error);
    throw error;
  }
}

// Clear cache (useful after writes)
function clearCache(store = null) {
  if (store) {
    for (const key of cache.keys()) {
      if (key.startsWith(store + ':')) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

// ============== ADMINS ==============
window.SharedData = {
  // Admin accounts
  async getAdmins() {
    return await apiCall('admins', 'get');
  },

  async saveAdmins(admins) {
    clearCache('admins');
    return await apiCall('admins', 'set', 'data', admins);
  },

  // ============== SETTINGS ==============
  async getSettings() {
    return await apiCall('settings', 'get');
  },

  async saveSettings(settings) {
    clearCache('settings');
    return await apiCall('settings', 'set', 'data', settings);
  },

  // ============== CHANGE REQUESTS ==============
  async getChangeRequests() {
    return await apiCall('changeRequests', 'get');
  },

  async saveChangeRequests(requests) {
    clearCache('changeRequests');
    return await apiCall('changeRequests', 'set', 'data', requests);
  },

  // ============== ACTIVITY LOG ==============
  async getActivityLog() {
    return await apiCall('activityLog', 'get');
  },

  async saveActivityLog(log) {
    clearCache('activityLog');
    return await apiCall('activityLog', 'set', 'data', log);
  },

  async clearActivityLog() {
    clearCache('activityLog');
    return await apiCall('activityLog', 'set', 'data', []);
  },

  async logActivity(type, action, details = null) {
    try {
      const log = await this.getActivityLog();
      const session = JSON.parse(sessionStorage.getItem('islandgoodes_admin_session') || '{}');
      const adminName = session?.fullName || session?.username || 'Unknown';

      log.push({
        type,
        action,
        details,
        admin: adminName,
        timestamp: new Date().toISOString()
      });

      // Keep last 500 entries
      while (log.length > 500) log.shift();

      await this.saveActivityLog(log);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  },

  // ============== ROADMAP ==============
  async getRoadmap() {
    return await apiCall('roadmap', 'get');
  },

  async saveRoadmap(items) {
    clearCache('roadmap');
    return await apiCall('roadmap', 'set', 'data', items);
  },

  // ============== AI TRAINING ==============
  async getAITraining() {
    return await apiCall('aiTraining', 'get');
  },

  async saveAITraining(data) {
    clearCache('aiTraining');
    return await apiCall('aiTraining', 'set', 'data', data);
  },

  // ============== SECURITY SETTINGS ==============
  async getSecuritySettings() {
    return await apiCall('securitySettings', 'get');
  },

  async saveSecuritySettings(settings) {
    clearCache('securitySettings');
    return await apiCall('securitySettings', 'set', 'data', settings);
  },

  // ============== PENDING ADMINS ==============
  async getPendingAdmins() {
    return await apiCall('pendingAdmins', 'get');
  },

  async savePendingAdmins(pending) {
    clearCache('pendingAdmins');
    return await apiCall('pendingAdmins', 'set', 'data', pending);
  },

  // ============== DELETED IMAGES ==============
  async getDeletedImages() {
    return await apiCall('deletedImages', 'get');
  },

  async saveDeletedImages(images) {
    clearCache('deletedImages');
    return await apiCall('deletedImages', 'set', 'data', images);
  },

  // ============== EDITED IMAGES ==============
  async getEditedImages() {
    return await apiCall('editedImages', 'get');
  },

  async saveEditedImages(images) {
    clearCache('editedImages');
    return await apiCall('editedImages', 'set', 'data', images);
  },

  // ============== NEWSLETTER SUBSCRIBERS ==============
  async getNewsletterSubscribers() {
    return await apiCall('newsletterSubscribers', 'get', 'list');
  },

  async saveNewsletterSubscribers(subscribers) {
    clearCache('newsletterSubscribers');
    return await apiCall('newsletterSubscribers', 'set', 'list', subscribers);
  },

  // Clear all caches
  clearCache
};

console.log('SharedData API loaded - using Netlify Blobs for shared storage');
