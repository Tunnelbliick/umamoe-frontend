import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap, BehaviorSubject, tap, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
export interface TodayActivity {
  tasks_24h: number;
}
export interface DataFreshness {
  accounts_24h: number;
  accounts_7d: number;
  umas_tracked: number;
}
export interface StatsResponse {
  today: TodayActivity;
  freshness: DataFreshness;
}
export interface FriendlistReportResponse {
  success: boolean;
  message: string;
}
interface DailyTrackingInfo {
  lastVisitDate: string;
  visitorId: string;
}
@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private readonly apiUrl = `${environment.apiUrl}/api`;
  private stats$ = new BehaviorSubject<StatsResponse | null>(null);
  private visitorId: string;
  private readonly TRACKING_KEY = 'uma_daily_tracking';
  constructor(private http: HttpClient) {
    // Generate or retrieve visitor ID from localStorage
    this.visitorId = this.getOrCreateVisitorId();
    
    // Check and track daily visit on service initialization
    this.checkAndTrackDailyVisit();
    
    // Listen for visibility changes to track daily visits for users with permanent tabs
    this.setupVisibilityTracking();
  }
  private setupVisibilityTracking(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // User came back to the tab - check if it's a new day
          this.checkAndTrackDailyVisit();
        }
      });
    }
  }
  private getOrCreateVisitorId(): string {
    try {
      let visitorId = localStorage.getItem('visitorId');
      if (!visitorId) {
        visitorId = 'visitor_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('visitorId', visitorId);
      }
      return visitorId;
    } catch (e) {
      console.warn('Failed to access localStorage for visitorId:', e);
      return 'visitor_fallback_' + Date.now();
    }
  }
  private getTodayDateString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
  private getTrackingInfo(): DailyTrackingInfo | null {
    try {
      const stored = localStorage.getItem(this.TRACKING_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
  private setTrackingInfo(info: DailyTrackingInfo): void {
    try {
      localStorage.setItem(this.TRACKING_KEY, JSON.stringify(info));
    } catch (e) {
      console.warn('Failed to save tracking info:', e);
    }
  }
  private checkAndTrackDailyVisit(): void {
    const today = this.getTodayDateString();
    const trackingInfo = this.getTrackingInfo();
    // Check if we've already tracked today
    if (trackingInfo && trackingInfo.lastVisitDate === today) {
      // Already tracked today, no need to do anything
      return;
    }
    // New day or first visit - track it
    this.trackDailyVisit().subscribe({
      next: () => {
        // Update local tracking info on successful track
        this.setTrackingInfo({
          lastVisitDate: today,
          visitorId: this.visitorId
        });
      },
      error: (error) => {
        console.warn('Failed to track daily visit:', error);
      }
    });
  }
  // Track daily active user (called once per day per user)
  private trackDailyVisit(): Observable<any> {
    const payload = {
      visitorId: this.visitorId,
      date: this.getTodayDateString()
    };
    
    return this.http.post(`${this.apiUrl}/stats/daily-visit`, payload);
  }
  // Public method to manually check and track (useful for SPA route changes)
  ensureDailyTracking(): void {
    this.checkAndTrackDailyVisit();
  }
  // Get comprehensive stats
  getStats(days: number = 30): Observable<StatsResponse> {
    return this.http.get<StatsResponse>(`${this.apiUrl}/stats?days=${days}`)
      .pipe(
        tap(stats => this.stats$.next(stats)),
        catchError(error => {
          console.error('Failed to load stats:', error);
          // Return fallback stats
          const fallbackStats: StatsResponse = {
            today: { tasks_24h: 0 },
            freshness: {
              accounts_24h: 0,
              accounts_7d: 0,
              umas_tracked: 0,
            },
          };
          this.stats$.next(fallbackStats);
          return of(fallbackStats);
        })
      );
  }
  // Get today's stats only (clean JSON response)
  getTodayStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats/today`)
      .pipe(
        catchError(error => {
          console.error('Failed to load today stats:', error);
          return of(null);
        })
      );
  }
  // Get daily stats for graphing
  getDailyStats(days: number = 30): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/stats/daily?days=${days}`)
      .pipe(
        catchError(error => {
          console.error('Failed to load daily stats:', error);
          return of([]);
        })
      );
  }
  // Get current stats observable
  getStatsObservable(): Observable<StatsResponse | null> {
    return this.stats$.asObservable();
  }
  // Get current stats value
  getCurrentStats(): StatsResponse | null {
    return this.stats$.value;
  }
  // Clear stats cache
  clearStats(): void {
    this.stats$.next(null);
  }
  // Report a record as "friendlist full"
  reportFriendlistFull(recordId: string): Observable<FriendlistReportResponse> {
    return this.http.post<FriendlistReportResponse>(
      `${this.apiUrl}/inheritance/${recordId}/friendlist_full`,
      {}
    );
  }
  // Get live stats that refresh every 30 seconds
  getLiveStats(refreshInterval: number = 30000): Observable<StatsResponse> {
    return timer(0, refreshInterval).pipe(
      switchMap(() => this.getStats())
    );
  }
  // Get stats for specific time periods
  getWeeklyStats(): Observable<StatsResponse> {
    return this.getStats(7);
  }
  getMonthlyStats(): Observable<StatsResponse> {
    return this.getStats(30);
  }
  getQuarterlyStats(): Observable<StatsResponse> {
    return this.getStats(90);
  }
}
