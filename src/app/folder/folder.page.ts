import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ToastController } from '@ionic/angular';
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

interface ProfileSettingsState {
  firstName: string;
  lastName: string;
  email: string;
  province: string;
  city: string;
  barangay: string;
}

interface NotificationSettingsState {
  diseaseAlerts: boolean;
  locationAlerts: boolean;
  weeklySummary: boolean;
  accountAlerts: boolean;
}

interface NotificationItem {
  title: string;
  message: string;
  timeLabel: string;
  severity: 'high' | 'medium' | 'info';
  unread: boolean;
}

interface HelpFaqItem {
  question: string;
  answer: string;
  expanded: boolean;
}

interface HelpQuickAction {
  title: string;
  description: string;
  icon: string;
  action: 'reports' | 'history' | 'tips' | 'contact';
}

interface AnalysisRecord {
  id: number;
  disease: string;
  confidence: number;
  uploaded_at?: string;
  date?: string;
  image_url?: string;
  notes?: string;
  filename?: string;
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
  public analysisHistory: AnalysisRecord[] = [];
  public isHistoryLoading = false;
  public historyError = '';
  public selectedHistoryId: number | null = null;
  public profilePhotoDataUrl: string | null = null;
  public profileSettings: ProfileSettingsState = {
    firstName: '',
    lastName: '',
    email: '',
    province: '',
    city: '',
    barangay: ''
  };
  public notificationSettings: NotificationSettingsState = {
    diseaseAlerts: true,
    locationAlerts: true,
    weeklySummary: true,
    accountAlerts: true
  };
  public notificationItems: NotificationItem[] = [];
  public unreadNotifications = 0;
  public helpQuickActions: HelpQuickAction[] = [];
  public helpFaqs: HelpFaqItem[] = [];

  private routeSub?: Subscription;
  private currentLocation: { lat: number; lng: number } | null = null;

  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private toastCtrl = inject(ToastController);

  constructor() {}

