import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VerifyUtilsService {

  constructor() { }

  /**
   * Show toast helper for verify component
   */
  getToastConfig(message: string, color: string = 'medium') {
    return {
      message: message,
      duration: 3000,
      color: color,
      position: 'top' as 'top'
    };
  }

  /**
   * Format confidence percentage
   */
  formatConfidence(confidence: number): string {
    return `${Math.round(confidence)}%`;
  }

  /**
   * Get step progress for UI
   */
  getStepProgress(currentStep: number, totalSteps: number): {
    current: number;
    total: number;
    percentage: number;
  } {
    return {
      current: currentStep,
      total: totalSteps,
      percentage: Math.round((currentStep / totalSteps) * 100)
    };
  }

  /**
   * Validate image data
   */
  isValidImageData(imageData: string | null): boolean {
    if (!imageData) return false;
    return imageData.startsWith('data:image/') && imageData.includes('base64,');
  }

  /**
   * Get error message based on error type
   */
  getErrorMessage(error: any): string {
    let errorMessage = 'An unexpected error occurred. Please try again.';
    
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('connect')) {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      } else if (error.message.includes('format') || error.message.includes('415')) {
        errorMessage = 'Image format not supported. Please try a different image.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }
    }
    
    return errorMessage;
  }

  /**
   * Debounce function for user input
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: any;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Generate unique ID for tracking
   */
  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Log component events with consistent formatting
   */
  logEvent(event: string, data?: any) {
    const timestamp = new Date().toISOString();
    const prefix = '[VerifyPage]';
    
    if (data) {
      console.log(`${prefix} ${event}:`, data);
    } else {
      console.log(`${prefix} ${event}`);
    }
  }

  /**
   * Format location data for display
   */
  formatLocationData(location: any): string {
    if (!location) return 'Location not available';
    
    if (location.latitude && location.longitude) {
      return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    }
    
    if (location.address) {
      return location.address;
    }
    
    return 'Location detected';
  }

  /**
   * Validate form data before submission
   */
  validateFormData(formData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!formData.imageData) {
      errors.push('Image data is required');
    }
    
    if (formData.isDetectionCorrect === null || formData.isDetectionCorrect === undefined) {
      errors.push('Please verify the detection result');
    }
    
    if (formData.locationAccuracyConfirmed === null || formData.locationAccuracyConfirmed === undefined) {
      errors.push('Please confirm location accuracy');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}