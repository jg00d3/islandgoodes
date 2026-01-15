import bcrypt from 'bcryptjs';
import { getStore } from '@netlify/blobs';

const SITE_ID = "347c1eb9-e6b5-4736-b000-f6908c1f85fc";

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, newPassword, currentAdminEmail } = JSON.parse(event.body);

    if (!email || !newPassword) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and new password are required' })
      };
    }

    // Password requirements
    if (newPassword.length < 8) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Password must be at least 8 characters' })
      };
    }

    // Get admins from Netlify Blobs
    const store = getStore({
      name: 'admins',
      siteID: SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    const admins = await store.get('data', { type: 'json' }) || [];

    // Find admin to update
    const adminIndex = admins.findIndex(a => a.email?.toLowerCase() === email.toLowerCase());

    if (adminIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Admin not found' })
      };
    }

    // Hash the new password with bcrypt
    const bcryptHash = await bcrypt.hash(newPassword, 12);

    // Update admin
    admins[adminIndex].passwordHashBcrypt = bcryptHash;
    delete admins[adminIndex].passwordHash; // Remove any legacy hash

    // Save
    await store.setJSON('data', admins);

    console.log(`Password updated for admin: ${email} by ${currentAdminEmail || 'system'}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Password updated successfully'
      })
    };

  } catch (err) {
    console.error('Set password error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}
