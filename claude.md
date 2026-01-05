# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Island Goodes is a static marketing website for an adults-only (18+) oceanview accommodation near Hilo, Hawaii. Built with Astro 5.x and deployed to Netlify.

**Key Business Rules:**
- Adults only property - no children under 18 permitted
- No breakfast service (removed "B&B" references)
- Four rooms: Hilo Bay, Mauna Kea, Ginger, Orchid

## Commands

```bash
npm run dev      # Start dev server at localhost:4321
npm run build    # Build static site to dist/
npm run preview  # Preview production build locally
```

Deploy: Push to master branch triggers automatic Netlify deployment.

## Architecture

### File Structure
```
src/
├── layouts/
│   └── BaseLayout.astro    # Main layout with header, footer, SEO, schema.org
├── pages/
│   ├── index.astro         # Homepage
│   ├── rooms.astro         # Room listing page
│   ├── rooms/              # Individual room detail pages
│   │   ├── hilo-bay.astro
│   │   ├── mauna-kea.astro
│   │   ├── ginger.astro
│   │   └── orchid.astro
│   ├── blog/
│   │   ├── index.astro     # Blog listing (posts defined in frontmatter array)
│   │   └── [post].astro    # Individual blog post pages
│   └── [other pages].astro
public/
└── images/
    ├── rooms/[room-name]/  # Room photos (room.jpg, bed.jpg, lanai.jpg, etc.)
    ├── blog/               # Blog post featured images
    └── property/           # Amenity photos (pool.jpg, hot-tub.jpg, etc.)
```

### BaseLayout

All pages use `BaseLayout.astro` which provides:
- SEO meta tags (title, description, Open Graph, Twitter Cards)
- Schema.org structured data (LodgingBusiness)
- Global CSS variables and styles
- Fixed header with navigation
- Footer with contact info and links
- Mobile menu toggle script

Props: `title` (required), `description` (required), `image` (optional), `canonicalURL` (optional)

### Styling Pattern

Each page uses scoped `<style>` blocks. Global CSS variables defined in BaseLayout:
- `--color-primary: #1a5f4a` (green)
- `--color-secondary: #d4a853` (gold)
- `--font-heading: 'Playfair Display'`
- `--font-body: 'Open Sans'`

### Blog System

Blog posts are individual .astro files. The blog index maintains a posts array with metadata:
```javascript
const posts = [
  { slug, title, excerpt, date, category, image },
  // ...
];
```

## External Services

- **Booking:** ReservationKey - https://v2.reservationkey.com/3655/reserve/c
- **3D Tour:** Matterport - https://my.matterport.com/show/?m=zrMG54r6RUx
- **Hosting:** Netlify (auto-deploy from master)
- **Domain:** islandgoodes.com (DNS pending migration from GoDaddy)

## Room Photo Guidelines

Source photos in `CLAUDES PICTURES/` folder (not committed). When adding room images:
- Avoid folders named "NO USE PICTURES" or "NOT TO USE"
- Main room image should show the bed
- Standard photos: room.jpg, bed.jpg, lanai.jpg, bathroom.jpg, coffee.jpg
