import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Core Prediction Service
 * Handles basic HTTP communication and authentication for all prediction-related operations
 */
@Injectable({
  providedIn: 'root'
})
export class PredictionCoreService {
  protected apiUrl = environment.apiUrl;

  constructor(protected http: HttpClient) {}

  /**
   * Get authentication headers with token
   */
  protected getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Token ${token}`);
  }

  /**
   * Basic prediction request - used as foundation for other services
   */
  protected predictImageRequest(formData: FormData): Observable<any> {
    const headers = this.getAuthHeaders();
    
    return this.http.post(`${this.apiUrl}/predict/`, formData, { headers })
      .pipe(
        tap(response => console.log('Prediction API response:', response)),
        catchError(this.handleError)
      );
  }

  /**
   * Centralized error handling for all prediction requests
   */
  protected handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred!';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Try to extract the message from different possible structures
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.errors && Array.isArray(error.error.errors) && error.error.errors.length > 0) {
        errorMessage = error.error.errors[0];
      } else if (typeof error.error === 'string') {
        errorMessage = error.error;
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }
    
    console.error('API Error:', errorMessage);
    return throwError(() => errorMessage);
  }
}
