import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatListModule } from '@angular/material/list';
import { ColorsService } from '../../services/colors.service';

export interface ClassFilterState {
  [key: string]: boolean;
}

export interface BottomSheetData {
  selectedClasses: ClassFilterState;
  classStats: { [key: string]: { count: number; percentage: number } };
  selectedDistance: string | null;
  distances: string[];
}

interface ClassOption {
  value: string;
  label: string;
  count?: number;
  percentage?: number;
}

@Component({
  selector: 'app-team-class-bottom-sheet',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatCheckboxModule, MatListModule],
  template: `
    <div class="bottom-sheet-header">
      <h2>Settings</h2>
      <button mat-icon-button (click)="close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="bottom-sheet-content">
      <!-- Team Class Filter Section -->
      <div class="filter-section">
        <div class="section-header">
          <h3>Team Class Filter</h3>
        </div>
        
        <!-- All Classes Toggle -->
        <div class="all-classes-toggle">
          <mat-checkbox 
            [checked]="allClassesSelected"
            [indeterminate]="someClassesSelected && !allClassesSelected"
            (change)="toggleAllClasses($event.checked)">
            All Classes
          </mat-checkbox>
        </div>

        <!-- Individual Class Options -->
        <div class="class-options">
          <div 
            *ngFor="let classOption of classOptions"
            class="class-option">
            <mat-checkbox 
              [checked]="localSelectedClasses[classOption.value]"
              (change)="toggleClass(classOption.value)">
            </mat-checkbox>
            <div class="class-badge" [ngStyle]="getBadgeStyle(classOption.value)">
              {{ classOption.label }}
            </div>
            <div class="class-stats">
              <div class="count">{{ formatNumber(classOption.count || 0) }}</div>
              <div class="percentage">{{ (classOption.percentage || 0).toFixed(1) }}%</div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Race Distance Section -->
      <div class="filter-section" *ngIf="data.distances.length > 0">
        <div class="section-header">
          <h3>Race Distance</h3>
        </div>
        
        <div class="distance-options">
          <button 
            *ngFor="let distance of data.distances"
            class="distance-option"
            [class.selected]="localSelectedDistance === distance"
            [ngStyle]="getDistanceButtonStyle(distance)"
            (click)="selectDistance(distance)">
            <mat-icon>{{ getDistanceIcon(distance) }}</mat-icon>
            <span>{{ getDistanceLabel(distance) }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './team-class-bottom-sheet.component.scss'
})
export class TeamClassBottomSheetComponent implements OnInit {
  classOptions: ClassOption[] = [
    { value: '6', label: 'Class 6' },
    { value: '5', label: 'Class 5' },
    { value: '4', label: 'Class 4' },
    { value: '3', label: 'Class 3' },
    { value: '2', label: 'Class 2' },
    { value: '1', label: 'Class 1' }
  ];

  localSelectedClasses: ClassFilterState = {};
  localSelectedDistance: string | null = null;

  constructor(
    private bottomSheetRef: MatBottomSheetRef<TeamClassBottomSheetComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: BottomSheetData,
    private colorsService: ColorsService
  ) {
    // Initialize local state from passed data
    this.localSelectedClasses = { ...data.selectedClasses };
    this.localSelectedDistance = data.selectedDistance;
  }

  ngOnInit(): void {
    this.setupClassStats();
  }

  get allClassesSelected(): boolean {
    return this.classOptions.every(option => this.localSelectedClasses[option.value]);
  }

  get someClassesSelected(): boolean {
    return this.classOptions.some(option => this.localSelectedClasses[option.value]);
  }

  private setupClassStats(): void {
    this.classOptions = this.classOptions.map(option => {
      const stats = this.data.classStats[option.value];
      return {
        ...option,
        count: stats?.count || 0,
        percentage: stats?.percentage || 0
      };
    });
  }

  toggleAllClasses(checked: boolean): void {
    this.classOptions.forEach(option => {
      this.localSelectedClasses[option.value] = checked;
    });
    this.propagateChanges();
  }

  toggleClass(classValue: string): void {
    this.localSelectedClasses[classValue] = !this.localSelectedClasses[classValue];
    this.propagateChanges();
  }

  selectDistance(distance: string): void {
    this.localSelectedDistance = distance;
    this.propagateChanges();
  }

  private propagateChanges(): void {
    // Immediately propagate changes without waiting for apply
    this.bottomSheetRef.dismiss({
      classFilters: this.localSelectedClasses,
      distance: this.localSelectedDistance
    });
  }

  close(): void {
    this.bottomSheetRef.dismiss();
  }

  getBadgeStyle(classValue: string): any {
    const color = this.colorsService.getClassColor(classValue);
    return {
      'background-color': color,
      'color': this.getTextColor(color)
    };
  }

  private getTextColor(backgroundColor: string): string {
    // Simple contrast calculation
    const rgb = this.hexToRgb(backgroundColor);
    if (!rgb) return '#000000';
    
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  getDistanceIcon(distance: string): string {
    const icons: { [key: string]: string } = {
      'sprint': 'flash_on',
      'mile': 'directions_run',
      'medium': 'timeline',
      'long': 'trending_up',
      'dirt': 'landscape'
    };
    return icons[distance] || 'track_changes';
  }

  getDistanceLabel(distance: string): string {
    const labels: { [key: string]: string } = {
      'sprint': 'Sprint',
      'mile': 'Mile',
      'medium': 'Medium',
      'long': 'Long',
      'dirt': 'Dirt'
    };
    return labels[distance] || distance;
  }

  getDistanceColor(distance: string): string {
    const colors: { [key: string]: string } = {
      'sprint': '#e74c3c', // Red
      'mile': '#f39c12', // Orange
      'medium': '#2ecc71', // Green 
      'long': '#3498db', // Blue
      'dirt': '#9b59b6' // Purple
    };
    return colors[distance] || '#7f8c8d';
  }

  getDistanceButtonStyle(distance: string): any {
    const isSelected = this.localSelectedDistance === distance;
    const color = this.getDistanceColor(distance);
    
    if (isSelected) {
      return {
        'background': color,
        'border-color': color,
        'color': '#ffffff'
      };
    }
    
    return {
      'border-color': color + '40', // 25% opacity
      'color': color
    };
  }
}