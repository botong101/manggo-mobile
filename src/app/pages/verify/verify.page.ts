import { Component, OnInit } from '@angular/core';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ApiService } from 'src/app/services/apiservice.service';
import { ExifLocationService, LocationConsentResult } from 'src/app/services/exif-location.service';

// Local verify component services
import { VerifySymptomsService, SymptomsData } from './services/verify-symptoms.service';
import { VerifyDetectionService } from './services/verify-detection.service';
import { VerifyWorkflowService } from './services/verify-workflow.service';
import { VerifyUtilsService } from './services/verify-utils.service';

@Component({
  selector: 'app-verify',
  standalone: true, 
  imports: [IonicModule, CommonModule, FormsModule],
  templateUrl: './verify.page.html',
  styleUrls: ['./verify.page.scss'],
})
export class VerifyPage implements OnInit {
  imageData: string | null = null;
  detectionType: string | null = null;
  isProcessing = false;
  apiCallFailed = false; // Track if initial API call failed
  
  // Confidence threshold for reliable detection
  private readonly CONFIDENCE_THRESHOLD = 30; // 30% minimum confidence

  // Detection result from initial API call
  detectionResult: any = null;
  
  // Step-by-step workflow
  currentStep: 1 | 2 | 3 | 4 = 1;
  totalSteps: number = 4;
  
  // Form fields
  isDetectionCorrect: string | null = 'true'; // Default to true - symptoms are correct by default
  locationAccuracyConfirmed: string | null = null; // Changed from locationConsentGiven - this is about confirming accuracy
  userFeedback: string = '';

  // Detection result (only shown at final step)
  detectedDisease = '';
  confidence = 0;
  symptoms: string[] = []; // Primary symptoms
  
  // Top 3 diseases from API
  topDiseases: any[] = [];
  alternativeSymptoms: string[] = [];
  selectedSymptoms: boolean[] = [];
  selectedAlternativeSymptoms: boolean[] = [];
  
  // Unified symptoms management
  allSymptoms: string[] = []; // Combined primary + alternative symptoms
  allSelectedSymptoms: boolean[] = []; // Single selection array for all symptoms
  showMoreOptions: boolean = false;
  // Location data
  detectedLocation: any = null;

  constructor(
    private router: Router,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private apiService: ApiService,
    private exifLocationService: ExifLocationService,
    // Local verify component services
    private symptomsService: VerifySymptomsService,
    private detectionService: VerifyDetectionService,
    private workflowService: VerifyWorkflowService,
    private utilsService: VerifyUtilsService
  ) {}
  showMoreSymptoms: boolean = false;

  toggleMoreSymptoms() {
    this.showMoreSymptoms = !this.showMoreSymptoms;
  }
  
  // Initialize unified symptoms arrays after symptoms and alternative symptoms are loaded
  private initializeUnifiedSymptoms() {
    // Combine all symptoms into one array
    this.allSymptoms = [...this.symptoms, ...this.alternativeSymptoms];
    
    // Initialize selection array for all symptoms
    this.allSelectedSymptoms = new Array(this.allSymptoms.length).fill(false);
    
    console.log('🔄 Unified symptoms initialized:', {
      primaryCount: this.symptoms.length,
      alternativeCount: this.alternativeSymptoms.length,
      totalCount: this.allSymptoms.length
    });
  }

  toggleMoreOptions() {
    this.showMoreOptions = !this.showMoreOptions;
  }

  // Handle symptom checkbox changes
  onSymptomChange(index: number, event: any) {
    this.selectedSymptoms[index] = event.detail.checked;
    
    // If user starts checking symptoms after setting detection to incorrect, reset to correct
    if (event.detail.checked && this.isDetectionCorrect === 'false') {
      this.isDetectionCorrect = 'true';
      console.log('Detection reset to correct because user started checking symptoms');
    }
  }

