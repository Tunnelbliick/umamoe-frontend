import { Component, Inject, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RaceSchedulerComponent } from '../race-scheduler/race-scheduler.component';

interface ListRace {
  name: string;
  shortName: string;
  grade: number;
  gradeLabel: string;
  month: number;
  half: number;
  year: string;
  yearLabel: string;
  won: boolean;
  position?: number;
}

export interface RaceResultsDialogData {
  charId?: number;
  charName: string;
  winSaddleIds: number[];
  runRaceIds?: number[];
}

@Component({
  selector: 'app-race-results-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, RaceSchedulerComponent],
  template: `
    <div class="race-results-dialog">
      <div class="dialog-header">
        <div class="header-left">
          <img *ngIf="data.charId"
               [src]="'/assets/images/character_stand/chara_stand_' + data.charId + '.png'"
               class="char-portrait"
               [alt]="data.charName">
          <div class="header-text">
            <span class="dialog-title">Race History</span>
            <span class="char-name">{{ data.charName }}</span>
          </div>
        </div>
        <div class="header-right">
          <div class="view-toggle">
            <button class="view-toggle-btn" [class.active]="viewMode === 'grid'" (click)="viewMode = 'grid'" matTooltip="Schedule view">
              <mat-icon>calendar_month</mat-icon>
            </button>
            <button class="view-toggle-btn" [class.active]="viewMode === 'list'" (click)="switchToList()" matTooltip="List view">
              <mat-icon>list</mat-icon>
            </button>
          </div>
          <button class="toolbar-btn export-btn"
                  (click)="exportRaceHistory()"
                  matTooltip="Export race history as JSON">
            <mat-icon>download</mat-icon>
            <span>Export</span>
          </button>
          <button class="close-btn" (click)="dialogRef.close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="dialog-body" [class.list-mode]="viewMode === 'list'">
        <!-- Grid view (always in DOM so list view can read its computed data) -->
        <app-race-scheduler
          #scheduler
          [style.display]="viewMode === 'grid' ? 'block' : 'none'"
          [selectable]="false"
          [winSaddleIds]="data.winSaddleIds"
          [runRaceIds]="data.runRaceIds || []">
        </app-race-scheduler>

        <!-- List view -->
        <div class="race-list-view" *ngIf="viewMode === 'list'">
          <div class="list-year-group" *ngFor="let group of listGroups">
            <div class="list-year-header" [ngClass]="group.year">{{ group.yearLabel }}</div>
            <div class="list-race-row" *ngFor="let race of group.races">
              <span class="list-turn">{{ getMonthName(race.month) }} {{ race.half === 1 ? 'Early' : 'Late' }}</span>
              <span class="list-grade" [ngClass]="'lg-' + race.gradeLabel.toLowerCase()">{{ race.gradeLabel }}</span>
              <span class="list-name">{{ race.name }}</span>
              <span class="list-result" *ngIf="race.won">
                <mat-icon class="list-trophy">emoji_events</mat-icon>
              </span>
              <span class="list-result list-pos" *ngIf="!race.won && race.position">
                {{ race.position }}{{ getOrdinal(race.position) }}
              </span>
            </div>
            <div class="list-empty" *ngIf="group.races.length === 0">No races</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .race-results-dialog {
      background: #1a1a1a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .char-portrait {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.15);
      object-fit: cover;
      object-position: top;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .dialog-title {
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }

    .char-name {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.04);
      color: rgba(255, 255, 255, 0.6);
      transition: all 0.15s ease;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.9);
        border-color: rgba(255, 255, 255, 0.2);
      }

      &.export-btn:hover {
        border-color: rgba(151, 212, 52, 0.4);
        color: #a5d6a7;
        background: rgba(151, 212, 52, 0.08);
      }
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

    .legend {
      display: flex;
      gap: 16px;
      padding: 10px 16px 0;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;

      mat-icon {
        font-size: 13px;
        width: 13px;
        height: 13px;
      }

      &.won mat-icon { color: #f5c83a; }
      &.ran mat-icon { color: rgba(255, 255, 255, 0.4); }
    }

    .dialog-body {
      padding: 12px 16px 16px;
      overflow: auto;
      max-height: 75vh;

      &.list-mode {
        overflow-y: auto;
        overflow-x: hidden;
      }
    }

    app-race-scheduler {
      display: block;
      min-width: 860px;
    }

    // View toggle
    .view-toggle {
      display: inline-flex;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      overflow: hidden;
    }

    .view-toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 26px;
      border: none;
      background: rgba(255, 255, 255, 0.03);
      color: rgba(255, 255, 255, 0.35);
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;

      &:not(:last-child) {
        border-right: 1px solid rgba(255, 255, 255, 0.08);
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.6);
      }

      &.active {
        background: rgba(33, 150, 243, 0.15);
        color: #64b5f6;
      }
    }

    // List view
    .race-list-view {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .list-year-group {
      display: flex;
      flex-direction: column;
    }

    .list-year-header {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 5px 10px;
      border-radius: 6px 6px 0 0;

      &.junior {
        background: rgba(33, 150, 243, 0.15);
        color: #90caf9;
      }
      &.classic {
        background: rgba(245, 200, 58, 0.12);
        color: #f5c83a;
      }
      &.senior {
        background: rgba(102, 187, 106, 0.12);
        color: #81c784;
      }
    }

    .list-race-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 12px;

      &:last-child { border-bottom: none; }

      &:hover {
        background: rgba(255, 255, 255, 0.03);
      }
    }

    .list-turn {
      min-width: 80px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      flex-shrink: 0;
    }

    .list-grade {
      font-size: 10px;
      font-weight: 800;
      min-width: 22px;
      text-align: center;
      flex-shrink: 0;

      &.lg-g1 { color: #7fb3ef; }
      &.lg-g2 { color: #f48fab; }
      &.lg-g3 { color: #6fcf85; }
    }

    .list-name {
      flex: 1;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .list-result {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .list-trophy {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #f5c83a;
    }

    .list-pos {
      font-size: 10px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.45);
    }

    .list-empty {
      padding: 8px 10px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.2);
      font-style: italic;
    }
  `]
})
export class RaceResultsDialogComponent implements AfterViewInit {
  @ViewChild('scheduler') scheduler!: RaceSchedulerComponent;

