/**
 * Simplified Support Card Database Models
 * Reduced version containing only essential information: id, name, rarity, type, releasedate
 */

export interface SupportCardSimple {
  id: string;
  name: string;
  rarity: number; // 1 = R, 2 = SR, 3 = SSR
  type: SupportCardTypeString;
  release_date: string; // ISO date string
}

export type SupportCardTypeString = 
  | 'speed' 
  | 'stamina' 
  | 'power' 
  | 'guts' 
  | 'intelligence' 
  | 'friend';

export enum SupportCardTypeEnum {
  SPEED = 'speed',
  STAMINA = 'stamina',
  POWER = 'power',
  GUTS = 'guts',
  INTELLIGENCE = 'intelligence',
  FRIEND = 'friend'
}

export enum SupportCardRarity {
  R = 1,
  SR = 2,
  SSR = 3
}

export interface SupportCardSearchFilter {
  name?: string;
  type?: SupportCardTypeString;
  rarity?: number;
  minReleaseDate?: string;
  maxReleaseDate?: string;
}

export interface SupportCardSearchResult {
  cards: SupportCardSimple[];
  total: number;
  filters: SupportCardSearchFilter;
}

// Utility functions for working with support cards
export class SupportCardUtils {
  
  static getRarityName(rarity: number): string {
    switch (rarity) {
      case 1: return 'R';
      case 2: return 'SR';
      case 3: return 'SSR';
      default: return 'Unknown';
    }
  }

  static getTypeDisplayName(type: SupportCardTypeString): string {
    switch (type) {
      case 'speed': return 'Speed';
      case 'stamina': return 'Stamina';
      case 'power': return 'Power';
      case 'guts': return 'Guts';
      case 'intelligence': return 'Intelligence';
      case 'friend': return 'Friend';
      default: return 'Unknown';
    }
  }

  static getTypeColor(type: SupportCardTypeString): string {
    switch (type) {
      case 'speed': return '#ff4444';
      case 'stamina': return '#44ff44';
      case 'power': return '#ff8844';
      case 'guts': return '#ffff44';
      case 'intelligence': return '#4444ff';
      case 'friend': return '#ff44ff';
      default: return '#888888';
    }
  }

  static getRarityColor(rarity: number): string {
    switch (rarity) {
      case 1: return '#c0c0c0'; // Silver for R
      case 2: return '#ffd700'; // Gold for SR
      case 3: return '#ff6b35'; // Orange/Red for SSR
      default: return '#888888';
    }
  }
}