  ngOnInit() {
    this.routeSub = this.activatedRoute.paramMap.subscribe((params) => {
      this.folder = params.get('id') ?? '';
      this.loadProfilePhotoFromStorage();

      if (this.folder === 'History') {
        this.loadAnalysisHistory();
        return;
      }

      if (this.folder === 'Reports') {
        this.loadDiseaseHeatmap();
        return;
      }

      if (this.folder === 'Settings') {
        this.loadSettingsData();
        return;
      }

      if (this.folder === 'Help') {
        this.loadHelpData();
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

  updateProfileField(field: keyof ProfileSettingsState, value: string): void {
    this.profileSettings[field] = value;
  }

  async saveProfileSettings(): Promise<void> {
    const profileSettingsToSave = {
      ...this.profileSettings,
      profilePhoto: this.profilePhotoDataUrl,
    };

    localStorage.setItem('profileSettings', JSON.stringify(profileSettingsToSave));

    const userInfoRaw = localStorage.getItem('userInfo');
    if (userInfoRaw) {
      try {
        const userInfo = JSON.parse(userInfoRaw);
        const merged = {
          ...userInfo,
          firstName: this.profileSettings.firstName,
          lastName: this.profileSettings.lastName,
          email: this.profileSettings.email,
          province: this.profileSettings.province,
          city: this.profileSettings.city,
          barangay: this.profileSettings.barangay,
          profilePhoto: this.profilePhotoDataUrl,
        };
        localStorage.setItem('userInfo', JSON.stringify(merged));
      } catch {
        // ignore malformed user info and keep profileSettings state as source of truth
      }
    }

    const fullName = `${this.profileSettings.firstName} ${this.profileSettings.lastName}`.trim();
    if (fullName) {
      localStorage.setItem('userName', fullName);
    }

    await this.presentToast('Profile settings saved.');
  }

  triggerProfilePhotoPicker(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  async onProfilePhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      await this.presentToast('Please select a valid image file.');
      input.value = '';
      return;
    }

    const maxFileSizeBytes = 5 * 1024 * 1024;
    if (selectedFile.size > maxFileSizeBytes) {
      await this.presentToast('Image is too large. Please choose one under 5MB.');
      input.value = '';
      return;
    }

    try {
      this.profilePhotoDataUrl = await this.readFileAsDataUrl(selectedFile);
      await this.presentToast('Profile picture updated. Tap Save Profile Settings to keep it.');
    } catch {
      await this.presentToast('Failed to load selected image. Please try another file.');
    } finally {
      input.value = '';
    }
  }

  async removeProfilePhoto(): Promise<void> {
    this.profilePhotoDataUrl = null;
    await this.presentToast('Profile picture removed. Tap Save Profile Settings to keep it.');
  }

  getProfileInitials(): string {
    const firstInitial = (this.profileSettings.firstName || '').trim().charAt(0);
    const lastInitial = (this.profileSettings.lastName || '').trim().charAt(0);
    const initials = `${firstInitial}${lastInitial}`.trim().toUpperCase();
    return initials || 'MS';
  }

  async onNotificationToggle(field: keyof NotificationSettingsState, checked: boolean): Promise<void> {
    this.notificationSettings[field] = checked;
    localStorage.setItem('notificationSettings', JSON.stringify(this.notificationSettings));
    await this.presentToast('Notification preferences updated.');
  }

  markNotificationsRead(): void {
    this.notificationItems = this.notificationItems.map((item) => ({ ...item, unread: false }));
    this.unreadNotifications = 0;
  }

  toggleHelpFaq(index: number): void {
    this.helpFaqs = this.helpFaqs.map((faq, currentIndex) => {
      if (currentIndex === index) {
        return { ...faq, expanded: !faq.expanded };
      }
      return faq;
    });
  }

  async runHelpAction(action: HelpQuickAction['action']): Promise<void> {
    if (action === 'reports') {
      this.router.navigate(['/folder/Reports']);
      return;
    }

    if (action === 'history') {
      this.router.navigate(['/pages/history']);
      return;
    }

    if (action === 'tips') {
      this.router.navigate(['/folder/Tips']);
      return;
    }

    if (action === 'contact') {
      this.contactSupport();
    }
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  contactSupport(): void {
    const subject = encodeURIComponent('MangoSense Support Request');
    const body = encodeURIComponent(
      'Hi MangoSense Team,\n\nI need help with:\n\n[Please describe your issue]\n\nDevice:\nApp page:\n'
    );
    window.location.href = `mailto:support@mangosense.app?subject=${subject}&body=${body}`;
  }

  private loadSettingsData(): void {
    this.loadProfileSettings();
    this.loadNotificationSettings();
    this.loadNotificationInsights();
  }

  private loadHelpData(): void {
    this.helpQuickActions = [
      {
        title: 'Open Disease Reports',
        description: 'Check hotspots and nearby prevention alerts on the heatmap.',
        icon: 'bar-chart-outline',
        action: 'reports'
      },
      {
        title: 'Review Analysis History',
        description: 'See your previous detections and monitor recurring disease patterns.',
        icon: 'time-outline',
        action: 'history'
      },
      {
        title: 'Read Growing Tips',
        description: 'Follow practical disease-prevention guidance for healthier mango trees.',
        icon: 'bulb-outline',
        action: 'tips'
      },
      {
        title: 'Contact Support',
        description: 'Send your issue details to the MangoSense support team by email.',
        icon: 'mail-outline',
        action: 'contact'
      }
    ];

    this.helpFaqs = [
      {
        question: 'Why is my detection result marked Unknown?',
        answer: 'Unknown appears when the model confidence is too low. Capture a clear, well-lit image focused on a mango leaf or fruit and try again.',
        expanded: true
      },
      {
        question: 'How do I improve location-based disease alerts?',
        answer: 'Enable device location permissions and keep GPS active while opening Reports. Nearby alerts require your current position.',
        expanded: false
      },
      {
        question: 'Why do I not see records in my history?',
        answer: 'Only saved detections linked to your account appear in History. Ensure you are logged in with the same account used during detection.',
        expanded: false
      },
      {
        question: 'How can I report incorrect disease predictions?',
        answer: 'Use the verification/feedback flow after prediction and provide symptom details. This helps improve future model performance.',
        expanded: false
      }
    ];
  }

  private loadProfileSettings(): void {
    const savedProfileRaw = localStorage.getItem('profileSettings');
    const userInfoRaw = localStorage.getItem('userInfo');

    let fromUserInfo: Partial<ProfileSettingsState> = {};
    let fromUserPhoto: string | null = null;
    if (userInfoRaw) {
      try {
        const userInfo = JSON.parse(userInfoRaw);
        fromUserInfo = {
          firstName: userInfo.firstName || userInfo.first_name || '',
          lastName: userInfo.lastName || userInfo.last_name || '',
          email: userInfo.email || '',
          province: userInfo.province || '',
          city: userInfo.city || '',
          barangay: userInfo.barangay || '',
        };
        fromUserPhoto = userInfo.profilePhoto || userInfo.profile_image || null;
      } catch {
        fromUserInfo = {};
        fromUserPhoto = null;
      }
    }

    if (savedProfileRaw) {
      try {
        const saved = JSON.parse(savedProfileRaw);
        const savedPhoto = saved.profilePhoto || null;
        this.profilePhotoDataUrl = savedPhoto || fromUserPhoto;

        this.profileSettings = {
          firstName: saved.firstName ?? fromUserInfo.firstName ?? '',
          lastName: saved.lastName ?? fromUserInfo.lastName ?? '',
          email: saved.email ?? fromUserInfo.email ?? '',
          province: saved.province ?? fromUserInfo.province ?? '',
          city: saved.city ?? fromUserInfo.city ?? '',
          barangay: saved.barangay ?? fromUserInfo.barangay ?? ''
        };
        return;
      } catch {
        // fallback to user info mapping below
      }
    }

    this.profilePhotoDataUrl = fromUserPhoto;

    this.profileSettings = {
      firstName: fromUserInfo.firstName ?? '',
      lastName: fromUserInfo.lastName ?? '',
      email: fromUserInfo.email ?? '',
      province: fromUserInfo.province ?? '',
      city: fromUserInfo.city ?? '',
      barangay: fromUserInfo.barangay ?? ''
    };
  }

  private loadProfilePhotoFromStorage(): void {
    const savedProfileRaw = localStorage.getItem('profileSettings');
    if (savedProfileRaw) {
      try {
        const saved = JSON.parse(savedProfileRaw);
        if (saved.profilePhoto) {
          this.profilePhotoDataUrl = saved.profilePhoto;
          return;
        }
      } catch {
        // Ignore malformed data and fall back to userInfo.
      }
    }

    const userInfoRaw = localStorage.getItem('userInfo');
    if (userInfoRaw) {
      try {
        const userInfo = JSON.parse(userInfoRaw);
        this.profilePhotoDataUrl = userInfo.profilePhoto || userInfo.profile_image || null;
      } catch {
        this.profilePhotoDataUrl = null;
      }
      return;
    }

    this.profilePhotoDataUrl = null;
  }

  private loadNotificationSettings(): void {
    const savedRaw = localStorage.getItem('notificationSettings');
    if (!savedRaw) {
      return;
    }

    try {
      const saved = JSON.parse(savedRaw);
      this.notificationSettings = {
        diseaseAlerts: saved.diseaseAlerts ?? true,
        locationAlerts: saved.locationAlerts ?? true,
        weeklySummary: saved.weeklySummary ?? true,
        accountAlerts: saved.accountAlerts ?? true,
      };
    } catch {
      // keep defaults
    }
  }

  private async loadNotificationInsights(): Promise<void> {
    this.notificationItems = [];

    try {
      const response = await firstValueFrom(
        this.http.get<DiseaseLocationsResponse>(`${environment.apiUrl}/disease-locations/all/`)
      );

      const rawLocations = response?.data?.locations ?? [];
      const diseasedLocations = rawLocations.filter((location) => !this.isHealthyDisease(location.disease || ''));

      const diseaseCounts = new Map<string, number>();
      diseasedLocations.forEach((location) => {
        const disease = (location.disease || 'Unknown').trim();
        diseaseCounts.set(disease, (diseaseCounts.get(disease) ?? 0) + 1);
      });

      const topDisease = Array.from(diseaseCounts.entries()).sort((a, b) => b[1] - a[1])[0];
      const totalCases = diseasedLocations.length;

      const items: NotificationItem[] = [];

      if (this.notificationSettings.diseaseAlerts && topDisease) {
        items.push({
          title: 'Disease hotspot update',
          message: `${topDisease[0]} has ${topDisease[1]} reported case(s). Prioritize orchard checks in affected areas.`,
          timeLabel: 'Today',
          severity: topDisease[1] >= 5 ? 'high' : 'medium',
          unread: true
        });
      }

      if (this.notificationSettings.locationAlerts) {
        items.push({
          title: 'Nearby risk reminders',
          message: 'Enable location services in Reports to receive nearby disease prevention alerts in real time.',
          timeLabel: 'Today',
          severity: 'info',
          unread: true
        });
      }

      if (this.notificationSettings.weeklySummary) {
        items.push({
          title: 'Weekly disease summary',
          message: `${totalCases} diseased detections are currently mapped. Review Reports to monitor trend changes.`,
          timeLabel: 'This week',
          severity: 'info',
          unread: true
        });
      }

      if (this.notificationSettings.accountAlerts) {
        items.push({
          title: 'Profile completion reminder',
          message: 'Keep your location details up to date so disease recommendations can be more relevant to your area.',
          timeLabel: 'This week',
          severity: 'info',
          unread: true
        });
      }

      this.notificationItems = items;
      this.unreadNotifications = items.filter((item) => item.unread).length;
    } catch {
      this.notificationItems = [
        {
          title: 'Notification service unavailable',
          message: 'We could not fetch the latest disease alerts right now. Please try again later.',
          timeLabel: 'Now',
          severity: 'info',
          unread: true
        }
      ];
      this.unreadNotifications = 1;
    }
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 1800,
      position: 'top',
      color: 'success'
    });
    await toast.present();
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

  async loadAnalysisHistory(): Promise<void> {
    this.isHistoryLoading = true;
    this.historyError = '';
    this.analysisHistory = [];

    try {
      const response = await firstValueFrom(
        this.http.get<{ success: boolean; data?: { analyses?: AnalysisRecord[] } }>(
          `${environment.apiUrl}/history/`
        )
      );

      const analyses = response?.data?.analyses ?? [];
      
      // Normalize the data: map 'date' from backend to 'uploaded_at'
      const normalizedAnalyses = analyses.map((record) => ({
        ...record,
        uploaded_at: record.uploaded_at || record.date || new Date().toISOString()
      }));

      this.analysisHistory = normalizedAnalyses
        .sort((a, b) => {
          const dateA = new Date(a.uploaded_at || 0).getTime();
          const dateB = new Date(b.uploaded_at || 0).getTime();
          return dateB - dateA; // Descending order (newest first)
        })
        .slice(0, 20); // Show last 20 records

      if (this.analysisHistory.length === 0) {
        this.historyError = 'No analysis history yet. Start by analyzing your mango trees to build your record.';
      }
    } catch (error) {
      console.error('Failed to load analysis history:', error);
      this.historyError = 'Unable to load your analysis history. Please try again or check your internet connection.';
      this.analysisHistory = [];
    } finally {
      this.isHistoryLoading = false;
    }
  }

  getHistoryItemCssClass(disease: string): string {
    return 'disease-' + disease.toLowerCase().replace(/\s+/g, '-');
  }

  toggleHistoryItemDetails(recordId: number): void {
    this.selectedHistoryId = this.selectedHistoryId === recordId ? null : recordId;
  }

  getDiseaseIcon(disease: string): string {
    const normalized = disease.toLowerCase();
    if (normalized.includes('anthracnose')) return 'alert-circle-outline';
    if (normalized.includes('powdery')) return 'water-outline';
    if (normalized.includes('sooty')) return 'cloud-outline';
    if (normalized.includes('die back')) return 'flashoff-outline';
    if (normalized.includes('stem end') || normalized.includes('black mould')) return 'bug-outline';
    if (normalized.includes('healthy')) return 'checkmark-circle-outline';
    return 'help-circle-outline';
  }

  getDiseaseColor(disease: string): string {
    const normalized = disease.toLowerCase();
    if (normalized.includes('anthracnose')) return '#c23535';
    if (normalized.includes('powdery')) return '#f08a00';
    if (normalized.includes('sooty')) return '#424242';
    if (normalized.includes('die back')) return '#d85f00';
    if (normalized.includes('stem end') || normalized.includes('black mould')) return '#6a4c4c';
    if (normalized.includes('healthy')) return '#457800';
    return '#7a8f79';
  }

  getFormattedDate(dateString: string | undefined): string {
    if (!dateString) return 'Date unavailable';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date unavailable';
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Date unavailable';
    }
  }

  getFormattedTime(dateString: string | undefined): string {
    if (!dateString) return 'Time unavailable';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Time unavailable';
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return 'Time unavailable';
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
          return;
        }
        reject(new Error('Invalid image data'));
      };

      reader.onerror = () => {
        reject(new Error('File read failed'));
      };

      reader.readAsDataURL(file);
    });
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
