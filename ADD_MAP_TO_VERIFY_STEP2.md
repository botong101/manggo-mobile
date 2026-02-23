# Add Leaflet Map with Pinned Location & Bounding Box to Verify Step 2

> **Stack:** Angular 20 (standalone), Ionic 8, Capacitor  
> **Target:** `src/app/pages/verify/verify.page.*`  
> **Theme colors:** `#457800` (green-primary), `#8dc63f` (green-secondary), `#f9f9d5` (cream-bg)

---

## Overview

The goal is to embed a **Leaflet.js** map in the Step 2 (Location) section of the verify wizard that:
- Shows a **pin marker** at `detectedLocation.latitude / longitude`
- Draws a **bounding box** (rectangle) around the pin to indicate a detection area
- Matches the existing green/cream design scheme
- Is fully **responsive** for mobile screen widths

---

## Step 1 — Install Leaflet

Run these two commands from the project root:

```bash
npm install leaflet
npm install --save-dev @types/leaflet
```

---

## Step 2 — Register Leaflet CSS in `angular.json`

Open `angular.json` and find the `"styles"` array inside `projects > mango-sense > architect > build > options`. Add the Leaflet stylesheet **before** your own global styles:

```json
"styles": [
  "node_modules/leaflet/dist/leaflet.css",
  "src/global.scss"
],
```

Also add it to the `"test"` target if you run unit tests that touch this component:

```json
"styles": [
  "node_modules/leaflet/dist/leaflet.css",
  "src/global.scss"
],
```

---

## Step 3 — Add `@types/leaflet` to `tsconfig.app.json`

Open `tsconfig.app.json` and ensure the `types` array includes `"leaflet"` (add it if `types` is already declared):

```json
{
  "compilerOptions": {
    "types": ["leaflet"]
  }
}
```

If there is no `types` array, you can skip this — TypeScript will pick it up automatically.

---

## Step 4 — Update `verify.page.ts` Imports and Properties

### 4a — Add Leaflet imports

At the top of `verify.page.ts`, add:

```typescript
import { AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
import * as L from 'leaflet';
```

### 4b — Fix Leaflet default marker icons (known Webpack issue)

Leaflet's default marker assets break under Angular CLI. Add this block **outside** the class, right after the imports:

```typescript
// Fix Leaflet marker icons in Angular/Webpack builds
const iconDefault = L.icon({
  iconUrl: 'assets/leaflet/marker-icon.png',
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = iconDefault;
```

You will copy the marker assets in Step 5 below.

### 4c — Extend the class declaration

Change:

```typescript
export class VerifyPage implements OnInit {
```

to:

```typescript
export class VerifyPage implements OnInit, AfterViewInit {
```

### 4d — Add class properties

Inside the class body, after `detectedLocation: any = null;`, add:

```typescript
// Leaflet map instance and DOM reference
@ViewChild('leafletMap') mapElementRef!: ElementRef<HTMLDivElement>;
private leafletMap: L.Map | null = null;
private locationMarker: L.Marker | null = null;
private boundingBox: L.Rectangle | null = null;

// Half-side of bounding box in degrees (~500 m at equator)
private readonly BBOX_DELTA = 0.005;
```

### 4e — Add `NgZone` to the constructor

Update the constructor to inject `NgZone`:

```typescript
constructor(
  private router: Router,
  private http: HttpClient,
  private loadingCtrl: LoadingController,
  private toastCtrl: ToastController,
  private verifyPredictionService: VerifyPredictionService,
  private exifLocationService: ExifLocationService,
  private symptomsService: VerifySymptomsService,
  private detectionService: VerifyDetectionService,
  private ngZone: NgZone   // <-- add this
) {}
```

### 4f — Implement `ngAfterViewInit`

```typescript
ngAfterViewInit() {
  // Map is only rendered when currentStep === 2, so we
  // call initMap after the first step navigation if needed.
}
```

### 4g — Add map initialisation and teardown methods

Add these private methods to the class:

```typescript
/** Call this whenever the step-2 div becomes visible */
initLocationMap() {
  // Guard: element must exist and location must be available
  if (!this.mapElementRef?.nativeElement || !this.detectedLocation) return;

  // Destroy old instance if navigating back and forward
  if (this.leafletMap) {
    this.leafletMap.remove();
    this.leafletMap = null;
  }

  const lat = this.detectedLocation.latitude;
  const lng = this.detectedLocation.longitude;

  this.ngZone.runOutsideAngular(() => {
    this.leafletMap = L.map(this.mapElementRef.nativeElement, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,   // better UX on mobile
      dragging: true,
    });

    // OpenStreetMap tile layer (free, no API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.leafletMap!);

    // Pin marker with a popup
    this.locationMarker = L.marker([lat, lng])
      .addTo(this.leafletMap!)
      .bindPopup(
        `<b>${this.detectedLocation.address || 'Detected Location'}</b><br>
         ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        { maxWidth: 200 }
      )
      .openPopup();

    // Bounding box — a rectangle ±BBOX_DELTA deg around the pin
    const delta = this.BBOX_DELTA;
    const bounds: L.LatLngBoundsExpression = [
      [lat - delta, lng - delta],
      [lat + delta, lng + delta],
    ];

    this.boundingBox = L.rectangle(bounds, {
      color: '#8dc63f',       // green-secondary stroke
      weight: 2,
      opacity: 0.9,
      fillColor: '#457800',   // green-primary fill
      fillOpacity: 0.10,
      dashArray: '6 4',       // dashed border
      lineJoin: 'round',
    }).addTo(this.leafletMap!);

    // Fit the view to the bounding box with a small padding
    this.leafletMap!.fitBounds(bounds, { padding: [24, 24] });

    // Force a resize calculation after the map DIV is fully painted
    setTimeout(() => this.leafletMap?.invalidateSize(), 200);
  });
}

