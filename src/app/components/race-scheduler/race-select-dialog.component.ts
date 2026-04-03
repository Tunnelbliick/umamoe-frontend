import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RaceEntry } from './race-scheduler.component';

export interface RaceSelectDialogData {
  races: RaceEntry[];
  /** Currently selected race_instance_id for this cell (single), or null */
  selectedId: number | null;
  cellLabel: string;
}

@Component({
  selector: 'app-race-select-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <div class="race-select-dialog">
      <div class="dialog-header">
        <h3>Select Race</h3>
        <span class="cell-context">{{ data.cellLabel }}</span>
        <button class="close-btn" (click)="dialogRef.close(null)">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="race-list">
        <button
          *ngFor="let race of data.races"
          class="race-option"
          [class.selected]="selectedId === race.race_instance_id"
          [ngClass]="getGradeClass(race.grade)"
          (click)="pick(race)">
          <span class="grade-badge" [ngClass]="getGradeClass(race.grade)">
            {{ getGradeLabel(race.grade) }}
          </span>
          <span class="race-name">{{ race.name }}</span>
          <mat-icon class="check-icon" *ngIf="selectedId === race.race_instance_id">radio_button_checked</mat-icon>
          <mat-icon class="check-icon unselected" *ngIf="selectedId !== race.race_instance_id">radio_button_unchecked</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .race-select-dialog {
      background: #1a1a1a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      overflow: hidden;
      min-width: 280px;
      max-width: 400px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);

      h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
      }

      .cell-context {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.4);
        margin-left: auto;
        margin-right: 8px;
      }

      .close-btn {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.4);
        display: flex;
        align-items: center;
        border-radius: 4px;

        &:hover {
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.05);
        }

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .race-list {
      padding: 8px;
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .race-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
      cursor: pointer;
      transition: all 0.15s ease;
      color: rgba(255, 255, 255, 0.8);

      &:hover {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.12);
      }

      &.selected {
        border-color: rgba(33, 150, 243, 0.4);
        background: rgba(33, 150, 243, 0.08);
      }

      &.selected.grade-g1 {
        border-color: rgba(54, 132, 227, 0.4);
        background: rgba(54, 132, 227, 0.08);
      }

      &.selected.grade-g2 {
        border-color: rgba(244, 85, 129, 0.4);
        background: rgba(244, 85, 129, 0.08);
      }

      &.selected.grade-g3 {
        border-color: rgba(57, 187, 84, 0.4);
        background: rgba(57, 187, 84, 0.08);
      }
    }

    .grade-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex-shrink: 0;

      &.grade-g1 {
        background: rgba(54, 132, 227, 0.15);
        color: #7fb3ef;
        border: 1px solid rgba(54, 132, 227, 0.3);
      }
      &.grade-g2 {
        background: rgba(244, 85, 129, 0.15);
        color: #f48fab;
        border: 1px solid rgba(244, 85, 129, 0.3);
      }
      &.grade-g3 {
        background: rgba(57, 187, 84, 0.15);
        color: #6fcf85;
        border: 1px solid rgba(57, 187, 84, 0.3);
      }
    }

    .race-name {
      font-size: 13px;
      font-weight: 500;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .check-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #66bb6a;
      flex-shrink: 0;

      &.unselected {
        color: rgba(255, 255, 255, 0.2);
      }
    }
  `]
})
export class RaceSelectDialogComponent {
  selectedId: number | null;

  constructor(
    public dialogRef: MatDialogRef<RaceSelectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RaceSelectDialogData
  ) {
    this.selectedId = data.selectedId;
  }

  pick(race: RaceEntry): void {
    // Clicking the already-selected race deselects; otherwise select and close immediately
    if (this.selectedId === race.race_instance_id) {
      this.dialogRef.close(null); // deselect
    } else {
      this.dialogRef.close(race.race_instance_id);
    }
  }

  getGradeClass(grade: number): string {
    switch (grade) {
      case 100: return 'grade-g1';
      case 200: return 'grade-g2';
      case 300: return 'grade-g3';
      default: return '';
    }
  }

  getGradeLabel(grade: number): string {
    switch (grade) {
      case 100: return 'G1';
      case 200: return 'G2';
      case 300: return 'G3';
      default: return '';
    }
  }
}
