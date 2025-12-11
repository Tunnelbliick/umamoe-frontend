import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay, map, tap } from 'rxjs';
import { Circle, CircleListEntry, CircleMember, CircleHistoryPoint, CircleSearchFilters, CircleDetailsResponse } from '../models/circle.model';
import { SearchResult } from '../models/common.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CircleService {
  private apiUrl = `${environment.apiUrl}/api/v4/circles`;
  
  // Caching
  private searchCache = new Map<string, { data: SearchResult<Circle>, timestamp: number }>();
  private detailsCache = new Map<string, { data: CircleDetailsResponse, timestamp: number }>();
  private CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  
  // State
  public listScrollPosition = 0;

  constructor(private http: HttpClient) { }

  searchCircles(filters: CircleSearchFilters): Observable<SearchResult<Circle>> {
    const cacheKey = JSON.stringify(filters);
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
      return of(cached.data);
    }

    let params = new HttpParams();
    
    if (filters.page !== undefined) {
      params = params.set('page', filters.page);
    }
    if (filters.pageSize !== undefined) {
      params = params.set('limit', filters.pageSize);
    }
    
    if (filters.name) params = params.set('name', filters.name);
    if (filters.query) params = params.set('query', filters.query);
    if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
    if (filters.sortOrder) params = params.set('sort_dir', filters.sortOrder);

    return this.http.get<any>(`${this.apiUrl}/list`, { params }).pipe(
      map(response => {
        // Handle response whether it's an array or an object with a list property
        const items = Array.isArray(response) ? response : (response.circles || response.list || []);
        const total = response.total || response.total_count || (Array.isArray(response) ? response.length : items.length);

        return {
          items: items,
          total: total,
          page: filters.page || 0,
          pageSize: filters.pageSize || 20,
          totalPages: Math.ceil(total / (filters.pageSize || 20))
        };
      }),
      tap(data => {
        this.searchCache.set(cacheKey, { data, timestamp: Date.now() });
      })
    );
  }

  getCircleDetails(id: string, year?: number, month?: number): Observable<CircleDetailsResponse> {
    const cacheKey = `${id}-${year || ''}-${month || ''}`;
    const cached = this.detailsCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < this.CACHE_DURATION)) {
      return of(cached.data);
    }

    let params = new HttpParams().set('circle_id', id);
    if (year) params = params.set('year', year);
    if (month) params = params.set('month', month);

    return this.http.get<CircleDetailsResponse>(this.apiUrl, { params }).pipe(
      tap(data => {
        this.detailsCache.set(cacheKey, { data, timestamp: Date.now() });
      })
    );
  }

  // Deprecated: Use getCircleDetails instead
  getCircleById(id: string): Observable<Circle | undefined> {
    return this.getCircleDetails(id).pipe(
      map(response => response.circle)
    );
  }

  getCircleMembers(circleId: string): Observable<CircleMember[]> {
    return of(Array.from({ length: 25 }, (_, i) => ({
      trainer_id: `${100000 + i}`,
      name: `Member ${i + 1}`,
      fan_count: Math.floor(Math.random() * 10000000),
      last_updated: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
      role: (i === 0 ? 'leader' : (i < 3 ? 'sub-leader' : 'member')) as 'leader' | 'sub-leader' | 'member'
    }))).pipe(delay(400));
  }

  getCircleHistory(circleId: string): Observable<CircleHistoryPoint[]> {
    const history: CircleHistoryPoint[] = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      history.push({
        date: date.toISOString(),
        fan_count: 500000000 - (i * 1000000) + Math.floor(Math.random() * 500000),
        rank: 10 + Math.floor(Math.random() * 5)
      });
    }
    return of(history).pipe(delay(600));
  }
}
