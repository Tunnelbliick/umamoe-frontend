import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-privacy-notice',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="privacy-notice" *ngIf="!isAccepted">
      <div class="notice-content">
        <mat-icon>security</mat-icon>
        <p>
          This site uses Cloudflare Turnstile for bot protection. 
          No tracking cookies are used, only temporary verification tokens for security.
          <a href="/privacy" target="_blank">Learn more</a>
        </p>
        <button mat-raised-button color="primary" (click)="accept()">
          <mat-icon>check</mat-icon>
          Understood
        </button>
      </div>
    </div>
  `,
  styles: [`
    .privacy-notice {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    }

    .notice-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
    }

    mat-icon {
      color: #4CAF50;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    p {
      flex: 1;
      margin: 0;
      font-size: 14px;
      line-height: 1.4;
    }

    a {
      color: #81C784;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    button {
      white-space: nowrap;
    }

    @keyframes slideIn {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @media (max-width: 768px) {
      .privacy-notice {
        left: 10px;
        right: 10px;
        bottom: 10px;
      }

      .notice-content {
        flex-direction: column;
        text-align: center;
        gap: 12px;
      }

      p {
        font-size: 13px;
      }
    }
  `]
})
export class PrivacyNoticeComponent {
  isAccepted: boolean = false;

  constructor() {
    // Check if user has already accepted
    this.isAccepted = localStorage.getItem('privacy-notice-accepted') === 'true';
  }

  accept(): void {
    this.isAccepted = true;
    localStorage.setItem('privacy-notice-accepted', 'true');
  }
}
