import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, map, catchError, of, filter, switchMap } from 'rxjs';
import {
  SupportCard,
  SupportCardRecord,
  SupportCardSearchFilters,
  SupportCardSubmission,
  SupportCardType,
  Rarity,
  StatBonuses,
  SupportCardShort,
  SupportCardRecordEnriched,
  SupportCardRecordV2,
  SupportCardRecordV2Enriched
} from '../models/support-card.model';
import { PaginatedResponse, ApiResponse, SearchResult } from '../models/common.model';
import { SUPPORT_CARDS, getAllSupportCards, getSupportCardById as getCardById, getSupportCardsByIds } from '../data/support-cards.data';
import { TurnstileService } from './turnstile.service';

// V3 API interfaces
interface V3SearchResult {
  items: V3UnifiedAccountRecord[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface V3UnifiedAccountRecord {
  account_id: string;
  trainer_name: string;
  follower_num: number | null;
  last_updated: string | null;
  inheritance: V3InheritanceRecord | null;
  support_card: V3SupportCardRecord | null;
}

interface V3InheritanceRecord {
  inheritance_id: number;
  account_id: string;
  main_parent_id: number;
  parent_left_id: number;
  parent_right_id: number;
  parent_rank: number;
  parent_rarity: number;
  blue_sparks: number[];
  pink_sparks: number[];
  green_sparks: number[];
  white_sparks: number[];
  win_count: number;
  white_count: number;
  main_blue_factors: number;
  main_pink_factors: number;
  main_green_factors: number;
  main_white_factors: number[];
  main_white_count: number;
}

interface V3SupportCardRecord {
  account_id: string;
  support_card_id: number;
  limit_break_count: number | null;
  experience: number;
}

@Injectable({
  providedIn: 'root'
})
export class SupportCardService {
  private readonly apiUrl = '/api/v3'; // Updated to use v3 unified API
  private searchResults$ = new BehaviorSubject<SearchResult<SupportCardRecord> | null>(null);
  private supportCards$ = new BehaviorSubject<SupportCardShort[]>([]);

  constructor(private http: HttpClient, private turnstileService: TurnstileService) {
    // Load support cards from bundled data immediately
    this.supportCards$.next(getAllSupportCards());
  }

  // Map V3 backend response to frontend format
  private mapV3BackendToFrontend(
    response: V3SearchResult,
    filters: SupportCardSearchFilters,
    page: number,
    limit: number
  ): SearchResult<SupportCardRecordV2Enriched> {
    // Convert V3 unified records to V2 support card records with inheritance data
    const supportCardRecords: (SupportCardRecordV2 & { v3Data: V3UnifiedAccountRecord })[] = response.items
      .filter(item => item.support_card !== null)
      .map(item => ({
        account_id: item.account_id,
        trainer_name: item.trainer_name,
        follower_num: item.follower_num || 0,
        last_updated: item.last_updated || new Date().toISOString(),
        support_card_id: item.support_card!.support_card_id,
        limit_break_count: item.support_card!.limit_break_count || 0,
        experience: item.support_card!.experience,
        v3Data: item // Keep reference to full V3 data
      }));

    const enrichedResults = this.enrichtSupportCardRecordsV2WithInheritance(supportCardRecords);

    return {
      items: enrichedResults,
      totalPages: response.total_pages,
      total: response.total,
      page: response.page,
      pageSize: response.limit,
      filters,
      sortBy: filters.sortBy || 'submittedAt',
      sortOrder: filters.sortOrder || 'desc'
    };
  }

  // Search and filter support card records with enriched data
  searchSupportCardRecords(
    filters: SupportCardSearchFilters,
    page: number = 1,
    limit: number = 20
  ): Observable<SearchResult<SupportCardRecordEnriched>> {
    let params = new HttpParams()
      .set('page', (page - 1).toString()) // Convert to 0-based indexing for backend
      .set('limit', limit.toString());

    // Add filters to params
    if (filters.cardId) params = params.set('cardId', filters.cardId);
    if (filters.type !== undefined && filters.type !== null) {
      params = params.set('type', filters.type.toString());
    }
    if (filters.rarity !== undefined) params = params.set('rarity', filters.rarity.toString());
    if (filters.minLimitBreak !== undefined) params = params.set('minLimitBreak', filters.minLimitBreak.toString());
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params = params.set('sortOrder', filters.sortOrder);

    return this.http.get<any>(`${this.apiUrl}/api/support-cards/search`, { params })
      .pipe(
        map(response => {
          if (response && typeof response === 'object' && 'success' in response) {
            const apiResponse = response as any;
            if (apiResponse.success && apiResponse.data) {
              const rawResult = apiResponse.data as SearchResult<SupportCardRecord>;
              const enrichedResults = this.enrichtSupportCardRecords(rawResult.items);
              const result: SearchResult<SupportCardRecordEnriched> = {
                ...rawResult,
                items: enrichedResults
              };
              this.searchResults$.next(result);
              return result;
            }
            throw new Error(apiResponse.error || 'Failed to search support card records');
          }
          // Handle direct response format
          const rawResults = response.results || response || [];
          const enrichedResults = this.enrichtSupportCardRecords(rawResults);
          const result: SearchResult<SupportCardRecordEnriched> = {
            items: enrichedResults,
            totalPages: response.totalPages || 0,
            total: response.total || 0,
            filters,
            page: 0,
            pageSize: limit,
            sortBy: filters.sortBy || 'submittedAt',
            sortOrder: filters.sortOrder || 'desc'
          };
          this.searchResults$.next(result);
          return result;
        }),
        catchError(error => {
          console.error('Error searching support cards:', error);
          const result: SearchResult<SupportCardRecordEnriched> = {
            items: [],
            totalPages: 1,
            total: 0,
            page: 0,
            pageSize: limit,
            filters,
            sortBy: filters.sortBy || 'submittedAt',
            sortOrder: filters.sortOrder || 'desc'
          };
          this.searchResults$.next(result);
          return of(result);
        })
      );
  }

  // V3 unified search API for support cards
  searchSupportCardRecordsV2(
    filters: SupportCardSearchFilters,
    page: number = 1,
    limit: number = 20
  ): Observable<SearchResult<SupportCardRecordV2Enriched>> {
    const headers = new HttpHeaders()
      .set('Accept', 'application/json');

    let params = new HttpParams()
      .set('search_type', 'support_cards')
      .set('page', (page - 1).toString()) // Convert to 0-based indexing
      .set('limit', limit.toString());

    // Add trainer_id filter for direct trainer lookup
    if (filters.trainerId) {
      params = params.set('trainer_id', filters.trainerId);
    }

    // Map frontend filters to V3 backend parameters
    if (filters.cardId) {
      const cardId = parseInt(filters.cardId, 10);
      if (!isNaN(cardId)) {
        params = params.set('support_card_id', cardId.toString());
      }
    }

    if (filters.minLimitBreak !== undefined) {
      params = params.set('min_limit_break', filters.minLimitBreak.toString());
    }

    if (filters.maxLimitBreak !== undefined) {
      params = params.set('max_limit_break', filters.maxLimitBreak.toString());
    }

    if (filters.minExperience !== undefined) {
      params = params.set('min_experience', filters.minExperience.toString());
    }

    if (filters.maxFollowerNum !== undefined) {
      params = params.set('max_follower_num', filters.maxFollowerNum.toString());
    }

    // Map sorting parameters
    const sortByMapping: { [key: string]: string } = {
      'submittedAt': 'submitted_at',
      'experience': 'experience', 
      'limitBreak': 'limit_break_count',
      'followerNum': 'follower_num'
    };

    if (filters.sortBy && sortByMapping[filters.sortBy]) {
      params = params.set('sort_by', sortByMapping[filters.sortBy]);
    }

    if (filters.sortOrder) {
      params = params.set('sort_order', filters.sortOrder);
    }

    return this.http.get<V3SearchResult>(`${this.apiUrl}/search`, { headers, params })
      .pipe(
        map(response => this.mapV3BackendToFrontend(response, filters, page, limit)),
        catchError(error => {
          console.error('V3 search error:', error);
          const result: SearchResult<SupportCardRecordV2Enriched> = {
            items: [],
            totalPages: 1,
            total: 0,
            page: 0,
            pageSize: limit,
            filters,
            sortBy: filters.sortBy || 'submittedAt',
            sortOrder: filters.sortOrder || 'desc'
          };
          return of(result);
        })
      );
  }

  // Submit new support card record
  submitSupportCardRecord(submission: SupportCardSubmission): Observable<SupportCardRecord> {
    // Generate Turnstile token first, then submit with the token
    return this.turnstileService.generateTokenWithRetry().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'CF-Turnstile-Token': token
        });

        return this.http.post<SupportCardRecord>(`${this.apiUrl}/support-cards/submit`, submission, { headers });
      }),
      map(response => {
        // Handle direct response or ApiResponse wrapper
        if (response && typeof response === 'object' && 'success' in response) {
          const apiResponse = response as any;
          if (apiResponse.success && apiResponse.data) {
            return apiResponse.data;
          }
          throw new Error(apiResponse.error || 'Failed to submit support card record');
        }
        return response;
      }),
      catchError(error => {
        console.error('Error submitting support card:', error);
        throw error;
      })
    );
  }

  // Get support card record by ID
  getSupportCardRecordById(id: string): Observable<SupportCardRecord> {
    return this.http.get<ApiResponse<SupportCardRecord>>(`${this.apiUrl}/support-cards/record/${id}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.error || 'Failed to get support card record');
        })
      );
  }

  // Vote on support card record
  voteOnSupportCardRecord(recordId: string, voteType: 'up' | 'down'): Observable<{ upvotes: number; downvotes: number }> {
    // Generate Turnstile token first, then vote with the token
    return this.turnstileService.generateTokenWithRetry().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'CF-Turnstile-Token': token
        });

        return this.http.post<ApiResponse<{ upvotes: number; downvotes: number }>>(
          `${this.apiUrl}/support-cards/record/${recordId}/vote`,
          { voteType },
          { headers }
        );
      }),
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.error || 'Failed to vote');
      })
    );
  }

  // Get user's support card records
  getUserSupportCardRecords(userId: string): Observable<SupportCardRecord[]> {
    return this.http.get<ApiResponse<SupportCardRecord[]>>(`${this.apiUrl}/support-cards/user/${userId}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          return [];
        })
      );
  }

  // Get all support cards (master data)
  getSupportCards(): Observable<SupportCardShort[]> {
    return this.supportCards$.asObservable();
  }

  // Get support card by ID (master data)
  getSupportCardById(id: string): Observable<SupportCardShort | undefined> {
    return of(getCardById(id));
  }

  // Get current search results
  getCurrentSearchResults(): Observable<SearchResult<SupportCardRecord> | null> {
    return this.searchResults$.asObservable();
  }

  // Clear search results
  clearSearchResults(): void {
    this.searchResults$.next(null);
  }

  // Get support cards by type
  getSupportCardsByType(type: number): Observable<SupportCardShort[]> {
    return of(SUPPORT_CARDS.filter(card => card.type === type));
  }

  // Get support cards by character
  // Legacy methods for backward compatibility with existing tierlist code
  getAllCards(): Observable<SupportCardShort[]> {
    return this.getSupportCards();
  }

  getCardsByType(type: number): Observable<SupportCardShort[]> {
    return this.getSupportCardsByType(type);
  }

  getCardById(id: string): Observable<SupportCardShort | undefined> {
    return this.getSupportCardById(id);
  }

  /**
   * Get support cards that have been released globally by a specific date
   * Uses the timeline calculation logic similar to the character service
   * Includes a 2-day grace period for upcoming releases
   */
  getReleasedSupportCards(cutoffDate?: Date, gracePeriodDays: number = 2): Observable<SupportCardShort[]> {
    const globalReleaseDate = new Date('2025-06-26'); // Global game launch
    const baseCutoffDate = cutoffDate || new Date(); // Default to today

    // Add grace period to the cutoff date
    const effectiveCutoffDate = new Date(baseCutoffDate);
    effectiveCutoffDate.setDate(effectiveCutoffDate.getDate() + gracePeriodDays);

    return of(SUPPORT_CARDS.filter(card => {
      // Parse the card's JP release date
      const jpReleaseDate = new Date(card.release_date);
      if (isNaN(jpReleaseDate.getTime())) return false;

      // Calculate estimated global release date using timeline logic
      const estimatedGlobalDate = this.calculateGlobalReleaseDate(jpReleaseDate, globalReleaseDate);

      // Return true if the card should be released by the cutoff date (including grace period)
      return estimatedGlobalDate <= effectiveCutoffDate;
    }));
  }

  /**
   * Calculate estimated global release date based on timeline service logic
   * This mirrors the calculation used in character.service.ts
   */
  private calculateGlobalReleaseDate(jpDate: Date, globalLaunchDate: Date): Date {
    const jpLaunchDate = new Date('2021-02-24'); // JP game launch
    const catchupRate = 1 / 1.6; // Global is catching up at 1.6x speed

    // Days since JP launch
    const daysSinceJpLaunch = Math.floor((jpDate.getTime() - jpLaunchDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate adjusted days for global (faster release schedule)
    const adjustedDays = Math.floor(daysSinceJpLaunch * catchupRate);

    // Global release date = Global launch + adjusted days
    const globalDate = new Date(globalLaunchDate);
    globalDate.setDate(globalDate.getDate() + adjustedDays);
    globalDate.setHours(22, 0, 0, 0); // Normalize to start of the day

    return globalDate;
  }

  /**
   * Search support cards by name or character and apply release date filtering
   */
  searchReleasedSupportCards(query: string, cutoffDate?: Date, gracePeriodDays: number = 2): Observable<SupportCardShort[]> {
    return this.getReleasedSupportCards(cutoffDate, gracePeriodDays).pipe(
      map(cards => cards.filter(card =>
        card.name.toLowerCase().includes(query.toLowerCase()) ||
        card.id.toString().includes(query)
      ))
    );
  }

  /**
   * Get released support cards by type
   */
  getReleasedSupportCardsByType(type: number, cutoffDate?: Date, gracePeriodDays: number = 2): Observable<SupportCardShort[]> {
    return this.getReleasedSupportCards(cutoffDate, gracePeriodDays).pipe(
      map(cards => cards.filter(card => card.type === type))
    );
  }

  // Health check endpoint to verify backend connectivity
  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`)
      .pipe(
        catchError(error => {
          console.error('Health check failed:', error);
          throw error;
        })
      );
  }

  // Report user as unavailable/friend list full - now creates a task immediately
  reportUserUnavailable(trainerId: string): Observable<{ success: boolean; report_count: number; task_created: boolean; message: string }> {
    // Generate Turnstile token first, then report with the token
    return this.turnstileService.generateTokenWithRetry().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'CF-Turnstile-Token': token
        });

        return this.http.post<{ success: boolean; report_count: number; task_created: boolean; message: string }>(
          `${this.apiUrl}/tasks/report-unavailable/${trainerId}`, 
          {},
          { headers }
        );
      }),
      catchError(error => {
        console.error('Error reporting friend list full:', error);
        throw error;
      })
    );
  }

  // Track when a trainer ID is copied (for automatic re-checking)
  trackTrainerCopy(trainerId: string): Observable<{ success: boolean; copy_count: number; task_created: boolean }> {
    return this.http.post<{ success: boolean; copy_count: number; task_created: boolean }>(
      `${this.apiUrl}/tasks/track-copy/${trainerId}`,
      {}
    ).pipe(
      catchError(error => {
        console.error('Error tracking trainer copy:', error);
        // Don't throw error for tracking, just log it
        return of({ success: false, copy_count: 0, task_created: false });
      })
    );
  }

  // Get trainer availability status
  getTrainerStatus(trainerId: string): Observable<{
    trainer_id: string;
    available: boolean;
    follower_num?: number;
    status?: string;
    report_count: number;
    copy_count: number;
  }> {
    return this.http.get<any>(`${this.apiUrl}/tasks/trainer/${trainerId}/status`)
      .pipe(
        catchError(error => {
          console.error('Error getting trainer status:', error);
          return of({
            trainer_id: trainerId,
            available: true,
            status: 'unknown',
            report_count: 0,
            copy_count: 0
          });
        })
      );
  }

  private enrichtSupportCardRecords(records: SupportCardRecord[]): SupportCardRecordEnriched[] {

    if (!records || records.length === 0) {
      return [];
    }

    var cardids = records.map(record => record.card_id);
    console.log(records);
    const supportCards = getSupportCardsByIds(cardids);

    return records.map(record => {
      const card = supportCards.get(record.card_id);
      if (!card) {
        return {
          ...record,
          cardName: 'Unknown Card',
          cardType: SupportCardType.SPEED, // Default type
          cardRarity: Rarity.R, // Default rarity
          cardImageUrl: '/assets/images/support_card/half/support_card_s_unknown.png' // Placeholder image
        };
      }

      return {
        ...record,
        cardName: card.name,
        cardType: card.type,
        cardRarity: card.rarity,
        cardImageUrl: `/assets/images/support_card/half/support_card_s_${card.id}.png` // Placeholder image
      };
    });
  }

  private enrichtSupportCardRecordsV2(records: SupportCardRecordV2[]): SupportCardRecordV2Enriched[] {

    if (!records || records.length === 0) {
      return [];
    }

    var cardids = records.map(record => record.support_card_id.toString());
    console.log(records);
    const supportCards = getSupportCardsByIds(cardids);

    return records.map(record => {
      const card = supportCards.get(record.support_card_id.toString());
      if (!card) {
        return {
          ...record,
          cardName: 'Unknown Card',
          cardType: SupportCardType.SPEED, // Default type
          cardRarity: Rarity.R, // Default rarity
          cardImageUrl: '/assets/images/support_card/half/support_card_s_unknown.png' // Placeholder image
        };
      }

      return {
        ...record,
        cardName: card.name,
        cardType: card.type,
        cardRarity: card.rarity,
        cardImageUrl: `/assets/images/support_card/half/support_card_s_${card.id}.png` // Placeholder image
      };
    });
  }

  private enrichtSupportCardRecordsV2WithInheritance(records: (SupportCardRecordV2 & { v3Data: V3UnifiedAccountRecord })[]): SupportCardRecordV2Enriched[] {
    if (!records || records.length === 0) {
      return [];
    }

    var cardids = records.map(record => record.support_card_id.toString());
    const supportCards = getSupportCardsByIds(cardids);

    return records.map(record => {
      const card = supportCards.get(record.support_card_id.toString());
      const baseRecord = {
        account_id: record.account_id,
        trainer_name: record.trainer_name,
        follower_num: record.follower_num,
        last_updated: record.last_updated,
        support_card_id: record.support_card_id,
        limit_break_count: record.limit_break_count,
        experience: record.experience
      };

      if (!card) {
        return {
          ...baseRecord,
          cardName: 'Unknown Card',
          cardType: SupportCardType.SPEED, // Default type
          cardRarity: Rarity.R, // Default rarity
          cardImageUrl: '/assets/images/support_card/half/support_card_s_unknown.png', // Placeholder image
          inheritance: record.v3Data.inheritance || undefined
        };
      }

      return {
        ...baseRecord,
        cardName: card.name,
        cardType: card.type,
        cardRarity: card.rarity,
        cardImageUrl: `/assets/images/support_card/half/support_card_s_${card.id}.png`,
        inheritance: record.v3Data.inheritance || undefined
      };
    });
  }
}
