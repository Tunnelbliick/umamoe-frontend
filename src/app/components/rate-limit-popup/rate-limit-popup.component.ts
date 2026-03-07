import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
export interface RateLimitDialogData {
  retryAfter?: number;
}
@Component({
  selector: 'app-rate-limit-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="rate-limit-dialog-container">
      <div class="dialog-header">
        <mat-icon class="header-icon">speed</mat-icon>
        <span class="header-title">Slow Down</span>
        <button class="close-btn" (click)="dismiss()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="dialog-body">
        <p class="message">
          You're sending too many requests. Please wait before trying again.
        </p>
        
        <div class="countdown-section" *ngIf="countdown > 0">
          <div class="countdown-ring">
            <span class="countdown-value">{{ displayValue }}</span>
            <span class="countdown-unit">{{ displayUnit }}</span>
          </div>
        </div>
        <div class="info-row">
          <mat-icon>info_outline</mat-icon>
          <span>This limit keeps the service fast for everyone.</span>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="dismiss-btn" (click)="dismiss()">
          {{ countdown > 0 ? 'Dismiss' : 'Got it' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .rate-limit-dialog-container {
      background: #1e1e1e;
      border-radius: 12px;
      width: 380px;
      max-width: calc(100vw - 16px);
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 12px 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      .header-icon {
        color: #ff9800;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .header-title {
        flex: 1;
        font-size: 15px;
        font-weight: 600;
        color: #fff;
      }
      .close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        transition: all 0.15s;
        padding: 0;
        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
        &:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }
      }
    }
    .dialog-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .message {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.75);
      text-align: center;
    }
    .countdown-section {
      display: flex;
      justify-content: center;
    }
    .countdown-ring {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(255, 152, 0, 0.08);
      border: 2px solid rgba(255, 152, 0, 0.25);
      .countdown-value {
        font-size: 24px;
        font-weight: 700;
        color: #ff9800;
        line-height: 1;
      }
      .countdown-unit {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 2px;
      }
    }
    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      width: 100%;
      box-sizing: border-box;
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: rgba(255, 255, 255, 0.3);
        flex-shrink: 0;
      }
      span {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
        line-height: 1.4;
      }
    }
    .dialog-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: center;
      .dismiss-btn {
        height: 32px;
        padding: 0 24px;
        border-radius: 16px;
        border: none;
        background: rgba(255, 152, 0, 0.15);
        color: #ff9800;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        &:hover {
          background: rgba(255, 152, 0, 0.25);
        }
      }
    }
  `]
})
export class RateLimitPopupComponent implements OnInit, OnDestroy {
  countdown = 0;
  private intervalId: any;
  constructor(
    public dialogRef: MatDialogRef<RateLimitPopupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RateLimitDialogData
  ) {}
  get displayValue(): number {
    if (this.countdown >= 3600) {
      return Math.ceil(this.countdown / 3600);
    } else if (this.countdown >= 60) {
      return Math.ceil(this.countdown / 60);
    }
    return this.countdown;
  }
  get displayUnit(): string {
    if (this.countdown >= 3600) {
      return this.displayValue === 1 ? 'hour' : 'hours';
    } else if (this.countdown >= 60) {
      return this.displayValue === 1 ? 'minute' : 'minutes';
    }
    return this.countdown === 1 ? 'second' : 'seconds';
  }
  ngOnInit(): void {
    if (this.data?.retryAfter && this.data.retryAfter > 0) {
      this.countdown = this.data.retryAfter;
      this.startCountdown();
    }
  }
  ngOnDestroy(): void {
    this.clearCountdown();
  }
  private startCountdown(): void {
    this.intervalId = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.clearCountdown();
        // Auto-dismiss when countdown reaches 0
        this.dialogRef.close();
      }
    }, 1000);
  }
  private clearCountdown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  dismiss(): void {
    this.dialogRef.close();
  }
}
