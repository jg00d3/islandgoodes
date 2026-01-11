# Island Goodes Website Development - Session Log
## Date: January 11, 2026
## Version: 2.4.0 → 2.5.0

---

## Work Completed

### 1. Fixed Rotated/Edited Images Not Showing in Lightbox
**Problem:** Images rotated in admin Image Manager were showing unrotated in room lightboxes due to a race condition - users could open lightbox before SharedData finished loading.

**Solution:**
- Added `ensureSharedDataLoaded()` function that waits up to 3 seconds for SharedData
- `openLightbox()` now awaits SharedData before showing any images
- Global caches (`editedImagesCache`, `deletedPathsCache`) store loaded data
- `getImageSrc()` function checks cache for edited versions

### 2. Fixed Deleted Images Showing in Lightbox
**Problem:** Images deleted via admin Image Manager still appeared in room lightboxes.

**Solution:**
- `visibleIndices` array tracks non-deleted images
- `showImage()` skips deleted images
- Navigation (prev/next) uses `visibleIndices` to skip deleted images
- Counter shows correct count excluding deleted images (e.g., "5 / 12" instead of "5 / 15")

### 3. Slideshow Controls Respect Admin Setting
**Problem:** Slideshow play button appeared on all pages regardless of admin setting.

**Solution:**
- All room pages now fetch `settings.slideshowEnabled` from data store
- Controls hidden by default if setting is false or fetch fails
- Gallery page already had this logic (no change needed)

### 4. "Not Clothing-Optional" Text Added
Added clarification text to multiple locations:
- Home page "Adults Only" card: "18+ only. Traditional accommodation, not clothing-optional"
- Rooms page "Adults Only" card: "Traditional accommodation, not clothing-optional"
- (Previously added to footer and policies page)

---

## Files Modified

### Room Pages (all 4 rooms)
- `src/pages/rooms/mauna-kea.astro`
- `src/pages/rooms/hilo-bay.astro`
- `src/pages/rooms/ginger.astro`
- `src/pages/rooms/orchid.astro`

Changes to each:
- Added `editedImagesCache`, `deletedPathsCache`, `sharedDataLoaded`, `visibleIndices` variables
- Added `ensureSharedDataLoaded()` async function
- Added `getImageSrc()`, `getVisibleCount()`, `getVisiblePosition()` helper functions
- Updated `showImage()` to skip deleted images and use cached edits
- Updated `openLightbox()` to await SharedData
- Updated `prevImage()`/`nextImage()` to use `visibleIndices`
- Added settings fetch for `slideshowEnabled`

### Other Pages
- `src/pages/index.astro` - Added "not clothing-optional" text
- `src/pages/rooms/index.astro` - Added "not clothing-optional" text
- `src/pages/gallery.astro` - Verified slideshow respects admin setting (no change needed)

### Configuration
- `package.json` - Version 2.4.0 → 2.5.0
- `src/pages/admin/changelog.astro` - Added version 2.5.0 release notes

---

## Technical Details

### SharedData Loading Pattern
```typescript
async function ensureSharedDataLoaded(): Promise<void> {
  if (sharedDataLoaded) return;

  // Wait for SharedData to become available (max 3 seconds)
  const maxWait = 3000;
  const start = Date.now();
  while (typeof (window as any).SharedData === 'undefined' && Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 50));
  }

  // Fetch and cache edited/deleted images
  const SharedData = (window as any).SharedData;
  deletedPathsCache = await SharedData.getDeletedImages();
  editedImagesCache = await SharedData.getEditedImages();
  sharedDataLoaded = true;
}
```

### Settings Check Pattern
```typescript
(async function() {
  const response = await fetch('/.netlify/functions/data-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store: 'settings', action: 'get', key: 'data' })
  });
  const settings = response.ok ? await response.json() : {};
  if (!settings.slideshowEnabled) {
    const controls = document.querySelector('.lightbox-controls');
    if (controls) controls.style.display = 'none';
  }
})();
```

---

## Testing Notes

- Test each room page lightbox after rotating images in Image Manager
- Test deleting images and verify they don't appear in lightbox
- Test lightbox navigation (prev/next) skips deleted images
- Test slideshow toggle in admin settings affects all pages
- Verify "not clothing-optional" text appears on home and rooms pages

---

## Next Steps

- Monitor for any edge cases with image loading
- Consider caching settings to reduce API calls
