import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { switchMap, catchError, retryWhen } from 'rxjs/operators';
import { TurnstileService } from '../services/turnstile.service';
import { environment } from '../../environments/environment';

@Injectable()
export class TurnstileInterceptor implements HttpInterceptor {
  
  constructor(private turnstileService: TurnstileService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only add Turnstile token to POST requests to our API
    if (req.method !== 'POST' || !this.isApiRequest(req.url)) {
      return next.handle(req);
    }

    if (!environment.production) {
      console.log('Adding Turnstile token to POST request:', req.url);
    }

    // Generate Turnstile token and add to request headers
    return this.turnstileService.generateTokenWithRetry().pipe(
      switchMap(token => {
        const authenticatedReq = req.clone({
          headers: req.headers.set('CF-Turnstile-Token', token)
        });

        if (!environment.production) {
          console.log('Turnstile token added to request headers');
        }

        return next.handle(authenticatedReq);
      }),
      retryWhen((errors: Observable<any>) => 
        errors.pipe(
          switchMap((error: HttpErrorResponse, index: number) => {
            // Retry on 403 errors (token issues) up to 2 times
            if (error.status === 403 && index < 2) {
              console.warn(`Request failed with 403, refreshing token and retrying (attempt ${index + 1})`);
              // Force refresh the token before retrying
              return this.turnstileService.refreshToken();
            }
            // Don't retry other errors or after max retries
            return throwError(() => error);
          })
        )
      ),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403) {
          console.error('Turnstile verification failed after retries:', error);
          // You could show a user-friendly message here
        }
        return throwError(() => error);
      })
    );
  }

  private isApiRequest(url: string): boolean {
    // Check if the request is to our API endpoints
    return url.includes('/api/') && (
      url.includes(environment.apiUrl) ||
      url.startsWith('/api/') ||
      url.startsWith('http://localhost:3001/api/') ||
      url.startsWith('https://honse.moe/api/')
    );
  }
}
