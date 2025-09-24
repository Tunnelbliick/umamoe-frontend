import { Injectable } from '@angular/core';
import { Observable, of, map, shareReplay } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { 
  PrecomputedTierlistData, 
  PrecomputedCardData 
} from '../models/precomputed-tierlist.model';

/**
 * Optimized service for accessing precomputed tierlist data
 * Loads data once and serves PrecomputedCardData directly without conversions
 */
@Injectable({
  providedIn: 'root'
})
export class TierlistOptimizedService {
  private precomputedData: PrecomputedTierlistData | null = null;
  private dataLoadingObservable: Observable<PrecomputedTierlistData> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Load precomputed tierlist data from assets (cached after first load)
   * Prevents multiple HTTP requests by using shareReplay
   */
  private loadData(): Observable<PrecomputedTierlistData> {
    // If data is already loaded, return it immediately
    if (this.precomputedData) {
      return of(this.precomputedData);
    }

    // If a request is already in progress, return the same observable
    if (this.dataLoadingObservable) {
      return this.dataLoadingObservable;
    }

    // Create new request with shareReplay to prevent duplicate requests
    this.dataLoadingObservable = this.http.get<PrecomputedTierlistData>('/assets/data/precomputed-tierlist.json').pipe(
      map(data => {
        this.precomputedData = data;
        this.dataLoadingObservable = null; // Clear the loading observable
        return data;
      }),
      shareReplay(1) // Share the result with all subscribers
    );

    return this.dataLoadingObservable;
  }

  /**
   * Get all cards for a specific type and limit break level
   */
  getCardsByType(type: number, limitBreak: number = 4): Observable<PrecomputedCardData[]> {
    return this.loadData().pipe(
      map(data => {
        const cards: PrecomputedCardData[] = [];

        Object.values(data.cards).forEach(card => {
          if (card.type === type && card.scores[limitBreak] > 0) {
            cards.push(card);
          }
        });

        // Sort by score descending
        return cards.sort((a, b) => b.scores[limitBreak] - a.scores[limitBreak]);
      })
    );
  }

  /**
   * Get all cards for a specific limit break level
   */
  getAllCards(limitBreak: number = 4): Observable<PrecomputedCardData[]> {
    return this.loadData().pipe(
      map(data => {
        const cards: PrecomputedCardData[] = [];

        Object.values(data.cards).forEach(card => {
          if (card.scores[limitBreak] > 0) {
            cards.push(card);
          }
        });

        // Sort by score descending
        return cards.sort((a, b) => b.scores[limitBreak] - a.scores[limitBreak]);
      })
    );
  }

  /**
   * Get a specific card by ID
   */
  getCardById(cardId: string | number): Observable<PrecomputedCardData | null> {
    return this.loadData().pipe(
      map(data => data.cards[cardId.toString()] || null)
    );
  }

  /**
   * Search cards by name
   */
  searchCardsByName(searchTerm: string): Observable<PrecomputedCardData[]> {
    return this.loadData().pipe(
      map(data => {
        const results: PrecomputedCardData[] = [];
        const lowerSearchTerm = searchTerm.toLowerCase();

        Object.values(data.cards).forEach(card => {
          if (card.name.toLowerCase().includes(lowerSearchTerm)) {
            results.push(card);
          }
        });

        return results.sort((a, b) => b.scores[4] - a.scores[4]); // Sort by LB4 score
      })
    );
  }

  /**
   * Calculate meta deck score using specific card IDs
   */
  calculateMetaDeckScore(deckCardIds: string[], limitBreak: number = 4): Observable<{ totalScore: number; cards: PrecomputedCardData[] }> {
    return this.loadData().pipe(
      map(data => {
        const cards: PrecomputedCardData[] = [];
        let totalScore = 0;

        deckCardIds.forEach(cardId => {
          const card = data.cards[cardId];
          if (card && card.scores[limitBreak] > 0) {
            cards.push(card);
            totalScore += card.scores[limitBreak];
          }
        });

        return { totalScore, cards };
      })
    );
  }

  /**
   * Get metadata about the precomputed data
   */
  getMetadata(): Observable<any> {
    return this.loadData().pipe(
      map(data => data.metadata)
    );
  }

  /**
   * Get type distribution data
   */
  getTypeData(): Observable<any> {
    return this.loadData().pipe(
      map(data => data.typeData)
    );
  }

  /**
   * Get tier distribution for a specific type
   */
  getTierDistribution(type: number): Observable<{ [tier: string]: number }> {
    return this.loadData().pipe(
      map(data => data.typeData[type]?.tierDistribution || {})
    );
  }

  /**
   * Check if data is loaded
   */
  isDataLoaded(): boolean {
    return this.precomputedData !== null;
  }

  /**
   * Clear cache (useful for refreshing data)
   */
  clearCache(): void {
    this.precomputedData = null;
    this.dataLoadingObservable = null;
  }
}
