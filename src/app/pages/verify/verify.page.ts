import { Component, OnInit } from '@angular/core';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { VerifyPredictionService } from 'src/app/services/prediction';
import { ExifLocationService, LocationConsentResult } from 'src/app/services/exif-location.service';

// our local services for this page
import { VerifySymptomsService, SymptomsData } from './services/verify-symptoms.service';
import { VerifyDetectionService } from './services/verify-detection.service';

@Component({
  selector: 'app-verify',
  standalone: true, 
  imports: [IonicModule, CommonModule, FormsModule],
  templateUrl: './verify.page.html',
  styleUrls: ['./verify.page.scss'],
})
export class VerifyPage implements OnInit {
  userAvatar: string = '';
  imageData: string | null = null;
  detectionType: string | null = null;
  isProcessing = false;
  apiCallFailed = false; // did the api break or not
  
  // minimum confidence we accept
  private readonly CONFIDENCE_THRESHOLD = 30; // 30%

  // what the ai found
  detectionResult: any = null;
  
  // wizard steps stuff
  currentStep: 1 | 2 | 3 | 4 = 1;
  totalSteps: number = 4;
  
  // form stuff
  isDetectionCorrect: string | null = 'true'; // default yeah its correct
  locationAccuracyConfirmed: string | null = null; // user says if location is right
  userFeedback: string = '';

  // what we show at the end
  detectedDisease = '';
  confidence = 0;
  symptoms: string[] = []; // main symptoms
  
  // top 3 guesses from ai
  topDiseases: any[] = [];
  alternativeSymptoms: string[] = [];
  selectedSymptoms: boolean[] = [];
  selectedAlternativeSymptoms: boolean[] = [];
  
  // all symptoms together
  allSymptoms: string[] = []; // both types combined
  allSelectedSymptoms: boolean[] = []; // checkboxes for everything
  showMoreOptions: boolean = false;
  // where they are
  detectedLocation: any = null;

  // iframe map (srcdoc – self-contained Leaflet HTML so markers work)
  mapSrcdoc: SafeHtml | null = null;
  isMapFullscreen = false;

  // disease location results
  isLoadingLocations = false;
  activeDiseaseFilter: 'similar' | 'all' | null = null;
  diseaseLocations: any[] = [];

