import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DomainStorageService {
  private readonly MIGRATION_KEY = 'domain-migration-complete';

  constructor() {
    this.checkAndMigrateDomain();
  }

  /**
   * Check if we're on www.honse.moe and redirect to honse.moe for localStorage consistency
   * Updated to support both domains without forced redirects
   */
  private checkAndMigrateDomain(): void {
    // Only run this in browser environment
    if (typeof window === 'undefined') return;

    const currentHost = window.location.hostname;
    
    // Support both www.honse.moe and honse.moe without redirecting
    // Both domains should work independently now that CORS credentials are enabled
    if (currentHost === 'www.honse.moe' || currentHost === 'honse.moe') {
      localStorage.setItem(this.MIGRATION_KEY, 'true');
    }
  }

  /**
   * Get a localStorage item with fallback for cross-domain compatibility
   */
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('Failed to access localStorage:', error);
      return null;
    }
  }

  /**
   * Set a localStorage item with error handling
   */
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn('Failed to set localStorage item:', error);
    }
  }

  /**
   * Remove a localStorage item with error handling
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove localStorage item:', error);
    }
  }

  /**
   * Check if localStorage is available
   */
  isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the canonical domain (without www)
   */
  getCanonicalDomain(): string {
    if (typeof window === 'undefined') return 'honse.moe';
    return window.location.hostname.replace('www.', '');
  }
}
