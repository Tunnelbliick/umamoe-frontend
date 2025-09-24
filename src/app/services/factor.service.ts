import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import factorsData from '../../data/factors.json';

export interface Factor {
  id: string;
  text: string;
  type: number; // 0=blue, 1=pink, 2,3=white, 4=white scenario, 5=green/unique
}

export interface SparkInfo {
  factorId: string;
  level: number;
  name: string;
  type: number;
}

@Injectable({
  providedIn: 'root'
})
export class FactorService {
  private factors$ = new BehaviorSubject<Factor[]>([]);
  private factorsMap = new Map<string, Factor>();

  constructor() {
    this.loadFactors();
  }

  private loadFactors(): void {
    
    let factors: Factor[];
    if (Array.isArray(factorsData)) {
      factors = factorsData as Factor[];
    } else {
      factors = (factorsData as any).default || [];
    }
    
    this.factors$.next(factors);
    // Create a map for quick lookups
    this.factorsMap.clear();
    factors.forEach((factor: Factor) => {
      this.factorsMap.set(factor.id, factor);
    });
  }

  /**
   * Resolve a spark ID (factor ID + level) to meaningful information
   * @param sparkId - The spark ID (e.g., "101" for "Speed level 1")
   * @returns SparkInfo with factor name, level, and type
   */
  resolveSpark(sparkId: number): SparkInfo {
    const sparkIdStr = sparkId.toString();
    
    // Extract level (last digit) and base factor ID
    const level = parseInt(sparkIdStr.slice(-1));
    const baseFactorId = sparkIdStr.slice(0, -1);
    
    // Look up the factor in our map
    const factor = this.factorsMap.get(baseFactorId);
    
    if (factor) {
      return {
        factorId: baseFactorId,
        level: level,
        name: factor.text,
        type: factor.type
      };
    } else {
      // Fallback for unknown factors
      return {
        factorId: baseFactorId,
        level: level,
        name: `Unknown Factor ${baseFactorId}`,
        type: -1
      };
    }
  }

  /**
   * Resolve multiple spark IDs
   * @param sparkIds - Array of spark IDs
   * @returns Array of SparkInfo objects
   */
  resolveSparks(sparkIds: number[]): SparkInfo[] {
    // Sort by level (extracted properly from the end of the spark ID)
    sparkIds.sort((a, b) => {
      const levelA = this.extractLevel(a);
      const levelB = this.extractLevel(b);
      return levelB - levelA;
    });

    return sparkIds.map(sparkId => this.resolveSpark(sparkId));
  }

  /**
   * Extract the level from a spark ID
   * @param sparkId - The spark ID
   * @returns The level number
   */
  private extractLevel(sparkId: number): number {
    const sparkIdStr = sparkId.toString();
    // For spark IDs, the level is typically the last 1-2 digits
    // We need to determine where the base factor ID ends and level begins
    
    // Try to find the factor with longest matching prefix
    let maxMatchLength = 0;
    let level = 1; // default level
    
    for (const factorId of this.factorsMap.keys()) {
      if (sparkIdStr.startsWith(factorId)) {
        if (factorId.length > maxMatchLength) {
          maxMatchLength = factorId.length;
          const levelStr = sparkIdStr.slice(factorId.length);
          level = levelStr ? parseInt(levelStr) : 1;
        }
      }
    }
    
    return level;
  }

  /**
   * Get all factors (for development/debugging)
   */
  getFactors(): Observable<Factor[]> {
    return this.factors$.asObservable();
  }

  /**
   * Check if factors are loaded
   */
  areFactorsLoaded(): boolean {
    return this.factorsMap.size > 0;
  }
}
