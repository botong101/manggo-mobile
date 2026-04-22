import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SymptomItem {
  key: string;
  label: string;
}

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

const FALLBACK_SYMPTOMS: SymptomItem[] = [
  { key: 'obs_discolouration', label: 'Look for any unusual discoloration or spots' },
  { key: 'obs_texture',        label: 'Check for changes in texture or firmness' },
  { key: 'obs_growth',         label: 'Notice any abnormal growth patterns' },
  { key: 'obs_environment',    label: 'Consider environmental factors affecting the plant' },
];

@Injectable({
  providedIn: 'root'
})
export class VerifyDetectionService {

  private readonly CONFIDENCE_THRESHOLD = 30;

  constructor(private http: HttpClient) {}

  async getDiseaseSymptoms(disease: string, plantPart: 'fruit' | 'leaf'): Promise<SymptomItem[]> {
    if (!disease || disease === 'Unknown') {
      return FALLBACK_SYMPTOMS;
    }
    try {
      const url = `${environment.apiUrl}/symptoms/?disease=${encodeURIComponent(disease)}&plant_part=${plantPart}`;
      const response = await firstValueFrom(
        this.http.get<{ disease: string; plant_part: string; symptoms: SymptomItem[] }>(url)
      );
      return response.symptoms?.length ? response.symptoms : FALLBACK_SYMPTOMS;
    } catch {
      return FALLBACK_SYMPTOMS;
    }
  }

  //turn base64 string into file object
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
   * take api result and organize it nice
   */
  processDetectionResult(detectionResult: any): ProcessedDetectionData {
    let topDiseases: any[] = [];

    // grab top 3 if we got em
    if (detectionResult.data && detectionResult.data.predictions) {
      topDiseases = detectionResult.data.predictions.slice(0, 3);
    } else if (detectionResult.predictions) {
      topDiseases = detectionResult.predictions.slice(0, 3);
    } else {
      // no array so build one ourselves
      topDiseases = [];

      // try to find the main one
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

        // throw in some common diseases too
        const commonAlternatives = ['Anthracnose', 'Bacterial Canker', 'Powdery Mildew', 'Die Back', 'Sooty Mould'];
        const filteredAlternatives = commonAlternatives.filter(disease => disease !== primaryDisease);

        // add 2 more with lower confidence
        filteredAlternatives.slice(0, 2).forEach((disease, index) => {
          topDiseases.push({
            disease: disease,
            predicted_disease: disease,
            confidence: Math.max(10, (primaryConfidence || 50) - 20 - (index * 10))
          });
        });
      }
    }

    // pull out disease name and confidence
    let rawDisease = '';
    let confidenceValue: number = 0;

    if (detectionResult.data && detectionResult.data.primary_prediction) {
      // newer format
      const prediction = detectionResult.data.primary_prediction;
      rawDisease = prediction.disease || '';
      confidenceValue = prediction.confidence_score || 0;
    } else {
      // old format backup
      rawDisease = detectionResult.predicted_disease || detectionResult.disease || '';
      const rawConfidence = detectionResult.confidence;

      // confidence can come in diff formats ugh
      if (typeof rawConfidence === 'string' && rawConfidence.includes('%')) {
        confidenceValue = parseFloat(rawConfidence.replace('%', ''));
      } else if (typeof rawConfidence === 'number') {
        if (rawConfidence <= 1) {
          // decimal like 0.45 so times 100
          confidenceValue = rawConfidence * 100;
        } else {
          // its already percentage
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
   * use unknown if confidence too low
   */
  applyConfidenceThreshold(rawDisease: string, confidence: number): string {
    if (confidence < this.CONFIDENCE_THRESHOLD) {
      return 'Unknown';
    } else {
      return rawDisease || 'Unknown';
    }
  }

  /**
   * get the threshold number
   */
  getConfidenceThreshold(): number {
    return this.CONFIDENCE_THRESHOLD;
  }
}
