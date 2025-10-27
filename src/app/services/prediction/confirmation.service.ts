import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PredictionCoreService } from './prediction-core.service';

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

/**
 * Confirmation Service
 * Handles user confirmation/feedback operations
 * Used for saving user corrections and feedback on predictions
 */
@Injectable({
  providedIn: 'root'
})
export class ConfirmationService extends PredictionCoreService {

  /**
   * Save user confirmation/correction
   * Used when user provides feedback on prediction accuracy
   */
  saveConfirmation(confirmation: UserConfirmation): Observable<any> {
    const headers = this.getAuthHeaders();
    
    console.log('Saving user confirmation:', confirmation);
    
    return this.http.post(`${this.apiUrl}/save-confirmation/`, confirmation, { headers });
  }
}
