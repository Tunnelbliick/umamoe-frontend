import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatBottomSheetModule, MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { Subject, takeUntil, BehaviorSubject, forkJoin, of, combineLatest, take } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, startWith, catchError, filter } from 'rxjs/operators';

import { StatisticsService } from '../../services/statistics.service';
import { SKILLS } from '../../data/skills.data';
import { StatisticsChartComponent, ChartDataPoint } from '../../components/statistics-chart/statistics-chart.component';
import { ClassFilterComponent, ClassFilterState, DistanceChangeEvent } from '../../components/class-filter/class-filter.component';
import { TeamClassBottomSheetComponent, BottomSheetData } from '../../components/team-class-bottom-sheet/team-class-bottom-sheet.component';
import { ColorsService } from '../../services/colors.service';
import { CharacterService } from '../../services/character.service';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatCardModule,
    MatTabsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatBottomSheetModule,
    MatExpansionModule,
    MatGridListModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    StatisticsChartComponent,
    ClassFilterComponent
  ],
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.scss'
})
export class StatisticsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('classFilter') classFilter!: ClassFilterComponent;
  private destroy$ = new Subject<void>();

  // Dataset management
  availableDatasets$ = new BehaviorSubject<any[]>([]);
  selectedDataset$ = new BehaviorSubject<any>(null);

  // Loading states
  globalLoading = true;
  distanceLoading = false;
  characterLoading = false;

  // Data
  globalStats: any = null;
  distanceStats: any = {};
  characterStats: any = {};
  rawData: any = null;

  // UI State
  isMobile = false;
  isSmallScreen = false;
  isBottomSheetMode = window.innerWidth < 1200; // Initialize immediately
  selectedDistance = new BehaviorSubject<string | null>(null);
  selectedCharacterDetail: string | null = null;
  // Distance selector visibility is now determined by selectedCharacterDetail or selectedDistance

  // Search
  characterSearchControl = new FormControl('');
  filteredCharacters$ = new BehaviorSubject<{ id: string, name: string }[]>([]);

  // Filters
  classFilters: ClassFilterState = {
    '1': true,
    '2': true,
    '3': true,
    '4': true,
    '5': true,
    '6': true
  };

  // Available distances
  availableDistances = ['sprint', 'mile', 'medium', 'long', 'dirt'];

  // Add debounce timer for character updates to prevent stuttering
  private characterUpdateTimer: any = null;
  private distanceUpdateTimer: any = null;
  private pendingCharacterUpdates = {
    distance: null as string | null,
    characterId: null as string | null
  };

  // Cache for computed chart data
  private chartDataCache = new Map<string, any>();
  private cacheKeys = {
    globalStats: '',
    classFilters: '',
    selectedDistance: '',
    selectedCharacter: ''
  };

  // Performance optimization properties
  private lastActiveClasses: string = '1,2,3,4,5,6'; // Initialize to match the default classFilters state
  private filteredTotalCache: number = 0;

  // Scroll tracking properties
  private lastScrollY = 0;
  private headerOriginalTop = 0;
  private headerStickyActive = false;
  private classFilterOriginalTop = 0;
  private classFilterStickyActive = false;
  private distanceSelectorOriginalTop = 0;
  private distanceSelectorStickyActive = false;
  private characterDistanceSelectorOriginalTop = 0;
  private characterDistanceSelectorStickyActive = false;
  private scrollThrottleTimer: any = null;

  // Standard chart configurations for consistency
  readonly CHART_CONFIGS = {
    // Standard single bar chart
    BAR_STANDARD: { type: 'bar' as const, title: '', height: 320, showLegend: false, colors: [] },
    // Bar chart with legend for multi-series
    BAR_WITH_LEGEND: { type: 'bar' as const, title: '', height: 320, showLegend: true, stacked: false },
    // Stacked bar chart
    BAR_STACKED: { type: 'bar' as const, title: '', height: 360, showLegend: true, stacked: true },
    // Large stacked bar chart
    BAR_STACKED_LARGE: { type: 'bar' as const, title: '', height: 500, showLegend: true, stacked: true },
    // Horizontal bar chart
    BAR_HORIZONTAL: { type: 'horizontalBar' as const, title: '', height: 400, showLegend: false },
    // Doughnut chart with center text showing total by default
    DOUGHNUT_STANDARD: { type: 'doughnut' as const, title: '', height: 350, showLegend: true, centerText: '' },
    // Doughnut with center text (legacy - now same as DOUGHNUT_STANDARD)
    DOUGHNUT_WITH_CENTER: { type: 'doughnut' as const, title: '', height: 320, showLegend: true, centerText: '' },
    // Image list view for cards and characters
    IMAGE_LIST: { type: 'bar' as const, title: '', height: 400, showImages: true, imageSize: 48, showLegend: false },
    // Vertical bar chart with character images at the bottom
    VERTICAL_IMAGE_BAR: { type: 'bar' as const, title: '', height: 500, showLegend: false, showImages: true, imageSize: 64, verticalImages: true },
    // Horizontal bar chart with stat symbols for compositions
    STAT_SYMBOL_BAR: { type: 'horizontalBar' as const, title: '', height: 400, showLegend: false, showStatSymbols: true }
  };

  // Template compatibility
  get distances() {
    return this.availableDistances;
  }

  // Add computed properties for chart data
  teamClassChartData$ = new BehaviorSubject<ChartDataPoint[]>([]);
  totalTrainers$ = new BehaviorSubject<number>(0);
  supportCardCombinationsData$ = new BehaviorSubject<ChartDataPoint[]>([]);
  statDistributionData$ = new BehaviorSubject<{ [key: string]: any[] }>({});
  statAveragesByClassData$ = new BehaviorSubject<any[]>([]);
  supportCardUsageData$ = new BehaviorSubject<any[]>([]);
  supportCardTypeDistribution$ = new BehaviorSubject<ChartDataPoint[]>([]);
  topSupportCardsWithImages$ = new BehaviorSubject<ChartDataPoint[]>([]);
  skillsUsageData$ = new BehaviorSubject<any[]>([]);
  overallStatComparison$ = new BehaviorSubject<ChartDataPoint[]>([]);
  umaDistributionStackedData$ = new BehaviorSubject<any[]>([]);
  sampleSizeText$ = new BehaviorSubject<string>('');

  // New image-based chart data
  topUmasWithImages$ = new BehaviorSubject<ChartDataPoint[]>([]);
  topSkillsWithImages$ = new BehaviorSubject<ChartDataPoint[]>([]);

  // Distance-specific observables
  distanceSkillsData$ = new BehaviorSubject<any[]>([]);
  distanceCardTypeDistribution$ = new BehaviorSubject<ChartDataPoint[]>([]);
  distanceUmaStackedData$ = new BehaviorSubject<any[]>([]);
  distanceStatDistributionData$ = new BehaviorSubject<any[]>([]);
  distanceSupportCardData$ = new BehaviorSubject<any[]>([]);
  distanceSupportCardCombinationsData$ = new BehaviorSubject<ChartDataPoint[]>([]);
  distanceStatHistogramSpeed$ = new BehaviorSubject<ChartDataPoint[]>([]);
  distanceStatHistogramPower$ = new BehaviorSubject<ChartDataPoint[]>([]);
  distanceStatHistogramStamina$ = new BehaviorSubject<ChartDataPoint[]>([]);
  distanceStatHistogramWiz$ = new BehaviorSubject<ChartDataPoint[]>([]);
  distanceStatHistogramGuts$ = new BehaviorSubject<ChartDataPoint[]>([]);

  // Distance-specific image data
  distanceSupportCardsWithImages$ = new BehaviorSubject<ChartDataPoint[]>([]);
  distanceSkillsWithImages$ = new BehaviorSubject<ChartDataPoint[]>([]);
  distanceUmasWithImages$ = new BehaviorSubject<ChartDataPoint[]>([]);

  // Character-specific observables
  characterDistanceData$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterClassData$ = new BehaviorSubject<any[]>([]);
  characterStatHistogramSpeed$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterStatHistogramPower$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterStatHistogramStamina$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterStatHistogramWiz$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterStatHistogramGuts$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterSupportCardCombinationsData$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterOverallCardTypeDistribution$ = new BehaviorSubject<ChartDataPoint[]>([]);

  // Character distance-specific data observables
  characterDistanceClassData$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceStatHistogramSpeed$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceStatHistogramPower$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceStatHistogramStamina$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceStatHistogramWiz$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceStatHistogramGuts$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceSupportCardData$ = new BehaviorSubject<any[]>([]);
  characterDistanceSupportCardCombinationsData$ = new BehaviorSubject<ChartDataPoint[]>([]);

  // Missing observables for character distance analysis
  characterDistanceStatsByClassData$ = new BehaviorSubject<any[]>([]);
  characterDistanceUmasWithImages$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceTopSupportCards$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceSkillsWithImages$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceStatDistributionData$ = new BehaviorSubject<any[]>([]);
  characterDistanceCardTypeDistribution$ = new BehaviorSubject<ChartDataPoint[]>([]);
  characterDistanceDeckCompositions$ = new BehaviorSubject<ChartDataPoint[]>([]);

  // Selected character distance for distance-specific analysis
  selectedCharacterDistance: string | null = null;

  constructor(
    private statisticsService: StatisticsService,
    private meta: Meta,
    private title: Title,
    private colorsService: ColorsService,
    private characterService: CharacterService,
    private cdr: ChangeDetectorRef,
    private bottomSheet: MatBottomSheet
  ) {
    // Initialization moved to ngOnInit
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();

    // Recalculate sticky positions if they're active
    if (this.classFilterStickyActive) {
      this.updateClassFilterPosition();
    }
    if (this.headerStickyActive) {
      this.updateCharacterHeaderPosition();
    }
    if (this.distanceSelectorStickyActive) {
      this.updateDistanceSelectorPosition();
    }
    if (this.characterDistanceSelectorStickyActive) {
      this.updateCharacterDistanceSelectorPosition();
    }
  }

  private updateClassFilterPosition() {
    const classFilter = document.querySelector('app-class-filter') as HTMLElement;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;

    if (classFilter && sidebar && this.classFilterStickyActive) {
      const sidebarRect = sidebar.getBoundingClientRect();
      classFilter.style.left = `${sidebarRect.left}px`;
      classFilter.style.width = `${sidebarRect.width}px`;
    }
  }

  private updateCharacterHeaderPosition() {
    const header = document.querySelector('.character-details-header') as HTMLElement;
    const contentArea = document.querySelector('.content-area') as HTMLElement;

    if (header && contentArea && this.headerStickyActive) {
      const contentAreaRect = contentArea.getBoundingClientRect();
      header.style.left = `${contentAreaRect.left}px`;
      header.style.width = `${contentAreaRect.width}px`;
    }
  }

  @HostListener('window:scroll', ['$event'])
  onScroll() {
    // Throttle scroll events for better performance
    if (this.scrollThrottleTimer) {
      return;
    }

    this.scrollThrottleTimer = setTimeout(() => {
      const currentScrollY = window.scrollY;

      this.handleClassFilterSticky(currentScrollY);
      this.handleCharacterHeaderSticky(currentScrollY);
      this.handleDistanceSelectorSticky(currentScrollY);
      this.handleCharacterDistanceSelectorSticky(currentScrollY);
      // Removed updateDistanceSelectorVisibility to prevent performance issues

      this.lastScrollY = currentScrollY;
      this.scrollThrottleTimer = null;
    }, 16); // ~60fps
  }

  private handleClassFilterSticky(currentScrollY: number) {
    // Don't make class filter sticky on mobile when sidebar is hidden
    if (this.isMobile) return;

    const classFilter = document.querySelector('app-class-filter') as HTMLElement;
    const sidebar = document.querySelector('.sidebar') as HTMLElement;

    if (!classFilter || !sidebar) return;

    // Get class filter's original position if not set
    if (this.classFilterOriginalTop === 0) {
      const rect = classFilter.getBoundingClientRect();
      this.classFilterOriginalTop = rect.top + currentScrollY;
    }

    // Add a small buffer to prevent flickering when scrolling around the threshold
    const buffer = 10; // Small buffer to prevent instant snapping

    // Class filter becomes sticky when past original position + buffer
    // and unsticks when scrolling back above original position - buffer
    let shouldBeSticky: boolean;

    if (this.classFilterStickyActive) {
      // If already sticky, only unstick when we scroll well above the original position
      shouldBeSticky = currentScrollY > (this.classFilterOriginalTop - buffer);
    } else {
      // If not sticky, become sticky when we scroll past the original position plus buffer
      shouldBeSticky = currentScrollY > (this.classFilterOriginalTop + buffer);
    }

    if (shouldBeSticky !== this.classFilterStickyActive) {
      this.classFilterStickyActive = shouldBeSticky;
      if (shouldBeSticky) {
        // Calculate the sidebar's current position to match it exactly
        const sidebarRect = sidebar.getBoundingClientRect();
        classFilter.classList.add('sticky-mode');
        classFilter.style.left = `${sidebarRect.left}px`;
        classFilter.style.width = `${sidebarRect.width}px`;
      } else {
        classFilter.classList.remove('sticky-mode');
        classFilter.style.left = '';
        classFilter.style.width = '';
      }
    }
  }

  private handleCharacterHeaderSticky(currentScrollY: number) {
    const header = document.querySelector('.character-details-header') as HTMLElement;
    const contentArea = document.querySelector('.content-area') as HTMLElement;

    if (!header || !this.selectedCharacterDetail || !contentArea) return;

    // Get header's original position if not set
    if (this.headerOriginalTop === 0) {
      const rect = header.getBoundingClientRect();
      this.headerOriginalTop = rect.top + currentScrollY;
    }

    // Add a buffer to prevent flickering - same hysteresis logic as class filter
    const buffer = 10; // Small buffer to prevent instant snapping

    // Character header becomes sticky when past original position + buffer
    // and unsticks when scrolling back above original position - buffer
    let shouldBeSticky: boolean;

    if (this.headerStickyActive) {
      // If already sticky, only unstick when we scroll well above the original position
      shouldBeSticky = currentScrollY > (this.headerOriginalTop - buffer);
    } else {
      // If not sticky, become sticky when we scroll past the original position plus buffer
      shouldBeSticky = currentScrollY > (this.headerOriginalTop + buffer);
    }

    if (shouldBeSticky !== this.headerStickyActive) {
      this.headerStickyActive = shouldBeSticky;
      if (shouldBeSticky) {
        // Calculate the content area's position to match it exactly
        const contentAreaRect = contentArea.getBoundingClientRect();
        header.classList.add('sticky-active');
        header.style.left = `${contentAreaRect.left}px`;
        header.style.width = `${contentAreaRect.width}px`;
      } else {
        header.classList.remove('sticky-active');
        header.style.left = '';
        header.style.width = '';
      }
    }
  }

  private updateDistanceSelectorPosition() {
    const distanceSelector = document.querySelector('.distance-selector-container') as HTMLElement;
    const contentArea = document.querySelector('.content-area') as HTMLElement;

    if (distanceSelector && contentArea && this.distanceSelectorStickyActive) {
      const contentAreaRect = contentArea.getBoundingClientRect();
      distanceSelector.style.left = `${contentAreaRect.left}px`;
      distanceSelector.style.width = `${contentAreaRect.width}px`;
    }
  }

  private updateCharacterDistanceSelectorPosition() {
    const characterDistanceSelector = document.querySelector('.character-section .distance-selector-container') as HTMLElement;
    const contentArea = document.querySelector('.content-area') as HTMLElement;

    if (characterDistanceSelector && contentArea && this.characterDistanceSelectorStickyActive) {
      const contentAreaRect = contentArea.getBoundingClientRect();
      characterDistanceSelector.style.left = `${contentAreaRect.left}px`;
      characterDistanceSelector.style.width = `${contentAreaRect.width}px`;
    }
  }

  private handleDistanceSelectorSticky(currentScrollY: number) {
    const distanceSelector = document.querySelector('.distance-selector-container') as HTMLElement;
    const characterSection = document.querySelector('.character-section') as HTMLElement;

    if (!distanceSelector) return;

    // Initialize originalTop once when first found
    if (this.distanceSelectorOriginalTop === 0) {
      const rect = distanceSelector.getBoundingClientRect();
      this.distanceSelectorOriginalTop = rect.top + currentScrollY;
    }

    // Stop being sticky when we reach the character section
    let maxStickyPosition = Infinity;
    if (characterSection) {
      const characterRect = characterSection.getBoundingClientRect();
      maxStickyPosition = characterRect.top + currentScrollY;
    }

    const buffer = 10;
    let shouldBeSticky;

    // Use hysteresis to prevent flickering
    if (this.distanceSelectorStickyActive) {
      // Currently sticky, check if we should stop being sticky
      shouldBeSticky = currentScrollY > (this.distanceSelectorOriginalTop - buffer) &&
        currentScrollY < (maxStickyPosition - buffer);
    } else {
      // Not sticky, check if we should become sticky
      shouldBeSticky = currentScrollY > (this.distanceSelectorOriginalTop + buffer) &&
        currentScrollY < (maxStickyPosition + buffer);
    }

    if (shouldBeSticky !== this.distanceSelectorStickyActive) {
      this.distanceSelectorStickyActive = shouldBeSticky;
      if (shouldBeSticky) {
        const contentArea = document.querySelector('.content-area') as HTMLElement;
        const contentAreaRect = contentArea.getBoundingClientRect();
        distanceSelector.classList.add('sticky-mode');
        distanceSelector.style.left = `${contentAreaRect.left}px`;
        distanceSelector.style.width = `${contentAreaRect.width}px`;
      } else {
        distanceSelector.classList.remove('sticky-mode');
        distanceSelector.style.left = '';
        distanceSelector.style.width = '';
      }
    }
  }

  private handleCharacterDistanceSelectorSticky(currentScrollY: number) {
    const characterSection = document.querySelector('.character-section') as HTMLElement;
    const characterDistanceSelector = document.querySelector('.character-section .distance-selector-container') as HTMLElement;

    if (!characterSection || !characterDistanceSelector) return;

    // Initialize originalTop once when first found
    if (this.characterDistanceSelectorOriginalTop === 0) {
      const rect = characterDistanceSelector.getBoundingClientRect();
      this.characterDistanceSelectorOriginalTop = rect.top + currentScrollY;
    }

    // Only be sticky within the character section bounds
    const characterRect = characterSection.getBoundingClientRect();
    const characterBottom = characterRect.bottom + currentScrollY;
    const characterTop = characterRect.top + currentScrollY;

    const buffer = 10;
    let shouldBeSticky;

    // Check if we're within the character section bounds
    const withinBounds = currentScrollY >= characterTop && currentScrollY <= characterBottom - 200; // 200px buffer from bottom

    // Use hysteresis to prevent flickering
    if (this.characterDistanceSelectorStickyActive) {
      // Currently sticky, check if we should stop being sticky
      shouldBeSticky = currentScrollY > (this.characterDistanceSelectorOriginalTop - buffer) && withinBounds;
    } else {
      // Not sticky, check if we should become sticky
      shouldBeSticky = currentScrollY > (this.characterDistanceSelectorOriginalTop + buffer) && withinBounds;
    }

    if (shouldBeSticky !== this.characterDistanceSelectorStickyActive) {
      this.characterDistanceSelectorStickyActive = shouldBeSticky;
      if (shouldBeSticky) {
        const contentArea = document.querySelector('.content-area') as HTMLElement;
        const contentAreaRect = contentArea.getBoundingClientRect();
        characterDistanceSelector.classList.add('sticky-mode');
        characterDistanceSelector.style.left = `${contentAreaRect.left}px`;
        characterDistanceSelector.style.width = `${contentAreaRect.width}px`;
      } else {
        characterDistanceSelector.classList.remove('sticky-mode');
        characterDistanceSelector.style.left = '';
        characterDistanceSelector.style.width = '';
      }
    }
  }

  // Distance selector visibility method removed to prevent performance issues
  // Distance selector is now shown by default in relevant sections

  ngOnInit() {
    // Initialize screen size detection
    this.checkScreenSize();

    this.setupMetaTags();

    // Set default distance selection to "short"
    this.selectedDistance.next('sprint');

    // Subscribe to available datasets
    this.statisticsService.getAvailableDatasets()
      .pipe(takeUntil(this.destroy$))
      .subscribe(datasets => {
        this.availableDatasets$.next(datasets);
      });

    // Subscribe to selected dataset changes
    this.statisticsService.getSelectedDataset()
      .pipe(takeUntil(this.destroy$))
      .subscribe(dataset => {
        this.selectedDataset$.next(dataset);
      });

    // Wait for a dataset to be available before loading statistics
    this.statisticsService.getSelectedDataset()
      .pipe(
        takeUntil(this.destroy$),
        filter(dataset => dataset !== null) // Wait for a dataset to be selected
      )
      .subscribe(() => {
        this.loadGlobalStats();
        this.setupCharacterSearch();
      });

    // Set up reactive updates
    this.setupReactiveUpdates();
  }

  ngAfterViewInit() {
    // Initialize scroll tracking after view is ready
    setTimeout(() => {
      this.initializeScrollTracking();
    }, 100);
  }

  private initializeScrollTracking() {
    // Reset scroll positions for accurate tracking
    this.classFilterOriginalTop = 0;
    this.headerOriginalTop = 0;
    this.lastScrollY = window.scrollY;
  }

  ngOnDestroy() {
    // Clear cache and subscriptions
    this.chartDataCache.clear();
    this.filteredTotalCache = 0;

    // Clear any pending timers
    if (this.characterUpdateTimer) {
      clearTimeout(this.characterUpdateTimer);
      this.characterUpdateTimer = null;
    }
    if (this.distanceUpdateTimer) {
      clearTimeout(this.distanceUpdateTimer);
      this.distanceUpdateTimer = null;
    }
    if (this.scrollThrottleTimer) {
      clearTimeout(this.scrollThrottleTimer);
      this.scrollThrottleTimer = null;
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupReactiveUpdates() {
    // Only set up reactive updates after global stats are loaded
    if (!this.globalStats) {
      return;
    }

    // Update distance-specific data when distance changes
    this.selectedDistance.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged(),
      filter(distance => distance !== null)
    ).subscribe(distance => {
      if (this.distanceStats[distance!]) {
        // Distance data already loaded, update charts immediately
        this.updateDistanceChartData(distance!);
      } else {
        // Distance data not loaded yet, load it first
        this.loadSingleDistanceStats(distance!);
      }
    });
  }

  private setupMetaTags() {
    this.title.setTitle('Statistics - Umamusume Support Card Tierlist');
    this.meta.updateTag({
      name: 'description',
      content: 'View comprehensive statistics and analytics for Umamusume training data, including team class distributions, character usage, and support card trends.'
    });
  }

  private checkScreenSize() {
    const width = window.innerWidth;
    this.isMobile = width < 768;
    this.isSmallScreen = width < 1200; // For compact distance selector
    this.isBottomSheetMode = width < 1200; // Bottom sheet mode for filters when screen is smaller
  }

  // Temp debug method - remove this later
  getWindowWidth(): number {
    return window.innerWidth;
  }

  private loadGlobalStats() {
    this.globalLoading = true;

    this.statisticsService.getGlobalStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (globalData) => {
          this.globalStats = globalData;
          this.rawData = globalData;

          // Update all chart data once
          this.updateAllChartData();

          // Set up reactive updates now that we have data
          this.setupReactiveUpdates();

          // Load distance and character stats
          this.loadDistanceStats();
          this.loadCharacterStats();

          this.globalLoading = false;
        },
        error: (error) => {
          this.globalLoading = false;
        }
      });
  }

  private loadDistanceStats() {
    this.distanceLoading = true;

    // Initially only load the default "sprint" distance for better performance
    const currentDistance = this.selectedDistance.value || 'sprint';
    this.loadSingleDistanceStats(currentDistance);
  }

  private loadSingleDistanceStats(distance: string) {
    if (this.distanceStats[distance]) {
      // Already loaded, no need to fetch again
      this.distanceLoading = false;
      return;
    }

    this.distanceLoading = true;

    this.statisticsService.getDistanceStatistics(distance).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        return of(null);
      })
    ).subscribe(stats => {
      if (stats) {
        this.distanceStats[distance] = stats;

        // Update distance chart data now that it's loaded
        this.updateDistanceChartData(distance);
      }
      this.distanceLoading = false;
    });
  }

  private loadCharacterStats() {
    this.characterLoading = true;

    // Check if statistics data is loaded
    if (!this.statisticsService.isCharacterDataLoaded()) {
      setTimeout(() => this.loadCharacterStats(), 50);
      return;
    }

    // Use character IDs from the current dataset index instead of uma_distribution
    this.statisticsService.getSelectedDataset().pipe(take(1)).subscribe(dataset => {
      if (!dataset?.index?.character_ids) {
        this.characterLoading = false;
        return;
      }

      // Don't preload any character data - just set up the infrastructure

      // Setup character search since we have the character list
      this.setupCharacterSearch();

      this.characterLoading = false;
    });
  }

  private setupCharacterSearch() {
    // Get character IDs from the dataset index
    this.statisticsService.getSelectedDataset().pipe(take(1)).subscribe(dataset => {
      if (!dataset?.index?.character_ids) {
        return;
      }

      // Get character names from the character service using the IDs
      const characters = dataset.index.character_ids.map((characterId: string) => {
        // Get proper character name from character service
        const characterName = this.getCharacterNameById(characterId);

        return {
          id: characterId,
          name: characterName || `Character ${characterId}`, // Fallback if name not found
          displayName: characterName || `Character ${characterId}`,
          characterId: characterId
        };
      });

      // Check for duplicate names and add ID suffixes
      const nameCount = new Map<string, number>();
      const nameToIds = new Map<string, string[]>();

      characters.forEach(char => {
        const count = nameCount.get(char.name) || 0;
        nameCount.set(char.name, count + 1);

        const ids = nameToIds.get(char.name) || [];
        ids.push(char.id);
        nameToIds.set(char.name, ids);
      });

      // Update display names for duplicates
      characters.forEach(char => {
        if (nameCount.get(char.name)! > 1) {
          char.displayName = `${char.name} (${char.characterId})`;
        }
      });

      // Sort by display name
      const sortedCharacters = characters
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      this.filteredCharacters$.next(sortedCharacters.map(char => ({
        id: char.id,
        name: char.displayName
      })));

      // Setup search filtering
      this.characterSearchControl.valueChanges
        .pipe(
          debounceTime(300),
          distinctUntilChanged(),
          startWith(''),
          takeUntil(this.destroy$)
        )
        .subscribe(searchTerm => {
          const filtered = sortedCharacters
            .filter(char =>
              char.displayName.toLowerCase().includes((searchTerm || '').toLowerCase()) ||
              char.characterId.includes((searchTerm || ''))
            )
            .map(char => ({
              id: char.id,
              name: char.displayName
            }));
          this.filteredCharacters$.next(filtered);
        });
    });
  }

  // Helper method to get character name by ID from character service
  private getCharacterNameById(characterId: string): string | null {
    // Get character from the character service synchronously
    // Since characters are loaded immediately in the constructor, we can access them directly
    let characterName: string | null = null;

    this.characterService.getCharacterById(characterId).pipe(take(1)).subscribe(character => {
      characterName = character?.name || null;
    });

    return characterName;
  }

  // Filter methods
  onClassFiltersChanged(filters: ClassFilterState): void {
    const startTime = performance.now();

    // Create a cache key from the filters
    const activeClasses = Object.keys(filters).filter(key => filters[key as keyof ClassFilterState]).sort();
    const cacheKey = activeClasses.join(',');

    // Check if we already processed this combination
    if (cacheKey === this.lastActiveClasses) {
      return;
    }

    this.lastActiveClasses = cacheKey;
    this.classFilters = { ...filters };

    // Clear filtered total cache
    this.filteredTotalCache = 0;

    // Clear cache that depends on class filters
    this.invalidateCache('classFilters');

    // Use requestAnimationFrame for smooth UI updates
    requestAnimationFrame(() => {
      this.updateAllChartData();

      // Also update distance-specific charts if a distance is selected
      const currentDistance = this.selectedDistance.value;
      if (currentDistance && this.distanceStats[currentDistance]) {
        this.updateDistanceChartData(currentDistance);
      }

      // Update character overall distance preference and recalculate default distance if a character is selected
      // This will also trigger updateCharacterDistanceData() through setCharacterDefaultDistance -> selectCharacterDistance
      if (this.selectedCharacterDetail) {
        // Use debounced update for character distance recalculation
        this.debouncedCharacterUpdate(this.selectedCharacterDetail);

        // Also update all character-specific charts with new class filter data
        this.updateAllCharacterCharts();
      }
    });

    const filterTime = performance.now() - startTime;
  }

  // Distance event handler from class-filter component
  onDistanceChanged(event: DistanceChangeEvent): void {
    if (event.distance) {
      this.onDistanceSelect(event.distance);
    }
  }

  // Distance methods
  onDistanceSelect(distance: string) {
    this.selectedDistance.next(distance);

    // If a character is currently selected, also update the character distance
    if (this.selectedCharacterDetail) {
      this.selectedCharacterDistance = distance;
      this.updateCharacterDistanceData();
    }

    // Update distance-specific chart data if available, otherwise load first
    if (this.distanceStats[distance]) {
      this.updateDistanceChartData(distance);
    } else {
      // Load distance data on-demand for better performance
      this.loadSingleDistanceStats(distance);
    }
  }

  // Dataset selection method
  onDatasetChange(datasetId: string): void {
    const datasets = this.availableDatasets$.value;
    const selectedDataset = datasets.find(d => d.id === datasetId);
    
    if (selectedDataset) {
      // Update the service's selected dataset
      this.statisticsService.selectDataset(selectedDataset);
      
      // Clear all cached data
      this.globalStats = null;
      this.distanceStats = {};
      this.characterStats = {};
      this.invalidateCache('all');
      
      // Reset character selection
      this.selectedCharacterDetail = null;
      this.selectedCharacterDistance = null;
      
      // Reload all statistics with the new dataset
      this.loadGlobalStats();
    }
  }

  // Character methods
  onCharacterSelect(characterId: string) {
    this.selectedCharacterDetail = characterId;

    // Find the character from the filtered characters list
    const currentCharacters = this.filteredCharacters$.value;
    const selectedCharacter = currentCharacters.find(char => char.id === characterId);

    if (!selectedCharacter) {
      return;
    }

    // Extract the character name (removing ID suffix if present)
    const displayName = selectedCharacter.name;
    const characterName = displayName.includes(' (')
      ? displayName.substring(0, displayName.lastIndexOf(' ('))
      : displayName;

    // Invalidate character-specific cache
    this.invalidateCache('selectedCharacter');

    // Store pending update
    this.pendingCharacterUpdates.characterId = characterId;

    // Load character statistics using the character ID (not name)
    if (!this.characterStats[characterId]) {
      this.loadSingleCharacterStats(characterId);
    } else {
      // Use debounced update instead of direct call
      this.debouncedCharacterUpdate(characterId);
    }

    // Reset scroll tracking when selecting a new character
    this.resetHeaderScrollTracking();
  }

  private resetHeaderScrollTracking() {
    this.headerOriginalTop = 0;
    this.headerStickyActive = false;
    this.classFilterOriginalTop = 0;
    this.classFilterStickyActive = false;
    this.lastScrollY = window.scrollY;

    // Remove sticky class from header and reset positioning
    const header = document.querySelector('.character-details-header') as HTMLElement;
    if (header) {
      header.classList.remove('sticky-active');
      header.style.left = '';
      header.style.width = '';
    }

    // Reset class filter positioning
    const classFilter = document.querySelector('app-class-filter') as HTMLElement;
    if (classFilter) {
      classFilter.classList.remove('sticky-mode');
      classFilter.style.left = '';
      classFilter.style.width = '';
    }
  }

  // New debounced update method to prevent stuttering
  private debouncedCharacterUpdate(characterId: string): void {
    // Clear any pending timer
    if (this.characterUpdateTimer) {
      clearTimeout(this.characterUpdateTimer);
    }

    // Set a new timer to batch updates
    this.characterUpdateTimer = setTimeout(() => {
      // Update character overall data first (distance preferences and card type distribution)
      this.updateCharacterOverallData();

      // Update all character charts with current class filters
      this.updateAllCharacterCharts();

      // Set character default distance (this will trigger global distance chart updates)
      this.setCharacterDefaultDistance(characterId);

      // Clear pending updates
      this.pendingCharacterUpdates.characterId = null;
      this.pendingCharacterUpdates.distance = null;
      this.characterUpdateTimer = null;
    }, 50); // 50ms debounce
  }

  // Debounced distance update to prevent duplicate calls
  private debouncedDistanceUpdate(distance: string): void {
    // Clear any existing distance update timer
    if (this.distanceUpdateTimer) {
      clearTimeout(this.distanceUpdateTimer);
    }

    // Set a new timer for distance updates
    this.distanceUpdateTimer = setTimeout(() => {
      this.selectCharacterDistance(distance);
      this.distanceUpdateTimer = null;
    }, 30); // Shorter delay for distance updates
  }

  // New method to load single character stats
  private loadSingleCharacterStats(characterId: string) {

    // Use the character ID to load statistics directly
    this.statisticsService.getCharacterStatistics(characterId).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error(`❌ Failed to load character statistics for ID ${characterId}:`, error);
        return of(null);
      })
    ).subscribe((stats: any) => {
      if (stats) {
        this.characterStats[characterId] = stats;

        // Use debounced update instead of direct call
        this.debouncedCharacterUpdate(characterId);
      } else {
        console.error(`❌ No statistics data received for character ID: ${characterId}`);
      }
    });
  }

  // Character helper methods
  selectCharacter(characterId: string) {
    this.onCharacterSelect(characterId);
  }

  backToCharacterSelection() {
    this.selectedCharacterDetail = null;
    this.selectedCharacterDistance = null;
    this.invalidateCache('selectedCharacter');
    // Clear character distance preference data and card type distribution
    this.updateCharacterOverallData();

    // Reset scroll tracking
    this.resetHeaderScrollTracking();
  }

  hasCharacterStats(): boolean {
    return this.selectedCharacterDetail !== null &&
      this.characterStats[this.selectedCharacterDetail] !== undefined;
  }

  shouldShowDistanceSelector(): boolean {
    return this.selectedCharacterDetail !== null;
  }

  getSelectedCharacterName(): string | null {
    if (!this.selectedCharacterDetail) return null;

    const currentCharacters = this.filteredCharacters$.value;
    const selectedCharacter = currentCharacters.find(char => char.id === this.selectedCharacterDetail);
    if (selectedCharacter) {
      // Extract just the name part (without ID suffix)
      const displayName = selectedCharacter.name;
      return displayName.includes(' (')
        ? displayName.substring(0, displayName.lastIndexOf(' ('))
        : displayName;
    }
    return this.selectedCharacterDetail;
  }

  // Character distance selection
  selectCharacterDistance(distance: string): void {
    // Prevent duplicate updates if the distance is already selected
    if (this.selectedCharacterDistance === distance) {
      return;
    }

    // Store the pending distance update
    this.pendingCharacterUpdates.distance = distance;

    // Clear any pending timer to prevent duplicate updates
    if (this.characterUpdateTimer) {
      clearTimeout(this.characterUpdateTimer);
    }

    // Use requestAnimationFrame for smooth update
    requestAnimationFrame(() => {
      this.selectedCharacterDistance = distance;

      // Batch both updates together
      this.updateCharacterDistanceData();
      this.updateCharacterOverallData();

      // Clear pending updates
      this.pendingCharacterUpdates.distance = null;
    });
  }

  // Character default distance setter
  setCharacterDefaultDistance(characterId: string): void {
    if (!this.characterStats[characterId]?.by_distance) return;

    const characterData = this.characterStats[characterId];
    const activeClasses = this.getActiveClassIds();

    let mostPopularDistance = '';
    let maxCount = 0;

    // Calculate aggregated counts for each distance based on active class filters
    Object.entries(characterData.by_distance).forEach(([distance, distanceInfo]: [string, any]) => {
      let totalCount = 0;

      if (distanceInfo.by_team_class) {
        // Sum counts from all active team classes for this distance
        activeClasses.forEach(classId => {
          const classData = distanceInfo.by_team_class[classId];
          if (classData) {
            const count = classData.total || classData.count || classData.total_trained_umas || 0;
            totalCount += count;
          }
        });
      } else {
        // Fallback to direct count if no by_team_class structure
        totalCount = distanceInfo.total || distanceInfo.count || 0;
      }

      if (totalCount > maxCount) {
        maxCount = totalCount;
        mostPopularDistance = distance;
      }
    });

    if (mostPopularDistance) {
      // Try to find a match in availableDistances for consistency
      const availableMatch = this.availableDistances.find(availDist =>
        availDist.toLowerCase() === mostPopularDistance.toLowerCase()
      );

      // Use the available distance format if found, otherwise use the character data format
      const distanceToSelect = availableMatch || mostPopularDistance;

      // Update both the main selectedDistance and the character distance to keep them in sync
      this.selectedDistance.next(distanceToSelect);

      // Use debounced distance update to prevent duplicate calls
      this.debouncedDistanceUpdate(distanceToSelect);
    } else {
      // Update character overall distance preference data even if no popular distance found
      this.updateCharacterOverallData();
    }
  }

  // Calculate character distance preference data
  private updateCharacterOverallData(): void {
    if (!this.selectedCharacterDetail) {
      this.characterDistanceData$.next([]);
      // Also clear card type distribution data
      this.updateCharacterOverallCardTypeDistribution();
      return;
    }

    const characterData = this.characterStats[this.selectedCharacterDetail];
    if (!characterData?.by_distance) {
      this.characterDistanceData$.next([]);
      return;
    }

    // Get active class IDs to merge data from selected team classes
    const activeClasses = this.getActiveClassIds();

    // Calculate distance preference data by merging active team classes
    const distanceData: ChartDataPoint[] = [];

    Object.entries(characterData.by_distance).forEach(([distance, distanceInfo]: [string, any]) => {
      // Sum counts from all active team classes for this distance
      let totalCount = 0;

      if (distanceInfo.by_team_class) {
        activeClasses.forEach(classId => {
          const classData = distanceInfo.by_team_class[classId];
          if (classData) {
            const count = classData.total || classData.count || classData.total_trained_umas || 0;
            totalCount += count;
          }
        });
      } else {
        // Fallback to direct count if no by_team_class structure
        totalCount = distanceInfo.total || distanceInfo.count || 0;
      }

      if (totalCount > 0) {
        // Normalize distance name to match our available distances
        let normalizedDistance = distance.toLowerCase();

        // Handle any aliases (e.g., 'short' -> 'sprint')
        if (normalizedDistance === 'short') {
          normalizedDistance = 'sprint';
        }

        const distanceLabel = this.getDistanceLabel(normalizedDistance);
        const distanceColor = this.getDistanceColor(normalizedDistance);

        distanceData.push({
          label: distanceLabel,
          value: totalCount,
          color: distanceColor
        });
      }
    });

    // Sort by usage count (descending)
    distanceData.sort((a, b) => b.value - a.value);

    this.characterDistanceData$.next(distanceData);

    // Also update character overall support card type distribution
    this.updateCharacterOverallCardTypeDistribution();
  }

  // Calculate character overall support card type distribution
  private updateCharacterOverallCardTypeDistribution(): void {
    if (!this.selectedCharacterDetail) {
      this.characterOverallCardTypeDistribution$.next([]);
      return;
    }

    const characterData = this.characterStats[this.selectedCharacterDetail];
    if (!characterData?.by_distance) {
      this.characterOverallCardTypeDistribution$.next([]);
      return;
    }

    // Get active class IDs to merge data from selected team classes
    const activeClasses = this.getActiveClassIds();

    const cardTypes = new Map<string, number>();

    // Aggregate card type data across all distances and active team classes
    Object.values(characterData.by_distance).forEach((distanceData: any) => {
      if (distanceData.by_team_class) {
        activeClasses.forEach(classId => {
          const classData = distanceData.by_team_class[classId];
          if (classData?.common_support_cards) {
            Object.entries(classData.common_support_cards).forEach(([cardId, data]: [string, any]) => {
              let cardType = 'Other';

              if (data.type) {
                cardType = data.type;
                if (cardType.toLowerCase() === 'intelligence') {
                  cardType = 'Intelligence';
                } else if (cardType.toLowerCase() === 'wit') {
                  cardType = 'Intelligence';
                } else if (cardType.toLowerCase() === 'wiz') {
                  cardType = 'Intelligence';
                } else {
                  cardType = cardType.charAt(0).toUpperCase() + cardType.slice(1).toLowerCase();
                }
              }

              const current = cardTypes.get(cardType) || 0;
              const count = typeof data === 'number' ? data : data.total || data.count || 0;
              cardTypes.set(cardType, current + count);
            });
          }
        });
      }
    });

    const cardTypeData = Array.from(cardTypes.entries())
      .map(([type, count]) => ({
        label: type,
        value: count,
        color: this.getCardTypeColor(type)
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    this.characterOverallCardTypeDistribution$.next(cardTypeData);
  }

  // Update all character charts when class filters change
  private updateAllCharacterCharts(): void {
    if (!this.selectedCharacterDetail) return;

    // Update character overall data (distance preferences)
    this.updateCharacterOverallData();

    // Update character overall card type distribution
    this.updateCharacterOverallCardTypeDistribution();

    // Update character distance data if a distance is selected
    if (this.selectedCharacterDistance) {
      this.updateCharacterDistanceData();
    }

    // Invalidate character-specific cache to force recalculation
    this.invalidateCache('selectedCharacter');

    // Trigger change detection to update template methods
    this.cdr.markForCheck();
  }

  // Character data update methods
  private updateCharacterDistanceData(): void {
    if (!this.selectedCharacterDetail || !this.selectedCharacterDistance) {
      // Clear all distance-specific data
      this.characterDistanceClassData$.next([]);
      this.characterDistanceStatHistogramSpeed$.next([]);
      this.characterDistanceStatHistogramPower$.next([]);
      this.characterDistanceStatHistogramStamina$.next([]);
      this.characterDistanceStatHistogramWiz$.next([]);
      this.characterDistanceStatHistogramGuts$.next([]);
      this.characterDistanceSupportCardData$.next([]);
      this.characterDistanceSupportCardCombinationsData$.next([]);
      // Clear missing observables
      this.characterDistanceStatsByClassData$.next([]);
      this.characterDistanceUmasWithImages$.next([]);
      this.characterDistanceTopSupportCards$.next([]);
      this.characterDistanceSkillsWithImages$.next([]);
      this.characterDistanceStatDistributionData$.next([]);
      this.characterDistanceCardTypeDistribution$.next([]);
      this.characterDistanceDeckCompositions$.next([]);
      return;
    }

    // Use character ID instead of name
    const characterId = this.selectedCharacterDetail;
    if (!this.characterStats[characterId]) {
      // Try to load the character on demand
      this.loadSingleCharacterStats(characterId);
      return;
    }

    const characterData = this.characterStats[characterId];

    // Find the correct distance key (case-insensitive)
    let actualDistanceKey = this.selectedCharacterDistance;
    if (!characterData.by_distance || !characterData.by_distance[this.selectedCharacterDistance]) {
      // Try to find a case-insensitive match
      const availableDistances = characterData.by_distance ? Object.keys(characterData.by_distance) : [];
      const selectedDistanceLower = this.selectedCharacterDistance?.toLowerCase();

      const foundDistance = availableDistances.find(dist =>
        dist.toLowerCase() === selectedDistanceLower
      );

      if (!foundDistance) {
        return;
      } else {
        actualDistanceKey = foundDistance;
      }
    }

    const distanceData = characterData.by_distance[actualDistanceKey];

    // Update stat histograms for this character at this distance
    this.updateCharacterDistanceStatHistograms(distanceData);

    // Update support card data for this character at this distance
    this.updateCharacterDistanceSupportCardData(distanceData);

    // Update team class data for this character at this distance
    if (distanceData.by_team_class) {
      this.updateCharacterDistanceClassData(distanceData.by_team_class);
    }

    // Update the missing observables for character distance analysis
    this.updateCharacterDistanceMissingObservables(distanceData);
  }

  private updateCharacterDistanceStatHistograms(distanceData: any): void {
    // Get active class IDs to merge data from all selected team classes
    const activeClasses = this.getActiveClassIds();
    const stats = ['speed', 'power', 'stamina', 'wiz', 'guts'];

    stats.forEach(stat => {
      // Merge histogram data from all active team classes
      const aggregatedHistogram = new Map<string, number>();
      let totalCount = 0;
      let classesProcessed = 0;

      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class?.[classId];
        const statData = classData?.stat_averages?.[stat];

        if (statData?.histogram) {
          classesProcessed++;
          Object.entries(statData.histogram).forEach(([bucket, count]: [string, any]) => {
            const currentCount = aggregatedHistogram.get(bucket) || 0;
            const newCount = currentCount + (typeof count === 'number' ? count : count.count || 0);
            aggregatedHistogram.set(bucket, newCount);
            totalCount += (typeof count === 'number' ? count : count.count || 0);
          });
        }
      });

      let chartData: ChartDataPoint[] = [];

      if (aggregatedHistogram.size > 0 && totalCount > 0) {
        // Convert aggregated data to simple ChartDataPoint format
        chartData = Array.from(aggregatedHistogram.entries())
          .map(([bucket, count]) => ({
            label: this.formatStatBucketLabel(bucket),
            value: count, // Use raw count instead of percentage
            color: this.colorsService.getStatColor(stat)
          }))
          .sort((a, b) => this.extractBucketValue(a.label) - this.extractBucketValue(b.label));
      }

      // Update the appropriate observable
      switch (stat) {
        case 'speed':
          this.characterDistanceStatHistogramSpeed$.next(chartData);
          break;
        case 'power':
          this.characterDistanceStatHistogramPower$.next(chartData);
          break;
        case 'stamina':
          this.characterDistanceStatHistogramStamina$.next(chartData);
          break;
        case 'wiz':
          this.characterDistanceStatHistogramWiz$.next(chartData);
          break;
        case 'guts':
          this.characterDistanceStatHistogramGuts$.next(chartData);
          break;
      }
    });
  }

  private updateCharacterDistanceSupportCardData(distanceData: any): void {
    // Get active class IDs to merge data from all selected team classes
    const activeClasses = this.getActiveClassIds();

    // Merge support card data from all active team classes with full metadata - BY ID
    const mergedSupportCards = new Map<string, any>();
    let totalEntries = 0;

    activeClasses.forEach(classId => {
      const classData = distanceData.by_team_class?.[classId];
      if (classData?.common_support_cards) {
        totalEntries += classData.total_entries || 0;
        Object.entries(classData.common_support_cards).forEach(([cardId, data]: [string, any]) => {
          const count = typeof data === 'number' ? data : data.total || data.count || 0;

          // Backend now uses card IDs as keys directly
          const cardKey = cardId.toString();
          const existing = mergedSupportCards.get(cardKey);

          if (existing) {
            // Add to existing count, preserve metadata
            mergedSupportCards.set(cardKey, {
              ...existing,
              count: existing.count + count
            });
          } else {
            // Store the full data object including id, type, name, etc.
            mergedSupportCards.set(cardKey, {
              count: count,
              id: data.id || cardId,
              name: data.name || `Card ${cardId}`,
              type: data.type || null,
              avg_level: data.avg_level || 0,
              by_level: data.by_level || {}
            });
          }
        });
      }
    });

    if (mergedSupportCards.size === 0) {
      this.characterDistanceSupportCardData$.next([]);
      return;
    }

    const supportCardData = Array.from(mergedSupportCards.entries())
      .map(([cardKey, data]) => ({
        label: data.name || cardKey,
        value: data.count,
        percentage: totalEntries ? (data.count / totalEntries) * 100 : 0,
        id: data.id,
        type: data.type,
        imageUrl: data.id ? this.getSupportCardImageUrl(data.id) : `/assets/images/cards/${(data.name || cardKey).toLowerCase().replace(/\s+/g, '_')}.webp`,
        color: data.type ? this.colorsService.getStatColor(data.type.toLowerCase()) : '#666666'
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);

    this.characterDistanceSupportCardData$.next(supportCardData);
  }

  private updateCharacterDistanceClassData(classData: any): void {
    const activeClasses = this.getActiveClassIds();

    // Create team class distribution chart data (usage counts per class) - ONLY for active classes
    const chartData = activeClasses
      .map(classId => {
        const data = classData[classId];
        const count = typeof data === 'number' ? data : (data?.total_trained_umas || 0);
        return {
          label: `Class ${classId}`,
          value: count,
          color: this.colorsService.getClassColor(classId)
        };
      })
      .sort((a, b) => parseInt(a.label.split(' ')[1]) - parseInt(b.label.split(' ')[1]))
      .filter(item => item.value > 0); // Only include classes with data

    // Calculate total for center text
    const totalTrainers = chartData.reduce((sum, item) => sum + item.value, 0);

    // Add center text to the chart data format expected by the chart component
    const chartDataWithCenter: any[] = chartData.map(item => ({
      ...item,
      centerText: this.formatTotalTrainers(totalTrainers)
    }));

    this.characterDistanceClassData$.next(chartDataWithCenter);

    // Create stats by class data for the right-side chart - now handled in updateCharacterDistanceMissingObservables
  }

  private updateCharacterDistanceMissingObservables(distanceData: any): void {
    // Get active class IDs to merge data from all selected team classes
    const activeClasses = this.getActiveClassIds();

    // Update stats by class data - format to match global statistics
    if (distanceData.by_team_class) {
      const stats = [
        { key: 'speed', name: 'Speed' },
        { key: 'stamina', name: 'Stamina' },
        { key: 'power', name: 'Power' },
        { key: 'guts', name: 'Guts' },
        { key: 'wiz', name: 'Wit' }
      ];

      // OPTION 1: Each STAT as a series (same as global) - this is what the image shows
      const statsByClassData = stats.map(stat => {
        const data = activeClasses.map(classId => {
          const classData = distanceData.by_team_class[classId];

          // Try multiple possible locations for stat data
          let statValue = 0;

          // Check if stat_averages exists and has our stat
          if (classData?.stat_averages?.[stat.key]) {
            const statData = classData.stat_averages[stat.key];
            statValue = Math.round(statData.average || statData.mean || statData.value || 0);
          }
          // Check if there's a direct stat field
          else if (classData?.[stat.key + '_average'] !== undefined) {
            statValue = Math.round(classData[stat.key + '_average']);
          }
          // Check if there's stat data in a stats object
          else if (classData?.stats?.[stat.key]) {
            const statData = classData.stats[stat.key];
            statValue = Math.round(statData.average || statData.mean || statData.value || statData || 0);
          }
          // Check if there's average stats
          else if (classData?.average_stats?.[stat.key]) {
            statValue = Math.round(classData.average_stats[stat.key]);
          }
          // If no specific stat data, try to compute from histogram if available
          else if (classData?.stat_histograms?.[stat.key] || classData?.histograms?.[stat.key]) {
            const histogram = classData.stat_histograms?.[stat.key] || classData.histograms?.[stat.key];
            if (histogram) {
              let totalValue = 0;
              let totalCount = 0;
              Object.entries(histogram).forEach(([bucket, count]: [string, any]) => {
                const bucketValue = parseInt(bucket.split('-')[0]);
                const bucketCount = typeof count === 'number' ? count : count.count || 0;
                totalValue += bucketValue * bucketCount;
                totalCount += bucketCount;
              });
              statValue = totalCount > 0 ? Math.round(totalValue / totalCount) : 0;
            }
          }
          else {
          }

          return {
            x: `Class ${classId}`,
            y: statValue
          };
        });

        return {
          name: stat.name,
          data,
          backgroundColor: this.colorsService.getStatColor(stat.key) + 'CC',
          borderColor: this.colorsService.getStatColor(stat.key),
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false
        };
      }).filter(statData => statData.data.some((point: any) => point.y > 0));
      this.characterDistanceStatsByClassData$.next(statsByClassData);
    } else {
      this.characterDistanceStatsByClassData$.next([]);
    }

    // Merge uma distribution data from all active team classes
    const mergedUmaDistribution = new Map<string, number>();
    activeClasses.forEach(classId => {
      const classData = distanceData.by_team_class?.[classId];
      if (classData?.uma_distribution) {
        Object.entries(classData.uma_distribution).forEach(([name, data]: [string, any]) => {
          const count = typeof data === 'number' ? data : data.count || data.total || 0;
          const current = mergedUmaDistribution.get(name) || 0;
          mergedUmaDistribution.set(name, current + count);
        });
      }
    });

    if (mergedUmaDistribution.size > 0) {
      const umasWithImages = Array.from(mergedUmaDistribution.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({
          label: name,
          value: count,
          image: `/assets/images/characters/${name.toLowerCase().replace(/\s+/g, '_')}.png`
        }));
      this.characterDistanceUmasWithImages$.next(umasWithImages);
    } else {
      this.characterDistanceUmasWithImages$.next([]);
    }

    // Merge support cards data from all active team classes - BY ID
    const mergedSupportCards = new Map<string, any>();
    activeClasses.forEach(classId => {
      const classData = distanceData.by_team_class?.[classId];
      if (classData?.common_support_cards) {
        Object.entries(classData.common_support_cards).forEach(([cardId, data]: [string, any]) => {
          const count = typeof data === 'number' ? data : data.total || data.count || 0;

          // Backend now uses card IDs as keys directly
          const cardKey = cardId.toString();
          const existing = mergedSupportCards.get(cardKey);

          if (existing) {
            // Add to existing count, preserve metadata
            mergedSupportCards.set(cardKey, {
              ...existing,
              count: existing.count + count
            });
          } else {
            // Store the full data object including id, type, name, etc.
            mergedSupportCards.set(cardKey, {
              count: count,
              id: data.id || cardId,
              name: data.name || `Card ${cardId}`,
              type: data.type || null,
              avg_level: data.avg_level || 0,
              by_level: data.by_level || {}
            });
          }
        });
      }
    });

    if (mergedSupportCards.size > 0) {
      // Calculate total trained Uma Musume for this character/distance combination
      let totalTrainedUmas = 0;
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class?.[classId];
        if (classData) {
          totalTrainedUmas += classData.uma_count || classData.total_entries || classData.count || 0;
        }
      });

      const topSupportCards = Array.from(mergedSupportCards.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50)
        .map(([cardKey, data]) => {
          // Use the ID from the JSON data if available
          const cardId = data.id;
          const cardName = data.name || cardKey;
          const imageUrl = cardId ? this.getSupportCardImageUrl(cardId) : `/assets/images/cards/${cardName.toLowerCase().replace(/\s+/g, '_')}.webp`;
          const percentage = totalTrainedUmas > 0 ? (data.count / totalTrainedUmas) * 100 : 0;

          // Get proper color based on support card type
          const cardType = data.type;
          const color = cardType ? this.colorsService.getStatColor(cardType.toLowerCase()) : '#666666';

          return {
            label: cardName,
            value: data.count,
            percentage: percentage,
            imageUrl: imageUrl,
            id: cardId || cardName,
            type: data.type,
            color: color
          };
        });
      this.characterDistanceTopSupportCards$.next(topSupportCards);
    } else {
      this.characterDistanceTopSupportCards$.next([]);
    }

    // Merge skills data from all active team classes
    const mergedSkills = new Map<string, any>();
    activeClasses.forEach(classId => {
      const classData = distanceData.by_team_class?.[classId];
      if (classData?.common_skills) {
        Object.entries(classData.common_skills).forEach(([skillId, data]: [string, any]) => {
          const count = typeof data === 'number' ? data : data.total || data.count || 0;
          const skillKey = skillId.toString();
          const existing = mergedSkills.get(skillKey);

          if (existing) {
            // Add to existing count, preserve metadata
            mergedSkills.set(skillKey, {
              ...existing,
              count: existing.count + count
            });
          } else {
            // Store the full data object including id, icon, etc.
            mergedSkills.set(skillKey, {
              count: count,
              id: data.id || skillId,
              name: data.name || `Skill ${skillId}`,
              icon: data.icon || null,
              avg_level: data.avg_level || 0,
              by_level: data.by_level || {}
            });
          }
        });
      }
    });

    if (mergedSkills.size > 0) {
      // Calculate total trained Uma Musume for this character/distance combination
      let totalTrainedUmas = 0;
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class?.[classId];
        if (classData) {
          totalTrainedUmas += classData.uma_count || classData.total_entries || classData.count || 0;
        }
      });

      const skillsWithImages = Array.from(mergedSkills.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50)
        .map(([skillKey, data]) => {
          // Use the icon from the JSON data if available, otherwise generate
          const skillName = data.name || `Skill ${skillKey}`;
          const imageUrl = data.icon ? `/assets/images/skills/${data.icon}` : this.getSkillIconUrl(skillName);
          const percentage = totalTrainedUmas > 0 ? (data.count / totalTrainedUmas) * 100 : 0;

          return {
            label: skillName,
            value: data.count,
            percentage: percentage,
            imageUrl: imageUrl,
            id: data.id || skillKey,
            icon: data.icon
          };
        });
      this.characterDistanceSkillsWithImages$.next(skillsWithImages);
    } else {
      this.characterDistanceSkillsWithImages$.next([]);
    }

    const stats = [
      { key: 'speed', name: 'Speed' },
      { key: 'stamina', name: 'Stamina' },
      { key: 'power', name: 'Power' },
      { key: 'guts', name: 'Guts' },
      { key: 'wiz', name: 'Wit' }
    ];

    const statDistributionData = stats.map(stat => {
      let totalValue = 0;
      let classCount = 0;
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class?.[classId];
        if (classData?.stat_averages?.[stat.key]?.mean !== undefined) {
          totalValue += classData.stat_averages[stat.key].mean;
          classCount++;
        }
      });

      return {
        label: stat.name,
        value: Math.round(classCount > 0 ? totalValue / classCount : 0),
        color: this.colorsService.getStatColor(stat.key)
      };
    });
    this.characterDistanceStatDistributionData$.next(statDistributionData);

    // Merge card type distribution from all active team classes
    const mergedCardTypes = new Map<string, number>();
    activeClasses.forEach(classId => {
      const classData = distanceData.by_team_class?.[classId];
      if (classData?.support_card_type_distribution) {
        Object.entries(classData.support_card_type_distribution).forEach(([type, data]: [string, any]) => {
          const count = typeof data === 'number' ? data : data.total_usage || data.count || 0;
          const current = mergedCardTypes.get(type) || 0;
          mergedCardTypes.set(type, current + count);
        });
      }
    });

    if (mergedCardTypes.size > 0) {
      const cardTypeData = Array.from(mergedCardTypes.entries()).map(([type, count]) => ({
        label: type,
        value: count
      }));
      this.characterDistanceCardTypeDistribution$.next(cardTypeData);
    } else {
      this.characterDistanceCardTypeDistribution$.next([]);
    }

    // Merge deck compositions from all active team classes
    const mergedDeckCompositions = new Map<string, { count: number; composition?: { [cardType: string]: number } }>();
    activeClasses.forEach(classId => {
      const classData = distanceData.by_team_class?.[classId];
      if (classData?.support_card_combinations) {
        Object.entries(classData.support_card_combinations).forEach(([compositionKey, data]: [string, any]) => {
          const count = typeof data === 'number' ? data : data.count || 0;
          const existing = mergedDeckCompositions.get(compositionKey) || { count: 0 };
          existing.count += count;

          // Store composition data if available
          if (data.composition) {
            existing.composition = data.composition;
          }

          mergedDeckCompositions.set(compositionKey, existing);
        });
      }
    });

    if (mergedDeckCompositions.size > 0) {
      const deckCompositions = Array.from(mergedDeckCompositions.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50)
        .map(([compositionKey, data], index) => ({
          label: compositionKey, // Keep the original combination string as label
          value: data.count,
          color: this.getStableColor(compositionKey, index),
          composition: data.composition // Add composition data for consistency with global
        }));
      this.characterDistanceDeckCompositions$.next(deckCompositions);
      // Update support card combinations data for consistency
      this.characterDistanceSupportCardCombinationsData$.next(deckCompositions);
    } else {
      this.characterDistanceDeckCompositions$.next([]);
      this.characterDistanceSupportCardCombinationsData$.next([]);
    }
  }

  // Cache management methods
  private generateCacheKey(baseKey: string, ...params: any[]): string {
    const paramsStr = params.map(p => JSON.stringify(p)).join('|');
    return `${baseKey}|${paramsStr}`;
  }

  private getCachedData<T>(cacheKey: string, computeFn: () => T): T {
    if (this.chartDataCache.has(cacheKey)) {
      return this.chartDataCache.get(cacheKey);
    }

    const startTime = performance.now();
    const data = computeFn();
    const computeTime = performance.now() - startTime;

    this.chartDataCache.set(cacheKey, data);
    return data;
  }

  private invalidateCache(type: 'globalStats' | 'classFilters' | 'selectedDistance' | 'selectedCharacter' | 'all') {
    if (type === 'all') {
      this.chartDataCache.clear();
      return;
    }

    // Remove cache entries that depend on the changed data
    const keysToRemove = Array.from(this.chartDataCache.keys()).filter(key => {
      switch (type) {
        case 'globalStats':
          return key.includes('global') || key.includes('team') || key.includes('support') || key.includes('skill');
        case 'classFilters':
          return key.includes('class') || key.includes('stat') || key.includes('distribution');
        case 'selectedDistance':
          return key.includes('distance');
        case 'selectedCharacter':
          return key.includes('character');
        default:
          return false;
      }
    });

    keysToRemove.forEach(key => this.chartDataCache.delete(key));
  }

  openMobileFilters() {
    // Open the Material bottom sheet for mobile filters
    if (this.isBottomSheetMode) {
      // Determine which distance to show in the filter
      // If a character is selected, show the character's distance; otherwise show the main distance
      const currentDistance = this.selectedCharacterDetail && this.selectedCharacterDistance
        ? this.selectedCharacterDistance
        : this.selectedDistance.value;

      const bottomSheetRef = this.bottomSheet.open(TeamClassBottomSheetComponent, {
        data: {
          selectedClasses: this.classFilters,
          classStats: this.globalStats?.team_class_distribution || {},
          selectedDistance: currentDistance,
          distances: this.distances
        },
        panelClass: 'team-class-bottom-sheet-panel'
      });

      bottomSheetRef.afterDismissed().subscribe((result) => {
        if (result) {
          if (result.classFilters) {
            this.onClassFiltersChanged(result.classFilters);
          }
          if (result.distance) {
            this.onDistanceSelect(result.distance);
          }
        }
      });
    }
  }

  // Chart data methods
  private computeTeamClassChartData(): ChartDataPoint[] {
    if (!this.globalStats?.team_class_distribution) {
      return [];
    }

    // Use ALL active classes (merge all)
    const activeClasses = this.getActiveClassIds();

    const result = activeClasses
      .map((classId: string) => {
        const data = this.globalStats!.team_class_distribution[classId];

        // Try multiple possible field names for the count
        let value = 0;
        if (typeof data === 'number') {
          value = data;
        } else if (data && typeof data === 'object') {
          value = data.count || data.total || data.value || data.percentage || data.trainer_count || 0;
        }

        return {
          label: `Class ${classId}`,
          value: value,
          color: this.colorsService.getClassColor(classId)
        };
      })
      .filter(item => item.value > 0); // Filter out zero values

    return result;
  }

  private computeSupportCardCombinationsData(): ChartDataPoint[] {
    if (!this.globalStats?.support_card_combinations?.by_team_class) return [];

    const combinations = new Map<string, { count: number; composition?: { [cardType: string]: number } }>();
    // Use ALL active classes (merge all)
    const activeClasses = this.getActiveClassIds();

    activeClasses.forEach(classId => {
      const classData = this.globalStats!.support_card_combinations.by_team_class[classId];
      if (classData) {
        Object.entries(classData).forEach(([combination, count]: [string, any]) => {
          const current = combinations.get(combination) || { count: 0 };
          current.count += typeof count === 'number' ? count : (count.count || 0);
          if (count.composition) {
            current.composition = count.composition;
          }
          combinations.set(combination, current);
        });
      }
    });

    const result = Array.from(combinations.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([combination, data], index) => ({
        label: combination, // Keep the original combination string as label
        value: data.count,
        color: this.getStableColor(combination),
        composition: data.composition // Add composition data for stat symbols
      }));

    return result;
  }

  private computeStatAveragesByClassData(): any[] {
    if (!this.globalStats?.stat_averages?.by_team_class) return [];

    // Use correct stat order: Speed, Stamina, Power, Guts, Wit
    const stats = [
      { key: 'speed', name: 'Speed' },
      { key: 'stamina', name: 'Stamina' },
      { key: 'power', name: 'Power' },
      { key: 'guts', name: 'Guts' },
      { key: 'wiz', name: 'Wit' }
    ];
    // Use ALL active classes (merge all)
    const activeClasses = this.getActiveClassIds();

    return stats.map(stat => {
      const data = activeClasses.map((classId: string) => {
        const classData = this.globalStats!.stat_averages.by_team_class[classId];
        const statData = classData?.[stat.key];
        return {
          x: `Class ${classId}`,
          y: Math.round(statData?.mean || 0)
        };
      });

      return {
        name: stat.name,
        data,
        backgroundColor: this.colorsService.getStatColor(stat.key) + 'CC',
        borderColor: this.colorsService.getStatColor(stat.key),
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false
      };
    });
  }

  private computeSupportCardUsageData(): any[] {
    if (!this.globalStats?.support_cards?.by_team_class) return [];

    const activeClasses = this.getActiveClassIds();

    // Get all support cards from ACTIVE classes only and find top cards - BY ID
    const allCards = new Map<string, { count: number, name: string, id?: string | number }>();
    activeClasses.forEach(classId => {
      const classData = this.globalStats!.support_cards.by_team_class[classId];
      if (classData) {
        Object.entries(classData).forEach(([cardName, data]: [string, any]) => {
          // Use card ID as key, fallback to name if no ID
          const cardKey = (data.id || cardName).toString();
          const current = allCards.get(cardKey);
          const count = data.total || data.count || 0;

          if (current) {
            current.count += count;
          } else {
            allCards.set(cardKey, {
              count: count,
              name: cardName,
              id: data.id || null
            });
          }
        });
      }
    });

    const topCards = Array.from(allCards.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([cardKey, cardData]) => ({ key: cardKey, name: cardData.name, id: cardData.id }));

    // Create stacked data for each active class
    // Use ALL active classes (merge all)

    return activeClasses.map((classId: string) => {
      const classData = this.globalStats!.support_cards.by_team_class[classId];
      const data = topCards.map(cardInfo => {
        // Find the card data by looking for matching ID or name
        let foundCardData: any = null;
        const cardKey = cardInfo.key;
        let cardName = cardInfo.name || `Card ${cardKey}`;

        // Try to find by ID first, then by name
        if (cardInfo.id) {
          foundCardData = Object.values(classData || {}).find((data: any) => data.id === cardInfo.id);
        }
        if (!foundCardData) {
          foundCardData = classData?.[cardKey];
        }
        
        // Use the name from foundCardData if available, otherwise keep original
        if (foundCardData?.name) {
          cardName = foundCardData.name;
        }

        const truncatedName = cardName.length > 20 ? cardName.substring(0, 17) + '...' : cardName;

        // Use support card ID from the data object
        const cardId = cardInfo.id || foundCardData?.id;
        const imageUrl = cardId ? this.getSupportCardImageUrl(cardId) : undefined;

        return {
          x: truncatedName,
          y: foundCardData?.total || foundCardData?.count || 0,
          imageUrl: imageUrl,
          id: cardId,
          originalName: cardName,
          type: foundCardData?.type
        };
      });

      return {
        name: `Class ${classId}`,
        data,
        backgroundColor: this.getClassColor(classId) + 'CC',
        borderColor: this.getClassColor(classId),
        borderWidth: 0,
        borderRadius: 4,
        borderSkipped: false
      };
    });
  }

  private computeSupportCardTypeDistribution(): ChartDataPoint[] {
    if (!this.globalStats?.support_cards?.by_team_class) return [];

    const cardTypes = new Map<string, number>();
    // Use ALL active classes (merge all)
    const activeClasses = this.getActiveClassIds();

    activeClasses.forEach(classId => {
      const classData = this.globalStats!.support_cards.by_team_class[classId];
      if (classData) {
        Object.entries(classData).forEach(([cardId, data]: [string, any]) => {
          // Use the new "type" field from the data, fallback to name-based detection
          let cardType = 'Other';

          if (data.type) {
            // Use the type from the JSON data
            cardType = data.type;
            // Normalize some type names for consistency
            if (cardType.toLowerCase() === 'intelligence') {
              cardType = 'Intelligence';
            } else if (cardType.toLowerCase() === 'wit') {
              cardType = 'Intelligence';
            } else if (cardType.toLowerCase() === 'wiz') {
              cardType = 'Intelligence';
            } else {
              // Capitalize first letter for consistency
              cardType = cardType.charAt(0).toUpperCase() + cardType.slice(1).toLowerCase();
            }
          } else {
            // Fallback to name-based detection for older data
            const cardName = data.name || `Card ${cardId}`;
            const lowerCardName = cardName.toLowerCase();

            if (lowerCardName.includes('スピード') || lowerCardName.includes('speed')) {
              cardType = 'Speed';
            } else if (lowerCardName.includes('パワー') || lowerCardName.includes('power')) {
              cardType = 'Power';
            } else if (lowerCardName.includes('スタミナ') || lowerCardName.includes('stamina')) {
              cardType = 'Stamina';
            } else if (lowerCardName.includes('賢さ') || lowerCardName.includes('wiz') || lowerCardName.includes('wisdom') || lowerCardName.includes('int')) {
              cardType = 'Intelligence';
            } else if (lowerCardName.includes('根性') || lowerCardName.includes('guts')) {
              cardType = 'Guts';
            } else if (lowerCardName.includes('友人') || lowerCardName.includes('friend')) {
              cardType = 'Friend';
            } else if (lowerCardName.includes('グループ') || lowerCardName.includes('group')) {
              cardType = 'Group';
            }
          }

          const current = cardTypes.get(cardType) || 0;
          const count = data.usage_count || data.total || data.count || 0;
          cardTypes.set(cardType, current + count);
        });
      }
    });

    if (cardTypes.size === 0) {
      return [];
    }

    return Array.from(cardTypes.entries())
      .map(([type, count]) => ({
        label: type,
        value: count,
        color: this.getCardTypeColor(type),
        imageUrl: this.getStatIconUrl(type) // Add stat icons for support card types
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  private computeSkillsUsageData(): any[] {
    if (!this.globalStats?.skills?.by_team_class) return [];

    const activeClasses = this.getActiveClassIds();

    // Get top 15 skills from ACTIVE classes only
    const allSkills = new Map<string, number>();
    activeClasses.forEach(classId => {
      const classData = this.globalStats!.skills.by_team_class[classId];
      if (classData) {
        Object.entries(classData).forEach(([skillName, data]: [string, any]) => {
          const current = allSkills.get(skillName) || 0;
          allSkills.set(skillName, current + (data.total || data.count || 0));
        });
      }
    });

    const topSkills = Array.from(allSkills.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name]) => name);

    // Create stacked data for each active class
    // Use ALL active classes (merge all)

    return activeClasses.map((classId: string) => {
      const classData = this.globalStats!.skills.by_team_class[classId];
      const data = topSkills.map(skillName => {
        const skillData = classData?.[skillName];
        return {
          x: skillData?.name.length > 25 ? skillData?.name.substring(0, 22) + '...' : skillData?.name,
          y: skillData?.total || skillData?.count || 0
        };
      });

      return {
        name: `Class ${classId}`,
        data,
        backgroundColor: this.getClassColor(classId) + 'CC',
        borderColor: this.getClassColor(classId),
        borderWidth: 0,
        borderRadius: 4,
        borderSkipped: false
      };
    });
  }

  private computeOverallStatComparison(): ChartDataPoint[] {
    if (!this.globalStats?.stat_averages?.by_team_class) return [];

    const activeClasses = this.getActiveClassIds();

    // Use correct stat order: Speed, Stamina, Power, Guts, Wit
    const stats = [
      { key: 'speed', name: 'Speed' },
      { key: 'stamina', name: 'Stamina' },
      { key: 'power', name: 'Power' },
      { key: 'guts', name: 'Guts' },
      { key: 'wiz', name: 'Wit' }
    ];

    return stats.map(stat => {
      // Calculate weighted average from active classes
      let totalWeightedValue = 0;
      let totalWeight = 0;

      activeClasses.forEach(classId => {
        const classData = this.globalStats!.stat_averages.by_team_class[classId];
        const statData = classData?.[stat.key];
        if (statData?.mean !== undefined && statData.count > 0) {
          totalWeightedValue += statData.mean * statData.count;
          totalWeight += statData.count;
        }
      });

      const averageValue = totalWeight > 0 ? totalWeightedValue / totalWeight : 0;

      return {
        label: stat.name,
        value: Math.round(averageValue),
        color: this.colorsService.getStatColor(stat.key)
      };
    });
  }

  private computeUmaDistributionStackedData(): any[] {
    if (!this.globalStats?.uma_distribution) return [];

    // Get top 15 uma musume from global distribution
    const topUmas = Object.entries(this.globalStats.uma_distribution)
      .sort((a: any, b: any) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([name]) => name);

    // Create stacked data for each class
    // Use ALL active classes (merge all)
    const classIds = this.getActiveClassIds();
    const series = classIds.map((classId: string) => {
      const data = topUmas.map(umaName => {
        // Use uma distribution from global stats as approximation for class distribution
        const umaData = this.globalStats!.uma_distribution[umaName];
        const id = umaData?.id || this.statisticsService.getCharacterIdFromName(umaName);
        const classPercentage = this.globalStats!.team_class_distribution[classId]?.percentage || 0;
        // Calculate approximate count for this class
        const totalCount = umaData?.count || 0;
        const classCount = Math.round(totalCount * (classPercentage / 100));

        // Get character ID for image URL
        const imageUrl = id ? this.getCharacterImageUrl(id) : undefined;

        return {
          x: umaName,
          y: classCount,
          imageUrl: imageUrl,
          id: id,
          originalName: umaName
        };
      });

      return {
        name: `Class ${classId}`,
        data,
        backgroundColor: this.getClassColor(classId) + 'CC', // Add transparency
        borderColor: this.getClassColor(classId),
        borderWidth: 0, // Remove borders for smoother look
        borderRadius: 4, // Add rounded corners
        borderSkipped: false
      };
    });

    return series;
  }

  private updateAllChartData() {
    if (!this.globalStats) return;

    const activeClasses = this.getActiveClassIds();
    const cacheKey = `global_${activeClasses.join('_')}`;

    // Check cache first
    if (this.chartDataCache.has(cacheKey)) {
      const cached = this.chartDataCache.get(cacheKey);
      this.applyChartData(cached);
      return;
    }

    // Calculate new data
    const chartData = this.calculateChartData();

    // Cache the results
    this.chartDataCache.set(cacheKey, chartData);

    // Apply the data
    this.applyChartData(chartData);
  }

  private calculateChartData(): any {
    // Calculate filtered total for percentage calculations
    const filteredTotal = this.calculateFilteredTotal();

    return {
      teamClass: this.computeTeamClassChartData(),
      totalTrainers: this.calculateTotalTrainers(),
      supportCardCombinations: this.computeSupportCardCombinationsData(),
      statAveragesByClass: this.computeStatAveragesByClassData(),
      supportCardUsage: this.computeSupportCardUsageData(),
      supportCardTypes: this.computeSupportCardTypeDistribution(),
      topSupportCards: this.computeTopSupportCardsWithImages(),
      skillsUsage: this.computeSkillsUsageData(),
      overallStatComparison: this.computeOverallStatComparison(),
      umaDistributionStacked: this.computeUmaDistributionStackedData(),
      sampleSizeText: this.getSampleSizeText(),
      topUmas: this.computeTopUmasWithImages(),
      topSkills: this.computeTopSkillsWithImages(),
      statDistribution: this.calculateStatDistribution(),
      filteredTotal: filteredTotal
    };
  }

  private applyChartData(data: any): void {
    // Update all observables at once
    this.teamClassChartData$.next(data.teamClass);
    this.totalTrainers$.next(data.totalTrainers);
    this.supportCardCombinationsData$.next(data.supportCardCombinations);
    this.statAveragesByClassData$.next(data.statAveragesByClass);
    this.supportCardUsageData$.next(data.supportCardUsage);
    this.supportCardTypeDistribution$.next(data.supportCardTypes);
    this.topSupportCardsWithImages$.next(data.topSupportCards);
    this.skillsUsageData$.next(data.skillsUsage);
    this.overallStatComparison$.next(data.overallStatComparison);
    this.umaDistributionStackedData$.next(data.umaDistributionStacked);
    this.sampleSizeText$.next(data.sampleSizeText);
    this.topUmasWithImages$.next(data.topUmas);
    this.topSkillsWithImages$.next(data.topSkills);
    this.statDistributionData$.next(data.statDistribution);

    // Update the filtered total for charts
    this.filteredTotalCache = data.filteredTotal;
  }

  private calculateStatDistribution(): { [key: string]: any[] } {
    const statDistData: { [key: string]: any[] } = {};
    ['speed', 'stamina', 'power', 'guts', 'wiz'].forEach(stat => {
      statDistData[stat] = this.getStatDistributionMultiSeries(stat);
    });
    return statDistData;
  }

  private calculateFilteredTotal(): number {
    if (this.filteredTotalCache > 0) {
      return this.filteredTotalCache;
    }

    const activeClasses = this.getActiveClassIds();

    // For support cards, we need to count the total NUMBER OF TEAMS/ENTRIES
    // not the sum of all card usages
    // Each team has 6 support cards, so we need to get the total team count
    let totalTeams = 0;

    activeClasses.forEach(classId => {
      const classDistribution = this.globalStats?.team_class_distribution?.[classId];
      if (classDistribution) {
        // Get the count of teams for this class
        let teamCount = 0;
        if (typeof classDistribution === 'number') {
          teamCount = classDistribution;
        } else if (classDistribution && typeof classDistribution === 'object') {
          teamCount = classDistribution.count || classDistribution.total || classDistribution.value || 0;
        }
        totalTeams += teamCount;
      }
    });

    // Each team has 6 support cards, so total support card slots = teams * 6
    const totalSupportCardSlots = totalTeams * 6;
    this.filteredTotalCache = totalSupportCardSlots;
    return totalSupportCardSlots;
  }

  // Multi-series stat distribution showing aggregated data from all selected classes
  getStatDistributionMultiSeries(statName: string): any[] {
    const cacheKey = this.generateCacheKey('statDistribution', statName, this.classFilters);

    return this.getCachedData(cacheKey, () => {
      if (!this.globalStats?.stat_averages?.by_team_class) {
        return [];
      }

      // Get ALL active classes (merge all)
      const activeClasses = this.getActiveClassIds();
      const aggregatedHistogram = new Map<string, number>();
      let totalCount = 0;
      let classesProcessed = 0;

      // Aggregate histogram data from ALL selected classes
      activeClasses.forEach(classId => {
        const classData = this.globalStats!.stat_averages.by_team_class[classId];
        const statData = classData?.[statName];

        if (statData?.histogram) {
          classesProcessed++;
          Object.entries(statData.histogram).forEach(([bucket, count]) => {
            const currentCount = aggregatedHistogram.get(bucket) || 0;
            const newCount = currentCount + (count as number);
            aggregatedHistogram.set(bucket, newCount);
            totalCount += (count as number);
          });
        }
      });
      if (aggregatedHistogram.size === 0) {
        return [];
      }

      // Convert aggregated data to raw counts
      const histogramData = Array.from(aggregatedHistogram.entries())
        .map(([bucket, count]) => ({
          x: this.formatStatBucketLabel(bucket),
          y: count // Use raw count instead of percentage
        }))
        .sort((a, b) => this.extractBucketValue(a.x) - this.extractBucketValue(b.x));

      const statColor = this.colorsService.getStatColor(statName);
      const series = [{
        name: `${this.formatStatName(statName)} Distribution (All Classes)`,
        data: histogramData,
        backgroundColor: statColor + '66',
        borderColor: statColor,
        borderWidth: 2,
        borderRadius: 4,
        fill: false
      }];
      return series;
    });
  }

  private updateDistanceChartData(distance: string) {
    if (!this.distanceStats[distance]) {
      // Load data if not cached
      this.loadSingleDistanceStats(distance);
      return;
    }

    // Update distance-specific chart data
    this.distanceSkillsData$.next(this.computeDistanceSkillsData(distance));
    this.distanceCardTypeDistribution$.next(this.computeDistanceCardTypeDistribution(distance));
    this.distanceUmaStackedData$.next(this.computeDistanceUmaStackedData(distance));
    this.distanceStatDistributionData$.next(this.computeDistanceStatDistributionData(distance));
    this.distanceSupportCardData$.next(this.computeDistanceSupportCardData(distance));
    this.distanceSupportCardCombinationsData$.next(this.getDistanceSupportCardCombinations(distance));

    // Update distance-specific image data
    this.distanceSupportCardsWithImages$.next(this.computeDistanceSupportCardsWithImages(distance));
    this.distanceSkillsWithImages$.next(this.computeDistanceSkillsWithImages(distance));
    this.distanceUmasWithImages$.next(this.computeDistanceUmasWithImages(distance));

    // Update histogram data for each stat
    this.distanceStatHistogramSpeed$.next(this.getDistanceStatHistogramData(distance, 'speed'));
    this.distanceStatHistogramPower$.next(this.getDistanceStatHistogramData(distance, 'power'));
    this.distanceStatHistogramStamina$.next(this.getDistanceStatHistogramData(distance, 'stamina'));
    this.distanceStatHistogramWiz$.next(this.getDistanceStatHistogramData(distance, 'wiz'));
    this.distanceStatHistogramGuts$.next(this.getDistanceStatHistogramData(distance, 'guts'));
  }

  // Convert existing methods to compute methods (rename with "compute" prefix)
  private computeDistanceSkillsData(distance: string): any[] {
    const cacheKey = this.generateCacheKey('distanceSkills', distance, this.classFilters);

    return this.getCachedData(cacheKey, () => {
      const distanceData = this.distanceStats[distance];
      if (!distanceData?.by_team_class) return [];

      const activeClasses = this.getActiveClassIds().filter((id: string) => id !== 'overall');

      // Get top 15 skills for this distance from ACTIVE classes only
      const allSkills = new Map<string, number>();
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class[classId];
        if (classData?.skills) {
          Object.entries(classData.skills).forEach(([skillId, data]: [string, any]) => {
            const skillKey = skillId.toString();
            const current = allSkills.get(skillKey) || 0;
            allSkills.set(skillKey, current + (data.total || data.count || 0));
          });
        }
      });

      const topSkills = Array.from(allSkills.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([skillKey]) => skillKey);

      // Create stacked data for each active class

      const result = activeClasses.map((classId: string) => {
        const classData = distanceData.by_team_class[classId];
        const data = topSkills.map(skillKey => {
          const skillData = classData?.skills?.[skillKey];
          const skillName = skillData?.name || `Skill ${skillKey}`;
          return {
            x: skillName.length > 25 ? skillName.substring(0, 22) + '...' : skillName,
            y: skillData?.total || skillData?.count || 0
          };
        });

        return {
          name: `Class ${classId}`,
          data,
          backgroundColor: this.getClassColor(classId) + 'CC',
          borderColor: this.getClassColor(classId),
          borderWidth: 0,
          borderRadius: 4,
          borderSkipped: false
        };
      });
      return result;
    });
  }

  private computeDistanceCardTypeDistribution(distance: string): ChartDataPoint[] {
    const distanceData = this.distanceStats[distance];
    if (!distanceData?.by_team_class) return [];

    const cardTypes = new Map<string, number>();
    const activeClasses = this.getActiveClassIds().filter((id: string) => id !== 'overall');

    activeClasses.forEach(classId => {
      if ((this.classFilters as any)[classId]) {
        const classData = distanceData.by_team_class[classId];
        if (classData?.support_cards) {
          Object.entries(classData.support_cards).forEach(([cardId, data]: [string, any]) => {
            // Use the new "type" field from the data, fallback to name-based detection
            let cardType = 'Other';

            if (data.type) {
              // Use the type from the JSON data
              cardType = data.type;
              // Normalize some type names for consistency
              if (cardType.toLowerCase() === 'intelligence') {
                cardType = 'Intelligence';
              } else if (cardType.toLowerCase() === 'wit') {
                cardType = 'Intelligence';
              } else if (cardType.toLowerCase() === 'wiz') {
                cardType = 'Intelligence';
              } else {
                // Capitalize first letter for consistency
                cardType = cardType.charAt(0).toUpperCase() + cardType.slice(1).toLowerCase();
              }
            } else {
              // Fallback to name-based detection for older data
              const cardName = data.name || `Card ${cardId}`;
              if (cardName.includes('Speed')) cardType = 'Speed';
              else if (cardName.includes('Power')) cardType = 'Power';
              else if (cardName.includes('Stamina')) cardType = 'Stamina';
              else if (cardName.includes('Wiz') || cardName.includes('Intelligence')) cardType = 'Intelligence';
              else if (cardName.includes('Guts')) cardType = 'Guts';
              else if (cardName.includes('Friend')) cardType = 'Friend';
            }

            const current = cardTypes.get(cardType) || 0;
            cardTypes.set(cardType, current + (data.total || data.count || 0));
          });
        }
      }
    });

    return Array.from(cardTypes.entries())
      .map(([type, count]) => ({
        label: type,
        value: count,
        color: this.getCardTypeColor(type)
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  private computeDistanceUmaStackedData(distance: string): any[] {
    const distanceData = this.distanceStats[distance];
    if (!distanceData?.by_team_class) return [];

    const classIds = this.getActiveClassIds();

    // Get top 10 umas for this distance based on total count from ACTIVE classes only
    const allUmas = new Map<string, number>();
    classIds.forEach(classId => {
      const classData = distanceData.by_team_class[classId];
      if (classData?.uma_distribution) {
        Object.entries(classData.uma_distribution).forEach(([umaName, data]: [string, any]) => {
          const current = allUmas.get(umaName) || 0;
          // Use count instead of percentage
          allUmas.set(umaName, current + (data.count || 0));
        });
      }
    });

    const topUmas = Array.from(allUmas.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    // Create stacked data for each class
    // Use ALL active classes (merge all)
    const series = classIds.map((classId: string) => {
      const classData = distanceData.by_team_class[classId];
      const data = topUmas.map(umaName => {
        const umaData = classData?.uma_distribution?.[umaName];
        return {
          x: umaName,
          y: umaData?.count || 0  // Use actual count
        };
      });

      return {
        name: `Class ${classId}`,
        data,
        backgroundColor: this.getClassColor(classId),
        borderColor: this.getClassColor(classId),
        borderWidth: 1
      };
    });

    return series;
  }

  private computeDistanceStatDistributionData(distance: string): ChartDataPoint[] {
    const distanceData = this.distanceStats[distance];
    if (!distanceData?.by_team_class) return [];

    // Use correct stat order: Speed, Stamina, Power, Guts, Wit
    const stats = [
      { key: 'speed', name: 'Speed' },
      { key: 'stamina', name: 'Stamina' },
      { key: 'power', name: 'Power' },
      { key: 'guts', name: 'Guts' },
      { key: 'wiz', name: 'Wit' }
    ];

    // Get ALL active classes (merge all)
    const activeClasses = this.getActiveClassIds();
    // Calculate average stats across all selected classes for this distance
    return stats.map(stat => {
      let totalMean = 0;
      let classesWithData = 0;

      // Aggregate mean values from ALL selected classes for this distance
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class[classId];
        const statData = classData?.stat_averages?.[stat.key];

        if (statData?.mean !== undefined) {
          totalMean += statData.mean;
          classesWithData++;
        }
      });

      const averageMean = classesWithData > 0 ? totalMean / classesWithData : 0;

      return {
        label: stat.name,
        value: Math.round(averageMean),
        color: this.colorsService.getStatColor(stat.key)
      };
    });
  }

  private computeDistanceSupportCardData(distance: string): any[] {
    const distanceData = this.distanceStats[distance];
    if (!distanceData?.by_team_class) return [];

    const classIds = this.getActiveClassIds();

    // Get top 12 support cards for this distance based on count from ACTIVE classes only
    const allCards = new Map<string, { count: number, name: string, data: any }>();
    classIds.forEach(classId => {
      const classData = distanceData.by_team_class[classId];
      if (classData?.support_cards) {
        Object.entries(classData.support_cards).forEach(([cardId, data]: [string, any]) => {
          const actualCardId = data.id || cardId;
          if (!actualCardId) {
            console.warn(`Support card '${cardId}' missing ID in distance card data, skipping`);
            return;
          }

          const cardName = data.name || `Card ${cardId}`;
          const current = allCards.get(actualCardId) || { count: 0, name: cardName, data: data };
          // Support both count and total properties
          allCards.set(actualCardId, {
            count: current.count + (data.count || data.total || 0),
            name: cardName,
            data: data
          });
        });
      }
    });

    if (allCards.size === 0) return [];

    const topCards = Array.from(allCards.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([cardId, data]) => ({ cardId, name: data.name }));

    // Create stacked data for each active class
    // Use ALL active classes (merge all)
    const series = classIds.map((classId: string) => {
      const classData = distanceData.by_team_class[classId];
      const data = topCards.map(card => {
        const cardData = classData?.support_cards?.[card.name];
        return {
          x: card.name.length > 25 ? card.name.substring(0, 22) + '...' : card.name,
          y: cardData?.count || cardData?.total || 0
        };
      });

      return {
        name: `Class ${classId}`,
        data,
        backgroundColor: this.getClassColor(classId) + 'CC', // Semi-transparent
        borderColor: this.getClassColor(classId),
        borderWidth: 0, // No border for cleaner stacked look
        borderRadius: 4,
        borderSkipped: false
      };
    });

    return series;
  }

  // Distance-specific support cards with images (for image list display)
  private computeDistanceSupportCardsWithImages(distance: string): ChartDataPoint[] {
    const distanceData = this.distanceStats[distance];
    if (!distanceData?.by_team_class) return [];

    // Get all support cards from active classes and aggregate by ID
    const allCards = new Map<string, { total: number, cardData: any, name: string }>();

    // Use the new total_trained_umas from distance data if available
    let totalUmasTrained = 0;
    this.getActiveClassIds().forEach(classId => {
      const classData = distanceData.by_team_class[classId];
      if (classData?.total_trained_umas !== undefined) {
        totalUmasTrained += classData.total_trained_umas;
      } else if (classData?.total_entries !== undefined) {
        totalUmasTrained += classData.total_entries;
      } else if (classData?.trainer_count !== undefined) {
        totalUmasTrained += classData.trainer_count;
      }
    });

    this.getActiveClassIds().forEach(classId => {
      const classData = distanceData.by_team_class[classId];
      if (classData?.support_cards) {
        Object.entries(classData.support_cards).forEach(([cardId, data]: [string, any]) => {
          const count = data.total || data.count || 0;
          const actualCardId = data.id || cardId;

          if (!actualCardId) {
            console.warn(`Support card '${cardId}' missing ID in distance data, skipping`);
            return;
          }

          if (allCards.has(actualCardId)) {
            const existing = allCards.get(actualCardId)!;
            existing.total += count;
            existing.cardData = { ...existing.cardData, ...data }; // Merge card data
            existing.cardData.by_level = existing.cardData.by_level || {};
            if (data.by_level) {
              Object.entries(data.by_level).forEach(([level, levelCount]: [string, any]) => {
                existing.cardData.by_level[level] = (existing.cardData.by_level[level] || 0) + levelCount;
              });
            }
          } else {
            allCards.set(actualCardId, {
              total: count,
              cardData: { ...data, by_level: { ...data.by_level } },
              name: data.name || `Card ${cardId}`
            });
          }
        });
      }
    });

    // Sort and slice to get top 50
    const sortedCards = Array.from(allCards.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 50);

    const result = sortedCards.map(([cardId, data]) => {
      // Card ID is now the key, name is stored in data
      const cardName = data.name || 'Unknown Card';
      const imageUrl = cardId ? this.getSupportCardImageUrl(cardId) : undefined;

      // Get stat color based on support card type (same as global method)
      const cardType = data.cardData?.type;
      const statColor = cardType ? this.colorsService.getStatColor(cardType.toLowerCase()) : undefined;

      // Calculate percentage based on total number of Uma Musume trained
      const percentage = totalUmasTrained > 0 ? (data.total / totalUmasTrained) * 100 : 0;
      return {
        label: cardName,
        value: data.total,
        percentage: percentage,
        imageUrl: imageUrl,
        id: cardId || undefined,
        type: cardType,
        color: statColor
      };
    });
    return result;
  }

  // Character-specific chart data methods
  private computeCharacterStatComparisonData(characterId: string): ChartDataPoint[] {
    const character = this.characterStats[characterId];
    if (!character?.by_distance) return [];

    const distances = Object.keys(character.by_distance);
    if (distances.length === 0) return [];

    // Use correct stat order: Speed, Stamina, Power, Guts, Wit
    const stats = [
      { key: 'speed', name: 'Speed' },
      { key: 'stamina', name: 'Stamina' },
      { key: 'power', name: 'Power' },
      { key: 'guts', name: 'Guts' },
      { key: 'wiz', name: 'Wit' }
    ];

    // Aggregate stats across all distances for this character from ACTIVE classes only
    return stats.map(stat => {
      let totalStat = 0;
      let count = 0;

      const activeClasses = this.getActiveClassIds();
      distances.forEach(distance => {
        const distanceData = character.by_distance![distance];
        activeClasses.forEach(classId => {
          const classData = distanceData.by_team_class?.[classId];
          if (classData?.stat_averages?.[stat.key]?.mean !== undefined) {
            totalStat += classData.stat_averages[stat.key].mean;
            count++;
          }
        });
      });

      return {
        label: stat.name,
        value: Math.round(count > 0 ? totalStat / count : 0),
        color: this.colorsService.getStatColor(stat.key)
      };
    });
  }

  // Individual stat distribution methods for distance with histogram data
  getDistanceStatHistogramData(distance: string, stat: string): ChartDataPoint[] {
    const cacheKey = this.generateCacheKey('distanceStatHistogram', distance, stat, this.classFilters);

    return this.getCachedData(cacheKey, () => {
      const distanceData = this.distanceStats[distance];
      if (!distanceData?.by_team_class) {
        return [];
      }

      // Use ALL active classes (merge all)
      const activeClasses = this.getActiveClassIds();
      const histogramCombined = new Map<string, number>();

      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class[classId];
        const statData = classData?.stat_averages?.[stat];

        if (statData?.histogram) {
          Object.entries(statData.histogram).forEach(([bucket, count]) => {
            const current = histogramCombined.get(bucket) || 0;
            histogramCombined.set(bucket, current + (count as number));
          });
        }
      });

      const result = Array.from(histogramCombined.entries())
        .map(([bucket, count]) => ({
          label: this.formatStatBucketLabel(bucket),
          value: count,
          color: this.getStatColor(stat)
        }))
        .sort((a, b) => this.extractBucketValue(a.label) - this.extractBucketValue(b.label));
      return result;
    });
  }

  // Distance support card combinations with icon formatting
  getDistanceSupportCardCombinations(distance: string): ChartDataPoint[] {
    const cacheKey = this.generateCacheKey('distanceSupportCardCombinations', distance, this.classFilters);

    return this.getCachedData(cacheKey, () => {
      const distanceData = this.distanceStats[distance];
      if (!distanceData?.by_team_class) return [];

      const combinations = new Map<string, { count: number; composition?: { [cardType: string]: number } }>();
      // Use ALL active classes (merge all)
      const activeClasses = this.getActiveClassIds();

      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class[classId];
        if (classData?.support_card_combinations) {
          Object.entries(classData.support_card_combinations).forEach(([combination, data]: [string, any]) => {
            const current = combinations.get(combination) || { count: 0, composition: data.composition };
            combinations.set(combination, {
              count: current.count + (data.count || 0),
              composition: data.composition || current.composition
            });
          });
        }
      });

      const result = Array.from(combinations.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50)
        .map(([combination, data], index) => ({
          label: combination, // Keep original combination string
          value: data.count,
          color: this.getStableColor(combination, index),
          composition: data.composition // Add composition data for stat symbols
        }));
      return result;
    });
  }

  // Character stat histogram methods
  getCharacterStatHistogramData(stat: string): ChartDataPoint[] {
    if (!this.selectedCharacterDetail || !this.characterStats[this.selectedCharacterDetail]) return [];

    const character = this.characterStats[this.selectedCharacterDetail];
    const histogramCombined = new Map<string, number>();
    const activeClasses = this.getActiveClassIds();

    // Aggregate histogram data across all distances for this character from ACTIVE classes only
    if (character.by_distance) {
      Object.values(character.by_distance).forEach((distanceData: any) => {
        if (distanceData.by_team_class) {
          activeClasses.forEach(classId => {
            const classData = distanceData.by_team_class[classId];
            const statData = classData?.stat_averages?.[stat];
            if (statData?.histogram) {
              Object.entries(statData.histogram).forEach(([bucket, count]) => {
                const current = histogramCombined.get(bucket) || 0;
                histogramCombined.set(bucket, current + (count as number));
              });
            }
          });
        }
      });
    }

    return Array.from(histogramCombined.entries())
      .map(([bucket, count]) => ({
        label: bucket,
        value: count,
        color: this.getStatColor(stat)
      }))
      .sort((a, b) => parseInt(a.label) - parseInt(b.label));
  }

  // Character support card combinations
  getCharacterSupportCardCombinations(): ChartDataPoint[] {
    if (!this.selectedCharacterDetail || !this.characterStats[this.selectedCharacterDetail]) return [];

    const character = this.characterStats[this.selectedCharacterDetail];
    const combinations = new Map<string, { count: number; composition?: { [cardType: string]: number } }>();
    const activeClasses = this.getActiveClassIds();

    // Aggregate combinations across all distances for this character from ACTIVE classes only
    if (character.by_distance) {
      Object.values(character.by_distance).forEach((distanceData: any) => {
        if (distanceData.by_team_class) {
          activeClasses.forEach(classId => {
            const classData = distanceData.by_team_class[classId];
            if (classData?.support_card_combinations) {
              Object.entries(classData.support_card_combinations).forEach(([combination, data]: [string, any]) => {
                const current = combinations.get(combination) || { count: 0, composition: data.composition };
                combinations.set(combination, {
                  count: current.count + (data.count || 0),
                  composition: data.composition || current.composition
                });
              });
            }
          });
        }
      });
    }

    return Array.from(combinations.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 50)
      .map(([combination, data], index) => ({
        label: combination, // Keep original combination string
        value: data.count,
        color: this.getStableColor(combination, index),
        composition: data.composition // Add composition data for stat symbols
      }));
  }

  // Utility methods
  getActiveClassIds(): string[] {
    const activeIds = Object.keys(this.classFilters).filter((classId: string) =>
      (this.classFilters as any)[classId] !== false
    );
    return activeIds;
  }

  private getCardTypeColor(cardType: string): string {
    // Use proper stat colors from colors service
    const typeMap: { [key: string]: string } = {
      'Speed': 'speed',
      'Power': 'power',
      'Stamina': 'stamina',
      'Intelligence': 'wiz',
      'Wiz': 'wiz',
      'Wit': 'wiz',
      'Guts': 'guts',
      'Friend': '#e67e22',     // Dark orange for friend cards
      'Group': '#34495e',      // Dark gray for group cards
      'Other': '#7f8c8d'       // Gray for other
    };

    const statName = typeMap[cardType];
    if (statName && ['speed', 'power', 'stamina', 'wiz', 'guts'].includes(statName)) {
      return this.colorsService.getStatColor(statName);
    }

    // For non-stat types, return the color directly
    return typeMap[cardType] || typeMap['Other'];
  }

  private getClassColor(classId: string): string {
    return this.colorsService.getClassColor(classId);
  }

  private getStatColor(stat: string): string {
    return this.colorsService.getStatColor(stat);
  }

  private getDistanceColor(distance: string): string {
    const colors: { [key: string]: string } = {
      'sprint': '#e74c3c', // Red
      'mile': '#f39c12', // Orange
      'medium': '#2ecc71', // Green 
      'long': '#3498db', // Blue
      'dirt': '#9b59b6' // Purple
    };
    return colors[distance] || '#7f8c8d';
  }

  getSupportCardValue(data: any, prop: 'total' | 'count' | 'percentage' | 'avg_level'): number {
    if (!data) return 0;

    if (typeof data === 'number') {
      return prop === 'total' || prop === 'count' ? data : 0;
    }

    return data[prop] || 0;
  }

  // UI Utility methods
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getSampleSizeText(): string {
    if (!this.globalStats?.metadata?.total_entries) return 'Loading...';
    return `${this.globalStats.metadata.total_entries.toLocaleString()} training samples`;
  }

  getCharacterImageUrl(characterNameOrId: string): string {
    // If it's already a numeric ID, use it directly
    if (/^\d+$/.test(characterNameOrId)) {
      return `/assets/images/character_stand/chara_stand_${characterNameOrId}.png`;
    }

    // If it's a name, try to get the character ID from statistics data first
    if (this.globalStats?.uma_distribution) {
      const umaData = Object.values(this.globalStats.uma_distribution).find((data: any) =>
        data.name === characterNameOrId || Object.keys(this.globalStats!.uma_distribution).includes(characterNameOrId)
      );
      if (umaData && (umaData as any).character_id) {
        return `/assets/images/character_stand/chara_stand_${(umaData as any).character_id}.png`;
      }
    }

    // Otherwise, get character ID from the service mapping
    const characterId = this.statisticsService.getCharacterIdFromName(characterNameOrId) || characterNameOrId;
    return `/assets/images/character_stand/chara_stand_${characterId}.png`;
  }

  // Helper method for template to check if character has image
  hasCharacterImage(characterNameOrId: string): boolean {
    if (!characterNameOrId) return false;
    try {
      // If it's numeric, we have an ID
      if (/^\d+$/.test(characterNameOrId)) {
        return true;
      }

      // Try to get from statistics data first
      if (this.globalStats?.uma_distribution) {
        const hasInUmaDistribution = Object.values(this.globalStats.uma_distribution).some((data: any) =>
          data.name === characterNameOrId || Object.keys(this.globalStats!.uma_distribution).includes(characterNameOrId)
        );
        if (hasInUmaDistribution) return true;
      }

      // Fall back to service mapping
      const characterId = this.statisticsService.getCharacterIdFromName(characterNameOrId);
      return characterId !== null && characterId !== undefined && characterId !== '';
    } catch (error) {
      console.warn(`Error checking character image for ${characterNameOrId}:`, error);
      return false;
    }
  }

  // TrackBy function for character list performance
  trackByCharacter(index: number, character: { id: string, name: string }): string {
    return character.id;
  }

  // Handle image loading errors
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  getSupportCardImageUrl(cardId: string | number): string {
    return `/assets/images/support_card/half/support_card_s_${cardId}.png`;
  }

  getStatIconUrl(statName: string): string {
    // Normalize stat name to match file names
    const statMap: { [key: string]: string } = {
      'speed': 'speed',
      'power': 'power',
      'stamina': 'stamina',
      'guts': 'guts',
      'wiz': 'wit',
      'wit': 'wit',
      'wisdom': 'wit',
      'intelligence': 'wit',
      'rank_score': 'speed' // Use speed icon as fallback for rank score
    };

    const fileName = statMap[statName.toLowerCase()] || 'speed';
    return `/assets/images/icon/stats/${fileName}.png`;
  }

  handleImageError(event: any): void {
    event.target.style.display = 'none';
  }

  // Missing methods that need to be added for template compatibility
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

  // Temporary methods - these will be replaced by observables
  getStatAveragesByClassData(): any[] {
    return [];
  }

  getUmaDistributionStackedChartData(): any[] {
    return [];
  }

  getSupportCardTypeDistribution(): ChartDataPoint[] {
    return [];
  }

  getSupportCardUsageData(): any[] {
    return [];
  }

  getSkillsUsageData(): any[] {
    return [];
  }

  getOverallStatComparison(): ChartDataPoint[] {
    return [];
  }

  getDistanceUmaStackedData(distance: string): any[] {
    return [];
  }

  getDistanceSupportCardData(distance: string): any[] {
    return [];
  }

  getDistanceSkillsData(distance: string): any[] {
    return [];
  }

  getDistanceStatDistributionData(distance: string): any[] {
    return [];
  }

  getDistanceCardTypeDistribution(distance: string): ChartDataPoint[] {
    return [];
  }

  // Helper method to format stat names
  private formatStatName(statName: string): string {
    const statNames: { [key: string]: string } = {
      'speed': 'Speed',
      'stamina': 'Stamina',
      'power': 'Power',
      'guts': 'Guts',
      'wiz': 'Wit',
      'wisdom': 'Wit',
      'int': 'Wit'
    };
    return statNames[statName.toLowerCase()] || statName;
  }

  // Calculate total trainers for donut chart center
  private calculateTotalTrainers(): number {
    if (!this.globalStats?.team_class_distribution) return 0;
    // Always calculate from individual class entries for active classes only
    const activeClasses = this.getActiveClassIds();
    const total = activeClasses.reduce((total, classId) => {
      const data = this.globalStats!.team_class_distribution[classId];
      let value = 0;

      if (typeof data === 'number') {
        value = data;
      } else if (data && typeof data === 'object') {
        value = data.count || data.total || data.value || data.percentage || data.trainer_count || 0;
      } else {
      }

      return total + value;
    }, 0);
    return total;
  }

  // Format total trainers for display with dynamic abbreviations (always one decimal place)
  formatTotalTrainers(total: number | null): string {
    if (!total) return '';

    if (total >= 1000000) {
      // For millions, always show one decimal place
      const millions = total / 1000000;
      return millions.toFixed(1) + 'M';
    } else if (total >= 1000) {
      // For thousands, always show one decimal place
      const thousands = total / 1000;
      return thousands.toFixed(1) + 'k';
    }
    return total.toString();
  }

  // Helper methods for chart configurations
  getTeamClassDoughnutConfig() {
    return {
      ...this.CHART_CONFIGS.DOUGHNUT_STANDARD,
      centerText: this.formatTotalTrainers(this.totalTrainers$.value)
    };
  }

  getTeamClassDoughnutConfigWithTotal(total: number | null) {
    return {
      ...this.CHART_CONFIGS.DOUGHNUT_STANDARD,
      centerText: this.formatTotalTrainers(total)
    };
  }

  getStandardBarConfig() {
    return this.CHART_CONFIGS.BAR_STANDARD;
  }

  getBarWithLegendConfig() {
    return this.CHART_CONFIGS.BAR_WITH_LEGEND;
  }

  getStackedBarConfig() {
    return this.CHART_CONFIGS.BAR_STACKED;
  }

  getLargeStackedBarConfig() {
    return this.CHART_CONFIGS.BAR_STACKED_LARGE;
  }

  getHorizontalBarConfig() {
    return this.CHART_CONFIGS.BAR_HORIZONTAL;
  }

  getDoughnutConfig(data?: ChartDataPoint[]) {
    // Calculate total from data if provided
    const total = data ? data.reduce((sum, item) => sum + (item.value || 0), 0) : 0;
    const centerText = total > 0 ? this.formatTotalTrainers(total) : '';

    return {
      ...this.CHART_CONFIGS.DOUGHNUT_STANDARD,
      centerText
    };
  }

  getImageListConfig() {
    return {
      ...this.CHART_CONFIGS.IMAGE_LIST
    };
  }

  getVerticalImageBarConfig() {
    return {
      ...this.CHART_CONFIGS.VERTICAL_IMAGE_BAR
    };
  }

  getStatSymbolBarConfig() {
    return {
      ...this.CHART_CONFIGS.STAT_SYMBOL_BAR
    };
  }

  // Helper method to enhance chart data with stat icons
  addStatIconsToChartData(data: ChartDataPoint[]): ChartDataPoint[] {
    return data.map(item => ({
      ...item,
      imageUrl: this.getStatIconUrl(item.label)
    }));
  }

  // ...existing code...
  private computeTopSupportCardsWithImages(): ChartDataPoint[] {
    if (!this.globalStats?.support_cards?.by_team_class) return [];

    const activeClasses = this.getActiveClassIds();
    const aggregatedCards = new Map<string, any>();

    // Calculate total Uma Musume trained only from selected/active classes
    let totalUmasTrained = 0;

    // Use team_class_distribution to get trained_umas only from active classes
    activeClasses.forEach(classId => {
      const classData = this.globalStats?.team_class_distribution?.[classId];
      if (classData && typeof classData === 'object' && classData.trained_umas) {
        totalUmasTrained += classData.trained_umas;
      }
    });

    // If no trained_umas data available, fallback to uma_distribution approach
    if (totalUmasTrained === 0) {
      if (this.globalStats?.uma_distribution) {
        Object.values(this.globalStats.uma_distribution).forEach((data: any) => {
          const count = data.count || data.total || 0;
          totalUmasTrained += count;
        });
      }
    }
    // Aggregate all card data by ID instead of name
    activeClasses.forEach(classId => {
      const classData = this.globalStats!.support_cards.by_team_class[classId];
      if (classData) {
        Object.entries(classData).forEach(([cardId, cardData]: [string, any]) => {
          const count = cardData.total || cardData.count || 0;
          const actualCardId = cardData.id || cardId; // Use the ID from the data, fallback to key

          if (!actualCardId) {
            console.warn(`Support card '${cardId}' missing ID, skipping`);
            return;
          }

          if (aggregatedCards.has(actualCardId)) {
            const existing = aggregatedCards.get(actualCardId);
            existing.total += count;
            existing.by_level = existing.by_level || {};
            if (cardData.by_level) {
              Object.entries(cardData.by_level).forEach(([level, levelCount]: [string, any]) => {
                existing.by_level[level] = (existing.by_level[level] || 0) + levelCount;
              });
            }
          } else {
            aggregatedCards.set(actualCardId, {
              ...cardData,
              name: cardData.name || `Card ${cardId}`, // Use name from data, fallback to card ID
              total: count,
              by_level: { ...cardData.by_level }
            });
          }
        });
      }
    });

    // Sort and slice to get top 50
    const sortedCards = Array.from(aggregatedCards.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 50);
    const result = sortedCards.map(([cardId, data]) => {
      // Card ID is now the key, name is stored in data
      const name = data.name || 'Unknown Card';
      const imageUrl = cardId ? this.getSupportCardImageUrl(cardId) : undefined;

      // Get stat color based on support card type
      const cardType = data?.type;
      const statColor = cardType ? this.colorsService.getStatColor(cardType.toLowerCase()) : undefined;

      // Calculate percentage: what percentage of trained Uma Musume used this card
      // data.total = number of times this card was used
      // totalUmasTrained = total number of Uma Musume trained
      // percentage = (card usage / total trained) * 100
      const percentage = totalUmasTrained > 0 ? (data.total / totalUmasTrained) * 100 : 0;
      return {
        label: name,
        value: data.total,
        percentage: percentage,
        imageUrl: imageUrl,
        id: cardId || undefined,
        type: cardType,
        color: statColor
      };
    });
    return result;
  }

  // Generate single-series Uma Musume data with images (for image list display)
  private computeTopUmasWithImages(): ChartDataPoint[] {
    if (!this.globalStats?.uma_distribution) return [];

    // Calculate total Uma Musume trained only from selected/active classes
    const activeClasses = this.getActiveClassIds();
    let totalUmasTrained = 0;

    // Use team_class_distribution to get trained_umas only from active classes
    activeClasses.forEach(classId => {
      const classData = this.globalStats?.team_class_distribution?.[classId];
      if (classData && typeof classData === 'object' && classData.trained_umas) {
        totalUmasTrained += classData.trained_umas;
      }
    });

    // If no trained_umas data available, fallback to uma_distribution approach
    if (totalUmasTrained === 0) {
      if (this.globalStats?.uma_distribution) {
        Object.values(this.globalStats.uma_distribution).forEach((data: any) => {
          const count = data.count || data.total || 0;
          totalUmasTrained += count;
        });
      }
    }

    // Aggregate uma distribution data
    const allUmas = new Map<string, any>();

    // Check if per-class uma distribution data is available
    if (this.globalStats?.uma_distribution?.by_team_class) {
      // Aggregate from per-class data (only from active classes)
      activeClasses.forEach(classId => {
        const classUmaData = this.globalStats!.uma_distribution.by_team_class[classId];
        if (classUmaData) {
          Object.entries(classUmaData).forEach(([umaName, data]: [string, any]) => {
            const count = data.count || data.total || 0;
            const existing = allUmas.get(umaName) || { count: 0, character_id: data.character_id, character_color: data.character_color };
            allUmas.set(umaName, {
              count: existing.count + count,
              character_id: data.character_id || existing.character_id,
              character_color: data.character_color || existing.character_color
            });
          });
        }
      });
    } else {
      // Fallback to global uma distribution (legacy behavior)
      Object.entries(this.globalStats.uma_distribution).forEach(([umaName, data]: [string, any]) => {
        const count = data.count || data.total || data;
        allUmas.set(umaName, {
          count,
          character_id: data.character_id,
          character_color: data.character_color
        });
      });
    }

    // Convert to ChartDataPoint with images and sort to get top 20
    const result = Array.from(allUmas.entries())
      .map(([umaName, data]) => {
        // Use the existing method which handles name to ID mapping
        const imageUrl = this.getCharacterImageUrl(data.character_id || umaName);

        // Calculate percentage: what percentage of trained Uma Musume were this character
        const percentage = totalUmasTrained > 0 ? (data.count / totalUmasTrained) * 100 : 0;

        return {
          label: this.getCharacterNameById(data.character_id || umaName) || umaName,
          value: data.count,
          percentage: percentage,
          imageUrl: imageUrl,
          id: data.character_id || umaName,
          character_color: data.character_color
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    return result;
  }

  // Generate single-series Skills data with images (for image list display)
  private computeTopSkillsWithImages(): ChartDataPoint[] {
    if (!this.globalStats?.skills?.by_team_class) return [];

    const activeClasses = this.getActiveClassIds();
    const aggregatedSkills = new Map<string, any>();

    // Calculate total Uma Musume trained only from selected/active classes
    let totalUmasTrained = 0;

    // Use team_class_distribution to get trained_umas only from active classes
    activeClasses.forEach(classId => {
      const classData = this.globalStats?.team_class_distribution?.[classId];
      if (classData && typeof classData === 'object' && classData.trained_umas) {
        totalUmasTrained += classData.trained_umas;
      }
    });

    // If no trained_umas data available, fallback to uma_distribution approach
    if (totalUmasTrained === 0) {
      if (this.globalStats?.uma_distribution) {
        Object.values(this.globalStats.uma_distribution).forEach((data: any) => {
          const count = data.count || data.total || 0;
          totalUmasTrained += count;
        });
      }
    }
    // Aggregate skill data
    activeClasses.forEach(classId => {
      const classData = this.globalStats!.skills.by_team_class[classId];
      if (classData) {
        Object.entries(classData).forEach(([skillId, skillData]: [string, any]) => {
          const count = typeof skillData === 'number' ? skillData : (skillData.total || skillData.count || 0);

          if (aggregatedSkills.has(skillId)) {
            const existing = aggregatedSkills.get(skillId);
            existing.total += count;
            existing.avg_level = ((existing.avg_level * existing.count + (skillData.avg_level || 0) * count) / (existing.count + count));
            existing.count += count;
          } else {
            aggregatedSkills.set(skillId, {
              ...skillData,
              name: skillData.name || `Skill ${skillId}`, // Store proper name with fallback
              total: count,
              count: count
            });
          }
        });
      }
    });

    // Sort and slice to get top 50
    const sortedSkills = Array.from(aggregatedSkills.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 50);
    return sortedSkills.map(([skillKey, data]) => {
      // Use the name from data, fallback to skill key
      const skillName = data.name || `Skill ${skillKey}`;
      const skillIcon = data?.icon ? `/assets/images/skills/${data.icon}` : this.getSkillIconUrl(skillName);

      // Calculate percentage: what percentage of trained Uma Musume used this skill
      const percentage = totalUmasTrained > 0 ? (data.total / totalUmasTrained) * 100 : 0;

      return {
        label: skillName,
        value: data.total,
        percentage: percentage,
        imageUrl: skillIcon,
        id: data?.id || skillKey,
        icon: data?.icon // Store the original icon filename for reference
      };
    });
  }

  // Helper method to get skill icon URL
  private getSkillIconUrl(skillName: string): string {
    // Try to find the skill by name in the SKILLS data
    let exactMatch = SKILLS.find(skill => skill.name === skillName);
    if (exactMatch?.icon) {
      return `/assets/images/skills/${exactMatch.icon}`;
    }

    // Handle inherited skills by stripping "(Inherited)" suffix and looking for base skill
    if (skillName.includes('(Inherited)')) {
      const baseSkillName = skillName.replace(/\s*\(Inherited\)$/, '').trim();
      const baseSkillMatch = SKILLS.find(skill => skill.name === baseSkillName);
      if (baseSkillMatch?.icon) {
        return `/assets/images/skills/${baseSkillMatch.icon}`;
      }
    }

    // Fallback approach: use normalized name-based pattern
    const normalizedName = skillName.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    return `/assets/images/skills/${normalizedName}.png`;
  }

  private getSkillIconFromName(skillName: string): string {
    return this.getSkillIconUrl(skillName);
  }

  // Utility methods for missing functionality
  private getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private getStableColor(input: string, index?: number): string {
    const color = this.colorsService.getHashBasedColor(input);

    return color || this.getRandomColor();
  }

  private formatStatBucketLabel(bucket: string): string {
    // Format stat bucket labels (e.g., "500-600" -> "500-600")
    return bucket;
  }

  private extractBucketValue(label: string): number {
    // Extract numeric value from bucket label for sorting
    const match = label.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // Template methods for character charts
  getCharacterClassStackedData(): any[] {
    if (!this.selectedCharacterDetail || !this.characterStats[this.selectedCharacterDetail]) {
      return [];
    }

    const character = this.characterStats[this.selectedCharacterDetail];
    if (!character.by_distance) return [];

    const activeClasses = this.getActiveClassIds();

    // Aggregate class data across all distances for this character - ONLY for active classes
    const classData = new Map<string, number>();

    Object.values(character.by_distance).forEach((distanceData: any) => {
      if (distanceData.by_team_class) {
        activeClasses.forEach(classId => {
          const data = distanceData.by_team_class[classId];
          if (data) {
            const current = classData.get(classId) || 0;
            const count = data.total_entries || data.count || data.total || 0;
            classData.set(classId, current + count);
          }
        });
      }
    });

    if (classData.size === 0) return [];

    // Create separate series for each class with proper colors
    return Array.from(classData.entries())
      .map(([classId, count]) => ({
        name: `Class ${classId}`,
        data: [{
          x: this.getSelectedCharacterName() || 'Character',
          y: count
        }],
        backgroundColor: this.colorsService.getClassColor(classId) + 'CC',
        borderColor: this.colorsService.getClassColor(classId),
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false
      }))
      .sort((a, b) => parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]));
  }

  getCharacterStatComparisonData(): any[] {
    if (!this.selectedCharacterDetail) return [];

    const ret = this.computeCharacterStatComparisonData(this.selectedCharacterDetail);

    return ret;
  }

  // Character-specific methods for template
  getCharacterCardTypeDistribution(): ChartDataPoint[] {
    if (!this.selectedCharacterDetail || !this.characterStats[this.selectedCharacterDetail]) return [];

    const character = this.characterStats[this.selectedCharacterDetail];
    const cardTypes = new Map<string, number>();
    const activeClasses = this.getActiveClassIds();

    // Aggregate card type data across all distances for this character from ACTIVE classes only
    if (character.by_distance) {
      Object.values(character.by_distance).forEach((distanceData: any) => {
        if (distanceData.by_team_class) {
          activeClasses.forEach(classId => {
            const classData = distanceData.by_team_class[classId];
            if (classData?.support_cards) {
              Object.entries(classData.support_cards).forEach(([cardId, data]: [string, any]) => {
                let cardType = 'Other';

                if (data.type) {
                  cardType = data.type;
                  if (cardType.toLowerCase() === 'intelligence') {
                    cardType = 'Intelligence';
                  } else if (cardType.toLowerCase() === 'wit') {
                    cardType = 'Intelligence';
                  } else if (cardType.toLowerCase() === 'wiz') {
                    cardType = 'Intelligence';
                  } else {
                    cardType = cardType.charAt(0).toUpperCase() + cardType.slice(1).toLowerCase();
                  }
                }

                const current = cardTypes.get(cardType) || 0;
                cardTypes.set(cardType, current + (data.total || data.count || 0));
              });
            }
          });
        }
      });
    }

    return Array.from(cardTypes.entries())
      .map(([type, count]) => ({
        label: type,
        value: count,
        color: this.getCardTypeColor(type)
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  // Distance-specific image list methods
  private computeDistanceUmasWithImages(distance: string): ChartDataPoint[] {
    const cacheKey = this.generateCacheKey('distanceUmasWithImages', distance, this.classFilters);

    return this.getCachedData(cacheKey, () => {
      const distanceData = this.distanceStats[distance];
      if (!distanceData?.by_team_class) return [];

      // Calculate total Uma Musume trained only from selected/active classes for this distance
      const activeClasses = this.getActiveClassIds();
      let totalUmasTrained = 0;

      // Use the correct field names from distance data structure (same as support cards method)
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class[classId];
        if (classData?.total_trained_umas !== undefined) {
          totalUmasTrained += classData.total_trained_umas;
        } else if (classData?.total_entries !== undefined) {
          totalUmasTrained += classData.total_entries;
        } else if (classData?.trainer_count !== undefined) {
          totalUmasTrained += classData.trainer_count;
        }
      });

      // Aggregate Uma data from distance classes
      const allUmas = new Map<string, any>();

      // Aggregate Uma data from active classes in by_team_class structure
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class?.[classId];
        if (classData?.uma_distribution) {
          Object.entries(classData.uma_distribution).forEach(([umaName, data]: [string, any]) => {
            const count = data.count || data.total || data;
            const existing = allUmas.get(umaName) || { count: 0, character_id: data.character_id, character_color: data.character_color };
            allUmas.set(umaName, {
              count: existing.count + count,
              character_id: data.character_id || existing.character_id,
              character_color: data.character_color || existing.character_color
            });
          });
        }
      });

      // Convert to ChartDataPoint with images and sort to get top 20
      const result = Array.from(allUmas.entries())
        .map(([umaName, data]) => {
          // Use the existing method which handles name to ID mapping
          const imageUrl = this.getCharacterImageUrl(data.character_id || umaName);

          // Calculate percentage: what percentage of trained Uma Musume were this character
          const percentage = totalUmasTrained > 0 ? (data.count / totalUmasTrained) * 100 : 0;

          return {
            label: umaName,
            value: data.count,
            percentage: percentage,
            imageUrl: imageUrl,
            id: data.character_id || umaName,
            character_color: data.character_color
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 20);

      return result;
    }); // Close the getCachedData callback
  }

  private computeDistanceSkillsWithImages(distance: string): ChartDataPoint[] {
    const cacheKey = this.generateCacheKey('distanceSkillsWithImages', distance, this.classFilters);

    return this.getCachedData(cacheKey, () => {
      const distanceData = this.distanceStats[distance];
      if (!distanceData?.by_team_class) return [];

      const activeClasses = this.getActiveClassIds();
      const aggregatedSkills = new Map<string, any>();

      // Calculate total Uma Musume trained only from selected/active classes for this distance
      let totalUmasTrained = 0;

      // Use the correct field names from distance data structure (same as support cards method)
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class[classId];
        if (classData?.total_trained_umas !== undefined) {
          totalUmasTrained += classData.total_trained_umas;
        } else if (classData?.total_entries !== undefined) {
          totalUmasTrained += classData.total_entries;
        } else if (classData?.trainer_count !== undefined) {
          totalUmasTrained += classData.trainer_count;
        }
      });
      // Aggregate skill data from active classes only
      activeClasses.forEach(classId => {
        const classData = distanceData.by_team_class?.[classId];
        if (classData?.skills) {
          Object.entries(classData.skills).forEach(([skillId, skillData]: [string, any]) => {
            const count = typeof skillData === 'number' ? skillData : (skillData.total || skillData.count || 0);

            if (aggregatedSkills.has(skillId)) {
              const existing = aggregatedSkills.get(skillId);
              existing.total += count;
              existing.avg_level = ((existing.avg_level * existing.count + (skillData.avg_level || 0) * count) / (existing.count + count));
              existing.count += count;
            } else {
              aggregatedSkills.set(skillId, {
                ...skillData,
                total: count,
                count: count
              });
            }
          });
        }
      });

      // Sort and slice to get top 50
      const sortedSkills = Array.from(aggregatedSkills.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 50);
      return sortedSkills.map(([skillKey, data]) => {
        // Use the icon and id from the actual skill data
        const skillName = data?.name || `Skill ${skillKey}`;
        const skillIcon = data?.icon ? `/assets/images/skills/${data.icon}` : this.getSkillIconUrl(skillName);

        // Calculate percentage: what percentage of trained Uma Musume used this skill
        const percentage = totalUmasTrained > 0 ? (data.total / totalUmasTrained) * 100 : 0;

        return {
          label: skillName,
          value: data.total,
          percentage: percentage,
          imageUrl: skillIcon,
          id: data?.id || skillKey,
          icon: data?.icon // Store the original icon filename for reference
        };
      });
    }); // Close the getCachedData callback
  }

  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}