import { Injectable } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs/operators';

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: any) => string;
      getResponse: (widgetId?: string) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      execute: (container: string | HTMLElement, options: any) => Promise<string>;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class TurnstileService {
  private readonly siteKey = environment.turnstile.siteKey;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private readonly TOKEN_LIFETIME = 300000; // 5 minutes in milliseconds (matches backend cache)
  
  constructor() {}

  /**
   * Generate a Turnstile token for API requests
   * This uses the invisible/headless mode for seamless user experience
   */
  generateToken(): Observable<string> {
    return new Observable(observer => {
      // Check if Turnstile is loaded
      if (!window.turnstile) {
        observer.error('Turnstile not loaded');
        return;
      }

      try {
        // Use execute for headless/invisible verification
        window.turnstile.execute(document.body, {
          sitekey: this.siteKey,
          theme: 'auto',
          size: 'invisible',
          callback: (token: string) => {
            if (!environment.production) {
              console.log('Turnstile token generated:', token.substring(0, 20) + '...');
            }
            observer.next(token);
            observer.complete();
          },
          'error-callback': (error: any) => {
            console.error('Turnstile error:', error);
            observer.error(error);
          },
          'expired-callback': () => {
            console.warn('Turnstile token expired');
            observer.error('Token expired');
          },
          'timeout-callback': () => {
            console.warn('Turnstile timeout');
            observer.error('Token timeout');
          }
        });
      } catch (error) {
        console.error('Error executing Turnstile:', error);
        observer.error(error);
      }
    });
  }

  /**
   * Check if Turnstile is ready
   */
  isReady(): boolean {
    return typeof window !== 'undefined' && !!window.turnstile;
  }

  /**
   * Wait for Turnstile to be ready
   */
  waitForReady(): Observable<boolean> {
    return new Observable(observer => {
      if (this.isReady()) {
        observer.next(true);
        observer.complete();
        return;
      }

      const checkInterval = setInterval(() => {
        if (this.isReady()) {
          clearInterval(checkInterval);
          observer.next(true);
          observer.complete();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        observer.error('Turnstile loading timeout');
      }, 10000);
    });
  }

  /**
   * Generate token with retry logic
   */
  generateTokenWithRetry(maxRetries: number = 3): Observable<string> {
    return new Observable(observer => {
      let attempts = 0;

      const attemptGeneration = () => {
        attempts++;
        
        this.getCachedToken().subscribe({
          next: (token) => {
            observer.next(token);
            observer.complete();
          },
          error: (error) => {
            if (attempts < maxRetries) {
              console.warn(`Turnstile attempt ${attempts} failed, retrying...`);
              // Clear cache on error to force new token generation
              this.cachedToken = null;
              this.tokenExpiry = 0;
              setTimeout(attemptGeneration, 1000 * attempts); // Exponential backoff
            } else {
              console.error('All Turnstile attempts failed:', error);
              observer.error(error);
            }
          }
        });
      };

      // Wait for Turnstile to be ready before attempting
      this.waitForReady().subscribe({
        next: () => attemptGeneration(),
        error: (error) => observer.error(error)
      });
    });
  }

  /**
   * Get a cached token or generate a new one if expired
   */
  getCachedToken(): Observable<string> {
    const now = Date.now();
    
    // If we have a valid cached token, return it
    if (this.cachedToken && now < this.tokenExpiry) {
      if (!environment.production) {
        console.log('Using cached Turnstile token');
      }
      return of(this.cachedToken);
    }
    
    // Generate a new token and cache it
    if (!environment.production) {
      console.log('Generating new Turnstile token (cache expired or missing)');
    }
    
    return this.generateToken().pipe(
      tap(token => {
        this.cachedToken = token;
        this.tokenExpiry = now + this.TOKEN_LIFETIME;
        if (!environment.production) {
          console.log(`Turnstile token cached, expires in ${this.TOKEN_LIFETIME / 1000} seconds`);
        }
      })
    );
  }

  /**
   * Force refresh the cached token
   */
  refreshToken(): Observable<string> {
    this.cachedToken = null;
    this.tokenExpiry = 0;
    return this.getCachedToken();
  }
}
