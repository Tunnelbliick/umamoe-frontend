import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, tap } from 'rxjs';
import { CircleService } from '../../services/circle.service';
import { Circle, CircleSearchFilters } from '../../models/circle.model';
import { DiscordLinkPipe } from '../../pipes/discord-link.pipe';
import { AnimatedNumberComponent } from '../../components/animated-number/animated-number.component';
@Component({
  selector: 'app-circles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatPaginatorModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatChipsModule,
    MatSlideToggleModule,
    FormsModule,
    DiscordLinkPipe,
    AnimatedNumberComponent
  ],
  templateUrl: './circles.component.html',
  styleUrl: './circles.component.scss'
})
export class CirclesComponent implements OnInit, OnDestroy {
  protected Math = Math;
  circles: Circle[] = [];
  filteredCircles: Circle[] = [];
  totalCircles = 0;
  loading = false;
  private isFirstLoad = true;
  filters: CircleSearchFilters = {
    page: 0,
    pageSize: 100,
    sortBy: 'rank',
    sortOrder: 'asc'
  };
  // Sort options
  sortOptions = [
    { value: 'rank', label: 'Rank' },
    { value: 'fans', label: 'Total Fans' },
    { value: 'daily', label: 'Daily Gain' },
    { value: 'name', label: 'Name' },
    { value: 'members', label: 'Members' }
  ];
  // Policy labels (index 1-17)
  policyLabels: Record<number, string> = {
    1: 'You Do You',
    2: 'Laid-back',
    3: 'Going for Gold',
    4: 'Beginners Welcome',
    5: "Let's Party!",
    6: 'Rank 2000+',
    7: 'Rank 1000+',
    8: 'Rank 500+',
    9: 'Rank 250+',
    10: 'Rank 100+',
    11: 'Rank 20+',
    12: 'Log in Daily',
    13: 'Log in Every 3 Days',
    14: 'Active in the Morning',
    15: 'Active in the Afternoon',
    16: 'Active in the Evening',
    17: 'Active at Night'
  };
  // Client-side filters
  joinStyleFilter: 'all' | 'open' | 'approval' | 'closed' = 'all';
  hasOpenSpots = false;
  policyFilter: number | null = null;
  // Policy options for filter dropdown
  policyOptions = [
    { value: null, label: 'All Playstyles' },
    { value: 1, label: 'You Do You' },
    { value: 2, label: 'Laid-back' },
    { value: 3, label: 'Going for Gold' },
    { value: 4, label: 'Beginners Welcome' },
    { value: 5, label: "Let's Party!" },
    { value: 6, label: 'Rank 2000+' },
    { value: 7, label: 'Rank 1000+' },
    { value: 8, label: 'Rank 500+' },
    { value: 9, label: 'Rank 250+' },
    { value: 10, label: 'Rank 100+' },
    { value: 11, label: 'Rank 20+' },
    { value: 12, label: 'Log in Daily' },
    { value: 13, label: 'Log in Every 3 Days' },
    { value: 14, label: 'Active in the Morning' },
    { value: 15, label: 'Active in the Afternoon' },
    { value: 16, label: 'Active in the Evening' },
    { value: 17, label: 'Active at Night' }
  ];
  searchTerm = '';
  private destroy$ = new Subject<void>();
  private searchTimer: any;
  private liveRefreshTimer: any;
  private liveRefreshInterval: any;
  private countdownTicker: any;
  secondsUntilRefresh = 0;
  liveRefreshing = false;
  readonly LIVE_REFRESH_SECONDS = 5 * 60;
  constructor(
    private cdr: ChangeDetectorRef,
    private circleService: CircleService,
    private route: ActivatedRoute,
    private router: Router,
    private ngZone: NgZone
  ) { }
  ngOnInit(): void {
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      // Parse page
      const pageParam = params['page'];
      this.filters.page = pageParam ? +pageParam : 0;
      // Parse pageSize
      const pageSizeParam = params['pageSize'];
      this.filters.pageSize = pageSizeParam ? +pageSizeParam : 100;
      // Handle query/name
      // Priority: query > name > nothing
      if (params['query']) {
        this.filters.query = params['query'];
        this.filters.name = undefined;
      } else if (params['name']) {
        this.filters.name = params['name'];
        this.filters.query = undefined;
      } else {
        this.filters.query = undefined;
        this.filters.name = undefined;
      }
      this.searchTerm = this.filters.query || this.filters.name || '';
      // Parse sort
      if (params['sortBy']) {
        this.filters.sortBy = params['sortBy'];
      }
      if (params['sortOrder'] === 'asc' || params['sortOrder'] === 'desc') {
        this.filters.sortOrder = params['sortOrder'];
      }
      // Parse client-side filters
      if (params['joinStyle'] && ['all', 'open', 'approval', 'closed'].includes(params['joinStyle'])) {
        this.joinStyleFilter = params['joinStyle'] as any;
      }
      this.hasOpenSpots = params['hasSpots'] === 'true';
      this.policyFilter = params['policy'] ? +params['policy'] : null;
      this.loadCircles();
    });
  }
  get isTop100View(): boolean {
    return !this.filters.query && !this.filters.name &&
      (!this.filters.sortBy || this.filters.sortBy === 'rank') &&
      (this.filters.page === 0 || this.filters.page === undefined) &&
      (this.filters.pageSize === 100 || this.filters.pageSize === undefined);
  }
  getTodayGain(circle: Circle): number | null {
    if (circle.live_points == null) return null;
    if (circle.monthly_point > circle.live_points) return null;
    return circle.live_points - circle.monthly_point;
  }
  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    if (this.liveRefreshTimer) {
      clearTimeout(this.liveRefreshTimer);
    }
    if (this.liveRefreshInterval) {
      clearInterval(this.liveRefreshInterval);
    }
    if (this.countdownTicker) {
      clearInterval(this.countdownTicker);
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.circleService.listScrollPosition = window.scrollY;
  }
  trackByCircleId(_: number, circle: Circle): number {
    return circle.circle_id;
  }
  formatCountdown(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
  refreshNow(): void {
    this.circleService.invalidateSearchCache(this.filters);
    this.loadCircles(false);
  }
  private setupLiveRefresh(): void {
    if (this.countdownTicker) {
      clearInterval(this.countdownTicker);
      this.countdownTicker = null;
    }
    if (!this.isTop100View) {
      this.secondsUntilRefresh = 0;
      return;
    }
    // Use remaining cache time so the timer persists across page navigations
    const remaining = Math.ceil(this.circleService.getListRemainingSeconds());
    this.secondsUntilRefresh = remaining > 0 ? remaining : this.LIVE_REFRESH_SECONDS;

    this.ngZone.runOutsideAngular(() => {
      this.countdownTicker = setInterval(() => {
        this.ngZone.run(() => {
          if (this.secondsUntilRefresh > 0) {
            this.secondsUntilRefresh--;
            if (this.secondsUntilRefresh <= 0) {
              this.refreshNow();
            }
          }
        });
      }, 1000);
    });
  }
  loadCircles(resetScroll = true): void {
    if (resetScroll) {
      this.loading = true;
    } else {
      this.liveRefreshing = true;
    }
    this.circleService.searchCircles(this.filters).subscribe({
      next: (result) => {
        this.circles = result.items;
        this.totalCircles = result.total;
        this.applyClientFilters();
        this.loading = false;
        this.liveRefreshing = false;
        if (resetScroll && this.isFirstLoad && this.circleService.listScrollPosition > 0) {
          setTimeout(() => {
            window.scrollTo(0, this.circleService.listScrollPosition);
          }, 0);
        }
        this.isFirstLoad = false;
        
        // Always set up live refresh to keep the timer in sync
        this.setupLiveRefresh();
      },
      error: (err) => {
        console.error('Error loading circles', err);
        this.loading = false;
        this.liveRefreshing = false;
      }
    });
  }
  applyClientFilters(): void {
    let results = [...this.circles];
    // Join style filter
    if (this.joinStyleFilter !== 'all') {
      const styleMap: Record<string, number> = { open: 1, approval: 2, closed: 3 };
      const targetStyle = styleMap[this.joinStyleFilter];
      results = results.filter(c => c.join_style === targetStyle);
    }
    // Has open spots filter
    if (this.hasOpenSpots) {
      results = results.filter(c => c.member_count < 30);
    }
    // Policy filter
    if (this.policyFilter !== null) {
      results = results.filter(c => c.policy === this.policyFilter);
    }
    // --- FLIP Animation (Reordering cards smoothly) ---
    const oldPositions = new Map<number, number>();
    const cards = document.querySelectorAll('.circle-card') as NodeListOf<HTMLElement>;
    cards.forEach(el => {
      const idStr = el.getAttribute('data-circle-id');
      // Adding scrollY to ensure scroll changes during refresh don't throw off the calculation
      if (idStr) oldPositions.set(Number(idStr), el.getBoundingClientRect().top + window.scrollY);
    });
    this.filteredCircles = results;
    
    // Force DOM update synchronously
    this.cdr.detectChanges();
    const newCards = document.querySelectorAll('.circle-card') as NodeListOf<HTMLElement>;
    newCards.forEach(el => {
      const idStr = el.getAttribute('data-circle-id');
      if (idStr && oldPositions.has(Number(idStr))) {
        const oldTop = oldPositions.get(Number(idStr))!;
        const newTop = el.getBoundingClientRect().top + window.scrollY;
        const deltaY = oldTop - newTop;
        if (deltaY !== 0) {
          const isMovingUp = deltaY > 0;
          
          // Simplified, slightly elevated FLIP trajectory
          el.animate([
            { 
              transform: `translateY(${deltaY}px)`, 
              zIndex: isMovingUp ? '20' : '10',
              boxShadow: 'none'
            },
            { 
              // Very slight float over/under (max 6px shift, no scale)
              transform: `translate(${isMovingUp ? 6 : -6}px, ${deltaY * 0.5}px)`,
              zIndex: isMovingUp ? '20' : '10',
              boxShadow: isMovingUp ? '0 4px 8px rgba(0,0,0,0.3)' : 'none',
              offset: 0.5 
            },
            { 
              transform: `translateY(0px)`, 
              zIndex: isMovingUp ? '20' : '10',
              boxShadow: 'none'
            }
          ], {
            duration: 500, // Faster, snappier
            easing: 'ease-in-out'
          });
        }
      }
    });
  }
  onSortChange(): void {
    this.updateQueryParams({
      sortBy: this.filters.sortBy,
      sortOrder: this.filters.sortOrder,
      page: 0
    });
  }
  toggleSortOrder(): void {
    this.filters.sortOrder = this.filters.sortOrder === 'asc' ? 'desc' : 'asc';
    this.onSortChange();
  }
  setJoinStyleFilter(style: 'all' | 'open' | 'approval' | 'closed'): void {
    this.joinStyleFilter = style;
    this.applyClientFilters();
    this.updateQueryParams({
      joinStyle: style === 'all' ? null : style,
      page: 0
    });
  }
  toggleHasOpenSpots(): void {
    this.hasOpenSpots = !this.hasOpenSpots;
    this.applyClientFilters();
    this.updateQueryParams({
      hasSpots: this.hasOpenSpots ? 'true' : null,
      page: 0
    });
  }
  onPolicyFilterChange(): void {
    this.applyClientFilters();
    this.updateQueryParams({
      policy: this.policyFilter !== null ? this.policyFilter : null,
      page: 0
    });
  }
  clearAllFilters(): void {
    this.searchTerm = '';
    this.joinStyleFilter = 'all';
    this.hasOpenSpots = false;
    this.policyFilter = null;
    this.filters.sortBy = 'rank';
    this.filters.sortOrder = 'asc';
    this.router.navigate(['/circles']);
  }
  get hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.joinStyleFilter !== 'all' || this.hasOpenSpots ||
      this.policyFilter !== null || this.filters.sortBy !== 'rank' || this.filters.sortOrder !== 'asc');
  }
  getPolicyLabel(policy: number): string {
    return this.policyLabels[policy] || 'Unknown';
  }
  getClubRankIcon(rank: number | undefined): string | null {
    if (!rank || rank < 1 || rank > 11) return null;
    const padded = rank.toString().padStart(2, '0');
    return `assets/images/icon/circle_rank/utx_ico_circle_rank_${padded}.png`;
  }
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.ngZone.runOutsideAngular(() => {
      this.searchTimer = window.setTimeout(() => {
        this.ngZone.run(() => {
          const query = value && value.trim() ? value.trim() : null;
          this.updateQueryParams({
            query: query,
            name: null,
            page: 0
          });
        });
      }, 300);
    });
  }
  onPageChange(event: PageEvent): void {
    this.updateQueryParams({
      page: event.pageIndex,
      pageSize: event.pageSize
    });
  }
  private updateQueryParams(params: any): void {
    const currentParams = this.route.snapshot.queryParams;
    const allParams = { ...currentParams, ...params };
    // Remove nulls/undefined/empty strings
    const finalParams: any = {};
    Object.keys(allParams).forEach(key => {
      if (allParams[key] !== null && allParams[key] !== undefined && allParams[key] !== '') {
        finalParams[key] = allParams[key];
      }
    });
    // Remove page if 0
    if (finalParams['page'] == 0) delete finalParams['page'];
    this.router.navigate(['/circles'], {
      queryParams: finalParams
    }).then(success => {
    }).catch(err => {
      console.error('Navigation error:', err);
    });
  }
  navigateToCircle(circleId: number): void {
    this.router.navigate(['/circles', circleId]);
  }
}