  // Handle alternative symptom checkbox changes
  onAlternativeSymptomChange(index: number, event: any) {
    // Alternative symptoms start after primary symptoms in the unified array
    const unifiedIndex = this.symptoms.length + index;
    this.allSelectedSymptoms[unifiedIndex] = event.detail.checked;
    
    // If user starts checking symptoms after setting detection to incorrect, reset to correct
    if (event.detail.checked && this.isDetectionCorrect === 'false') {
      this.isDetectionCorrect = 'true';
      console.log('Detection reset to correct because user started checking alternative symptoms');
    }
  }
  ngOnInit() {
    // Initialize unified symptoms selection array - will be properly sized after symptoms are loaded
    this.allSelectedSymptoms = [];
    
    console.log('🔍 VerifyPage ngOnInit - checking navigation state...');
    const nav = window.history.state;
    console.log('📊 Navigation state received:', nav);
    
    this.imageData = nav.image || null;
    this.detectionType = nav.detectionType || null;
    
    console.log('📋 Extracted data:', { 
      hasImage: !!this.imageData, 
      detectionType: this.detectionType 
    });
    
    if (!this.imageData) {
      console.log('❌ No image data found in navigation state');
      this.showToast('No image provided. Please take or select a photo.', 'warning');
      this.goBack();
    } else {
      console.log('✅ Image data found, proceeding with analysis...');
      // Get actual AI detection result from API
      this.getDetectionResult();
      // Try to detect location from image
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
      // Convert base64 to File for API call (only once)
      const base64 = this.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'image.jpg', { type: 'image/jpeg' });

      // Single API call for prediction preview (no database save)
      console.log('🔍 Making preview prediction call (no database save)...');
      this.detectionResult = await this.apiService.previewPrediction(
        file, 
        (this.detectionType as 'fruit' | 'leaf') || 'leaf'
      );

      // Extract top 3 diseases if available
      if (this.detectionResult.data && this.detectionResult.data.predictions) {
        this.topDiseases = this.detectionResult.data.predictions.slice(0, 3);
        console.log('🔍 Extracted top diseases from data.predictions:', this.topDiseases);
      } else if (this.detectionResult.predictions) {
        this.topDiseases = this.detectionResult.predictions.slice(0, 3);
        console.log('🔍 Extracted top diseases from predictions:', this.topDiseases);
      } else {
        // If no predictions array, create one from the single prediction
        console.log('🔍 No predictions array found. Creating from single prediction.');
        this.topDiseases = [];
        
        // Try to get the primary prediction
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
          
          // Add some common alternative diseases for demonstration
          // You can modify this list based on your domain knowledge
          const commonAlternatives = ['Anthracnose', 'Bacterial Canker', 'Powdery Mildew', 'Die Back', 'Sooty Mould'];
          const filteredAlternatives = commonAlternatives.filter(disease => disease !== primaryDisease);
          
          // Add up to 2 alternatives with lower confidence
          filteredAlternatives.slice(0, 2).forEach((disease, index) => {
            this.topDiseases.push({
              disease: disease,
              predicted_disease: disease,
              confidence: Math.max(10, (this.confidence || 50) - 20 - (index * 10))
            });
          });
        }
        
        console.log('🔍 Created top diseases from single prediction:', this.topDiseases);
      }

      // Extract the detection results with confidence threshold
      // Handle both direct response and nested response formats
      let rawDisease = '';
      let confidenceValue: number = 0;
      
