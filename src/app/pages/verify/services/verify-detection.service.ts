import { Injectable } from '@angular/core';

export interface DetectionResult {
  detectedDisease: string;
  confidence: number;
  topDiseases: any[];
  apiCallFailed: boolean;
  rawResult: any;
}

export interface ProcessedDetectionData {
  rawDisease: string;
  confidenceValue: number;
  topDiseases: any[];
}

@Injectable({
  providedIn: 'root'
})
export class VerifyDetectionService {

  private readonly CONFIDENCE_THRESHOLD = 30; // 30% minimum confidence

  constructor() { }

  /**
   * Get symptoms for a specific disease
   */
  getDiseaseSymptoms(disease: string): string[] {
    const symptomsMap: { [key: string]: string[] } = {
      'Anthracnose': [
        'Dark, sunken spots on fruits',
        'Black or brown lesions on leaves',
        'Spots may have pink or orange spore masses in humid conditions',
        'Premature fruit drop'
      ],
      'Bacterial Canker': [
        'Are the ends of branches drying up and dying?',
        'Is the drying moving from the tip towards the main branch?',
        'Does the plant look stressed or weak?'
      ],
      'Cutting Weevil': [
        'Small holes in young shoots and leaves',
        'Wilting of terminal shoots',
        'Presence of small weevil insects',
        'Damage typically at growing tips'
      ],
      'Die Back': [
        'Progressive death of branches from tips downward',
        'Browning and drying of leaves',
        'Bark cracking or splitting',
        'Reduced fruit production'
      ],
      'Gall Midge': [
        'Small bumps or galls on leaves',
        'Distorted leaf growth',
        'Presence of tiny flies around the plant',
        'Stunted shoot development'
      ],
      'Healthy': [
        'Vibrant green leaves',
        'Normal fruit development',
        'No visible spots or lesions',
        'Strong, healthy growth'
      ],
      'Powdery Mildew': [
        'White, powdery coating on leaves',
        'Yellowing of affected leaves',
        'Distorted or stunted growth',
        'Premature leaf drop'
      ],
      'Sooty Mould': [
        'Black, sooty coating on leaves and fruits',
        'Reduced photosynthesis',
        'Often associated with insect infestations',
        'Sticky honeydew substance present'
      ]
    };

    return symptomsMap[disease] || [
      'Look for any unusual discoloration or spots',
      'Check for changes in texture or firmness', 
      'Notice any abnormal growth patterns',
      'Consider environmental factors affecting the plant'
    ];
  }

  /**
   * Convert base64 image data to File object
   */
  base64ToFile(imageData: string): File {
    const base64 = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new File([byteArray], 'image.jpg', { type: 'image/jpeg' });
  }

  /**
   * Process detection result and extract structured data
   */
  processDetectionResult(detectionResult: any): ProcessedDetectionData {
    let topDiseases: any[] = [];

    // Extract top 3 diseases if available
    if (detectionResult.data && detectionResult.data.predictions) {
      topDiseases = detectionResult.data.predictions.slice(0, 3);
    } else if (detectionResult.predictions) {
      topDiseases = detectionResult.predictions.slice(0, 3);
    } else {
      // If no predictions array, create one from the single prediction
      topDiseases = [];
      
      // Try to get the primary prediction
      const primaryDisease = detectionResult.predicted_disease || 
                            detectionResult.disease || 
                            (detectionResult.data && detectionResult.data.primary_prediction && detectionResult.data.primary_prediction.disease);
                            
      if (primaryDisease) {
        const primaryConfidence = detectionResult.confidence || 
                     (detectionResult.data && detectionResult.data.primary_prediction && detectionResult.data.primary_prediction.confidence_score) || 0;
                     
        topDiseases.push({
          disease: primaryDisease,
          predicted_disease: primaryDisease,
          confidence: primaryConfidence
        });
        
        // Add some common alternative diseases for demonstration
        const commonAlternatives = ['Anthracnose', 'Bacterial Canker', 'Powdery Mildew', 'Die Back', 'Sooty Mould'];
        const filteredAlternatives = commonAlternatives.filter(disease => disease !== primaryDisease);
        
        // Add up to 2 alternatives with lower confidence
        filteredAlternatives.slice(0, 2).forEach((disease, index) => {
          topDiseases.push({
            disease: disease,
            predicted_disease: disease,
            confidence: Math.max(10, (primaryConfidence || 50) - 20 - (index * 10))
          });
        });
      }
      
    }

    // Extract disease name and confidence
    let rawDisease = '';
    let confidenceValue: number = 0;
    
    if (detectionResult.data && detectionResult.data.primary_prediction) {
      // Nested API response format
      const prediction = detectionResult.data.primary_prediction;
      rawDisease = prediction.disease || '';
      confidenceValue = prediction.confidence_score || 0;
    } else {
      // Direct API response format (fallback)
      rawDisease = detectionResult.predicted_disease || detectionResult.disease || '';
      const rawConfidence = detectionResult.confidence;
      
      // Handle different confidence formats
      if (typeof rawConfidence === 'string' && rawConfidence.includes('%')) {
        confidenceValue = parseFloat(rawConfidence.replace('%', ''));
      } else if (typeof rawConfidence === 'number') {
        if (rawConfidence <= 1) {
          // If confidence is a decimal (0.4558), convert to percentage
          confidenceValue = rawConfidence * 100;
        } else {
          // Already a percentage
          confidenceValue = rawConfidence;
        }
      } else {
        confidenceValue = 0;
      }
    }

    return {
      rawDisease,
      confidenceValue: Math.round(confidenceValue),
      topDiseases
    };
  }

  /**
   * Apply confidence threshold and get final detected disease
   */
  applyConfidenceThreshold(rawDisease: string, confidence: number): string {
    if (confidence < this.CONFIDENCE_THRESHOLD) {
      return 'Unknown';
    } else {
      return rawDisease || 'Unknown';
    }
  }

  /**
   * Get confidence threshold value
   */
  getConfidenceThreshold(): number {
    return this.CONFIDENCE_THRESHOLD;
  }
}