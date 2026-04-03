import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RaceSelectDialogComponent, RaceSelectDialogData } from './race-select-dialog.component';
import RACE_DATA from '../../../data/race_to_saddle_mapping.json';

export interface ScheduleEntry {
  raceName: string;
  grade: string;
  year: string;
  turn: string;
  type?: string;
  location?: string;
  length?: string;
  lengthM?: string;
}

export interface RaceEntry {
  race_instance_id: number;
  race_id: number;
  thumbnail_id: number;
  grade: number;
  name: string;
  short_name: string;
  schedule: { program_id: number; month: number; half: number; race_permission: number; program_group: number }[];
  win_saddles: { saddle_id: number; win_saddle_type: number; required_race_instance_ids: number[] }[];
}

/** Map from turn string "MM_H" to { month, half } */
function parseTurn(turn: string): { month: number; half: number } | null {
  const parts = turn.split('_');
  if (parts.length !== 2) return null;
  return { month: parseInt(parts[0], 10), half: parseInt(parts[1], 10) };
}

function gradeNumberToLabel(grade: number): string {
  switch (grade) {
    case 100: return 'G1';
    case 200: return 'G2';
    case 300: return 'G3';
    default: return '';
  }
}

function yearKeyToLabel(key: string): string {
  switch (key) {
    case 'junior': return 'Junior Year';
    case 'classic': return 'Classic Year';
    case 'senior': return 'Senior Year';
    default: return key;
  }
}

function yearLabelToKey(label: string): string | null {
  const l = label.toLowerCase();
  if (l.includes('junior') || l.includes('first')) return 'junior';
  if (l.includes('classic') || l.includes('second')) return 'classic';
  if (l.includes('senior') || l.includes('third')) return 'senior';
  return null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HALF_LABELS = ['Early', 'Late'];

/** Maps race_permission to which years the race is available */
function getYearsForPermission(perm: number): ('junior' | 'classic' | 'senior')[] {
  switch (perm) {
    case 1: return ['junior'];
    case 2: return ['classic'];
    case 3: return ['classic', 'senior'];
    case 4: return ['senior'];
    default: return [];
  }
}

@Component({
  selector: 'app-race-scheduler',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, MatDialogModule],
  templateUrl: './race-scheduler.component.html',
  styleUrl: './race-scheduler.component.scss'
})
export class RaceSchedulerComponent implements OnInit, OnChanges {
  @Input() selectable = true;
  @Input() winSaddleIds: number[] = [];
  @Input() runRaceIds: number[] = [];
  @Output() selectionChanged = new EventEmitter<number[]>();

  @ViewChild('importInput') importInput!: ElementRef<HTMLInputElement>;

  years: ('junior' | 'classic' | 'senior')[] = ['junior', 'classic', 'senior'];
  yearLabels: Record<string, string> = { junior: 'Junior Year', classic: 'Classic Year', senior: 'Senior Year' };
  months = Array.from({ length: 12 }, (_, i) => i + 1);
  halves = [1, 2];
  /** Pairs of months for 4-column rows */
  monthPairs: [number, number][] = [[1,2],[3,4],[5,6],[7,8],[9,10],[11,12]];

  private allRaces: RaceEntry[] = [];
  /** grid[year][month][half] = RaceEntry[] (available races for that cell) */
  grid: Record<string, Record<number, Record<number, RaceEntry[]>>> = {};
  /** Currently selected race_instance_id per cell: cellKey → race_instance_id */
  cellSelection = new Map<string, number>();

  private saddleToRaceMap = new Map<number, number[]>();
  wonRaceIds = new Set<number>();
  /** Map race_instance_id → RaceEntry for quick lookup */
  private raceMap = new Map<number, RaceEntry>();
  /** Map program_id → race_instance_id (race_results use program_id * 100 + position) */
  private programIdToRaceInstanceId = new Map<number, number>();
  /** Map `${programId}_${year}` → finishing position.
   *  Supports duplicate program_ids (e.g. perm-3 races run in both classic and senior year).
   *  Year is assigned in chronological order by consuming the earliest available slot. */
  private ranLookup = new Map<string, number>();
  private ranCount = 0;

  constructor(private dialog: MatDialog) {}

