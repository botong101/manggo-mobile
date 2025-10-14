import { Injectable } from '@angular/core';

export interface VerifyWorkflowState {
  currentStep: 1 | 2 | 3 | 4;
  totalSteps: number;
  isDetectionCorrect: string | null;
  locationAccuracyConfirmed: string | null;
  userFeedback: string;
  isProcessing: boolean;
}

export interface WorkflowStepInfo {
  stepNumber: number;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VerifyWorkflowService {

  private readonly TOTAL_STEPS = 4;

  constructor() { }

  /**
   * Initialize workflow state
   */
  initializeWorkflow(): VerifyWorkflowState {
    return {
      currentStep: 1,
      totalSteps: this.TOTAL_STEPS,
      isDetectionCorrect: null,
      locationAccuracyConfirmed: null,
      userFeedback: '',
      isProcessing: false
    };
  }

  /**
   * Get step information for UI display
   */
  getStepInfo(currentStep: number): WorkflowStepInfo[] {
    const steps = [
      {
        stepNumber: 1,
        title: 'Image Analysis',
        description: 'AI analyzing your image...',
        isComplete: currentStep > 1,
        isActive: currentStep === 1
      },
      {
        stepNumber: 2,
        title: 'Verify Detection',
        description: 'Please verify the AI detection result',
        isComplete: currentStep > 2,
        isActive: currentStep === 2
      },
      {
        stepNumber: 3,
        title: 'Select Symptoms',
        description: 'Check symptoms that match your observation',
        isComplete: currentStep > 3,
        isActive: currentStep === 3
      },
      {
        stepNumber: 4,
        title: 'Location & Save',
        description: 'Confirm location and save your analysis',
        isComplete: currentStep > 4,
        isActive: currentStep === 4
      }
    ];

    return steps;
  }

  /**
   * Check if current step can proceed to next
   */
  canProceedFromStep(step: number, state: VerifyWorkflowState): boolean {
    switch (step) {
      case 1:
        return true; // Step 1 proceeds automatically after API call
      case 2:
        return state.isDetectionCorrect !== null;
      case 3:
        return true; // Symptoms selection is optional, always can proceed
      case 4:
        return state.locationAccuracyConfirmed !== null;
      default:
        return false;
    }
  }

  /**
   * Get next step number
   */
  getNextStep(currentStep: number): number {
    return Math.min(currentStep + 1, this.TOTAL_STEPS);
  }

  /**
   * Get previous step number
   */
  getPreviousStep(currentStep: number): number {
    return Math.max(currentStep - 1, 1);
  }

  /**
   * Advance to next step if conditions are met
   */
  advanceStep(state: VerifyWorkflowState): VerifyWorkflowState {
    if (this.canProceedFromStep(state.currentStep, state)) {
      return {
        ...state,
        currentStep: this.getNextStep(state.currentStep) as 1 | 2 | 3 | 4
      };
    }
    return state;
  }

  /**
   * Go back to previous step
   */
  goBackStep(state: VerifyWorkflowState): VerifyWorkflowState {
    return {
      ...state,
      currentStep: this.getPreviousStep(state.currentStep) as 1 | 2 | 3 | 4
    };
  }

  /**
   * Check if workflow is complete
   */
  isWorkflowComplete(state: VerifyWorkflowState): boolean {
    return state.currentStep === this.TOTAL_STEPS && 
           this.canProceedFromStep(this.TOTAL_STEPS, state);
  }

  /**
   * Get validation errors for current step
   */
  getStepValidationErrors(step: number, state: VerifyWorkflowState): string[] {
    const errors: string[] = [];

    switch (step) {
      case 2:
        if (state.isDetectionCorrect === null) {
          errors.push('Please verify if the detection result is correct');
        }
        break;
      case 4:
        if (state.locationAccuracyConfirmed === null) {
          errors.push('Please confirm the location accuracy');
        }
        break;
    }

    return errors;
  }

  /**
   * Calculate workflow progress percentage
   */
  getProgressPercentage(currentStep: number): number {
    return Math.round((currentStep / this.TOTAL_STEPS) * 100);
  }

  /**
   * Update workflow state with form data
   */
  updateWorkflowState(
    state: VerifyWorkflowState, 
    updates: Partial<VerifyWorkflowState>
  ): VerifyWorkflowState {
    return {
      ...state,
      ...updates
    };
  }

  /**
   * Reset workflow to initial state
   */
  resetWorkflow(): VerifyWorkflowState {
    return this.initializeWorkflow();
  }
}