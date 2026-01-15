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
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and password are required' })
      };
    }

    // Get admins from Netlify Blobs (server-side only)
    const store = getStore({
      name: 'admins',
      siteID: SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });

    const admins = await store.get('data', { type: 'json' }) || [];

    // Find admin by email
    const admin = admins.find(a => a.email?.toLowerCase() === email.toLowerCase());

    if (!admin) {
      // Use same error message to prevent email enumeration
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Check if admin has bcrypt password hash
    let passwordValid = false;

    if (admin.passwordHashBcrypt) {
      // New secure bcrypt hash
      passwordValid = await bcrypt.compare(password, admin.passwordHashBcrypt);
    } else if (admin.passwordHash) {
      // Legacy base64 "hash" - check and migrate
      const legacyPassword = atob(admin.passwordHash);
      if (legacyPassword === password) {
        passwordValid = true;

        // Migrate to bcrypt
        const bcryptHash = await bcrypt.hash(password, 12);
        admin.passwordHashBcrypt = bcryptHash;
        delete admin.passwordHash; // Remove insecure hash

        // Save updated admin
        const updatedAdmins = admins.map(a =>
          a.email?.toLowerCase() === email.toLowerCase() ? admin : a
        );
        await store.setJSON('data', updatedAdmins);
        console.log(`Migrated admin ${email} to bcrypt`);
      }
    }

    if (!passwordValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Return admin info WITHOUT password hashes
    const safeAdmin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      createdAt: admin.createdAt
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        admin: safeAdmin
      })
    };

  } catch (err) {
    console.error('Admin login error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

// Helper for base64 decode (Node.js)
function atob(str) {
  return Buffer.from(str, 'base64').toString('utf-8');
}
