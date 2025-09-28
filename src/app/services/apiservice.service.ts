import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LocationService, LocationData as LocationServiceData } from './location.service';

declare var EXIF: any;

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  source: 'exif' | 'gps' | 'manual';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface UserConfirmation {
  imageId?: number;
  image_id?: number;
  isCorrect?: boolean;
  is_correct?: boolean;
  actualDisease?: string;
  predicted_disease?: string;
  feedback?: string;
  user_feedback?: string;
  confidence_score?: number;
  location_consent_given?: boolean;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_address?: string;
  location_source?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private locationService: LocationService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Token ${token}`);
  }

  async extractLocationFromImageWithFallback(file: File): Promise<LocationData | null> {
    console.log('Starting location extraction for:', file.name);
    
    let location: LocationData | null = null;

    try {
      location = await this.extractLocationFromEXIF(file);
      if (location) {
        console.log('EXIF location extracted successfully:', location);
        return location;
      }
    } catch (error) {
      console.warn('EXIF extraction failed, trying GPS fallback:', error);
    }

    try {
      console.log('Attempting GPS fallback...');
      const gpsLocation = await this.locationService.getCurrentLocation();
      if (gpsLocation) {
        location = {
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
          accuracy: gpsLocation.accuracy,
          source: 'gps'
        };
        console.log('GPS fallback location obtained:', location);
        return location;
      }
    } catch (gpsError) {
      console.warn('GPS fallback also failed:', gpsError);
    }

    console.log('No location could be extracted from EXIF or GPS');
    return null;
  }

  private extractLocationFromEXIF(file: File): Promise<LocationData | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('EXIF extraction timeout after 5 seconds'));
      }, 5000);

      try {
        if (typeof EXIF === 'undefined') {
          clearTimeout(timeoutId);
          reject(new Error('EXIF library not loaded'));
          return;
        }

        EXIF.getData(file, () => {
          try {
            const lat = EXIF.getTag(file, 'GPSLatitude');
            const lon = EXIF.getTag(file, 'GPSLongitude');
            const latRef = EXIF.getTag(file, 'GPSLatitudeRef');
            const lonRef = EXIF.getTag(file, 'GPSLongitudeRef');

            clearTimeout(timeoutId);

            if (lat && lon && latRef && lonRef) {
              const latitude = (latRef === 'S' ? -1 : 1) * (lat[0] + lat[1]/60 + lat[2]/3600);
              const longitude = (lonRef === 'W' ? -1 : 1) * (lon[0] + lon[1]/60 + lon[2]/3600);
              
              const location: LocationData = {
                latitude,
                longitude,
                source: 'exif'
              };
              
              console.log('EXIF location extracted:', location);
              resolve(location);
            } else {
              console.log('No GPS data found in EXIF');
              resolve(null);
            }
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  async predictImageWithLocation(
    file: File, 
    detectionType: 'fruit' | 'leaf',
    exifLocationData?: any,
    locationConsentGiven?: boolean
  ): Promise<any> {
    console.log('Starting prediction with EXIF location extraction...');
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('detection_type', detectionType);
      
      // Add EXIF location data if available and consent given
      if (exifLocationData && locationConsentGiven && exifLocationData.hasGps) {
        formData.append('latitude', exifLocationData.latitude.toString());
        formData.append('longitude', exifLocationData.longitude.toString());
        formData.append('location_source', 'exif');
        formData.append('location_consent_given', 'true');
        if (exifLocationData.address) {
          formData.append('location_address', exifLocationData.address);
        }
        console.log('📍 EXIF location data added to prediction request:', exifLocationData);
      } else {
        console.log('📍 No EXIF location data or consent not given');
        formData.append('location_consent_given', 'false');
      }

      const headers = this.getAuthHeaders();
      
      return firstValueFrom(this.http.post(`${this.apiUrl}/predict/`, formData, { headers })
        .pipe(
          tap(response => console.log('✅ Prediction API response:', response)),
          catchError(this.handleError)
        ));
        
    } catch (error) {
      console.error('❌ Error in predictImageWithLocation:', error);
      return firstValueFrom(this.predictImage(file, detectionType));
    }
  }

  predictImage(file: File, detectionType: 'fruit' | 'leaf'): Observable<any> {
    console.log('Fallback: predicting without location');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('detection_type', detectionType);

    const headers = this.getAuthHeaders();
    
    return this.http.post(`${this.apiUrl}/predict/`, formData, { headers })
      .pipe(
        tap(response => console.log('Prediction API response (no location):', response)),
        catchError(this.handleError)
      );
  }

  /**
   * Preview prediction - only for getting detection result, no database save
   * Used in verify page to show symptoms before user confirmation
   */
  async previewPrediction(file: File, detectionType: 'fruit' | 'leaf'): Promise<any> {
    console.log('🔍 Making preview prediction call (no database save)...');
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('detection_type', detectionType);
      formData.append('preview_only', 'true'); // Flag to prevent database save
      
      const headers = this.getAuthHeaders();
      
      return firstValueFrom(this.http.post(`${this.apiUrl}/predict/`, formData, { headers })
        .pipe(
          tap(response => console.log('✅ Preview prediction response:', response)),
          catchError(this.handleError)
        ));
        
    } catch (error) {
      console.error('❌ Error in previewPrediction:', error);
      throw error;
    }
  }

  /**
   * Save prediction with user verification data to admin/database
   * Used after user confirms the analysis
   */
  async savePredictionWithVerification(
    file: File,
    detectionType: 'fruit' | 'leaf',
    userVerification: {
      isDetectionCorrect: boolean;
      userFeedback?: string;
    },
    locationData?: any,
    locationConsentGiven?: boolean
  ): Promise<any> {
    console.log('💾 Saving prediction with user verification...');
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('detection_type', detectionType);
      formData.append('preview_only', 'false'); // Ensure this saves to database
      
      // Add user verification data
      formData.append('is_detection_correct', userVerification.isDetectionCorrect.toString());
      if (userVerification.userFeedback) {
        formData.append('user_feedback', userVerification.userFeedback);
      }
      
      // Add location data if available - always save location but track accuracy confirmation
      if (locationData) {
        formData.append('latitude', locationData.latitude.toString());
        formData.append('longitude', locationData.longitude.toString());
        formData.append('location_source', locationData.source || 'device_gps');
        formData.append('location_accuracy_confirmed', (locationConsentGiven || false).toString()); // User's accuracy confirmation
        if (locationData.address) {
          formData.append('location_address', locationData.address);
        }
        console.log('📍 Location data added to save request with accuracy confirmation:', locationConsentGiven);
      } else {
        formData.append('location_consent_given', 'false');
      }

      const headers = this.getAuthHeaders();
      
      return firstValueFrom(this.http.post(`${this.apiUrl}/predict/`, formData, { headers })
        .pipe(
          tap(response => console.log('✅ Prediction saved with verification:', response)),
          catchError(this.handleError)
        ));
        
    } catch (error) {
      console.error('❌ Error in savePredictionWithVerification:', error);
      throw error;
    }
  }

  saveConfirmation(confirmation: UserConfirmation): Observable<any> {
    const headers = this.getAuthHeaders();
    
    console.log('Saving confirmation with data:', confirmation);
    
    return this.http.post(`${this.apiUrl}/save-confirmation/`, confirmation, { headers })
      .pipe(
        tap(response => console.log('Save confirmation response:', response)),
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      console.log('Full error object:', error);
      
      // Try to extract the message from different possible structures
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.errors && Array.isArray(error.error.errors) && error.error.errors.length > 0) {
        errorMessage = error.error.errors[0];
      } else if (typeof error.error === 'string') {
        errorMessage = error.error;
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    console.error('API Error:', errorMessage);
    return throwError(() => errorMessage);
  }
}
