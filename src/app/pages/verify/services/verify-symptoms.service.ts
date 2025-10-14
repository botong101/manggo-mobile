import { Injectable } from '@angular/core';

export interface SymptomsData {
  // Primary disease and symptoms
  detectedDisease: string;
  confidence: number;
  primarySymptoms: string[];
  selectedPrimarySymptoms: string[];
  
  // Alternative diseases and symptoms
  topDiseases: any[];
  alternativeSymptoms: string[];
  selectedAlternativeSymptoms: string[];
  
  // Combined selected symptoms
  allSelectedSymptoms: string[];
  
  // User verification
  isDetectionCorrect: boolean;
  userFeedback: string;
  
  // Statistics
  totalSymptomsAvailable: number;
  totalSymptomsSelected: number;
  primarySymptomsSelected: number;
  alternativeSymptomsSelected: number;
}

@Injectable({
  providedIn: 'root'
})
export class VerifySymptomsService {

  constructor() { }

  /**
   * Get all selected symptoms combining primary and alternative
   */
  getAllSelectedSymptoms(
    primarySymptoms: string[],
    selectedPrimarySymptoms: boolean[],
    alternativeSymptoms: string[],
    selectedAlternativeSymptoms: boolean[]
  ): string[] {
    const selectedPrimary = primarySymptoms.filter((_, i) => selectedPrimarySymptoms[i]);
    const selectedAlternative = alternativeSymptoms.filter((_, i) => selectedAlternativeSymptoms[i]);
    return [...selectedPrimary, ...selectedAlternative];
  }

  /**
   * Prepare comprehensive symptoms data for API backend with separate arrays
   */
  prepareSymptomsDataForAPI(
    detectedDisease: string,
    confidence: number,
    primarySymptoms: string[],
    selectedPrimarySymptoms: boolean[],
    alternativeSymptoms: string[],
    selectedAlternativeSymptoms: boolean[],
    topDiseases: any[],
    isDetectionCorrect: string | null,
    userFeedback: string
  ): SymptomsData {
    // Extract selected symptoms from boolean arrays
    const selectedPrimary = primarySymptoms.filter((_, i) => selectedPrimarySymptoms[i]);
    const selectedAlternative = alternativeSymptoms.filter((_, i) => selectedAlternativeSymptoms[i]);
    const allSelected = [...selectedPrimary, ...selectedAlternative];
    
    return {
      // Primary disease and symptoms
      detectedDisease: detectedDisease,
      confidence: confidence,
      primarySymptoms: primarySymptoms,
      selectedPrimarySymptoms: selectedPrimary,
      
      // Alternative diseases and symptoms
      topDiseases: topDiseases,
      alternativeSymptoms: alternativeSymptoms,
      selectedAlternativeSymptoms: selectedAlternative,
      
      // Combined selected symptoms
      allSelectedSymptoms: allSelected,
      
      // User verification
      isDetectionCorrect: isDetectionCorrect === 'true',
      userFeedback: userFeedback || '',
      
      // Statistics
      totalSymptomsAvailable: primarySymptoms.length + alternativeSymptoms.length,
      totalSymptomsSelected: allSelected.length,
      primarySymptomsSelected: selectedPrimary.length,
      alternativeSymptomsSelected: selectedAlternative.length
    };
  }

  /**
   * Extract alternative symptoms from diseases (excluding primary disease)
   */
  extractAlternativeSymptoms(
    topDiseases: any[], 
    getDiseaseSymptoms: (disease: string) => string[]
  ): { symptoms: string[], selectionArray: boolean[] } {
    const alternativeSymptoms: string[] = [];
    
    console.log('🔍 Extracting alternative symptoms from topDiseases:', topDiseases);
    
    if (topDiseases.length >= 2) {
      // Get symptoms from 2nd disease
      const secondDisease = topDiseases[1].disease || topDiseases[1].predicted_disease;
      console.log('🔍 Second disease found:', secondDisease);
      if (secondDisease) {
        const secondSymptoms = getDiseaseSymptoms(secondDisease);
        alternativeSymptoms.push(...secondSymptoms);
        console.log('🔍 Added symptoms for second disease:', secondSymptoms.length);
      }
    }
    
    if (topDiseases.length >= 3) {
      // Get symptoms from 3rd disease
      const thirdDisease = topDiseases[2].disease || topDiseases[2].predicted_disease;
      console.log('🔍 Third disease found:', thirdDisease);
      if (thirdDisease) {
        const thirdSymptoms = getDiseaseSymptoms(thirdDisease);
        alternativeSymptoms.push(...thirdSymptoms);
        console.log('🔍 Added symptoms for third disease:', thirdSymptoms.length);
      }
    }
    
    // Initialize selection array for alternative symptoms
    const selectionArray = new Array(alternativeSymptoms.length).fill(false);
    
    console.log('🔍 Alternative symptoms extracted:', {
      total: alternativeSymptoms.length,
      symptoms: alternativeSymptoms,
      topDiseasesCount: topDiseases.length
    });

    return {
      symptoms: alternativeSymptoms,
      selectionArray: selectionArray
    };
  }

  /**
   * Initialize unified symptoms selection array
   */
  initializeSelectionArray(totalSymptomsCount: number): boolean[] {
    return new Array(totalSymptomsCount).fill(false);
  }

  /**
   * Validate symptoms data structure
   */
  validateSymptomsData(data: any): boolean {
    const requiredFields = [
      'detectedDisease', 'confidence', 'primarySymptoms',
      'topDiseases', 'alternativeSymptoms', 'allSymptoms', 'allSelectedSymptoms',
      'isDetectionCorrect', 'userFeedback',
      'totalSymptomsAvailable', 'totalSymptomsSelected'
    ];
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }
    
    // Validate array fields
    const arrayFields = ['primarySymptoms', 'topDiseases', 
                        'alternativeSymptoms', 'allSymptoms', 'allSelectedSymptoms'];
    
    for (const field of arrayFields) {
      if (!Array.isArray(data[field])) {
        console.error(`Field ${field} should be an array`);
        return false;
      }
    }
    
    // Validate that allSymptoms = primarySymptoms + alternativeSymptoms
    const expectedTotal = data.primarySymptoms.length + data.alternativeSymptoms.length;
    if (data.allSymptoms.length !== expectedTotal) {
      console.error(`Total symptoms count mismatch. Expected: ${expectedTotal}, Got: ${data.allSymptoms.length}`);
      return false;
    }
    
    console.log('✅ Symptoms data validation passed!');
    return true;
  }
}