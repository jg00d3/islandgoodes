# Changelog

All notable changes to this project will be documented in this file.

## [2.7.0] - 2026-01-12

### Added
- Change request email notification system - sends email to both admin requester and sysadmroot@gmail.com when new request is submitted
- Change completion workflow - marks requests as completed with notes, emails requester with details
- Activity logging for completed change requests

### Changed
- Tax rate updated from 17.97% to 18.72% across all room pages and policy pages (simplified display)
- Accessibility feature renamed to "Easy to Get Around" with new compass icon (🧭)
- Seasonal discount changed from 55% to 40% on homepage and policies page
- Property page accessibility section updated with new messaging

### Fixed
- Tax information now displays as single 18.72% rate instead of TAT/GET breakdown for clarity

## [2.4.0] - 2026-01-10

### Added
- Auto-slideshow feature for room page lightboxes with play/pause button and speed selector (Slow 5s, Medium 3s, Fast 1.5s)
- Auto-slideshow feature for photo gallery lightbox with same controls
- Space bar keyboard shortcut to toggle slideshow in lightboxes
- Image counter showing current position in lightboxes

### Fixed
- Fixed deleted images still appearing in lightbox slideshows (used CSS class instead of inline style for more reliable filtering)
- Fixed edited/rotated images not displaying correctly in lightboxes
