export interface PrecomputedCardData {
  id: number;
  name: string;
  type: number;
  rarity: number;
  scores: number[]; // Scores for LB0-LB4
  tiers: string[]; // Tiers for LB0-LB4
  powerProgression: {
    totalGrowthPercent: number;
    recommendedMinLB: number;
    powerSpike: string;
    tierProgression: any; // Can be null
  };
}

export interface PrecomputedTierlistData {
  metadata: {
    generatedAt: string;
    version: string;
    weights: any; // TierlistWeights
    globalReleaseFilterEnabled: boolean;
    globalLaunchDate: string;
    jpLaunchDate: string;
    catchupRate: number;
    gracePeriodDays: number;
  };
  cards: { [cardId: string]: PrecomputedCardData };
  typeData: {
    [type: string]: {
      totalCards: number;
      tierDistribution: { [tier: string]: number };
    };
  };
}

export interface PrecomputedProcessedCard {
  id: number;
  lb: number;
  score: number;
  info: any; // CardInfo - can be minimal for precomputed data
  char_name: string;
  powerProgression?: any;
}
