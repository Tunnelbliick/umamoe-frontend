import {
  Component,
  EventEmitter,
  Output,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormControl,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Subject, Subscription, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, startWith, map } from 'rxjs/operators';

import { CharacterService } from '../../services/character.service';
import { FactorService, Factor } from '../../services/factor.service';
import { Character } from '../../models/character.model';
import { CharacterSelectDialogComponent } from './character-select-dialog.component';
import { MatCard, MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';
import { environment } from '../../../environments/environment';

export interface MainStatFilter {
  type: string | undefined; // Factor ID instead of text name
  level: number | undefined; // 1-9
}

export interface AptitudeFilter {
  type: string | undefined; // Factor ID instead of text name
  level: number | undefined; // 1-9
}

export interface SkillFilter {
  type: string | undefined; // Factor ID instead of text name
  level: number | undefined; // 1-3 for unique skills
}

export interface WhiteSparkFilter {
  type: string | undefined; // Factor ID for white sparks
  level: number | undefined; // 1-9
}

export interface InheritanceFilters {
  selectedCharacterId: number | null;
  mainStats: MainStatFilter[];
  aptitudes: AptitudeFilter[];
  skills: SkillFilter[];
  whiteSparks: WhiteSparkFilter[];
  // New v2 filters
  parentRank: number;
  winCount: number;
  whiteCount: number;
}

@Component({
  selector: 'app-inheritance-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule,
    MatSelectModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatSliderModule,
    MatExpansionModule,
  ],
  template: `
    <div class="inheritance-filter">
      <div class="filter-section">
        <h3>Inheritance Filters</h3>

        <!-- Selected Character -->
        <div class="character-filter">
          <h4>Inherited Uma</h4>
          <div class="character-selector">
            <div
              *ngIf="!selectedCharacter"
              class="empty-character"
              (click)="openCharacterDialog()"
            >
              <mat-icon>add</mat-icon>
              <span>Select Umas</span>
            </div>
            <div *ngIf="selectedCharacter" class="selected-character">
              <img
                [src]="getCharacterImagePath(selectedCharacter.image)"
                [alt]="selectedCharacter.name"
                class="character-image"
              />
              <span class="character-name">{{
                selectedCharacter.name
              }}</span>
              <button
                mat-icon-button
                (click)="removeCharacter()"
                class="remove-btn"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Main Stats (Blue Sparks) -->
        <div class="main-stats-filter">
          <h4>Main Stats (Blue Sparks)</h4>
          <div class="add-filter">
            <ng-container *ngFor="let stat of filters.mainStats; let i = index; trackBy: trackByIndex">
              <div class="stat-filter">
                <div class="filter-content">
                  <mat-form-field appearance="outline" class="select-field">
                    <mat-label>Stat Type</mat-label>
                    <mat-select [(value)]="filters.mainStats[i].type" (selectionChange)="onDropdownChange()">
                      <mat-option 
                        *ngFor="let option of blueFactorOptions; trackBy: trackByFactorId" 
                        [value]="option.id">
                        {{ option.text }}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                  <div class="slider-container">
                    <mat-slider 
                      min="1" 
                      max="9" 
                      step="1" 
                      discrete
                      showTickMarks
                      [displayWith]="formatSliderValue"
                      class="level-slider">
                      <input matSliderThumb [(ngModel)]="filters.mainStats[i].level" (ngModelChange)="onSliderChange()">
                    </mat-slider>
                  </div>
                </div>
                <button
                  mat-icon-button
                  (click)="removeMainStat(i)"
                  class="remove-btn"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </ng-container>
            <div class="empty-stats" (click)="addMainStatFilter()">
              <mat-icon>add</mat-icon>
              <span>Add Main Stat Filter</span>
            </div>
          </div>
        </div>

        <!-- Aptitudes (Pink Sparks) -->
        <div class="aptitude-filter">
          <h4>Aptitudes (Pink Sparks)</h4>
          <div class="add-filter">
            <ng-container *ngFor="let stat of filters.aptitudes; let i = index; trackBy: trackByIndex">
              <div class="stat-filter">
                <div class="filter-content">
                  <mat-form-field appearance="outline" class="select-field">
                    <mat-label>Aptitudes</mat-label>
                    <mat-select [(value)]="filters.aptitudes[i].type" (selectionChange)="onDropdownChange()">
                      <mat-option 
                        *ngFor="let option of pinkFactorOptions; trackBy: trackByFactorId" 
                        [value]="option.id">
                        {{ option.text }}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                  <div class="slider-container">
                    <mat-slider 
                      min="1" 
                      max="9" 
                      step="1" 
                      discrete
                      showTickMarks
                      [displayWith]="formatSliderValue"
                      class="level-slider">
                      <input matSliderThumb [(ngModel)]="filters.aptitudes[i].level" (ngModelChange)="onSliderChange()">
                    </mat-slider>
                  </div>
                </div>
                <button
                  mat-icon-button
                  (click)="removeAptitude(i)"
                  class="remove-btn"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </ng-container>
            <div class="empty-stats" (click)="addAptitudeFilter()">
              <mat-icon>add</mat-icon>
              <span>Add Aptitudes Filter</span>
            </div>
          </div>
        </div>

        <!-- Skills (Green Sparks) -->
        <div class="skills-filter">
          <h4>Unique Skills (Green Sparks)</h4>
          <div class="add-filter">
            <ng-container *ngFor="let skillFilter of filters.skills; let i = index; trackBy: trackByIndex">
              <div class="stat-filter">
                <div class="filter-content">
                  <mat-form-field appearance="outline" class="select-field">
                    <mat-label>Unique Skill</mat-label>
                    <input
                      matInput
                      [(ngModel)]="filters.skills[i].type"
                      [matAutocomplete]="skillAuto"
                      (input)="onSkillInputChange($event, i)"
                      (ngModelChange)="onDropdownChange()"
                      placeholder="Search for unique skill..."
                    />
                    <mat-autocomplete #skillAuto="matAutocomplete" [displayWith]="displaySkillFn">
                      <mat-option 
                        *ngFor="let option of getFilteredSkillOptions(i); trackBy: trackByFactorId" 
                        [value]="option.id">
                        {{ option.text }}
                      </mat-option>
                    </mat-autocomplete>
                  </mat-form-field>
                  <div class="slider-container">
                    <mat-slider 
                      min="1" 
                      max="3" 
                      step="1" 
                      discrete
                      showTickMarks
                      [displayWith]="formatSliderValue"
                      class="level-slider">
                      <input matSliderThumb [(ngModel)]="filters.skills[i].level" (ngModelChange)="onSliderChange()">
                    </mat-slider>
                  </div>
                </div>
                <button
                  mat-icon-button
                  (click)="removeSkill(i)"
                  class="remove-btn"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </ng-container>
            <div class="empty-stats" (click)="addSkillFilter()">
              <mat-icon>add</mat-icon>
              <span>Add Unique Skills Filter</span>
            </div>
          </div>
        </div>

        <!-- White Sparks -->
        <div class="white-sparks-filter">
          <h4>White Sparks</h4>
          <div class="add-filter">
            <ng-container *ngFor="let whiteSpark of filters.whiteSparks; let i = index; trackBy: trackByIndex">
              <div class="stat-filter">
                <div class="filter-content">
                  <mat-form-field appearance="outline" class="select-field">
                    <mat-label>White Spark Type</mat-label>
                    <input
                      matInput
                      [(ngModel)]="filters.whiteSparks[i].type"
                      [matAutocomplete]="whiteSparkAuto"
                      (input)="onWhiteSparkInputChange($event, i)"
                      (ngModelChange)="onDropdownChange()"
                      placeholder="Search for white spark..."
                    />
                    <mat-autocomplete #whiteSparkAuto="matAutocomplete" [displayWith]="displayWhiteSparkFn">
                      <mat-option 
                        *ngFor="let option of getFilteredWhiteSparkOptions(i); trackBy: trackByFactorId" 
                        [value]="option.id">
                        {{ option.text }}
                      </mat-option>
                    </mat-autocomplete>
                  </mat-form-field>
                  <div class="slider-container">
                    <mat-slider 
                      min="1" 
                      max="9" 
                      step="1" 
                      discrete
                      showTickMarks
                      [displayWith]="formatSliderValue"
                      class="level-slider">
                      <input matSliderThumb [(ngModel)]="filters.whiteSparks[i].level" (ngModelChange)="onSliderChange()">
                    </mat-slider>
                  </div>
                </div>
                <button
                  mat-icon-button
                  (click)="removeWhiteSpark(i)"
                  class="remove-btn"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </ng-container>
            <div class="empty-stats" (click)="addWhiteSparkFilter()">
              <mat-icon>add</mat-icon>
              <span>Add White Spark Filter</span>
            </div>
          </div>
        </div>

        <!-- Additional Filters -->
        <div class="additional-filters">
          <h4>Additional Filters</h4>
          
          <!-- Parent Rank Dropdown with Icons -->
          <mat-form-field appearance="outline" class="full-width rank-select-field">
            <mat-label>Minimum Parent Rank</mat-label>
            <mat-select 
              [(value)]="filters.parentRank" 
              (selectionChange)="onDropdownChange()"
              panelClass="rank-select-panel">
              
              <!-- Custom trigger to show selected value with icon -->
              <mat-select-trigger>
                <div class="selected-rank-display" *ngIf="filters.parentRank === 0">
                  <mat-icon class="no-rank-icon">block</mat-icon>
                  <span class="rank-text">No Minimum</span>
                </div>
                <div class="selected-rank-display" *ngIf="filters.parentRank > 0">
                  <img 
                    [src]="getRankIconPath(filters.parentRank)" 
                    [alt]="'Rank ' + filters.parentRank"
                    class="rank-icon"
                    (error)="onRankIconError($event, filters.parentRank)"
                  />
                  <span class="rank-text">Rank {{ filters.parentRank }}</span>
                </div>
              </mat-select-trigger>
              
              <mat-option [value]="0">
                <div class="rank-option-content">
                  <mat-icon class="no-rank-icon">block</mat-icon>
                  <span class="rank-text">No Minimum</span>
                </div>
              </mat-option>
              <mat-option *ngFor="let rank of rankOptions" [value]="rank">
                <div class="rank-option-content">
                  <img 
                    [src]="getRankIconPath(rank)" 
                    [alt]="'Rank ' + rank"
                    class="rank-icon"
                    (error)="onRankIconError($event, rank)"
                  />
                  <span class="rank-text">Rank {{ rank }}</span>
                </div>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- G1 Wins Input -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Minimum G1 Wins</mat-label>
            <input
              matInput
              [(ngModel)]="filters.winCount"
              (input)="onNumberInputChange()"
              placeholder="0"
            />
          </mat-form-field>

          <!-- White Sparks Input -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Minimum White Sparks</mat-label>
            <input
              matInput
              [(ngModel)]="filters.whiteCount"
              (input)="onNumberInputChange()"
              placeholder="0" 
            />
          </mat-form-field>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./inheritance-filter.component.scss'],
  host: {
    'class': 'inheritance-filter-page',
  },
  providers: [],
  // Social meta tags for Discord/Twitter embeds
  // These are set dynamically for SPA, but static tags help for SSR/prerender/SEO
  // See also: support-cards-database.component.ts for pattern
  // Add meta tags for this filter dialog
})
export class InheritanceFilterComponent implements OnInit, OnDestroy {
  @Output() filtersChanged = new EventEmitter<InheritanceFilters>();

  filters: InheritanceFilters = {
    selectedCharacterId: null,
    mainStats: [],
    aptitudes: [],
    skills: [],
    whiteSparks: [],
    parentRank: 0,
    winCount: 0,
    whiteCount: 0,
  };

  // Store the full character object for display purposes
  selectedCharacter: Character | null = null;

  sparkLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  uniqueSkillLevels = [1, 2, 3];
  
  // Add rank options array for the dropdown
  rankOptions = Array.from({ length: 20 }, (_, i) => i + 1); // [1, 2, 3, ..., 20]
  
  // Factor options from factors.json
  blueFactorOptions: Factor[] = [];
  pinkFactorOptions: Factor[] = [];
  greenFactorOptions: Factor[] = [];
  whiteSparkOptions: Factor[] = [];

  // Filtered skill options for each autocomplete
  filteredSkillOptions: Factor[][] = [];
  filteredWhiteSparkOptions: Factor[][] = [];

  // Temporary objects for adding new filters
  newMainStat: Partial<MainStatFilter> = {};
  newAptitude: Partial<AptitudeFilter> = {};
  newSkill: Partial<SkillFilter> = {};

  // Debounce subject for auto-apply
  private filterChangeSubject = new Subject<void>();
  private filterChangeSubscription?: Subscription;

  constructor(
    private characterService: CharacterService,
    private factorService: FactorService,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    // Load factors from FactorService
    this.factorService.getFactors().subscribe((factors) => {
      this.blueFactorOptions = factors.filter(f => f.type === 0); // Blue factors (main stats)
      this.pinkFactorOptions = factors.filter(f => f.type === 1); // Pink factors (aptitudes)
      this.greenFactorOptions = factors.filter(f => f.type === 5); // Green factors (unique skills)
      this.whiteSparkOptions = factors.filter(f => f.type === 4 || f.type === 3 || f.type === 2); // White sparks
      
      // Initialize filtered options for existing skills
      this.filteredSkillOptions = this.filters.skills.map(() => [...this.greenFactorOptions]);
      this.filteredWhiteSparkOptions = this.filters.whiteSparks.map(() => [...this.whiteSparkOptions]);
    });

    // Set up debounced filter changes with longer delay to prevent excessive emissions
    this.filterChangeSubscription = this.filterChangeSubject
      .pipe(debounceTime(300)) // Increased from 150ms to 300ms
      .subscribe(() => {
        // Emit a deep copy to ensure change detection works
        const filtersCopy = JSON.parse(JSON.stringify(this.filters));
        if (!environment.production) {
          console.log('Emitting filters to parent:', filtersCopy);
        }
        this.filtersChanged.emit(filtersCopy);
      });
  }

  ngOnDestroy() {
    if (this.filterChangeSubscription) {
      this.filterChangeSubscription.unsubscribe();
    }
  }

  addMainStatFilter() {
    this.filters.mainStats.push({
      type: undefined,
      level: 1, // Default to level 1
    });
    this.newMainStat = {};
    // Don't emit immediately for better performance
  }

  addAptitudeFilter() {
    this.filters.aptitudes.push({
      type: undefined,
      level: 1, // Default to level 1
    });
    this.newAptitude = {};
    // Don't emit immediately for better performance
  }

  addSkillFilter() {
    this.filters.skills.push({
      type: undefined,
      level: 1, // Default to level 1
    });
    this.filteredSkillOptions.push([...this.greenFactorOptions]);
    this.newSkill = {};
    // Don't emit immediately for better performance
  }

  onSkillInputChange(event: any, index: number) {
    const value = event.target.value;
    if (!value) {
      this.filteredSkillOptions[index] = [...this.greenFactorOptions];
    } else {
      this.filteredSkillOptions[index] = this.greenFactorOptions.filter(option =>
        option.text.toLowerCase().includes(value.toLowerCase())
      );
    }
  }

  onWhiteSparkInputChange(event: any, index: number) {
    const value = event.target.value;
    if (!value) {
      this.filteredWhiteSparkOptions[index] = [...this.whiteSparkOptions];
    } else {
      this.filteredWhiteSparkOptions[index] = this.whiteSparkOptions.filter(option =>
        option.text.toLowerCase().includes(value.toLowerCase())
      );
    }
  }

  getFilteredSkillOptions(index: number): Factor[] {
    return this.filteredSkillOptions[index] || this.greenFactorOptions;
  }

  getFilteredWhiteSparkOptions(index: number): Factor[] {
    return this.filteredWhiteSparkOptions[index] || this.whiteSparkOptions;
  }

  displaySkillFn = (value: string): string => {
    if (!value) return '';
    // Find the skill by ID and return its text
    const skill = this.greenFactorOptions.find(option => option.id === value);
    return skill ? skill.text : value;
  }

  displayWhiteSparkFn = (value: string): string => {
    if (!value) return '';
    // Find the white spark by ID and return its text
    const whiteSpark = this.whiteSparkOptions.find(option => option.id === value);
    return whiteSpark ? whiteSpark.text : value;
  }

  onSliderChange() {
    // Debounced change for sliders
    this.emitFiltersChanged();
  }

  onDropdownChange() {
    // Immediate change for dropdowns since they're less frequent
    this.emitFiltersChanged();
  }

  onNumberInputChange() {
    // Debounced change for number inputs
    this.emitFiltersChanged();
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }

  trackByFactorId(index: number, factor: Factor): string {
    return factor.id;
  }

  formatSliderValue = (value: number): string => {
    return `${value}★`;
  }

  removeSkill(index: number) {
    this.filters.skills.splice(index, 1);
    this.filteredSkillOptions.splice(index, 1);
    this.emitFiltersChanged();
  }

  addWhiteSparkFilter() {
    this.filters.whiteSparks.push({ type: undefined, level: 1 });
    this.filteredWhiteSparkOptions.push([...this.whiteSparkOptions]);
    this.emitFiltersChanged();
  }

  removeWhiteSpark(index: number) {
    this.filters.whiteSparks.splice(index, 1);
    this.filteredWhiteSparkOptions.splice(index, 1);
    this.emitFiltersChanged();
  }

  openCharacterDialog() {
    const dialogRef = this.dialog.open(CharacterSelectDialogComponent, {
      maxWidth: '750px',
      data: {},
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.selectedCharacter = result;
        this.filters.selectedCharacterId = result.id;
        this.emitFiltersChanged();
      }
    });
  }

  removeCharacter() {
    this.selectedCharacter = null;
    this.filters.selectedCharacterId = null;
    this.emitFiltersChanged();
  }

  removeMainStat(index: number) {
    this.filters.mainStats.splice(index, 1);
    this.emitFiltersChanged();
  }

  removeAptitude(index: number) {
    this.filters.aptitudes.splice(index, 1);
    this.emitFiltersChanged();
  }

  getCharacterImagePath(imageName: string): string {
    return `assets/images/character_stand/${imageName}`;
  }

  getRankIconPath(rank: number): string {
    // Using rank icons with proper ID formatting (01, 02, etc.)
    const rankId = rank.toString().padStart(2, '0');
    return `assets/images/icon/ranks/utx_txt_rank_${rankId}.png`;
  }

  onRankIconError(event: any, rank: number): void {
    // Fallback to hiding the image if rank icon is missing
    event.target.style.display = 'none';
  }

  clearAllFilters() {
    this.selectedCharacter = null;
    this.filters = {
      selectedCharacterId: null,
      mainStats: [],
      aptitudes: [],
      skills: [],
      whiteSparks: [],
      parentRank: 0,
      winCount: 0,
      whiteCount: 0,
    };
    this.filteredSkillOptions = [];
    this.filteredWhiteSparkOptions = [];
    this.emitFiltersChanged();
  }

  emitFiltersChanged() {
    this.filterChangeSubject.next();
    if (!environment.production) {
      console.log('Filters changed:', this.filters);
    }
  }

  // Helper method to get factor text by ID
  getFactorTextById(factorId: string | undefined, factorOptions: Factor[]): string {
    if (!factorId) return '';
    const factor = factorOptions.find(f => f.id === factorId);
    return factor ? factor.text : factorId;
  }

  // Helper methods for getting display text
  getMainStatText(factorId: string | undefined): string {
    return this.getFactorTextById(factorId, this.blueFactorOptions);
  }

  getAptitudeText(factorId: string | undefined): string {
    return this.getFactorTextById(factorId, this.pinkFactorOptions);
  }

  getSkillText(factorId: string | undefined): string {
    return this.getFactorTextById(factorId, this.greenFactorOptions);
  }

  getWhiteSparkText(factorId: string | undefined): string {
    return this.getFactorTextById(factorId, this.whiteSparkOptions);
  }
}
