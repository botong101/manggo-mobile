/**
 * Shared Types for Prediction Services
 * Common interfaces used across prediction-related operations
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  source: 'exif' | 'gps' | 'manual';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface UserConfirmation {
  imageId?: number;
  image_id?: number;
  isCorrect?: boolean;
  is_correct?: boolean;
  actualDisease?: string;
  predicted_disease?: string;
  feedback?: string;
  user_feedback?: string;
  confidence_score?: number;
  location_consent_given?: boolean;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_address?: string;
  location_source?: string;
}
