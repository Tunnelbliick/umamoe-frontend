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
    <div class="settings-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">tune</mat-icon>
        <span class="header-title">Member List Settings</span>
        <button class="close-btn" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="dialog-body">
        <div class="settings-section">
          <div class="section-label">
            <mat-icon>sort</mat-icon>
            <span>Sorting & Primary Metric</span>
          </div>
          <p class="section-hint">Determines sorting order and highlighted metric.</p>
          <mat-form-field appearance="fill" class="metric-select">
            <mat-select [(ngModel)]="data.config.selectedCalculation">
              <mat-option *ngFor="let type of data.calculationTypes" [value]="type.value">
                {{type.label}}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <div class="settings-section">
          <div class="section-label">
            <mat-icon>view_column</mat-icon>
            <span>Visible Columns</span>
          </div>
          <p class="section-hint">Select which metrics to display for each member.</p>
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
      </div>
      <div class="dialog-footer">
        <button class="cancel-btn" (click)="onCancel()">Cancel</button>
        <button class="apply-btn" (click)="onSave()">Apply</button>
      </div>
    </div>
  `,
  styles: [`
    .settings-dialog {
      background: #1e1e1e;
      border-radius: 12px;
      width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 12px 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
      .header-icon {
        color: #81c784;
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
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      &::-webkit-scrollbar {
        width: 4px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 2px;
      }
    }
    .settings-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #81c784;
      }
    }
    .section-hint {
      margin: 0 0 4px 0;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.35);
      line-height: 1.4;
    }
    .metric-select {
      width: 100%;
      ::ng-deep .mat-mdc-text-field-wrapper {
        background: rgba(255, 255, 255, 0.05) !important;
        border-radius: 8px !important;
        height: 40px !important;
        padding: 0 12px !important;
      }
      ::ng-deep .mat-mdc-form-field-infix {
        padding: 0 !important;
        min-height: 40px !important;
        display: flex !important;
        align-items: center !important;
      }
      ::ng-deep .mdc-notched-outline__leading,
      ::ng-deep .mdc-notched-outline__notch,
      ::ng-deep .mdc-notched-outline__trailing {
        border: none !important;
      }
      ::ng-deep .mat-mdc-select-value {
        color: rgba(255, 255, 255, 0.85) !important;
        font-size: 13px;
      }
      ::ng-deep .mat-mdc-select-arrow {
        color: rgba(255, 255, 255, 0.4) !important;
      }
      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
      ::ng-deep .mdc-floating-label--float-above {
        display: none !important;
      }
    }
    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 4px;
      ::ng-deep .mat-mdc-checkbox {
        .mdc-form-field {
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
        }
        .mdc-checkbox__background {
          border-color: rgba(255, 255, 255, 0.25) !important;
        }
        &.mat-mdc-checkbox-checked .mdc-checkbox__background {
          background-color: #81c784 !important;
          border-color: #81c784 !important;
        }
      }
    }
    .dialog-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;
      .cancel-btn {
        height: 32px;
        padding: 0 16px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: transparent;
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        &:hover {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.8);
        }
      }
      .apply-btn {
        height: 32px;
        padding: 0 20px;
        border-radius: 6px;
        border: none;
        background: rgba(129, 199, 132, 0.15);
        color: #81c784;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        &:hover {
          background: rgba(129, 199, 132, 0.25);
        }
      }
    }
    :host {
      display: block;
      width: 100%;
    }
    @media (max-width: 600px) {
      .settings-dialog {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      .checkbox-grid {
        grid-template-columns: 1fr;
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
