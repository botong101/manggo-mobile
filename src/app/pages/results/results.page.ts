import { Component, OnInit } from '@angular/core';
import { IonicModule, LoadingController, ToastController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { VerifyModalComponent } from './verify-modal.component';
import { ApiService, LocationData } from 'src/app/services/apiservice.service';

@Component({
  selector: 'app-results',
  standalone: true, 
  imports: [IonicModule, CommonModule],
  templateUrl: './results.page.html',
  styleUrls: ['./results.page.scss'],
})
export class ResultsPage implements OnInit {
  result: any = null;
  image: string | null = null;
  imageFile: File | null = null;
  mainDisease: string = '';
  probabilities: any[] = [];
  diseaseInfo: string = '';
  treatment: string = '';
  confidenceLevel: string = '';
  confidenceScore: number = 0;
  savedImageId: number | null = null;
  locationData: LocationData | null = null;
  isLoading = false;
  isVerified = false;
  verificationResult: boolean | null = null;

  indicationsMap: { [key: string]: string[] } = {
    'Anthracnose': [
      'Do you see dark, sunken spots on the leaves or fruits?',
      'Are there soft, rotten areas on the fruit?',
      'Are the tips of the leaves turning brown?'
    ],
    'Bacterial Canker': [
      'Are there wounds or sores on the branches or stems?',
      'Are some leaves wilting or drying up?',
      'Are small branches dying from the tip?'
    ],
    'Cutting Weevil': [
      'Are the young shoots or leaves damaged or cut?',
      'Do you see small holes in the stems?',
      'Are some parts of the plant wilting or not growing well?'
    ],
    'Die Back': [
      'Are the ends of branches drying up and dying?',
      'Is the drying moving from the tip towards the main branch?',
      'Does the plant look stressed or weak?'
    ],
    'Gall Midge': [
      'Do you see unusual swellings (galls) on leaves or shoots?',
      'Are some leaves or shoots growing in a strange or twisted way?',
      'Is the plant not growing as strong as usual?'
    ],
    'Healthy': [
      'Are the leaves and fruits looking normal?',
      'Do you see no spots, wounds, or strange growths?',
      'Is the plant growing well and strong?'
    ],
    'Powdery Mildew': [
      'Do you see white, powder-like patches on the leaves or stems?',
      'Are the leaves looking dull or dusty?',
      'Is the fruit not growing well or looking unhealthy?'
    ],
    'Sooty Mold': [
      'Do you see black, soot-like dirt on the leaves or fruits?',
      'Are the leaves sticky or dirty to touch?',
      'Is the plant not as green as usual?'
    ],
    'Black Mold Rot': [
      'Do you see black mold growing on the fruits?',
      'Are the fruits soft and spoiling quickly?',
      'Are there black, rotten spots on the fruit?'
    ],
    'Stem end Rot': [
      'Is the area where the fruit joins the stem soft or rotten?',
      'Do you see water-soaked or dark spots at the stem end of the fruit?',
      'Are the fruits spoiling from the stem side?'
    ]
  };

  constructor(
    private router: Router,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    const navState = window.history.state;
    this.result = navState?.result || null;
    this.image = navState?.image || null;
    this.imageFile = navState?.imageFile || null;
    
    console.log('Results page initialized with:', {
      hasResult: !!this.result,
      hasImage: !!this.image,
      hasImageFile: !!this.imageFile,
      resultData: this.result
    });
    
    if (!this.result || !this.result.success || !this.image) {
      this.showToast('No result or image found. Please analyze a photo first.');
      this.router.navigate(['pages/home']);
      return;
    }
    
    this.processResults();
  }

  processResults() {
    console.log('Processing results:', this.result);
    
    if (!this.result.success) {
      this.showToast('Prediction failed: ' + (this.result.error || 'Unknown error'));
      return;
    }

    const predictionData = this.result.data || this.result;
    
    if (predictionData.primary_prediction) {
      // Extract all the data
      this.mainDisease = predictionData.primary_prediction.disease;
      this.treatment = predictionData.primary_prediction.treatment;
      this.confidenceScore = predictionData.primary_prediction.confidence_score || 0;
      this.savedImageId = predictionData.saved_image_id || 0;
      
      this.probabilities = predictionData.top_3_predictions.map((pred: any) => ({
        class: pred.disease,
        confidence: pred.confidence,
        confidence_formatted: pred.confidence_formatted,
        treatment: pred.treatment,
        rank: pred.rank
      }));
      
      this.confidenceLevel = predictionData.prediction_summary.confidence_level;
      this.diseaseInfo = this.getDiseaseInfo(this.mainDisease);
      
      console.log('Extracted data:', {
        mainDisease: this.mainDisease,
        confidenceScore: this.confidenceScore,
        savedImageId: this.savedImageId,
        confidenceLevel: this.confidenceLevel
      });
      
      console.log('Successfully processed results');
      
      // Show verification modal after processing results
      this.openVerificationModal();
      
    } else {
      console.error('Unexpected response format:', this.result);
      this.mainDisease = 'Unknown Disease';
      this.diseaseInfo = 'Unable to determine disease from the image';
      this.probabilities = [];
      this.showToast('Unexpected response format from server.');
      
      // Even for errors, set as verified to show something
      this.isVerified = true;
    }
  }

  async openVerificationModal() {
    const indications = this.indicationsMap[this.mainDisease] || [];
    
    try {
      // Extract location data from image if available
      let locationData: LocationData | null = null;
      if (this.imageFile) {
        try {
          locationData = await this.apiService.extractLocationFromImageWithFallback(this.imageFile);
          console.log('Location extracted:', locationData);
        } catch (error) {
          console.error('Error extracting location:', error);
        }
      } else {
        console.log('No image file available for location extraction');
      }

      console.log('Opening verification modal with:', {
        imageId: this.savedImageId,
        mainDisease: this.mainDisease,
        confidenceScore: this.confidenceScore,
        confidenceLevel: this.confidenceLevel,
        hasLocationData: !!locationData
      });

      const modal = await this.modalCtrl.create({
        component: VerifyModalComponent,
        componentProps: { 
          mainDisease: this.mainDisease, 
          indications: indications,
          imageFile: this.imageFile,
          locationData: locationData,
          result: this.result,
          imageId: this.savedImageId || 0,
          confidenceScore: this.confidenceScore || 0,
          confidenceLevel: this.confidenceLevel
        },
        cssClass: 'verify-modal-custom',
        backdropDismiss: false // Prevent dismissing by clicking backdrop
      });
      
      await modal.present();

      const { data } = await modal.onWillDismiss();
      
      // Always set as verified after modal dismissal
      this.isVerified = true;
      
      if (data?.verified) {
        this.verificationResult = data.isCorrect;
        
        // Check for errors first
        if (data.error) {
          this.showToast(data.error, 'warning');
        } else if (data.isCorrect) {
          this.showToast('Thank you for verifying the result!', 'success');
        } else {
          this.showToast('Thank you for your feedback! This helps improve our AI.', 'warning');
        }
      } else if (data?.cancelled) {
        this.showToast('Verification skipped', 'warning');
      }
      
    } catch (error) {
      console.error('Error opening modal:', error);
      this.isVerified = true; // Show results even if modal fails
    }
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred. Please try again.';
    
    if (error.status === 0) {
      errorMessage = 'Unable to connect to server. Please check your connection.';
    } else if (error.status === 400) {
      errorMessage = 'Invalid image format. Please try another image.';
    } else if (error.status === 413) {
      errorMessage = 'Image too large. Please use a smaller image.';
    } else if (error.status === 500) {
      errorMessage = error.error?.error || 'Server error occurred. Please try again.';
    }

    this.showToast(errorMessage);
    this.mainDisease = 'Analysis Failed';
    this.diseaseInfo = 'Unable to analyze the image. Please try again.';
  }

  getTopProbabilities() {
    // Already sorted by rank from backend, just return first 3
    return this.probabilities.slice(0, 3);
  }

  getDiseaseInfo(disease: string): string {
    const diseaseInfoMap: { [key: string]: string } = {
      'Anthracnose': 'A fungal disease that causes dark, sunken spots on leaves and fruits. It thrives in warm, humid conditions and can significantly reduce fruit quality.',
      'Bacterial Canker': 'A bacterial infection that causes cankers on stems and branches, leading to wilting and dieback. Early detection is crucial for management.',
      'Cutting Weevil': 'An insect pest that damages young shoots and leaves. The larvae bore into stems, causing wilting and stunted growth.',
      'Die Back': 'A disease that causes branch tips to die back progressively, often starting from the ends. It can be caused by various pathogens or environmental stress.',
      'Gall Midge': 'Small fly larvae that cause galls on leaves and shoots, leading to deformed growth and reduced plant vigor.',
      'Healthy': 'No disease detected - your mango plant appears healthy! Continue with regular care and monitoring.',
      'Powdery Mildew': 'A fungal disease that causes white, powdery coating on leaves and shoots. It can reduce photosynthesis and fruit quality.',
      'Sooty Mold': 'Black fungal growth that develops on honeydew secreted by insects. While not directly harmful, it reduces photosynthesis.',
      'Black Mold Rot': 'A fungal infection that causes black mold growth on fruits, leading to rapid deterioration and spoilage.',
      'Stem end Rot': 'A post-harvest disease that affects fruits at the stem end, causing rot and reducing storage life.'
    };

    return diseaseInfoMap[disease] || `Information about ${disease} is being researched. Please consult with agricultural experts for specific guidance.`;
  }

  formatConfidence(confidence: number): string {
    // Confidence from backend is already a percentage number (e.g., 85.67)
    return `${confidence.toFixed(1)}%`;
  }

  goBack() {
    this.router.navigate(['pages/home']);
  }

  retakePhoto() {
    this.router.navigate(['pages/home']);
  }
  
  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'danger') {
    const toast = await this.toastCtrl.create({ 
      message, 
      duration: 4000, 
      color,
      position: 'top',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}
