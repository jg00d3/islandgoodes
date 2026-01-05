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
│   ├── rooms/              # Individual room detail pages (hilo-bay, mauna-kea, ginger, orchid)
│   ├── blog/
│   │   ├── index.astro     # Blog listing (posts array defined here)
│   │   └── [topic].astro   # Individual blog posts as separate files
│   ├── contact.astro       # Contact form
│   ├── policies.astro      # Booking policies
│   ├── reviews.astro       # Guest reviews
│   ├── property.astro      # Property & amenities info
│   ├── gallery.astro       # Photo slideshow
│   └── pets.astro          # Property pets info
public/
└── images/
    ├── rooms/[room-name]/  # Room photos (room.jpg, lanai.jpg, etc.)
    ├── blog/               # Blog post featured images
    └── property/           # Amenity photos (pool.jpg, hot-tub.jpg, hosts.jpg, etc.)
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

Blog posts are individual .astro files in `src/pages/blog/`. The blog index (`index.astro`) maintains an `allPosts` array that references these files:
```javascript
const allPosts = [
  { slug: "hawaii-volcanoes-national-park", title: "...", excerpt: "...", date: "2026-01-01", category: "...", image: "..." },
  // ...
];
```
When adding/removing blog posts, update both the individual .astro file AND the `allPosts` array in `index.astro`.

## External Services

- **Booking:** ReservationKey - https://v2.reservationkey.com/3655/reserve/c
- **3D Tour:** Matterport - https://my.matterport.com/show/?m=zrMG54r6RUx
- **Hosting:** Netlify (auto-deploy from master)
- **Domain:** islandgoodes.com (DNS pending migration from GoDaddy)

## Room Photo Guidelines

Source photos in `CLAUDES PICTURES/` folder (not committed). When adding room images:
- Avoid folders named "NO USE PICTURES" or "NOT TO USE"
- Main room image should show the bed
- Standard photos: room.jpg, lanai.jpg, bathroom.jpg, coffee.jpg

## Navigation Structure

- **Top nav:** Home, Rooms, Contact Us, Book Now, Policies, Blog
- **Footer Quick Links:** Same as top nav
- **Footer More Info:** Slide Show, 3D Room Tour, Reviews, Property, Our Pets

Navigation is managed in `BaseLayout.astro` (lines ~107-165).
