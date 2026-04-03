import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { CookieConsentService } from '../../services/cookie-consent.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    RouterModule
  ],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss'
})
export class PrivacyPolicyComponent {
  lastUpdated = new Date('2026-03-11');
  
  constructor(
    private meta: Meta,
    private title: Title,
    private cookieConsentService: CookieConsentService
  ) {
    this.title.setTitle('Privacy Policy | uma.moe');
    this.meta.addTags([
      { name: 'description', content: 'Privacy policy for uma.moe — Umamusume resource hub. Learn how your data is handled and protected.' },
      { property: 'og:title', content: 'Privacy Policy | uma.moe' },
      { property: 'og:description', content: 'Privacy policy for uma.moe — Umamusume resource hub. Learn how your data is handled and protected.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://uma.moe/privacy-policy' },
      { property: 'og:image', content: 'https://uma.moe/assets/logo.png' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: 'Privacy Policy | uma.moe' },
      { name: 'twitter:description', content: 'Privacy policy for uma.moe — Umamusume resource hub.' },
    ]);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  openCookieSettings(): void {
    this.cookieConsentService.reopenBanner();
  }
}
