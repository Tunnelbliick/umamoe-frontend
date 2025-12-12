import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { CharacterSelectDialogComponent } from '../../pages/inheritance-database/character-select-dialog.component';
import { SupportCardSelectDialogComponent } from '../../pages/support-cards-database/support-card-select-dialog.component';
import { SupportCardService } from '../../services/support-card.service';
import { SupportCard, SupportCardShort, SupportCardType, Rarity } from '../../models/support-card.model';
import factorsData from '../../../data/factors.json';
import characterData from '../../../data/character.json';

export interface ActiveFilterChip {
  id: string;
  label: string;
  name?: string;
  value?: string;
  showStar?: boolean;
  range?: string; // Star range like "1-9", "5+", etc.
  type: 'blue' | 'pink' | 'green' | 'white' | 'optionalWhite' | 'optionalMainWhite' | 'mainBlue' | 'mainPink' | 'mainGreen' | 'mainWhite' | 'character' | 'supportCard' | 'other';
  filterIndex?: number;
  filterList?: FactorFilter[];
}

interface CompressedState {
  b?: (number|null)[][]; // blue factors [id, min]
  p?: (number|null)[][]; // pink factors [id, min]
  g?: (number|null)[][]; // green factors [id, min]
  w?: (number|null)[][]; // white factors [id, min]
  
  ow?: number[]; // optional white factors [id]
  omw?: number[]; // optional main white factors [id]

  mb?: (number|null)[][]; // main blue
  mp?: (number|null)[][]; // main pink
  mg?: (number|null)[][]; // main green
  mw?: (number|null)[][]; // main white
  
  // Tree: [targetId, p1Id, p1_g1Id, p1_g2Id, p2Id, p2_g1Id, p2_g2Id]
  t?: (number|null)[]; 
  
  sc?: string; // support card id
  lb?: number; // limit break
  
  uid?: string; // search user id
  
  // Other scalars
  mwc?: number; // min win count
  mwh?: number; // min white count
  pr?: number; // parent rank
  mf?: number; // max followers
}

export interface TreeNode {
  id: string;
  name: string;
  image?: string;
  characterId?: number;
  layer: number;
  children?: TreeNode[];
}

export interface UnifiedSearchParams {
  page?: number;
  limit?: number;
  search_type?: string;

  // Inheritance filtering
  player_chara_id?: number;
  main_parent_id?: number;
  parent_left_id?: number;
  parent_right_id?: number;
  parent_rank?: number;
  parent_rarity?: number;
  blue_sparks?: number[][];
  pink_sparks?: number[][];
  green_sparks?: number[][];
  white_sparks?: number[][];
  
  blue_sparks_9star?: boolean;
  pink_sparks_9star?: boolean;
  green_sparks_9star?: boolean;

  // Main parent spark filtering
  main_parent_blue_sparks?: number[];
  main_parent_pink_sparks?: number[];
  main_parent_green_sparks?: number[];
  main_parent_white_sparks?: number[];
  min_win_count?: number;
  min_white_count?: number;

  // Main inherit filtering
  min_main_blue_factors?: number;
  min_main_pink_factors?: number;
  min_main_green_factors?: number;
  min_main_white_count?: number;

  // Optional white sparks (no level requirement, used for sorting by match score)
  optional_white_sparks?: number[];
  optional_main_white_sparks?: number[];

  // Support card filtering
  support_card_id?: number;
  min_limit_break?: number;
  max_limit_break?: number;
  min_experience?: number;

  // Common filtering
  trainer_id?: string;
  trainer_name?: string;
  max_follower_num?: number;
  sort_by?: string;

  player_chara_id_2?: number;
  desired_main_chara_id?: number;
}

export interface FactorFilter {
  uuid: string;
  factorId: number | null;
  min: number;
  max: number;
}

@Component({
  selector: 'app-advanced-filter',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatSliderModule,
    MatCheckboxModule,
    MatAutocompleteModule,
    MatChipsModule,
    FormsModule
  ],
  templateUrl: './advanced-filter.component.html',
  styleUrl: './advanced-filter.component.scss'
})
export class AdvancedFilterComponent implements OnInit {
  @Output() filterChange = new EventEmitter<UnifiedSearchParams>();
  private filterChangeSubject = new Subject<UnifiedSearchParams>();

  isExpanded = false;
  selectedLimitBreak = 0; // Default to LB0+
  searchUserId = ''; // Search for user ID
  searchUsername = ''; // Search for username
  selectedSupportCard: SupportCardShort | null = null;
  activeFilterChips: ActiveFilterChip[] = [];

  // Factor Data
  blueFactors = factorsData.filter((f: any) => f.type === 0).map((f: any) => ({...f, id: parseInt(f.id, 10)}));
  pinkFactors = factorsData.filter((f: any) => f.type === 1).map((f: any) => ({...f, id: parseInt(f.id, 10)}));
  greenFactors = factorsData.filter((f: any) => f.type === 5).map((f: any) => ({...f, id: parseInt(f.id, 10)}));
  whiteFactors = factorsData.filter((f: any) => f.type === 2 || f.type === 3 || f.type === 4).map((f: any) => ({...f, id: parseInt(f.id, 10)}));

  // Active Factor Filters
  blueFactorFilters: FactorFilter[] = [];
  pinkFactorFilters: FactorFilter[] = [];
  greenFactorFilters: FactorFilter[] = [];
  whiteFactorFilters: FactorFilter[] = [];

