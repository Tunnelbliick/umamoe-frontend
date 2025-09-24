import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, catchError, of, shareReplay } from 'rxjs';
import { 
  SupportCardSimple, 
  SupportCardSearchFilter, 
  SupportCardSearchResult,
  SupportCardTypeString 
} from '../models/support-card-simple.model';

@Injectable({
  providedIn: 'root'
})
export class SupportCardDatabaseService {
  private readonly dataUrl = '/assets/data/support-cards-db.json';
  private supportCards$ = new BehaviorSubject<SupportCardSimple[]>([]);
  private cachedCards$: Observable<SupportCardSimple[]> | null = null;

  constructor(private http: HttpClient) {
    this.loadSupportCards();
  }

  /**
   * Load all support cards from the JSON database
   */
  private loadSupportCards(): void {
    if (!this.cachedCards$) {
      this.cachedCards$ = this.http.get<SupportCardSimple[]>(this.dataUrl)
        .pipe(
          map(cards => {
            // Sort by release date (newest first), then by id
            return cards.sort((a, b) => {
              const dateCompare = new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
              if (dateCompare !== 0) return dateCompare;
              return parseInt(b.id) - parseInt(a.id);
            });
          }),
          catchError(error => {
            console.error('Error loading support cards database:', error);
            return of([]);
          }),
          shareReplay(1) // Cache the result
        );
    }

    this.cachedCards$.subscribe(cards => {
      this.supportCards$.next(cards);
    });
  }

  /**
   * Get all support cards
   */
  getAllSupportCards(): Observable<SupportCardSimple[]> {
    return this.supportCards$.asObservable();
  }

  /**
   * Search support cards with filters
   */
  searchSupportCards(filters: SupportCardSearchFilter): Observable<SupportCardSearchResult> {
    return this.supportCards$.pipe(
      map(cards => {
        let filteredCards = [...cards];

        // Apply filters
        if (filters.name) {
          const searchTerm = filters.name.toLowerCase().trim();
          filteredCards = filteredCards.filter(card => 
            card.name.toLowerCase().includes(searchTerm)
          );
        }

        if (filters.type) {
          filteredCards = filteredCards.filter(card => 
            card.type === filters.type
          );
        }

        if (filters.rarity !== undefined) {
          filteredCards = filteredCards.filter(card => 
            card.rarity === filters.rarity
          );
        }

        if (filters.minReleaseDate) {
          const minDate = new Date(filters.minReleaseDate);
          filteredCards = filteredCards.filter(card => 
            new Date(card.release_date) >= minDate
          );
        }

        if (filters.maxReleaseDate) {
          const maxDate = new Date(filters.maxReleaseDate);
          filteredCards = filteredCards.filter(card => 
            new Date(card.release_date) <= maxDate
          );
        }

        return {
          cards: filteredCards,
          total: filteredCards.length,
          filters
        };
      })
    );
  }

  /**
   * Get support card by ID
   */
  getSupportCardById(id: string): Observable<SupportCardSimple | undefined> {
    return this.supportCards$.pipe(
      map(cards => cards.find(card => card.id === id))
    );
  }

  /**
   * Get support cards by type
   */
  getSupportCardsByType(type: SupportCardTypeString): Observable<SupportCardSimple[]> {
    return this.supportCards$.pipe(
      map(cards => cards.filter(card => card.type === type))
    );
  }

  /**
   * Get support cards by rarity
   */
  getSupportCardsByRarity(rarity: number): Observable<SupportCardSimple[]> {
    return this.supportCards$.pipe(
      map(cards => cards.filter(card => card.rarity === rarity))
    );
  }

  /**
   * Get unique types available in the database
   */
  getAvailableTypes(): Observable<SupportCardTypeString[]> {
    return this.supportCards$.pipe(
      map(cards => {
        const types = new Set<SupportCardTypeString>();
        cards.forEach(card => types.add(card.type));
        return Array.from(types).sort();
      })
    );
  }

  /**
   * Get unique rarities available in the database
   */
  getAvailableRarities(): Observable<number[]> {
    return this.supportCards$.pipe(
      map(cards => {
        const rarities = new Set<number>();
        cards.forEach(card => rarities.add(card.rarity));
        return Array.from(rarities).sort();
      })
    );
  }

  /**
   * Get statistics about the support card database
   */
  getDatabaseStats(): Observable<{
    totalCards: number;
    cardsByType: Record<SupportCardTypeString, number>;
    cardsByRarity: Record<number, number>;
    latestReleaseDate: string;
    oldestReleaseDate: string;
  }> {
    return this.supportCards$.pipe(
      map(cards => {
        const cardsByType: Record<SupportCardTypeString, number> = {
          speed: 0,
          stamina: 0,
          power: 0,
          guts: 0,
          intelligence: 0,
          friend: 0
        };

        const cardsByRarity: Record<number, number> = {
          1: 0,
          2: 0,
          3: 0
        };

        let latestDate = '';
        let oldestDate = '';

        cards.forEach((card, index) => {
          // Count by type
          cardsByType[card.type]++;
          
          // Count by rarity
          if (cardsByRarity[card.rarity] !== undefined) {
            cardsByRarity[card.rarity]++;
          }

          // Track date range
          if (index === 0 || card.release_date > latestDate) {
            latestDate = card.release_date;
          }
          if (index === 0 || card.release_date < oldestDate) {
            oldestDate = card.release_date;
          }
        });

        return {
          totalCards: cards.length,
          cardsByType,
          cardsByRarity,
          latestReleaseDate: latestDate,
          oldestReleaseDate: oldestDate
        };
      })
    );
  }

  /**
   * Refresh the support cards data
   */
  refreshData(): void {
    this.cachedCards$ = null;
    this.loadSupportCards();
  }
}
