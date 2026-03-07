import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RateLimitService } from '../services/rate-limit.service';
@Injectable()
export class RateLimitInterceptor implements HttpInterceptor {
  constructor(private rateLimitService: RateLimitService) {}
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 429) {
          // Extract retry-after header if present (in seconds)
          // Default to 60 seconds if not provided by the server
          const retryAfter = this.parseRetryAfter(error.headers.get('Retry-After')) ?? 60;
          
          console.warn('Rate limited (429):', req.url, `Retry after ${retryAfter}s`);
          
          // Show the rate limit popup
          this.rateLimitService.showRateLimitPopup(retryAfter);
        }
        
        return throwError(() => error);
      })
    );
  }
  /**
   * Parse the Retry-After header value
   * Can be either a number of seconds or an HTTP date
   */
  private parseRetryAfter(headerValue: string | null): number | undefined {
    if (!headerValue) {
      return undefined;
    }
    // Try parsing as a number first
    const seconds = parseInt(headerValue, 10);
    if (!isNaN(seconds)) {
      return seconds;
    }
    // Try parsing as an HTTP date
    const date = new Date(headerValue);
    if (!isNaN(date.getTime())) {
      const now = Date.now();
      const retryTime = date.getTime();
      const diffSeconds = Math.ceil((retryTime - now) / 1000);
      return diffSeconds > 0 ? diffSeconds : undefined;
    }
    return undefined;
  }
}
