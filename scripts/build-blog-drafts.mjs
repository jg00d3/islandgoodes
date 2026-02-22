#!/usr/bin/env node
/**
 * Build-time data fetch for AI Blog Drafts.
 * Reads approved drafts from Netlify Blobs and writes a static JSON file
 * that the Astro pages import at build time.
 *
 * Usage: node scripts/build-blog-drafts.mjs
 * Output: src/data/blog-drafts-data.json
 */

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const OUTPUT_FILE = join(ROOT, 'src', 'data', 'blog-drafts-data.json');

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const STORE_NAME = 'blog-drafts';

async function fetchApprovedDrafts() {
  const token = process.env.NETLIFY_AUTH_TOKEN;

  if (!token) {
    console.log('Blog Drafts: No NETLIFY_AUTH_TOKEN — writing empty data (local dev).');
    return [];
  }

  try {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({
      name: STORE_NAME,
      siteID: SITE_ID,
      token
    });

    const drafts = await store.get('data', { type: 'json' });
    if (!Array.isArray(drafts)) {
      console.log('Blog Drafts: No drafts found in Blobs.');
      return [];
    }

    // Only include approved drafts
    const approved = drafts.filter(d => d.status === 'approved');
    console.log(`Blog Drafts: Fetched ${approved.length} approved drafts from Blobs (${drafts.length} total).`);
    return approved;
  } catch (err) {
    console.error('Blog Drafts: Failed to fetch from Blobs:', err.message);
    return [];
  }
}

async function main() {
  const drafts = await fetchApprovedDrafts();
  await writeFile(OUTPUT_FILE, JSON.stringify(drafts, null, 2), 'utf-8');
  console.log(`Blog Drafts: Wrote ${drafts.length} approved drafts to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Blog Drafts build script failed:', err);
  writeFile(OUTPUT_FILE, '[]', 'utf-8').then(() => {
    console.log('Blog Drafts: Wrote empty fallback data.');
  });
});
