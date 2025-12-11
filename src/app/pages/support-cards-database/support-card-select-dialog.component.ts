import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable, map, startWith } from 'rxjs';
import { FormControl } from '@angular/forms';

import { SupportCard, SupportCardType, Rarity, SupportCardShort } from '../../models/support-card.model';
import { SupportCardService } from '../../services/support-card.service';

@Component({
    selector: 'app-support-card-select-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule
    ],
    template: `
    <div class="modern-dialog-container">
      <div class="dialog-header">
        <div class="header-icon-wrapper">
          <mat-icon class="header-icon">style</mat-icon>
        </div>
        <div class="header-text">
          <h2>Select Support Card</h2>
          <p>Choose a support card to filter by</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <div class="search-section">
          <!-- Search Input -->
          <mat-form-field appearance="fill" class="full-width">
            <mat-label>Search support cards...</mat-label>
            <input 
              matInput 
              [formControl]="searchControl"
              (input)="filterCards()"
              placeholder="Search by card name or character"
            >
            <mat-icon matSuffix class="input-icon">search</mat-icon>
          </mat-form-field>

          <!-- Quick Filters -->
          <div class="quick-filters">
            <mat-form-field appearance="fill">
              <mat-label>Card Type</mat-label>
              <mat-select [formControl]="typeControl" (selectionChange)="filterCards()">
                <mat-option value="">All Types</mat-option>
                <mat-option *ngFor="let type of cardTypes" [value]="type.value">
                  {{type.label}}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="fill">
              <mat-label>Rarity</mat-label>
              <mat-select [formControl]="rarityControl" (selectionChange)="filterCards()">
                <mat-option value="">All Rarities</mat-option>
                <mat-option *ngFor="let rarity of rarities" [value]="rarity.value">
                  {{rarity.label}}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- Card List -->
        <div class="card-list">
          <div 
            *ngFor="let card of filteredCardsSync" 
            class="card-item"
            [class.selected]="selectedCard?.id === card.id"
            (click)="selectCard(card)"
          >
            <div class="card-image">
              <img [src]="card.imageUrl" [alt]="card.name" (error)="onImageError($event)">
            </div>
            <div class="card-details">
              <h4>{{card.name}}</h4>
              <div class="card-tags">
                <span class="type-tag">{{getTypeDisplayName(card.type)}}</span>
                <span class="rarity-tag">{{getRarityDisplayName(card.rarity)}}</span>
              </div>
            </div>
          </div>
        </div>
      </mat-dialog-content>

      <div class="dialog-actions">
        <button mat-stroked-button class="cancel-btn" (click)="cancel()">Cancel</button>
      </div>
    </div>
  `,
    styleUrls: ['./support-card-select-dialog.component.scss'],
    host: {
        'class': 'support-card-select-dialog-page',
    },
    providers: [],
    // Social meta tags for Discord/Twitter embeds
    // These are set dynamically for SPA, but static tags help for SSR/prerender/SEO
    // See also: support-cards-database.component.ts for pattern
    // Add meta tags for this dialog
})
export class SupportCardSelectDialogComponent implements OnInit {
    @Input() initialCard?: SupportCardShort;
    @Output() cardSelected = new EventEmitter<SupportCard>();

    searchControl = new FormControl('');
    typeControl = new FormControl('');
    rarityControl = new FormControl('');

    supportCards: SupportCardShort[] = [];
    filteredCardsSync: SupportCardShort[] = [];
    selectedCard: SupportCardShort | null = null;

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

    constructor(
        private dialogRef: MatDialogRef<SupportCardSelectDialogComponent>,
        private supportCardService: SupportCardService
    ) {}

    ngOnInit() {
        this.loadSupportCards();
        this.selectedCard = this.initialCard || null;
    }

    private loadSupportCards() {
        this.supportCardService.getReleasedSupportCards().subscribe({
            next: (cards: SupportCardShort[]) => {
                this.supportCards = cards;
                this.filteredCardsSync = cards;
            },
            error: (error: any) => {
                console.error('Error loading support cards:', error);
            }
        });
    }

    private _filter(value: string): SupportCardShort[] {
        if (!value || typeof value !== 'string') {
            return this.applyFilters(this.supportCards);
        }

        const filterValue = value.toLowerCase();
        const filtered = this.supportCards.filter(card =>
            card.name.toLowerCase().includes(filterValue)
        );

        return this.applyFilters(filtered);
    }

    private applyFilters(cards: SupportCardShort[]): SupportCardShort[] {
        let filtered = cards;

        if (this.typeControl.value !== '' && this.typeControl.value !== null) {
            filtered = filtered.filter(card => card.type === Number(this.typeControl.value));
        }

        if (this.rarityControl.value !== '' && this.rarityControl.value !== null) {
            filtered = filtered.filter(card => card.rarity === Number(this.rarityControl.value));
        }
        
        // Sort cards: Speed cards first, then by rarity (SSR first), then by name
        return filtered.sort((a, b) => {
            // First, sort by Speed type
            if (a.type === SupportCardType.SPEED && b.type !== SupportCardType.SPEED) return -1;
            if (a.type !== SupportCardType.SPEED && b.type === SupportCardType.SPEED) return 1;
            
            // Then by rarity (descending order: SSR first)
            if (a.rarity > b.rarity) return -1;
            if (a.rarity < b.rarity) return 1;
            
            // Then by name
            return a.name.localeCompare(b.name);
        });
    }

    filterCards() {
        const searchValue = this.searchControl.value || '';
        this.filteredCardsSync = this._filter(searchValue);
    }

    selectCard(card: SupportCardShort) {
        this.selectedCard = card;
        this.confirm();
    }

    displayFn(card: SupportCardShort): string {
        return card ? `${card.name}` : '';
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
    }

    confirm() {
        if (this.selectedCard) {
            this.dialogRef.close(this.selectedCard);
        }
    }

    cancel() {
        this.dialogRef.close();
    }
}
