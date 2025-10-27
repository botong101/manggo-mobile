/**
 * LEGACY API Service - Backward Compatibility Wrapper
 * 
 * This file is maintained for backward compatibility.
 * New code should use the specialized services from /services/prediction/
 * 
 * @deprecated Use VerifyPredictionService, StandardPredictionService, or ConfirmationService instead
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { 
  VerifyPredictionService, 
  StandardPredictionService, 
  ConfirmationService,
  LocationData,
  ApiResponse,
  UserConfirmation
} from './prediction';

// Re-export types for backward compatibility
export { LocationData, ApiResponse, UserConfirmation } from './prediction';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private verifyService: VerifyPredictionService,
    private standardService: StandardPredictionService,
    private confirmationService: ConfirmationService
  ) {}

  /** @deprecated Use StandardPredictionService.predictImageWithLocation() instead */
  async predictImageWithLocation(
    file: File, 
    detectionType: 'fruit' | 'leaf',
    exifLocationData?: any,
    locationConsentGiven?: boolean
  ): Promise<any> {
    return this.standardService.predictImageWithLocation(file, detectionType, exifLocationData, locationConsentGiven);
  }

  /** @deprecated Use StandardPredictionService.predictImage() instead */
  predictImage(file: File, detectionType: 'fruit' | 'leaf'): Observable<any> {
    return this.standardService.predictImage(file, detectionType);
  }

  /** @deprecated Use VerifyPredictionService.previewPrediction() instead */
  async previewPrediction(file: File, detectionType: 'fruit' | 'leaf'): Promise<any> {
    return this.verifyService.previewPrediction(file, detectionType);
  }

  /** @deprecated Use VerifyPredictionService.savePredictionWithVerification() instead */
  async savePredictionWithVerification(
    file: File,
    detectionType: 'fruit' | 'leaf',
    userVerification: {
      isDetectionCorrect: boolean;
      userFeedback?: string;
      selectedSymptoms?: string[];
      primarySymptoms?: string[];
      alternativeSymptoms?: string[];
      detectedDisease?: string;
      topDiseases?: any[];
      confidence?: number;
      symptomsData?: any;
    },
    locationData?: any,
    locationConsentGiven?: boolean
  ): Promise<any> {
    return this.verifyService.savePredictionWithVerification(
      file,
      detectionType,
      userVerification,
      locationData,
      locationConsentGiven
    );
  }

  /** @deprecated Use ConfirmationService.saveConfirmation() instead */
  saveConfirmation(confirmation: UserConfirmation): Observable<any> {
    return this.confirmationService.saveConfirmation(confirmation);
  }
}