destroyLocationMap() {
  if (this.leafletMap) {
    this.leafletMap.remove();
    this.leafletMap = null;
    this.locationMarker = null;
    this.boundingBox = null;
  }
}
```

### 4h — Hook map init/destroy into `nextStep()` and `previousStep()`

Find your existing `nextStep()` method and add the map calls:

```typescript
nextStep() {
  if (this.currentStep < this.totalSteps) {
    // Leaving step 2 → destroy map
    if (this.currentStep === 2) this.destroyLocationMap();

    this.currentStep = (this.currentStep + 1) as 1 | 2 | 3 | 4;

    // Entering step 2 → init map after Angular renders the div
    if (this.currentStep === 2) {
      setTimeout(() => this.initLocationMap(), 50);
    }
  }
}
```

Find your existing `previousStep()` method and add:

```typescript
previousStep() {
  if (this.currentStep > 1) {
    // Leaving step 2 → destroy map
    if (this.currentStep === 2) this.destroyLocationMap();

    this.currentStep = (this.currentStep - 1) as 1 | 2 | 3 | 4;

    // If we go back to step 2 somehow (edge case), re-init
    if (this.currentStep === 2) {
      setTimeout(() => this.initLocationMap(), 50);
    }
  }
}
```

Also hook into the **initial load** if the page can start on step 2 (unlikely but safe). At the end of `ngOnInit()`, after `detectedLocation` is resolved, add:

```typescript
if (this.currentStep === 2 && this.detectedLocation) {
  setTimeout(() => this.initLocationMap(), 50);
}
```

---

## Step 5 — Copy Leaflet Marker Assets

Leaflet's default marker PNG files must be accessible at runtime. Copy them from `node_modules` to `src/assets`:

```bash
# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path src/assets/leaflet
Copy-Item node_modules/leaflet/dist/images/marker-icon.png      src/assets/leaflet/
Copy-Item node_modules/leaflet/dist/images/marker-icon-2x.png   src/assets/leaflet/
Copy-Item node_modules/leaflet/dist/images/marker-shadow.png    src/assets/leaflet/
```

Then register this folder as a static asset in `angular.json` under `assets`:

```json
"assets": [
  {
    "glob": "**/*",
    "input": "src/assets",
    "output": "assets"
  }
]
```

(It is usually already there — just confirm `src/assets` is included.)

---

## Step 6 — Update `verify.page.html` (Step 2 block)

Replace the current step-2 `location-info-card` content with the version below that includes the map container, while keeping the existing radio group beneath it:

```html
<!-- step 2 - location stuff -->
<div *ngIf="currentStep == 2" class="step-content">
  <div class="location-section">
    <h3 class="section-title">
      <ion-icon name="location-outline"></ion-icon>
      Location Information
    </h3>
    <p class="section-subtitle">Please confirm if this detected location is accurate</p>

    <div class="location-info-card">
      <div class="location-details">
        <h4>Detected Location</h4>
        <div class="detected-location" *ngIf="detectedLocation">
          <p class="location-address">{{ detectedLocation.address || 'Loading address...' }}</p>
          <p class="location-coordinates">
            {{ detectedLocation.latitude | number:'1.4-4' }},
            {{ detectedLocation.longitude | number:'1.4-4' }}
          </p>
          <p class="location-source">Source: {{ detectedLocation.source | titlecase }}</p>
        </div>
        <div class="no-location" *ngIf="!detectedLocation">
          <p class="location-address">No location data found in image</p>
          <p class="location-note">Your device location will be used if available</p>
        </div>
      </div>
    </div>

    <!-- ── MAP SECTION ─────────────────────────────────────── -->
    <div class="map-wrapper" *ngIf="detectedLocation">
      <div #leafletMap class="leaflet-map-container"></div>
      <p class="map-caption">
        <ion-icon name="scan-outline"></ion-icon>
        Bounding box shows the approximate detection area (~500 m radius)
      </p>
    </div>
    <!-- ── END MAP SECTION ────────────────────────────────── -->

    <div class="radio-group">
      <ion-radio-group [(ngModel)]="locationAccuracyConfirmed" (ionChange)="onLocationChange($event)">
        <ion-item class="radio-item" button>
          <ion-radio slot="start" value="true"></ion-radio>
          <ion-label>
            <h4>Yes, this location is accurate</h4>
            <p>The detected location correctly represents where this photo was taken</p>
          </ion-label>
        </ion-item>

        <ion-item class="radio-item" button>
          <ion-radio slot="start" value="false"></ion-radio>
          <ion-label>
            <h4>No, this location is not accurate</h4>
            <p>The location data will still be saved but marked as unconfirmed</p>
          </ion-label>
        </ion-item>
      </ion-radio-group>
    </div>
  </div>
