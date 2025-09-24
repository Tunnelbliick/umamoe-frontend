import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-domain-migration-popup',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ],
    template: `
    <div class="migration-popup">
      <div class="popup-header">
        <mat-icon class="migration-icon">campaign</mat-icon>
        <h2 mat-dialog-title>Important Update!</h2>
      </div>

      <div mat-dialog-content class="popup-content">
        <div class="domain-change">
          <div class="old-domain">
            <span class="domain-label">Old:</span>
            <span class="domain-name old">honse.moe</span>
          </div>
          <mat-icon class="arrow-icon">arrow_forward</mat-icon>
          <div class="new-domain">
            <span class="domain-label">New:</span>
            <span class="domain-name new">uma.moe</span>
          </div>
        </div>
        
        <p class="migration-message">
          We've moved to a new domain! <strong>honse.moe</strong> is now <strong>uma.moe</strong> - 
          the same great Umamusume resource hub with a cleaner, more memorable name.
        </p>
        
        <div class="migration-details">
          <ul>
            <li><strong>honse.moe</strong>&nbsp;still works but will redirect to&nbsp;<strong>uma.moe</strong></li>
            <li>All your bookmarks will automatically redirect</li>
            <li>No data or features have changed</li>
          </ul>
        </div>
      </div>

      <div mat-dialog-actions class="popup-actions">
        <button mat-raised-button color="primary" (click)="dismiss()" class="dismiss-btn">
          <mat-icon>check</mat-icon>
          Got it!
        </button>
      </div>
    </div>
  `,
    styles: [`
    .migration-popup {
      max-width: 520px;
      padding: 1.5rem;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border-radius: 16px;
    }

    .popup-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(33, 150, 243, 0.2);
      position: relative;
    }

    .popup-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #64b5f6 50%, transparent 100%);
      opacity: 0.5;
    }

    .migration-icon {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
      color: #64b5f6;
      filter: drop-shadow(0 3px 12px rgba(100, 181, 246, 0.4));
      animation: icon-glow 3s ease-in-out infinite;
    }

    @keyframes icon-glow {
      0%, 100% { 
        filter: drop-shadow(0 3px 12px rgba(100, 181, 246, 0.4));
      }
      50% { 
        filter: drop-shadow(0 4px 16px rgba(100, 181, 246, 0.6));
      }
    }

    h2 {
      margin: 0;
      color: var(--text-primary);
      font-weight: 700;
      font-size: 1.75rem;
      text-shadow: 0 2px 8px rgba(100, 181, 246, 0.2);
      letter-spacing: -0.025em;
    }

    .popup-content {
      margin-bottom: 0;
    }

    .domain-change {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      margin: 0;
      padding: 1.5rem;
      background: linear-gradient(135deg, rgba(33, 150, 243, 0.12) 0%, rgba(129, 199, 132, 0.10) 100%);
      border-radius: 12px;
      border: 1px solid rgba(33, 150, 243, 0.2);
      position: relative;
      overflow: hidden;
    }

    .domain-change::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(circle at 20% 50%, rgba(100, 181, 246, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(129, 199, 132, 0.05) 0%, transparent 50%);
      pointer-events: none;
    }

    .old-domain, .new-domain {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      position: relative;
      z-index: 1;
    }

    .domain-label {
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }

    .domain-name {
      font-size: 1.1rem;
      font-weight: 700;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      min-width: 120px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .domain-name.old {
      background: rgba(244, 67, 54, 0.15);
      color: #ef5350;
      text-decoration: line-through;
      border: 1px solid rgba(244, 67, 54, 0.3);
    }

    .domain-name.new {
      background: linear-gradient(135deg, #42a5f5 0%, #1976d2 100%);
      color: white;
      box-shadow: 
        0 4px 16px rgba(25, 118, 210, 0.3),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
      animation: gentle-glow 3s ease-in-out infinite;
    }

    @keyframes gentle-glow {
      0%, 100% { 
        box-shadow: 
          0 4px 16px rgba(25, 118, 210, 0.3),
          0 0 0 1px rgba(255, 255, 255, 0.1) inset;
      }
      50% { 
        box-shadow: 
          0 6px 20px rgba(25, 118, 210, 0.4),
          0 0 0 1px rgba(255, 255, 255, 0.2) inset;
      }
    }

    .arrow-icon {
      font-size: 1.5rem;
      color: #64b5f6;
      animation: pulse-arrow 2s ease-in-out infinite;
      filter: drop-shadow(0 2px 4px rgba(100, 181, 246, 0.3));
    }

    @keyframes pulse-arrow {
      0%, 100% { 
        transform: scale(1);
        opacity: 0.8;
      }
      50% { 
        transform: scale(1.1);
        opacity: 1;
      }
    }

    .migration-message {
      font-size: 1rem;
      line-height: 1.6;
      margin: 1rem 0;
      color: var(--text-primary);
      text-align: center;
    }

    .migration-message strong {
      color: #64b5f6;
      font-weight: 600;
    }

    .migration-details {
      margin: 0;
    }

    .migration-details ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .migration-details li {
      padding: 0.75rem 0;
      display: flex;
      align-items: center;
      color: var(--text-secondary);
      font-size: 0.9rem;
      transition: color 0.2s ease;
    }

    .migration-details li::before {
      content: '✓';
      color: #81c784;
      font-weight: bold;
      margin-right: 0.75rem;
      font-size: 1rem;
      filter: drop-shadow(0 1px 2px rgba(129, 199, 132, 0.3));
    }

    .migration-details li:hover {
      color: var(--text-primary);
    }

    .popup-actions {
      display: flex;
      justify-content: center;
      padding: 0.5rem 0 0 0;
      border-top: 1px solid rgba(33, 150, 243, 0.1);
      margin-top: 0;
    }

    .dismiss-btn {
      padding: 0.75rem 2rem;
      font-weight: 600;
      font-size: 1rem;
      border-radius: 8px;
      background: linear-gradient(135deg, #42a5f5 0%, #1976d2 100%) !important;
      color: white !important;
      border: none;
      box-shadow: 
        0 4px 12px rgba(25, 118, 210, 0.3),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
      transition: all 0.2s ease;
    }

    .dismiss-btn:hover {
      transform: translateY(-1px);
      box-shadow: 
        0 6px 16px rgba(25, 118, 210, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    }

    .dismiss-btn mat-icon {
      margin-right: 0.5rem;
      font-size: 1.1rem;
    }

    @media (max-width: 600px) {
      .migration-popup {
        padding: 1.25rem;
        max-width: 90vw;
      }

      .domain-change {
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem;
      }

      .arrow-icon {
        transform: rotate(90deg);
      }

      .domain-name {
        min-width: 140px;
        font-size: 1rem;
      }

      .migration-message {
        font-size: 0.95rem;
      }

      .migration-details li {
        font-size: 0.85rem;
      }
    }
  `]
})
export class DomainMigrationPopupComponent {
    constructor(
        public dialogRef: MatDialogRef<DomainMigrationPopupComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) { }

    dismiss(): void {
        this.dialogRef.close();
    }
}
