import { Injectable } from '@angular/core';
import { Observable, of, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { SupportCardService } from './support-card.service';
import {
  TierlistWeights,
  ProcessedCard,
  DEFAULT_URA_WEIGHTS,
  MetaDeck,
  TIER_PERCENTILES
} from '../models/tierlist-calculation.model';
import {
  PrecomputedTierlistData,
  PrecomputedCardData
} from '../models/precomputed-tierlist.model';

interface ExtendedSupportCard {
  id: number;
  type: number;
  name: string;
  char_name: string;
  rarity: number;
  limit_break: number;
  rainbowSpecialty?: number;
  offSpecialty?: number;
  cardType?: number;
  index?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TierlistCalculationService {
  private precomputedData: PrecomputedTierlistData | null = null;

  constructor(
    private http: HttpClient,
    private supportCardService: SupportCardService
  ) {}

  /**
   * Load precomputed tierlist data from assets
   */
  private loadPrecomputedData(): Observable<PrecomputedTierlistData> {
    if (this.precomputedData) {
      return of(this.precomputedData);
    }

    return this.http.get<PrecomputedTierlistData>('/assets/data/precomputed-tierlist.json').pipe(
      map(data => {
        this.precomputedData = data;
        return data;
      })
    );
  }

  /**
   * Calculate tierlist for all released support cards with selected cards context
   */
  calculateTierlist(
    weights: TierlistWeights = DEFAULT_URA_WEIGHTS,
    selectedCards: ExtendedSupportCard[] = []
  ): Observable<ProcessedCard[]> {
    return this.loadPrecomputedData().pipe(
      map(data => {
        const processedCards: ProcessedCard[] = [];

        // Convert precomputed data to ProcessedCard format
        Object.values(data.cards).forEach((cardData: PrecomputedCardData) => {
          // Process all limit break levels (0-4)
          for (let lb = 0; lb <= 4; lb++) {
            const processedCard: ProcessedCard = {
              id: cardData.id.toString(),
              lb: lb,
              score: cardData.scores[lb],
              info: {
                starting_stats: [0, 0, 0, 0, 0], // Placeholder
                event_stats: [0, 0, 0, 0, 0, 0, 0, 0], // Placeholder
                non_rainbow_gains: [0, 0, 0, 0, 0, 0, 0], // Placeholder
                rainbow_gains: [0, 0, 0, 0, 0, 0, 0], // Placeholder
                race_bonus_gains: 0, // Placeholder
                skills_score: 0,
                linked_training_gains: [0, 0, 0, 0, 0], // Placeholder
                debug: undefined
              },
              char_name: cardData.name,
              powerProgression: {
                limitBreakProgression: cardData.scores.map((score, index) => ({
                  limitBreak: index,
                  score: score,
                  available: true,
                  card: null,
                  tier: cardData.tiers[index],
                  tierPercentile: this.getTierPercentile(cardData.tiers[index])
                })),
                powerSpikes: [], // Can be calculated if needed
                recommendedMinLB: cardData.powerProgression.recommendedMinLB,
                significantSpikes: [],
                tierProgression: cardData.powerProgression.tierProgression,
                totalProgression: {
                  lb0Score: cardData.scores[0],
                  lb4Score: cardData.scores[4],
                  totalIncrease: cardData.scores[4] - cardData.scores[0],
                  totalPercentIncrease: ((cardData.scores[4] - cardData.scores[0]) / cardData.scores[0]) * 100
                }
              }
            };

            processedCards.push(processedCard);
          }
        });

        // Sort by score descending
        return processedCards.sort((a, b) => b.score - a.score);
      })
    );
  }

  /**
   * Calculate tierlist for specific card type
   */
  calculateTierlistByType(type: number, meta_deck: MetaDeck, weights?: TierlistWeights): Observable<ProcessedCard[]> {
    return this.calculateTierlist(weights).pipe(
      map(allCards => {
        // Filter by type
        return allCards.filter(card => {
          // Get card type from precomputed data
          const cardData = this.precomputedData?.cards[card.id.toString()];
          return cardData?.type === type;
        });
      })
    );
  }

  /**
   * Calculate meta deck score using precomputed data
   */
  calculateMetaDeckScore(
    deckCardIds: string[], 
    weights: TierlistWeights = DEFAULT_URA_WEIGHTS
  ): Observable<{ totalScore: number; cards: ProcessedCard[] }> {
    return this.loadPrecomputedData().pipe(
      map(data => {
        const cards: ProcessedCard[] = [];
        let totalScore = 0;

        deckCardIds.forEach(cardId => {
          const cardData = data.cards[cardId];
          if (cardData) {
            // Use LB4 for meta deck calculation
            const lb = 4;
            const score = cardData.scores[lb];
            totalScore += score;

            const processedCard: ProcessedCard = {
              id: cardData.id.toString(),
              lb: lb,
              score: score,
              info: {
                starting_stats: [0, 0, 0, 0, 0],
                event_stats: [0, 0, 0, 0, 0, 0, 0, 0],
                non_rainbow_gains: [0, 0, 0, 0, 0, 0, 0],
                rainbow_gains: [0, 0, 0, 0, 0, 0, 0],
                race_bonus_gains: 0,
                skills_score: 0,
                linked_training_gains: [0, 0, 0, 0, 0],
                debug: undefined
              },
              char_name: cardData.name
            };

            cards.push(processedCard);
          }
        });

        return { totalScore, cards };
      })
    );
  }

  /**
   * Calculate power progression analysis for support cards
   */
  calculatePowerProgression(
    weights: TierlistWeights = DEFAULT_URA_WEIGHTS,
    selectedCards: ExtendedSupportCard[] = []
  ): Observable<any[]> {
    return this.loadPrecomputedData().pipe(
      map(data => {
        const progressionData: any[] = [];

        Object.values(data.cards).forEach((cardData: PrecomputedCardData) => {
          const progression = {
            id: cardData.id,
            name: cardData.name,
            type: cardData.type,
            rarity: cardData.rarity,
            scores: cardData.scores,
            tiers: cardData.tiers,
            powerProgression: cardData.powerProgression
          };

          progressionData.push(progression);
        });

        return progressionData.sort((a, b) => b.scores[4] - a.scores[4]);
      })
    );
  }

  /**
   * Get tier percentile from tier name
   */
  private getTierPercentile(tier: string): number {
    const tierInfo = TIER_PERCENTILES[tier as keyof typeof TIER_PERCENTILES];
    return tierInfo ? (tierInfo.min + tierInfo.max) / 2 : 0;
  }

  /**
   * Get metadata about the precomputed data
   */
  getMetadata(): Observable<any> {
    return this.loadPrecomputedData().pipe(
      map(data => data.metadata)
    );
  }

  /**
   * Get type distribution data
   */
  getTypeData(): Observable<any> {
    return this.loadPrecomputedData().pipe(
      map(data => data.typeData)
    );
  }

  /**
   * Get specific card data by ID
   */
  getCardById(cardId: string | number): Observable<PrecomputedCardData | null> {
    return this.loadPrecomputedData().pipe(
      map(data => data.cards[cardId.toString()] || null)
    );
  }

  /**
   * Search cards by name
   */
  searchCardsByName(searchTerm: string): Observable<PrecomputedCardData[]> {
    return this.loadPrecomputedData().pipe(
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
   * Get tierlist with only the highest limit break for each card
   */
  calculateTierlistHighestLB(): Observable<ProcessedCard[]> {
    return this.loadPrecomputedData().pipe(
      map(data => {
        const processedCards: ProcessedCard[] = [];

        Object.values(data.cards).forEach((cardData: PrecomputedCardData) => {
          // Use LB4 (highest limit break)
          const lb = 4;
          const processedCard: ProcessedCard = {
            id: cardData.id.toString(),
            lb: lb,
            score: cardData.scores[lb],
            info: {
              starting_stats: [0, 0, 0, 0, 0],
              event_stats: [0, 0, 0, 0, 0, 0, 0, 0],
              non_rainbow_gains: [0, 0, 0, 0, 0, 0, 0],
              rainbow_gains: [0, 0, 0, 0, 0, 0, 0],
              race_bonus_gains: 0,
              skills_score: 0,
              linked_training_gains: [0, 0, 0, 0, 0],
              debug: undefined
            },
            char_name: cardData.name,
            powerProgression: {
              limitBreakProgression: cardData.scores.map((score, index) => ({
                limitBreak: index,
                score: score,
                available: true,
                card: null,
                tier: cardData.tiers[index],
                tierPercentile: this.getTierPercentile(cardData.tiers[index])
              })),
              powerSpikes: [],
              recommendedMinLB: cardData.powerProgression.recommendedMinLB,
              significantSpikes: [],
              tierProgression: cardData.powerProgression.tierProgression,
              totalProgression: {
                lb0Score: cardData.scores[0],
                lb4Score: cardData.scores[4],
                totalIncrease: cardData.scores[4] - cardData.scores[0],
                totalPercentIncrease: ((cardData.scores[4] - cardData.scores[0]) / cardData.scores[0]) * 100
              }
            }
          };

          processedCards.push(processedCard);
        });

        return processedCards.sort((a, b) => b.score - a.score);
      })
    );
  }

  /**
   * Get cards for a specific limit break level
   */
  getTierlistByLimitBreak(limitBreak: number): Observable<ProcessedCard[]> {
    return this.loadPrecomputedData().pipe(
      map(data => {
        const processedCards: ProcessedCard[] = [];

        Object.values(data.cards).forEach((cardData: PrecomputedCardData) => {
          if (limitBreak >= 0 && limitBreak <= 4) {
            const processedCard: ProcessedCard = {
              id: cardData.id.toString(),
              lb: limitBreak,
              score: cardData.scores[limitBreak],
              info: {
                starting_stats: [0, 0, 0, 0, 0],
                event_stats: [0, 0, 0, 0, 0, 0, 0, 0],
                non_rainbow_gains: [0, 0, 0, 0, 0, 0, 0],
                rainbow_gains: [0, 0, 0, 0, 0, 0, 0],
                race_bonus_gains: 0,
                skills_score: 0,
                linked_training_gains: [0, 0, 0, 0, 0],
                debug: undefined
              },
              char_name: cardData.name,
              powerProgression: {
                limitBreakProgression: cardData.scores.map((score, index) => ({
                  limitBreak: index,
                  score: score,
                  available: true,
                  card: null,
                  tier: cardData.tiers[index],
                  tierPercentile: this.getTierPercentile(cardData.tiers[index])
                })),
                powerSpikes: [],
                recommendedMinLB: cardData.powerProgression.recommendedMinLB,
                significantSpikes: [],
                tierProgression: cardData.powerProgression.tierProgression,
                totalProgression: {
                  lb0Score: cardData.scores[0],
                  lb4Score: cardData.scores[4],
                  totalIncrease: cardData.scores[4] - cardData.scores[0],
                  totalPercentIncrease: ((cardData.scores[4] - cardData.scores[0]) / cardData.scores[0]) * 100
                }
              }
            };

            processedCards.push(processedCard);
          }
        });

        return processedCards.sort((a, b) => b.score - a.score);
      })
    );
  }
}