</div>
```

---

## Step 7 — Add SCSS for the Map

Open `verify.page.scss` and add the following block anywhere after the existing `.location-info-card` rule (around line 560). All variables (`$green-primary`, etc.) are already defined at the top of the file.

```scss
// ── Leaflet map block ─────────────────────────────────────────────

.map-wrapper {
  margin: 0 0 20px 0;
  border-radius: 14px;
  overflow: hidden;           // clips the map to the rounded corners
  box-shadow: 0 4px 16px rgba(69, 120, 0, 0.18);
  border: 2px solid $green-secondary;
}

.leaflet-map-container {
  width: 100%;
  height: 240px;              // base height for most mobiles

  @media (min-width: 480px) {
    height: 280px;
  }

  @media (min-width: 768px) {
    height: 340px;
  }

  // Leaflet attribution override — keep it readable but compact
  .leaflet-control-attribution {
    font-size: 9px;
    background: rgba(255, 255, 255, 0.75);
  }

  // Zoom controls — tint to match app theme
  .leaflet-control-zoom a {
    color: $green-primary;
    border-color: $green-secondary;

    &:hover {
      background-color: $green-light;
    }
  }
}

.map-caption {
  background: linear-gradient(135deg, #e8f5e8, #f0f9f0);
  padding: 8px 14px;
  margin: 0;
  font-size: 0.78rem;
  color: $text-light;
  display: flex;
  align-items: center;
  gap: 6px;

  ion-icon {
    color: $green-secondary;
    font-size: 14px;
    flex-shrink: 0;
  }
}

// ── End Leaflet map block ─────────────────────────────────────────
```

---

## Step 8 — Handle the "No Location" Case Gracefully

If `detectedLocation` is `null`, the map wrapper is hidden via `*ngIf="detectedLocation"` (already in the HTML above). Optionally add a friendly placeholder instead:

```html
<!-- Inside the location-section, after the map-wrapper -->
<div class="no-location-map" *ngIf="!detectedLocation">
  <ion-icon name="map-outline"></ion-icon>
  <p>Map unavailable – no location data was found in this image</p>
</div>
```

SCSS for the placeholder:

```scss
.no-location-map {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  background: linear-gradient(135deg, #e8f5e8, #f0f9f0);
  border-radius: 14px;
  border: 2px dashed $green-secondary;
  margin-bottom: 20px;
  color: $text-light;

  ion-icon {
    font-size: 36px;
    color: $green-secondary;
    opacity: 0.6;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    text-align: center;
  }
}
```

---

## Step 9 — Add `NgZone` and `AfterViewInit` to the Angular import list

Because `VerifyPage` is a **standalone component**, make sure the component decorator's `imports` array includes what Leaflet needs at runtime. You only need standard Angular/Ionic imports — no new `imports` array changes are needed for Leaflet itself since it is used imperatively. Just ensure the class now implements both interfaces:

```typescript
export class VerifyPage implements OnInit, AfterViewInit {
```

And the new Angular core imports at the top:

```typescript
import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, NgZone } from '@angular/core';
```

---

## Step 10 — Final Build & Test

```bash
# Web preview
ng serve

# Android (after web build)
npx cap sync android
npx cap open android
```

**What to verify in the browser/device:**

| Check | Expected |
|---|---|
| Navigate to step 2 | Map renders at the detected coordinates |
| Pin marker | Visible with popup showing address + coords |
| Bounding box | Dashed green rectangle surrounds the pin |
| Rotate / resize window | Map container reflows responsively |
| Navigate away and back | Old map destroyed, new instance rendered cleanly |
| No location data | Map wrapper hidden, no JS errors |

---

## Bounding Box Size Reference

`BBOX_DELTA = 0.005` degrees is approximately:

| Lat zone | Coverage |
|---|---|
| Equator (0°) | ~556 m each side (~1.1 km total) |
| Philippines (~13°N) | ~540 m each side |
| Higher latitudes | Shrinks proportionally |

Adjust `BBOX_DELTA` in `verify.page.ts` to make the box smaller (e.g., `0.002`) or larger (e.g., `0.01`).

---

## Tile Provider Options (Offline / Alternative)

If OpenStreetMap tiles are too slow on device:

| Provider | URL | Notes |
|---|---|---|
| CartoDB Light | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` | Clean, minimal look |
| CartoDB Dark | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` | Dark mode |
| Stadia Maps | `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png` | Bright, mobile-friendly |
| OpenStreetMap (default) | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | No API key, free |

All options above require no API key. For production, consider self-hosting or using a managed tile provider to avoid rate limits.
