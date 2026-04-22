import { Injectable } from '@angular/core';
import { SymptomItem } from './verify-detection.service';

export interface SymptomsData {
  // main disease stuff
  detectedDisease: string;
  confidence: number;
  primarySymptoms: SymptomItem[];
  selectedPrimarySymptoms: SymptomItem[];   // checked ones — for display in step 4

  // backup disease stuff
  topDiseases: any[];
  alternativeSymptoms: SymptomItem[];
  selectedAlternativeSymptoms: SymptomItem[]; // checked ones — for display in step 4

  // keys sent to backend (canonical keys only — feeds XGBoost encoder)
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

  getSelectedPrimarySymptoms(
    primarySymptoms: SymptomItem[],
    selectedBooleans: boolean[]
  ): SymptomItem[] {
    return primarySymptoms.filter((_, i) => selectedBooleans[i] === true);
  }

  getSelectedAlternativeSymptoms(
    alternativeSymptoms: SymptomItem[],
    selectedBooleans: boolean[]
  ): SymptomItem[] {
    return alternativeSymptoms.filter((_, i) => selectedBooleans[i] === true);
  }

  getAllSelectedSymptoms(
    primarySymptoms: SymptomItem[],
    selectedPrimaryBooleans: boolean[],
    alternativeSymptoms: SymptomItem[],
    selectedAlternativeBooleans: boolean[]
  ): SymptomItem[] {
    const selectedPrimary = this.getSelectedPrimarySymptoms(primarySymptoms, selectedPrimaryBooleans);
    const selectedAlternative = this.getSelectedAlternativeSymptoms(alternativeSymptoms, selectedAlternativeBooleans);
    return [...selectedPrimary, ...selectedAlternative];
  }

  hasSelectedSymptoms(
    selectedPrimaryBooleans: boolean[],
    selectedAlternativeBooleans: boolean[]
  ): boolean {
    return selectedPrimaryBooleans.some(s => s === true) ||
           selectedAlternativeBooleans.some(s => s === true);
  }

  prepareSymptomsDataForAPI(
    detectedDisease: string,
    confidence: number,
    primarySymptoms: SymptomItem[],
    selectedPrimaryBooleans: boolean[],
    alternativeSymptoms: SymptomItem[],
    selectedAlternativeBooleans: boolean[],
    topDiseases: any[],
    isDetectionCorrect: string | null,
    userFeedback: string
  ): SymptomsData {
    const selectedPrimary = this.getSelectedPrimarySymptoms(primarySymptoms, selectedPrimaryBooleans);
    const selectedAlternative = this.getSelectedAlternativeSymptoms(alternativeSymptoms, selectedAlternativeBooleans);
    // canonical keys only — what the XGBoost encoder reads from the DB
    const allSelectedKeys = [...selectedPrimary, ...selectedAlternative].map(s => s.key);

    return {
      detectedDisease,
      confidence,
      primarySymptoms,
      selectedPrimarySymptoms: selectedPrimary,

      topDiseases,
      alternativeSymptoms,
      selectedAlternativeSymptoms: selectedAlternative,

      allSelectedSymptoms: allSelectedKeys,

      isDetectionCorrect: isDetectionCorrect === 'true',
      userFeedback: userFeedback || '',

      totalSymptomsAvailable: primarySymptoms.length + alternativeSymptoms.length,
      totalSymptomsSelected: allSelectedKeys.length,
      primarySymptomsSelected: selectedPrimary.length,
      alternativeSymptomsSelected: selectedAlternative.length,
    };
  }

  async extractAlternativeSymptoms(
    topDiseases: any[],
    getDiseaseSymptoms: (disease: string) => Promise<SymptomItem[]>
  ): Promise<{ symptoms: SymptomItem[], selectionArray: boolean[] }> {
    const diseasesToFetch: string[] = [];
    if (topDiseases.length >= 2) {
      const second = topDiseases[1].disease || topDiseases[1].predicted_disease;
      if (second) diseasesToFetch.push(second);
    }
    if (topDiseases.length >= 3) {
      const third = topDiseases[2].disease || topDiseases[2].predicted_disease;
      if (third) diseasesToFetch.push(third);
    }

    const results = await Promise.all(diseasesToFetch.map(d => getDiseaseSymptoms(d)));
    const alternativeSymptoms: SymptomItem[] = ([] as SymptomItem[]).concat(...results);

    return {
      symptoms: alternativeSymptoms,
      selectionArray: this.initializeSelectionArray(alternativeSymptoms.length),
    };
  }

  initializeSelectionArray(count: number): boolean[] {
    return new Array(count).fill(false);
  }

  validateSymptomsData(data: any): boolean {
    const requiredFields = [
      'detectedDisease', 'confidence', 'primarySymptoms',
      'topDiseases', 'alternativeSymptoms', 'allSelectedSymptoms',
      'isDetectionCorrect', 'userFeedback',
      'totalSymptomsAvailable', 'totalSymptomsSelected',
    ];
    for (const field of requiredFields) {
      if (!(field in data)) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }
    const arrayFields = ['primarySymptoms', 'topDiseases', 'alternativeSymptoms', 'allSelectedSymptoms'];
    for (const field of arrayFields) {
      if (!Array.isArray(data[field])) {
        console.error(`Field ${field} should be an array`);
        return false;
      }
    }
    return true;
  }
}
