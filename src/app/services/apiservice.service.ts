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

  async predictImageWithLocation(file: File, detectionType: 'fruit' | 'leaf'): Promise<any> {
    console.log('Starting prediction with location extraction...');
    
    try {
      const location = await this.extractLocationFromImageWithFallback(file);
      
      const formData = new FormData();
      formData.append('image', file);
      formData.append('detection_type', detectionType);
      
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
        formData.append('location_source', location.source);
        if (location.accuracy) {
          formData.append('location_accuracy', location.accuracy.toString());
        }
        console.log('Location data added to prediction request:', location);
      } else {
        console.log('No location data available for prediction');
      }

      const headers = this.getAuthHeaders();
      
      return firstValueFrom(this.http.post(`${this.apiUrl}/predict/`, formData, { headers })
        .pipe(
          tap(response => console.log('Prediction API response:', response)),
          catchError(this.handleError)
        ));
        
    } catch (error) {
      console.error('Error in predictImageWithLocation:', error);
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
