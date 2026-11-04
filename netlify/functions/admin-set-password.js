import bcrypt from 'bcryptjs';
import { getStore } from '@netlify/blobs';
import { getAdminSession } from './lib/admin-auth.js';

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
    const session = await getAdminSession(event);
    if (!session) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    const { email, newPassword, currentPassword } = JSON.parse(event.body);

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

    // Changing your own password needs the current one. Only the owner can reset someone else's.
    const target = admins[adminIndex];
    const requester = admins.find(a => a.email?.toLowerCase() === session.email);
    if (!requester) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Not allowed' }) };
    }
    if (target.email.toLowerCase() === session.email) {
      const currentValid = target.passwordHashBcrypt
        ? await bcrypt.compare(String(currentPassword || ''), target.passwordHashBcrypt)
        : Boolean(target.passwordHash) && Buffer.from(target.passwordHash, 'base64').toString('utf-8') === currentPassword;
      if (!currentValid) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Current password is incorrect' }) };
      }
    } else if (requester.role !== 'owner') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Not allowed' }) };
    }

    // Hash the new password with bcrypt
    const bcryptHash = await bcrypt.hash(newPassword, 12);

    // Update admin
    admins[adminIndex].passwordHashBcrypt = bcryptHash;
    delete admins[adminIndex].passwordHash; // Remove any legacy hash

    // Save
    await store.setJSON('data', admins);

    console.log(`Password updated for admin: ${email} by ${session.email}`);

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
