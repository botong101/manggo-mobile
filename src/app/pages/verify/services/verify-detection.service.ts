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

  private readonly CONFIDENCE_THRESHOLD = 30; 

  constructor() { }

 
  getDiseaseSymptoms(disease: string, plantPart: 'fruit' | 'leaf'): string[]{
    const symptomsMap: {[key:string]:{fruit:string[], leaf:string[]} } = {
      'Anthracnose':{ 
        fruit: [
          'Dark, sunken spots on fruits',
          'Black or brown lesions on leaves',
          'Spots may have pink or orange spore masses in humid conditions',
          'Premature fruit drop'
        ],
        leaf: [
          'Irregular brown or black spots on leaves',
          'lesions with dark borders',
          'yellowing around affected areas',
          'Premature leaf drop',
        ]
      },
      'Bacterial Canker':{ 
        fruit: [
          'Are the ends of branches drying up and dying?',
          'Is the drying moving from the tip towards the main branch?',
          'Does the plant look stressed or weak?'
        ],
        leaf:[
          'Water-soaked spots on leaves',
          'Yellowing of leaf margins',
          'Brown, dead areas on leaves',
          'Leaf wilting and drop'
        ],
      },
      'Cutting Weevil': {
        fruit: [
          'Small holes in young shoots and leaves',
          'Wilting of terminal shoots',
          'Presence of small weevil insects',
          'Damage typically at growing tips'
        ],
        leaf: [
          'Browning and drying of leaves from tip backward',
          'Yellowing before browning',
          'Leaf curling and wilting',
          'Defoliation starting from branch tips'
        ]
      },
      'Die Back': {
        fruit:[
          'Progressive death of branches from tips downward',
          'Browning and drying of leaves',
          'Bark cracking or splitting',
          'Reduced fruit production'
        ],
        leaf:[
          'Browning and drying of leaves',
          'Yellowing before browning',
          'Leaf curling and wilting',
          'Defoliation starting from branch tips'
        ]
      },
      'Gall Midge': {
        fruit: [
          'Small bumps or galls on leaves',
          'Distorted leaf growth',
          'Presence of tiny flies around the plant',
          'Stunted shoot development'
        ],
        leaf: [
          'Small bumps or galls on leaf surface',
          'Distorted and twisted leaf growth',
          'Yellowing around gall areas',
          'Stunted leaf development'
        ]
      },
      'Healthy': { 
        fruit: [
          'Normal fruit development',
          'Uniform color and size',
          'Smooth, firm texture',
          'No visible spots or lesions'
        ],
        leaf: [
          'Vibrant green color',
          'Smooth, unblemished surface',
          'Normal size and shape',
          'No discoloration or spots'
        ]
      },
      'Powdery Mildew': {
        fruit:[
          'White, powdery coating on leaves',
          'Yellowing of affected leaves',
          'Distorted or stunted growth',
          'Premature leaf drop'
        ],
        leaf:[
          'White, powdery coating on leaf surfaces',
          'Yellowing of affected leaves',
          'Leaf curling and distortion',
          'Premature leaf drop'
        ]
      },
      'Sooty Mould': {
        fruit:[
          'Black, sooty coating on fruit surface',
          'Sticky residue on fruits',
          'Cosmetic damage (fruit still edible)',
          'Associated with insect infestations'
        ],
        leaf:[
          'Black, sooty coating on upper leaf surface',
          'Reduced photosynthesis',
          'Yellowing of leaves beneath coating',
          'Sticky honeydew substance present'
        ]
      }
    };
    const diseaseSymptoms = symptomsMap[disease];

    if(diseaseSymptoms){
      return diseaseSymptoms[plantPart];
    }
    return [
      'Look for any unusual discoloration or spots',
      'Check for changes in texture or firmness', 
      'Notice any abnormal growth patterns',
      'Consider environmental factors affecting the plant'
    ];
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