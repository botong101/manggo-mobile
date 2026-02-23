# Implementation Guide: Map with Disease Location Markers

## Overview

This document describes how the interactive map with disease location markers was implemented in the **ManggoSense** mobile app (Ionic 8 + Angular + Capacitor). The solution shows the user's current GPS location on a Leaflet map and lets them query nearby disease-detection records stored in the Django backend.

---

## 1. Architecture Decision: `srcdoc` iframe + CDN Leaflet

### Why not npm Leaflet?

Leaflet installed via npm in an Ionic/Angular standalone project causes:
- Blank tile rendering due to initialization timing conflicts with Ionic's view lifecycle
- Bounding-box overflow that breaks the page layout
- Complex workarounds (`invalidateSize`, `AfterViewChecked`, retry timeouts) that proved unreliable

### Why not a static OSM embed (`[src]="..."` with bbox URL)?

A static OpenStreetMap embed URL cannot receive runtime data — you cannot inject custom markers into it after the fact.

### Chosen solution: `[srcdoc]` binding

The iframe's `srcdoc` attribute accepts a **complete HTML string**. We generate this string in TypeScript, embed Leaflet loaded from CDN directly into it, and insert all marker data as JavaScript variables. The resulting iframe is completely self-contained — no npm package needed, no timing issues, supports dynamic markers.

---

## 2. Backend Setup (Django REST Framework)

### 2.1 Create the views file

**File:** `manggo-backend/mangosense/views/disease_locations_views.py`

```python
from django.http import JsonResponse
from mangoAPI.models import MangoImage

def disease_locations_similar(request):
    disease = request.GET.get('disease', '').strip()
    qs = MangoImage.objects.filter(
        predicted_class__iexact=disease,
        latitude__isnull=False,
        longitude__isnull=False
    ).values('id', 'predicted_class', 'latitude', 'longitude',
             'location_address', 'uploaded_at', 'confidence_score')
    locations = [
        {
            'id': r['id'],
            'disease': r['predicted_class'],
            'latitude': float(r['latitude']),
            'longitude': float(r['longitude']),
            'address': r['location_address'],
            'uploaded_at': str(r['uploaded_at']),
            'confidence': float(r['confidence_score']) if r['confidence_score'] else None,
        }
        for r in qs
    ]
    return JsonResponse({'locations': locations})

def disease_locations_all(request):
    qs = MangoImage.objects.filter(
        latitude__isnull=False,
        longitude__isnull=False
    ).values('id', 'predicted_class', 'latitude', 'longitude',
             'location_address', 'uploaded_at', 'confidence_score')
    locations = [
        {
            'id': r['id'],
            'disease': r['predicted_class'],
            'latitude': float(r['latitude']),
            'longitude': float(r['longitude']),
            'address': r['location_address'],
            'uploaded_at': str(r['uploaded_at']),
            'confidence': float(r['confidence_score']) if r['confidence_score'] else None,
        }
        for r in qs
    ]
    return JsonResponse({'locations': locations})
```

### 2.2 Register routes

**File:** `manggo-backend/mangosense/urls.py`

```python
from mangosense.views.disease_locations_views import (
    disease_locations_similar,
    disease_locations_all,
)

urlpatterns = [
    # ... existing routes ...
    path('disease-locations/similar/', disease_locations_similar, name='disease_locations_similar'),
    path('disease-locations/all/', disease_locations_all, name='disease_locations_all'),
]
```

**Endpoints:**

| Method | URL | Query param | Description |
|--------|-----|-------------|-------------|
| GET | `/api/disease-locations/similar/` | `?disease=<name>` | Records with matching `predicted_class` |
| GET | `/api/disease-locations/all/` | — | All records with lat/lng |

---

## 3. Frontend — `verify.page.ts`

### 3.1 Imports

```typescript
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
```

### 3.2 Properties

```typescript
mapSrcdoc: SafeHtml | null = null;
isMapFullscreen = false;
isLoadingLocations = false;
activeDiseaseFilter: 'similar' | 'all' | null = null;
diseaseLocations: any[] = [];
```

### 3.3 `escapeJs()` helper

Escapes a string for safe embedding inside a JavaScript single-quoted string literal:

```typescript
private escapeJs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/</g, '\\x3c')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}
```

### 3.4 `buildMapSrcdoc()` — core map generator

This method builds a full standalone HTML page as a string, then sanitizes it into a `SafeHtml` value for the `[srcdoc]` binding.

