import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PredictionCoreService } from './prediction-core.service';

/**
 * service for verify page stuff
 * does preview and saves with verification
 */
@Injectable({
  providedIn: 'root'
})
export class VerifyPredictionService extends PredictionCoreService {

  /* just get prediction dont save */
  async previewPrediction(file: File, detectionType: 'fruit' | 'leaf'): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('detection_type', detectionType);
      formData.append('preview_only', 'true'); // dont save to db yet
      
      console.log('Preview prediction request for:', detectionType);
      
      return firstValueFrom(this.predictImageRequest(formData));
        
    } catch (error) {
      console.error('Error in previewPrediction:', error);
      throw error;
    }
  }

  /**
   * save the prediction after user confirms everything
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
      formData.append('preview_only', 'false'); // now we actually save
      
      // stick in the verification stuff
      formData.append('is_detection_correct', userVerification.isDetectionCorrect.toString());
      if (userVerification.userFeedback) {
        formData.append('user_feedback', userVerification.userFeedback);
      }
      
      // symptoms if we got em
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
      
      // gps stuff - save it but note if they said its accurate
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
