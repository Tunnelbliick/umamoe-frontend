import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, NgZone, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { CircleService } from '../../../services/circle.service';
import { Circle, CircleMember, CircleHistoryPoint, CircleMemberMonthlyData } from '../../../models/circle.model';
import { DiscordLinkPipe } from '../../../pipes/discord-link.pipe';
import { MemberDisplaySettingsDialogComponent } from './member-display-settings-dialog.component';
import { AnimatedNumberComponent } from '../../../components/animated-number/animated-number.component';
import { LocaleNumberPipe } from '../../../pipes/locale-number.pipe';
Chart.register(...registerables);
export type CalculationType = 'monthly_gain' | 'weekly_gain' | 'daily_gain' | 'avg_daily_gain' | 'daily_avg' | 'projected_monthly' | 'total_fans';
export interface ChartLegendItem {
  name: string;
  color: string;
  hidden: boolean;
  datasetIndex: number;
}
export interface CircleDetailsConfig {
  selectedCalculation: CalculationType;
  showTotalFans: boolean;
  showSevenDayAvg: boolean;
  showDailyGain: boolean;
  showDailyAvg: boolean;
  showLastUpdated: boolean;
  showWeeklyGain: boolean;
  showProjectedMonthly: boolean;
  showMonthlyGain: boolean;
  showRole: boolean;
  showTrainerId: boolean;
  includePriorClubData: boolean;
}
export type MemberChartMode = 'cumulative' | 'delta';
export type MemberViewMode = 'chart' | 'calendar';
export type MembersListMode = 'grid' | 'row';
export interface CalendarDay {
  day: number;
  totalFans: number;
  dailyDelta: number;
  hasData: boolean;
  memberDeltas: { name: string; delta: number }[];
  isOtherMonth?: boolean;
}
@Component({
  selector: 'app-circle-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
    DiscordLinkPipe,
    AnimatedNumberComponent,
    LocaleNumberPipe
  ],
  templateUrl: './circle-details.component.html',
  styleUrl: './circle-details.component.scss'
})
export class CircleDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  circleId: string | null = null;
  circle: Circle | undefined;
  clubRank: number | undefined;
  fansToNextTier: number | undefined;
  fansToLowerTier: number | undefined;
  yesterdayFansToNextTier: number | undefined;
  yesterdayFansToLowerTier: number | undefined;
  members: CircleMember[] = [];
  history: CircleHistoryPoint[] = [];
  rawMemberData: CircleMemberMonthlyData[] = [];
  allMemberData: CircleMemberMonthlyData[] = [];
  loading = true;
  liveRefreshing = false;
  secondsUntilRefresh = 0;
  private liveRefreshTimer: any;
  private liveRefreshInterval: any;
  private countdownTicker: any;
  readonly LIVE_REFRESH_SECONDS = 5 * 60;
  /** True effective month when the page was opened (JST, never changes with navigation). */
  readonly todayYear: number;
  readonly todayMonth: number;
  currentYear: number;
  currentMonth: number;
  get isCurrentMonth(): boolean {
    return this.currentYear === this.todayYear && this.currentMonth === this.todayMonth;
  }
  get isLastMonth(): boolean {
    let lm = this.todayMonth - 1;
    let ly = this.todayYear;
    if (lm === 0) { lm = 12; ly--; }
    return this.currentYear === ly && this.currentMonth === lm;
  }
  /** Monthly rank appropriate for the viewed month. */
  get displayedRank(): number | undefined {
    if (!this.circle) return undefined;
    if (this.isCurrentMonth) return this.circle.monthly_rank;
    if (this.isLastMonth) return this.circle.last_month_rank || undefined;
    return undefined;
  }
  /** Monthly fans appropriate for the viewed month. */
  get displayedMonthlyPoint(): number {
    if (!this.circle) return this.computedMonthlyPoint;
    if (this.isCurrentMonth) return this.circle.monthly_point ?? this.computedMonthlyPoint;
    if (this.isLastMonth) return this.circle.last_month_point ?? this.computedMonthlyPoint;
    return this.computedMonthlyPoint;
  }
  displayedColumns: string[] = ['name', 'role', 'fans', 'last_updated'];
  
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('memberChartCanvas') memberChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('calendarContainer') calendarContainer!: ElementRef<HTMLDivElement>;
  chart: Chart | undefined;
  memberChart: Chart | undefined;
  chartLegendItems: ChartLegendItem[] = [];
  private chartTimer: any;
  private previousVisibilityState: boolean[] | null = null;
  private isolatedMemberIndex: number | null = null;
  calendarZoom = 1;
  private _mouseX = 0;
  private _mouseY = 0;
  private _mouseMoveHandler = (e: MouseEvent) => { this._mouseX = e.clientX; this._mouseY = e.clientY; };
  private _touchMoveHandler = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      this._mouseX = e.touches[0].clientX;
      this._mouseY = e.touches[0].clientY;
    }
  };
  private _tooltipDismissHandler = (e: Event) => {
    const tooltipEl = document.getElementById('chartjs-tooltip');
    if (!tooltipEl) return;
    // Check if tap/click is outside any chart canvas
    const target = e.target as HTMLElement;
    const isOnCanvas = target?.tagName === 'CANVAS' &&
      (target === this.chartCanvas?.nativeElement || target === this.memberChartCanvas?.nativeElement);
    if (!isOnCanvas) {
      tooltipEl.style.opacity = '0';
    }
  };
  private _touchEndHandler = () => {
    // Hide tooltip after touch ends (finger lifted off chart)
    setTimeout(() => {
      const tooltipEl = document.getElementById('chartjs-tooltip');
      if (tooltipEl) tooltipEl.style.opacity = '0';
      // Also tell Chart.js to deactivate tooltip
      if (this.chart) {
        this.chart.setActiveElements([]);
        this.chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
        this.chart.update('none');
      }
      if (this.memberChart) {
        this.memberChart.setActiveElements([]);
        this.memberChart.tooltip?.setActiveElements([], { x: 0, y: 0 });
        this.memberChart.update('none');
      }
    }, 2000); // 2s delay so user can read the tooltip
  };
  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateCalendarZoom();
  }
  @HostListener('document:click')
  closeExportMenu(): void {
    this.exportMenuOpen = false;
  }
  exportMenuOpen = false;
  toggleExportMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.exportMenuOpen = !this.exportMenuOpen;
  }
  memberChartMode: MemberChartMode = 'cumulative';
  memberViewMode: MemberViewMode = 'chart';
  membersListMode: MembersListMode = 'grid';
  calendarWeeks: CalendarDay[][] = [];
  computedMonthlyPoint: number = 0;
  config: CircleDetailsConfig = {
    selectedCalculation: 'monthly_gain',
    showTotalFans: true,
    showSevenDayAvg: true,
    showDailyGain: true,
    showDailyAvg: false,
    showLastUpdated: true,
    showWeeklyGain: false,
    showProjectedMonthly: false,
    showMonthlyGain: false, // Usually covered by selectedCalculation, but can be shown explicitly
    showRole: false,
    showTrainerId: false,
    includePriorClubData: true
  };
  calculationTypes: { value: CalculationType; label: string; shortLabel: string }[] = [
    { value: 'monthly_gain', label: 'Monthly Gain', shortLabel: 'Monthly' },
    { value: 'weekly_gain', label: 'Weekly Gain', shortLabel: 'Weekly' },
    { value: 'daily_gain', label: 'Daily Gain', shortLabel: 'Daily' },
    { value: 'avg_daily_gain', label: 'Avg Daily Gain (7d)', shortLabel: '7d Avg' },
    { value: 'daily_avg', label: 'Daily Avg (Month)', shortLabel: 'Daily Avg' },
    { value: 'projected_monthly', label: 'Projected Monthly', shortLabel: 'Projected' },
    { value: 'total_fans', label: 'Total Fans', shortLabel: 'Fans' }
  ];
  constructor(
    private route: ActivatedRoute,
    private circleService: CircleService,
    private ngZone: NgZone,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize with JST date to handle month rollover correctly
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const jstDate = new Date(utc + (3600000 * 9));
    // Swap at the end of the 1st (start of the 2nd), so subtract 1 day
    jstDate.setDate(jstDate.getDate() - 1);
    this.currentYear = jstDate.getFullYear();
    this.currentMonth = jstDate.getMonth() + 1;
    this.todayYear = this.currentYear;
    this.todayMonth = this.currentMonth;
    this.loadConfig();
  }
  ngOnInit(): void {
    document.addEventListener('mousemove', this._mouseMoveHandler);
    document.addEventListener('touchmove', this._touchMoveHandler, { passive: true });
    document.addEventListener('touchstart', this._tooltipDismissHandler, { passive: true });
    document.addEventListener('click', this._tooltipDismissHandler);
    this.circleId = this.route.snapshot.paramMap.get('id');
    if (this.circleId) {
      this.loadData(this.circleId);
    }
  }
  loadConfig(): void {
    const saved = localStorage.getItem('circle_details_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with default to handle new fields
        this.config = { ...this.config, ...parsed };
      } catch (e) {
        console.error('Failed to parse circle config', e);
      }
    }
  }
  saveConfig(): void {
    localStorage.setItem('circle_details_config', JSON.stringify(this.config));
    // Re-sort members based on new calculation if needed, or just trigger change detection
    this.sortMembers();
  }
  openSettingsDialog(): void {
    const dialogRef = this.dialog.open(MemberDisplaySettingsDialogComponent, {
      width: '500px',
      maxWidth: 'calc(100vw - 16px)',
      panelClass: 'transparent-dialog-panel',
      data: {
        config: { ...this.config }, // Pass a copy
        calculationTypes: this.calculationTypes
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.config = result;
        this.saveConfig();
      }
    });
  }
  setCalculation(type: CalculationType): void {
    this.config.selectedCalculation = type;
    this.saveConfig();
  }
  getMemberValue(member: any): number {
    switch (this.config.selectedCalculation) {
      case 'monthly_gain': return member.monthly_gain;
      case 'weekly_gain': return member.weekly_gain;
      case 'daily_gain': return member.daily_gain;
      case 'avg_daily_gain': return member.seven_day_avg; // Using 7-day avg as "Avg Daily"
      case 'daily_avg': return member.daily_avg;
      case 'projected_monthly': return member.projected_monthly;
      case 'total_fans': return member.fan_count;
      default: return member.monthly_gain;
    }
  }
  getPriorContribution(member: any): number {
    switch (this.config.selectedCalculation) {
      case 'monthly_gain':
      case 'daily_avg':
      case 'projected_monthly':
        return member.priorCircleGain || 0;
      case 'weekly_gain':
      case 'avg_daily_gain':
        return member.priorInWeekly || 0;
      case 'daily_gain':
        return member.priorInDaily || 0;
      case 'total_fans':
      default:
        return 0;
    }
  }
  getCalculationLabel(): string {
    return this.calculationTypes.find(t => t.value === this.config.selectedCalculation)?.label || 'Monthly Gain';
  }
  getCalculationShortLabel(): string {
    return this.calculationTypes.find(t => t.value === this.config.selectedCalculation)?.shortLabel || 'Monthly';
  }
  getClubRankIcon(rank: number | undefined): string | null {
    if (!rank || rank < 1 || rank > 11) return null;
    const padded = rank.toString().padStart(2, '0');
    return `assets/images/icon/circle_rank/utx_ico_circle_rank_${padded}.png`;
  }
  getMemberRole(m: CircleMemberMonthlyData): 'leader' | 'officer' | 'member' {
    if (m.membership === 3) return 'leader';
    if (m.membership === 2) return 'officer';
    // Fallback: check leader_viewer_id if membership field is missing
    if (!m.membership && this.circle?.leader_viewer_id === m.viewer_id) return 'leader';
    return 'member';
  }
  trackByViewerId(_: number, member: any): string {
    return member.trainer_id ?? String(_);
  }
  // External tooltip handler — renders tooltip as a DOM element on document.body
  // so it is never clipped by overflow on parent containers
  externalTooltipHandler(context: any): void {
    const { chart, tooltip } = context;
    let tooltipEl = document.getElementById('chartjs-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'chartjs-tooltip';
      tooltipEl.style.cssText = `
        position: fixed;
        background: rgba(18, 18, 18, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 8px 10px;
        pointer-events: none;
        z-index: 99999;
        font-family: inherit;
        font-size: 12px;
        color: #fff;
        max-height: 70vh;
        overflow-y: auto;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        transition: opacity 0.15s ease;
      `;
      document.body.appendChild(tooltipEl);
    }
    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }
    // Build content
    let html = '';
    if (tooltip.title && tooltip.title.length) {
      html += `<div style="font-weight:600; margin-bottom:4px; color:rgba(255,255,255,0.7);">${tooltip.title.join('<br>')}</div>`;
    }
    if (tooltip.body) {
      const bodyLines = tooltip.body.map((b: any) => b.lines);
      bodyLines.forEach((lines: string[], i: number) => {
        const colors = tooltip.labelColors[i];
        const colorBox = `<span style="display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:2px;background:${colors.backgroundColor};border:1px solid ${colors.borderColor};vertical-align:middle;"></span>`;
        lines.forEach((line: string) => {
          html += `<div style="white-space:nowrap;line-height:1.5;">${colorBox}${line}</div>`;
        });
      });
    }
    tooltipEl.innerHTML = html;
    // Hide while repositioning so stale position isn't visible for one frame
    tooltipEl.style.opacity = '0';
    // Move temporarily off-screen so GetBoundingClientRect measures the full
    // un-clipped size (important when tooltip was previously near the edge).
    tooltipEl.style.left = '0px';
    tooltipEl.style.top = '-9999px';
    // Force reflow with new content, then measure
    const elRect = tooltipEl.getBoundingClientRect();
    // Position at mouse cursor
    let left = this._mouseX + 15;
    let top = this._mouseY - 10;
    // Keep within viewport
    if (left + elRect.width > window.innerWidth - 10) {
      left = this._mouseX - elRect.width - 15;
    }
    if (top + elRect.height > window.innerHeight - 10) {
      top = window.innerHeight - elRect.height - 10;
    }
    if (top < 10) top = 10;
    if (left < 10) left = 10;
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
    tooltipEl.style.opacity = '1';
  }
  sortMembers(): void {
    // Separate active and inactive
    const active = this.members.filter(m => (m as any).isActive);
    const inactive = this.members.filter(m => !(m as any).isActive);
    // Sort active by selected calculation
    active.sort((a: any, b: any) => this.getMemberValue(b) - this.getMemberValue(a));
    
    // Sort inactive by fan count (default)
    inactive.sort((a: any, b: any) => b.fan_count - a.fan_count);
    this.members = [...active, ...inactive];
  }
  toggleMemberChartMode(): void {
    this.memberChartMode = this.memberChartMode === 'cumulative' ? 'delta' : 'cumulative';
    this.initMemberChart();
  }
  toggleIncludePriorClubData(): void {
    this.config.includePriorClubData = !this.config.includePriorClubData;
    this.saveConfig();
    // Re-process all member data with new setting
    if (this.allMemberData && this.allMemberData.length > 0) {
      this.processMembersData(this.allMemberData);
    }
    this.initMemberChart();
  }
  private static compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  formatCompact(value: number): string {
    const sign = value >= 0 ? '+' : '';
    if (Math.abs(value) >= 100_000) return sign + CircleDetailsComponent.compactFmt.format(value);
    return sign + value.toLocaleString();
  }
  toggleMemberViewMode(): void {
    this.memberViewMode = this.memberViewMode === 'chart' ? 'calendar' : 'chart';
    if (this.memberViewMode === 'calendar') {
      this.buildCalendarData();
      setTimeout(() => this.updateCalendarZoom(), 0);
    } else {
      // Re-init chart after switching back since canvas was hidden
      setTimeout(() => this.initMemberChart(), 50);
    }
  }
  toggleMembersListMode(): void {
    this.membersListMode = this.membersListMode === 'grid' ? 'row' : 'grid';
  }
  buildCalendarData(): void {
    let data = this.allMemberData.filter(m => m.year == this.currentYear && m.month == this.currentMonth);
    if (data.length === 0) data = this.allMemberData;
    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const firstDayOfWeek = new Date(this.currentYear, this.currentMonth - 1, 1).getDay();
    const startOffset = (firstDayOfWeek + 6) % 7; // Adjust to Monday start
    const dailyTotals: number[] = [];
    const dailyDeltas: number[] = [];
    const memberDeltasPerDay: { name: string; delta: number }[][] = [];
    for (let day = 0; day < daysInMonth; day++) {
      let total = 0;
      let hasData = false;
      const deltas: { name: string; delta: number }[] = [];
      data.forEach(m => {
        if (!m.daily_fans) return;
        const fans = m.daily_fans;
        if (fans[day] > 0) {
          total += fans[day];
          hasData = true;
          // Find the NEXT non-zero value for this member (forward delta: gain on this day = next - current)
          let nextValue = 0;
          for (let n = day + 1; n < fans.length; n++) {
            if (fans[n] > 0) { nextValue = fans[n]; break; }
          }
          // If no next day found, use next_month_start for last day's gain
          if (nextValue === 0 && m.next_month_start && m.next_month_start > 0) {
            nextValue = m.next_month_start;
          }
          if (nextValue > 0) {
            deltas.push({ name: m.trainer_name, delta: nextValue - fans[day] });
          }
        }
      });
      dailyTotals.push(total);
      // Daily delta = sum of individual member deltas (excludes join/leave effects)
      const sumOfMemberDeltas = deltas.reduce((sum, d) => sum + d.delta, 0);
      dailyDeltas.push(hasData ? sumOfMemberDeltas : 0);
      memberDeltasPerDay.push(deltas.sort((a, b) => b.delta - a.delta));
    }
    this.calendarWeeks = [];
    let currentWeek: CalendarDay[] = [];
    // Fill leading days with previous month's dates
    const prevMonthDays = new Date(this.currentYear, this.currentMonth - 1, 0).getDate();
    for (let i = 0; i < startOffset; i++) {
      const prevDay = prevMonthDays - startOffset + 1 + i;
      currentWeek.push({ day: prevDay, totalFans: 0, dailyDelta: 0, hasData: false, memberDeltas: [], isOtherMonth: true });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const idx = day - 1;
      currentWeek.push({
        day,
        totalFans: dailyTotals[idx],
        dailyDelta: dailyDeltas[idx],
        hasData: dailyTotals[idx] > 0,
        memberDeltas: memberDeltasPerDay[idx]
      });
      if (currentWeek.length === 7) {
        this.calendarWeeks.push(currentWeek);
        currentWeek = [];
      }
    }
    // Fill trailing days with next month's dates
    if (currentWeek.length > 0) {
      let nextDay = 1;
      while (currentWeek.length < 7) {
        currentWeek.push({ day: nextDay++, totalFans: 0, dailyDelta: 0, hasData: false, memberDeltas: [], isOtherMonth: true });
      }
      this.calendarWeeks.push(currentWeek);
    }
  }
  ngAfterViewInit(): void {
    // Chart initialization will happen after data load
    this.updateCalendarZoom();
  }
  ngOnDestroy(): void {
    this.teardownLiveRefresh();
    if (this.chartTimer) {
      clearTimeout(this.chartTimer);
    }
    if (this.chart) {
      this.chart.destroy();
    }
    if (this.memberChart) {
      this.memberChart.destroy();
    }
    // Clean up external tooltip
    const tooltipEl = document.getElementById('chartjs-tooltip');
    if (tooltipEl) tooltipEl.remove();
    document.removeEventListener('mousemove', this._mouseMoveHandler);
    document.removeEventListener('touchmove', this._touchMoveHandler);
    document.removeEventListener('touchstart', this._tooltipDismissHandler);
    document.removeEventListener('click', this._tooltipDismissHandler);
  }
  get isLiveCircle(): boolean {
    return this.isCurrentMonth && !!this.circle && (this.circle.monthly_rank ?? 999) <= 100;
  }

  /** True when last_live_update is from after the most recent JST midnight (00:00 JST). */
  get isLiveDataFresh(): boolean {
    if (!this.circle?.last_live_update || !this.circle.live_points) return false;
    const liveDate = new Date(this.circle.last_live_update);
    if (isNaN(liveDate.getTime())) return false;
    // Calculate the most recent JST midnight in UTC: today 00:00 JST = today-at-15:00-UTC-yesterday
    const now = new Date();
    const utcNow = now.getTime();
    const jstNow = utcNow + 9 * 3600000;
    // Floor to JST midnight, then convert back to UTC
    const jstMidnight = Math.floor(jstNow / 86400000) * 86400000;
    const lastResetUtc = jstMidnight - 9 * 3600000;
    return liveDate.getTime() >= lastResetUtc;
  }
  formatCountdown(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
  refreshNow(): void {
    if (!this.circleId) return;
    this.circleService.invalidateDetailsCache(this.circleId, this.currentYear, this.currentMonth);
    this.softRefreshData();
  }
  private setupLiveRefresh(): void {
    this.teardownLiveRefresh();
    if (!this.isLiveCircle) return;
    // Use remaining cache time so the countdown persists across same-circle re-visits
    const remaining = Math.ceil(
      this.circleService.getDetailsRemainingSeconds(this.circleId!, this.currentYear, this.currentMonth)
    );
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
  private teardownLiveRefresh(): void {
    if (this.liveRefreshTimer) {
      clearTimeout(this.liveRefreshTimer);
      this.liveRefreshTimer = null;
    }
    if (this.liveRefreshInterval) {
      clearInterval(this.liveRefreshInterval);
      this.liveRefreshInterval = null;
    }
    if (this.countdownTicker) {
      clearInterval(this.countdownTicker);
      this.countdownTicker = null;
    }
  }
  private softRefreshData(): void {
    if (!this.circleId) return;
    this.liveRefreshing = true;
    this.circleService.invalidateDetailsCache(this.circleId, this.currentYear, this.currentMonth);
    this.circleService.getCircleDetails(this.circleId, this.currentYear, this.currentMonth).subscribe({
      next: (response) => {
        this.circle = response.circle;
        this.clubRank = response.club_rank;
        this.fansToNextTier = response.fans_to_next_tier;
        this.fansToLowerTier = response.fans_to_lower_tier;
        this.yesterdayFansToNextTier = response.yesterday_fans_to_next_tier;
        this.yesterdayFansToLowerTier = response.yesterday_fans_to_lower_tier;
        this.allMemberData = response.members;
        this.processMembersData(response.members);
        this.liveRefreshing = false;
        this.secondsUntilRefresh = this.LIVE_REFRESH_SECONDS;
        // Force change detection so OnPush children (AnimatedNumber) pick up new values
        this.cdr.detectChanges();
        // Recreate charts with fresh data
        setTimeout(() => {
          this.initChart();
          this.initMemberChart();
        }, 50);
      },
      error: () => {
        this.liveRefreshing = false;
      }
    });
  }
  private updateCalendarZoom(): void {
    // Use the content container width (or fallback to window width)
    const el = this.calendarContainer?.nativeElement;
    const width = el ? el.parentElement?.clientWidth ?? window.innerWidth : window.innerWidth;
    // Full size at 800px+, scale down linearly to 0.5 at 300px
    this.calendarZoom = Math.min(1, Math.max(0.5, width / 800));
  }
  loadData(id: string): void {
    this.loading = true;
    
    this.circleService.getCircleDetails(id, this.currentYear, this.currentMonth).subscribe({
      next: (response) => {
        this.circle = response.circle;
        this.clubRank = response.club_rank;
        this.fansToNextTier = response.fans_to_next_tier;
        this.fansToLowerTier = response.fans_to_lower_tier;
        this.yesterdayFansToNextTier = response.yesterday_fans_to_next_tier;
        this.yesterdayFansToLowerTier = response.yesterday_fans_to_lower_tier;
        this.allMemberData = response.members;
        this.processMembersData(response.members);
        this.loading = false;
        this.setupLiveRefresh();
        
        // Use setTimeout to ensure DOM is fully rendered
        this.ngZone.runOutsideAngular(() => {
          this.chartTimer = setTimeout(() => {
            this.ngZone.run(() => {
              this.initChart();
              this.initMemberChart();
            });
          }, 100);
        });
      },
      error: (err) => {
        console.error('Failed to load circle details', err);
        this.loading = false;
      }
    });
  }
  processMembersData(monthlyData: CircleMemberMonthlyData[]): void {
    if (!monthlyData || monthlyData.length === 0) {
        console.error('No member data available');
        this.members = [];
        this.rawMemberData = [];
        this.history = [];
        return;
    }
    
    // Filter for current month/year if API returns multiple
    // Use loose equality to handle string/number differences
    let currentMonthData = monthlyData.filter(m => m.year == this.currentYear && m.month == this.currentMonth);
    
    
    // If no data matches, use all available data as fallback
    if (currentMonthData.length === 0) {
        console.warn('No data matched current month filter, using all available data');
        if (monthlyData.length > 0) {
        }
        currentMonthData = monthlyData;
    }
    const dataToProcess = currentMonthData;
    // Determine the effective "last day" index.
    // Negative daily_fans values indicate data from a prior circle (abs value = real fan count)
    let maxIndexWithData = 0;
    dataToProcess.forEach(m => {
        if (!m.daily_fans) return;
        for (let i = m.daily_fans.length - 1; i >= 0; i--) {
            if (m.daily_fans[i] !== 0) {
                if (i > maxIndexWithData) maxIndexWithData = i;
                break; // Found last data for this member
            }
        }
    });
    const activeMembers: any[] = [];
    const inactiveMembers: any[] = [];
    // Process all members
    dataToProcess.forEach(m => {
      const fans = m.daily_fans || [];
      // Build absolute values array and track which days are from a prior circle
      // When includePriorClubData is OFF, treat prior circle days as missing (0)
      const includePrior = this.config.includePriorClubData;
      const absFans = fans.map(v => v < 0 ? (includePrior ? Math.abs(v) : 0) : Math.abs(v));
      const isPriorCircle = fans.map(v => v < 0);
      
      // Check if active: has data at the latest available index (positive = in this circle)
      const isActive = fans.length > maxIndexWithData && fans[maxIndexWithData] > 0;
      
      // Find last non-zero fan count (using absolute values)
      let lastFanCount = 0;
      let lastIndex = -1;
      for (let i = absFans.length - 1; i >= 0; i--) {
        if (absFans[i] > 0) {
          lastFanCount = absFans[i];
          lastIndex = i;
          break;
        }
      }
      // Find first non-zero fan count for monthly gain baseline
      let firstFanCount = 0;
      let firstIndex = -1;
      for (let i = 0; i < absFans.length; i++) {
        if (absFans[i] > 0) {
          firstFanCount = absFans[i];
          firstIndex = i;
          break;
        }
      }
      // Check if next_month_start is available (final value at end of month)
      const hasNextMonthStart = m.next_month_start != null && m.next_month_start > 0;
      // Calculate prior circle gain
      // Prior circle days: consecutive negative values at the start
      // Find the last prior-circle day and the first current-circle day
      let priorCircleGain = 0;
      let lastPriorIndex = -1;
      let firstCurrentIndex = -1;
      for (let i = 0; i < fans.length; i++) {
        if (fans[i] < 0) {
          lastPriorIndex = i;
        } else if (fans[i] > 0 && firstCurrentIndex === -1) {
          firstCurrentIndex = i;
        }
      }
      if (lastPriorIndex >= 0 && firstCurrentIndex >= 0) {
        // Prior contribution = everything from month start until first current-club data point
        // This includes the transition gap (e.g. missing days between prior and current club)
        // since we can't attribute that gain to the current club
        const firstCurrentValue = absFans[firstCurrentIndex];
        priorCircleGain = firstCurrentValue - firstFanCount;
      }
      
      // Whether next_month_start can serve as the "next day" value for this member's last snapshot.
      // Requires the member to be active and their last data point to be at the very end of the
      // daily_fans array, meaning next_month_start = value at the close of that final recorded day.
      const canUseNextMonthStart = hasNextMonthStart;
      // Use the actual days in month (e.g. 28 for February) so short months aren't treated as 31-day months.
      const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
      // Effective latest index/value: one day beyond the last recorded snapshot when possible.
      const effectiveLatestIndex = canUseNextMonthStart ? daysInMonth : lastIndex;
      const effectiveLatestValue = canUseNextMonthStart ? m.next_month_start! : lastFanCount;
      // fan_count: expose the true latest fan count (includes last-day delta when available)
      const fanCountForDisplay = effectiveLatestValue;
      // Calculate daily gain
      let dailyGain = 0;
      let priorInDaily = 0;
      if (isActive) {
        if (canUseNextMonthStart) {
          // Last day's gain = next_month_start minus the last recorded daily snapshot
          dailyGain = m.next_month_start! - lastFanCount;
          if (lastPriorIndex >= 0 && (isPriorCircle[lastIndex] || false)) {
            priorInDaily = dailyGain;
          }
        } else if (lastIndex >= 0) {
          let prevNonZeroValue = 0;
          let prevNonZeroIndex = -1;
          for (let i = lastIndex - 1; i >= 0; i--) {
            if (absFans[i] > 0) {
              prevNonZeroValue = absFans[i];
              prevNonZeroIndex = i;
              break;
            }
          }
          if (prevNonZeroValue > 0) {
            dailyGain = lastFanCount - prevNonZeroValue;
            if (lastPriorIndex >= 0) {
              const lastIsPrior = isPriorCircle[lastIndex] || false;
              const prevIsPrior = prevNonZeroIndex >= 0 && (isPriorCircle[prevNonZeroIndex] || false);
              if (lastIsPrior || prevIsPrior) priorInDaily = dailyGain;
            }
          } else if (lastFanCount > 0) {
            dailyGain = lastFanCount;
          }
        }
      }
      // Calculate Monthly Gain (total contribution including prior circle)
      // Use next_month_start / effectiveLatestValue as the final value when available
      let monthlyGain = 0;
      if (effectiveLatestValue > 0 && firstFanCount > 0) {
        monthlyGain = effectiveLatestValue - firstFanCount;
      }
      // Calculate Daily Avg (Month) — denominator includes the extra day from next_month_start
      let dailyAvg = 0;
      if (monthlyGain > 0 && effectiveLatestIndex > firstIndex) {
        const daySpan = effectiveLatestIndex - firstIndex;
        dailyAvg = monthlyGain / daySpan;
      }
      // Calculate 7 Day Avg — seed nonZeroValues with the synthetic next_month_start point
      let sevenDayAvg = 0;
      let weeklyGain = 0;
      let priorInWeekly = 0;
      if (isActive && lastIndex >= 0) {
        const nonZeroValues: { index: number; value: number; isPrior: boolean }[] = [];
        // Prepend the effective latest point (may be the synthetic next_month_start day)
        if (canUseNextMonthStart) {
          nonZeroValues.push({ index: daysInMonth, value: m.next_month_start!, isPrior: false });
        }
        for (let i = lastIndex; i >= 0 && nonZeroValues.length < 8; i--) {
          if (absFans[i] > 0) {
            nonZeroValues.push({ index: i, value: absFans[i], isPrior: isPriorCircle[i] || false });
          }
        }
        if (nonZeroValues.length >= 2) {
          const latest = nonZeroValues[0];
          const weekAgo = nonZeroValues[Math.min(7, nonZeroValues.length - 1)];
          const daysDiff = latest.index - weekAgo.index;
          if (daysDiff > 0) {
            sevenDayAvg = (latest.value - weekAgo.value) / daysDiff;
            weeklyGain = latest.value - weekAgo.value;
            if (lastPriorIndex >= 0 && lastPriorIndex >= weekAgo.index) {
              const windowPriorStart = Math.max(weekAgo.index, firstIndex);
              const windowPriorEnd = Math.min(lastPriorIndex, latest.index);
              if (windowPriorEnd >= windowPriorStart) {
                let priorStartVal = 0;
                let priorEndVal = 0;
                for (let i = windowPriorStart; i <= windowPriorEnd; i++) {
                  if (isPriorCircle[i] && absFans[i] > 0) {
                    if (priorStartVal === 0) priorStartVal = absFans[i];
                    priorEndVal = absFans[i];
                  }
                }
                if (priorEndVal > priorStartVal) priorInWeekly = priorEndVal - priorStartVal;
              }
            }
          }
        } else if (firstIndex >= 0 && effectiveLatestIndex > firstIndex) {
          const days = effectiveLatestIndex - firstIndex;
          sevenDayAvg = (effectiveLatestValue - firstFanCount) / days;
          weeklyGain = effectiveLatestValue - firstFanCount;
          if (lastPriorIndex >= 0) priorInWeekly = priorCircleGain;
        }
      }
      // Calculate Projected Monthly
      let projectedMonthly = 0;
      const currentDay = effectiveLatestIndex + 1; // 0-based → 1-based day number
      const remainingDays = Math.max(0, daysInMonth - currentDay);
      if (sevenDayAvg > 0) {
        projectedMonthly = (sevenDayAvg * remainingDays) + monthlyGain;
      } else if (monthlyGain > 0 && effectiveLatestIndex > firstIndex) {
        const days = effectiveLatestIndex - firstIndex;
        projectedMonthly = (monthlyGain / days * remainingDays) + monthlyGain;
      }
      const memberObj = {
        trainer_id: m.viewer_id.toString(),
        name: m.trainer_name,
        fan_count: fanCountForDisplay,
        last_updated: m.last_updated,
        role: this.getMemberRole(m),
        daily_gain: dailyGain,
        monthly_gain: monthlyGain,
        seven_day_avg: sevenDayAvg,
        daily_avg: dailyAvg,
        weekly_gain: weeklyGain,
        projected_monthly: projectedMonthly,
        priorCircleGain: priorCircleGain,
        priorInDaily: priorInDaily,
        priorInWeekly: priorInWeekly,
        hasPriorCircleData: lastPriorIndex >= 0,
        isActive: isActive
      };
      if (isActive) {
        activeMembers.push(memberObj);
      } else {
        inactiveMembers.push(memberObj);
      }
    });
    this.members = [...activeMembers, ...inactiveMembers];
    this.sortMembers();
    // Compute monthly point from active member data only
    this.computedMonthlyPoint = activeMembers.reduce((sum: number, m: any) => sum + (m.monthly_gain || 0), 0);
    
    // For the chart, we only want to show ACTIVE members to avoid clutter
    
    // For the chart, we only want to show ACTIVE members to avoid clutter
    // Filter for members who have data at the latest index
    this.rawMemberData = dataToProcess.filter(m => {
        if (!m.daily_fans || m.daily_fans.length === 0) return false;
        // Check if member has any data at all (positive or negative)
        const hasAnyData = m.daily_fans.some(f => f !== 0);
        if (!hasAnyData) return false;
        // Check if member is active (has positive data at the latest point = in this circle)
        if (m.daily_fans.length > maxIndexWithData && m.daily_fans[maxIndexWithData] > 0) {
            return true;
        }
        return false;
    });
    
    // Process history for chart using ALL data (to keep circle total correct)
    this.processHistory(dataToProcess);
    // Rebuild calendar if currently viewing it
    if (this.memberViewMode === 'calendar') {
      this.buildCalendarData();
    }
  }
  processHistory(membersData: CircleMemberMonthlyData[]): void {
    if (!membersData || !membersData.length) {
      console.warn('No members data for history');
      this.history = [];
      return;
    }
    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    this.history = [];
    // Build delta-based cumulative progression
    // This sums individual member deltas per day (excludes join/leave effects)
    let cumulativeTotal = 0;
    let baselineSet = false;
    for (let day = 0; day < daysInMonth; day++) {
      let hasData = false;
      let dayDelta = 0;
      let dayAbsTotal = 0;
      membersData.forEach(m => {
        if (!m.daily_fans || m.daily_fans[day] <= 0) return; // Only count positive = current circle
        hasData = true;
        dayAbsTotal += m.daily_fans[day];
        // Find this member's previous positive (current circle) value
        let prevValue = 0;
        for (let p = day - 1; p >= 0; p--) {
          if (m.daily_fans[p] > 0) { prevValue = m.daily_fans[p]; break; }
        }
        if (prevValue > 0) {
          dayDelta += m.daily_fans[day] - prevValue;
        }
      });
      if (hasData) {
        if (!baselineSet) {
          cumulativeTotal = dayAbsTotal;
          baselineSet = true;
        } else {
          cumulativeTotal += dayDelta;
        }
        const date = new Date(this.currentYear, this.currentMonth - 1, day + 1);
        this.history.push({
          date: date.toISOString(),
          fan_count: cumulativeTotal
        });
      }
    }
    
  }
  changeMonth(delta: number): void {
    let newMonth = this.currentMonth + delta;
    let newYear = this.currentYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    this.currentMonth = newMonth;
    this.currentYear = newYear;
    
    if (this.circleId) {
      this.loadData(this.circleId);
    }
    // Recalculate zoom after data reload renders
    setTimeout(() => this.updateCalendarZoom(), 100);
  }
  initChart(): void {
    if (!this.chartCanvas) {
      console.error('Chart canvas not available');
      return;
    }
    
    if (!this.history || !this.history.length) {
      console.warn('No history data for chart');
      return;
    }
    if (this.chart) {
      this.chart.destroy();
    }
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.history.map(h => {
          const d = new Date(h.date);
          const day = d.getDate().toString().padStart(2, '0');
          const month = (d.getMonth() + 1).toString().padStart(2, '0');
          return `${day}.${month}`;
        }),
        datasets: [{
          label: 'Total Fans',
          data: this.history.map(h => h.fan_count),
          borderColor: '#64b5f6',
          backgroundColor: 'rgba(100, 181, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#121212',
          pointBorderColor: '#64b5f6',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              callback: (value) => {
                if (typeof value === 'number') {
                  return new Intl.NumberFormat('en', { notation: "compact", compactDisplay: "short" }).format(value);
                }
                return value;
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false,
            external: (context: any) => this.externalTooltipHandler(context),
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat(undefined).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        }
      }
    };
    this.chart = new Chart(ctx, config);
    ctx.canvas.removeEventListener('touchend', this._touchEndHandler);
    ctx.canvas.addEventListener('touchend', this._touchEndHandler, { passive: true });
  }
  initMemberChart(): void {
    if (!this.memberChartCanvas) {
      console.error('Member chart canvas not available');
      return;
    }
    
    if (!this.rawMemberData || !this.rawMemberData.length) {
      console.warn('No member data for chart');
      return;
    }
    if (this.memberChart) {
      this.memberChart.destroy();
    }
    const ctx = this.memberChartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get member chart canvas context');
      return;
    }
    // Determine how many days to show
    // We need to find the max index with data again, or store it.
    // Let's recalculate it quickly to be safe.
    let maxIndexWithData = 0;
    this.rawMemberData.forEach(m => {
        for (let i = m.daily_fans.length - 1; i >= 0; i--) {
            if (m.daily_fans[i] !== 0) {
                if (i > maxIndexWithData) maxIndexWithData = i;
                break;
            }
        }
    });
    
    // Gains are forward-shifted: gain on day d = fans[d] - fans[d-1]
    // fans[0] is the month-start baseline, so we can show maxIndexWithData days of gains
    // With next_month_start we get one more (the last day's gain)
    const anyHasNextMonthStart = this.rawMemberData.some(m => m.next_month_start != null && m.next_month_start > 0);
    // When next_month_start is available the month is fully complete, so always
    // show every day of the month (not just up to the last recorded snapshot index).
    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    const daysToShow = anyHasNextMonthStart ? daysInMonth : maxIndexWithData;
    // Generate labels (days 1 to N)
    const labels = Array.from({length: daysToShow}, (_, i) => {
      const day = (i + 1).toString().padStart(2, '0');
      const month = this.currentMonth.toString().padStart(2, '0');
      return `${day}.${month}`;
    });
    this.chartLegendItems = [];
    // Generate datasets
    const datasets = this.rawMemberData.map((member, index) => {
      // Simple color generation based on index
      const hue = (index * 137.508) % 360; // Golden angle approximation
      const color = `hsl(${hue}, 70%, 60%)`;
      
      this.chartLegendItems.push({
        name: member.trainer_name,
        color: color,
        hidden: false,
        datasetIndex: index
      });
      const data: (number | null)[] = [];
      const isCarriedForward: boolean[] = [];
      const isPriorCircle: boolean[] = []; // Track prior circle data points
      if (this.memberChartMode === 'delta') {
        // Delta mode: show daily fan gain (forward delta: next - current)
        // Gain on day i = fans[i+1] - fans[i], last day uses next_month_start
        const includePrior = this.config.includePriorClubData;
        for (let i = 0; i < daysToShow; i++) {
          const rawValue = member.daily_fans[i];
          // When prior club data excluded, treat negative values as missing
          const effectiveValue = (rawValue < 0 && !includePrior) ? 0 : Math.abs(rawValue);
          // Use shifted index (i+1) for prior circle check, matching cumulative mode
          const shiftedRaw = (i + 1 < member.daily_fans.length) ? member.daily_fans[i + 1] : 0;
          if (effectiveValue > 0) {
            // Find next non-zero value
            let nextAbsValue = 0;
            for (let j = i + 1; j < member.daily_fans.length; j++) {
              const nextRaw = member.daily_fans[j];
              if (nextRaw !== 0 && (nextRaw > 0 || includePrior)) {
                nextAbsValue = Math.abs(nextRaw);
                break;
              }
            }
            // If no next value, use next_month_start for last day
            if (nextAbsValue === 0 && member.next_month_start && member.next_month_start > 0) {
              nextAbsValue = member.next_month_start;
            }
            if (nextAbsValue > 0) {
              data.push(nextAbsValue - effectiveValue);
            } else {
              data.push(0);
            }
            isCarriedForward.push(false);
            isPriorCircle.push(includePrior && shiftedRaw < 0);
          } else {
            // Zero gap — check if there's future data
            let hasFutureData = false;
            for (let j = i + 1; j < member.daily_fans.length; j++) {
              const futureRaw = member.daily_fans[j];
              if (futureRaw !== 0 && (futureRaw > 0 || includePrior)) {
                hasFutureData = true;
                break;
              }
            }
            if (!hasFutureData && member.next_month_start && member.next_month_start > 0) {
              hasFutureData = true;
            }
            if (hasFutureData && data.length > 0 && data[data.length - 1] !== null) {
              // Mid-gap: carry forward last delta value, keep line visible
              data.push(data[data.length - 1]);
              isCarriedForward.push(false);
              isPriorCircle.push(false);
            } else {
              data.push(null);
              isCarriedForward.push(false);
              isPriorCircle.push(false);
            }
          }
        }
      } else {
        // Cumulative mode: total gain from month start
        // fans[0] = baseline (month start), fans[d] = state after day d
        // At label "Day d", show fans[d] - baseline using shifted index (i+1)
        const includePrior = this.config.includePriorClubData;
        let baseline = 0;
        const firstNonZero = member.daily_fans.find(v => v !== 0 && (v > 0 || includePrior));
        if (firstNonZero) { baseline = Math.abs(firstNonZero); }
        let lastKnownValue: number | null = null;
        for (let i = 0; i < daysToShow; i++) {
          const dataIdx = i + 1; // shifted: day 1 shows fans[1] - baseline
          let rawValue = 0;
          if (dataIdx < member.daily_fans.length) {
            rawValue = member.daily_fans[dataIdx];
          } else if (member.next_month_start && member.next_month_start > 0) {
            rawValue = member.next_month_start;
          }
          // Fallback: if rawValue is still 0 and there's no future non-zero data
          // in the array, use next_month_start (mirrors calendar/delta behaviour
          // for the last day of a short month like February).
          if (rawValue === 0 && member.next_month_start && member.next_month_start > 0) {
            let hasFutureFansData = false;
            for (let j = dataIdx + 1; j < member.daily_fans.length; j++) {
              const fr = member.daily_fans[j];
              if (fr !== 0 && (fr > 0 || includePrior)) { hasFutureFansData = true; break; }
            }
            if (!hasFutureFansData) {
              rawValue = member.next_month_start;
            }
          }
          // When prior club data excluded, treat negative values as missing
          const effectiveValue = (rawValue < 0 && !includePrior) ? 0 : Math.abs(rawValue);
          if (effectiveValue > 0) {
            const value = effectiveValue - baseline;
            data.push(value);
            isCarriedForward.push(false);
            isPriorCircle.push(includePrior && rawValue < 0);
            lastKnownValue = value;
          } else if (lastKnownValue !== null) {
            // Check if there's ANY future valid data point (not just the next one)
            let hasFutureData = false;
            for (let j = dataIdx + 1; j < member.daily_fans.length; j++) {
              const futureRaw = member.daily_fans[j];
              if (futureRaw !== 0 && (futureRaw > 0 || includePrior)) {
                hasFutureData = true;
                break;
              }
            }
            if (!hasFutureData && member.next_month_start && member.next_month_start > 0) {
              hasFutureData = true;
            }
            if (hasFutureData) {
              // Mid-gap: carry forward and keep line visible
              data.push(lastKnownValue);
              isCarriedForward.push(false);
              isPriorCircle.push(false);
            } else {
              // Trailing gap: carry forward but hide line
              data.push(lastKnownValue);
              isCarriedForward.push(true);
              isPriorCircle.push(false);
            }
          } else {
            data.push(null);
            isCarriedForward.push(false);
            isPriorCircle.push(false);
          }
        }
      }
      return {
        label: member.trainer_name,
        data: data,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        spanGaps: false,
        segment: {
          borderColor: (ctx: any) => {
            // Hide line segments going INTO carried-forward values (missing raw data)
            const p1Index = ctx.p1DataIndex;
            if (p1Index !== undefined && isCarriedForward[p1Index]) {
              return 'transparent';
            }
            return color;
          },
          borderDash: (ctx: any) => {
            // Dashed line for prior circle segments (only when includePriorClubData is on)
            if (!this.config.includePriorClubData) return [];
            const p0Index = ctx.p0DataIndex;
            const p1Index = ctx.p1DataIndex;
            if ((p0Index !== undefined && isPriorCircle[p0Index]) ||
                (p1Index !== undefined && isPriorCircle[p1Index])) {
              return [6, 4];
            }
            return [];
          }
        }
      };
    });
    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              callback: (value) => {
                if (typeof value === 'number') {
                  return new Intl.NumberFormat('en', { notation: "compact", compactDisplay: "short" }).format(value);
                }
                return value;
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false // Too many members to show legend
          },
          tooltip: {
            enabled: false,
            external: (context: any) => this.externalTooltipHandler(context),
            itemSort: (a, b) => b.parsed.y - a.parsed.y, // Sort tooltip by value desc
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) { label += ': '; }
                const dataIndex = context.dataIndex;
                const dataset = context.dataset;
                const currentVal = dataset.data[dataIndex] as number;
                if (currentVal === null || currentVal === undefined) return label;
                if (this.memberChartMode === 'delta') {
                  // Delta mode: value IS the daily delta
                  label += (currentVal > 0 ? '+' : '') + new Intl.NumberFormat(undefined).format(currentVal);
                } else {
                  // Cumulative mode: show total + daily delta
                  let dailyGain = 0;
                  if (dataIndex > 0) {
                    for (let i = dataIndex - 1; i >= 0; i--) {
                      const val = dataset.data[i];
                      if (val !== null && val !== undefined) {
                        dailyGain = currentVal - (val as number);
                        break;
                      }
                    }
                  }
                  label += new Intl.NumberFormat(undefined).format(currentVal);
                  if (dailyGain !== 0) {
                    label += ` (${dailyGain > 0 ? '+' : ''}${new Intl.NumberFormat(undefined).format(dailyGain)})`;
                  }
                }
                return label;
              }
            }
          }
        }
      }
    };
    this.memberChart = new Chart(ctx, config);
    ctx.canvas.removeEventListener('touchend', this._touchEndHandler);
    ctx.canvas.addEventListener('touchend', this._touchEndHandler, { passive: true });
  }
  toggleMemberVisibility(index: number): void {
    if (!this.memberChart) return;
    
    const isVisible = this.memberChart.isDatasetVisible(index);
    this.memberChart.setDatasetVisibility(index, !isVisible);
    this.memberChart.update();
    
    if (this.chartLegendItems[index]) {
      this.chartLegendItems[index].hidden = isVisible;
    }
  }
  onLegendItemDblClick(index: number): void {
    if (!this.memberChart) return;
    // If we are already isolated on this member, restore state
    if (this.isolatedMemberIndex === index) {
        this.restoreVisibilityState();
    } else {
        // Isolate this member
        this.isolateMember(index);
    }
  }
  private isolateMember(index: number): void {
    if (!this.memberChart) return;
    // Save current state if not already saved (i.e. if we are not switching from another isolation)
    if (this.previousVisibilityState === null) {
        this.previousVisibilityState = this.memberChart.data.datasets.map((_, i) => 
            this.memberChart!.isDatasetVisible(i)
        );
    }
    this.isolatedMemberIndex = index;
    // Hide all except index
    this.memberChart.data.datasets.forEach((_, i) => {
        const shouldBeVisible = i === index;
        this.memberChart!.setDatasetVisibility(i, shouldBeVisible);
        if (this.chartLegendItems[i]) {
            this.chartLegendItems[i].hidden = !shouldBeVisible;
        }
    });
    this.memberChart.update();
  }
  private restoreVisibilityState(): void {
    if (!this.memberChart || !this.previousVisibilityState) return;
    this.previousVisibilityState.forEach((isVisible, i) => {
        this.memberChart!.setDatasetVisibility(i, isVisible);
        if (this.chartLegendItems[i]) {
            this.chartLegendItems[i].hidden = !isVisible;
        }
    });
    this.previousVisibilityState = null;
    this.isolatedMemberIndex = null;
    this.memberChart.update();
  }
  highlightMember(index: number, highlight: boolean): void {
    if (!this.memberChart) return;
    
    const datasets = this.memberChart.data.datasets;
    
    if (highlight) {
        datasets.forEach((dataset: any, i) => {
            if (i === index) {
                // Highlighted member
                dataset.borderWidth = 4;
                dataset.borderColor = this.chartLegendItems[i].color; // Ensure full color
                dataset.order = -1; // Bring to front
            } else {
                // Dim others
                // We can use a transparent version of their color or just a generic dim color
                // Let's try reducing opacity of their original color
                // Since we store HSL, we can change alpha
                // Or just set to a very transparent white/grey to make them fade into background
                dataset.borderColor = 'rgba(255, 255, 255, 0.15)'; 
                dataset.borderWidth = 1;
                dataset.order = 0;
            }
        });
    } else {
        // Restore all
        datasets.forEach((dataset: any, i) => {
            dataset.borderWidth = 2;
            dataset.borderColor = this.chartLegendItems[i].color;
            dataset.order = 0;
        });
    }
    
    this.memberChart.update('none');
  }
  /**
   * Shifted-delta: result[i] = fans[i+1] - fans[i] (skip-zero aware).
   * result.length = fans.length - 1.
   *
   * Callers should pass buildEffectiveFans(...) so the next_month_start value
   * occupies the first empty slot and the last delta covers it.
   */
  /**
   * Build the effective fans array used for Day columns and delta calculation.
   * `next_month_start` is written into the slot immediately after the last
   * non-zero entry (i.e. the first trailing-zero slot), so it never pads the
   * array beyond the natural month length + 1.
   */
  private buildEffectiveFans(dailyFans: number[], nextMonthStart?: number): number[] {
    if (!nextMonthStart || nextMonthStart <= 0) return dailyFans;
    const lastNonZero = dailyFans.reduce((idx, v, i) => Math.abs(v) > 0 ? i : idx, -1);
    const insertAt = lastNonZero + 1;          // first slot after last real data
    const result = [...dailyFans];
    if (insertAt < result.length) {
      result[insertAt] = nextMonthStart;        // fill trailing-zero slot
    } else {
      result.push(nextMonthStart);              // all slots filled — append one
    }
    return result;
  }
  private computeDailyDelta(fans: number[]): (number | null)[] {
    const result: (number | null)[] = new Array(Math.max(0, fans.length - 1)).fill(null);
    for (let i = 0; i < fans.length - 1; i++) {
      const absNext = Math.abs(fans[i + 1]);
      if (absNext <= 0) continue;
      for (let p = i; p >= 0; p--) {
        const absPrev = Math.abs(fans[p]);
        if (absPrev > 0) { result[i] = absNext - absPrev; break; }
      }
    }
    return result;
  }
  exportStats(format: 'csv' | 'json' | 'xlsx'): void {
    if (!this.circle || !this.members.length) return;
    const c = this.config;
    const filename = `circle_${this.circle.circle_id}_${this.currentYear}_${this.currentMonth}_stats`;
    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    // ── Column spec: order + visibility respects current display settings ──────
    type ColSpec = { label: string; get: (m: CircleMember, idx: number) => string | number; sum: boolean };
    // The primary metric (selectedCalculation) is ALWAYS included as a column.
    const primarySpecMap: Record<CalculationType, ColSpec> = {
      monthly_gain:      { label: 'Monthly Gain',      get: m => m.monthly_gain ?? 0,                  sum: true  },
      weekly_gain:       { label: 'Weekly Gain',       get: m => m.weekly_gain ?? 0,                   sum: true  },
      daily_gain:        { label: 'Daily Gain',        get: m => m.daily_gain ?? 0,                    sum: true  },
      avg_daily_gain:    { label: '7 Day Avg',         get: m => Math.round(m.seven_day_avg ?? 0),     sum: true  },
      daily_avg:         { label: 'Daily Avg',         get: m => Math.round(m.daily_avg ?? 0),         sum: false },
      projected_monthly: { label: 'Projected Monthly', get: m => Math.round(m.projected_monthly ?? 0), sum: true  },
      total_fans:        { label: 'Total Fans',        get: m => m.fan_count,                          sum: true  },
    };
    const sel = c.selectedCalculation;
    const primarySpec = primarySpecMap[sel];
    // Prior club gain is relevant whenever the primary or explicitly-shown metric is monthly_gain
    const showPriorClub = c.includePriorClubData && (sel === 'monthly_gain' || c.showMonthlyGain);
    const cols: ColSpec[] = [
      { label: 'Rank',              get: (_, i) => i + 1,                                    sum: false },
      { label: 'Name',              get: m => m.name,                                         sum: false },
      { label: 'Trainer ID',        get: m => m.trainer_id,                                   sum: false },
      ...(c.showRole             ? [{ label: 'Role',              get: (m: CircleMember) => m.role,                               sum: false }] : []),
      { label: 'Status',            get: m => m.isActive ? 'Active' : 'Inactive',             sum: false },
      // Primary metric — always present (label automatically reflects selectedCalculation)
      primarySpec,
      // Additional metrics — only added if they are not already the primary
      ...(c.showMonthlyGain      && sel !== 'monthly_gain'      ? [{ label: 'Monthly Gain',      get: (m: CircleMember) => m.monthly_gain ?? 0,                  sum: true  }] : []),
      ...(c.showWeeklyGain       && sel !== 'weekly_gain'       ? [{ label: 'Weekly Gain',       get: (m: CircleMember) => m.weekly_gain ?? 0,                   sum: true  }] : []),
      ...(c.showDailyGain        && sel !== 'daily_gain'        ? [{ label: 'Daily Gain',        get: (m: CircleMember) => m.daily_gain ?? 0,                    sum: true  }] : []),
      ...(c.showSevenDayAvg      && sel !== 'avg_daily_gain'    ? [{ label: '7 Day Avg',         get: (m: CircleMember) => Math.round(m.seven_day_avg ?? 0),     sum: true  }] : []),
      ...(c.showDailyAvg         && sel !== 'daily_avg'         ? [{ label: 'Daily Avg',         get: (m: CircleMember) => Math.round(m.daily_avg ?? 0),         sum: false }] : []),
      ...(c.showProjectedMonthly && sel !== 'projected_monthly' ? [{ label: 'Projected Monthly', get: (m: CircleMember) => Math.round(m.projected_monthly ?? 0), sum: true  }] : []),
      ...(c.showTotalFans        && sel !== 'total_fans'        ? [{ label: 'Total Fans',        get: (m: CircleMember) => m.fan_count,                          sum: true  }] : []),
      ...(showPriorClub                                         ? [{ label: 'Prior Club Gain',   get: (m: CircleMember) => m.priorCircleGain ?? 0,               sum: true  }] : []),
      ...(c.showLastUpdated      ? [{ label: 'Last Updated',      get: (m: CircleMember) => m.last_updated ?? '',                 sum: false }] : []),
    ];
    if (format === 'json') {
      // ── JSON ─────────────────────────────────────────────────────────────────
      const enrichedMembers = this.members.map(m => {
        const rawData = this.allMemberData.find(d =>
          d.viewer_id.toString() === m.trainer_id &&
          d.year === this.currentYear && d.month === this.currentMonth
        ) ?? this.allMemberData.find(d => d.viewer_id.toString() === m.trainer_id);
        const dailyFans = rawData ? rawData.daily_fans : [];
        const effectiveFans = this.buildEffectiveFans(dailyFans, rawData?.next_month_start);
        const base: any = {
          ...m,
          daily_fans: effectiveFans.map(v => Math.abs(v)),
          daily_delta: this.computeDailyDelta(effectiveFans),
        };
        if (c.includePriorClubData) {
          base.daily_fans_raw    = dailyFans;
          base.prior_circle_days = dailyFans.map((v, i) => v < 0 ? i + 1 : null).filter(Boolean);
        }
        return base;
      });
      const content = JSON.stringify({
        export_config: c,
        circle: this.circle,
        members: enrichedMembers,
        history: this.history
      }, null, 2);
      this.downloadFile(content, `${filename}.json`, 'application/json');
    } else if (format === 'csv') {
      // ── CSV ──────────────────────────────────────────────────────────────────
      const memberRawData = this.members.map(m =>
        this.allMemberData.find(d =>
          d.viewer_id.toString() === m.trainer_id &&
          d.year === this.currentYear && d.month === this.currentMonth
        ) ?? this.allMemberData.find(d => d.viewer_id.toString() === m.trainer_id)
      );
      // effectiveFans: place next_month_start into the first empty slot after last data
      const memberEffectiveFans = memberRawData.map(raw => {
        const fans = raw ? raw.daily_fans : ([] as number[]);
        return this.buildEffectiveFans(fans, raw?.next_month_start);
      });
      // Day column count = longest effectiveFans (usually daysInMonth+1 for complete months)
      const dayColCount   = Math.max(daysInMonth, ...memberEffectiveFans.map(f => f.length));
      const deltaColCount = dayColCount - 1;
      const deltaHeaders = Array.from({ length: deltaColCount }, (_, i) => `Delta ${i + 1}`);
      const dayHeaders   = Array.from({ length: dayColCount   }, (_, i) => `Day ${i + 1}`);
      const headers = [
        ...cols.map(col => `"${col.label}"`),
        '',
        ...deltaHeaders,
        '',
        ...dayHeaders,
      ];
      const dataRows = this.members.map((m, idx) => {
        const eFans  = memberEffectiveFans[idx];
        const deltas = this.computeDailyDelta(eFans);
        const baseValues = cols.map(col => {
          const v = col.get(m, idx);
          return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v;
        });
        const deltaColumns = Array.from({ length: deltaColCount }, (_, i) => deltas[i] ?? '');
        const dailyColumns = Array.from({ length: dayColCount   }, (_, i) => {
          const v = eFans[i];
          return (v == null || v === 0) ? '' : Math.abs(v);
        });
        return [...baseValues, '', ...deltaColumns, '', ...dailyColumns].join(',');
      });
      // ── Totals row ────────────────────────────────────────────────────────
      const totalsBase = cols.map((col, i) => {
        if (!col.sum) return i === 0 ? '"TOTAL"' : '""';
        return this.members.reduce((acc, m, mi) => acc + (Number(col.get(m, mi)) || 0), 0);
      });
      const totalsDeltas = Array.from({ length: deltaColCount }, (_, d) =>
        memberEffectiveFans.reduce((acc, eFans) => acc + (this.computeDailyDelta(eFans)[d] ?? 0), 0) || ''
      );
      const totalsDays = Array.from({ length: dayColCount }, (_, d) =>
        memberEffectiveFans.reduce((acc, eFans) => acc + Math.abs(eFans[d] ?? 0), 0) || ''
      );
      const content = [
        headers.join(','),
        ...dataRows,
        [...totalsBase, '', ...totalsDeltas, '', ...totalsDays].join(','),
      ].join('\n');
      this.downloadFile(content, `${filename}.csv`, 'text/csv');
    } else {
      // ── XLSX (async, lazy-loaded) ─────────────────────────────────────────
      this.exportXlsx(filename, cols, daysInMonth);
    }
  }
  private async exportXlsx(
    filename: string,
    cols: { label: string; get: (m: CircleMember, idx: number) => string | number; sum: boolean }[],
    daysInMonth: number
  ): Promise<void> {
    const ExcelJSModule = await import('exceljs');
    // Bundlers (esbuild/Vite) may wrap CJS modules under .default at runtime
    const ExcelJS: typeof import('exceljs') = (ExcelJSModule as any).default ?? ExcelJSModule;
    const c = this.config;
    // Colour palette (dark-theme matching the app)
    const H_BG        = 'FF1B3A6B';  // dark blue — header background
    const H_FG        = 'FFFFFFFF';  // white     — header text
    const TOTALS_BG   = 'FF0D47A1';  // deeper blue — totals row
    const ROW_A       = 'FF16162A';  // base row
    const ROW_B       = 'FF1A1A32';  // alt row
    const INACTIVE    = 'FF2A1F1F';  // muted red  — inactive member
    const PRIOR_BG    = 'FF152215';  // dark green — prior-club day cell
    const PRIOR_FG    = 'FF81C784';  // light green text for prior-club cells
    const DAY_H_BG    = 'FF162244';  // day column header
    const DELTA_H_BG  = 'FF163044';  // delta column header
    const wb = new ExcelJS.Workbook();
    wb.creator = 'uma.moe';
    wb.created = new Date();
    // Pre-compute daily fans + next_month_start per member once
    const memberRawData = this.members.map(m =>
      this.allMemberData.find(d =>
        d.viewer_id.toString() === m.trainer_id &&
        d.year === this.currentYear && d.month === this.currentMonth
      ) ?? this.allMemberData.find(d => d.viewer_id.toString() === m.trainer_id)
    );
    // effectiveFans: place next_month_start into the first empty slot after last data
    const memberEffectiveFans = memberRawData.map(raw => {
      const fans = raw ? raw.daily_fans : ([] as number[]);
      return this.buildEffectiveFans(fans, raw?.next_month_start);
    });
    const dayColCount   = Math.max(daysInMonth, ...memberEffectiveFans.map(f => f.length));
    const deltaColCount = dayColCount - 1;
    // ── Sheet 1: Summary ────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Summary', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });
    ws1.addRow(cols.map(col => col.label));
    const hdr1 = ws1.getRow(1);
    hdr1.height = 22;
    hdr1.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: H_BG } };
      cell.font = { bold: true, color: { argb: H_FG }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF2979FF' } } };
    });
    this.members.forEach((m, idx) => {
      const rowData = cols.map(col => col.get(m, idx));
      const row = ws1.addRow(rowData);
      const bg  = !m.isActive ? INACTIVE : idx % 2 === 0 ? ROW_A : ROW_B;
      row.height = 20;
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { color: { argb: m.isActive ? H_FG : 'FF888888' }, size: 10 };
        cell.alignment = { vertical: 'middle' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });
    });
    // Totals row
    const totalsData = cols.map((col, i) => {
      if (!col.sum) return i === 0 ? 'TOTAL' : '';
      return this.members.reduce((acc, m, mi) => acc + (Number(col.get(m, mi)) || 0), 0);
    });
    const totRow1 = ws1.addRow(totalsData);
    totRow1.height = 22;
    totRow1.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTALS_BG } };
      cell.font = { bold: true, color: { argb: H_FG }, size: 11 };
      cell.alignment = { vertical: 'middle' };
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
    // Auto column widths
    ws1.columns.forEach((col, i) => {
      let max = cols[i]?.label.length ?? 8;
      this.members.forEach((m, mi) => {
        const v = String(cols[i].get(m, mi));
        if (v.length > max) max = v.length;
      });
      col.width = Math.min(max + 4, 30);
    });
    // ── Sheet 2: Daily Data ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Daily Data', {
      views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }]
    });
    const dayHdrs   = Array.from({ length: dayColCount   }, (_, i) => `Day ${i + 1}`);
    const deltaHdrs = Array.from({ length: deltaColCount }, (_, i) => `Δ${i + 1}`);
    ws2.addRow(['Rank', 'Name', ...dayHdrs, '', ...deltaHdrs]);
    const hdr2 = ws2.getRow(1);
    hdr2.height = 22;
    hdr2.eachCell((cell, col) => {
      const isDay   = col >= 3 && col <= 2 + dayColCount;
      const isDelta = col >= 4 + dayColCount;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isDelta ? DELTA_H_BG : isDay ? DAY_H_BG : H_BG } };
      cell.font = { bold: true, color: { argb: H_FG }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    this.members.forEach((m, idx) => {
      const eFans  = memberEffectiveFans[idx];
      const rawFans = memberRawData[idx]?.daily_fans ?? [];
      const deltas = this.computeDailyDelta(eFans);
      const absDay   = Array.from({ length: dayColCount   }, (_, d) => eFans[d] != null && eFans[d] !== 0 ? Math.abs(eFans[d]) : null);
      const deltaDay = Array.from({ length: deltaColCount }, (_, d) => deltas[d] != null ? deltas[d] : null);
      const row = ws2.addRow([idx + 1, m.name, ...absDay, null, ...deltaDay]);
      const bg  = !m.isActive ? INACTIVE : idx % 2 === 0 ? ROW_A : ROW_B;
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const dayOff  = colNum - 3;  // 0-based index into cumulative section
        const isPrior = c.includePriorClubData && dayOff >= 0 && dayOff < rawFans.length && (rawFans[dayOff] ?? 0) < 0;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isPrior ? PRIOR_BG : bg } };
        cell.font = { color: { argb: isPrior ? PRIOR_FG : m.isActive ? H_FG : 'FF666666' }, size: 10, italic: isPrior };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        }
      });
    });
    // Totals row for daily sheet
    const ws2Totals = ws2.addRow([
      'TOTAL', '',
      ...Array.from({ length: dayColCount   }, (_, d) => memberEffectiveFans.reduce((s, f) => s + Math.abs(f[d] ?? 0), 0) || null),
      null,
      ...Array.from({ length: deltaColCount }, (_, d) => memberEffectiveFans.reduce((s, f) => s + (this.computeDailyDelta(f)[d] ?? 0), 0) || null),
    ]);
    ws2Totals.height = 22;
    ws2Totals.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTALS_BG } };
      cell.font = { bold: true, color: { argb: H_FG }, size: 10 };
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
    ws2.getColumn(1).width = 6;
    ws2.getColumn(2).width = 18;
    for (let i = 3; i <= 2 + dayColCount; i++) ws2.getColumn(i).width = 7;
    ws2.getColumn(3 + dayColCount).width = 2;
    for (let i = 4 + dayColCount; i <= 3 + dayColCount + deltaColCount; i++) ws2.getColumn(i).width = 7;
    // ── Download ─────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    this.downloadBlob(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `${filename}.xlsx`
    );
  }
  private downloadFile(content: string, filename: string, type: string): void {
    this.downloadBlob(new Blob([content], { type }), filename);
  }
  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