```typescript
buildMapSrcdoc(diseaseLocations: any[] = [], filterType: 'similar' | 'all' | null = null): void {
  const lat = this.detectedLocation?.latitude ?? 0;
  const lng = this.detectedLocation?.longitude ?? 0;

  // Serialize markers as a JS array literal
  const markersJs = diseaseLocations.map(loc => {
    const label = this.escapeJs(loc.disease ?? 'Unknown');
    const addr  = this.escapeJs(loc.address  ?? 'No address');
    const conf  = loc.confidence != null ? this.formatConfidence(loc.confidence) + '%' : '';
    const color = filterType === 'similar' ? 'orange' : 'blue';
    return `{lat:${loc.latitude},lng:${loc.longitude},label:'${label}',addr:'${addr}',conf:'${conf}',color:'${color}'}`;
  }).join(',');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map').setView([${lat},${lng}],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© OpenStreetMap contributors',maxZoom:19
    }).addTo(map);

    // Current location — green marker
    L.circleMarker([${lat},${lng}],{radius:10,color:'#457800',fillColor:'#8dc63f',fillOpacity:0.9})
      .addTo(map)
      .bindPopup('<b>Your Location</b>');

    // Disease markers
    var markers = [${markersJs}];
    var bounds = [[${lat},${lng}]];
    markers.forEach(function(m){
      L.circleMarker([m.lat,m.lng],{radius:8,color:m.color,fillColor:m.color,fillOpacity:0.75})
        .addTo(map)
        .bindPopup('<b>'+m.label+'</b><br/>'+m.addr+(m.conf?'<br/>Confidence: '+m.conf:''));
      bounds.push([m.lat,m.lng]);
    });
    if(markers.length > 0){ map.fitBounds(bounds,{padding:[30,30]}); }
  </script>
</body>
</html>`;

  this.mapSrcdoc = this.sanitizer.bypassSecurityTrustHtml(html);
}
```

### 3.5 Disease button methods

```typescript
showSimilarDisease(): void {
  this.isLoadingLocations = true;
  const disease = encodeURIComponent(this.detectedDisease ?? '');
  this.http.get<any>(`${this.apiUrl}/disease-locations/similar/?disease=${disease}`)
    .subscribe({
      next: (res) => {
        this.diseaseLocations = res.locations ?? [];
        this.activeDiseaseFilter = 'similar';
        this.buildMapSrcdoc(this.diseaseLocations, 'similar');
        this.isLoadingLocations = false;
      },
      error: () => { this.isLoadingLocations = false; }
    });
}

showAllDiseases(): void {
  this.isLoadingLocations = true;
  this.http.get<any>(`${this.apiUrl}/disease-locations/all/`)
    .subscribe({
      next: (res) => {
        this.diseaseLocations = res.locations ?? [];
        this.activeDiseaseFilter = 'all';
        this.buildMapSrcdoc(this.diseaseLocations, 'all');
        this.isLoadingLocations = false;
      },
      error: () => { this.isLoadingLocations = false; }
    });
}

clearDiseaseMarkers(): void {
  this.diseaseLocations = [];
  this.activeDiseaseFilter = null;
  this.buildMapSrcdoc(); // reset to current-location pin only
}
```

### 3.6 Fullscreen toggle

```typescript
toggleMapFullscreen(): void {
  this.isMapFullscreen = !this.isMapFullscreen;
}
```

### 3.7 Call `buildMapSrcdoc()` when GPS resolves

Inside `detectLocationWithPermission()`, after `this.detectedLocation` is set:

```typescript
this.buildMapSrcdoc(); // initial render — current pin only
```

---

## 4. Frontend — `verify.page.html`

### 4.1 Map wrapper structure

```html
<div class="map-wrapper" *ngIf="detectedLocation" [class.map-fullscreen]="isMapFullscreen">

  <!-- Toolbar — expand button hidden in fullscreen to avoid ion-header overlap -->
  <div class="map-toolbar">
    <span class="map-address">
      <ion-icon name="location"></ion-icon>
      {{ detectedLocation.address }}
    </span>
    <div class="map-actions">
      <button class="map-action-btn" (click)="openMapExternal()">
        <ion-icon name="open-outline"></ion-icon>
      </button>
      <!-- Only show expand when NOT fullscreen -->
      <button class="map-action-btn" *ngIf="!isMapFullscreen" (click)="toggleMapFullscreen()">
        <ion-icon name="expand-outline"></ion-icon>
      </button>
    </div>
  </div>

  <!-- srcdoc iframe — entire Leaflet HTML injected here -->
  <iframe
    *ngIf="mapSrcdoc"
    [srcdoc]="mapSrcdoc"
    class="osm-iframe"
    frameborder="0"
    allowfullscreen
    title="Detected location map">
  </iframe>

  <!-- Query buttons -->
  <div class="map-disease-buttons">
    <button class="map-disease-btn similar" (click)="showSimilarDisease()"
      [disabled]="isLoadingLocations" [class.active]="activeDiseaseFilter === 'similar'">
      <ion-icon name="git-branch-outline"></ion-icon>
      <span>Show Similar Disease Near Me</span>
    </button>
    <button class="map-disease-btn all" (click)="showAllDiseases()"
      [disabled]="isLoadingLocations" [class.active]="activeDiseaseFilter === 'all'">
      <ion-icon name="earth-outline"></ion-icon>
      <span>Show All Detected Disease Near Me</span>
    </button>
    <button class="map-disease-btn clear" (click)="clearDiseaseMarkers()"
      [disabled]="isLoadingLocations || activeDiseaseFilter === null">
      <ion-icon name="trash-outline"></ion-icon>
      <span>Clear</span>
    </button>
  </div>

  <!-- Exit FAB — bottom-right, always above the disease buttons, never behind ion-header -->
  <button class="map-exit-fab" *ngIf="isMapFullscreen" (click)="toggleMapFullscreen()"
    aria-label="Exit fullscreen">
    <ion-icon name="contract-outline"></ion-icon>
  </button>

