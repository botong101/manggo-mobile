import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private bareHttp: HttpClient;

  constructor(private httpBackend: HttpBackend) {
    // Use a client without interceptors to avoid recursive interception during refresh.
    this.bareHttp = new HttpClient(httpBackend);
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isPublicEndpoint(request.url)) {
      return next.handle(request);
    }

    const accessToken = localStorage.getItem('accessToken');
    const authReq = accessToken
      ? request.clone({
          setHeaders: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      : request;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401 || this.isRefreshEndpoint(request.url)) {
          return throwError(() => error);
        }

        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          return throwError(() => error);
        }

        return this.refreshAccessToken(refreshToken).pipe(
          switchMap((refreshResponse) => {
            const newAccessToken = refreshResponse?.access;
            if (!newAccessToken) {
              return throwError(() => error);
            }

            localStorage.setItem('accessToken', newAccessToken);
            const retried = request.clone({
              setHeaders: {
                Authorization: `Bearer ${newAccessToken}`,
              },
            });
            return next.handle(retried);
          }),
          catchError((refreshError) => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('isLoggedIn');
            return throwError(() => refreshError);
          })
        );
      })
    );
  }

  private refreshAccessToken(refreshToken: string): Observable<{ access?: string }> {
    return this.bareHttp.post<{ access?: string }>(`${environment.apiUrl}/auth/refresh/`, {
      refresh: refreshToken,
    });
  }

  private isRefreshEndpoint(url: string): boolean {
    return url.includes('/auth/refresh/');
  }

  private isPublicEndpoint(url: string): boolean {
    return (
      url.includes('/disease-locations/all/') ||
      url.includes('/disease-locations/similar/') ||
      url.includes('/test-model/')
    );
  }
}