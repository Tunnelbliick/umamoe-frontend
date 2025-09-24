import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface DistanceChangeEvent {
  distance: string | null;
}

@Component({
  selector: 'app-distance-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule
  ],
  template: `
    <div 
      class="distance-selector-card" 
      [class.visible]="isVisible"
      [class.compact]="compactMode"
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
          <span class="pill-label" [class.hidden]="compactMode && distances.length > 3">
            {{ getDistanceLabel(distance) }}
          </span>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./distance-selector.component.scss']
})
export class DistanceSelectorComponent implements OnInit, OnDestroy {
  @Input() selectedDistance: string | null = null;
  @Input() distances: string[] = [];
  @Input() compactMode = false;
  @Output() distanceChanged = new EventEmitter<DistanceChangeEvent>();

  isVisible = false;
  private scrollListener: (() => void) | null = null;
  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.setupScrollListener();
  }

  ngOnDestroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }

  private setupScrollListener(): void {
    let ticking = false;

    this.scrollListener = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.updateVisibility();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', this.scrollListener, { passive: true });
    
    // Initial check
    setTimeout(() => this.updateVisibility(), 100);
  }

  private updateVisibility(): void {
    const distanceSection = document.querySelector('.distance-section');
    const characterDetailsSection = document.querySelector('.character-details');
    
    let shouldShow = false;

    // Check if distance section is visible
    if (distanceSection) {
      const rect = distanceSection.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight * 0.8 && rect.bottom > 0;
      shouldShow = shouldShow || isVisible;
    }

    // Check if character details section is visible
    if (characterDetailsSection) {
      const rect = characterDetailsSection.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight * 0.8 && rect.bottom > 0;
      shouldShow = shouldShow || isVisible;
    }

    if (this.isVisible !== shouldShow) {
      this.isVisible = shouldShow;
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
}