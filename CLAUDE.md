# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Island Goodes is an Astro 5.x static website for an adults-only (18+) oceanview B&B near Hilo, Hawaii, deployed on Netlify with a full admin dashboard using Netlify Functions and Edge Functions.

**Key Business Rules:**
- Adults only - no children under 18
- No breakfast service (not a traditional B&B)
- Four rooms: Hilo Bay ($225), Mauna Kea ($195), Ginger ($195), Orchid ($225)
- Tax rate: 18.72%
- Phone: 808-964-2291
- Address: 27-2365 Hawaii Belt Rd, Papaikou, HI 96781
- Permit: #SPP 13-000151

## Commands

```bash
npm run dev      # Start dev server at localhost:4321
npm run build    # Build static site to dist/
npm run preview  # Preview production build locally
```

**Deploy:** Push to master branch triggers automatic Netlify deployment.

## Architecture

### Layouts

| Layout | Usage |
|--------|-------|
| `PreviewLayout.astro` | Main layout for all public pages. Contains header, footer, nav, SEO, schema.org, dark mode, live chat, weather widget, social share buttons. |
| `AdminLayout.astro` | Admin pages. Minimal header with logo, theme toggle, dashboard link. Noindex/nofollow. |
| `BaseLayout.astro` | Legacy, not actively used. |

### Page Structure

**Public Pages:** Homepage, rooms (4 + compare), guide (7 sections), blog, contact, reviews, gallery, tour, property, pets, policies, contribute, thank-you, 404.

**Admin Pages (19 total, protected by edge function):**
- `admin.astro` - Main dashboard with analytics, login, and admin tools
- User management, activity log, image manager, change requests, contact inquiries, newsletter subscribers, photo/blog contributors, changelog, roadmap, AI chat, terminal

### Netlify Functions (20)

**Authentication:** admin-login, admin-logout, admin-validate-session, admin-create-session, admin-set-password, send-2fa, verify-2fa

**Data:** data-store.js (central Netlify Blobs API for all admin data)

**Email (Resend):** send-invitation, send-notification, send-contributor-response, send-inquiry-reply, change-request-notify, change-completed

**Forms:** contact-form, newsletter-subscribe, blog-contributor, photo-contributor

**Analytics:** analytics.js (Google Analytics 4 Data API)

### Edge Function

`admin-auth.js` - Protects `/admin/*` paths, validates session cookies, redirects unauthenticated users to login.

### Data Storage (Netlify Blobs)

All admin data persists in Netlify Blobs, accessed via `public/js/shared-data.js` (`window.SharedData.*`):

admins, settings, changeRequests, activityLog, roadmap, aiTraining, securitySettings, pendingAdmins, deletedImages, editedImages, newsletterSubscribers, contactInquiries, imageOrder, photoContributors, blogContributors

## Key Patterns

### Blog System
Blog posts are `.astro` files in `src/pages/blog/`. When adding/removing posts, update BOTH the individual file AND the `allPosts` array in `blog/index.astro`.

### Admin Pages
Use `AdminLayout.astro` and load SharedData via `<script is:inline src="/js/shared-data.js"></script>`.

### Disabled Pages
Files prefixed with `_old-` are ignored by Astro. Remove prefix to re-enable.

### Dark Mode
Stored in localStorage as `theme`, initialized before render to prevent flash. Use `[data-theme="dark"]` CSS selectors.

### Activity Logging
All admin actions should be logged via SharedData.addActivity(type, action, details).

### Image Management
Deleted/edited images tracked in deletedImages/editedImages stores. Room galleries respect imageOrder store for custom sorting.

## CSS Variables

```css
--color-primary: #1B6B5A;      /* Ocean Teal */
--color-primary-dark: #0F4A3E;
--color-secondary: #C5A572;    /* Champagne Gold */
--color-text: #2D3436;
--color-text-light: #636E72;
--color-bg: #FFFFFF;
--color-bg-alt: #F7F5F2;
```

Fonts: Playfair Display (headings), Inter (body)

## External Services

| Service | Purpose |
|---------|---------|
| ReservationKey | Booking iframe at `/book` |
| Matterport | 3D tour iframe at `/tour` (ID: zrMG54r6RUx) |
| Tawk.to | Live chat (toggle-able via admin) |
| Google Analytics 4 | Tracking (G-2V4YH9H12C, consent-based) |
| Google Translate | Translation widget |
| Open-Meteo | Weather API (free, no key) |
| YouTube | Live volcano camera embeds |
| Resend | Email service |
| TripAdvisor | Reviews badge (rating: 4.9) |

## Security Headers (netlify.toml)

CSP configured for all external scripts/frames. SRI hashes on Chart.js and Leaflet. X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all set.

## TypeScript

Strict mode enabled. Path alias: `@/*` maps to `src/*`.
