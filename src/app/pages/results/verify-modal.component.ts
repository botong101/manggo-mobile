import { Component, Input } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService as MainApiService, UserConfirmation } from 'src/app/services/api.service';
import { ApiService as UtilApiService, LocationData } from 'src/app/services/apiservice.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-verify-modal',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  template: `
      <div class="modal-backdrop">
        <div class="custom-dialog">
          <!-- Header with close button -->
          <div class="dialog-header">
            <ion-icon name="checkmark-circle" class="header-icon"></ion-icon>
            <h2 class="dialog-title">Verify AI Detection Result</h2>
          </div>
          
          <!-- Content -->
          <div class="dialog-content">
            <!-- AI Detection Result -->
            <div class="disease-info">
              <div class="disease-badge">
                <ion-icon name="leaf" class="disease-icon"></ion-icon>
                <span class="disease-name">{{ mainDisease }}</span>
              </div>
              <p style="color: #666; font-size: 0.9rem; margin: 12px 0 0 0; text-align: center;">
                AI detected with {{ confidenceLevel }}% confidence
              </p>
            </div>
            
            <!-- Visual Indicators -->
            <div class="indications-section" *ngIf="indications?.length">
              <p class="indications-title">
                <ion-icon name="eye-outline"></ion-icon>
                Check if you see these symptoms:
              </p>
              <div class="indications-list">
                <div *ngFor="let ind of indications" class="indication-item">
                  <ion-icon name="ellipse" class="bullet-icon"></ion-icon>
                  <span>{{ ind }}</span>
                </div>
              </div>
            </div>

            <!-- Location Information -->
            <div *ngIf="locationData" style="background: #e8f5e8; padding: 16px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #4CAF50;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <ion-icon name="location-outline" style="color: #4CAF50; font-size: 20px;"></ion-icon>
                <span style="font-weight: 600; color: #4CAF50;">Location Found in Image</span>
              </div>
              <p style="font-size: 0.85rem; color: #666; margin: 4px 0;">{{ locationData.address || (locationData.latitude + ', ' + locationData.longitude) }}</p>
              
              <!-- Location Consent -->
              <div style="display: flex; align-items: flex-start; gap: 12px; margin-top: 12px;">
                <ion-checkbox 
                  [(ngModel)]="locationConsent"
                  style="margin-top: 2px;">
                </ion-checkbox>
                <span style="font-size: 0.85rem; color: #555; line-height: 1.4;">
                  Share location data to help improve disease mapping in your area
                </span>
              </div>
            </div>

            <!-- Optional Feedback -->
            <div style="margin: 20px 0;">
              <ion-textarea
                [(ngModel)]="userFeedback"
                placeholder="Optional: Add any observations or comments..."
                rows="3"
                style="--background: #f8f9fa; --color: #333; border-radius: 8px; border: 1px solid #e0e0e0;">
              </ion-textarea>
            </div>
          </div>
          
          <!-- Action buttons -->
          <div class="dialog-actions">
            <ion-button 
              expand="block" 
              class="verify-btn success-btn" 
              (click)="verify(true)">
              <ion-icon name="thumbs-up" slot="start"></ion-icon>
              Yes, this matches
            </ion-button>
            <ion-button 
              expand="block" 
              fill="outline" 
              class="verify-btn error-btn" 
              (click)="verify(false)">
              <ion-icon name="thumbs-down" slot="start"></ion-icon>
              No, this doesn't match
            </ion-button>
            
            <!-- Help Text -->
            <p style="font-size: 0.8rem; color: #999; margin: 12px 0 0 0; line-height: 1.4; text-align: center;">
              Your feedback helps improve our AI accuracy. All data is anonymized and used for research purposes only.
            </p>
          </div>
        </div>
      </div>
      `,
      styleUrls: ['./verify-modal.component.scss']
    })
export class VerifyModalComponent {
  @Input() mainDisease: string = '';
  @Input() indications: string[] = [];
  @Input() confidenceLevel: string = '';
  @Input() imageId: number = 0;
  @Input() confidenceScore: number = 0;
  @Input() locationData: LocationData | null = null;

  locationConsent: boolean = false;
  userFeedback: string = '';

  constructor(
    private modalCtrl: ModalController,
    private apiService: MainApiService,
    private utilApiService: UtilApiService
  ) {}

  dismiss() {
    this.modalCtrl.dismiss({ cancelled: true });
  }

  skip() {
    this.modalCtrl.dismiss({ verified: false, skipped: true });
  }

  async verify(isCorrect: boolean) {
    try {
      // Log the current state for debugging
      console.log('🔍 Verify modal state:', {
        imageId: this.imageId,
        mainDisease: this.mainDisease,
        confidenceScore: this.confidenceScore,
        locationConsent: this.locationConsent,
        hasLocationData: !!this.locationData,
        userFeedback: this.userFeedback,
        userFeedbackLength: this.userFeedback.length
      });

      // Prepare confirmation data
      const confirmationData = {
        image_id: this.imageId,
        is_correct: isCorrect,
        predicted_disease: this.mainDisease,
        user_feedback: this.userFeedback.trim(),
        confidence_score: this.confidenceScore,
        location_consent_given: this.locationConsent
      };

      // Add location data if consent given and location available
      if (this.locationConsent && this.locationData) {
        Object.assign(confirmationData, {
          latitude: this.locationData.latitude,
          longitude: this.locationData.longitude,
          location_accuracy: this.locationData.accuracy || 0,
          location_address: this.locationData.address || ''
        });
      }

      console.log('📤 Sending confirmation data:', confirmationData);
      console.log('📝 User feedback specifically:', {
        raw: this.userFeedback,
        trimmed: this.userFeedback.trim(),
        isEmpty: this.userFeedback.trim() === ''
      });

      // Save confirmation to backend
      const response = await firstValueFrom(this.apiService.saveUserConfirmation(confirmationData));
      
      if (response?.success) {
        console.log('Confirmation saved successfully:', response);
        this.modalCtrl.dismiss({ 
          verified: true, 
          isCorrect,
          confirmationId: response.data.confirmation_id,
          locationSaved: this.locationConsent && this.locationData
        });
      } else {
        console.error('Failed to save confirmation:', response);
        // Still dismiss modal but show warning
        this.modalCtrl.dismiss({ 
          verified: true, 
          isCorrect,
          error: 'Failed to save feedback to server'
        });
      }
      
    } catch (error: any) {
      console.error('Error saving confirmation:', error);
      
      let errorMessage = 'Network error while saving feedback';
      
      // Check if this is the "already exists" error
      if (error && typeof error === 'string' && error.includes('already exists')) {
        errorMessage = 'This image has already been verified. Thank you for your feedback!';
      } else if (error && error.message && error.message.includes('already exists')) {
        errorMessage = 'This image has already been verified. Thank you for your feedback!';
      } else if (error && error.error && error.error.message && error.error.message.includes('already exists')) {
        errorMessage = 'This image has already been verified. Thank you for your feedback!';
      }
      
      // Still dismiss modal but show appropriate message
      this.modalCtrl.dismiss({ 
        verified: true, 
        isCorrect,
        error: errorMessage
      });
    }
  }
}