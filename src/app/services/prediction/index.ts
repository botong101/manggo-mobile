/**
 * Prediction Services Index
 * Central export point for all prediction-related services and types
 */

// Core service (base class)
export { PredictionCoreService } from './prediction-core.service';

// Specialized services
export { VerifyPredictionService } from './verify-prediction.service';
export { StandardPredictionService } from './standard-prediction.service';
export { ConfirmationService } from './confirmation.service';

// Shared types
export { LocationData, ApiResponse, UserConfirmation } from './prediction.types';