      if (this.detectionResult.data && this.detectionResult.data.primary_prediction) {
        // Nested API response format
        const prediction = this.detectionResult.data.primary_prediction;
        rawDisease = prediction.disease || '';
        confidenceValue = prediction.confidence_score || 0;
        console.log('📊 Using nested API response format:', { disease: rawDisease, confidence: confidenceValue });
      } else {
        // Direct API response format (fallback)
        rawDisease = this.detectionResult.predicted_disease || this.detectionResult.disease || '';
        const rawConfidence = this.detectionResult.confidence;
        
        // Handle different confidence formats
        if (typeof rawConfidence === 'string' && rawConfidence.includes('%')) {
          confidenceValue = parseFloat(rawConfidence.replace('%', ''));
        } else if (typeof rawConfidence === 'number') {
          if (rawConfidence <= 1) {
            // If confidence is a decimal (0.4558), convert to percentage
            confidenceValue = rawConfidence * 100;
          } else {
            // Already a percentage
            confidenceValue = rawConfidence;
          }
        } else {
          confidenceValue = 0;
        }
        console.log('📊 Using direct API response format:', { disease: rawDisease, confidence: confidenceValue });
      }
      
      this.confidence = Math.round(confidenceValue);
      
      // Apply confidence threshold - use "Unknown" if below threshold
      if (this.confidence < this.CONFIDENCE_THRESHOLD) {
        this.detectedDisease = 'Unknown';
        console.log(`🤔 Low confidence (${this.confidence}%) - showing as Unknown (threshold: ${this.CONFIDENCE_THRESHOLD}%)`);
      } else {
        this.detectedDisease = rawDisease || 'Unknown';
        console.log(`✅ High confidence (${this.confidence}%) - showing: ${this.detectedDisease} (threshold: ${this.CONFIDENCE_THRESHOLD}%)`);
      }
      
      // Extract symptoms for the detected disease (or generic symptoms for Unknown)
      this.symptoms = this.getDiseaseSymptoms(this.detectedDisease);
      
      // Extract alternative symptoms from top 2 and 3 diseases
      this.extractAlternativeSymptoms();
      
      // Initialize unified symptoms arrays
      this.initializeUnifiedSymptoms();
      
      this.apiCallFailed = false; // API call succeeded
      
