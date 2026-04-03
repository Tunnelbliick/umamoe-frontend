import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CookieConsent {
  essential: boolean;   // always true, cannot be disabled
  analytics: boolean;
  advertising: boolean;
}

const CONSENT_KEY = 'cookie-consent';

const DEFAULT_CONSENT: CookieConsent = {
  essential: true,
  analytics: false,
  advertising: false,
};

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private consentSubject = new BehaviorSubject<CookieConsent | null>(this.loadConsent());
  consent$ = this.consentSubject.asObservable();

  /** Whether the user has made any consent choice at all */
  get hasConsented(): boolean {
    return this.consentSubject.value !== null;
  }

  get consent(): CookieConsent | null {
    return this.consentSubject.value;
  }

  /** Check if a specific category is consented */
  hasCategory(category: keyof CookieConsent): boolean {
    return this.consentSubject.value?.[category] ?? false;
  }

  /** Accept all cookie categories */
  acceptAll(): void {
    this.saveConsent({ essential: true, analytics: true, advertising: true });
  }

  /** Reject all optional cookies (essential stays on) */
  rejectAll(): void {
    this.saveConsent({ essential: true, analytics: false, advertising: false });
  }

  /** Save specific consent choices */
  saveChoices(consent: CookieConsent): void {
    this.saveConsent({ ...consent, essential: true });
  }

  /** Reset consent — re-shows the banner */
  resetConsent(): void {
    localStorage.removeItem(CONSENT_KEY);
    this.consentSubject.next(null);
  }

  /** Re-open the consent banner to change preferences */
  showBanner$ = new BehaviorSubject<boolean>(false);

  reopenBanner(): void {
    this.showBanner$.next(true);
  }

  closeBanner(): void {
    this.showBanner$.next(false);
  }

  private saveConsent(consent: CookieConsent): void {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    this.consentSubject.next(consent);
  }

  private loadConsent(): CookieConsent | null {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CONSENT, ...parsed, essential: true };
    } catch {
      return null;
    }
  }
}
