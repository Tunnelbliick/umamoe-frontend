import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { CalculationType, CircleDetailsConfig } from './circle-details.component';

export interface DisplayOption {
  id: string;
  label: string;
  enabled: boolean;
}

export interface SettingsDialogData {
  config: CircleDetailsConfig;
  calculationTypes: { value: CalculationType; label: string }[];
}

@Component({
  selector: 'app-member-display-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSelectModule,
    MatIconModule,
    MatDividerModule,
    FormsModule
  ],
  template: `
    <div class="modern-dialog-container">
      <div class="dialog-header">
        <div class="header-icon-wrapper">
          <mat-icon class="header-icon">tune</mat-icon>
        </div>
        <div class="header-text">
          <h2>Member List Settings</h2>
          <p>Customize how member data is displayed</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <div class="settings-section">
          <h3>Sorting & Primary Metric</h3>
          <p class="hint">This metric determines the sorting order and is highlighted in the list.</p>
          <mat-form-field appearance="fill" class="modern-select">
            <mat-label>Primary Metric</mat-label>
            <mat-select [(ngModel)]="data.config.selectedCalculation">
              <mat-option *ngFor="let type of data.calculationTypes" [value]="type.value">
                {{type.label}}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="settings-section">
          <h3>Visible Columns</h3>
          <p class="hint">Select which additional metrics to display for each member.</p>
          <div class="checkbox-grid">
            <mat-checkbox [(ngModel)]="data.config.showTotalFans">Total Fans</mat-checkbox>
            <mat-checkbox [(ngModel)]="data.config.showSevenDayAvg">7 Day Average</mat-checkbox>
            <mat-checkbox [(ngModel)]="data.config.showDailyAvg">Daily Average (Month)</mat-checkbox>
            <mat-checkbox [(ngModel)]="data.config.showDailyGain">Daily Gain</mat-checkbox>
            <mat-checkbox [(ngModel)]="data.config.showWeeklyGain">Weekly Gain</mat-checkbox>
            <mat-checkbox [(ngModel)]="data.config.showProjectedMonthly">Projected Monthly</mat-checkbox>
            <mat-checkbox [(ngModel)]="data.config.showMonthlyGain">Monthly Gain</mat-checkbox>
          </div>
        </div>
      </mat-dialog-content>

      <div class="dialog-actions">
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="onSave()">Apply</button>
      </div>
    </div>
  `,
  styles: [`
    .modern-dialog-container {
      width: 100%;
      min-width: 480px;
      max-width: 90vw;
      background: #121212;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.8);
      color: #e0e0e0;
      display: flex;
      flex-direction: column;

      .dialog-header {
        position: relative;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 24px;
        background: #1e1e1e;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;

        &::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #2196f3, #81c784);
        }

        .header-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #2196f3, #81c784);
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);

          .header-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
            color: white;
          }
        }

        .header-text {
          flex: 1;

          h2 {
            margin: 0 0 4px 0;
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
          }

          p {
            margin: 0;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.6);
          }
        }
      }

      .dialog-content {
        padding: 24px !important;
        background: #121212;
        overflow-y: auto;
        flex: 1;
        margin: 0;
      }

      .settings-section {
        margin-bottom: 24px;
        
        h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 500;
          color: #fff;
        }
        
        .hint {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 1rem;
        }
      }

      .modern-select {
        width: 100%;
        
        ::ng-deep .mat-mdc-text-field-wrapper {
          background-color: #1e1e1e !important;
          border-radius: 8px;
        }

        ::ng-deep .mat-mdc-form-field-underline {
          display: none;
        }
      }

      .checkbox-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 0.75rem;
      }

      .dialog-actions {
        padding: 16px 24px;
        background: #121212;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        flex-shrink: 0;
        
        button {
          height: 40px;
          padding: 0 24px;
          border-radius: 8px;
          font-weight: 500;
          
          &.cancel-btn {
            color: rgba(255, 255, 255, 0.7);
            border-color: rgba(255, 255, 255, 0.2);
            
            &:hover {
              background: rgba(255, 255, 255, 0.05);
              color: #ffffff;
            }
          }
        }
      }
    }

    // Mobile responsive
    @media (max-width: 600px) {
      .modern-dialog-container {
        min-width: auto;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        margin: 16px;

        .dialog-header {
          padding: 16px 20px;
        }

        .dialog-content {
          padding: 16px !important;
        }

        .checkbox-grid {
          grid-template-columns: 1fr;
        }
      }
    }
  `]
})
export class MemberDisplaySettingsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<MemberDisplaySettingsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SettingsDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close(this.data.config);
  }
}