  // gate validation — did the backend say its not a mango?
  gateRejected = false;
  gateRejectionMessage = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private verifyPredictionService: VerifyPredictionService,
    private exifLocationService: ExifLocationService,
    // our helpers
    private symptomsService: VerifySymptomsService,
    private detectionService: VerifyDetectionService,
    private sanitizer: DomSanitizer
  ) {}

  ionViewWillEnter() {
    this.loadUserAvatar();
  }

  private loadUserAvatar(): void {
    const profileSettingsRaw = localStorage.getItem('profileSettings');
    if (profileSettingsRaw) {
      try {
        const profileSettings = JSON.parse(profileSettingsRaw);
        this.userAvatar = profileSettings.profilePhoto || '';
      } catch {
        this.userAvatar = '';
      }
    }

    const userData = localStorage.getItem('userInfo') || localStorage.getItem('user_data');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.userAvatar = user.profilePhoto || user.profile_image || user.avatar || user.profileImage || this.userAvatar || '';
      } catch {
        // keep fallback avatar value
      }
    }
  }

  /** Escape a string for use inside a JS single-quoted string literal */
  private escapeJs(s: string): string {
    return (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3c').replace(/\r?\n/g, ' ');
  }

  /**
   * Build a self-contained Leaflet HTML page and bind it to the iframe via srcdoc.
   * Called on first location detect and again whenever disease markers change.
   */
  buildMapSrcdoc(
    diseaseLocations: any[] = [],
    filterType: 'similar' | 'all' | null = null
  ) {
    if (!this.detectedLocation) { this.mapSrcdoc = null; return; }

    const lat = this.detectedLocation.latitude;
    const lng = this.detectedLocation.longitude;
    const addr = this.escapeJs(this.detectedLocation.address || '');

    // ── current-location marker (green) ──────────────────────────
    let markersJs = `
      var curIcon = L.divIcon({
        html: '<div style="width:18px;height:18px;background:#457800;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
        className:'', iconSize:[18,18], iconAnchor:[9,9], popupAnchor:[0,-12]
      });
      L.marker([${lat},${lng}],{icon:curIcon})
        .bindPopup('<b>Your location</b><br>${addr}')
        .addTo(map);
    `;

    // ── disease markers ───────────────────────────────────────────
    const boundsArr: number[][] = [[lat, lng]];
    if (diseaseLocations.length > 0) {
      const color = filterType === 'similar' ? '#e67e00' : '#1a73e8';
      diseaseLocations.forEach(loc => {
        const name    = this.escapeJs(loc.disease || 'Unknown');
        const locAddr = this.escapeJs(loc.address  || 'Unknown location');
        const conf    = loc.confidence != null
          ? ` (${this.formatConfidence(loc.confidence)}%)` : '';
        markersJs += `
          var dIcon${boundsArr.length} = L.divIcon({
            html: '<div style="width:16px;height:16px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
            className:'', iconSize:[16,16], iconAnchor:[8,8], popupAnchor:[0,-10]
          });
          L.marker([${loc.latitude},${loc.longitude}],{icon:dIcon${boundsArr.length}})
            .bindPopup('<b>${name}${this.escapeJs(conf)}</b><br>${locAddr}')
            .addTo(map);
        `;
        boundsArr.push([loc.latitude, loc.longitude]);
      });
      // fit map to show all markers
      markersJs += `map.fitBounds(${JSON.stringify(boundsArr)},{padding:[30,30]});`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    var map = L.map('map').setView([${lat},${lng}],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'&copy; OpenStreetMap contributors',maxZoom:19
    }).addTo(map);
    ${markersJs}
  </script>
</body>
</html>`;

    this.mapSrcdoc = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  toggleMapFullscreen() {
    this.isMapFullscreen = !this.isMapFullscreen;
  }

  openMapExternal() {
    if (!this.detectedLocation) return;
    const { latitude: lat, longitude: lng } = this.detectedLocation;
    window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`, '_blank');
  }

  /** Show markers for detections that share the same primary disease */
  async showSimilarDisease() {
    if (!this.detectedDisease || this.detectedDisease === 'Unknown') {
      this.showToast('No disease detected to compare against.', 'warning');
      return;
    }
    this.isLoadingLocations = true;
    try {
      const url = `${environment.apiUrl}/disease-locations/similar/?disease=${encodeURIComponent(this.detectedDisease)}`;
      const resp: any = await this.http.get(url).toPromise();
      this.diseaseLocations = resp?.data?.locations ?? [];
      this.activeDiseaseFilter = 'similar';
      this.buildMapSrcdoc(this.diseaseLocations, 'similar');
      if (this.diseaseLocations.length === 0) {
        this.showToast('No similar disease locations found.', 'warning');
      } else {
        this.showToast(`Found ${this.diseaseLocations.length} similar disease location(s).`, 'success');
      }
    } catch (err) {
      this.showToast('Failed to load disease locations.', 'danger');
    } finally {
      this.isLoadingLocations = false;
    }
  }

  /** Show all stored disease detections */
  async showAllDiseases() {
    this.isLoadingLocations = true;
    try {
      const url = `${environment.apiUrl}/disease-locations/all/`;
      const resp: any = await this.http.get(url).toPromise();
      this.diseaseLocations = resp?.data?.locations ?? [];
      this.activeDiseaseFilter = 'all';
      this.buildMapSrcdoc(this.diseaseLocations, 'all');
      if (this.diseaseLocations.length === 0) {
        this.showToast('No disease locations recorded yet.', 'warning');
      } else {
        this.showToast(`Found ${this.diseaseLocations.length} detection(s).`, 'success');
      }
    } catch (err) {
      this.showToast('Failed to load disease locations.', 'danger');
    } finally {
      this.isLoadingLocations = false;
    }
  }

  /** Clear disease location results and reset map to just current location */
  clearDiseaseMarkers() {
    this.diseaseLocations = [];
    this.activeDiseaseFilter = null;
    this.buildMapSrcdoc(); // rebuild with only the current-location pin
  }

  /** Format confidence for display */
  formatConfidence(val: number | null): number {
    if (val == null) return 0;
    return Math.round(val <= 1 ? val * 100 : val);
  }
  
  // setup the big symptoms arrays after we got em
  private initializeUnifiedSymptoms() {
    // mash em together
    this.allSymptoms = [...this.symptoms, ...this.alternativeSymptoms];
    
    // make checkboxes for all
    this.allSelectedSymptoms = new Array(this.allSymptoms.length).fill(false);
  }

  toggleMoreOptions() {
    this.showMoreOptions = !this.showMoreOptions;
  }

  // when user clicks a symptom checkbox
  onSymptomChange(index: number, event: any) {
    this.selectedSymptoms[index] = event.detail.checked;
    
    // flip back to correct if they start checking stuff
    if (event.detail.checked && this.isDetectionCorrect === 'false') {
      this.isDetectionCorrect = 'true';
    }
  }

  // when they click alternative ones
  onAlternativeSymptomChange(index: number, event: any) {
    // offset cuz alternatives come after main ones
    const unifiedIndex = this.symptoms.length + index;
    this.allSelectedSymptoms[unifiedIndex] = event.detail.checked;
    
    // same deal flip back if checking stuff
    if (event.detail.checked && this.isDetectionCorrect === 'false') {
      this.isDetectionCorrect = 'true';
    }
  }

  ngOnInit() {
    this.loadUserAvatar();

    // empty array for now, fill it later
    this.allSelectedSymptoms = [];
    
    const nav = window.history.state;
    
    this.imageData = nav.image || null;
    this.detectionType = nav.detectionType || null;
    
    
    if (!this.imageData) {
      this.showToast('No image provided. Please take or select a photo.', 'warning');
      this.goBack();
    } else {
      // call the ai
      this.getDetectionResult();
      // try to get gps stuff
      this.detectLocationWithPermission();
    }
  }

  private async getDetectionResult() {
    if (!this.imageData) return;
    
    const loading = await this.loadingCtrl.create({
      message: 'Analyzing image...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // turn base64 into a real file
      const base64 = this.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'image.jpg', { type: 'image/jpeg' });

      // send to ai (just preview dont save yet)
      this.detectionResult = await this.verifyPredictionService.previewPrediction(
        file, 
        (this.detectionType as 'fruit' | 'leaf')
      );

      // =====================================================
      // GATE VALIDATION CHECK
      // If the backend gate model says this isn't a mango
      // leaf/fruit, stop here and tell the user
      // =====================================================
      const gateValidation = this.detectionResult?.data?.gate_validation;
      if (gateValidation && gateValidation.passed === false) {
        this.gateRejected = true;
        this.apiCallFailed = true;
        this.gateRejectionMessage = `This is not a mango ${this.detectionType}`;
        this.detectedDisease = `Not a Mango ${this.detectionType === 'fruit' ? 'Fruit' : 'Leaf'}`;
        this.confidence = 0;
        this.symptoms = [];
        this.topDiseases = [];
        this.alternativeSymptoms = [];
        this.selectedSymptoms = [];
        this.selectedAlternativeSymptoms = [];
        this.initializeUnifiedSymptoms();
        await loading.dismiss();
        this.showToast(
          `This is not a mango ${this.detectionType}. Please upload a valid image.`,
          'warning'
        );
        return;
      }

      // gate passed (or no gate model) — proceed with disease results

      // grab top 3 diseases
      if (this.detectionResult.data && this.detectionResult.data.predictions) {
        this.topDiseases = this.detectionResult.data.predictions.slice(0, 3);
      } else if (this.detectionResult.predictions) {
        this.topDiseases = this.detectionResult.predictions.slice(0, 3);
      } else {
        // no predictions array so make one from what we got
        this.topDiseases = [];
        
        // try to find the main disease
        const primaryDisease = this.detectionResult.predicted_disease || 
                              this.detectionResult.disease || 
                              (this.detectionResult.data && this.detectionResult.data.primary_prediction && this.detectionResult.data.primary_prediction.disease);
                              
        if (primaryDisease) {
          this.topDiseases.push({
            disease: primaryDisease,
            predicted_disease: primaryDisease,
            confidence: this.detectionResult.confidence || 
                       (this.detectionResult.data && this.detectionResult.data.primary_prediction && this.detectionResult.data.primary_prediction.confidence_score) || 0
          });
          
          // throw in some other common diseases too
          // can change this list later
          const commonAlternatives = ['Anthracnose', 'Bacterial Canker', 'Powdery Mildew', 'Die Back', 'Sooty Mould'];
          const filteredAlternatives = commonAlternatives.filter(disease => disease !== primaryDisease);
          
          // add 2 more with fake lower confidence
          filteredAlternatives.slice(0, 2).forEach((disease, index) => {
            this.topDiseases.push({
              disease: disease,
              predicted_disease: disease,
              confidence: Math.max(10, (this.confidence || 50) - 20 - (index * 10))
            });
          });
        }
        
      }

      // get the results with threshold check
      // handles different response formats
      let rawDisease = '';
      let confidenceValue: number = 0;
      
      if (this.detectionResult.data && this.detectionResult.data.primary_prediction) {
        // newer response format
        const prediction = this.detectionResult.data.primary_prediction;
        rawDisease = prediction.disease || '';
        confidenceValue = prediction.confidence_score || 0;
      } else {
        // old format maybe
        rawDisease = this.detectionResult.predicted_disease || this.detectionResult.disease || '';
        const rawConfidence = this.detectionResult.confidence;
        
        // handle diff confidence formats ugh
        if (typeof rawConfidence === 'string' && rawConfidence.includes('%')) {
          confidenceValue = parseFloat(rawConfidence.replace('%', ''));
        } else if (typeof rawConfidence === 'number') {
          if (rawConfidence <= 1) {
            // its decimal like 0.45 so multiply
            confidenceValue = rawConfidence * 100;
          } else {
            // already good as is
            confidenceValue = rawConfidence;
          }
        } else {
          confidenceValue = 0;
        }
      }
      
      this.confidence = Math.round(confidenceValue);
      
      // if too low confidence call it unknown
      if (this.confidence < this.CONFIDENCE_THRESHOLD) {
        this.detectedDisease = 'Unknown';
      } else {
        this.detectedDisease = rawDisease || 'Unknown';
      }
      
      // get symptoms for whatever disease we found
      this.symptoms = this.getDiseaseSymptoms(this.detectedDisease);
      
      // grab more symptoms from runner ups
      this.extractAlternativeSymptoms();
      
      // setup the big arrays
      this.initializeUnifiedSymptoms();
      
      this.gateRejected = false;
      this.gateRejectionMessage = '';
      this.apiCallFailed = false; // yay it worked
      
      
    } catch (error) {
      console.error('Detection failed:', error);
      this.showToast('Failed to analyze image. Please try again.', 'danger');
      
      // dont fake it just tell em it broke
      this.detectedDisease = '';
      this.confidence = 0;
      this.apiCallFailed = true; // rip
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * get location with permission stuff
   */
  private async detectLocationWithPermission() {
    try {
      if (!this.imageData) return;
      
      // exif extraction is broken rn so just use device
      
      // see if browser can do geolocation
      if (!navigator.geolocation) {
        return;
      }

      // check if we got permission
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          
          if (permission.state === 'denied') {
            this.showToast('Location access is denied. You can still use the app without location.', 'warning');
            return;
          }
        } catch (permError) {
        }
      }
      
      try {
        const deviceLocation = await this.getCurrentDeviceLocation();
        if (deviceLocation) {
          this.detectedLocation = deviceLocation;
          this.buildMapSrcdoc();
          this.showToast(`Location detected: ${deviceLocation.address.split(',')[0]}`, 'success');
        }
      } catch (error) {
        
        if (error instanceof GeolocationPositionError) {
          let message = '';
          switch (error.code) {
            case 1:
              message = 'Location access denied. You can continue without location data.';
              break;
            case 2:
              message = 'Location unavailable. Please check your connection.';
              break;
            case 3:
              message = 'Location request timed out. Continuing without location.';
              break;
            default:
              message = 'Unable to get location. Continuing without location data.';
          }
        }
      }
      
      // TODO maybe fix exif later idk
      
    } catch (error) {
    }
  }

  private async getCurrentDeviceLocation(): Promise<any> {
    console.log("im here")
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation not supported');
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          
          // Get actual address from coordinates
          const address = await this.reverseGeocode(position.coords.latitude, position.coords.longitude);
          
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            address: address || `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
            source: 'device gps',
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          reject(error);
        },
        { 
          timeout: 15000, 
          enableHighAccuracy: true, 
          maximumAge: 300000 // 5 minutes cache
        }
      );
    });
  }

  /**
   * turn lat/long into actual address
   */
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      // free api no key needed yay
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Mangosense-App/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.display_name) {
        // make it readable
        const address = data.address;
        if (address) {
          const parts = [];
          
          // build address parts
          if (address.house_number) parts.push(address.house_number);
          if (address.road) parts.push(address.road);
          if (address.village) parts.push(address.village);
          if (address.town) parts.push(address.town);
          if (address.city) parts.push(address.city);
          if (address.municipality) parts.push(address.municipality);
          if (address.province) parts.push(address.province);
          if (address.state) parts.push(address.state);
          if (address.country) parts.push(address.country);
          
          if (parts.length > 0) {
            return parts.slice(0, 3).join(', '); // just first 3 cuz too long otherwise
          }
        }
        
        // use full name if parsing didnt work
        return data.display_name;
      }
      
      throw new Error('No address found');
      
    } catch (error) {
      
      // try backup service or just show coords
      try {
        // different api as backup
        const fallbackResponse = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
        );
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData && fallbackData.city && fallbackData.principalSubdivision) {
            return `${fallbackData.city}, ${fallbackData.principalSubdivision}, ${fallbackData.countryName}`;
          }
        }
      } catch (fallbackError) {
        console.error('Fallback geocoding also failed:', fallbackError);
      }
      
      // whatever just show numbers
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  goBack() {
    this.router.navigate(['/pages/home'], { replaceUrl: true, queryParams: { refresh: Date.now() } });
  }

  // go forward or back thru wizard
  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep = (this.currentStep + 1) as 1 | 2 | 3 | 4;
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as 1 | 2 | 3 | 4;
    }
  }

  canProceedToNextStep(): boolean {
    switch (this.currentStep) {
      case 1: // symptoms step
        // need to pick detection and check symptoms
        if (this.isDetectionCorrect === null) {
          return false; // gotta say yes or no first
        }
        
        if (this.isDetectionCorrect === 'false') {
          return true; // if they said no can skip symptoms
        }
        
        // otherwise need at least 1 symptom
        const hasPrimarySymptoms = this.selectedSymptoms.some(selected => selected);
        const hasAlternativeSymptoms = this.selectedAlternativeSymptoms.some(selected => selected);
        return hasPrimarySymptoms || hasAlternativeSymptoms;
        
      case 2: // location step
        return this.locationAccuracyConfirmed !== null;
      case 3: // notes - whatever
        return true; // Optional step
      case 4: // done
        return true;
      default:
        return false;
    }
  }

  getStepTitle(): string {
    switch (this.currentStep) {
      case 1:
        return 'Symptom Detection';
      case 2:
        return 'Location Information';
      case 3:
        return 'Additional Comments';
      case 4:
        return 'Confirm & Analyze';
      default:
        return 'Verification';
    }
  }

  // get symptoms for the disease
  


  getDiseaseSymptoms(disease: string): string[] {
    // ask service for symptoms
    return this.detectionService.getDiseaseSymptoms(disease, this.detectionType as 'fruit' | 'leaf');
  }

  onDetectionChange(event: any) {
    this.isDetectionCorrect = event.detail.value;
  }

  // click no button
  setDetectionIncorrect() {
    this.isDetectionCorrect = 'false';
    
    // uncheck everything when they say no
    this.selectedSymptoms = new Array(this.symptoms.length).fill(false);
    this.selectedAlternativeSymptoms = new Array(this.alternativeSymptoms.length).fill(false);
  }

  onLocationChange(event: any) {
    this.locationAccuracyConfirmed = event.detail.value;
  }

  async confirm() {
    if (!this.imageData) {
      this.showToast('No image to process.', 'warning');
      return;
    }
    
    if (!this.isDetectionCorrect) {
      this.showToast('Please verify the detection result first.', 'warning');
      return;
    }
    
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    let loading: any = null;
    
    try {
      
      // location consent already given at signup
      // just checking if detected spot is accurate
      const locationConsentResult: LocationConsentResult = {
        consentGiven: true, // always yes cuz signup
        locationData: this.detectedLocation,
        locationAccuracyConfirmed: this.locationAccuracyConfirmed === 'true' // is the spot right
      };
      
      // show spinner while saving
      loading = await this.loadingCtrl.create({ 
        message: 'Saving analysis...',
        spinner: 'crescent'
      });
      await loading.present();
      
      // ok now actually save it
      
      const base64 = this.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'image.jpg', { type: 'image/jpeg' });
      
      // get all checked symptoms for api
      const symptomsData = this.prepareSymptomsDataForAPI();
      
      
      // send to server
      const finalResult = await this.verifyPredictionService.savePredictionWithVerification(
        file,
        (this.detectionType as 'fruit' | 'leaf'),
        {
          isDetectionCorrect: this.isDetectionCorrect === 'true',
          userFeedback: this.userFeedback || undefined,
          selectedSymptoms: symptomsData.allSelectedSymptoms, // all ticked symptoms
          primarySymptoms: symptomsData.selectedPrimarySymptoms, // main ones
          alternativeSymptoms: symptomsData.selectedAlternativeSymptoms, // extra ones
          detectedDisease: this.detectedDisease,
          topDiseases: this.topDiseases, // top 3 for reference
          confidence: this.confidence,
          
          // all the symptoms info
          symptomsData: symptomsData
        } as any, // use any cuz types are weird
        locationConsentResult.locationData, // gps stuff
        locationConsentResult.locationAccuracyConfirmed // did they confirm location
      );
      
      if (loading) {
        await loading.dismiss();
        loading = null;
      }
      this.isProcessing = false;
      
      
      // go to results page with all the data
      this.router.navigate(['/pages/results'], { 
        state: { 
          result: finalResult,
          image: this.imageData,
          userVerification: {
            isDetectionCorrect: this.isDetectionCorrect === 'true',
            userFeedback: this.userFeedback,
            locationAccuracyConfirmed: this.locationAccuracyConfirmed === 'true',
            selectedSymptoms: symptomsData.allSelectedSymptoms,
            primarySymptoms: symptomsData.selectedPrimarySymptoms,
            alternativeSymptoms: symptomsData.selectedAlternativeSymptoms,
            symptomsData: symptomsData
          },
          locationConsentGiven: locationConsentResult.consentGiven,
          detectedDisease: this.detectedDisease,
          confidence: this.confidence,
          topDiseases: this.topDiseases
        } 
      });
      
    } catch (error) {
      if (loading) {
        await loading.dismiss();
      }
      this.isProcessing = false;
      console.error('Verification saving error:', error);
      
      let errorMessage = 'Failed to save verification. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('connect')) {
          errorMessage = 'Cannot connect to server. Please check your connection.';
        } else if (error.message.includes('format') || error.message.includes('415')) {
          errorMessage = 'Image format not supported. Please try a different image.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error. Please try again later.';
        }
      }
      
      this.showToast(errorMessage, 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'danger') {
    const toast = await this.toastCtrl.create({ 
      message, 
      duration: 3000, 
      color,
      position: 'top',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  // get checked main symptoms
  getSelectedSymptoms(): string[] {
    return this.symptoms.filter((_, i) => this.selectedSymptoms[i]);
  }

  // get checked primary symptoms via service
  getSelectedPrimarySymptoms(): string[] {
    return this.symptomsService.getSelectedPrimarySymptoms(
      this.symptoms,
      this.selectedSymptoms
    );
  }

  // get checked alt symptoms via service
  getSelectedAlternativeSymptoms(): string[] {
    return this.symptomsService.getSelectedAlternativeSymptoms(
      this.alternativeSymptoms,
      this.selectedAlternativeSymptoms
    );
  }

  // grab symptoms from 2nd and 3rd disease guesses
  // grabs from runner up diseases using service
  private extractAlternativeSymptoms() {
    const result = this.symptomsService.extractAlternativeSymptoms(
      this.topDiseases,
      (disease: string) => this.detectionService.getDiseaseSymptoms(disease,this.detectionType as 'fruit' | 'leaf')
    );
    
    this.alternativeSymptoms = result.symptoms;
    this.selectedAlternativeSymptoms = result.selectionArray;
  }

  // get everything thats checked using service
  getAllSelectedSymptoms(): string[] {
    return this.symptomsService.getAllSelectedSymptoms(
      this.symptoms,
      this.selectedSymptoms,
      this.alternativeSymptoms,
      this.selectedAlternativeSymptoms
    );
  }

  // package symptoms for backend
  prepareSymptomsDataForAPI(): SymptomsData {
    return this.symptomsService.prepareSymptomsDataForAPI(
      this.detectedDisease,
      this.confidence,
      this.symptoms,
      this.selectedSymptoms,
      this.alternativeSymptoms,
      this.selectedAlternativeSymptoms,
      this.topDiseases,
      this.isDetectionCorrect,
      this.userFeedback
    );
  }
}