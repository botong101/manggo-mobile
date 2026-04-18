import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription, firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

interface DiseaseLocation {
  id: number;
  disease: string;
  latitude: number;
  longitude: number;
  address: string;
  uploaded_at: string | null;
  confidence: number | null;
}

interface DiseaseLocationsResponse {
  success: boolean;
  message: string;
  data?: {
    locations?: Array<{
      id: number;
      disease: string;
      latitude: number | string;
      longitude: number | string;
      address?: string;
      uploaded_at?: string | null;
      confidence?: number | null;
    }>;
  };
}

interface NearbyDisease {
  disease: string;
  distanceKm: number;
  address: string;
  confidence: number | null;
}

@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
  standalone: false,
})
export class FolderPage implements OnInit {
  public folder = '';
  public isHeatmapLoading = false;
  public heatmapError = '';
  public heatmapSrcdoc: SafeHtml | null = null;
  public diseaseLocations: DiseaseLocation[] = [];
  public nearbyDiseases: NearbyDisease[] = [];
  public topDiseaseCounts: Array<{ disease: string; count: number }> = [];

  private routeSub?: Subscription;
  private currentLocation: { lat: number; lng: number } | null = null;

  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  constructor() {}

  ngOnInit() {
    this.routeSub = this.activatedRoute.paramMap.subscribe((params) => {
      this.folder = params.get('id') ?? '';

      if (this.folder === 'History') {
        this.router.navigate(['/pages/history']);
        return;
      }

      if (this.folder === 'Reports') {
        this.loadDiseaseHeatmap();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  refreshDiseaseHeatmap(): void {
    this.loadDiseaseHeatmap();
  }

  getPreventionTip(disease: string): string {
    const normalized = disease.toLowerCase();

    if (normalized.includes('anthracnose')) {
      return 'Prune infected plant parts and spray a recommended fungicide before and during humid periods.';
    }

    if (normalized.includes('powdery mildew')) {
      return 'Improve airflow in the canopy and apply sulfur-based treatment at early signs.';
    }

    if (normalized.includes('sooty mold')) {
      return 'Control sap-sucking insects and wash leaves to reduce mold buildup.';
    }

    if (normalized.includes('die back')) {
      return 'Cut affected twigs below damaged areas and disinfect pruning tools after each cut.';
    }

    if (normalized.includes('stem end rot') || normalized.includes('black mould rot')) {
      return 'Reduce fruit injuries, improve harvest hygiene, and keep storage areas dry and cool.';
    }

    return 'Inspect nearby trees weekly, remove infected tissues early, and keep orchard sanitation strict.';
  }

  private async loadDiseaseHeatmap(): Promise<void> {
    this.isHeatmapLoading = true;
    this.heatmapError = '';

    try {
      const response = await firstValueFrom(
        this.http.get<DiseaseLocationsResponse>(`${environment.apiUrl}/disease-locations/all/`)
      );

      const rawLocations = response?.data?.locations ?? [];
      this.diseaseLocations = rawLocations
        .map((location) => {
          const latitude = Number(location.latitude);
          const longitude = Number(location.longitude);

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }

          return {
            id: location.id,
            disease: location.disease || 'Unknown',
            latitude,
            longitude,
            address: location.address || 'Address unavailable',
            uploaded_at: location.uploaded_at ?? null,
            confidence: location.confidence ?? null,
          };
        })
        .filter((location): location is DiseaseLocation => {
          if (location === null) {
            return false;
          }

          return !this.isHealthyDisease(location.disease);
        });

      this.topDiseaseCounts = this.getTopDiseaseCounts(this.diseaseLocations);
      this.currentLocation = await this.getCurrentLocation();
      this.nearbyDiseases = this.getNearbyDiseases(this.diseaseLocations, this.currentLocation, 12);

      const center = this.getMapCenter(this.currentLocation, this.diseaseLocations);
      this.buildMapSrcdoc(this.diseaseLocations, center.lat, center.lng, this.currentLocation !== null);

      if (this.diseaseLocations.length === 0) {
        this.heatmapError = 'No disease locations are recorded yet. Add detections with location data to see hotspot risk.';
      }
    } catch (error) {
      console.error('Failed to load disease heatmap:', error);
      this.heatmapError = 'Unable to load disease heatmap right now. Please try again.';
      this.heatmapSrcdoc = null;
      this.diseaseLocations = [];
      this.nearbyDiseases = [];
      this.topDiseaseCounts = [];
    } finally {
      this.isHeatmapLoading = false;
    }
  }

  private buildMapSrcdoc(
    locations: DiseaseLocation[],
    centerLat: number,
    centerLng: number,
    hasCurrentLocation: boolean
  ): void {
    const heatPoints = locations.map((location) => [
      location.latitude,
      location.longitude,
      this.getHeatIntensity(location.confidence),
    ]);

    const markerLocations = locations.slice(0, 150).map((location) => ({
      latitude: location.latitude,
      longitude: location.longitude,
      disease: this.escapeJs(location.disease),
      address: this.escapeJs(location.address),
      confidence:
        typeof location.confidence === 'number'
          ? `${Math.round(location.confidence * 100)}%`
          : 'N/A',
    }));

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; }
    .legend {
      background: rgba(255, 255, 255, 0.94);
      border-radius: 10px;
      padding: 8px 10px;
      font-family: Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 11px;
      line-height: 1.4;
      color: #1c2b1a;
    }
    .legend .bar {
      width: 140px;
      height: 8px;
      border-radius: 6px;
      margin: 6px 0;
      background: linear-gradient(90deg, #2b83ba 0%, #abdda4 40%, #fdae61 70%, #d7191c 100%);
    }
    .legend .labels {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #334;
    }
    .current-pin {
      font-size: 11px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script src="https://unpkg.com/leaflet.heat/dist/leaflet-heat.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${centerLat}, ${centerLng}], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const heatPoints = ${JSON.stringify(heatPoints)};
    const markers = ${JSON.stringify(markerLocations)};

    if (heatPoints.length > 0) {
      L.heatLayer(heatPoints, {
        radius: 28,
        blur: 24,
        maxZoom: 17,
        gradient: {
          0.2: '#2b83ba',
          0.4: '#abdda4',
          0.7: '#fdae61',
          0.95: '#d7191c'
        }
      }).addTo(map);
    }

    const bounds = [];
    markers.forEach((loc) => {
      const marker = L.circleMarker([loc.latitude, loc.longitude], {
        radius: 6,
        color: '#4f0b0b',
        weight: 1,
        fillColor: '#d7191c',
        fillOpacity: 0.7,
      }).addTo(map);
      marker.bindPopup('<strong>' + loc.disease + '</strong><br/>' + loc.address + '<br/>Confidence: ' + loc.confidence);
      bounds.push([loc.latitude, loc.longitude]);
    });

    if (${hasCurrentLocation}) {
      L.marker([${centerLat}, ${centerLng}]).addTo(map).bindPopup('<span class="current-pin">Your current location</span>');
      bounds.push([${centerLat}, ${centerLng}]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [22, 22] });
    }

    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      div.innerHTML = '<div><strong>Disease Risk Heatmap</strong></div>' +
        '<div class="bar"></div>' +
        '<div class="labels"><span>Low</span><span>High</span></div>';
      return div;
    };
    legend.addTo(map);
  </script>
</body>
</html>
`;

    this.heatmapSrcdoc = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private getHeatIntensity(confidence: number | null): number {
    if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
      return 0.6;
    }

    // Backend confidence is often a 0..1 score. Clamp to avoid weak or fully saturated blobs.
    const normalized = Math.max(0.25, Math.min(confidence, 1));
    return Number(normalized.toFixed(2));
  }

  private getTopDiseaseCounts(locations: DiseaseLocation[]): Array<{ disease: string; count: number }> {
    const counts = new Map<string, number>();

    locations.forEach((location) => {
      counts.set(location.disease, (counts.get(location.disease) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([disease, count]) => ({ disease, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }

  private isHealthyDisease(disease: string): boolean {
    return disease.trim().toLowerCase().includes('healthy');
  }

  private getNearbyDiseases(
    locations: DiseaseLocation[],
    currentLocation: { lat: number; lng: number } | null,
    radiusKm: number
  ): NearbyDisease[] {
    if (!currentLocation) {
      return [];
    }

    return locations
      .map((location) => {
        const distanceKm = this.calculateDistanceKm(
          currentLocation.lat,
          currentLocation.lng,
          location.latitude,
          location.longitude
        );

        return {
          disease: location.disease,
          distanceKm,
          address: location.address,
          confidence: location.confidence,
        };
      })
      .filter((location) => location.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6);
  }

  private async getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    if (!('geolocation' in navigator)) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }

  private getMapCenter(
    currentLocation: { lat: number; lng: number } | null,
    locations: DiseaseLocation[]
  ): { lat: number; lng: number } {
    if (currentLocation) {
      return currentLocation;
    }

    if (locations.length === 0) {
      // Philippines fallback center.
      return { lat: 12.8797, lng: 121.774 };
    }

    const total = locations.reduce(
      (accumulator, location) => {
        return {
          lat: accumulator.lat + location.latitude,
          lng: accumulator.lng + location.longitude,
        };
      },
      { lat: 0, lng: 0 }
    );

    return {
      lat: total.lat / locations.length,
      lng: total.lng / locations.length,
    };
  }

  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const earthRadiusKm = 6371;
    const deltaLat = this.toRadians(lat2 - lat1);
    const deltaLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private toRadians(value: number): number {
    return value * (Math.PI / 180);
  }

  private escapeJs(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
