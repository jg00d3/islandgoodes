#!/usr/bin/env node
/**
 * Build-time data fetch for Island Pulse.
 * Reads articles from Netlify Blobs and writes a static JSON file
 * that the Astro page imports at build time.
 *
 * Usage: node scripts/build-island-pulse.mjs
 * Output: src/data/island-pulse-data.json
 */

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const OUTPUT_FILE = join(ROOT, 'src', 'data', 'island-pulse-data.json');

const SITE_ID = '347c1eb9-e6b5-4736-b000-f6908c1f85fc';
const STORE_NAME = 'island-pulse';

async function fetchArticles() {
  const token = process.env.NETLIFY_AUTH_TOKEN;

  if (!token) {
    console.log('Island Pulse: No NETLIFY_AUTH_TOKEN — writing empty data (local dev).');
    return [];
  }

  try {
    // Use Netlify Blobs REST API directly for build-time access
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({
      name: STORE_NAME,
      siteID: SITE_ID,
      token
    });

    const articles = await store.get('articles', { type: 'json' });
    if (!Array.isArray(articles)) {
      console.log('Island Pulse: No articles found in Blobs.');
      return [];
    }

    console.log(`Island Pulse: Fetched ${articles.length} articles from Blobs.`);
    return articles;
  } catch (err) {
    console.error('Island Pulse: Failed to fetch from Blobs:', err.message);
    return [];
  }
}

async function main() {
  const articles = await fetchArticles();
  await writeFile(OUTPUT_FILE, JSON.stringify(articles, null, 2), 'utf-8');
  console.log(`Island Pulse: Wrote ${articles.length} articles to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Island Pulse build script failed:', err);
  // Write empty array so the build doesn't fail
  writeFile(OUTPUT_FILE, '[]', 'utf-8').then(() => {
    console.log('Island Pulse: Wrote empty fallback data.');
  });
});
