import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { RankingService } from '../../services/ranking.service';
import { UserFanRankingMonthly, UserFanRankingAlltime, UserFanRankingGains } from '../../models/ranking.model';
import { CompactNumberPipe } from '../../pipes/compact-number.pipe';
import { LocaleNumberPipe } from '../../pipes/locale-number.pipe';
type RankingTab = 'monthly' | 'alltime' | 'gains';
@Component({
  selector: 'app-rankings',
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
    MatTabsModule,
    FormsModule,
    CompactNumberPipe,
    LocaleNumberPipe
  ],
  templateUrl: './rankings.component.html',
  styleUrl: './rankings.component.scss'
})
export class RankingsComponent implements OnInit, OnDestroy {
  protected Math = Math;
  monthlyRankings: UserFanRankingMonthly[] = [];
  alltimeRankings: UserFanRankingAlltime[] = [];
  gainsRankings: UserFanRankingGains[] = [];
  totalRankings = 0;
  loading = false;
  activeTab: RankingTab = 'monthly';
  page = 0;
  pageSize = 100;
  searchTerm = '';
  // Monthly-specific
  selectedMonth: number;
  selectedYear: number;
  availableMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  availableYears: number[] = [];
  monthLabels: Record<number, string> = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April',
    5: 'May', 6: 'June', 7: 'July', 8: 'August',
    9: 'September', 10: 'October', 11: 'November', 12: 'December'
  };
  // Gains-specific
  gainsSortBy: 'gain_3d' | 'gain_7d' | 'gain_30d' = 'gain_30d';
  gainsSortOptions = [
    { value: 'gain_3d', label: '3-Day Gain' },
    { value: 'gain_7d', label: '7-Day Gain' },
    { value: 'gain_30d', label: '30-Day Gain' }
  ];
  // Alltime-specific
  alltimeSortBy: 'total_fans' | 'total_gain' | 'avg_day' | 'avg_week' | 'avg_month' = 'avg_month';
  alltimeSortOptions = [
    { value: 'avg_month', label: 'Avg/Month' },
    { value: 'total_fans', label: 'Total Fans' },
    { value: 'total_gain', label: 'Total Gain' },
    { value: 'avg_day', label: 'Avg/Day' },
    { value: 'avg_week', label: 'Avg/Week' },
  ];
  tabIndexMap: RankingTab[] = ['monthly', 'alltime', 'gains'];
  private destroy$ = new Subject<void>();
  private searchTimer: any;
  private isFirstLoad = true;
  constructor(
    private rankingService: RankingService,
    private route: ActivatedRoute,
    private router: Router,
    private ngZone: NgZone
  ) {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    this.selectedMonth = jst.getUTCMonth() + 1;
    this.selectedYear = jst.getUTCFullYear();
    for (let y = 2021; y <= this.selectedYear; y++) {
      this.availableYears.push(y);
    }
  }
  ngOnInit(): void {
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      if (params['tab'] && ['monthly', 'alltime', 'gains'].includes(params['tab'])) {
        this.activeTab = params['tab'] as RankingTab;
      }
      this.page = params['page'] ? +params['page'] : 0;
      this.pageSize = params['pageSize'] ? +params['pageSize'] : 100;
      this.searchTerm = params['query'] || '';
      if (params['month']) this.selectedMonth = +params['month'];
      if (params['year']) this.selectedYear = +params['year'];
      if (params['sortBy'] && ['gain_3d', 'gain_7d', 'gain_30d'].includes(params['sortBy'])) {
        this.gainsSortBy = params['sortBy'] as any;
      }
      if (params['sortBy'] && ['total_fans', 'total_gain', 'avg_day', 'avg_week', 'avg_month'].includes(params['sortBy'])) {
        this.alltimeSortBy = params['sortBy'] as any;
      }
      this.loadRankings();
    });
  }
  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.destroy$.next();
    this.destroy$.complete();
    this.rankingService.listScrollPosition = window.scrollY;
  }
  get hasResults(): boolean {
    switch (this.activeTab) {
      case 'monthly': return this.monthlyRankings.length > 0;
      case 'alltime': return this.alltimeRankings.length > 0;
      case 'gains': return this.gainsRankings.length > 0;
    }
  }
  loadRankings(): void {
    this.loading = true;
    switch (this.activeTab) {
      case 'monthly':
        this.rankingService.getMonthlyRankings({
          month: this.selectedMonth,
          year: this.selectedYear,
          page: this.page,
          limit: this.pageSize,
          query: this.searchTerm || undefined,
          circle_name: this.searchTerm || undefined
        }).subscribe({
          next: res => {
            this.monthlyRankings = res.rankings;
            this.totalRankings = res.total;
            this.finishLoad();
          },
          error: () => this.loading = false
        });
        break;
      case 'alltime':
        this.rankingService.getAlltimeRankings({
          page: this.page,
          limit: this.pageSize,
          query: this.searchTerm || undefined,
          sort_by: this.alltimeSortBy,
          circle_name: this.searchTerm || undefined
        }).subscribe({
          next: res => {
            this.alltimeRankings = res.rankings;
            this.totalRankings = res.total;
            this.finishLoad();
          },
          error: () => this.loading = false
        });
        break;
      case 'gains':
        this.rankingService.getGainsRankings({
          page: this.page,
          limit: this.pageSize,
          sort_by: this.gainsSortBy,
          query: this.searchTerm || undefined,
          circle_name: this.searchTerm || undefined
        }).subscribe({
          next: res => {
            this.gainsRankings = res.rankings;
            this.totalRankings = res.total;
            this.finishLoad();
          },
          error: () => this.loading = false
        });
        break;
    }
  }
  private finishLoad(): void {
    this.loading = false;
    if (this.isFirstLoad && this.rankingService.listScrollPosition > 0) {
      setTimeout(() => window.scrollTo(0, this.rankingService.listScrollPosition), 0);
    }
    this.isFirstLoad = false;
  }
  onTabChange(index: number): void {
    this.activeTab = this.tabIndexMap[index];
    this.updateQueryParams({ tab: this.activeTab, page: 0, sortBy: null });
  }
  get activeTabIndex(): number {
    return this.tabIndexMap.indexOf(this.activeTab);
  }
  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.ngZone.runOutsideAngular(() => {
      this.searchTimer = window.setTimeout(() => {
        this.ngZone.run(() => {
          this.updateQueryParams({
            query: value?.trim() || null,
            page: 0
          });
        });
      }, 300);
    });
  }
  onMonthChange(): void {
    this.updateQueryParams({ month: this.selectedMonth, page: 0 });
  }
  onYearChange(): void {
    this.updateQueryParams({ year: this.selectedYear, page: 0 });
  }
  onGainsSortChange(): void {
    this.updateQueryParams({ sortBy: this.gainsSortBy, page: 0 });
  }
  onAlltimeSortChange(): void {
    this.updateQueryParams({ sortBy: this.alltimeSortBy, page: 0 });
  }
  onPageChange(event: PageEvent): void {
    this.updateQueryParams({ page: event.pageIndex, pageSize: event.pageSize });
  }
  clearSearch(): void {
    this.searchTerm = '';
    this.updateQueryParams({ query: null, page: 0 });
  }
  getGainValue(entry: UserFanRankingGains): number {
    switch (this.gainsSortBy) {
      case 'gain_3d': return entry.gain_3d;
      case 'gain_7d': return entry.gain_7d;
      case 'gain_30d': return entry.gain_30d;
    }
  }
  getGainRank(entry: UserFanRankingGains): number {
    switch (this.gainsSortBy) {
      case 'gain_3d': return entry.rank_3d;
      case 'gain_7d': return entry.rank_7d;
      case 'gain_30d': return entry.rank_30d;
    }
  }
  getGainLabel(): string {
    switch (this.gainsSortBy) {
      case 'gain_3d': return '3d';
      case 'gain_7d': return '7d';
      case 'gain_30d': return '30d';
    }
  }
  getAlltimeRank(entry: UserFanRankingAlltime): number {
    switch (this.alltimeSortBy) {
      case 'total_fans': return entry.rank_total_fans;
      case 'total_gain': return entry.rank_total_gain;
      case 'avg_day': return entry.rank_avg_day;
      case 'avg_week': return entry.rank_avg_week;
      case 'avg_month': return entry.rank_avg_month;
      default: return entry.rank;
    }
  }
  private updateQueryParams(params: any): void {
    const currentParams = this.route.snapshot.queryParams;
    const allParams = { ...currentParams, ...params };
    const finalParams: any = {};
    Object.keys(allParams).forEach(key => {
      if (allParams[key] !== null && allParams[key] !== undefined && allParams[key] !== '') {
        finalParams[key] = allParams[key];
      }
    });
    if (finalParams['page'] == 0) delete finalParams['page'];
    if (finalParams['tab'] === 'monthly') delete finalParams['tab'];
    this.router.navigate(['/rankings'], { queryParams: finalParams });
  }
}
