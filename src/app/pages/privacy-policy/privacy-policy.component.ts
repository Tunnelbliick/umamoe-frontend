import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    RouterModule
  ],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.scss'
})
export class PrivacyPolicyComponent {
  lastUpdated = new Date('2025-07-07');
  
  constructor(private meta: Meta, private title: Title) {
    this.title.setTitle('Privacy Policy | Honsemoe Umamusume Tools');
    this.meta.addTags([
      { name: 'description', content: 'Privacy policy for Honsemoe Umamusume support card tierlist and tools. Learn how your data is handled and protected.' },
      { property: 'og:title', content: 'Privacy Policy | Honsemoe Umamusume Tools' },
      { property: 'og:description', content: 'Privacy policy for Honsemoe Umamusume support card tierlist and tools. Learn how your data is handled and protected.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://honsemoe.com/privacy-policy' },
      { property: 'og:image', content: 'https://honsemoe.com/assets/og-image.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Privacy Policy | Honsemoe Umamusume Tools' },
      { name: 'twitter:description', content: 'Privacy policy for Honsemoe Umamusume support card tierlist and tools. Learn how your data is handled and protected.' },
      { name: 'twitter:image', content: 'https://honsemoe.com/assets/og-image.png' }
    ]);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
