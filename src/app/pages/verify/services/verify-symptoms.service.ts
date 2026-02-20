import { Injectable } from '@angular/core';

export interface SymptomsData {
  // main disease stuff
  detectedDisease: string;
  confidence: number;
  primarySymptoms: string[];
  selectedPrimarySymptoms: string[];
  
  // backup disease stuff
  topDiseases: any[];
  alternativeSymptoms: string[];
  selectedAlternativeSymptoms: string[];
  
  // everything combined
  allSelectedSymptoms: string[];
  
  // what user said
  isDetectionCorrect: boolean;
  userFeedback: string;
  
  // numbers
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

  // ============================================
  // main helper functions
  // ============================================

  /**
   * get the main symptoms user checked
   */
  getSelectedPrimarySymptoms(
    primarySymptoms: string[],
    selectedPrimarySymptoms: boolean[]
  ): string[] {
    return primarySymptoms.filter((_, index) => selectedPrimarySymptoms[index] === true);
  }

  /**
   * get the extra symptoms user checked
   */
  getSelectedAlternativeSymptoms(
    alternativeSymptoms: string[],
    selectedAlternativeSymptoms: boolean[]
  ): string[] {
    return alternativeSymptoms.filter((_, index) => selectedAlternativeSymptoms[index] === true);
  }

  /**
   * mash together main and extra checked symptoms
   */
  getAllSelectedSymptoms(
    primarySymptoms: string[],
    selectedPrimarySymptoms: boolean[],
    alternativeSymptoms: string[],
    selectedAlternativeSymptoms: boolean[]
  ): string[] {
    const selectedPrimary = this.getSelectedPrimarySymptoms(primarySymptoms, selectedPrimarySymptoms);
    const selectedAlternative = this.getSelectedAlternativeSymptoms(alternativeSymptoms, selectedAlternativeSymptoms);
    return [...selectedPrimary, ...selectedAlternative];
  }

  /**
   * did they check anything
   */
  hasSelectedSymptoms(
    selectedPrimarySymptoms: boolean[],
    selectedAlternativeSymptoms: boolean[]
  ): boolean {
    const hasPrimary = selectedPrimarySymptoms.some(s => s === true);
    const hasAlternative = selectedAlternativeSymptoms.some(s => s === true);
    return hasPrimary || hasAlternative;
  }

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
    // use the helper methods so no duplicate code
    const selectedPrimary = this.getSelectedPrimarySymptoms(primarySymptoms, selectedPrimarySymptoms);
    const selectedAlternative = this.getSelectedAlternativeSymptoms(alternativeSymptoms, selectedAlternativeSymptoms);
    const allSelected = [...selectedPrimary, ...selectedAlternative];
    
    return {
      //primary symptoms
      detectedDisease: detectedDisease,
      confidence: confidence,
      primarySymptoms: primarySymptoms,
      selectedPrimarySymptoms: selectedPrimary,
      
      //top 2 and 3 symptoms
      topDiseases: topDiseases,
      alternativeSymptoms: alternativeSymptoms,
      selectedAlternativeSymptoms: selectedAlternative,
      
      //top 1-3 sypmtoms
      allSelectedSymptoms: allSelected,
      
      //user verify
      isDetectionCorrect: isDetectionCorrect === 'true',
      userFeedback: userFeedback || '',
      
      //stats
      totalSymptomsAvailable: primarySymptoms.length + alternativeSymptoms.length,
      totalSymptomsSelected: allSelected.length,
      primarySymptomsSelected: selectedPrimary.length,
      alternativeSymptomsSelected: selectedAlternative.length
    };
  }


  extractAlternativeSymptoms(
    topDiseases: any[], 
    getDiseaseSymptoms: (disease: string) => string[]
  ): { symptoms: string[], selectionArray: boolean[] } {
    const alternativeSymptoms: string[] = [];
    
    
    if (topDiseases.length >= 2) {
      // symptoms from disease #2
      const secondDisease = topDiseases[1].disease || topDiseases[1].predicted_disease;
      if (secondDisease) {
        const secondSymptoms = getDiseaseSymptoms(secondDisease);
        alternativeSymptoms.push(...secondSymptoms);
      }
    }
    
    if (topDiseases.length >= 3) {
      // symptoms from disease #3
      const thirdDisease = topDiseases[2].disease || topDiseases[2].predicted_disease;
      if (thirdDisease) {
        const thirdSymptoms = getDiseaseSymptoms(thirdDisease);
        alternativeSymptoms.push(...thirdSymptoms);
      }
    }
    
    // make checkboxes for alternatives
    const selectionArray = this.initializeSelectionArray(alternativeSymptoms.length);
    

    return {
      symptoms: alternativeSymptoms,
      selectionArray: selectionArray
    };
  }

  
  initializeSelectionArray(totalSymptomsCount: number): boolean[] {
    return new Array(totalSymptomsCount).fill(false);
  }

  validateSymptomsData(data: any): boolean {
    const requiredFields = [
      'detectedDisease', 'confidence', 'primarySymptoms',
      'topDiseases', 'alternativeSymptoms', 'allSelectedSymptoms',
      'isDetectionCorrect', 'userFeedback',
      'totalSymptomsAvailable', 'totalSymptomsSelected'
    ];
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }
    
    // check if arrays are actually arrays
    const arrayFields = ['primarySymptoms', 'topDiseases', 
                        'alternativeSymptoms', 'allSelectedSymptoms'];
    
    for (const field of arrayFields) {
      if (!Array.isArray(data[field])) {
        console.error(`Field ${field} should be an array`);
        return false;
      }
    }
    
    return true;
  }

}