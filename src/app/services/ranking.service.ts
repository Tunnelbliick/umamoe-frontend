import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import {
  MonthlyRankingsResponse, AlltimeRankingsResponse, GainsRankingsResponse,
  MonthlyRankingsParams, AlltimeRankingsParams, GainsRankingsParams
} from '../models/ranking.model';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class RankingService {
  private apiUrl = `${environment.apiUrl}/api/v4/rankings`;
  private monthlyCache = new Map<string, { data: MonthlyRankingsResponse, timestamp: number }>();
  private alltimeCache = new Map<string, { data: AlltimeRankingsResponse, timestamp: number }>();
  private gainsCache = new Map<string, { data: GainsRankingsResponse, timestamp: number }>();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  public listScrollPosition = 0;
  constructor(private http: HttpClient) { }
  getMonthlyRankings(params: MonthlyRankingsParams): Observable<MonthlyRankingsResponse> {
    const cacheKey = JSON.stringify(params);
    const cached = this.monthlyCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
      return of(cached.data);
    }
    let httpParams = new HttpParams();
    if (params.month !== undefined) httpParams = httpParams.set('month', params.month);
    if (params.year !== undefined) httpParams = httpParams.set('year', params.year);
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit);
    if (params.query) httpParams = httpParams.set('query', params.query);
    if (params.circle_id !== undefined) httpParams = httpParams.set('circle_id', params.circle_id);
    if (params.circle_name) httpParams = httpParams.set('circle_name', params.circle_name);
    return this.http.get<MonthlyRankingsResponse>(`${this.apiUrl}/monthly`, { params: httpParams }).pipe(
      tap(data => this.monthlyCache.set(cacheKey, { data, timestamp: Date.now() }))
    );
  }
  getAlltimeRankings(params: AlltimeRankingsParams): Observable<AlltimeRankingsResponse> {
    const cacheKey = JSON.stringify(params);
    const cached = this.alltimeCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
      return of(cached.data);
    }
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit);
    if (params.query) httpParams = httpParams.set('query', params.query);
    if (params.sort_by) httpParams = httpParams.set('sort_by', params.sort_by);
    if (params.circle_id !== undefined) httpParams = httpParams.set('circle_id', params.circle_id);
    if (params.circle_name) httpParams = httpParams.set('circle_name', params.circle_name);
    return this.http.get<AlltimeRankingsResponse>(`${this.apiUrl}/alltime`, { params: httpParams }).pipe(
      tap(data => this.alltimeCache.set(cacheKey, { data, timestamp: Date.now() }))
    );
  }
  getGainsRankings(params: GainsRankingsParams): Observable<GainsRankingsResponse> {
    const cacheKey = JSON.stringify(params);
    const cached = this.gainsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
      return of(cached.data);
    }
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page);
    if (params.limit !== undefined) httpParams = httpParams.set('limit', params.limit);
    if (params.sort_by) httpParams = httpParams.set('sort_by', params.sort_by);
    if (params.query) httpParams = httpParams.set('query', params.query);
    if (params.circle_id !== undefined) httpParams = httpParams.set('circle_id', params.circle_id);
    if (params.circle_name) httpParams = httpParams.set('circle_name', params.circle_name);
    return this.http.get<GainsRankingsResponse>(`${this.apiUrl}/gains`, { params: httpParams }).pipe(
      tap(data => this.gainsCache.set(cacheKey, { data, timestamp: Date.now() }))
    );
  }
}
