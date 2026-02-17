#!/usr/bin/env node
/**
 * Build-time knowledge base extraction for the AI chat widget.
 * Reads all public .astro pages and generates a JS module with extracted content.
 *
 * Usage: node scripts/extract-knowledge-base.mjs
 * Output: netlify/functions/knowledge-base.js
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename, dirname, relative } from 'node:path';

const PAGES_DIR = join(dirname(new URL(import.meta.url).pathname), '..', 'src', 'pages');
const OUTPUT_FILE = join(dirname(new URL(import.meta.url).pathname), '..', 'netlify', 'functions', 'knowledge-base.js');

// Pages to skip (listings, utility pages, admin)
const SKIP_FILES = new Set([
  '404.astro',
  'thank-you.astro',
  'contribute.astro',
]);

const SKIP_DIRS = new Set(['admin']);

// Index/listing pages to skip (content lives in sub-pages)
const SKIP_INDEX_DIRS = new Set(['blog', 'guide', 'rooms']);

async function discoverFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await discoverFiles(fullPath, files);
    } else if (entry.name.endsWith('.astro') && !entry.name.startsWith('_old-')) {
      const rel = relative(PAGES_DIR, fullPath);
      const dirName = dirname(rel);
      const base = basename(entry.name);

      // Skip utility pages
      if (SKIP_FILES.has(base)) continue;

      // Skip index pages for dirs that have sub-pages
      if (base === 'index.astro' && SKIP_INDEX_DIRS.has(dirName)) continue;

      files.push(fullPath);
    }
  }
  return files;
}

function splitFrontmatterAndBody(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: match[1], body: match[2] };
}

function extractStringVar(frontmatter, name) {
  // Match: const name = "value"; or const name = 'value'; or template literals
  const re = new RegExp(`const\\s+${name}\\s*=\\s*["'\`]([\\s\\S]*?)["'\`]\\s*;`);
  const m = frontmatter.match(re);
  return m ? m[1] : null;
}

function extractStringArray(frontmatter, name) {
  // Match: const name = [ "item1", "item2", ... ];
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const m = frontmatter.match(re);
  if (!m) return [];
  // Pull out all string literals
  const strings = [];
  const strRe = /["'`]((?:[^"'`\\]|\\.)*)["'`]/g;
  let sm;
  while ((sm = strRe.exec(m[1])) !== null) {
    strings.push(sm[1]);
  }
  return strings;
}

function extractObjectArray(frontmatter, name) {
  // Match: const name = [ { ... }, { ... } ];
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`);
  const m = frontmatter.match(re);
  if (!m) return [];

  const objects = [];
  // Split on }, { boundaries at roughly object level
  const objChunks = m[1].split(/\}\s*,\s*\{/);
  for (const chunk of objChunks) {
    const obj = {};
    // Extract key: "value" pairs (string values)
    const kvRe = /(\w+)\s*:\s*["'`]((?:[^"'`\\]|\\.)*)["'`]/g;
    let kv;
    while ((kv = kvRe.exec(chunk)) !== null) {
      obj[kv[1]] = kv[2];
    }
    // Extract key: number pairs (e.g., price: 225)
    const numRe = /(\w+)\s*:\s*(\d+(?:\.\d+)?)\s*[,\n}]/g;
    let nm;
    while ((nm = numRe.exec(chunk)) !== null) {
      obj[nm[1]] = Number(nm[2]);
    }
    // Extract key: [...] string arrays (e.g., highlights: ["a", "b"])
    const arrRe = /(\w+)\s*:\s*\[((?:[^\]])*)\]/g;
    let am;
    while ((am = arrRe.exec(chunk)) !== null) {
      const items = [];
      const itemRe = /["'`]((?:[^"'`\\]|\\.)*)["'`]/g;
      let im;
      while ((im = itemRe.exec(am[2])) !== null) {
        items.push(im[1]);
      }
      if (items.length > 0) {
        obj[am[1]] = items;
      }
    }
    if (Object.keys(obj).length > 0) {
      objects.push(obj);
    }
  }
  return objects;
}

function stripHtmlBody(body) {
  // Remove everything from first <style or <script tag onward
  let text = body.replace(/<(style|script)[\s\S]*$/i, '');
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Remove Astro expressions like {variable} or {expression}
  text = text.replace(/\{[^}]*\}/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function categorizeFile(filePath) {
  const rel = relative(PAGES_DIR, filePath);
  if (rel.startsWith('rooms/')) return 'ROOMS';
  if (rel.startsWith('guide/')) return 'GUIDE';
  if (rel.startsWith('blog/')) return 'BLOG';
  const base = basename(rel, '.astro');
  if (base === 'policies' || base === 'full-policy') return 'POLICIES';
  if (base === 'property') return 'PROPERTY';
  if (base === 'pets') return 'PETS';
  if (base === 'contact') return 'CONTACT';
  if (base === 'index') return 'HOMEPAGE';
  if (base === 'reviews') return 'REVIEWS';
  // book, tour, gallery — minimal useful text
  return 'OTHER';
}

function formatObjectArray(objects, fields) {
  return objects.map(obj => {
    const parts = [];
    for (const f of fields) {
      if (obj[f] !== undefined) {
        if (Array.isArray(obj[f])) {
          parts.push(`${f}: ${obj[f].join(', ')}`);
        } else {
          parts.push(`${f}: ${obj[f]}`);
        }
      }
    }
    return '- ' + parts.join(' | ');
  }).join('\n');
}

function processRoom(frontmatter, body, filePath) {
  const name = basename(filePath, '.astro');
  const title = extractStringVar(frontmatter, 'title') || name;
  const desc = extractStringVar(frontmatter, 'description') || '';
  const amenities = extractStringArray(frontmatter, 'amenities');
  const bathroomAmenities = extractStringArray(frontmatter, 'bathroomAmenities');
  const bodyText = stripHtmlBody(body);

  let result = `### ${title}\n${desc}`;
  if (amenities.length > 0) {
    result += `\nAmenities: ${amenities.join(', ')}`;
  }
  if (bathroomAmenities.length > 0) {
    result += `\nBathroom: ${bathroomAmenities.join(', ')}`;
  }
  // Add body text (truncated) for any extra details
  if (bodyText.length > 200) {
    result += `\nDetails: ${bodyText.slice(0, 800)}`;
  }
  return result;
}

function processGuide(frontmatter, body, filePath) {
  const subpage = basename(filePath, '.astro');
  const title = extractStringVar(frontmatter, 'title') || subpage;
  const desc = extractStringVar(frontmatter, 'description') || '';

  let result = `### ${title}\n${desc}`;

  // Extract known array types from guide pages
  const arrayConfigs = [
    { name: 'attractions', fields: ['name', 'category', 'distance', 'description', 'highlights', 'tip'] },
    { name: 'activities', fields: ['name', 'type', 'duration', 'description', 'highlights', 'tip'] },
    { name: 'beaches', fields: ['name', 'type', 'description', 'highlights', 'tip'] },
    { name: 'restaurants', fields: ['name', 'type', 'cuisine', 'description', 'mustTry', 'priceRange'] },
    { name: 'pokeSpots', fields: ['name', 'description', 'tip', 'priceRange'] },
    { name: 'localFoods', fields: ['name', 'description', 'where'] },
    { name: 'foodTrucks', fields: ['name', 'location', 'specialty'] },
    { name: 'groceryStores', fields: ['name', 'address', 'phone', 'hours', 'description', 'distance'] },
    { name: 'dayTrips', fields: ['name', 'duration', 'distance', 'description', 'highlights', 'tip'] },
    { name: 'annualEvents', fields: ['name', 'month', 'description', 'tip'] },
    { name: 'weeklyEvents', fields: ['name', 'schedule', 'description', 'tip'] },
    { name: 'culturalExperiences', fields: ['name', 'description', 'tip'] },
    { name: 'turtleGuidelines', fields: ['name', 'description'] },
  ];

  for (const { name, fields } of arrayConfigs) {
    const objects = extractObjectArray(frontmatter, name);
    if (objects.length > 0) {
      const label = name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      result += `\n\n${label}:\n${formatObjectArray(objects, fields)}`;
    }
  }

  // Also include body text for any content not in arrays
  const bodyText = stripHtmlBody(body);
  if (bodyText.length > 100) {
    result += `\n\nAdditional info: ${bodyText.slice(0, 600)}`;
  }

  return result;
}

function processBlog(frontmatter, body) {
  const title = extractStringVar(frontmatter, 'title') || '';
  const desc = extractStringVar(frontmatter, 'description') || '';
  const bodyText = stripHtmlBody(body);

  // Blog posts get condensed: title + description + first ~500 chars
  let result = `### ${title}\n${desc}`;
  if (bodyText.length > 50) {
    result += `\nKey points: ${bodyText.slice(0, 500)}`;
  }
  return result;
}

function processGeneric(frontmatter, body, category) {
  const title = extractStringVar(frontmatter, 'title') || category;
  const desc = extractStringVar(frontmatter, 'description') || '';
  const bodyText = stripHtmlBody(body);

  let result = `### ${title}\n${desc}`;
  if (bodyText.length > 50) {
    result += `\n${bodyText.slice(0, 1500)}`;
  }
  return result;
}

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const { frontmatter, body } = splitFrontmatterAndBody(content);
  const category = categorizeFile(filePath);

  switch (category) {
    case 'ROOMS':
      return { category, content: processRoom(frontmatter, body, filePath) };
    case 'GUIDE':
      return { category, content: processGuide(frontmatter, body, filePath) };
    case 'BLOG':
      return { category, content: processBlog(frontmatter, body) };
    case 'POLICIES':
    case 'PROPERTY':
    case 'PETS':
    case 'CONTACT':
    case 'HOMEPAGE':
    case 'REVIEWS':
      return { category, content: processGeneric(frontmatter, body, category) };
    default:
      // book, tour, gallery — skip minimal-content pages
      return null;
  }
}

async function main() {
  console.log('Extracting knowledge base from .astro pages...');

  const files = await discoverFiles(PAGES_DIR);
  console.log(`Found ${files.length} pages to process.`);

  const results = [];
  for (const file of files) {
    const result = await processFile(file);
    if (result) results.push(result);
  }

  // Group by category
  const grouped = {};
  for (const { category, content } of results) {
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(content);
  }

  // Build the knowledge base string in a logical order
  const sectionOrder = ['HOMEPAGE', 'ROOMS', 'PROPERTY', 'POLICIES', 'PETS', 'CONTACT', 'REVIEWS', 'GUIDE', 'BLOG'];
  const sectionLabels = {
    HOMEPAGE: 'PROPERTY OVERVIEW',
    ROOMS: 'ROOMS & ACCOMMODATIONS',
    PROPERTY: 'PROPERTY & AMENITIES',
    POLICIES: 'POLICIES',
    PETS: 'PETS & ANIMALS',
    CONTACT: 'CONTACT INFORMATION',
    REVIEWS: 'REVIEWS',
    GUIDE: 'LOCAL AREA GUIDE',
    BLOG: 'TRAVEL BLOG HIGHLIGHTS',
  };

  let knowledgeBase = '';
  for (const section of sectionOrder) {
    if (!grouped[section]) continue;
    knowledgeBase += `\n## ${sectionLabels[section] || section}\n\n`;
    knowledgeBase += grouped[section].join('\n\n');
    knowledgeBase += '\n';
  }

  knowledgeBase = knowledgeBase.trim();

  // Escape for safe embedding in a JS template literal
  const escaped = knowledgeBase
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  const output = `// Auto-generated by scripts/extract-knowledge-base.mjs — DO NOT EDIT
// Regenerated on every build from src/pages/*.astro content

export const knowledgeBase = \`${escaped}\`;
`;

  await writeFile(OUTPUT_FILE, output, 'utf-8');

  const charCount = knowledgeBase.length;
  const estimatedTokens = Math.round(charCount / 4);
  console.log(`Knowledge base generated: ${charCount} chars (~${estimatedTokens} tokens)`);
  console.log(`Written to: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Knowledge base extraction failed:', err);
  process.exit(1);
});
