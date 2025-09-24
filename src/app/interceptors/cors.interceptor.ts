import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable()
export class CorsInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Only add credentials for requests to our API
    if (this.isApiRequest(req.url)) {
      const corsReq = req.clone({
        setHeaders: {
          'Content-Type': 'application/json',
        },
        // Enable credentials for cross-origin requests to support localStorage sharing
        withCredentials: true
      });
      
      return next.handle(corsReq);
    }

    return next.handle(req);
  }

  private isApiRequest(url: string): boolean {
    // Check if the request is to our API endpoints
    // Note: Apache redirects www.honse.moe -> honse.moe, but we handle both domains
    return url.includes('/api/') && (
      url.includes(environment.apiUrl) ||
      url.startsWith('/api/') ||
      url.startsWith('http://localhost:3001/api/') ||
      url.startsWith('http://127.0.0.1:3001/api/') ||
      url.startsWith('https://honse.moe/api/') ||
      url.startsWith('https://www.honse.moe/api/') ||
      url.includes('honse.moe/api/')
    );
  }
}
