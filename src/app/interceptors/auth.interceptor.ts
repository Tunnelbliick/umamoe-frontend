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
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('auth_token');

    if (token && this.isApiRequest(req.url)) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // On 401, clear the token but don't force navigation —
        // let the calling code (fetchMe, components) handle UX.
        if (error.status === 401 && this.isApiRequest(req.url)) {
          localStorage.removeItem('auth_token');
        }
        return throwError(() => error);
      })
    );
  }

  private isApiRequest(url: string): boolean {
    return (url.includes('/api/') || url.includes('/ingest/')) && (
      url.includes(environment.apiUrl) ||
      url.startsWith('/api/') ||
      url.startsWith('/ingest/')
    );
  }
}
