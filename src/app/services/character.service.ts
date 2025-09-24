import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';
import { Character } from '../models/character.model';
import { getAllCharacters, getCharacterById } from '../data/character.data';

@Injectable({
  providedIn: 'root'
})
export class CharacterService {
  private charactersSubject = new BehaviorSubject<Character[]>([]);
  public characters$ = this.charactersSubject.asObservable();

  constructor() {
    // Load characters from bundled data immediately
    this.charactersSubject.next(getAllCharacters());
  }

  getCharacters(): Observable<Character[]> {
    return this.characters$;
  }

  getCharacterById(id: number | string): Observable<Character | undefined> {
    return this.characters$.pipe(
      filter(characters => characters.length > 0), // Only emit when characters are loaded
      map(characters => {
        const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
        return characters.find(c => c.id === numericId);
      }),
      take(1) // Complete after first emission
    );
  }

  searchCharacters(query: string): Observable<Character[]> {
    return this.characters$.pipe(
      filter(characters => characters.length > 0),
      map(characters => characters.filter(character =>
        character.name.toLowerCase().includes(query.toLowerCase()) ||
        character.id.toString().includes(query)
      ))
    );
  }

  /**
   * Get characters that have been released globally by a specific date
   * Uses the timeline calculation logic similar to the timeline service
   * Includes a 2-day grace period for upcoming releases
   */
  getReleasedCharacters(cutoffDate?: Date, gracePeriodDays: number = 2): Observable<Character[]> {
    const globalReleaseDate = new Date('2025-06-26'); // Global game launch
    const baseCutoffDate = cutoffDate || new Date(); // Default to today
    
    // Add grace period to the cutoff date
    const effectiveCutoffDate = new Date(baseCutoffDate);
    effectiveCutoffDate.setDate(effectiveCutoffDate.getDate() + gracePeriodDays);
    
    return this.characters$.pipe(
      filter(characters => characters.length > 0),
      map(characters => {
        return characters.filter(character => {
          // Parse the character's JP release date
          const jpReleaseDate = new Date(character.release_date);
          if (isNaN(jpReleaseDate.getTime())) return false;
          
          // Calculate estimated global release date using timeline logic
          const estimatedGlobalDate = this.calculateGlobalReleaseDate(jpReleaseDate, globalReleaseDate);
          
          // Return true if the character should be released by the cutoff date (including grace period)
          return estimatedGlobalDate <= effectiveCutoffDate;
        });
      })
    );
  }

  /**
   * Calculate estimated global release date based on timeline service logic
   * This mirrors the calculation used in timeline.service.ts
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
    
    return globalDate;
  }
}