  ngOnInit(): void {
    this.allRaces = (RACE_DATA as any).races as RaceEntry[];
    for (const r of this.allRaces) {
      this.raceMap.set(r.race_instance_id, r);
      for (const sched of r.schedule) {
        if (!this.programIdToRaceInstanceId.has(sched.program_id)) {
          this.programIdToRaceInstanceId.set(sched.program_id, r.race_instance_id);
        }
      }
    }
    this.buildSaddleMap();
    this.buildGrid();
    this.updateWonRaces();
    this.updateRunRaces();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['winSaddleIds'] && !changes['winSaddleIds'].firstChange) {
      this.updateWonRaces();
    }
    if (changes['runRaceIds'] && !changes['runRaceIds'].firstChange) {
      this.updateRunRaces();
    }
  }

  private buildSaddleMap(): void {
    for (const race of this.allRaces) {
      for (const ws of race.win_saddles) {
        if (!this.saddleToRaceMap.has(ws.saddle_id)) {
          this.saddleToRaceMap.set(ws.saddle_id, []);
        }
        for (const rid of ws.required_race_instance_ids) {
          const arr = this.saddleToRaceMap.get(ws.saddle_id)!;
          if (!arr.includes(rid)) arr.push(rid);
        }
      }
    }
  }

  private buildGrid(): void {
    for (const year of this.years) {
      this.grid[year] = {};
      for (const month of this.months) {
        this.grid[year][month] = { 1: [], 2: [] };
      }
    }

    for (const race of this.allRaces) {
      for (const sched of race.schedule) {
        const years = getYearsForPermission(sched.race_permission);
        for (const year of years) {
          const cell = this.grid[year]?.[sched.month]?.[sched.half];
          if (cell && !cell.some(r => r.race_instance_id === race.race_instance_id)) {
            cell.push(race);
          }
        }
      }
    }
  }

  private updateWonRaces(): void {
    this.wonRaceIds.clear();
    for (const saddleId of this.winSaddleIds) {
      const raceIds = this.saddleToRaceMap.get(saddleId);
      if (raceIds) {
        for (const rid of raceIds) this.wonRaceIds.add(rid);
      }
    }
  }

  private updateRunRaces(): void {
    this.ranLookup.clear();
    this.ranCount = 0;

    // Process in array order (chronological). Track consumed (year, month, half) slots so that
    // the same program_id appearing twice (perm-3 race run in both classic and senior year) is
    // correctly placed into the next available year slot rather than de-duplicated.
    const usedSlots = new Set<string>(); // key: "year_month_half"

    for (const resultId of this.runRaceIds) {
      const programId = Math.floor(resultId / 100);
      const position = resultId % 100;

      const raceId = this.programIdToRaceInstanceId.get(programId);
      if (!raceId) continue;
      const race = this.raceMap.get(raceId);
      if (!race) continue;

      const sched = race.schedule.find(s => s.program_id === programId);
      if (!sched) continue;

      const years = getYearsForPermission(sched.race_permission);
      // Assign the earliest year in which this (month, half) slot is still free
      const year = years.find(y => !usedSlots.has(`${y}_${sched.month}_${sched.half}`));
      if (!year) continue; // All possible year-slots already consumed

      usedSlots.add(`${year}_${sched.month}_${sched.half}`);
      this.ranLookup.set(`${programId}_${year}`, position);
      this.ranCount++;
    }
  }

  private cellKey(year: string, month: number, half: number): string {
    return `${year}_${month}_${half}`;
  }

  /** All currently selected race_instance_ids (one per cell) */
  get selectedRaceIds(): Set<number> {
    return new Set(this.cellSelection.values());
  }

  /** Get races available in a cell, excluding races already selected in OTHER cells (same race_instance_id) */
  getCellRaces(year: string, month: number, half: number): RaceEntry[] {
    const key = this.cellKey(year, month, half);
    const thisSelected = this.cellSelection.get(key);
    // Races selected in other cells should not appear as options here
    const takenElsewhere = new Set<number>();
    for (const [k, id] of this.cellSelection) {
      if (k !== key) takenElsewhere.add(id);
    }
    return (this.grid[year]?.[month]?.[half] ?? []).filter(
      r => r.race_instance_id === thisSelected || !takenElsewhere.has(r.race_instance_id)
    );
  }

  /** Get selected race for a cell (if any) */
  getSelectedInCell(year: string, month: number, half: number): RaceEntry | null {
    const id = this.cellSelection.get(this.cellKey(year, month, half));
    return id !== undefined ? (this.raceMap.get(id) ?? null) : null;
  }

  /** Get won races for a cell.
   *  - If race_results are available, pins perm-3 races to their actual year and suppresses
   *    won badges when a different race was run in the slot.
   *  - If only saddle data is available (no race_results), shows won badges in the latest
   *    available year for perm-3 races to avoid duplicates across years. */
  getWonInCell(year: string, month: number, half: number): RaceEntry[] {
    const hasRunData = this.ranCount > 0;
    const ran = hasRunData ? this.getRanInCell(year, month, half) : [];
    const ranRaceIds = ran.length > 0 ? new Set(ran.map(e => e.race.race_instance_id)) : null;

    return (this.grid[year]?.[month]?.[half] ?? []).filter(r => {
      if (!this.wonRaceIds.has(r.race_instance_id)) return false;
      // race_results are authoritative: if a different race was run here, suppress this won badge
      if (ranRaceIds !== null && !ranRaceIds.has(r.race_instance_id)) return false;

      if (hasRunData) {
        // With run data: pin to the exact year it was run
        return r.schedule.some(s =>
          s.month === month && s.half === half && this.ranLookup.has(`${s.program_id}_${year}`)
        );
      } else {
        // Without run data: collect ALL possible years from every schedule entry in this slot,
        // then show only in the latest year to avoid duplicates when a race has multiple entries
        // (e.g. Arima Kinen: perm-2 classic + perm-3 classic/senior → should only show once)
        const allYears = new Set<string>();
        for (const s of r.schedule) {
          if (s.month !== month || s.half !== half) continue;
          for (const y of getYearsForPermission(s.race_permission)) allYears.add(y);
        }
        const last = ['junior', 'classic', 'senior'].filter(y => allYears.has(y)).pop();
        return last === year;
      }
    });
  }

  /** Get races run in this cell with their finishing position.
   *  Matches by program_id + month + half, pinned to exact year via ranLookup.
   *  Position 1 = won, position > 1 = ran. */
  getRanInCell(year: string, month: number, half: number): { race: RaceEntry; position: number }[] {
    if (this.ranCount === 0) return [];
    const result: { race: RaceEntry; position: number }[] = [];
    for (const race of (this.grid[year]?.[month]?.[half] ?? [])) {
      for (const sched of race.schedule) {
        if (sched.month === month && sched.half === half) {
          const pos = this.ranLookup.get(`${sched.program_id}_${year}`);
          if (pos !== undefined) {
            result.push({ race, position: pos });
            break;
          }
        }
      }
    }
    return result;
  }

  /** Check if cell has unselected races still available */
  hasUnselectedRaces(year: string, month: number, half: number): boolean {
    return this.getCellRaces(year, month, half).some(
      r => r.race_instance_id !== this.cellSelection.get(this.cellKey(year, month, half))
    );
  }

  /** Open dialog to select a single race from this cell */
  openRaceDialog(year: string, month: number, half: number): void {
    if (!this.selectable) return;
    const races = this.getCellRaces(year, month, half);
    if (races.length === 0) return;

    const key = this.cellKey(year, month, half);
    const currentId = this.cellSelection.get(key) ?? null;
    const cellLabel = `${this.yearLabels[year]} — ${this.getCellLabel(month, half)}`;

    const ref = this.dialog.open(RaceSelectDialogComponent, {
      panelClass: 'modern-dialog-panel',
      data: { races, selectedId: currentId, cellLabel } as RaceSelectDialogData,
      width: '380px',
      maxWidth: '95vw',
    });

    // result is a race_instance_id (number) to select, or null to deselect
    ref.afterClosed().subscribe((result: number | null | undefined) => {
      if (result === undefined) return; // dialog closed via backdrop/esc without action
      if (result === null) {
        this.cellSelection.delete(key);
      } else {
        this.cellSelection.set(key, result);
      }
      this.selectionChanged.emit([...this.selectedRaceIds]);
    });
  }

  /** Remove a single selected race */
  deselectRace(year: string, month: number, half: number, event: Event): void {
    event.stopPropagation();
    this.cellSelection.delete(this.cellKey(year, month, half));
    this.selectionChanged.emit([...this.selectedRaceIds]);
  }

  clearSelection(): void {
    this.cellSelection.clear();
    this.selectionChanged.emit([]);
  }

  hasAnySelected(): boolean {
    return this.cellSelection.size > 0;
  }

  getRaceById(id: number): RaceEntry | undefined {
    return this.raceMap.get(id);
  }

  /** Get saddle IDs corresponding to selected races */
  getSelectedSaddleIds(): number[] {
    const saddles = new Set<number>();
    for (const race of this.allRaces) {
      if (!this.selectedRaceIds.has(race.race_instance_id)) continue;
      for (const ws of race.win_saddles) {
        if (ws.required_race_instance_ids.length === 1 &&
            ws.required_race_instance_ids[0] === race.race_instance_id) {
          saddles.add(ws.saddle_id);
        }
      }
    }
    return [...saddles];
  }

  // ─── Import / Export ─────────────────────────────────────────────────────────

  exportSchedule(): void {
    const entries: ScheduleEntry[] = [];
    for (const [key, raceId] of this.cellSelection) {
      const race = this.raceMap.get(raceId);
      if (!race) continue;
      const [yearKey, monthStr, halfStr] = key.split('_');
      const month = parseInt(monthStr, 10);
      const half = parseInt(halfStr, 10);
      const turn = `${String(month).padStart(2, '0')}_${String(half).padStart(2, '0')}`;
      entries.push({
        raceName: race.name,
        grade: gradeNumberToLabel(race.grade),
        year: yearKeyToLabel(yearKey),
        turn,
      });
    }
    // Sort by year, then turn
    const yearOrder: Record<string, number> = { junior: 0, classic: 1, senior: 2 };
    entries.sort((a, b) => {
      const [, ya] = a.year.split(' ');
      const [, yb] = b.year.split(' ');
      const yo = (yearOrder[yearLabelToKey(a.year) ?? ''] ?? 0) - (yearOrder[yearLabelToKey(b.year) ?? ''] ?? 0);
      if (yo !== 0) return yo;
      return a.turn.localeCompare(b.turn);
    });

    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uma-agenda-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  triggerImport(): void {
    this.importInput.nativeElement.click();
  }

  importSchedule(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const entries: ScheduleEntry[] = JSON.parse(e.target?.result as string);
        this.cellSelection.clear();
        for (const entry of entries) {
          const parsed = parseTurn(entry.turn);
          if (!parsed) continue;
          const yearKey = yearLabelToKey(entry.year);
          if (!yearKey) continue;
          const { month, half } = parsed;
          const cellRaces = this.grid[yearKey]?.[month]?.[half] ?? [];
          const match = cellRaces.find(r => r.name === entry.raceName);
          if (match) {
            const key = this.cellKey(yearKey, month, half);
            this.cellSelection.set(key, match.race_instance_id);
          }
        }
        this.selectionChanged.emit([...this.selectedRaceIds]);
      } catch {
        console.error('Failed to parse schedule JSON');
      }
      // Reset input so same file can be re-imported
      (event.target as HTMLInputElement).value = '';
    };
    reader.readAsText(file);
  }

  getCellLabel(month: number, half: number): string {
    return `${HALF_LABELS[half - 1]} ${MONTH_NAMES[month - 1]}`;
  }

  getGradeClass(grade: number): string {
    switch (grade) {
      case 100: return 'grade-g1';
      case 200: return 'grade-g2';
      case 300: return 'grade-g3';
      default: return '';
    }
  }

  getPositionClass(position: number): string {
    if (position === 1) return 'pos-1st';
    if (position === 2) return 'pos-2nd';
    if (position === 3) return 'pos-3rd';
    return 'pos-other';
  }

  getOrdinalSuffix(n: number): string {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
  }

  getGradeLabel(grade: number): string {
    switch (grade) {
      case 100: return 'G1';
      case 200: return 'G2';
      case 300: return 'G3';
      default: return '';
    }
  }

  /** Get compact encoding for URL persistence: array of [yearIdx(0-2), month, half, raceId] */
  getEncodedSelection(): [number, number, number, number][] {
    const result: [number, number, number, number][] = [];
    for (const [key, raceId] of this.cellSelection) {
      const parts = key.split('_');
      if (parts.length !== 3) continue;
      const [yearKey, monthStr, halfStr] = parts;
      const yearIdx = this.years.indexOf(yearKey as any);
      if (yearIdx < 0) continue;
      result.push([yearIdx, parseInt(monthStr, 10), parseInt(halfStr, 10), raceId]);
    }
    return result;
  }

  /** Restore selection from encoded array (no emit) */
  setEncodedSelection(encoded: [number, number, number, number][]): void {
    this.cellSelection.clear();
    for (const [yearIdx, month, half, raceId] of encoded) {
      const yearKey = this.years[yearIdx];
      if (!yearKey) continue;
      this.cellSelection.set(this.cellKey(yearKey, month, half), raceId);
    }
  }
}