  viewMode: 'grid' | 'list' = 'grid';
  listGroups: { year: string; yearLabel: string; races: ListRace[] }[] = [];

  private static MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  private static YEAR_LABELS: Record<string, string> = { junior: 'Junior Year', classic: 'Classic Year', senior: 'Senior Year' };

  constructor(
    public dialogRef: MatDialogRef<RaceResultsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RaceResultsDialogData
  ) {}

  ngAfterViewInit(): void {
    // Scheduler is now initialized; pre-build list data
    this.buildListFromScheduler();
  }

  switchToList(): void {
    this.viewMode = 'list';
    this.buildListFromScheduler();
  }

  getMonthName(m: number): string {
    return RaceResultsDialogComponent.MONTH_NAMES[m - 1] || '';
  }

  getOrdinal(n: number): string {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  /** Build list data directly from the scheduler's computed cells — single source of truth */
  private buildListFromScheduler(): void {
    const s = this.scheduler;
    if (!s) return;

    const groups = s.years.map(y => ({
      year: y,
      yearLabel: RaceResultsDialogComponent.YEAR_LABELS[y],
      races: [] as ListRace[],
    }));
    const groupMap = new Map(groups.map(g => [g.year, g]));

    for (const year of s.years) {
      const group = groupMap.get(year)!;
      const seenIds = new Set<number>();

      for (const month of s.months) {
        for (const half of s.halves) {
          // Ran races (includes won with position=1)
          for (const entry of s.getRanInCell(year, month, half)) {
            if (seenIds.has(entry.race.race_instance_id)) continue;
            seenIds.add(entry.race.race_instance_id);
            group.races.push({
              name: entry.race.name,
              shortName: entry.race.short_name,
              grade: entry.race.grade,
              gradeLabel: s.getGradeLabel(entry.race.grade),
              month,
              half,
              year,
              yearLabel: s.yearLabels[year],
              won: entry.position === 1,
              position: entry.position,
            });
          }

          // Won-only races (from saddle data, not already covered by run data)
          for (const race of s.getWonInCell(year, month, half)) {
            if (seenIds.has(race.race_instance_id)) continue;
            seenIds.add(race.race_instance_id);
            group.races.push({
              name: race.name,
              shortName: race.short_name,
              grade: race.grade,
              gradeLabel: s.getGradeLabel(race.grade),
              month,
              half,
              year,
              yearLabel: s.yearLabels[year],
              won: true,
            });
          }
        }
      }
    }

    this.listGroups = groups;
  }

  exportRaceHistory(): void {
    const sched = this.scheduler;
    if (!sched) return;

    const entries: { raceName: string; grade: string; year: string; turn: string; position: number }[] = [];
    for (const year of sched.years) {
      for (const month of sched.months) {
        for (const half of sched.halves) {
          for (const entry of sched.getRanInCell(year, month, half)) {
            entries.push({
              raceName: entry.race.name,
              grade: sched.getGradeLabel(entry.race.grade),
              year: sched.yearLabels[year],
              turn: `${String(month).padStart(2, '0')}_${String(half).padStart(2, '0')}`,
              position: entry.position,
            });
          }
        }
      }
    }

    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = this.data.charName.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `race-history-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
