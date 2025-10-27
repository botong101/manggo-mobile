import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { PredictionCoreService } from './prediction-core.service';

/**
 * Standard Prediction Service
 * For basic prediction operations with optional location data
 */
@Injectable({
  providedIn: 'root'
})
export class StandardPredictionService extends PredictionCoreService {

  /**
   * Predict image with location data from EXIF
   * Used when image has GPS metadata
   */
  async predictImageWithLocation(
    file: File, 
    detectionType: 'fruit' | 'leaf',
    exifLocationData?: any,
    locationConsentGiven?: boolean
  ): Promise<any> {
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
      } else {
        formData.append('location_consent_given', 'false');
      }

      console.log('Prediction with location:', exifLocationData ? 'yes' : 'no');
      
      return firstValueFrom(this.predictImageRequest(formData));
        
    } catch (error) {
      // Fallback to simple prediction if location processing fails
      console.warn('Location prediction failed, falling back to simple prediction');
      return firstValueFrom(this.predictImage(file, detectionType));
    }
  }

  /**
   * Simple prediction without location data
   * Basic image upload and analysis
   */
  predictImage(file: File, detectionType: 'fruit' | 'leaf'): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('detection_type', detectionType);

    console.log('Simple prediction request for:', detectionType);
    
    return this.predictImageRequest(formData);
  }
}
