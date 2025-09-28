import { Component, OnInit } from '@angular/core';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  actualDisease: string = ''; // Store the actual detected disease
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

  // Confidence threshold for displaying "Unknown"
  private readonly UNKNOWN_CONFIDENCE_THRESHOLD = 50;

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
    private apiService: ApiService
  ) {}

  ngOnInit() {
    const navState = window.history.state;
    this.result = navState?.result || null;
    this.image = navState?.image || null;
    this.imageFile = navState?.imageFile || null;
    
    // Get the pre-processed detection data from verify page
    const detectedDisease = navState?.detectedDisease;
    const confidence = navState?.confidence;
    
    console.log('🔍 Results page initialized with:', {
      hasResult: !!this.result,
      hasImage: !!this.image,
      hasImageFile: !!this.imageFile,
      detectedDisease: detectedDisease,
      detectedDiseaseType: typeof detectedDisease,
      detectedDiseaseValid: !!detectedDisease,
      confidence: confidence,
      confidenceType: typeof confidence,
      confidenceValid: confidence !== undefined && confidence !== null,
      fullNavState: navState,
      resultData: this.result
    });
    
    if (!this.image) {
      this.showToast('No image found. Please analyze a photo first.');
      this.router.navigate(['pages/home'], { replaceUrl: true, queryParams: { refresh: Date.now() } });
      return;
    }
    
    // Prioritize processing full result data (which contains top_3_predictions)
    if (this.result && this.result.data && this.result.data.top_3_predictions) {
      console.log('✅ Processing full API result with top_3_predictions');
      this.processResults();
    } else if (detectedDisease && confidence !== undefined && confidence !== null) {
      // Fallback to using simple pre-processed data
      console.log('⚠️ Using simplified pre-processed detection data (no top_3_predictions)');
      this.mainDisease = detectedDisease;
      this.confidenceScore = confidence;
      this.confidenceLevel = this.getConfidenceLevel(confidence);
      this.diseaseInfo = this.getDiseaseInfo(this.mainDisease);
      this.treatment = this.getTreatmentInfo(this.mainDisease);
      this.isVerified = true; // Show results immediately since user already verified
      
      console.log('✅ Using pre-processed detection data:', {
        mainDisease: this.mainDisease,
        confidenceScore: this.confidenceScore,
        confidenceLevel: this.confidenceLevel,
        isVerified: this.isVerified
      });
    } else if (this.result) {
      // Last resort - try to process any available result
      console.log('⚠️ Processing any available result data');
      this.processResults();
    } else {
      // No data available at all - but still show the page and let user know
      console.log('❌ No detection data available');
      this.mainDisease = 'No Detection Data';
      this.confidenceScore = 0;
      this.confidenceLevel = 'Unknown';
      this.diseaseInfo = 'Unable to load detection results. Please try analyzing again.';
      this.treatment = 'Please retake the photo and try again.';
      this.isVerified = true; // Show the page anyway
      
      this.showToast('No detection result found. Please analyze a photo first.');
    }

    // Failsafe: Always set verified after 3 seconds to prevent infinite loading
    setTimeout(() => {
      if (!this.isVerified) {
        console.log('⏰ Timeout: Setting isVerified = true to prevent infinite loading');
        this.isVerified = true;
      }
    }, 3000);
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
      this.actualDisease = predictionData.primary_prediction.disease; // Store actual disease
      this.treatment = predictionData.primary_prediction.treatment;
      this.confidenceScore = predictionData.primary_prediction.confidence_score || 0;
      this.savedImageId = predictionData.saved_image_id || 0;
      
      // Display "Unknown" if confidence is below threshold, otherwise show actual disease
      if (this.confidenceScore < this.UNKNOWN_CONFIDENCE_THRESHOLD) {
        this.mainDisease = 'Unknown';
        console.log(`🔍 Low confidence (${this.confidenceScore}%) - displaying as Unknown, actual: ${this.actualDisease}`);
      } else {
        this.mainDisease = this.actualDisease;
        console.log(`✅ High confidence (${this.confidenceScore}%) - displaying actual disease: ${this.mainDisease}`);
      }
      
      // Process top 3 predictions
      if (predictionData.top_3_predictions && predictionData.top_3_predictions.length > 0) {
        this.probabilities = predictionData.top_3_predictions.map((pred: any) => ({
          class: pred.confidence < this.UNKNOWN_CONFIDENCE_THRESHOLD ? 'Unknown' : pred.disease,
          actualClass: pred.disease, // Store actual disease name
          confidence: pred.confidence,
          confidence_formatted: pred.confidence_formatted,
          treatment: pred.treatment,
          rank: pred.rank
        }));
        
        console.log('🎯 Loaded top 3 predictions:', {
          count: this.probabilities.length,
          predictions: this.probabilities.map(p => `${p.class}: ${p.confidence}% (actual: ${p.actualClass})`)
        });
      } else {
        console.log('⚠️ No top_3_predictions found in API response');
        this.probabilities = [];
      }
      
      this.confidenceLevel = predictionData.prediction_summary.confidence_level;
      this.diseaseInfo = this.getDiseaseInfo(this.mainDisease);
      
      console.log('Extracted data:', {
        mainDisease: this.mainDisease,
        confidenceScore: this.confidenceScore,
        savedImageId: this.savedImageId,
        confidenceLevel: this.confidenceLevel
      });
      
      console.log('Successfully processed results');
      
      // Set as verified since we removed the modal
      this.isVerified = true;
      
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
      'Stem end Rot': 'A post-harvest disease that affects fruits at the stem end, causing rot and reducing storage life.',
      'Unknown': 'The AI detection confidence is below 50%, making it difficult to accurately identify the condition. Please consult with agricultural experts or try capturing a clearer image for better analysis.'
    };

    return diseaseInfoMap[disease] || `Information about ${disease} is being researched. Please consult with agricultural experts for specific guidance.`;
  }

  formatConfidence(confidence: number): string {
    // Confidence from backend is already a percentage number (e.g., 85.67)
    return `${confidence.toFixed(1)}%`;
  }

  getConfidenceLevel(confidence: number): string {
    if (confidence >= 80) {
      return 'High';
    } else if (confidence >= 50) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  getTreatmentInfo(disease: string): string {
    const treatmentMap: { [key: string]: string } = {
      'Anthracnose': 'Apply copper-based fungicides and improve air circulation. Remove infected plant parts and avoid overhead watering.',
      'Bacterial Canker': 'Prune infected branches, apply copper bactericides, and improve plant hygiene. Avoid wounding during wet conditions.',
      'Cutting Weevil': 'Use appropriate insecticides, maintain field hygiene, and monitor regularly for early detection.',
      'Die Back': 'Prune affected branches, improve drainage, and apply appropriate fungicides. Ensure proper nutrition and avoid stress.',
      'Gall Midge': 'Use systemic insecticides, maintain field sanitation, and monitor for adult flies during peak activity periods.',
      'Healthy': 'Continue regular care including proper watering, fertilization, and monitoring for early signs of problems.',
      'Powdery Mildew': 'Apply sulfur-based fungicides, improve air circulation, and avoid overhead irrigation.',
      'Sooty Mold': 'Control the underlying insect problem (aphids, scales) and wash off mold with water.',
      'Black Mold Rot': 'Harvest fruits at proper maturity, handle carefully to avoid wounds, and store in proper conditions.',
      'Stem end Rot': 'Ensure proper fruit handling, avoid harvesting wet fruits, and maintain clean storage conditions.',
      'Unknown': 'Consider consulting with local agricultural experts or extension services. Try capturing a clearer, well-lit image from different angles. Monitor the plant closely for any changes and apply general preventive care practices.'
    };

    return treatmentMap[disease] || 'Consult with local agricultural experts for specific treatment recommendations.';
  }

  goBack() {
    this.router.navigate(['pages/home'], { replaceUrl: true, queryParams: { refresh: Date.now() } });
  }

  retakePhoto() {
    this.router.navigate(['pages/home'], { replaceUrl: true, queryParams: { refresh: Date.now() } });
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
