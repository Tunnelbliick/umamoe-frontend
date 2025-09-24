import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, Optional, inject, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ColorsService } from '../../services/colors.service';

export interface ClassFilterState {
  [key: string]: boolean;
}

export interface DistanceChangeEvent {
  distance: string | null;
}

interface ClassOption {
  value: string;
  label: string;
  isOverall?: boolean;
  count?: number;
  percentage?: number;
}

@Component({
  selector: 'app-class-filter',
  standalone: true,
  imports: [
    CommonModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule
  ],
  template: `
    <!-- Desktop Mode Only - Class Filter Card -->
    <div class="filter-container">
      <div class="filter-header">
        <h3>Team Class Filter</h3>
      </div>

      <div class="filter-options">
        <div class="filter-option" *ngFor="let classOption of classOptions">
          <mat-checkbox 
            [formControl]="getClassControl(classOption.value)"
            [color]="'primary'"
            class="class-checkbox">
            <div class="class-option-content">
              <div class="class-badge" 
                   [ngStyle]="getBadgeStyle(classOption.value)">
                {{ classOption.label }}
              </div>
              <div class="class-info" *ngIf="classOption.count">
                <span class="count">{{ formatNumber(classOption.count) }}</span>
                <span class="percentage">{{ classOption.percentage?.toFixed(1) }}%</span>
              </div>
            </div>
          </mat-checkbox>
        </div>
      </div>
    </div>

    <!-- Distance Selector Card -->
    <div 
      class="distance-selector-card" 
      [class.visible]="showDistanceSelector"
      [class.compact]="compactMode"
      *ngIf="distances.length > 0"
    >
      <div class="distance-header">
        <mat-icon>track_changes</mat-icon>
        <span>Race Distance</span>
      </div>
      
      <div class="distance-pills">
        <button
          *ngFor="let distance of distances"
          class="distance-pill"
          [class.active]="selectedDistance === distance"
          [attr.data-distance]="distance"
          [title]="getDistanceLabel(distance)"
          (click)="onDistanceSelect(distance)"
        >
          <mat-icon class="pill-icon">{{ getDistanceIcon(distance) }}</mat-icon>
          <span class="pill-label">
            {{ getDistanceLabel(distance) }}
          </span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./class-filter.component.scss']
})
export class ClassFilterComponent implements OnInit, OnDestroy, OnChanges {
  @Input() selectedClasses: ClassFilterState = {};
  @Input() classStats: { [key: string]: { count: number; percentage: number } } = {};
  @Output() filtersChanged = new EventEmitter<ClassFilterState>();

  // Distance selector inputs and outputs
  @Input() selectedDistance: string | null = null;
  @Input() distances: string[] = [];
  @Input() compactMode = false;
  @Input() showDistanceSelector = false;
  @Output() distanceChanged = new EventEmitter<DistanceChangeEvent>();

  classOptions: ClassOption[] = [
    { value: 'overall', label: 'All Classes', isOverall: true },
    { value: '6', label: 'Class 6' },
    { value: '5', label: 'Class 5' },
    { value: '4', label: 'Class 4' },
    { value: '3', label: 'Class 3' },
    { value: '2', label: 'Class 2' },
    { value: '1', label: 'Class 1' }
  ];

  classControls: { [key: string]: FormControl<boolean | null> } = {};
  private colorsService = inject(ColorsService);
  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);

  // Distance selector properties
  private scrollListener: (() => void) | null = null;

  constructor() {}

  ngOnInit(): void {
    this.initializeControls();
    this.setupClassStats();
    this.setupScrollListener();
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-setup class stats if they change
    if (changes['classStats'] || changes['selectedClasses']) {
      this.setupClassStats();
    }
  }

  private initializeControls(): void {
    // First, determine if all individual classes are currently selected
    const individualClasses = this.classOptions.filter(opt => opt.value !== 'overall');
    const allClassesSelected = individualClasses.every(option => 
      this.selectedClasses[option.value] !== false
    );

    this.classOptions.forEach(option => {
      let isSelected: boolean;
      
      if (option.value === 'overall') {
        // "All Classes" should be checked only if all individual classes are selected
        isSelected = allClassesSelected;
      } else {
        // Individual classes use their own state
        isSelected = this.selectedClasses[option.value] !== false;
      }
      
      this.classControls[option.value] = new FormControl(isSelected);
      
      this.classControls[option.value].valueChanges.subscribe(() => {
        // Handle "All Classes" toggle logic
        if (option.value === 'overall') {
          const allClassesChecked = this.classControls['overall'].value;
          
          // When "All Classes" is toggled, set all other classes to the same state
          this.classOptions.filter(opt => opt.value !== 'overall').forEach(opt => {
            this.classControls[opt.value].setValue(allClassesChecked, { emitEvent: false });
          });
          
          // Use setTimeout to ensure all individual controls are updated before emitting
          setTimeout(() => {
            this.emitChanges();
          }, 0);
        } else {
          // When an individual class is toggled, update the "All Classes" state
          this.updateAllClassesState();
          this.emitChanges();
        }
      });
    });
  }

  private updateAllClassesState(): void {
    // Check if all individual classes are currently selected
    const individualClasses = this.classOptions.filter(opt => opt.value !== 'overall');
    const allClassesSelected = individualClasses.every(option => 
      this.classControls[option.value].value === true
    );
    
    // Update the "All Classes" checkbox state without triggering its change event
    this.classControls['overall'].setValue(allClassesSelected, { emitEvent: false });
  }

  private setupClassStats(): void {
    this.classOptions = this.classOptions.map(option => {
      if (option.isOverall) {
        // Calculate total for "All Classes"
        const total = Object.values(this.classStats).reduce((sum, stat) => sum + stat.count, 0);
        return {
          ...option,
          count: total,
          percentage: 100
        };
      } else {
        const stats = this.classStats[option.value];
        return {
          ...option,
          count: stats?.count || 0,
          percentage: stats?.percentage || 0
        };
      }
    });
  }

  getClassControl(classValue: string): FormControl<boolean | null> {
    return this.classControls[classValue];
  }

  private emitChanges(): void {
    const currentState: ClassFilterState = {};
    
    // Get the state of individual classes only (exclude 'overall')
    this.classOptions.filter(opt => opt.value !== 'overall').forEach(option => {
      currentState[option.value] = this.classControls[option.value].value || false;
    });
    
    this.filtersChanged.emit(currentState);
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
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

  // Distance selector methods
  private setupScrollListener(): void {
    let ticking = false;

    this.scrollListener = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.updateDistanceVisibility();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', this.scrollListener, { passive: true });
    
    // Initial check
    setTimeout(() => this.updateDistanceVisibility(), 100);
  }

  private updateDistanceVisibility(): void {
    const distanceSection = document.querySelector('.distance-section');
    const characterDetailsSection = document.querySelector('.character-details');
    
    let shouldShow = false;

    // Check if distance section is visible and has meaningful content
    if (distanceSection) {
      const rect = distanceSection.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight * 0.9 && rect.bottom > -100;
      shouldShow = shouldShow || isVisible;
    }

    // Check if character details section is visible (character distance analysis)
    if (characterDetailsSection) {
      const rect = characterDetailsSection.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight * 0.9 && rect.bottom > -100;
      shouldShow = shouldShow || isVisible;
    }

    if (this.showDistanceSelector !== shouldShow) {
      this.showDistanceSelector = shouldShow;
      this.cdr.detectChanges();
    }
  }

  onDistanceSelect(distance: string): void {
    this.distanceChanged.emit({ distance });
  }

  getDistanceIcon(distance: string): string {
    const icons: { [key: string]: string } = {
      'sprint': 'flash_on',           // Lightning bolt for sprint
      'mile': 'directions_run',       // Running person for mile
      'medium': 'timeline',           // Timeline for medium distance
      'long': 'trending_up',          // Trending up for long distance
      'dirt': 'landscape'             // Landscape for dirt track
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
      'sprint': '#e74c3c',    // Red for sprint
      'mile': '#f39c12',      // Orange for mile
      'medium': '#2ecc71',    // Green for medium
      'long': '#3498db',      // Blue for long
      'dirt': '#9b59b6'       // Purple for dirt
    };
    return colors[distance] || '#6c757d';
  }

  onClassToggle(classValue: string): void {
    const control = this.classControls[classValue];
    if (control) {
      control.setValue(!control.value);
    }
  }
}
