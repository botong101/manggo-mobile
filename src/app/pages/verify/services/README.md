# Verify Component Services

This folder contains local services specifically for the verify component to improve code organization and readability.

## Services Overview

### 📋 `verify-symptoms.service.ts`
**Purpose**: Handle all symptom-related logic and data preparation
- Extract alternative symptoms from top diseases
- Prepare comprehensive data structure for API
- Validate symptoms data
- Initialize selection arrays

**Key Methods:**
```typescript
getAllSelectedSymptoms(symptoms, selected, altSymptoms, altSelected)
prepareSymptomsDataForAPI(disease, confidence, symptoms, ...)
extractAlternativeSymptoms(topDiseases, getDiseaseSymptoms)
validateSymptomsData(data)
```

### 🔍 `verify-detection.service.ts`
**Purpose**: Handle AI detection processing and disease mapping
- Map diseases to their symptoms
- Process detection API responses
- Apply confidence thresholds
- Convert image formats

**Key Methods:**
```typescript
getDiseaseSymptoms(disease)
base64ToFile(imageData)
processDetectionResult(detectionResult)
applyConfidenceThreshold(rawDisease, confidence)
```

### 🔄 `verify-workflow.service.ts`
**Purpose**: Manage step-by-step verification workflow
- Initialize and manage workflow state
- Handle step navigation
- Validate step completion
- Track progress

**Key Methods:**
```typescript
initializeWorkflow()
advanceStep(state)
canProceedFromStep(step, state)
getStepValidationErrors(step, state)
```

### 🛠️ `verify-utils.service.ts`
**Purpose**: Utility functions for the verify component
- Toast configuration
- Error message formatting
- Progress calculation
- Form validation

**Key Methods:**
```typescript
getToastConfig(message, color)
getErrorMessage(error)
formatConfidence(confidence)
validateFormData(formData)
```

## Usage Example

### In verify.page.ts:

```typescript
import { VerifySymptomsService, SymptomsData } from './services/verify-symptoms.service';
import { VerifyDetectionService } from './services/verify-detection.service';
import { VerifyWorkflowService } from './services/verify-workflow.service';
import { VerifyUtilsService } from './services/verify-utils.service';

export class VerifyPage implements OnInit {
  constructor(
    private symptomsService: VerifySymptomsService,
    private detectionService: VerifyDetectionService,
    private workflowService: VerifyWorkflowService,
    private utilsService: VerifyUtilsService
  ) {}

  // Use symptoms service
  prepareSymptomsDataForAPI(): SymptomsData {
    return this.symptomsService.prepareSymptomsDataForAPI(
      this.detectedDisease,
      this.confidence,
      this.symptoms,
      this.selectedSymptoms,
      this.alternativeSymptoms,
      this.selectedAlternativeSymptoms,
      this.topDiseases,
      this.isDetectionCorrect,
      this.userFeedback
    );
  }

  // Use detection service
  getDiseaseSymptoms(disease: string): string[] {
    return this.detectionService.getDiseaseSymptoms(disease);
  }

  // Use utils service
  showToast(message: string, color: string) {
    const config = this.utilsService.getToastConfig(message, color);
    // Apply config to toast
  }
}
```

## Benefits

### 🎯 **Single Responsibility**
Each service has a clear, focused purpose:
- Symptoms service only handles symptom logic
- Detection service only handles detection processing
- Workflow service only handles step management
- Utils service only handles common utilities

### ♻️ **Reusability**
Services can be easily:
- Reused in other components
- Extended with new functionality
- Tested independently
- Mocked for unit testing

### 📚 **Maintainability**
- Easy to find and modify specific functionality
- Clear separation of concerns
- Reduced component complexity
- Better code organization

### 🧪 **Testability**
- Each service can be unit tested in isolation
- Easy to mock dependencies
- Clear interfaces for testing
- Better coverage possibilities

## Integration Steps

1. **Import services** in your component
2. **Inject via constructor** dependency injection
3. **Replace existing methods** to use services
4. **Test functionality** to ensure everything works
5. **Remove old code** that's been moved to services

## File Structure
```
verify/
├── verify.page.ts (main component - now cleaner)
├── verify.page.html
├── verify.page.scss
└── services/
    ├── verify-symptoms.service.ts
    ├── verify-detection.service.ts
    ├── verify-workflow.service.ts
    └── verify-utils.service.ts
```

This approach keeps all verify-related functionality organized within the verify component folder while improving code structure and maintainability.