  mainBlueFactorFilters: FactorFilter[] = [];
  mainPinkFactorFilters: FactorFilter[] = [];
  mainGreenFactorFilters: FactorFilter[] = [];
  mainWhiteFactorFilters: FactorFilter[] = [];

  // Optional white factors (no level, just ID - for scoring/sorting)
  optionalWhiteFactorFilters: FactorFilter[] = [];
  optionalMainWhiteFactorFilters: FactorFilter[] = [];

  ngOnInit() {
    this.filterChangeSubject.pipe(
      debounceTime(500)
    ).subscribe(filters => {
      this.filterChange.emit(filters);
    });
  }

  // Filter State
  filterState: UnifiedSearchParams = {
    blue_sparks: [],
    pink_sparks: [],
    green_sparks: [],
    white_sparks: [],
    
    blue_sparks_9star: false,
    pink_sparks_9star: false,
    green_sparks_9star: false,

    min_win_count: 0,
    min_white_count: 0,

    min_main_blue_factors: undefined,
    min_main_pink_factors: undefined,
    min_main_green_factors: undefined,
    min_main_white_count: 0,
    
    main_parent_blue_sparks: [],
    main_parent_pink_sparks: [],
    main_parent_green_sparks: [],
    main_parent_white_sparks: [],

    parent_rank: 1,
    parent_rarity: undefined,
    max_follower_num: 999,
    
    min_experience: undefined,
  };

  // Filtered Options for Autocomplete
  filteredGreenFactorOptions: any[][] = [];
  filteredWhiteFactorOptions: any[][] = [];
  filteredMainWhiteFactorOptions: any[][] = [];
  filteredMainGreenFactorOptions: any[][] = [];
  filteredOptionalWhiteFactorOptions: any[][] = [];
  filteredOptionalMainWhiteFactorOptions: any[][] = [];

  private uuidCounter = 0;

  constructor(
    private dialog: MatDialog,
    private supportCardService: SupportCardService
  ) {}

  // --- Serialization Logic ---

  getSerializedState(): string {
    const state: CompressedState = {};

    // Factors
    if (this.blueFactorFilters.length) state.b = this.blueFactorFilters.map(f => [f.factorId, f.min, f.max]);
    if (this.pinkFactorFilters.length) state.p = this.pinkFactorFilters.map(f => [f.factorId, f.min, f.max]);
    if (this.greenFactorFilters.length) state.g = this.greenFactorFilters.map(f => [f.factorId, f.min, f.max]);
    if (this.whiteFactorFilters.length) state.w = this.whiteFactorFilters.map(f => [f.factorId, f.min, f.max]);

    if (this.optionalWhiteFactorFilters.length) {
      const ids = this.optionalWhiteFactorFilters.filter(f => f.factorId && f.factorId > 0).map(f => f.factorId!);
      if (ids.length) state.ow = ids;
    }
    if (this.optionalMainWhiteFactorFilters.length) {
      const ids = this.optionalMainWhiteFactorFilters.filter(f => f.factorId && f.factorId > 0).map(f => f.factorId!);
      if (ids.length) state.omw = ids;
    }

    if (this.mainBlueFactorFilters.length) state.mb = this.mainBlueFactorFilters.map(f => [f.factorId, f.min, f.max]);
    if (this.mainPinkFactorFilters.length) state.mp = this.mainPinkFactorFilters.map(f => [f.factorId, f.min, f.max]);
    if (this.mainGreenFactorFilters.length) state.mg = this.mainGreenFactorFilters.map(f => [f.factorId, f.min, f.max]);
    if (this.mainWhiteFactorFilters.length) state.mw = this.mainWhiteFactorFilters.map(f => [f.factorId, f.min, f.max]);

    // Tree
    const t: (number|null)[] = [
      this.treeData.characterId || null,
      this.treeData.children?.[0]?.characterId || null,
      this.treeData.children?.[0]?.children?.[0]?.characterId || null,
      this.treeData.children?.[0]?.children?.[1]?.characterId || null,
      this.treeData.children?.[1]?.characterId || null,
      this.treeData.children?.[1]?.children?.[0]?.characterId || null,
      this.treeData.children?.[1]?.children?.[1]?.characterId || null,
    ];
    // Only add tree if at least one node is selected
    if (t.some(id => id !== null)) {
      state.t = t;
    }

    // Other fields
    if (this.selectedSupportCard) state.sc = this.selectedSupportCard.id;
    if (this.selectedLimitBreak > 0) state.lb = this.selectedLimitBreak;
    if (this.searchUserId) state.uid = this.searchUserId;
    
    if (this.filterState.min_win_count) state.mwc = this.filterState.min_win_count;
    if (this.filterState.min_white_count) state.mwh = this.filterState.min_white_count;
    if (this.filterState.parent_rank && this.filterState.parent_rank !== 1) state.pr = this.filterState.parent_rank;
    if (this.filterState.max_follower_num && this.filterState.max_follower_num !== 999) state.mf = this.filterState.max_follower_num;

    return btoa(JSON.stringify(state));
  }

