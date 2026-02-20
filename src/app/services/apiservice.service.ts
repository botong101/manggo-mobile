/**
 * OLD api service - just wraps new stuff
 * 
 * keeping this so old code doesnt break
 * use the new services from /services/prediction/ instead
 * 
 * @deprecated use VerifyPredictionService or StandardPredictionService
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

// export these so old imports still work
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

  /** @deprecated dont use this - use StandardPredictionService.predictImageWithLocation() */
  async predictImageWithLocation(
    file: File, 
    detectionType: 'fruit' | 'leaf',
    exifLocationData?: any,
    locationConsentGiven?: boolean
  ): Promise<any> {
    return this.standardService.predictImageWithLocation(file, detectionType, exifLocationData, locationConsentGiven);
  }

  /** @deprecated use StandardPredictionService.predictImage() now */
  predictImage(file: File, detectionType: 'fruit' | 'leaf'): Observable<any> {
    return this.standardService.predictImage(file, detectionType);
  }

  /** @deprecated switched to VerifyPredictionService.previewPrediction() */
  async previewPrediction(file: File, detectionType: 'fruit' | 'leaf'): Promise<any> {
    return this.verifyService.previewPrediction(file, detectionType);
  }

  /** @deprecated moved to VerifyPredictionService.savePredictionWithVerification() */
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

  /** @deprecated now its ConfirmationService.saveConfirmation() */
  saveConfirmation(confirmation: UserConfirmation): Observable<any> {
    return this.confirmationService.saveConfirmation(confirmation);
  }
}
