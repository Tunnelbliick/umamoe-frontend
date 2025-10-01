import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { TierlistOptimizedService } from '../../services/tierlist-optimized.service';
import { TIER_NAMES, TIER_PERCENTILES, TYPE_NAMES, UpcomingCard } from '../../models/tierlist-calculation.model';
import { PrecomputedCardData } from '../../models/precomputed-tierlist.model';
import { TierlistScatterChartComponent } from '../../components/tierlist-scatter-chart/tierlist-scatter-chart.component';
import { CardHoverMenuComponent as CardHoverMenuSimpleComponent } from '../../components/card-hover-menu/card-hover-menu.component';
import { CardDetailsDialogComponent } from '../../components/card-details-dialog/card-details-dialog.component';
import { trigger, transition, style, animate } from '@angular/animations';

interface TierGroup {
  tier: string;
  cards: PrecomputedCardData[];
  percentileRange: { min: number; max: number };
}

interface TypeTierlist {
  type: number;
  typeName: string;
  tiers: TierGroup[];
  loading: boolean;
  error?: string;
  allCards?: PrecomputedCardData[];
}

@Component({
  selector: 'app-tierlist',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    TierlistScatterChartComponent,
    CardHoverMenuSimpleComponent
  ],
  templateUrl: './tierlist.component.html',
  styleUrls: ['./tierlist.component.scss'],
  animations: [
    trigger('cardFade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ])
  ]
})
export class TierlistComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  typeTierlists: TypeTierlist[] = [];
  selectedTabIndex = 0;
  selectedLB = 4; // Default to LB4
  loading = true;
  upcomingCards: UpcomingCard[] = [];
  selectedCardForProgression: PrecomputedCardData | null = null;
  
  // Available LB levels
  availableLBLevels = [
    { value: 0, label: 'LB0' },
    { value: 1, label: 'LB1' },
    { value: 2, label: 'LB2' },
    { value: 3, label: 'LB3' },
    { value: 4, label: 'LB4' }
  ];
  
  // Hover menu state
  hoveredCard: PrecomputedCardData | null = null;
  hoverMenuVisible: boolean = false;
  hoverMenuPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Mobile detection
  isMobile: boolean = false;

  constructor(
    private tierlistService: TierlistOptimizedService,
    private dialog: MatDialog
  ) {
    this.initializeTypeTierlists();
  }

  ngOnInit(): void {
    this.detectMobile();
    this.calculateAllTierlists();
    
    // Add global test function for mobile mode (development only)
    if (typeof window !== 'undefined') {
      (window as any).toggleMobileTest = () => {
        this.isMobile = !this.isMobile;
        console.log('Mobile mode toggled for testing:', this.isMobile);
      };
      console.log('Use toggleMobileTest() in console to test mobile dialog on desktop');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeTypeTierlists(): void {
    // Initialize for stat types only (0-4), excluding friend (6) and group cards
    for (let type = 0; type < 5; type++) {
      this.typeTierlists.push({
        type,
        typeName: TYPE_NAMES[type],
        tiers: [],
        loading: true
      });
    }
  }

  private calculateAllTierlists(): void {
    // Calculate tierlist for each type in parallel using precomputed data
    const calculations = this.typeTierlists.map(typeData => 
      this.tierlistService.getCardsByType(typeData.type, this.selectedLB)
    );

    forkJoin(calculations)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          results.forEach((cards, index) => {
            this.typeTierlists[index].allCards = cards;
            this.typeTierlists[index].tiers = this.organizeTiers(cards);
            this.typeTierlists[index].loading = false;
          });
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading precomputed tierlists:', error);
          this.typeTierlists.forEach(typeData => {
            typeData.loading = false;
            typeData.error = 'Failed to load tierlist';
          });
          this.loading = false;
        }
      });
  }

  private filterLB4Cards(cards: PrecomputedCardData[]): PrecomputedCardData[] {
    // Cards are already filtered for LB4 in the precomputed service
    return cards;
  }

  private organizeTiers(cards: PrecomputedCardData[]): TierGroup[] {
    const tiers: TierGroup[] = [];
    
    // Initialize all tiers with percentile ranges
    TIER_NAMES.forEach(tierName => {
      tiers.push({
        tier: tierName,
        cards: [],
        percentileRange: TIER_PERCENTILES[tierName as keyof typeof TIER_PERCENTILES]
      });
    });

    // Sort cards by selected LB score descending
    const sortedCards = [...cards].sort((a, b) => b.scores[this.selectedLB] - a.scores[this.selectedLB]);
    const totalCards = sortedCards.length;

    // Assign cards to tiers based on percentile
    sortedCards.forEach((card, index) => {
      const percentile = ((totalCards - index) / totalCards) * 100;
      const tier = this.getTierForPercentile(percentile);
      const tierGroup = tiers.find(t => t.tier === tier);
      if (tierGroup) {
        tierGroup.cards.push(card);
      }
    });

    // Only return tiers that have cards
    return tiers.filter(tier => tier.cards.length > 0);
  }

  onLBChange(newLB: number): void {
    // Mark all types as loading
    this.typeTierlists.forEach(tierlist => tierlist.loading = true);
    
    // Update selected LB
    this.selectedLB = newLB;
    
    // Recalculate tierlists with new LB level
    this.calculateAllTierlists();
  }

  private getTierForPercentile(percentile: number): string {
    for (const [tier, range] of Object.entries(TIER_PERCENTILES)) {
      if (percentile >= range.min && percentile <= range.max) {
        return tier;
      }
    }
    return 'D'; // Default to lowest tier
  }

  getTierColor(tier: string): string {
    const colors: { [key: string]: string } = {
      'S+': '#ff1744',  // Deep red
      'S': '#ff6b35',   // Orange-red
      'A': '#f7931e',   // Orange
      'B': '#ffcd3c',   // Yellow
      'C': '#7cb342',   // Light green
      'D': '#26a69a'    // Teal
    };
    return colors[tier] || '#8e8e8e';
  }

  getCardImageUrl(card: PrecomputedCardData): string {
    // You'll need to implement this based on your asset structure
    return `/assets/images/support_card/half/support_card_s_${card.id}.png`;
  }

  onCardClick(card: PrecomputedCardData): void {
    // Toggle power progression display
    if (this.selectedCardForProgression?.id === card.id) {
      this.selectedCardForProgression = null;
    } else {
      this.selectedCardForProgression = card;
    }
    console.log('Card clicked:', card);
  }

  refreshTierlist(): void {
    this.loading = true;
    this.typeTierlists.forEach(typeData => {
      typeData.loading = true;
      typeData.error = undefined;
    });
    this.calculateAllTierlists();
  }

  getScoreColor(card: PrecomputedCardData): string {
    const score = card.scores[4]; // Use LB4 score
    // Color gradient based on percentile tiers
    if (score >= 800) return '#ff1744';
    if (score >= 650) return '#ff6b35';
    if (score >= 500) return '#f7931e';
    if (score >= 350) return '#ffcd3c';
    if (score >= 200) return '#7cb342';
    return '#26a69a';
  }

  trackByCardId(index: number, card: PrecomputedCardData): string {
    return card.id.toString();
  }

  getTierThreshold(tier: string): string {
    const range = TIER_PERCENTILES[tier as keyof typeof TIER_PERCENTILES];
    if (!range) return 'N/A';
    
    if (range.min === range.max) {
      return `${range.min}%`;
    }
    return `${range.min}-${range.max}%`;
  }

  getCurrentTypeCards(): PrecomputedCardData[] {
    const currentType = this.typeTierlists[this.selectedTabIndex];
    return currentType?.allCards || [];
  }

  getUpcomingCardsForType(): UpcomingCard[] {
    const currentType = this.typeTierlists[this.selectedTabIndex];
    if (!currentType) return [];
    
    return this.upcomingCards.filter(card => card.type === currentType.type);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.hoverMenuPosition = {
      x: event.clientX,
      y: event.clientY
    };
  }

  @HostListener('document:mouseleave', ['$event'])
  onMouseLeave(): void {
    this.hideHoverMenu();
  }

  showHoverMenu(card: PrecomputedCardData, event?: MouseEvent): void {
    this.hoveredCard = card;
    this.hoverMenuVisible = true;
    
    if (event) {
      this.hoverMenuPosition = {
        x: event.clientX,
        y: event.clientY
      };
    }
  }

  hideHoverMenu(): void {
    this.hoveredCard = null;
    this.hoverMenuVisible = false;
  }

  onCardHover(card: PrecomputedCardData, event: MouseEvent): void {
    this.showHoverMenu(card, event);
  }

  onCardLeave(): void {
    this.hideHoverMenu();
  }

  // Mobile detection and handling
  private detectMobile(): void {
    this.isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.detectMobile();
  }

  // Dialog methods
  openCardDialog(card: PrecomputedCardData): void {
    const dialogRef = this.dialog.open(CardDetailsDialogComponent, {
      data: { card },
      width: '380px', // Match hover menu width (320px + padding)
      maxWidth: '90vw',
      maxHeight: '90vh',
      autoFocus: false,
      restoreFocus: false,
      panelClass: 'card-details-dialog'
    });

    // Optional: handle dialog close
    dialogRef.afterClosed().subscribe(result => {
      console.log('Card dialog closed');
    });
  }

  // Card interaction methods for both desktop and mobile
  onCardHoverDesktop(card: PrecomputedCardData, event: MouseEvent): void {
    if (!this.isMobile) {
      this.showHoverMenu(card, event);
    }
  }

  onCardLeaveDesktop(): void {
    if (!this.isMobile) {
      this.hideHoverMenu();
    }
  }

  onCardClickMobile(card: PrecomputedCardData, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.isMobile) {
      this.openCardDialog(card);
    } else {
      // Desktop behavior - could be used for additional actions
      this.onCardClick(card);
    }
  }

  onChartCardClick(event: any): void {
    if (this.isMobile && event.card) {
      this.openCardDialog(event.card);
    }
  }
}