</div>
```

### 4.2 Why the FAB is at the bottom instead of the toolbar

When `.map-fullscreen` sets `position: fixed; inset: 0`, the whole overlay starts at `top: 0` — the same position as Ionic's `ion-header`. The header sits above the app content area (z-index ~100). A button inside the toolbar at `top: 0` will be partially or fully covered by `ion-header`.

The floating exit FAB is placed at `bottom-right`, so it is always fully visible and tappable.

---

## 5. Frontend — `verify.page.scss`

### 5.1 `.map-wrapper` — add `position: relative`

This is required to anchor the absolutely-positioned exit FAB inside the wrapper:

```scss
.map-wrapper {
  position: relative; // ← required for FAB anchor
  margin: 0 0 20px 0;
  border-radius: 14px;
  border: 2px solid $green-secondary;
  overflow: hidden;
  // ...
}
```

### 5.2 Fullscreen block

```scss
&.map-fullscreen {
  position: fixed !important;
  inset: 0;
  z-index: 2147483647; // above everything including ion-header
  margin: 0;
  border-radius: 0;
  border: none;
  display: flex;
  flex-direction: column;

  .map-toolbar { position: relative; z-index: 1; flex-shrink: 0; }
  .osm-iframe  { flex: 1; height: auto !important; }
  .map-disease-buttons { flex-shrink: 0; }
}
```

### 5.3 Exit FAB

```scss
.map-exit-fab {
  position: absolute;
  // bottom: above disease-buttons row + safe area inset (notch/home-bar)
  bottom: calc(48px + env(safe-area-inset-bottom, 0px) + 60px);
  right: 16px;
  z-index: 2147483647;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 2px solid $green-secondary;
  background: white;
  color: $green-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  padding: 0;
  transition: transform 0.12s ease;

  ion-icon { font-size: 22px; pointer-events: none; }
  &:active  { transform: scale(0.90); }
}
```

---

## 6. Security Note

The `[srcdoc]` binding in Angular requires the HTML string to be wrapped with `DomSanitizer.bypassSecurityTrustHtml()`, because Angular treats `srcdoc` content as potentially unsafe. The `escapeJs()` helper ensures that user-derived strings (disease name, address) cannot break out of their JS string context inside the generated HTML.

---

## 7. Data Flow Summary

```
User taps Step 2 (Location)
  └─ detectLocationWithPermission()
       └─ GPS resolves → detectedLocation set
            └─ buildMapSrcdoc()  ← current-pin only
                 └─ mapSrcdoc = SafeHtml  →  [srcdoc] on iframe

User taps "Show Similar Disease Near Me"
  └─ showSimilarDisease()
       └─ GET /api/disease-locations/similar/?disease=<name>
            └─ buildMapSrcdoc(locations, 'similar')  ← current pin + orange markers
                 └─ mapSrcdoc updated  →  iframe re-renders automatically

User taps "Show All Detected Disease Near Me"
  └─ showAllDiseases()
       └─ GET /api/disease-locations/all/
            └─ buildMapSrcdoc(locations, 'all')  ← current pin + blue markers

User taps "Clear"
  └─ clearDiseaseMarkers()
       └─ buildMapSrcdoc()  ← resets to current-pin only

User taps expand icon
  └─ toggleMapFullscreen()  →  isMapFullscreen = true
       └─ .map-fullscreen CSS applied  →  fixed overlay, bottom FAB shown

User taps FAB (contract icon at bottom-right)
  └─ toggleMapFullscreen()  →  isMapFullscreen = false
       └─ wrapper returns to normal, FAB hidden
```

---

## 8. Files Modified

| File | Change |
|------|--------|
| `manggo-backend/mangosense/views/disease_locations_views.py` | **Created** — two GET views |
| `manggo-backend/mangosense/urls.py` | Added 2 URL routes |
| `manggo-mobile/src/app/pages/verify/verify.page.ts` | Major rewrite of map logic |
| `manggo-mobile/src/app/pages/verify/verify.page.html` | iframe `[srcdoc]` binding, FAB button |
| `manggo-mobile/src/app/pages/verify/verify.page.scss` | FAB styles, `position:relative` on wrapper |
| `manggo-mobile/angular.json` | Removed Leaflet CSS entry (rollback) |
