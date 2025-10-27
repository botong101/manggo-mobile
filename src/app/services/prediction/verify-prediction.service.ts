import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PredictionCoreService } from './prediction-core.service';

/**
 * Verify Page Prediction Service
 * Specialized service for the verify page workflow
 * Handles preview and save-with-verification operations
 */
@Injectable({
  providedIn: 'root'
})
export class VerifyPredictionService extends PredictionCoreService {

  /* Preview prediction */
  async previewPrediction(file: File, detectionType: 'fruit' | 'leaf'): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('detection_type', detectionType);
      formData.append('preview_only', 'true'); // Flag to prevent database save
      
      console.log('Preview prediction request for:', detectionType);
      
      return firstValueFrom(this.predictImageRequest(formData));
        
    } catch (error) {
      console.error('Error in previewPrediction:', error);
      throw error;
    }
  }

  /**
   * Save prediction with user verification data to admin/database
   * Used after user confirms the analysis in verify page
   */
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
      
      // Add symptoms data if available
      if (userVerification.selectedSymptoms) {
        formData.append('selected_symptoms', JSON.stringify(userVerification.selectedSymptoms));
      }
      if (userVerification.primarySymptoms) {
        formData.append('primary_symptoms', JSON.stringify(userVerification.primarySymptoms));
      }
      if (userVerification.alternativeSymptoms) {
        formData.append('alternative_symptoms', JSON.stringify(userVerification.alternativeSymptoms));
      }
      if (userVerification.detectedDisease) {
        formData.append('detected_disease', userVerification.detectedDisease);
      }
      if (userVerification.topDiseases) {
        formData.append('top_diseases', JSON.stringify(userVerification.topDiseases));
      }
      if (userVerification.symptomsData) {
        formData.append('symptoms_data', JSON.stringify(userVerification.symptomsData));
      }
      
      // Add location data if available - always save location but track accuracy confirmation
      if (locationData) {
        formData.append('latitude', locationData.latitude.toString());
        formData.append('longitude', locationData.longitude.toString());
        formData.append('location_source', locationData.source || 'device_gps');
        formData.append('location_accuracy_confirmed', (locationConsentGiven || false).toString());
        if (locationData.address) {
          formData.append('location_address', locationData.address);
        }
      } else {
        formData.append('location_consent_given', 'false');
      }

      console.log('Saving prediction with verification');
      
      return firstValueFrom(this.predictImageRequest(formData));
        
    } catch (error) {
      console.error('Error in savePredictionWithVerification:', error);
      throw error;
    }
  }
}
