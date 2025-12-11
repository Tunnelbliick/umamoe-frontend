import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private isChristmasSubject = new BehaviorSubject<boolean>(false);
  isChristmas$ = this.isChristmasSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.initTheme();
  }

  private initTheme() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Check environment flag first
    const envChristmas = (environment as any).christmasTheme;
    
    // Check local storage preference
    const stored = localStorage.getItem('christmas-theme');
    
    let shouldEnable = false;
    if (stored !== null) {
      shouldEnable = stored === 'true';
    } else {
      // Default to environment setting if no user preference
      shouldEnable = !!envChristmas;
    }

    this.setChristmasTheme(shouldEnable);
  }

  toggleChristmasTheme() {
    this.setChristmasTheme(!this.isChristmasSubject.value);
  }

  setChristmasTheme(enable: boolean) {
    this.isChristmasSubject.next(enable);
    
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('christmas-theme', String(enable));
      
      if (enable) {
        document.body.classList.add('christmas-theme');
      } else {
        document.body.classList.remove('christmas-theme');
      }
    }
  }
}