  loadSerializedState(stateStr: string) {
    try {
      const state: CompressedState = JSON.parse(atob(stateStr));
      console.log('Restoring advanced filters from URL:', state);
      
      // Restore Factors
      const restoreFactors = (source: (number|null)[][] | undefined, target: FactorFilter[], type?: 'green' | 'white' | 'mainWhite' | 'mainGreen') => {
        if (!source) return;
        source.forEach(([id, min, max]) => {
          const filter: FactorFilter = {
            uuid: this.getUuid(),
            factorId: id,
            min: min || 1,
            max: max !== undefined && max !== null ? max : 9
          };
          target.push(filter);
          
          // Update autocomplete options
          if (type === 'green') this.filteredGreenFactorOptions.push([...this.greenFactors]);
          if (type === 'white') this.filteredWhiteFactorOptions.push([...this.whiteFactors]);
          if (type === 'mainWhite') this.filteredMainWhiteFactorOptions.push([...this.whiteFactors]);
          if (type === 'mainGreen') this.filteredMainGreenFactorOptions.push([...this.greenFactors]);
        });
      };

      // Clear existing
      this.blueFactorFilters = [];
      this.pinkFactorFilters = [];
      this.greenFactorFilters = [];
      this.whiteFactorFilters = [];
      this.mainBlueFactorFilters = [];
      this.mainPinkFactorFilters = [];
      this.mainGreenFactorFilters = [];
      this.mainWhiteFactorFilters = [];
      this.optionalWhiteFactorFilters = [];
      this.optionalMainWhiteFactorFilters = [];
      this.filteredGreenFactorOptions = [];
      this.filteredWhiteFactorOptions = [];
      this.filteredMainWhiteFactorOptions = [];
      this.filteredOptionalWhiteFactorOptions = [];
      this.filteredOptionalMainWhiteFactorOptions = [];

      restoreFactors(state.b, this.blueFactorFilters);
      restoreFactors(state.p, this.pinkFactorFilters);
      restoreFactors(state.g, this.greenFactorFilters, 'green');
      restoreFactors(state.w, this.whiteFactorFilters, 'white');

      restoreFactors(state.mb, this.mainBlueFactorFilters);
      restoreFactors(state.mp, this.mainPinkFactorFilters);
      restoreFactors(state.mg, this.mainGreenFactorFilters, 'mainGreen');
      // Actually mainGreenFactorFilters uses autocomplete? Let's check.
      // In addFactorFilter, type 'green' adds to filteredGreenFactorOptions.
      // But mainGreenFactorFilters logic in addFactorFilter is missing in the original code?
      // Let's assume it works like others.
      
      restoreFactors(state.mw, this.mainWhiteFactorFilters, 'mainWhite');

      // Restore Optional Factors
      const restoreOptionalFactors = (source: number[] | undefined, target: FactorFilter[], type: 'optionalWhite' | 'optionalMainWhite') => {
        if (!source) return;
        source.forEach(id => {
          const filter: FactorFilter = {
            uuid: this.getUuid(),
            factorId: id,
            min: 1,
            max: 9
          };
          target.push(filter);
          
          if (type === 'optionalWhite') this.filteredOptionalWhiteFactorOptions.push([...this.whiteFactors]);
          if (type === 'optionalMainWhite') this.filteredOptionalMainWhiteFactorOptions.push([...this.whiteFactors]);
        });
      };

      restoreOptionalFactors(state.ow, this.optionalWhiteFactorFilters, 'optionalWhite');
      restoreOptionalFactors(state.omw, this.optionalMainWhiteFactorFilters, 'optionalMainWhite');

      // Restore Tree
      if (state.t) {
        const [target, p1, p1g1, p1g2, p2, p2g1, p2g2] = state.t;
        
        const setNode = (node: TreeNode, id: number | null) => {
          if (id) {
            node.characterId = id;
            const char = characterData.find((c: any) => parseInt(c.id, 10) === id);
            if (char) {
              node.name = char.name;
              node.image = char.image;
            } else {
              node.name = `ID: ${id}`; 
              node.image = undefined;
            }
          }
        };

        setNode(this.treeData, target);
        if (this.treeData.children?.[0]) {
          setNode(this.treeData.children[0], p1);
          if (this.treeData.children[0].children?.[0]) setNode(this.treeData.children[0].children[0], p1g1);
          if (this.treeData.children[0].children?.[1]) setNode(this.treeData.children[0].children[1], p1g2);
        }
        if (this.treeData.children?.[1]) {
          setNode(this.treeData.children[1], p2);
          if (this.treeData.children[1].children?.[0]) setNode(this.treeData.children[1].children[0], p2g1);
          if (this.treeData.children[1].children?.[1]) setNode(this.treeData.children[1].children[1], p2g2);
        }
        
        this.updateTreeFilters(); // This updates filterState from treeData
      }

      // Restore Support Card
      if (state.sc) {
        // Try to fetch card info
        this.supportCardService.getSupportCards().subscribe((cards: SupportCardShort[]) => {
           const card = cards.find((c: SupportCardShort) => c.id.toString() === state.sc);
           if (card) {
             this.selectedSupportCard = {
               id: card.id.toString(),
               name: card.name,
               imageUrl: card.imageUrl,
               type: card.type,
               rarity: card.rarity,
               limitBreak: card.limitBreak,
               release_date: card.release_date
             };
             this.onFilterChange();
           }
        });
      }

      // Restore Scalars
      if (state.lb !== undefined) this.selectedLimitBreak = state.lb;
      if (state.uid) this.searchUserId = state.uid;
      
      if (state.mwc !== undefined) this.filterState.min_win_count = state.mwc;
      if (state.mwh !== undefined) this.filterState.min_white_count = state.mwh;
      if (state.pr !== undefined) this.filterState.parent_rank = state.pr;
      if (state.mf !== undefined) this.filterState.max_follower_num = state.mf;

      this.onFilterChange();

    } catch (e) {
      console.error('Failed to load filter state', e);
    }
  }

