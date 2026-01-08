# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Island Goodes is a static marketing website for an adults-only (18+) oceanview accommodation near Hilo, Hawaii. Built with Astro 5.x and deployed to Netlify.

**Key Business Rules:**
- Adults only property - no children under 18 permitted
- No breakfast service (removed "B&B" references)
- Four rooms: Hilo Bay, Mauna Kea, Ginger, Orchid
- Phone: 808-964-2291
- Address: 27-2365 Hawaii Belt Rd, Papaikou, HI 96781

## Commands

```bash
npm run dev      # Start dev server at localhost:4321
npm run build    # Build static site to dist/
npm run preview  # Preview production build locally
```

Deploy: Push to master branch triggers automatic Netlify deployment.

## Architecture

### Layouts

- **PreviewLayout.astro** - Main layout used by all active pages. Contains header, footer, navigation, SEO meta tags, schema.org data, global CSS, social share buttons, lightbox, and live chat integration.
- **BaseLayout.astro** - Legacy layout, kept for reference but not actively used.

### File Structure
```
src/
├── layouts/
│   └── PreviewLayout.astro  # Main layout with all global components
├── pages/
│   ├── index.astro          # Homepage
│   ├── book.astro           # Booking page (ReservationKey iframe)
│   ├── rooms/               # Room pages (index, ginger, hilo-bay, mauna-kea, orchid)
│   ├── guide/               # Area guide section
│   │   ├── index.astro      # Guide landing page
│   │   ├── food.astro       # Restaurant recommendations
│   │   ├── day-trips.astro  # Day trip destinations
│   │   ├── activities.astro # Activities & tours
│   │   ├── attractions.astro# Local attractions
│   │   ├── beaches.astro    # Beach guide
│   │   └── events.astro     # Local events
│   ├── blog/                # Blog posts
│   │   ├── index.astro      # Blog listing (allPosts array defined here)
│   │   └── [topic].astro    # Individual blog posts
│   ├── admin.astro          # Admin settings panel (localStorage-based toggles)
│   ├── contact.astro        # Contact form (Formspree)
│   ├── reviews.astro        # TripAdvisor reviews display
│   ├── gallery.astro        # Photo slideshow with lightbox
│   └── ...                  # Other pages (policies, property, pets, etc.)
public/
└── images/
    ├── rooms/[room-name]/   # Room photos
    ├── blog/                # Blog featured images
    └── property/            # Amenity photos
```

### Disabled Pages

Files prefixed with `_old-` are disabled/archived pages. Astro ignores these during build. To re-enable, remove the `_old-` prefix.

### CSS Variables (defined in PreviewLayout.astro)

```css
--color-primary: #1B6B5A;      /* Ocean Teal */
--color-secondary: #C5A572;    /* Champagne Gold */
--color-text: #2D3436;
--color-bg-alt: #F7F5F2;
--gradient-primary: linear-gradient(135deg, #1B6B5A 0%, #0F4A3E 100%);
```

### Blog System

Blog posts are individual .astro files in `src/pages/blog/`. The blog index maintains an `allPosts` array:
```javascript
const allPosts = [
  { slug: "hawaii-volcanoes-national-park", title: "...", excerpt: "...", date: "2026-01-01", category: "...", image: "..." },
];
```
When adding/removing blog posts, update both the individual .astro file AND the `allPosts` array in `index.astro`.

### Admin Panel

`/admin` page provides toggles for:
- Live chat (Tawk.to)
- Weather widget
- TripAdvisor badge
- Announcement bar

Settings stored in localStorage under `islandgoodes_settings`.

## External Services

- **Booking:** ReservationKey - https://v2.reservationkey.com/3655/reserve/c
- **3D Tour:** Matterport - https://my.matterport.com/show/?m=zrMG54r6RUx
- **Contact Form:** Formspree - https://formspree.io/f/xojvbgld
- **Live Chat:** Tawk.to (configured in PreviewLayout.astro)
- **Reviews:** TripAdvisor (hardcoded, rating: 4.9)
- **Hosting:** Netlify (auto-deploy from master)
- **Domain:** islandgoodes.com

## Social Links

- Instagram: @islandgoodes
- Facebook: /islandgoodes

Social share buttons in footer: Facebook, Twitter, Pinterest, WhatsApp, Instagram, Email, Copy Link.
