import { Component, EventEmitter, Output, Input, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
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
import { LocaleNumberPipe } from '../../pipes/locale-number.pipe';
import { SupportCard, SupportCardShort, SupportCardType, Rarity } from '../../models/support-card.model';
import factorsData from '../../../data/factors.json';
import characterData from '../../../data/character.json';
import characterNamesData from '../../../data/character_names.json';
import { RaceSchedulerComponent } from '../race-scheduler/race-scheduler.component';
export interface ActiveFilterChip {
  id: string;
  label: string;
  name?: string;
  value?: string;
  showStar?: boolean;
  rankIcon?: string; // Path to rank icon image
  range?: string; // Star range like "1-9", "5+", etc.
  type: 'blue' | 'pink' | 'green' | 'white' | 'optionalWhite' | 'optionalMainWhite' | 'mainBlue' | 'mainPink' | 'mainGreen' | 'mainWhite' | 'character' | 'supportCard' | 'other' | 'blueStarSum' | 'pinkStarSum' | 'greenStarSum' | 'whiteStarSum' | 'includeMainParent' | 'includeParent' | 'excludeParent' | 'excludeMainParent' | 'raceSchedule';
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
  
  // Star sum filters (min only)
  bss?: number; // blue stars sum min
  pss?: number; // pink stars sum min
  gss?: number; // green stars sum min
  wss?: number; // white stars sum min
  
  mmwc?: number; // main parent min white count
  
  // Parent include/exclude (arrays of character IDs)
  imp?: number[]; // include main parent IDs
  ip?: number[];  // include parent IDs
  ep?: number[];  // exclude parent IDs
  emp?: number[]; // exclude main parent IDs
  // Race schedule: [yearIdx, month, half, raceInstanceId][]
  rs?: [number, number, number, number][];
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
  main_parent_id?: number[];
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
  main_parent_white_sparks?: number[][];
  min_win_count?: number;
  min_white_count?: number;
  // Star sum filtering (min only)
  min_blue_stars_sum?: number;
  min_pink_stars_sum?: number;
  min_green_stars_sum?: number;
  min_white_stars_sum?: number;
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
  main_win_saddle?: number[];
  // Parent include/exclude filters (multi-select)
  parent_id?: number[];           // Matches against both left and right parent positions
  exclude_parent_id?: number[];   // Excludes from both left and right parent positions
  exclude_main_parent_id?: number[]; // Excludes main parent IDs
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
    FormsModule,
    RaceSchedulerComponent,
    LocaleNumberPipe
  ],
  templateUrl: './advanced-filter.component.html',
  styleUrl: './advanced-filter.component.scss'
})
export class AdvancedFilterComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() resultCount: number | null = null;
  @Output() filterChange = new EventEmitter<UnifiedSearchParams>();
  @Output() maxFollowersToggled = new EventEmitter<boolean>();
  private filterChangeSubject = new Subject<UnifiedSearchParams>();
  @ViewChild(RaceSchedulerComponent) raceScheduler!: RaceSchedulerComponent;
  // Wrapping detection
  @ViewChild('mainLayout', { static: false }) mainLayoutRef!: ElementRef<HTMLElement>;
  legacyWrapped = false;
  searchWrapped = false;
  private resizeObserver?: ResizeObserver;
  private hostResizeObserver?: ResizeObserver;
  isExpanded = false;
  selectedLimitBreak = 0; // Default to LB0+
  includeMaxFollowers = false; // false = exclude max follower accounts (999), true = include (1000)
  searchUserId = ''; // Search for user ID
  searchUsername = ''; // Search for username
  selectedSupportCard: SupportCardShort | null = null;
  activeFilterChips: ActiveFilterChip[] = [];
  // Collapsible section state
  collapsedSections = new Set<string>();
  // Scroll-aware floating button state
  showFloatingBtn = false;
  floatingBtnMode: 'results' | 'top' = 'results';
  private scrollListener?: () => void;
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
  // Parent include/exclude character selections (multi-select)
  includeMainParentCharacters: { id: number; name: string; image?: string }[] = [];
  includeParentCharacters: { id: number; name: string; image?: string }[] = [];
  excludeParentCharacters: { id: number; name: string; image?: string }[] = [];
  excludeMainParentCharacters: { id: number; name: string; image?: string }[] = [];
  // Race schedule
  raceScheduleRaceCount = 0;
  ngOnInit() {
    // Default Quick Filters collapsed at all sizes
    this.collapsedSections.add('quickFilters');
    // On mobile, default all sections to collapsed
    if (window.innerWidth <= 600) {
      this.collapsedSections.add('mLegacyTree');
      this.collapsedSections.add('mSupportCard');
      this.collapsedSections.add('mSearchUsers');
      this.collapsedSections.add('inheritanceFactors');
      this.collapsedSections.add('mainParentFactors');
      this.collapsedSections.add('generalCriteria');
      this.collapsedSections.add('totalStarCount');
      this.collapsedSections.add('raceSchedule');
    }
    this.filterChangeSubject.pipe(
      debounceTime(800) // Increased to prevent rate limiting
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
    
    parent_id: [],
    exclude_parent_id: [],
    exclude_main_parent_id: [],
    
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
    private supportCardService: SupportCardService,
    private elementRef: ElementRef,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}
  ngAfterViewInit() {
    this.setupWrappingDetection();
    this.setupScrollListener();
    this.setupHostResizeObserver();
  }
  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.hostResizeObserver?.disconnect();
    this.teardownScrollListener();
  }
  private setupScrollListener() {
    this.scrollListener = () => {
      requestAnimationFrame(() => this.updateFloatingBtnState());
    };
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.scrollListener!, { passive: true });
    });
  }
  private teardownScrollListener() {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = undefined;
    }
  }
  private setupHostResizeObserver() {
    const hostEl = this.elementRef.nativeElement as HTMLElement;
    this.hostResizeObserver = new ResizeObserver(() => {
      this.updateFloatingBtnState();
    });
    this.hostResizeObserver.observe(hostEl);
  }
  private updateFloatingBtnState() {
    let newShow: boolean;
    let newMode: 'results' | 'top';

    if (!this.isExpanded) {
      const hostEl = this.elementRef.nativeElement as HTMLElement;
      const rect = hostEl.getBoundingClientRect();
      newShow = rect.bottom < 100;
      newMode = 'top';
    } else {
      const hostEl = this.elementRef.nativeElement as HTMLElement;
      const rect = hostEl.getBoundingClientRect();
      const filterBottom = rect.bottom;
      if (filterBottom > window.innerHeight) {
        newShow = true;
        newMode = 'results';
      } else {
        newShow = window.scrollY > 200;
        newMode = 'top';
      }
    }

    if (newShow !== this.showFloatingBtn || newMode !== this.floatingBtnMode) {
      this.ngZone.run(() => {
        this.showFloatingBtn = newShow;
        this.floatingBtnMode = newMode;
      });
    }
  }
  private setupWrappingDetection() {
    if (!this.mainLayoutRef) return;
    const el = this.mainLayoutRef.nativeElement;
    const detect = () => {
      const legacy = el.querySelector('.legacy-tree-wrapper') as HTMLElement;
      const supportLb = el.querySelector('.support-lb-group') as HTMLElement;
      const search = el.querySelector('.search-wrapper') as HTMLElement;
      if (!legacy || !supportLb || !search) return;
      // Temporarily remove wrapping classes to measure natural positions
      legacy.classList.remove('is-wrapped');
      supportLb.classList.remove('is-wrapped');
      search.classList.remove('is-wrapped');
      // Force layout recalc
      const legacyTop = legacy.offsetTop;
      const supportTop = supportLb.offsetTop;
      const searchTop = search.offsetTop;
      const newLegacyWrapped = supportTop > legacyTop + 10;
      const newSearchWrapped = searchTop > supportTop + 10;
      if (newLegacyWrapped !== this.legacyWrapped || newSearchWrapped !== this.searchWrapped) {
        this.ngZone.run(() => {
          this.legacyWrapped = newLegacyWrapped;
          this.searchWrapped = newSearchWrapped;
        });
      } else {
        // Re-apply classes since Angular won't re-render
        if (this.legacyWrapped) { legacy.classList.add('is-wrapped'); supportLb.classList.add('is-wrapped'); }
        if (this.searchWrapped) search.classList.add('is-wrapped');
      }
    };
    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => detect());
      this.resizeObserver.observe(el);
    });
    // Initial check
    setTimeout(() => detect(), 0);
  }
  scrollToResults() {
    // Scroll past the filter to the results section
    const hostEl = this.elementRef.nativeElement as HTMLElement;
    const rect = hostEl.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top + rect.height - 60;
    window.scrollTo({ top: scrollTop, behavior: 'smooth' });
  }
  scrollToTop() {
    const hostEl = this.elementRef.nativeElement as HTMLElement;
    const rect = hostEl.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top - 20;
    window.scrollTo({ top: scrollTop, behavior: 'smooth' });
  }
  onFloatingBtnClick() {
    if (this.floatingBtnMode === 'results') {
      this.scrollToResults();
    } else {
      this.scrollToTop();
    }
  }
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
    if (this.includeMaxFollowers) state.mf = 1000;
    
    // Star sum filters (min only)
    if (this.filterState.min_blue_stars_sum) state.bss = this.filterState.min_blue_stars_sum;
    if (this.filterState.min_pink_stars_sum) state.pss = this.filterState.min_pink_stars_sum;
    if (this.filterState.min_green_stars_sum) state.gss = this.filterState.min_green_stars_sum;
    if (this.filterState.min_white_stars_sum) state.wss = this.filterState.min_white_stars_sum;
    
    // Main parent min white count
    if (this.filterState.min_main_white_count) state.mmwc = this.filterState.min_main_white_count;
    // Parent include/exclude
    if (this.includeMainParentCharacters.length) state.imp = this.includeMainParentCharacters.map(c => c.id);
    if (this.includeParentCharacters.length) state.ip = this.includeParentCharacters.map(c => c.id);
    if (this.excludeParentCharacters.length) state.ep = this.excludeParentCharacters.map(c => c.id);
    if (this.excludeMainParentCharacters.length) state.emp = this.excludeMainParentCharacters.map(c => c.id);
    if (this.raceScheduler) {
      const encoded = this.raceScheduler.getEncodedSelection();
      if (encoded.length) state.rs = encoded;
    }
    return btoa(JSON.stringify(state));
  }
  loadSerializedState(stateStr: string) {
    try {
      const state: CompressedState = JSON.parse(atob(stateStr));
      
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
            const charaId = Math.floor(id / 100).toString();
            const nameEntry = (characterNamesData as any)[charaId];
            const char = characterData.find((c: any) => parseInt(c.id, 10) === id);
            if (nameEntry || char) {
              node.name = nameEntry?.name || char?.name || `ID: ${id}`;
              node.image = char?.image;
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
      if (state.mf !== undefined) {
        this.filterState.max_follower_num = state.mf;
        this.includeMaxFollowers = state.mf >= 1000;
        this.maxFollowersToggled.emit(this.includeMaxFollowers);
      }
      
      // Star sum filters (min only, with backwards compatibility for old [min, max] format)
      if (state.bss !== undefined) {
        this.filterState.min_blue_stars_sum = Array.isArray(state.bss) ? state.bss[0] : state.bss;
      }
      if (state.pss !== undefined) {
        this.filterState.min_pink_stars_sum = Array.isArray(state.pss) ? state.pss[0] : state.pss;
      }
      if (state.gss !== undefined) {
        this.filterState.min_green_stars_sum = Array.isArray(state.gss) ? state.gss[0] : state.gss;
      }
      if (state.wss !== undefined) {
        this.filterState.min_white_stars_sum = Array.isArray(state.wss) ? state.wss[0] : state.wss;
      }
      
      // Main parent min white count
      if (state.mmwc !== undefined) {
        this.filterState.min_main_white_count = state.mmwc;
      }
      // Restore parent include/exclude
      this.includeMainParentCharacters = [];
      this.includeParentCharacters = [];
      this.excludeParentCharacters = [];
      this.excludeMainParentCharacters = [];
      const restoreParentChars = (ids: number[] | undefined, target: { id: number; name: string; image?: string }[]) => {
        if (!ids) return;
        ids.forEach(id => {
          const charaId = Math.floor(id / 100).toString();
          const nameEntry = (characterNamesData as any)[charaId];
          const char = characterData.find((c: any) => parseInt(c.id, 10) === id);
          if (nameEntry || char) {
            target.push({ id, name: nameEntry?.name || char?.name || `ID: ${id}`, image: char?.image });
          } else {
            target.push({ id, name: `ID: ${id}` });
          }
        });
      };
      restoreParentChars(state.imp, this.includeMainParentCharacters);
      restoreParentChars(state.ip, this.includeParentCharacters);
      restoreParentChars(state.ep, this.excludeParentCharacters);
      restoreParentChars(state.emp, this.excludeMainParentCharacters);
      // Restore race schedule
      if (state.rs && this.raceScheduler) {
        this.raceScheduler.setEncodedSelection(state.rs as [number, number, number, number][]);
        this.raceScheduleRaceCount = this.raceScheduler.selectedRaceIds.size;
        this.filterState.main_win_saddle = this.raceScheduleRaceCount > 0
          ? this.raceScheduler.getSelectedSaddleIds()
          : undefined;
      }
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
    name: 'Target Character',
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
    // Recalculate floating button state after animation settles
    setTimeout(() => this.updateFloatingBtnState(), 350);
  }
  toggleSection(section: string) {
    if (this.collapsedSections.has(section)) {
      this.collapsedSections.delete(section);
    } else {
      this.collapsedSections.add(section);
    }
  }
  isSectionCollapsed(section: string): boolean {
    return this.collapsedSections.has(section);
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
        const newBaseId = Math.floor(result.id / 100);
        // Layer-aware duplicate removal
        if (node.layer === 0) {
          // Adding to Target: conflicts with Main Parent only
          this.clearFromMainParents(newBaseId);
        } else if (node.layer === 1) {
          // Adding to Main Parent: conflicts with Target + Grandparents
          this.clearFromTarget(newBaseId);
          this.clearFromGrandparents(newBaseId);
          this.clearFromMainParentNodes(newBaseId); // same-level dedup
        } else {
          // Adding to Grandparent: conflicts with Main Parent only
          this.clearFromMainParents(newBaseId);
          this.clearFromGrandparentNodes(newBaseId); // same-level dedup
        }
        node.name = result.name;
        node.image = result.image;
        node.characterId = result.id;
        
        this.updateTreeFilters();
      }
    });
  }
  /** Clear character from Target tree node */
  private clearFromTarget(baseId: number) {
    if (this.treeData.characterId && Math.floor(this.treeData.characterId / 100) === baseId) {
      this.treeData.name = 'Target Character';
      this.treeData.image = undefined;
      this.treeData.characterId = undefined;
    }
  }
  /** Clear character from Main Parent tree nodes + include main parent list (not excludes) */
  private clearFromMainParents(baseId: number) {
    this.clearFromMainParentNodes(baseId);
    this.includeMainParentCharacters = this.includeMainParentCharacters.filter(c => Math.floor(c.id / 100) !== baseId);
  }
  /** Clear character from Main Parent tree nodes only */
  private clearFromMainParentNodes(baseId: number) {
    if (this.treeData.children) {
      for (const child of this.treeData.children) {
        if (child.characterId && Math.floor(child.characterId / 100) === baseId) {
          child.name = 'Parent';
          child.image = undefined;
          child.characterId = undefined;
        }
      }
    }
  }
  /** Clear character from Grandparent tree nodes + include parent list (not excludes) */
  private clearFromGrandparents(baseId: number) {
    this.clearFromGrandparentNodes(baseId);
    this.includeParentCharacters = this.includeParentCharacters.filter(c => Math.floor(c.id / 100) !== baseId);
  }
  /** Clear character from Grandparent tree nodes only */
  private clearFromGrandparentNodes(baseId: number) {
    if (this.treeData.children) {
      for (const child of this.treeData.children) {
        if (child.children) {
          for (const grandchild of child.children) {
            if (grandchild.characterId && Math.floor(grandchild.characterId / 100) === baseId) {
              grandchild.name = 'Grandparent';
              grandchild.image = undefined;
              grandchild.characterId = undefined;
            }
          }
        }
      }
    }
  }
  updateTreeFilters() {
    this.filterState.player_chara_id = this.treeData.characterId;
    
    // Main parent: combine tree selection with include list
    const mainParentIds: number[] = [];
    const mainParent = this.treeData.children?.[0];
    if (mainParent?.characterId) {
      mainParentIds.push(mainParent.characterId);
    }
    this.includeMainParentCharacters.forEach(c => {
      if (!mainParentIds.includes(c.id)) mainParentIds.push(c.id);
    });
    this.filterState.main_parent_id = mainParentIds.length > 0 ? mainParentIds : undefined;
    if (mainParent && mainParent.children) {
      this.filterState.parent_left_id = mainParent.children[0]?.characterId;
      this.filterState.parent_right_id = mainParent.children[1]?.characterId;
    }
    // Sync parent include/exclude arrays
    this.filterState.parent_id = this.includeParentCharacters.map(c => c.id);
    this.filterState.exclude_parent_id = this.excludeParentCharacters.map(c => c.id);
    this.filterState.exclude_main_parent_id = this.excludeMainParentCharacters.map(c => c.id);
    
    this.onFilterChange();
  }
  // --- Parent Include/Exclude Character Selection ---
  addIncludeParent() {
    const dialogRef = this.dialog.open(CharacterSelectDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      height: '80vh',
      panelClass: 'modern-dialog-panel',
      data: {
        multiSelect: true,
        existingIds: this.includeParentCharacters.map(c => c.id),
        mode: 'include'
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result && Array.isArray(result)) {
        result.forEach((char: any) => {
          if (!this.includeParentCharacters.some(c => c.id === char.id)) {
            // Grandparent: conflicts with Main Parent only
            const baseId = Math.floor(char.id / 100);
            this.clearFromMainParents(baseId);
            this.clearFromGrandparentNodes(baseId);
            // Remove from exclude grandparent list (can't include + exclude same role)
            this.excludeParentCharacters = this.excludeParentCharacters.filter(c => Math.floor(c.id / 100) !== baseId);
            this.includeParentCharacters.push({ id: char.id, name: char.name, image: char.image });
          }
        });
        this.updateTreeFilters();
      }
    });
  }
  removeIncludeParent(index: number) {
    this.includeParentCharacters.splice(index, 1);
    this.updateTreeFilters();
  }
  addExcludeParent() {
    const dialogRef = this.dialog.open(CharacterSelectDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      height: '80vh',
      panelClass: 'modern-dialog-panel',
      data: {
        multiSelect: true,
        existingIds: this.excludeParentCharacters.map(c => c.id),
        mode: 'exclude'
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result && Array.isArray(result)) {
        result.forEach((char: any) => {
          if (!this.excludeParentCharacters.some(c => c.id === char.id)) {
            // Remove from include grandparent list (can't include + exclude same role)
            const baseId = Math.floor(char.id / 100);
            this.includeParentCharacters = this.includeParentCharacters.filter(c => Math.floor(c.id / 100) !== baseId);
            this.excludeParentCharacters.push({ id: char.id, name: char.name, image: char.image });
          }
        });
        this.updateTreeFilters();
      }
    });
  }
  removeExcludeParent(index: number) {
    this.excludeParentCharacters.splice(index, 1);
    this.updateTreeFilters();
  }
  addIncludeMainParent() {
    const dialogRef = this.dialog.open(CharacterSelectDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      height: '80vh',
      panelClass: 'modern-dialog-panel',
      data: {
        multiSelect: true,
        existingIds: this.includeMainParentCharacters.map(c => c.id),
        mode: 'include'
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result && Array.isArray(result)) {
        result.forEach((char: any) => {
          if (!this.includeMainParentCharacters.some(c => c.id === char.id)) {
            // Main Parent: conflicts with Target + Grandparents
            const baseId = Math.floor(char.id / 100);
            this.clearFromTarget(baseId);
            this.clearFromGrandparents(baseId);
            this.clearFromMainParentNodes(baseId);
            // Remove from exclude main parent list (can't include + exclude same role)
            this.excludeMainParentCharacters = this.excludeMainParentCharacters.filter(c => Math.floor(c.id / 100) !== baseId);
            this.includeMainParentCharacters.push({ id: char.id, name: char.name, image: char.image });
          }
        });
        this.updateTreeFilters();
      }
    });
  }
  removeIncludeMainParent(index: number) {
    this.includeMainParentCharacters.splice(index, 1);
    this.updateTreeFilters();
  }
  addExcludeMainParent() {
    const dialogRef = this.dialog.open(CharacterSelectDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      height: '80vh',
      panelClass: 'modern-dialog-panel',
      data: {
        multiSelect: true,
        existingIds: this.excludeMainParentCharacters.map(c => c.id),
        mode: 'exclude'
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result && Array.isArray(result)) {
        result.forEach((char: any) => {
          if (!this.excludeMainParentCharacters.some(c => c.id === char.id)) {
            // Remove from include main parent list (can't include + exclude same role)
            const baseId = Math.floor(char.id / 100);
            this.includeMainParentCharacters = this.includeMainParentCharacters.filter(c => Math.floor(c.id / 100) !== baseId);
            this.excludeMainParentCharacters.push({ id: char.id, name: char.name, image: char.image });
          }
        });
        this.updateTreeFilters();
      }
    });
  }
  removeExcludeMainParent(index: number) {
    this.excludeMainParentCharacters.splice(index, 1);
    this.updateTreeFilters();
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
    // Sanitize star sum filters - convert null to undefined and clamp values
    // Blue, Pink, Green max is 9; White has no max
    if (this.filterState.min_blue_stars_sum == null || this.filterState.min_blue_stars_sum <= 0) {
      this.filterState.min_blue_stars_sum = undefined;
    } else if (this.filterState.min_blue_stars_sum > 9) {
      this.filterState.min_blue_stars_sum = 9;
    }
    
    if (this.filterState.min_pink_stars_sum == null || this.filterState.min_pink_stars_sum <= 0) {
      this.filterState.min_pink_stars_sum = undefined;
    } else if (this.filterState.min_pink_stars_sum > 9) {
      this.filterState.min_pink_stars_sum = 9;
    }
    
    if (this.filterState.min_green_stars_sum == null || this.filterState.min_green_stars_sum <= 0) {
      this.filterState.min_green_stars_sum = undefined;
    } else if (this.filterState.min_green_stars_sum > 9) {
      this.filterState.min_green_stars_sum = 9;
    }
    
    if (this.filterState.min_white_stars_sum == null || this.filterState.min_white_stars_sum <= 0) {
      this.filterState.min_white_stars_sum = undefined;
    }
    // White stars have no max limit
    
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
    this.filterState.main_parent_white_sparks = this.generateSparkIdGroups(this.mainWhiteFactorFilters, this.whiteFactors, 3);
    // min_main_white_count is handled by the input field directly, do not overwrite it here based on specific factor filters.
    // Optional White Sparks (just IDs, no levels - for scoring/sorting)
    this.filterState.optional_white_sparks = this.optionalWhiteFactorFilters
      .filter(f => f.factorId && f.factorId > 0)
      .map(f => f.factorId!);
    
    this.filterState.optional_main_white_sparks = this.optionalMainWhiteFactorFilters
      .filter(f => f.factorId && f.factorId > 0)
      .map(f => f.factorId!);
    // Race schedule saddle IDs
    if (!this.filterState.main_win_saddle?.length) {
      this.filterState.main_win_saddle = undefined;
    }
    // Sync parent include/exclude arrays to filterState
    // (updateTreeFilters handles main_parent_id merging, but include/exclude need to be synced here too
    //  so they're always up-to-date even when no tree is set)
    const includeParentIds = this.includeParentCharacters.map(c => c.id);
    this.filterState.parent_id = includeParentIds.length > 0 ? includeParentIds : this.filterState.parent_id;
    this.filterState.exclude_parent_id = this.excludeParentCharacters.map(c => c.id);
    this.filterState.exclude_main_parent_id = this.excludeMainParentCharacters.map(c => c.id);
    // Sync include main parent characters into main_parent_id (merge with tree selection)
    if (this.includeMainParentCharacters.length > 0) {
      const existingMainIds = this.filterState.main_parent_id || [];
      this.includeMainParentCharacters.forEach(c => {
        if (!existingMainIds.includes(c.id)) existingMainIds.push(c.id);
      });
      this.filterState.main_parent_id = existingMainIds;
    }
    // Update active filter chips
    this.updateActiveFilterChips();
    // Emit a shallow copy of the filter state to ensure change detection
    this.filterChangeSubject.next({ ...this.filterState });
  }
  onRaceSelectionChanged(raceIds: number[]): void {
    this.raceScheduleRaceCount = raceIds.length;
    this.filterState.main_win_saddle = raceIds.length > 0
      ? this.raceScheduler.getSelectedSaddleIds()
      : undefined;
    this.onFilterChange();
  }

  private updateActiveFilterChips(): void {
    this.activeFilterChips = [];
    // Helper to format value part
    const formatValue = (min: number, max: number, maxPossible: number = 9): string => {
      // Clamp max to maxPossible (e.g., main parent factors cap at 3)
      const clampedMax = Math.min(max, maxPossible);
      
      if (min === clampedMax) {
        return `${min}`;
      } else if (min === 1 && clampedMax === maxPossible) {
        return `${min}-${clampedMax}`;
      } else if (min > 1 && clampedMax === maxPossible) {
        return `${min}+`;
      } else if (min === 1 && clampedMax < maxPossible) {
        return `≤${clampedMax}`;
      } else {
        return `${min}-${clampedMax}`;
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
    // Include Main Parent Characters (multi-select)
    this.includeMainParentCharacters.forEach((char, index) => {
      this.activeFilterChips.push({
        id: `include-main-parent-${index}`,
        label: `Include Main: ${char.name}`,
        name: 'Inc. Main',
        value: char.name,
        type: 'includeMainParent',
        filterIndex: index
      });
    });
    // Include Parent Characters (multi-select)
    this.includeParentCharacters.forEach((char, index) => {
      this.activeFilterChips.push({
        id: `include-parent-${index}`,
        label: `Include Parent: ${char.name}`,
        name: 'Inc. Parent',
        value: char.name,
        type: 'includeParent',
        filterIndex: index
      });
    });
    // Exclude Parent Characters (multi-select)
    this.excludeParentCharacters.forEach((char, index) => {
      this.activeFilterChips.push({
        id: `exclude-parent-${index}`,
        label: `Exclude Parent: ${char.name}`,
        name: 'Excl. Parent',
        value: char.name,
        type: 'excludeParent',
        filterIndex: index
      });
    });
    // Exclude Main Parent Characters (multi-select)
    this.excludeMainParentCharacters.forEach((char, index) => {
      this.activeFilterChips.push({
        id: `exclude-main-parent-${index}`,
        label: `Exclude Main: ${char.name}`,
        name: 'Excl. Main',
        value: char.name,
        type: 'excludeMainParent',
        filterIndex: index
      });
    });
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
    // Main Parent Min White Count
    if (this.filterState.min_main_white_count && this.filterState.min_main_white_count > 0) {
      this.activeFilterChips.push({
        id: 'main-min-white',
        label: `Main White: ${this.filterState.min_main_white_count}+`,
        name: 'Main White',
        value: `${this.filterState.min_main_white_count}+`,
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
        rankIcon: this.getRankIconPath(this.filterState.parent_rank),
        type: 'other'
      });
    }
    // Max Followers
    if (this.includeMaxFollowers) {
      this.activeFilterChips.push({
        id: 'max-followers',
        label: 'Max Followers: Included',
        name: 'Max Followers',
        value: 'Included',
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
    // Star Sum Filters (min only)
    if (this.filterState.min_blue_stars_sum) {
      this.activeFilterChips.push({
        id: 'blue-stars-sum',
        label: `Total Blue ★: ≥${this.filterState.min_blue_stars_sum}`,
        name: 'Total Blue ★',
        value: `≥${this.filterState.min_blue_stars_sum}`,
        type: 'blueStarSum'
      });
    }
    if (this.filterState.min_pink_stars_sum) {
      this.activeFilterChips.push({
        id: 'pink-stars-sum',
        label: `Total Pink ★: ≥${this.filterState.min_pink_stars_sum}`,
        name: 'Total Pink ★',
        value: `≥${this.filterState.min_pink_stars_sum}`,
        type: 'pinkStarSum'
      });
    }
    if (this.filterState.min_green_stars_sum) {
      this.activeFilterChips.push({
        id: 'green-stars-sum',
        label: `Total Green ★: ≥${this.filterState.min_green_stars_sum}`,
        name: 'Total Green ★',
        value: `≥${this.filterState.min_green_stars_sum}`,
        type: 'greenStarSum'
      });
    }
    if (this.filterState.min_white_stars_sum) {
      this.activeFilterChips.push({
        id: 'white-stars-sum',
        label: `Total White ★: ≥${this.filterState.min_white_stars_sum}`,
        name: 'Total White ★',
        value: `≥${this.filterState.min_white_stars_sum}`,
        type: 'whiteStarSum'
      });
    }
    // Race Schedule
    if (this.raceScheduleRaceCount > 0) {
      this.activeFilterChips.push({
        id: 'race-schedule',
        label: `Race Schedule: ${this.raceScheduleRaceCount} race${this.raceScheduleRaceCount !== 1 ? 's' : ''}`,
        name: 'Race Schedule',
        value: `${this.raceScheduleRaceCount}`,
        type: 'raceSchedule'
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
      case 'includeMainParent':
        if (chip.filterIndex !== undefined) {
          this.removeIncludeMainParent(chip.filterIndex);
        }
        break;
      case 'includeParent':
        if (chip.filterIndex !== undefined) {
          this.removeIncludeParent(chip.filterIndex);
        }
        break;
      case 'excludeParent':
        if (chip.filterIndex !== undefined) {
          this.removeExcludeParent(chip.filterIndex);
        }
        break;
      case 'excludeMainParent':
        if (chip.filterIndex !== undefined) {
          this.removeExcludeMainParent(chip.filterIndex);
        }
        break;
      case 'blueStarSum':
        this.filterState.min_blue_stars_sum = undefined;
        this.onFilterChange();
        break;
      case 'pinkStarSum':
        this.filterState.min_pink_stars_sum = undefined;
        this.onFilterChange();
        break;
      case 'greenStarSum':
        this.filterState.min_green_stars_sum = undefined;
        this.onFilterChange();
        break;
      case 'whiteStarSum':
        this.filterState.min_white_stars_sum = undefined;
        this.onFilterChange();
        break;
      case 'raceSchedule':
        if (this.raceScheduler) {
          this.raceScheduler.cellSelection.clear();
        }
        this.raceScheduleRaceCount = 0;
        this.filterState.main_win_saddle = undefined;
        this.onFilterChange();
        break;
      case 'other':
        if (chip.id === 'limit-break') {
          this.selectedLimitBreak = 0;
        } else if (chip.id === 'min-wins') {
          this.filterState.min_win_count = 0;
        } else if (chip.id === 'min-white') {
          this.filterState.min_white_count = 0;
        } else if (chip.id === 'main-min-white') {
          this.filterState.min_main_white_count = 0;
        } else if (chip.id === 'parent-rank') {
          this.filterState.parent_rank = 1;
        } else if (chip.id === 'max-followers') {
          this.includeMaxFollowers = false;
          this.filterState.max_follower_num = 999;
          this.maxFollowersToggled.emit(false);
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
      case 'blueStarSum':
        return 'chip-blue';
      case 'pink':
      case 'mainPink':
      case 'pinkStarSum':
        return 'chip-pink';
      case 'green':
      case 'mainGreen':
      case 'greenStarSum':
        return 'chip-green';
      case 'white':
      case 'mainWhite':
      case 'whiteStarSum':
        return 'chip-white';
      case 'optionalWhite':
      case 'optionalMainWhite':
        return 'chip-optional-white';
      case 'character':
      case 'includeMainParent':
      case 'includeParent':
        return 'chip-character';
      case 'excludeParent':
      case 'excludeMainParent':
        return 'chip-exclude';
      case 'supportCard':
        return 'chip-support';
      case 'raceSchedule':
        return 'chip-green';
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
      width: '700px',
      maxWidth: '90vw',
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
    node.name = node.layer === 0 ? 'Target Character' : (node.layer === 1 ? 'Parent' : 'Grandparent');
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
  incrementStarSum(field: keyof UnifiedSearchParams, max?: number) {
    const currentValue = (this.filterState[field] as number) || 0;
    if (max === undefined || currentValue < max) {
      (this.filterState[field] as any) = currentValue + 1;
      this.onFilterChange();
    }
  }
  decrementStarSum(field: keyof UnifiedSearchParams) {
    const currentValue = (this.filterState[field] as number) || 0;
    if (currentValue > 0) {
      (this.filterState[field] as any) = currentValue - 1;
      this.onFilterChange();
    }
  }
  // Rank Options
  rankOptions = Array.from({ length: 20 }, (_, i) => i + 1);
  toggleMaxFollowers(checked: boolean) {
    this.includeMaxFollowers = checked;
    this.filterState.max_follower_num = checked ? 1000 : 999;
    this.maxFollowersToggled.emit(checked);
    this.onFilterChange();
  }
  getRankIconPath(rank: number): string {
    const rankId = rank.toString().padStart(2, '0');
    return `assets/images/icon/ranks/utx_txt_rank_${rankId}.png`;
  }
  onRankIconError(event: any, rank: number): void {
    event.target.style.display = 'none';
  }
  // Star Sum Helpers
  getStarSumValue(type: 'blue' | 'pink' | 'green' | 'white'): number | undefined {
    switch (type) {
      case 'blue': return this.filterState.min_blue_stars_sum;
      case 'pink': return this.filterState.min_pink_stars_sum;
      case 'green': return this.filterState.min_green_stars_sum;
      case 'white': return this.filterState.min_white_stars_sum;
    }
  }
  onStarSumOpened(opened: boolean): void {
    // Optional: Handle dropdown open state if needed
  }
}