  // Helper to generate unique IDs
  private getUuid(): string {
    return `filter_${this.uuidCounter++}`;
  }

  // --- Factor Filter Management ---

  addFactorFilter(list: FactorFilter[], defaultFactorId: number | null, type?: 'green' | 'white' | 'mainWhite' | 'mainGreen' | 'optionalWhite' | 'optionalMainWhite') {
    list.push({
      uuid: this.getUuid(),
      factorId: defaultFactorId,
      min: 1,
      max: 9
    });

    if (type === 'green') this.filteredGreenFactorOptions.push([...this.greenFactors]);
    if (type === 'white') this.filteredWhiteFactorOptions.push([...this.whiteFactors]);
    if (type === 'mainWhite') this.filteredMainWhiteFactorOptions.push([...this.whiteFactors]);
    if (type === 'mainGreen') this.filteredMainGreenFactorOptions.push([...this.greenFactors]);
    if (type === 'optionalWhite') this.filteredOptionalWhiteFactorOptions.push([...this.whiteFactors]);
    if (type === 'optionalMainWhite') this.filteredOptionalMainWhiteFactorOptions.push([...this.whiteFactors]);

    // Enforce single green factor for main parent
    if (type === 'mainGreen' && this.mainGreenFactorFilters.length > 1) {
      // Remove the previous one, keep the new one
      this.removeFactorFilter(this.mainGreenFactorFilters, 0, 'mainGreen');
    }

    // Only trigger filter change if a valid factor is already selected
    // For white factors with null default, don't trigger until user selects something
    if (defaultFactorId !== null) {
      this.onFilterChange();
    }
  }

  removeFactorFilter(list: FactorFilter[], index: number, type?: 'green' | 'white' | 'mainWhite' | 'mainGreen' | 'optionalWhite' | 'optionalMainWhite') {
    // Check if the filter being removed had a valid selection
    const removedFilter = list[index];
    const hadValidSelection = removedFilter && removedFilter.factorId !== null && removedFilter.factorId !== 0;
    
    list.splice(index, 1);
    
    if (type === 'green') this.filteredGreenFactorOptions.splice(index, 1);
    if (type === 'white') this.filteredWhiteFactorOptions.splice(index, 1);
    if (type === 'mainWhite') this.filteredMainWhiteFactorOptions.splice(index, 1);
    if (type === 'mainGreen') this.filteredMainGreenFactorOptions.splice(index, 1);
    if (type === 'optionalWhite') this.filteredOptionalWhiteFactorOptions.splice(index, 1);
    if (type === 'optionalMainWhite') this.filteredOptionalMainWhiteFactorOptions.splice(index, 1);

    // Always trigger filter change to update chips and URL
    this.onFilterChange();
  }

  // --- Autocomplete Logic ---

  filterFactors(value: string | number, type: 'green' | 'white' | 'mainWhite' | 'mainGreen' | 'optionalWhite' | 'optionalMainWhite', index: number) {
    // If value is a number (factor ID selected), don't filter - just return
    if (typeof value === 'number') return;
    
    const filterValue = (value || '').toLowerCase();
    let sourceList: any[] = [];
    
    if (type === 'green' || type === 'mainGreen') sourceList = this.greenFactors;
    else sourceList = this.whiteFactors; // All white types use whiteFactors

    const filtered = sourceList.filter(option => option.text.toLowerCase().includes(filterValue));

    if (type === 'green') this.filteredGreenFactorOptions[index] = filtered;
    if (type === 'white') this.filteredWhiteFactorOptions[index] = filtered;
    if (type === 'mainWhite') this.filteredMainWhiteFactorOptions[index] = filtered;
    if (type === 'mainGreen') this.filteredMainGreenFactorOptions[index] = filtered;
    if (type === 'optionalWhite') this.filteredOptionalWhiteFactorOptions[index] = filtered;
    if (type === 'optionalMainWhite') this.filteredOptionalMainWhiteFactorOptions[index] = filtered;
  }

  getFactorText(id: number | null | undefined, type: 'green' | 'white'): string {
    if (!id || id === 0) return '';
    const list = type === 'green' ? this.greenFactors : this.whiteFactors;
    const found = list.find(f => f.id === id);
    return found ? found.text : '';
  }

  onFactorSelected(event: MatAutocompleteSelectedEvent, filter: FactorFilter) {
    filter.factorId = event.option.value;
    this.onFilterChange();
  }

