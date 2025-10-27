# Prediction Services Architecture

## 📁 Service Structure

```
services/
├── prediction/                          # Modular prediction services
│   ├── index.ts                        # Central export point
│   ├── prediction.types.ts             # Shared interfaces/types
│   ├── prediction-core.service.ts      # Base service with common functionality
│   ├── verify-prediction.service.ts    # For verify page workflow
│   ├── standard-prediction.service.ts  # For standard prediction operations
│   └── confirmation.service.ts         # For user confirmation/feedback
│
├── apiservice.service.ts               # LEGACY - backward compatibility wrapper
├── location.service.ts                 # Device GPS location handling
├── exif-location.service.ts            # Image EXIF metadata extraction
└── address.service.ts                  # Philippine address data
```

## 🎯 Service Responsibilities

### **PredictionCoreService** (Base Class)
**File:** `prediction-core.service.ts`  
**Purpose:** Shared functionality for all prediction services
- HTTP client management
- Authentication headers
- Error handling
- Base prediction request method

**Used by:** All other prediction services (extends this)

---

### **VerifyPredictionService**
**File:** `verify-prediction.service.ts`  
**Purpose:** Handles verify page workflow with two-step prediction
- `previewPrediction()` - Get prediction without saving to database
- `savePredictionWithVerification()` - Save with full user verification data

**Used by:** `verify.page.ts`

**Methods:**
```typescript
// Preview without saving
previewPrediction(file: File, detectionType: 'fruit' | 'leaf'): Promise<any>

// Save with user verification
savePredictionWithVerification(
  file: File,
  detectionType: 'fruit' | 'leaf',
  userVerification: {...},
  locationData?: any,
  locationConsentGiven?: boolean
): Promise<any>
```

---

### **StandardPredictionService**
**File:** `standard-prediction.service.ts`  
**Purpose:** Standard prediction operations with optional location
- `predictImage()` - Simple prediction without location
- `predictImageWithLocation()` - Prediction with EXIF location data

**Used by:** Potentially other pages (capture, scan, etc.)

**Methods:**
```typescript
// Simple prediction
predictImage(file: File, detectionType: 'fruit' | 'leaf'): Observable<any>

// With location from EXIF
predictImageWithLocation(
  file: File,
  detectionType: 'fruit' | 'leaf',
  exifLocationData?: any,
  locationConsentGiven?: boolean
): Promise<any>
```

---

### **ConfirmationService**
**File:** `confirmation.service.ts`  
**Purpose:** Handle user confirmations and corrections
- `saveConfirmation()` - Save user feedback on predictions

**Used by:** Any page that needs to collect user corrections

**Methods:**
```typescript
saveConfirmation(confirmation: UserConfirmation): Observable<any>
```

---

## 📝 Shared Types

**File:** `prediction.types.ts`

```typescript
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  source: 'exif' | 'gps' | 'manual';
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

interface UserConfirmation {
  imageId?: number;
  isCorrect?: boolean;
  actualDisease?: string;
  feedback?: string;
  // ... more fields
}
```

---

## 🔄 Migration Guide

### Before (Old Way)
```typescript
import { ApiService } from 'src/app/services/apiservice.service';

constructor(private apiService: ApiService) {}

// Using the monolithic service
await this.apiService.previewPrediction(file, 'leaf');
```

### After (New Way)
```typescript
import { VerifyPredictionService } from 'src/app/services/prediction';

constructor(private verifyPrediction: VerifyPredictionService) {}

// Using specialized service
await this.verifyPrediction.previewPrediction(file, 'leaf');
```

### Backward Compatibility
The old `ApiService` still works as a wrapper! No need to update existing code immediately.

```typescript
// Still works (delegates to new services internally)
import { ApiService } from 'src/app/services/apiservice.service';
await this.apiService.previewPrediction(file, 'leaf');
```

---

## 📦 Clean Imports

Use the index file for cleaner imports:

```typescript
// Single import for everything
import { 
  VerifyPredictionService,
  StandardPredictionService,
  ConfirmationService,
  LocationData,
  ApiResponse,
  UserConfirmation
} from 'src/app/services/prediction';
```

---

## ✅ Benefits

1. **Better Organization** - Each service has a single, clear responsibility
2. **Improved Readability** - Smaller, focused files instead of one large file
3. **Easier Testing** - Test each service independently
4. **Maintainability** - Changes to one workflow don't affect others
5. **Type Safety** - Shared types prevent inconsistencies
6. **Backward Compatible** - Old code continues to work

---

## 🚀 Future Enhancements

Potential additional services:
- `HistoryPredictionService` - For prediction history/analytics
- `BatchPredictionService` - For processing multiple images
- `OfflinePredictionService` - For offline mode handling

---

## 📊 Component Usage Map

| Component | Service Used | Methods Used |
|-----------|-------------|-------------|
| `verify.page.ts` | `VerifyPredictionService` | `previewPrediction()`, `savePredictionWithVerification()` |
| `results.page.ts` | None directly | Only imports `LocationData` type |
| Future components | `StandardPredictionService` | `predictImage()`, `predictImageWithLocation()` |

---

## 🔧 Development Notes

- All services extend `PredictionCoreService` for consistency
- Use `protected` for shared methods, `private` for service-specific
- Always use the centralized error handling from base class
- Log important operations with console.log for debugging
