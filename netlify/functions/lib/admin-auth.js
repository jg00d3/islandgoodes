// Shared admin authentication helpers for Netlify Functions.
// Sessions are stored in Netlify Blobs. Short-lived login tickets, 2FA tokens and
// trusted-device cookies are stateless HMACs, so they do not depend on blob read-after-write.
import crypto from 'crypto';
import { getStore } from '@netlify/blobs';

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const SESSION_VERSION = 2; // Sessions from before this version are rejected
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
const TICKET_DURATION = 10 * 60 * 1000;

export function blobStore(name) {
  return getStore({ name, siteID: SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN });
}

function signingKey() {
  if (!process.env.NETLIFY_AUTH_TOKEN) throw new Error('NETLIFY_AUTH_TOKEN is not configured');
  return crypto.createHash('sha256').update(`island-goodes-admin-v1:${process.env.NETLIFY_AUTH_TOKEN}`).digest();
}

function sign(purpose, value) {
  return crypto.createHmac('sha256', signingKey()).update(`${purpose}|${value}`).digest('base64url');
}

function signatureMatches(purpose, value, signature) {
  const expected = Buffer.from(sign(purpose, value));
  const actual = Buffer.from(String(signature || ''));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function encodeSigned(purpose, payload) {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${value}.${sign(purpose, value)}`;
}

function decodeSigned(purpose, token) {
  const [value, signature, extra] = String(token || '').split('.');
  if (!value || extra !== undefined || !signatureMatches(purpose, value, signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function secureAttribute() {
  return process.env.URL?.startsWith('https://') ? '; Secure' : '';
}

function getCookie(event, name) {
  const header = event.headers?.cookie || event.headers?.Cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// Proof that the password step passed. Required before a 2FA code can be sent or checked.
export function issueLoginTicket(email) {
  return encodeSigned('login-ticket', { email: email.toLowerCase(), exp: Date.now() + TICKET_DURATION });
}

export function readLoginTicket(ticket) {
  return decodeSigned('login-ticket', ticket)?.email || null;
}

export function issueCodeToken(ticket, code) {
  const exp = Date.now() + TICKET_DURATION;
  return `${exp}.${sign('2fa-code', `${ticket}|${code}|${exp}`)}`;
}

export function codeTokenMatches(ticket, code, token) {
  const [expRaw, signature] = String(token || '').split('.');
  const exp = Number(expRaw);
  if (!exp || exp <= Date.now()) return false;
  return signatureMatches('2fa-code', `${ticket}|${code}|${exp}`, signature);
}

export function codeTokenId(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function trustedDeviceCookie(email) {
  const exp = Date.now() + SESSION_DURATION;
  const value = encodeSigned('trusted-device', { email: email.toLowerCase(), exp });
  return `admin_trusted=${value}; Path=/.netlify/functions/admin-login; HttpOnly; SameSite=Strict${secureAttribute()}; Expires=${new Date(exp).toUTCString()}`;
}

export function isTrustedDevice(event, email) {
  const payload = decodeSigned('trusted-device', getCookie(event, 'admin_trusted'));
  return payload?.email === email.toLowerCase();
}

// Creates the server-side session and returns its Set-Cookie value.
export async function createAdminSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION;
  await blobStore('admin-sessions').setJSON(token, {
    v: SESSION_VERSION,
    email: email.toLowerCase(),
    createdAt: Date.now(),
    expiresAt
  });
  return `admin_session=${token}; Path=/; HttpOnly; SameSite=Strict${secureAttribute()}; Expires=${new Date(expiresAt).toUTCString()}`;
}

export async function readSessionToken(token) {
  if (!token) return null;
  const store = blobStore('admin-sessions');
  const session = await store.get(token, { type: 'json' });
  if (!session || session.v !== SESSION_VERSION) return null;
  if (Date.now() > session.expiresAt) {
    await store.delete(token);
    return null;
  }
  return session;
}

// Returns the session for this request, or null. Any failure counts as not logged in.
export async function getAdminSession(event) {
  try {
    return await readSessionToken(getCookie(event, 'admin_session'));
  } catch (error) {
    console.error('Session check failed:', error.message);
    return null;
  }
}