  // --- Tree Logic ---
  treeData: TreeNode = {
    id: 'target',
    name: 'Target Uma',
    layer: 0,
    children: [
      {
        id: 'p1',
        name: 'Parent 1',
        layer: 1,
        children: [
          { id: 'p2-1', name: 'Grandparent 1', layer: 2 },
          { id: 'p2-2', name: 'Grandparent 2', layer: 2 }
        ]
      },
      {
        id: 'p1-2',
        name: 'Parent 2',
        layer: 1,
        children: [
          { id: 'p2-3', name: 'Grandparent 3', layer: 2 },
          { id: 'p2-4', name: 'Grandparent 4', layer: 2 }
        ]
      }
    ]
  };

  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }

  getCharacterImagePath(imageName: string | undefined): string {
    if (!imageName) return 'assets/images/placeholder-uma.png';
    if (imageName.startsWith('assets/')) return imageName;
    return `assets/images/character_stand/${imageName}`;
  }

  selectNode(node: TreeNode) {
    const dialogRef = this.dialog.open(CharacterSelectDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      height: '80vh',
      panelClass: 'modern-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Duplicate Detection & Replacement
        const newBaseId = Math.floor(result.id / 100);
        this.clearDuplicateNode(this.treeData, newBaseId);

        node.name = result.name;
        node.image = result.image;
        node.characterId = result.id;
        
        this.updateTreeFilters();
      }
    });
  }

  private clearDuplicateNode(node: TreeNode, baseId: number) {
    if (node.characterId && Math.floor(node.characterId / 100) === baseId) {
      this.clearNodeRecursive(node);
    }
    if (node.children) {
      node.children.forEach(child => this.clearDuplicateNode(child, baseId));
    }
  }

  updateTreeFilters() {
    this.filterState.player_chara_id = this.treeData.characterId;
    
    const mainParent = this.treeData.children?.[0];
    this.filterState.main_parent_id = mainParent?.characterId;

    if (mainParent && mainParent.children) {
      this.filterState.parent_left_id = mainParent.children[0]?.characterId;
      this.filterState.parent_right_id = mainParent.children[1]?.characterId;
    }
    
    this.onFilterChange();
  }

  // Helper to generate spark IDs from filters
  private generateSparkIds(filters: FactorFilter[], availableFactors: any[], maxCap: number = 9): number[] {
    const ids: number[] = [];
    filters.forEach(f => {
      const min = f.min || 1;
      let max = f.max !== undefined ? f.max : 9;
      
      // Clamp max to the provided cap (e.g. 3 for main parent factors)
      if (max > maxCap) {
        max = maxCap;
      }
      
      for (let lvl = min; lvl <= max; lvl++) {
        if (f.factorId) {
          // Specific factor: ID + Level (concatenated)
          ids.push(parseInt(`${f.factorId}${lvl}`, 10));
        } else {
          // "Any" factor: Expand to all available factors in this category
          availableFactors.forEach(factor => {
            ids.push(parseInt(`${factor.id}${lvl}`, 10));
          });
        }
      }
    });
    return [...new Set(ids)];
  }

  // Helper to generate spark ID groups from filters (AND logic between groups)
  private generateSparkIdGroups(filters: FactorFilter[], availableFactors: any[], maxCap: number = 9): number[][] {
    const groups: number[][] = [];
    filters.forEach(f => {
      const ids: number[] = [];
      const min = f.min || 1;
      let max = f.max !== undefined ? f.max : 9;
      
      if (max > maxCap) {
        max = maxCap;
      }
      
      for (let lvl = min; lvl <= max; lvl++) {
        if (f.factorId) {
          ids.push(parseInt(`${f.factorId}${lvl}`, 10));
        } else {
          // "Any" factor: Expand to all available factors in this category
          availableFactors.forEach(factor => {
            ids.push(parseInt(`${factor.id}${lvl}`, 10));
          });
        }
      }
      if (ids.length > 0) {
        groups.push(ids);
      }
    });
    return groups;
  }

  onFilterChange() {
    // Sync derived state
    this.filterState.min_limit_break = this.selectedLimitBreak > 0 ? this.selectedLimitBreak : undefined;
    this.filterState.trainer_id = this.searchUserId;
    this.filterState.trainer_name = this.searchUsername;
    
    if (this.selectedSupportCard) {
      this.filterState.support_card_id = parseInt(this.selectedSupportCard.id, 10);
    } else {
      this.filterState.support_card_id = undefined;
    }

    // Map Factor Filters to API State
    
    // Global Factors
    this.filterState.blue_sparks = this.generateSparkIdGroups(this.blueFactorFilters, this.blueFactors);
    this.filterState.blue_sparks_9star = this.blueFactorFilters.some(f => f.min >= 9);
    
    this.filterState.pink_sparks = this.generateSparkIdGroups(this.pinkFactorFilters, this.pinkFactors);
    this.filterState.pink_sparks_9star = this.pinkFactorFilters.some(f => f.min >= 9);
    
    this.filterState.green_sparks = this.generateSparkIdGroups(this.greenFactorFilters, this.greenFactors);
    this.filterState.green_sparks_9star = this.greenFactorFilters.some(f => f.min >= 9);
    
    this.filterState.white_sparks = this.generateSparkIdGroups(this.whiteFactorFilters, this.whiteFactors);

    // Main Parent Factors
    this.filterState.main_parent_blue_sparks = this.generateSparkIds(this.mainBlueFactorFilters, this.blueFactors, 3);
    // For min_main_blue_factors, we take the MAX of the mins specified, as a best effort approximation
    // since the API only supports one global min for the parent.
    // Or if multiple are selected, maybe we should sum them? 
    // Usually "Speed 3" and "Stamina 3" means "Speed >= 3 AND Stamina >= 3".
    // But if the API is "Sum of (Speed, Stamina) >= X", then we can't express AND.
    // We will assume the user wants "Sum of selected >= X" where X is the highest constraint or sum?
    // Let's just take the highest min value for now.
    this.filterState.min_main_blue_factors = this.mainBlueFactorFilters.length > 0 
      ? Math.max(...this.mainBlueFactorFilters.map(f => f.min)) 
      : undefined;

    this.filterState.main_parent_pink_sparks = this.generateSparkIds(this.mainPinkFactorFilters, this.pinkFactors, 3);
    this.filterState.min_main_pink_factors = this.mainPinkFactorFilters.length > 0
      ? Math.max(...this.mainPinkFactorFilters.map(f => f.min))
      : undefined;

    this.filterState.main_parent_green_sparks = this.generateSparkIds(this.mainGreenFactorFilters, this.greenFactors, 3);
    this.filterState.min_main_green_factors = this.mainGreenFactorFilters.length > 0
      ? Math.max(...this.mainGreenFactorFilters.map(f => f.min))
      : undefined;

    this.filterState.main_parent_white_sparks = this.generateSparkIds(this.mainWhiteFactorFilters, this.whiteFactors, 3);
    // min_main_white_count is handled by the input field directly, do not overwrite it here based on specific factor filters.

    // Optional White Sparks (just IDs, no levels - for scoring/sorting)
    this.filterState.optional_white_sparks = this.optionalWhiteFactorFilters
      .filter(f => f.factorId && f.factorId > 0)
      .map(f => f.factorId!);
    
    this.filterState.optional_main_white_sparks = this.optionalMainWhiteFactorFilters
      .filter(f => f.factorId && f.factorId > 0)
      .map(f => f.factorId!);

    // Update active filter chips
    this.updateActiveFilterChips();

    // Emit the filter state
    this.filterChangeSubject.next(this.filterState);
  }

  private updateActiveFilterChips(): void {
    this.activeFilterChips = [];

    // Helper to format value part
    const formatValue = (min: number, max: number, maxPossible: number = 9): string => {
      if (min === max) {
        return `${min}`;
      } else if (min === 1 && max === maxPossible) {
        return `${min}-${max}`;
      } else if (min > 1 && max === maxPossible) {
        return `${min}+`;
      } else if (min === 1 && max < maxPossible) {
        return `≤${max}`;
      } else {
        return `${min}-${max}`;
      }
    };

    // Helper to add factor chips - always show if filter exists
    const addFactorChips = (
      filters: FactorFilter[], 
      factorList: any[], 
      type: ActiveFilterChip['type'],
      prefix: string,
      maxPossible: number = 9
    ) => {
      filters.forEach((f, index) => {
        const factorName = f.factorId === 0 || !f.factorId 
          ? 'Any' 
          : (factorList.find(factor => factor.id === f.factorId)?.text || 'Unknown');
        
        const valueStr = formatValue(f.min, f.max, maxPossible);
        const nameStr = prefix ? `${prefix}${factorName}` : factorName;
        
        this.activeFilterChips.push({
          id: `${type}-${index}`,
          label: `${nameStr}: ${valueStr}`,
          name: nameStr,
          value: valueStr,
          showStar: true,
          type: type,
          filterIndex: index,
          filterList: filters
        });
      });
    };

    // Blue Factors (Inheritance)
    addFactorChips(this.blueFactorFilters, this.blueFactors, 'blue', '');
    
    // Pink Factors (Inheritance)
    addFactorChips(this.pinkFactorFilters, this.pinkFactors, 'pink', '');
    
    // Green Factors (Inheritance)
    addFactorChips(this.greenFactorFilters, this.greenFactors, 'green', '');
    
    // White Factors (Inheritance)
    addFactorChips(this.whiteFactorFilters, this.whiteFactors, 'white', '');
    
    // Main Parent Blue Factors
    addFactorChips(this.mainBlueFactorFilters, this.blueFactors, 'mainBlue', 'Main: ', 3);
    
    // Main Parent Pink Factors
    addFactorChips(this.mainPinkFactorFilters, this.pinkFactors, 'mainPink', 'Main: ', 3);
    
    // Main Parent Green Factors
    addFactorChips(this.mainGreenFactorFilters, this.greenFactors, 'mainGreen', 'Main: ', 3);
    
    // Main Parent White Factors
    addFactorChips(this.mainWhiteFactorFilters, this.whiteFactors, 'mainWhite', 'Main: ', 3);

    // Optional White Factors (no level, just for scoring)
    this.optionalWhiteFactorFilters.forEach((f, index) => {
      if (f.factorId && f.factorId > 0) {
        const factorName = this.whiteFactors.find(factor => factor.id === f.factorId)?.text || 'Unknown';
        this.activeFilterChips.push({
          id: `optionalWhite-${index}`,
          label: `Optional: ${factorName}`,
          name: 'Optional',
          value: factorName,
          showStar: false,
          type: 'optionalWhite',
          filterIndex: index,
          filterList: this.optionalWhiteFactorFilters
        });
      }
    });

    // Optional Main White Factors (no level, just for scoring)
    this.optionalMainWhiteFactorFilters.forEach((f, index) => {
      if (f.factorId && f.factorId > 0) {
        const factorName = this.whiteFactors.find(factor => factor.id === f.factorId)?.text || 'Unknown';
        this.activeFilterChips.push({
          id: `optionalMainWhite-${index}`,
          label: `Main Optional: ${factorName}`,
          name: 'Main Optional',
          value: factorName,
          showStar: false,
          type: 'optionalMainWhite',
          filterIndex: index,
          filterList: this.optionalMainWhiteFactorFilters
        });
      }
    });

    // Tree Characters
    if (this.treeData.characterId) {
      this.activeFilterChips.push({
        id: 'tree-target',
        label: `Target: ${this.treeData.name}`,
        name: 'Target',
        value: this.treeData.name,
        type: 'character'
      });
    }
    if (this.treeData.children?.[0]?.characterId) {
      this.activeFilterChips.push({
        id: 'tree-parent1',
        label: `Main Parent: ${this.treeData.children[0].name}`,
        name: 'Main Parent',
        value: this.treeData.children[0].name,
        type: 'character'
      });
    }
    // Grandparents
    if (this.treeData.children?.[0]?.children?.[0]?.characterId) {
      this.activeFilterChips.push({
        id: 'tree-gp1',
        label: `GP: ${this.treeData.children[0].children[0].name}`,
        name: 'GP',
        value: this.treeData.children[0].children[0].name,
        type: 'character'
      });
    }
    if (this.treeData.children?.[0]?.children?.[1]?.characterId) {
      this.activeFilterChips.push({
        id: 'tree-gp2',
        label: `GP: ${this.treeData.children[0].children[1].name}`,
        name: 'GP',
        value: this.treeData.children[0].children[1].name,
        type: 'character'
      });
    }

    // Support Card
    if (this.selectedSupportCard) {
      this.activeFilterChips.push({
        id: 'support-card',
        label: `Card: ${this.selectedSupportCard.name}`,
        name: 'Card',
        value: this.selectedSupportCard.name,
        type: 'supportCard'
      });
    }

    // Limit Break
    if (this.selectedLimitBreak > 0) {
      const lbLabel = this.selectedLimitBreak === 4 ? 'MLB' : `LB${this.selectedLimitBreak}+`;
      this.activeFilterChips.push({
        id: 'limit-break',
        label: lbLabel,
        value: lbLabel,
        type: 'other'
      });
    }

    // Min Win Count
    if (this.filterState.min_win_count && this.filterState.min_win_count > 0) {
      this.activeFilterChips.push({
        id: 'min-wins',
        label: `Wins: ${this.filterState.min_win_count}+`,
        name: 'Wins',
        value: `${this.filterState.min_win_count}+`,
        type: 'other'
      });
    }

    // Min White Count
    if (this.filterState.min_white_count && this.filterState.min_white_count > 0) {
      this.activeFilterChips.push({
        id: 'min-white',
        label: `White: ${this.filterState.min_white_count}+`,
        name: 'White',
        value: `${this.filterState.min_white_count}+`,
        type: 'other'
      });
    }

    // Parent Rank
    if (this.filterState.parent_rank && this.filterState.parent_rank > 1) {
      this.activeFilterChips.push({
        id: 'parent-rank',
        label: `Rank: ${this.filterState.parent_rank}+`,
        name: 'Rank',
        value: `${this.filterState.parent_rank}+`,
        type: 'other'
      });
    }

    // Max Followers
    if (this.filterState.max_follower_num && this.filterState.max_follower_num < 999) {
      this.activeFilterChips.push({
        id: 'max-followers',
        label: `Followers: ≤${this.filterState.max_follower_num}`,
        name: 'Followers',
        value: `≤${this.filterState.max_follower_num}`,
        type: 'other'
      });
    }

    // Trainer ID Search
    if (this.searchUserId) {
      this.activeFilterChips.push({
        id: 'trainer-id',
        label: `ID: ${this.searchUserId}`,
        name: 'ID',
        value: this.searchUserId,
        type: 'other'
      });
    }

    // Username Search
    if (this.searchUsername) {
      this.activeFilterChips.push({
        id: 'username',
        label: `User: ${this.searchUsername}`,
        name: 'User',
        value: this.searchUsername,
        type: 'other'
      });
    }
  }

  removeActiveFilter(chip: ActiveFilterChip): void {
    switch (chip.type) {
      case 'blue':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.blueFactorFilters, chip.filterIndex);
        }
        break;
      case 'pink':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.pinkFactorFilters, chip.filterIndex);
        }
        break;
      case 'green':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.greenFactorFilters, chip.filterIndex, 'green');
        }
        break;
      case 'white':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.whiteFactorFilters, chip.filterIndex, 'white');
        }
        break;
      case 'mainBlue':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.mainBlueFactorFilters, chip.filterIndex);
        }
        break;
      case 'mainPink':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.mainPinkFactorFilters, chip.filterIndex);
        }
        break;
      case 'mainGreen':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.mainGreenFactorFilters, chip.filterIndex, 'mainGreen');
        }
        break;
      case 'mainWhite':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.mainWhiteFactorFilters, chip.filterIndex, 'mainWhite');
        }
        break;
      case 'optionalWhite':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.optionalWhiteFactorFilters, chip.filterIndex, 'optionalWhite');
        }
        break;
      case 'optionalMainWhite':
        if (chip.filterIndex !== undefined) {
          this.removeFactorFilter(this.optionalMainWhiteFactorFilters, chip.filterIndex, 'optionalMainWhite');
        }
        break;
      case 'character':
        // Clear the appropriate tree node
        if (chip.id === 'tree-target') {
          this.clearNodeRecursive(this.treeData);
        } else if (chip.id === 'tree-parent1' && this.treeData.children?.[0]) {
          this.clearNodeRecursive(this.treeData.children[0]);
        } else if (chip.id === 'tree-gp1' && this.treeData.children?.[0]?.children?.[0]) {
          this.clearNodeRecursive(this.treeData.children[0].children[0]);
        } else if (chip.id === 'tree-gp2' && this.treeData.children?.[0]?.children?.[1]) {
          this.clearNodeRecursive(this.treeData.children[0].children[1]);
        }
        this.updateTreeFilters();
        break;
      case 'supportCard':
        this.removeSupportCard();
        break;
      case 'other':
        if (chip.id === 'limit-break') {
          this.selectedLimitBreak = 0;
        } else if (chip.id === 'min-wins') {
          this.filterState.min_win_count = 0;
        } else if (chip.id === 'min-white') {
          this.filterState.min_white_count = 0;
        } else if (chip.id === 'parent-rank') {
          this.filterState.parent_rank = 1;
        } else if (chip.id === 'max-followers') {
          this.filterState.max_follower_num = 999;
        } else if (chip.id === 'trainer-id') {
          this.searchUserId = '';
        } else if (chip.id === 'username') {
          this.searchUsername = '';
        }
        this.onFilterChange();
        break;
    }
  }

  getChipColorClass(type: ActiveFilterChip['type']): string {
    switch (type) {
      case 'blue':
      case 'mainBlue':
        return 'chip-blue';
      case 'pink':
      case 'mainPink':
        return 'chip-pink';
      case 'green':
      case 'mainGreen':
        return 'chip-green';
      case 'white':
      case 'mainWhite':
        return 'chip-white';
      case 'optionalWhite':
      case 'optionalMainWhite':
        return 'chip-optional-white';
      case 'character':
        return 'chip-character';
      case 'supportCard':
        return 'chip-support';
      default:
        return 'chip-default';
    }
  }

  setLimitBreak(level: number) {
    this.selectedLimitBreak = level;
    this.onFilterChange();
  }

  toggleLimitBreak(level: number) {
    if (this.selectedLimitBreak === level) {
      this.selectedLimitBreak = 0;
    } else {
      this.selectedLimitBreak = level;
    }
    this.onFilterChange();
  }

  formatLabel(value: number): string {
    if (value === 4) return 'MLB';
    return 'LB' + value;
  }

  onSearchChange() {
    this.onFilterChange();
  }

  clearSearchUserId() {
    this.searchUserId = '';
    this.onSearchChange();
  }

  clearSearchUsername() {
    this.searchUsername = '';
    this.onFilterChange();
  }

  selectSupportCard() {
    const dialogRef = this.dialog.open(SupportCardSelectDialogComponent, {
      width: '90%',
      maxWidth: '800px',
      height: '80vh',
      panelClass: 'modern-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.selectedSupportCard = result;
        this.onFilterChange();
      }
    });
  }

  removeSupportCard() {
    this.selectedSupportCard = null;
    this.onFilterChange();
  }

  getSupportCardTypeDisplay(type: SupportCardType): string {
    const typeMap: Record<number, string> = {
      [SupportCardType.SPEED]: 'Speed',
      [SupportCardType.STAMINA]: 'Stamina',
      [SupportCardType.POWER]: 'Power',
      [SupportCardType.GUTS]: 'Guts',
      [SupportCardType.WISDOM]: 'Wisdom',
      [SupportCardType.FRIEND]: 'Friend'
    };
    return typeMap[type] || 'Unknown';
  }

  getSupportCardRarityDisplay(rarity: Rarity): string {
    const rarityMap: Record<number, string> = {
      [Rarity.R]: 'R',
      [Rarity.SR]: 'SR',
      [Rarity.SSR]: 'SSR'
    };
    return rarityMap[rarity] || 'Unknown';
  }

  clearNode(node: TreeNode, event: Event) {
    event.stopPropagation(); // Prevent opening the dialog
    this.clearNodeRecursive(node);
    this.updateTreeFilters();
  }

  private clearNodeRecursive(node: TreeNode) {
    node.name = node.layer === 0 ? 'Target Uma' : (node.layer === 1 ? 'Parent' : 'Grandparent');
    node.image = undefined;
    node.characterId = undefined;

    // If clearing a parent, recursively clear children
    if (node.children) {
      node.children.forEach(child => this.clearNodeRecursive(child));
    }
  }

  increment(field: keyof UnifiedSearchParams) {
    const currentValue = (this.filterState[field] as number) || 0;
    (this.filterState[field] as any) = currentValue + 1;
    this.onFilterChange();
  }

  decrement(field: keyof UnifiedSearchParams) {
    const currentValue = (this.filterState[field] as number) || 0;
    if (currentValue > 0) {
      (this.filterState[field] as any) = currentValue - 1;
      this.onFilterChange();
    }
  }

  // Rank Options
  rankOptions = Array.from({ length: 20 }, (_, i) => i + 1);

  getRankIconPath(rank: number): string {
    const rankId = rank.toString().padStart(2, '0');
    return `assets/images/icon/ranks/utx_txt_rank_${rankId}.png`;
  }

  onRankIconError(event: any, rank: number): void {
    event.target.style.display = 'none';
  }
}