      console.log('✅ Initial detection result:', { 
        disease: this.detectedDisease, 
        confidence: this.confidence,
        rawDisease: rawDisease,
        threshold: this.CONFIDENCE_THRESHOLD,
        result: this.detectionResult 
      });
      
    } catch (error) {
      console.error('❌ Detection failed:', error);
      this.showToast('Failed to analyze image. Please try again.', 'danger');
      
      // Don't set fallback values - let user know API failed
      this.detectedDisease = '';
      this.confidence = 0;
      this.apiCallFailed = true; // Mark API call as failed
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Enhanced location detection with proper permission handling
   */
  private async detectLocationWithPermission() {
    try {
      if (!this.imageData) return;
      
      // Since EXIF extraction is temporarily disabled, try device location
      console.log('📍 Starting location detection...');
      
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        console.log('📍 Geolocation not supported by this browser');
        return;
      }

      // Check current permission status
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          console.log('📍 Geolocation permission status:', permission.state);
          
          if (permission.state === 'denied') {
            console.log('📍 Location permission is denied');
            this.showToast('Location access is denied. You can still use the app without location.', 'warning');
            return;
          }
        } catch (permError) {
          console.log('📍 Permission query failed:', permError);
        }
      }
      
      try {
        const deviceLocation = await this.getCurrentDeviceLocation();
        if (deviceLocation) {
          this.detectedLocation = deviceLocation;
          console.log('📍 Using device location:', this.detectedLocation);
          this.showToast(`Location detected: ${deviceLocation.address.split(',')[0]}`, 'success');
        }
      } catch (error) {
        console.log('📍 Device location failed:', error);
        
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
          console.log('📍 ' + message);
        }
      }
      
      // TODO: Re-enable EXIF extraction when library is fixed
      
    } catch (error) {
      console.error('📍 Location detection failed:', error);
    }
  }

  private async detectLocation() {
    try {
      if (!this.imageData) return;
      
      // Since EXIF extraction is temporarily disabled, try device location
      console.log('📍 EXIF extraction is disabled, trying device location...');
      
      try {
        const deviceLocation = await this.getCurrentDeviceLocation();
        if (deviceLocation) {
          this.detectedLocation = deviceLocation;
          console.log('📍 Using device location:', this.detectedLocation);
        }
      } catch (error) {
        console.log('📍 Device location failed:', error);
        // Show user-friendly message for location permission
        if (error instanceof GeolocationPositionError) {
          if (error.code === 1) {
            console.log('📍 Location permission denied by user');
          } else if (error.code === 2) {
            console.log('📍 Location unavailable');
          } else if (error.code === 3) {
            console.log('📍 Location timeout');
          }
        }
      }
      
      // TODO: Re-enable EXIF extraction when library is fixed
      /*
      const base64 = this.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'image.jpg', { type: 'image/jpeg' });

      const locationResult = await this.exifLocationService.requestLocationConsentWithExif(file);
      
      if (locationResult.locationData && locationResult.locationData.hasGps) {
        this.detectedLocation = {
          latitude: locationResult.locationData.latitude,
          longitude: locationResult.locationData.longitude,
          address: locationResult.locationData.address,
          source: 'image exif'
        };
        console.log('📍 Location detected from image EXIF:', this.detectedLocation);
      }
      */
      
    } catch (error) {
      console.error('📍 Location detection failed:', error);
    }
  }

  private async getCurrentDeviceLocation(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation not supported');
        return;
      }

      console.log('📍 Requesting device location permission...');
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('📍 Device location obtained:', position.coords);
          
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
          console.error('📍 Device location error:', error);
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
   * Convert latitude and longitude to actual address using reverse geocoding
   */
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      console.log(`📍 Reverse geocoding: ${lat}, ${lng}`);
      
      // Using OpenStreetMap Nominatim API (free, no API key required)
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
        console.log('📍 Address found:', data.display_name);
        
        // Try to format a more readable address
        const address = data.address;
        if (address) {
          const parts = [];
          
          // Add specific location details
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
            return parts.slice(0, 3).join(', '); // Take first 3 parts for readability
          }
        }
        
        // Fallback to display name
        return data.display_name;
      }
      
      throw new Error('No address found');
      
    } catch (error) {
      console.error('📍 Reverse geocoding failed:', error);
      
      // Fallback: try alternative service or return coordinates
      try {
        // Alternative: Try another geocoding service
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
        console.error('📍 Fallback geocoding also failed:', fallbackError);
      }
      
      // Final fallback: return formatted coordinates
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  goBack() {
    this.router.navigate(['/pages/home'], { replaceUrl: true, queryParams: { refresh: Date.now() } });
  }

  // Step navigation methods
  nextStep() {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  canProceedToNextStep(): boolean {
    switch (this.currentStep) {
      case 1: // Symptoms confirmation
        // Check if detection is confirmed AND at least one symptom is checked (if detection is correct)
        if (this.isDetectionCorrect === null) {
          return false; // Must confirm detection first
        }
        
        if (this.isDetectionCorrect === 'false') {
          return true; // If symptoms don't match, can proceed without checking symptoms
        }
        
        // If detection is correct, must have at least one symptom checked
        const hasPrimarySymptoms = this.selectedSymptoms.some(selected => selected);
        const hasAlternativeSymptoms = this.selectedAlternativeSymptoms.some(selected => selected);
        return hasPrimarySymptoms || hasAlternativeSymptoms;
        
      case 2: // Location confirmation
        return this.locationAccuracyConfirmed !== null;
      case 3: // Additional comments
        return true; // Optional step
      case 4: // Final confirmation
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

  // Get symptoms for the detected disease
  


  getDiseaseSymptoms(disease: string): string[] {
    // Use detection service for disease symptoms mapping
    return this.detectionService.getDiseaseSymptoms(disease);
  }

  onDetectionChange(event: any) {
    console.log('Detection verification changed:', event.detail.value);
    this.isDetectionCorrect = event.detail.value;
  }

  // Method to set detection as incorrect when user clicks the "No" button
  setDetectionIncorrect() {
    console.log('User selected: symptoms do not match');
    this.isDetectionCorrect = 'false';
    
    // Auto uncheck all selected symptoms when detection is set to incorrect
    this.selectedSymptoms = new Array(this.symptoms.length).fill(false);
    this.selectedAlternativeSymptoms = new Array(this.alternativeSymptoms.length).fill(false);
    
    console.log('All symptoms unchecked due to incorrect detection');
  }

  onLocationChange(event: any) {
    console.log('Location accuracy confirmation changed:', event.detail.value);
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
      console.log('🔍 Saving verification data (no additional API call needed)...');
      
      // Prepare location consent data - location consent was already given during registration
      // User is only confirming the accuracy of the detected location
      const locationConsentResult: LocationConsentResult = {
        consentGiven: true, // Always true since consent was given during registration
        locationData: this.detectedLocation,
        locationAccuracyConfirmed: this.locationAccuracyConfirmed === 'true' // User's confirmation of location accuracy
      };
      
      // Show loading for saving the verification
      loading = await this.loadingCtrl.create({ 
        message: 'Saving analysis...',
        spinner: 'crescent'
      });
      await loading.present();
      
      // Now save the analysis with user verification and location data
      console.log('💾 Saving analysis with user verification...');
      
      const base64 = this.imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'image.jpg', { type: 'image/jpeg' });
      
      // Get all selected symptoms for the API
      const symptomsData = this.prepareSymptomsDataForAPI();
      
      console.log('📋 Symptoms data for API:', symptomsData);
      
      // Save with verification data to admin/database
      const finalResult = await this.apiService.savePredictionWithVerification(
        file,
        (this.detectionType as 'fruit' | 'leaf') || 'leaf',
        {
          isDetectionCorrect: this.isDetectionCorrect === 'true',
          userFeedback: this.userFeedback || undefined,
          selectedSymptoms: symptomsData.allSelectedSymptoms, // All selected symptoms combined
          primarySymptoms: symptomsData.selectedPrimarySymptoms, // Primary disease symptoms only
          alternativeSymptoms: symptomsData.selectedAlternativeSymptoms, // Alternative symptoms only
          detectedDisease: this.detectedDisease,
          topDiseases: this.topDiseases, // Include all top diseases for reference
          confidence: this.confidence,
          
          // Include comprehensive symptoms data
          symptomsData: symptomsData
        } as any, // Use 'as any' temporarily to avoid type errors
        locationConsentResult.locationData, // Always pass location data if available
        locationConsentResult.locationAccuracyConfirmed // Pass user's accuracy confirmation
      );
      
      if (loading) {
        await loading.dismiss();
        loading = null;
      }
      this.isProcessing = false;
      
      console.log('✅ Verification completed:', finalResult);
      
      // Navigate to results with verification data
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
      console.error('❌ Verification saving error:', error);
      
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

  // Helper method to get selected symptoms
  getSelectedSymptoms(): string[] {
    return this.symptoms.filter((_, i) => this.selectedSymptoms[i]);
  }

  // Extract symptoms from top 2 and 3 diseases for "more options"
  // Extract symptoms from top 2 and 3 diseases for "more options" using service
  private extractAlternativeSymptoms() {
    const result = this.symptomsService.extractAlternativeSymptoms(
      this.topDiseases,
      (disease: string) => this.detectionService.getDiseaseSymptoms(disease)
    );
    
    this.alternativeSymptoms = result.symptoms;
    this.selectedAlternativeSymptoms = result.selectionArray;
  }

  // Helper method to get all selected symptoms (primary + alternative) using service
  getAllSelectedSymptoms(): string[] {
    return this.symptomsService.getAllSelectedSymptoms(
      this.symptoms,
      this.selectedSymptoms,
      this.alternativeSymptoms,
      this.selectedAlternativeSymptoms
    );
  }

  // Prepare symptoms data for API backend using service
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