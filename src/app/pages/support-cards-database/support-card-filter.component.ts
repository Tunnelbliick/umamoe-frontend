import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';

import { SupportCard, SupportCardType, Rarity } from '../../models/support-card.model';
import { SupportCardSelectDialogComponent } from './support-card-select-dialog.component';

export interface SupportCardFilters {
  selectedCard: SupportCard | null;
  cardType: SupportCardType | null;
  rarity: Rarity | null;
  limitBreak: number;
}

@Component({
  selector: 'app-support-card-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSliderModule,
    MatInputModule
  ],
  template: `
    <div class="support-card-filter">
      <div class="filter-section">
        <h3>Support Card Filters</h3>

        <!-- Selected Support Card -->
        <div class="card-filter">
          <h4>Support Card</h4>
          <div class="card-selector">
            <div
              *ngIf="!selectedCard"
              class="empty-card"
              (click)="openCardDialog()"
            >
              <mat-icon>add</mat-icon>
              <span>Select Support Card</span>
            </div>
            <div *ngIf="selectedCard" class="selected-card">
              <div class="image-container">
                <img
                  [src]="selectedCard.imageUrl"
                  [alt]="selectedCard.name"
                  class="card-image"
                  (error)="onImageError($event)"
                  (load)="onImageLoad()"
                  loading="lazy"
                />
                <div *ngIf="isImageLoading" class="image-loading">
                  <mat-icon>hourglass_empty</mat-icon>
                </div>
              </div>
              <div class="card-info">
                <span class="card-name">{{selectedCard.name}}</span>
                <span class="card-character">{{selectedCard.character}}</span>
                <div class="card-meta">
                  <span class="card-type">{{getTypeDisplayName(selectedCard.type)}}</span>
                  <span class="card-rarity">{{getRarityDisplayName(selectedCard.rarity)}}</span>
                </div>
              </div>
              <button
                mat-icon-button
                class="remove-btn"
                (click)="removeCard()"
                matTooltip="Remove card"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Card Type Filter -->
        <!--<div class="type-filter">
          <h4>Card Type</h4>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Card Type</mat-label>
            <mat-select [(value)]="cardType" (selectionChange)="onFiltersChanged()">
              <mat-option value="">All Types</mat-option>
              <mat-option *ngFor="let type of cardTypes" [value]="type.value">
                {{type.label}}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>-->

        <!-- Rarity Filter -->
        <!--<div class="rarity-filter">
          <h4>Rarity</h4>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Rarity</mat-label>
            <mat-select [(value)]="rarity" (selectionChange)="onFiltersChanged()">
              <mat-option value="">All Rarities</mat-option>
              <mat-option *ngFor="let rarity of rarities" [value]="rarity.value">
                {{rarity.label}}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>-->

        <!-- Limit Break Slider -->
        <div class="limit-break-filter">
          <h4>Minimum Limit Break Level</h4>
          <div class="slider-container">
            <mat-slider
              min="0"
              max="4"
              step="1"
              class="limit-break-slider"
            >
              <input matSliderThumb [(ngModel)]="limitBreak" (valueChange)="onLimitBreakChanged($event)">
            </mat-slider>
            <div class="slider-labels">
              <span class="label" [class.active]="limitBreak === 0">LB0+</span>
              <span class="label" [class.active]="limitBreak === 1">LB1+</span>
              <span class="label" [class.active]="limitBreak === 2">LB2+</span>
              <span class="label" [class.active]="limitBreak === 3">LB3+</span>
              <span class="label" [class.active]="limitBreak === 4">MLB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./support-card-filter.component.scss'],
  host: {
    'class': 'support-card-filter-page',
  },
  providers: [],
  // Social meta tags for Discord/Twitter embeds
  // These are set dynamically for SPA, but static tags help for SSR/prerender/SEO
  // See also: support-cards-database.component.ts for pattern
  // Add meta tags for this filter dialog
  // (Dialogs are not main routes, but can still benefit from meta tags for SSR)
  // For main pages, use Meta service in ngOnInit
})
export class SupportCardFilterComponent implements OnInit {
  @Output() filtersChanged = new EventEmitter<SupportCardFilters>();

  selectedCard: SupportCard | null = null;
  cardType: SupportCardType | null = null;
  rarity: Rarity | null = null;
  limitBreak: number = 0;
  isImageLoading = true;

  cardTypes = [
    { value: SupportCardType.SPEED, label: 'Speed' },
    { value: SupportCardType.STAMINA, label: 'Stamina' },
    { value: SupportCardType.POWER, label: 'Power' },
    { value: SupportCardType.GUTS, label: 'Guts' },
    { value: SupportCardType.WISDOM, label: 'Wisdom' },
    { value: SupportCardType.FRIEND, label: 'Friend' }
  ];

  rarities = [
    { value: Rarity.R, label: 'R' },
    { value: Rarity.SR, label: 'SR' },
    { value: Rarity.SSR, label: 'SSR' }
  ];

  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    // Emit initial state
    this.onFiltersChanged();
  }

  openCardDialog() {
    const dialogRef = this.dialog.open(SupportCardSelectDialogComponent, {
      maxWidth: '800px',
      data: { initialCard: this.selectedCard }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.isImageLoading = true;
        this.selectedCard = result;
        this.onFiltersChanged();
      }
    });
  }

  removeCard() {
    this.selectedCard = null;
    this.onFiltersChanged();
  }

  onLimitBreakChanged(value: number | null) {
    this.limitBreak = value || 0;
    this.onFiltersChanged();
  }

  onFiltersChanged() {
    const filters: SupportCardFilters = {
      selectedCard: this.selectedCard,
      cardType: this.cardType,
      rarity: this.rarity,
      limitBreak: this.limitBreak
    };
    this.filtersChanged.emit(filters);
  }

  clearFilters() {
    this.selectedCard = null;
    this.cardType = null;
    this.rarity = null;
    this.limitBreak = 0;
    this.onFiltersChanged();
  }

  getTypeDisplayName(type: SupportCardType): string {
    const typeMap = {
      [SupportCardType.SPEED]: 'Speed',
      [SupportCardType.STAMINA]: 'Stamina',
      [SupportCardType.POWER]: 'Power',
      [SupportCardType.GUTS]: 'Guts',
      [SupportCardType.WISDOM]: 'Wisdom',
      [SupportCardType.FRIEND]: 'Friend'
    };
    return typeMap[type] || 'Unknown';
  }

  getRarityDisplayName(rarity: Rarity): string {
    const rarityMap = {
      [Rarity.R]: 'R',
      [Rarity.SR]: 'SR',
      [Rarity.SSR]: 'SSR'
    };
    return rarityMap[rarity] || 'Unknown';
  }

  onImageError(event: any) {
    event.target.src = 'assets/images/placeholder-card.png';
    this.isImageLoading = false;
  }
  
  onImageLoad() {
    this.isImageLoading = false;
  }
}
