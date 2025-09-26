import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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

  /**
   * Predict mango disease/ripeness from image
   */
  predictImage(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/predict/`, formData).pipe(
      tap(response => console.log('Prediction response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Get prediction history
   */
  getPredictionHistory(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/predictions/`).pipe(
      tap(response => console.log('History response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Save user confirmation with location data
   */
  saveUserConfirmation(confirmation: UserConfirmation): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/save-confirmation/`, 
      confirmation
    ).pipe(
      tap(response => console.log('Confirmation saved:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Extract location from image EXIF data with GPS fallback
   */
  async extractLocationFromImageWithFallback(file: File): Promise<LocationData | null> {
    try {
      console.log('Attempting EXIF location extraction...');
      
      // First try EXIF data with timeout to prevent hanging
      const exifLocation = await Promise.race([
        this.extractLocationFromImage(file),
        new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn('EXIF extraction timed out after 3 seconds');
            resolve(null);
          }, 3000);
        })
      ]);
      
      if (exifLocation) {
        console.log('Location found in EXIF data');
        return exifLocation;
      }

      // If no EXIF location, try GPS as fallback
      console.log('No EXIF location found, trying GPS fallback...');
      try {
        const gpsLocation = await this.locationService.getCurrentLocation();
        
        if (gpsLocation) {
          console.log('GPS location obtained as fallback');
          return {
            latitude: gpsLocation.latitude,
            longitude: gpsLocation.longitude,
            accuracy: gpsLocation.accuracy,
            address: gpsLocation.address,
            source: 'gps'
          };
        }
      } catch (error) {
        console.warn('GPS fallback failed:', error);
      }

      console.log('No location data available from any source');
      return null;
    } catch (error) {
      console.error('Error in extractLocationFromImageWithFallback:', error);
      return null;
    }
  }

  /**
   * Extract location from image EXIF data
   */
  extractLocationFromImage(file: File): Promise<LocationData | null> {
    return new Promise((resolve) => {
      try {
        EXIF.getData(file as any, function(this: any) {
          try {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef");

            console.log('EXIF GPS Data:', { lat, latRef, lon, lonRef });

            if (lat && lon && latRef && lonRef) {
              // Convert GPS coordinates to decimal degrees
              const latitude = ApiService.convertDMSToDD(lat, latRef);
              const longitude = ApiService.convertDMSToDD(lon, lonRef);

              if (latitude !== null && longitude !== null) {
                console.log('EXIF location extracted:', { latitude, longitude });
                resolve({
                  latitude,
                  longitude,
                  source: 'exif'
                });
                return;
              }
            }

            console.log('No GPS data found in EXIF');
            resolve(null);
          } catch (error) {
            console.error('Error extracting EXIF location:', error);
            resolve(null);
          }
        });
      } catch (error) {
        console.error('Error initializing EXIF data extraction:', error);
        resolve(null);
      }
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        console.warn('EXIF extraction timeout, resolving with null');
        resolve(null);
      }, 5000);
    });
  }

  /**
   * Convert DMS (Degrees, Minutes, Seconds) to DD (Decimal Degrees)
   */
  private static convertDMSToDD(dms: number[], ref: string): number | null {
    if (!dms || dms.length !== 3) return null;
    
    try {
      let dd = dms[0] + dms[1] / 60 + dms[2] / 3600;
      if (ref === "S" || ref === "W") {
        dd = dd * -1;
      }
      return dd;
    } catch (error) {
      console.error('Error converting DMS to DD:', error);
      return null;
    }
  }

  /**
   * Get human-readable address from coordinates
   */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }
      
      const data = await response.json();
      
      // Build address string
      const addressParts = [];
      if (data.locality) addressParts.push(data.locality);
      if (data.principalSubdivision) addressParts.push(data.principalSubdivision);
      if (data.countryName) addressParts.push(data.countryName);
      
      return addressParts.length > 0 ? addressParts.join(', ') : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  /**
   * Process image with location extraction and prepare FormData
   */
  async processImageWithLocation(file: File, detectionType: string = 'leaf'): Promise<{
    formData: FormData,
    locationData: LocationData | null
  }> {
    // Extract location from EXIF with GPS fallback
    const locationData = await this.extractLocationFromImageWithFallback(file);
    
    // If location found, get human-readable address
    if (locationData) {
      try {
        locationData.address = await this.reverseGeocode(
          locationData.latitude, 
          locationData.longitude
        );
      } catch (error) {
        console.warn('Could not get address for location:', error);
      }
    }

    // Prepare form data for prediction
    const formData = new FormData();
    formData.append('image', file);
    formData.append('detection_type', detectionType);
    
    // Add location data if available
    if (locationData) {
      formData.append('has_location', 'true');
      formData.append('latitude', locationData.latitude.toString());
      formData.append('longitude', locationData.longitude.toString());
      formData.append('location_source', locationData.source);
      if (locationData.address) {
        formData.append('location_address', locationData.address);
      }
    }

    return { formData, locationData };
  }

  /**
   * Predict image with location extraction
   */
  async predictImageWithLocation(file: File, detectionType: string = 'leaf'): Promise<any> {
    try {
      console.log('Processing image with location extraction...');
      
      // Add timeout to prevent hanging indefinitely
      const result = await Promise.race([
        this.processImageWithLocationInternal(file, detectionType),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Image processing timed out after 15 seconds'));
          }, 15000);
        })
      ]);
      
      return result;
    } catch (error) {
      console.error('Error in predictImageWithLocation:', error);
      // If location extraction fails, fall back to regular prediction
      const formData = new FormData();
      formData.append('image', file);
      formData.append('detection_type', detectionType);
      
      console.log('Falling back to prediction without location');
      return this.predictImage(formData).toPromise();
    }
  }

  /**
   * Internal method for processing image with location
   */
  private async processImageWithLocationInternal(file: File, detectionType: string): Promise<any> {
    // Extract location and prepare FormData
    const { formData, locationData } = await this.processImageWithLocation(file, detectionType);
    
    console.log('Location data extracted:', locationData);
    console.log('Sending prediction request with location...');
    
    // Make the prediction call
    return this.predictImage(formData).toPromise();
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
    }
    
    console.error('API Error:', errorMessage);
    return throwError(() => errorMessage);
  }
}
