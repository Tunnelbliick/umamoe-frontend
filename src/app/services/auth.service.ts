import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User, AuthLoginResponse, LinkedAccount, Identity, ApiKey } from '../models/auth.model';
import { HttpErrorResponse } from '@angular/common/http';

const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  private loadedOnce = false;

  user$ = this.userSubject.asObservable();
  isLoggedIn$ = this.user$.pipe(map(u => !!u));

  constructor(private http: HttpClient, private router: Router) {
    if (this.getToken()) {
      this.fetchMe().subscribe();
    }
  }

  /** Redirect the user to the OAuth provider login page */
  login(provider: string): void {
    this.http
      .get<AuthLoginResponse>(`${environment.apiUrl}/api/auth/login/${encodeURIComponent(provider)}`)
      .subscribe(res => {
        window.location.href = res.url;
      });
  }

  /** Called from the callback component after OAuth redirect */
  handleCallback(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.fetchMe().subscribe(() => {
      this.router.navigate(['/']);
    });
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.userSubject.next(null);
    this.router.navigate(['/']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /** Fetch the current user from the API and update the subject */
  fetchMe(): Observable<User | null> {
    return this.http.get<User>(`${environment.apiUrl}/api/auth/me`).pipe(
      tap(user => {
        this.userSubject.next(user);
        this.loadedOnce = true;
      }),
      catchError((err: HttpErrorResponse) => {
        // Only clear the token on 401/403 (actually invalid/expired)
        // Keep it for transient errors (network down, 500, etc.)
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem(TOKEN_KEY);
          this.userSubject.next(null);
        }
        this.loadedOnce = true;
        return of(null);
      })
    );
  }

  /** True once we've attempted to load the user at least once */
  get initialized(): boolean {
    return this.loadedOnce || !this.getToken();
  }

  // --- Game Account Linking ---

  getLinkedAccounts(): Observable<LinkedAccount[]> {
    return this.http.get<LinkedAccount[]>(`${environment.apiUrl}/api/auth/accounts`);
  }

  linkAccount(accountId: string): Observable<LinkedAccount> {
    // Send as number if numeric (backend expects integer ID)
    const parsed = Number(accountId);
    const body = Number.isFinite(parsed) ? { account_id: parsed } : { account_id: accountId };
    return this.http.post<LinkedAccount>(`${environment.apiUrl}/api/auth/link`, body);
  }

  verifyAccount(accountId: string): Observable<LinkedAccount> {
    return this.http.post<LinkedAccount>(`${environment.apiUrl}/api/auth/verify`, { account_id: accountId });
  }

  unlinkAccount(accountId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/auth/link/${encodeURIComponent(accountId)}`);
  }

  // --- Connected SSO Identities ---

  getIdentities(): Observable<Identity[]> {
    return this.http.get<Identity[]>(`${environment.apiUrl}/api/auth/identities`);
  }

  connectProvider(provider: string): void {
    this.http
      .get<AuthLoginResponse>(`${environment.apiUrl}/api/auth/connect/${encodeURIComponent(provider)}`)
      .subscribe(res => {
        window.location.href = res.url;
      });
  }

  disconnectProvider(provider: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/auth/disconnect/${encodeURIComponent(provider)}`);
  }

  // --- API Keys ---

  getApiKeys(): Observable<ApiKey[]> {
    return this.http.get<ApiKey[]>(`${environment.apiUrl}/api/auth/api-keys`);
  }

  createApiKey(name: string): Observable<ApiKey> {
    return this.http.post<ApiKey>(`${environment.apiUrl}/api/auth/api-keys`, { name });
  }

  revokeApiKey(keyId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/api/auth/api-keys/${encodeURIComponent(keyId)}`);
  }
}
