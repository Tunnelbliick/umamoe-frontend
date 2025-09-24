import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin, of } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { 
  StatisticsDataset, 
  StatisticsIndex, 
  GlobalStatistics, 
  DistanceStatistics, 
  CharacterStatistics 
} from '../models/statistics.model';
import * as characterData from '../../data/character.json';
import { getAllSupportCards } from '../data/support-cards.data';

@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  private availableDatasets$ = new BehaviorSubject<StatisticsDataset[]>([]);
  private selectedDataset$ = new BehaviorSubject<StatisticsDataset | null>(null);
  private characterNameToIdMap: Map<string, string> = new Map();
  private supportCardNameToIdMap: Map<string, string> = new Map();
  private characterDataLoaded = false;
  private supportCardDataLoaded = false;

  constructor(private http: HttpClient) {
    this.loadAvailableDatasets();
    this.loadCharacterNameMapping();
    this.loadSupportCardNameMapping();
  }

  getAvailableDatasets(): Observable<StatisticsDataset[]> {
    return this.availableDatasets$.asObservable();
  }

  getSelectedDataset(): Observable<StatisticsDataset | null> {
    return this.selectedDataset$.asObservable();
  }

  selectDataset(dataset: StatisticsDataset): void {
    this.selectedDataset$.next(dataset);
  }

  private loadAvailableDatasets(): void {
    // Load the master index which contains available datasets
    this.http.get<StatisticsIndex>('assets/statistics/index.json')
      .pipe(
        map(index => {
          const dataset: StatisticsDataset = {
            id: index.version || 'current',
            name: index.name || 'Current Statistics',
            date: index.generated_at,
            basePath: `assets/statistics/${index.version || 'current'}`,
            index: index
          };
          return [dataset];
        }),
        catchError(error => {
          console.error('Failed to load statistics index:', error);
          return [];
        })
      )
      .subscribe(datasets => {
        this.availableDatasets$.next(datasets);
        if (datasets.length > 0) {
          this.selectedDataset$.next(datasets[0]);
        }
      });
  }

  getGlobalStatistics(dataset?: StatisticsDataset): Observable<GlobalStatistics> {
    const datasetToUse = dataset || this.selectedDataset$.value;
    if (!datasetToUse) {
      throw new Error('No dataset selected');
    }

    const url = `${datasetToUse.basePath}/global/global.json`;
    
    
    return this.http.get<GlobalStatistics>(url).pipe(
      catchError(error => {
        console.error('❌ Failed to load global statistics:', error);
        throw error;
      })
    );
  }

  getDistanceStatistics(distance: string, dataset?: StatisticsDataset): Observable<DistanceStatistics> {
    const datasetToUse = dataset || this.selectedDataset$.value;
    if (!datasetToUse) {
      throw new Error('No dataset selected');
    }

    return this.http.get<DistanceStatistics>(
      `${datasetToUse.basePath}/distance/${distance.toLowerCase()}.json`
    );
  }

  private loadCharacterNameMapping(): void {
    // Use imported character data to create name-to-ID mapping
    
    try {
      // Handle different ways TypeScript might import the JSON
      let characters: any[] = [];
      if (Array.isArray(characterData)) {
        characters = characterData as any[];
        
      } else if ((characterData as any).default && Array.isArray((characterData as any).default)) {
        characters = (characterData as any).default;
        
      } else {
        console.error('❌ Character data is not in expected format:', typeof characterData, Object.keys(characterData || {}));
        this.characterDataLoaded = false;
        return;
      }

      

      this.characterNameToIdMap.clear();
      characters.forEach((character, index) => {
        if (character.name && character.id) {
          this.characterNameToIdMap.set(character.name, character.id);
        } else {
          console.warn(`⚠️ Character ${index} missing name or id:`, { name: character.name, id: character.id });
        }
      });
      this.characterDataLoaded = true;
      
      
    } catch (error) {
      console.error('❌ Failed to load character data:', error);
      this.characterDataLoaded = false;
    }
  }

  private loadSupportCardNameMapping(): void {
    try {
      const supportCards = getAllSupportCards();
      this.supportCardNameToIdMap.clear();
      
      supportCards.forEach(card => {
        if (card.name && card.id) {
          this.supportCardNameToIdMap.set(card.name, card.id);
        }
      });
      
      this.supportCardDataLoaded = true;
      
    } catch (error) {
      console.error('Failed to load support card data:', error);
      this.supportCardDataLoaded = false;
    }
  }

  getCharacterStatistics(characterNameOrId: string, dataset?: StatisticsDataset): Observable<CharacterStatistics> {
    const datasetToUse = dataset || this.selectedDataset$.value;
    if (!datasetToUse) {
      throw new Error('No dataset selected');
    }

    let characterId: string;

    // Check if the input is already a character ID (numeric)
    if (/^\d+$/.test(characterNameOrId)) {
      characterId = characterNameOrId;
    } else {
      // Get character ID from name mapping
      const mappedId = this.characterNameToIdMap.get(characterNameOrId);
      if (!mappedId) {
        console.error(`❌ Character ID not found for name: ${characterNameOrId}`);
        throw new Error(`Character ID not found for name: ${characterNameOrId}`);
      }
      characterId = mappedId;
    }

    // Check if character ID exists in statistics dataset
    if (!datasetToUse.index.character_ids?.includes(characterId)) {
      console.error(`❌ Character statistics not available for: ${characterNameOrId} (${characterId})`);
      throw new Error(`Character statistics not available for: ${characterNameOrId} (${characterId})`);
    }

    const url = `${datasetToUse.basePath}/characters/${characterId}.json`;

    return this.http.get<CharacterStatistics>(url).pipe(
      catchError(error => {
        console.error(`❌ Failed to load character statistics for ${characterNameOrId} (${characterId}):`, error);
        throw error;
      })
    );
  }

  isCharacterDataLoaded(): boolean {
    return this.characterDataLoaded;
  }

  isCharacterStatisticsAvailable(characterName: string, dataset?: StatisticsDataset): boolean {
    const datasetToUse = dataset || this.selectedDataset$.value;
    if (!datasetToUse || !this.characterDataLoaded) {
      return false;
    }

    const characterId = this.characterNameToIdMap.get(characterName);
    if (!characterId) {
      return false;
    }

    return datasetToUse.index.character_ids?.includes(characterId) || false;
  }

  getCharacterIdFromName(characterName: string): string | null {
    return this.characterNameToIdMap.get(characterName) || null;
  }

  getSupportCardIdFromName(supportCardName: string): string | null {
    return this.supportCardNameToIdMap.get(supportCardName) || null;
  }

  getAvailableCharacters(dataset?: StatisticsDataset): string[] {
    const datasetToUse = dataset || this.selectedDataset$.value;
    return datasetToUse?.index.character_ids || [];
  }

  getAvailableDistances(dataset?: StatisticsDataset): string[] {
    const datasetToUse = dataset || this.selectedDataset$.value;
    return datasetToUse?.index.distances || [];
  }
}
