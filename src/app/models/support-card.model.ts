import { Scenario } from './inheritance.model';

export interface SupportCard {
  id: string;
  name: string;
  character: string;
  type: SupportCardType;
  rarity: Rarity;
  limitBreak: number;

  // Training stats
  trainingBonus: number;
  motivationBonus: number;
  friendshipBonus: number;
  raceBonus: number;
  statBonuses: StatBonuses;

  // Special properties
  specialtyRate: number;
  uniqueSpecialty: number;
  friendshipSpecialty: number;
  startingBond: number;

  // Display
  imageUrl: string;
}

export interface SupportCardShort {
  id: string;
  name: string;
  type: SupportCardType;
  rarity: Rarity;
  limitBreak: number;
  release_date: string;

  // Display
  imageUrl: string;
}

export interface SupportCardRecord {
  id: string;
  trainer_id: string;
  card_id: string;
  limit_break: number;
  rarity: Rarity;

  // Meta info
  submitted_at: Date;
  verified?: boolean;
  upvotes?: number;
  downvotes?: number;
}

export interface SupportCardRecordEnriched extends SupportCardRecord {
  cardName: string;
  cardType: SupportCardType;
  cardImageUrl: string;
}

// V2 API Response format
export interface SupportCardRecordV2 {
  account_id: string;
  support_card_id: number;
  limit_break_count: number;
  experience: number;
  trainer_name?: string;
  follower_num?: number;
  last_updated: string;
}

export interface SupportCardRecordV2Enriched extends SupportCardRecordV2 {
  cardName: string;
  cardType: SupportCardType;
  cardImageUrl: string;
  cardRarity: Rarity;
  // Inheritance data from V3 unified API
  inheritance?: {
    inheritance_id: number;
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
  };
}

export interface SupportCardSearchFilters {
  trainerId?: string; // Direct trainer lookup
  cardId?: string;
  type?: SupportCardType;
  rarity?: Rarity;
  minLimitBreak?: number;
  maxLimitBreak?: number; // V2 API
  minExperience?: number; // V2 API  
  maxFollowerNum?: number; // V2 API
  sortBy?: 'submittedAt' | 'experience' | 'limitBreak' | 'followerNum'; // V2 API expanded options
  sortOrder?: 'asc' | 'desc';
}

export interface SupportCardSubmission {
  userId: string;
  cardId: string;
  cardType: SupportCardType;
  rarity: Rarity;
  limitBreak: number;
}

export interface StatBonuses {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
  skill: number;
}

export enum SupportCardType {
  SPEED = 0,
  STAMINA = 1,
  POWER = 2,
  GUTS = 3,
  WISDOM = 4,
  FRIEND = 6
}

export enum Rarity {
  R = 1,
  SR = 2,
  SSR = 3
}

export interface TierlistRating {
  cardId: string;
  limitBreak: number;
  score: number;
  tier: TierRank;
  position: number;
}

export enum TierRank {
  S = 'S',
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F'
}

export interface CalculationWeights {
  scenario: ScenarioType;
  stats: StatBonuses;
  cap: number;
  trainingGains: number[][];
  bondPerDay: number;
  races: number[];
  motivation: number;
  umaBonus: number[];
  bonusSpec: number;
}

export enum ScenarioType {
  URA = 'URA',
  AOHARU = 'AOHARU',
  CLIMAX = 'CLIMAX',
  GRAND_MASTERS = 'GM',
  GRAND_LIVE = 'GL'
}

export interface OptimalDeck {
  scenario: ScenarioType;
  cards: SupportCard[];
  totalScore: number;
  averageScore: number;
}
