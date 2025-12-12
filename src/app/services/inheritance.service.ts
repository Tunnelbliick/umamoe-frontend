import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, map, catchError, of, switchMap } from 'rxjs';
import {
  InheritanceRecord,
  InheritanceSearchFilters,
  InheritanceSubmission,
  UmaMusumeCharacter
} from '../models/inheritance.model';
import { PaginatedResponse, SearchResult } from '../models/common.model';
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
  affinity_score: number;
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

interface VoteRequest {
  vote: number; // 1 for upvote, -1 for downvote
}

interface VoteResponse {
  upvotes: number;
  downvotes: number;
}

@Injectable({
  providedIn: 'root'
})
export class InheritanceService {
  private readonly apiUrl = '/api/v3'; // Updated to use v3 unified API
  private searchResults$ = new BehaviorSubject<SearchResult<InheritanceRecord> | null>(null);
  private characters$ = new BehaviorSubject<UmaMusumeCharacter[]>([]);

  constructor(private http: HttpClient, private turnstileService: TurnstileService) {
    this.loadCharacters();
  }

  // Health check endpoint
  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`)
      .pipe(
        catchError(error => {
          console.error('Health check failed:', error);
          throw error;
        })
      );
  }

  // Search inheritance records with V3 unified API
  searchInheritance(filters: InheritanceSearchFilters = {}, page: number = 0, pageSize: number = 20): Observable<SearchResult<InheritanceRecord>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', pageSize.toString())
      .set('search_type', 'inheritance');

    // Add trainer_id filter for direct trainer lookup
    if (filters.trainerId) {
      params = params.set('trainer_id', filters.trainerId);
    }

    // Add trainer_name filter for username search
    if (filters.trainerName) {
      params = params.set('trainer_name', filters.trainerName);
    }

    // Add character filter - support both character ID and character name
    if (filters.umaId) {
      params = params.set('main_parent_id', filters.umaId.toString());
    } else if (filters.characterId) {
      // Convert string character ID to number if needed
      const charId = parseInt(filters.characterId, 10);
      if (!isNaN(charId)) {
        params = params.set('main_parent_id', charId.toString());
      }
    }

    // Add player character filter
    if (filters.playerCharaId) {
      params = params.set('player_chara_id', filters.playerCharaId.toString());
    }

    // Add parent filters
    if (filters.parentLeftId) {
      params = params.set('parent_left_id', filters.parentLeftId.toString());
    }

    if (filters.parentRightId) {
      params = params.set('parent_right_id', filters.parentRightId.toString());
    }

    // Add rank and rarity filters
    if (filters.minParentRank !== undefined) {
      params = params.set('parent_rank', filters.minParentRank.toString());
    }

    if (filters.minParentRarity !== undefined) {
      params = params.set('parent_rarity', filters.minParentRarity.toString());
    }

    // Map individual spark filters to backend spark IDs (factorId + level)
    const blueSparkValues: number[] = [];
    const pinkSparkValues: number[] = [];
    const greenSparkValues: number[] = [];
    
    // Blue sparks (main stats) - factor IDs: 10, 20, 30, 40, 50
    if (filters.speedSpark) blueSparkValues.push(parseInt(`10${filters.speedSpark}`, 10));
    if (filters.staminaSpark) blueSparkValues.push(parseInt(`20${filters.staminaSpark}`, 10));
    if (filters.powerSpark) blueSparkValues.push(parseInt(`30${filters.powerSpark}`, 10));
    if (filters.gutsSpark) blueSparkValues.push(parseInt(`40${filters.gutsSpark}`, 10));
    if (filters.witSpark) blueSparkValues.push(parseInt(`50${filters.witSpark}`, 10));
    
    // Pink sparks (track/strategy aptitude) - factor IDs: 110, 120, 210, 220, 230, 240, 310, 320, 330, 340
    if (filters.turfSpark) pinkSparkValues.push(parseInt(`110${filters.turfSpark}`, 10));
    if (filters.dirtSpark) pinkSparkValues.push(parseInt(`120${filters.dirtSpark}`, 10));
    if (filters.frontRunnerSpark) pinkSparkValues.push(parseInt(`210${filters.frontRunnerSpark}`, 10));
    if (filters.paceChaserSpark) pinkSparkValues.push(parseInt(`220${filters.paceChaserSpark}`, 10));
    if (filters.lateSurgerSpark) pinkSparkValues.push(parseInt(`230${filters.lateSurgerSpark}`, 10));
    if (filters.endSpark) pinkSparkValues.push(parseInt(`240${filters.endSpark}`, 10));
    if (filters.sprintSpark) pinkSparkValues.push(parseInt(`310${filters.sprintSpark}`, 10));
    if (filters.mileSpark) pinkSparkValues.push(parseInt(`320${filters.mileSpark}`, 10));
    if (filters.middleSpark) pinkSparkValues.push(parseInt(`330${filters.middleSpark}`, 10));
    if (filters.longSpark) pinkSparkValues.push(parseInt(`340${filters.longSpark}`, 10));
    
    // Green sparks (unique skills) - use skill IDs from uniqueSkills array or skillLevels map
    if (filters.uniqueSkills && filters.uniqueSkills.length > 0) {
      if (filters.skillLevels) {
        // If skill levels are specified, send skillId + level (concatenated as string, then parsed)
        filters.uniqueSkills.forEach(skillId => {
          const level = filters.skillLevels![skillId] || 1; // Default to level 1 if not specified
          greenSparkValues.push(parseInt(`${skillId}${level}`, 10));
        });
      } else {
        // Just send the skill IDs as-is (legacy behavior)
        greenSparkValues.push(...filters.uniqueSkills);
      }
    }

    // Apply spark filters to params if any are selected
    if (blueSparkValues.length > 0) {
      params = params.append('blue_sparks', blueSparkValues.join(','));
    }
    
    if (pinkSparkValues.length > 0) {
      params = params.append('pink_sparks', pinkSparkValues.join(','));
    }
    
    if (greenSparkValues.length > 0) {
      params = params.append('green_sparks', greenSparkValues.join(','));
    }

    // Also support the array-based filters for backward compatibility
    if (filters.blueSparkFactors && filters.blueSparkFactors.length > 0) {
      const blueFactors = filters.blueSparkFactors.join(',');
      params = params.append('blue_sparks', blueFactors);
    }

    if (filters.pinkSparkFactors && filters.pinkSparkFactors.length > 0) {
      const pinkFactors = filters.pinkSparkFactors.join(',');
      params = params.append('pink_sparks', pinkFactors);
    }

    if (filters.greenSparkFactors && filters.greenSparkFactors.length > 0) {
      const greenFactors = filters.greenSparkFactors.join(',');
      params = params.append('green_sparks', greenFactors);
    }

    if (filters.whiteSparkFactors && filters.whiteSparkFactors.length > 0) {
      const whiteFactors = filters.whiteSparkFactors.join(',');
      params = params.append('white_sparks', whiteFactors);
    }

    // Support for AND logic groups (multiple filters of same type)
    if (filters.blueSparkGroups && filters.blueSparkGroups.length > 0) {
      filters.blueSparkGroups.forEach(group => {
        params = params.append('blue_sparks', group.join(','));
      });
    }

    if (filters.pinkSparkGroups && filters.pinkSparkGroups.length > 0) {
      filters.pinkSparkGroups.forEach(group => {
        params = params.append('pink_sparks', group.join(','));
      });
    }

    if (filters.greenSparkGroups && filters.greenSparkGroups.length > 0) {
      filters.greenSparkGroups.forEach(group => {
        params = params.append('green_sparks', group.join(','));
      });
    }

    if (filters.whiteSparkGroups && filters.whiteSparkGroups.length > 0) {
      filters.whiteSparkGroups.forEach(group => {
        params = params.append('white_sparks', group.join(','));
      });
    }

    // Main Parent Factors
    if (filters.mainParentBlueSparks && filters.mainParentBlueSparks.length > 0) {
      params = params.set('main_parent_blue_sparks', filters.mainParentBlueSparks.join(','));
    }

    if (filters.mainParentPinkSparks && filters.mainParentPinkSparks.length > 0) {
      params = params.set('main_parent_pink_sparks', filters.mainParentPinkSparks.join(','));
    }

    if (filters.mainParentGreenSparks && filters.mainParentGreenSparks.length > 0) {
      params = params.set('main_parent_green_sparks', filters.mainParentGreenSparks.join(','));
    }

    if (filters.mainParentWhiteSparks && filters.mainParentWhiteSparks.length > 0) {
      params = params.set('main_parent_white_sparks', filters.mainParentWhiteSparks.join(','));
    }

    // Optional White Factors (for scoring/sorting, no level required)
    if (filters.optionalWhiteSparks && filters.optionalWhiteSparks.length > 0) {
      params = params.set('optional_white_sparks', filters.optionalWhiteSparks.join(','));
    }

    if (filters.optionalMainWhiteSparks && filters.optionalMainWhiteSparks.length > 0) {
      params = params.set('optional_main_white_sparks', filters.optionalMainWhiteSparks.join(','));
    }

    if (filters.minMainBlueFactors !== undefined) {
      params = params.set('min_main_blue_factors', filters.minMainBlueFactors.toString());
    }

    if (filters.minMainPinkFactors !== undefined) {
      params = params.set('min_main_pink_factors', filters.minMainPinkFactors.toString());
    }

    if (filters.minMainGreenFactors !== undefined) {
      params = params.set('min_main_green_factors', filters.minMainGreenFactors.toString());
    }

    if (filters.minMainWhiteCount !== undefined) {
      params = params.set('min_main_white_count', filters.minMainWhiteCount.toString());
    }

    // Add minimum filters
    if (filters.minWinCount !== undefined) {
      params = params.set('min_win_count', filters.minWinCount.toString());
    }

    if (filters.minWhiteCount !== undefined) {
      params = params.set('min_white_count', filters.minWhiteCount.toString());
    }

    // Support Card Filters
    if (filters.supportCardId !== undefined) {
      params = params.set('support_card_id', filters.supportCardId.toString());
    }

    if (filters.minLimitBreak !== undefined) {
      params = params.set('min_limit_break', filters.minLimitBreak.toString());
    }

    // Add sorting parameters
    if (filters.sortBy) {
      params = params.set('sort_by', this.mapSortByToBackend(filters.sortBy));
    }

    if (filters.sortOrder) {
      params = params.set('sort_order', filters.sortOrder);
    }

    // Add follower limit for active users (default to 1000 to get active users)
    if (filters.maxFollowerNum !== undefined) {
      params = params.set('max_follower_num', filters.maxFollowerNum.toString());
    } else {
      params = params.set('max_follower_num', '1000');
    }

    return this.http.get<V3SearchResult>(`${this.apiUrl}/search`, { params })
      .pipe(
        map(response => {
          
          const mappedItems = response.items
            .filter(item => item.inheritance !== null)
            .map(item => this.mapV3BackendToFrontend(item));
          
          const searchResult: SearchResult<InheritanceRecord> = {
            items: mappedItems,
            totalPages: response.total_pages,
            total: response.total,
            page: response.page,
            pageSize: response.limit
          };

          this.searchResults$.next(searchResult);
          return searchResult;
        }),
        catchError(error => {
          console.error('Error searching inheritance with V3 API:', error);
          const emptyResult: SearchResult<InheritanceRecord> = {
            items: [],
            totalPages: 0,
            total: 0,
            page: page,
            pageSize: pageSize
          };
          this.searchResults$.next(emptyResult);
          return of(emptyResult);
        })
      );
  }

  // Map V3 backend record to frontend format
  private mapV3BackendToFrontend(v3Record: V3UnifiedAccountRecord): InheritanceRecord {
    const inheritance = v3Record.inheritance!; // We filter for non-null inheritance above
    
    // Debug log to check affinity_score
    // console.log('Mapping record', v3Record.account_id, 'Affinity:', inheritance.affinity_score);

    return {
      id: inheritance.inheritance_id,
      account_id: v3Record.account_id,
      trainer_name: v3Record.trainer_name,
      umamusume_id: inheritance.main_parent_id,
      main_parent_id: inheritance.main_parent_id,
      parent_left_id: inheritance.parent_left_id,
      parent_right_id: inheritance.parent_right_id,
      parent_rank: inheritance.parent_rank,
      parent_rarity: inheritance.parent_rarity,
      blue_sparks: inheritance.blue_sparks,
      pink_sparks: inheritance.pink_sparks,
      green_sparks: inheritance.green_sparks,
      white_sparks: inheritance.white_sparks,
      win_count: inheritance.win_count,
      white_count: inheritance.white_count,
      affinity_score: (inheritance as any)['affinity_score'],
      main_blue_factors: inheritance.main_blue_factors,
      main_pink_factors: inheritance.main_pink_factors,
      main_green_factors: inheritance.main_green_factors,
      main_white_factors: inheritance.main_white_factors,
      main_white_count: inheritance.main_white_count,
      follower_num: v3Record.follower_num,
      last_updated: v3Record.last_updated,
      // Map support card data
      support_card_id: v3Record.support_card?.support_card_id,
      limit_break_count: v3Record.support_card?.limit_break_count ?? undefined,
      support_card_experience: v3Record.support_card?.experience,
      upvotes: 0, // V3 API doesn't include voting
      downvotes: 0,
      user_vote: null,
      character_name: '', // Will be populated by character lookup if needed
      character_image_url: ''
    };
  }

  // Submit new inheritance record
  submitInheritance(submission: InheritanceSubmission): Observable<any> {
    // Generate Turnstile token first, then submit with the token
    return this.turnstileService.generateTokenWithRetry().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'CF-Turnstile-Token': token
        });
        
        return this.http.post<any>(`${this.apiUrl}/inheritance`, submission, { headers });
      }),
      catchError(error => {
        console.error('Error submitting inheritance:', error);
        throw error;
      })
    );
  }

  // Get inheritance record by ID - V2 API uses numeric IDs
  getInheritanceById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/inheritance/${id}`)
      .pipe(
        catchError(error => {
          console.error('Error getting inheritance record:', error);
          throw error;
        })
      );
  }

  // Vote on inheritance record - V2 API uses numeric IDs
  voteOnInheritance(recordId: string, voteType: 'up' | 'down'): Observable<{ upvotes: number; downvotes: number }> {
    const voteRequest: VoteRequest = {
      vote: voteType === 'up' ? 1 : -1
    };

    // Generate Turnstile token first, then vote with the token
    return this.turnstileService.generateTokenWithRetry().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'CF-Turnstile-Token': token
        });
        
        return this.http.post<VoteResponse>(
          `${this.apiUrl}/inheritance/${recordId}/vote`,
          voteRequest,
          { headers }
        );
      }),
      catchError(error => {
        console.error('Error voting on inheritance:', error);
        throw error;
      })
    );
  }

  // Report trainer friend list as full - now creates a task immediately
  reportUserUnavailable(trainerId: string): Observable<{ success: boolean; report_count: number; task_created: boolean; message: string }> {
    // Generate Turnstile token first, then report with the token
    return this.turnstileService.generateTokenWithRetry().pipe(
      switchMap(token => {
        const headers = new HttpHeaders({
          'CF-Turnstile-Token': token
        });
        
        return this.http.post<{ success: boolean; report_count: number; task_created: boolean; message: string }>(
          `/api/tasks/report-unavailable/${trainerId}`, 
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

  // Track when a trainer ID is copied
  trackTrainerCopy(trainerId: string): Observable<{ success: boolean; copy_count: number; task_created: boolean }> {
    return this.http.post<{ success: boolean; copy_count: number; task_created: boolean }>(
      `/api/tasks/track-copy/${trainerId}`,
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
    return this.http.get<any>(`/api/tasks/trainer/${trainerId}/status`)
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

  // Get user's inheritance records
  // Note: This endpoint doesn't exist in the current backend API
  getUserInheritanceRecords(userId: string): Observable<InheritanceRecord[]> {
    // TODO: Implement this endpoint in the backend if needed
    console.warn('getUserInheritanceRecords endpoint not implemented in backend');
    return of([]);

    // When implemented in backend, use:
    // return this.http.get<InheritanceRecord[]>(`${this.apiUrl}/inheritance/user/${userId}`)
    //   .pipe(
    //     catchError(error => {
    //       console.error('Error getting user inheritance records:', error);
    //       return of([]);
    //     })
    //   );
  }

  // Get all Umamusume characters
  getCharacters(): Observable<UmaMusumeCharacter[]> {
    return this.characters$.asObservable();
  }

  // Load characters (would typically come from API)
  private loadCharacters(): void {
    // For now, load from local data
    // In production, this would come from your Rust backend
    const mockCharacters: UmaMusumeCharacter[] = [
      // This would be populated with actual character data
    ];
    this.characters$.next(mockCharacters);
  }

  // Get current search results
  getCurrentSearchResults(): Observable<SearchResult<InheritanceRecord> | null> {
    return this.searchResults$.asObservable();
  }

  // Clear search results
  clearSearchResults(): void {
    this.searchResults$.next(null);
  }

  // Map frontend sort options to backend sort fields
  private mapSortByToBackend(sortBy: string): string {
    console.log('Mapping sortBy:', sortBy); 
    const sortMapping: { [key: string]: string } = {
      'win_count': 'win_count',
      'white_count': 'white_count', 
      'score': 'parent_rank', // Map score to parent_rank in backend
      'submitted_at': 'last_updated', // Map submitted_at to last_updated in V2 API
      'follower_num': 'follower_num',
      'affinity_score': 'affinity_score'
    };
    return sortMapping[sortBy] || 'win_count';
  }
}
