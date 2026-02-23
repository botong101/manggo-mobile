# Changelog: Map & Disease Location Feature

## [2026-02-23] — Final Implementation (srcdoc iframe + FAB exit)

### Added
- **Floating exit FAB button** inside `.map-wrapper` when fullscreen is active
  - Positioned at `bottom-right` of the fullscreen overlay (well below `ion-header`)
  - Uses `contract-outline` icon, circular white button with green border
  - Only rendered when `isMapFullscreen === true`
- **`buildMapSrcdoc()` method** in `verify.page.ts`
  - Generates a complete self-contained HTML page string
  - Loads Leaflet 1.9.4 from CDN (`https://unpkg.com/leaflet@1.9.4/`)
  - Includes the user's current GPS location as a green marker
  - Includes disease markers (orange for similar, blue for all) from backend data
  - Calls `map.fitBounds()` to auto-zoom when disease markers are present
- **`escapeJs()` helper** in `verify.page.ts` — sanitizes strings for injection into JS single-quote literals
- **`SafeHtml` / `bypassSecurityTrustHtml()`** binding for `[srcdoc]` on the iframe
- **`.map-exit-fab` SCSS class** — absolute-positioned, z-index max, `env(safe-area-inset-bottom)` aware
- **`position: relative`** added to `.map-wrapper` to anchor the absolute FAB

### Changed
- **`verify.page.html`** — `<iframe [src]="mapUrl">` → `<iframe [srcdoc]="mapSrcdoc">`
  - Removed `loading="lazy"`, `scrolling="no"`, `marginheight`, `marginwidth` attributes (not needed for srcdoc)
  - Fullscreen toggle button in toolbar now only shows when `!isMapFullscreen`
  - FAB exit button added at bottom-right (no longer in the toolbar)
- **`verify.page.ts`**
  - `mapUrl: SafeResourceUrl` → `mapSrcdoc: SafeHtml | null`
  - `buildMapUrl()` replaced by `buildMapSrcdoc(diseaseLocations, filterType)`
  - `showSimilarDisease()` calls `buildMapSrcdoc(locs, 'similar')` after API response
  - `showAllDiseases()` calls `buildMapSrcdoc(locs, 'all')` after API response
  - `clearDiseaseMarkers()` calls `buildMapSrcdoc()` to reset to current-location pin only
  - `detectLocationWithPermission()` calls `buildMapSrcdoc()` once GPS resolves
  - `DomSanitizer` import changed from `SafeResourceUrl` to `SafeHtml`
  - Removed `BBOX_DELTA` constant (no longer needed)
- **`verify.page.scss`** — `.map-exit-fab` styles added; `.map-wrapper` gains `position: relative`

### Removed
- Static OpenStreetMap embed URL approach (`buildMapUrl()` with bbox parameters)
- `SafeResourceUrl` import
- Toolbar contract/expand toggle in fullscreen (replaced by bottom FAB)

---

## [Previous Session] — Remove Leaflet, Restore iframe

### Added
- Disease location results list below the map (`div.disease-locations-list`)
- `formatConfidence()` utility for normalising 0–1 or 0–100 confidence scores
- `isLoadingLocations`, `activeDiseaseFilter`, `diseaseLocations` state properties

### Changed
- Removed all npm Leaflet code (`import * as L`, `L.Map`, `L.tileLayer`, etc.)
- Restored `DomSanitizer` + `SafeResourceUrl` + static OSM bbox embed
- Reverted `.map-wrapper` overflow back to `hidden`
- `angular.json` Leaflet CSS entry and `allowedCommonJsDependencies` removed

### Removed
- `ngAfterViewChecked`, `ngOnDestroy` lifecycle hooks (Leaflet-specific)
- `mapContainer` ViewChild reference
- All Leaflet invalidateSize / retry timeout logic

---

## [Previous Session] — Leaflet Integration (abandoned)

### Added
- `leaflet` + `@types/leaflet` npm packages
- `L.Map` initialisation with retry/timeout guards
- `invalidateSize()` calls on fullscreen toggle and step changes
- Leaflet CSS in `angular.json`

### Removed (rolled back)
- Entire Leaflet integration removed in the following session due to persistent blank map and bounding-box overflow issues

---

## [Previous Session] — Backend Disease Location Endpoints

### Added (`manggo-backend`)
- `mangosense/views/disease_locations_views.py`
  - `disease_locations_similar(request)` — filters `MangoImage` by `predicted_class__iexact`
  - `disease_locations_all(request)` — returns all records with non-null lat/lng
  - Both return `{ locations: [...] }` JSON with `id, disease, latitude, longitude, address, uploaded_at, confidence`
- Routes in `mangosense/urls.py`:
  - `disease-locations/similar/`
  - `disease-locations/all/`

---

## [Previous Session] — Fullscreen Map & Initial Map Buttons (scaffold)

### Added
- `isMapFullscreen` toggle state
- `toggleMapFullscreen()` method
- `openMapExternal()` method (opens OSM in browser)
- Three disease-location buttons in HTML: Show Similar / Show All / Clear
- Fullscreen CSS block in `verify.page.scss`
