import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChildren, QueryList, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { VeteranDetailDialogComponent, VeteranDetailData } from './veteran-detail-dialog.component';
import { CharacterSelectDialogComponent } from '../../inheritance-database/character-select-dialog.component';
import { RaceSchedulerComponent } from '../../../components/race-scheduler/race-scheduler.component';
import { RankBadgeComponent } from '../../../components/rank-badge/rank-badge.component';
import { LocaleNumberPipe } from '../../../pipes/locale-number.pipe';
import RACE_DATA from '../../../../data/race_to_saddle_mapping.json';
import { ProfileService } from '../../../services/profile.service';
import { FactorService, SparkInfo } from '../../../services/factor.service';
import { VeteranMember, SuccessionChara, FactorInfoEntry } from '../../../models/profile.model';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { SKILLS } from '../../../data/skills-data';
import {
  getAptGrade, getRankGrade, getRankGradeColor, getStarDisplay,
  getDistanceName, getRunningStyleName, getScenarioName, getTotalStats,
  getCardImage, getSkillName, getSkillLevel, getSkillIcon, getSkillRarityClass,
  getCharacterName, getAptIcon,
} from '../profile-helpers';

type SortField = 'total' | 'speed' | 'stamina' | 'power' | 'guts' | 'wiz' | 'rank_score' | 'blue' | 'pink' | 'green' | 'name';
type ViewMode = 'grid' | 'table';
type FactorColor = 'blue' | 'pink' | 'green' | 'white';

interface ResolvedFactor {
  id: number;
  level: number;
  name: string;
  type: number;
  color: FactorColor;
}

interface SkillOption {
  id: number;
  name: string;
  rarity: number;
}

interface SkillFilter {
  skillId: number | null;
  name: string;
  searchQuery: string;
  searchResults: SkillOption[];
}

type SparkScope = 'any' | 'parent' | 'grandparent' | 'greatgrandparent';

interface FactorFilter {
  factorId: string | null;
  name: string;
  color: FactorColor;
  minLevel: number;
  scope: SparkScope;
  searchQuery: string;
  searchResults: { id: string; name: string; type: number; color: FactorColor }[];
}

interface SparkTotals {
  blue: number;
  pink: number;
  green: number;
  white: number;
}

interface CharacterOption {
  id: number;
  name: string;
  image: string | null;
}

interface SkillDisplay {
  encodedId: number;
  icon: string | null;
  name: string;
  level: number;
  rarityClass: string;
}

interface VeteranDisplay {
  veteran: VeteranMember;
  characterName: string;
  cardImage: string | null;
  scenarioName: string;
  distanceName: string;
  runningStyleName: string;
  rankGrade: string;
  rankGradeColor: string;
  totalStats: number;
  starDisplay: { filled: boolean; talent: boolean }[];
  affinityScore: number | null;
  // Pre-computed aptitude grades
  aptTurf: string; aptDirt: string;
  aptSprint: string; aptMile: string; aptMiddle: string; aptLong: string;
  aptNige: string; aptSenko: string; aptSashi: string; aptOikomi: string;
  // Pre-computed skills
  skills: SkillDisplay[];
  // Pre-computed factors
  factors: ResolvedFactor[];
  coloredFactors: ResolvedFactor[];
  whiteStarSum: number;
  sparkTotals: SparkTotals;
  parentSparkTotals: SparkTotals;
  gpSparkTotals: SparkTotals;
  // Pre-computed inheritance
  successionParents: (SuccessionChara & {
    _name: string; _image: string | null; _factors: ResolvedFactor[];
    _gps: (SuccessionChara & { _name: string; _image: string | null; _factors: ResolvedFactor[] })[];
  })[];
}

const APT_GRADES = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

@Component({
  selector: 'app-veterans',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatAutocompleteModule, MatTooltipModule, MatDialogModule, MatSliderModule,
    MatButtonToggleModule, RaceSchedulerComponent, RankBadgeComponent,
    LocaleNumberPipe,
  ],
  templateUrl: './veterans.component.html',
  styleUrls: ['./veterans.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VeteransComponent implements OnInit, OnDestroy, AfterViewInit {
  veterans: VeteranMember[] = [];
  filtered: VeteranMember[] = [];
  displayed: VeteranDisplay[] = [];
  pageSize = 24;
  loading = true;
  uploading = false;
  uploadFeedback: { type: 'success' | 'error'; message: string } | null = null;
  isOwnProfile = false;
  accountId = '';

  // View & sort
  viewMode: ViewMode = 'grid';
  displayTab: 'cards' | 'inheritance' = 'cards';
  sortField: SortField = 'total';
  sortDir: 'asc' | 'desc' = 'desc';
  searchQuery = '';


  // Filters
  showFilters = false;
  filterDistance: number | null = null;
  filterStyle: number | null = null;
  filterMinTotal = 0;

  // Advanced filters
  expandedSections: Record<string, boolean> = {};

  // 1. Stat range filters (min/max within data bounds)
  filterSpeedMin = 0; filterSpeedMax = 1500;
  filterStaminaMin = 0; filterStaminaMax = 1500;
  filterPowerMin = 0; filterPowerMax = 1500;
  filterGutsMin = 0; filterGutsMax = 1500;
  filterWizMin = 0; filterWizMax = 1500;

  // Stat bounds computed from loaded data
  statBoundsMin = { speed: 0, stamina: 0, power: 0, guts: 0, wiz: 0 };
  statBoundsMax = { speed: 1500, stamina: 1500, power: 1500, guts: 1500, wiz: 1500 };

  // Pre-computed tick arrays (avoids method calls in template during CD cascades)
  statTicks: Record<string, { value: number; label: boolean; percent: number }[]> = {
    speed: [], stamina: [], power: [], guts: [], wiz: []
  };

  // Once expanded, keep sliders alive to avoid re-init CD storms
  statsSectionRendered = false;

  // 2. Aptitude filters
  filterAptTurf: string | null = null;
  filterAptDirt: string | null = null;
  filterAptSprint: string | null = null;
  filterAptMile: string | null = null;
  filterAptMiddle: string | null = null;
  filterAptLong: string | null = null;
  filterAptNige: string | null = null;
  filterAptSenko: string | null = null;
  filterAptSashi: string | null = null;
  filterAptOikomi: string | null = null;
  aptGrades = APT_GRADES;

  // 3. Skills
  skillFilters: SkillFilter[] = [];
  skillSearchOpen = false;

  // 4. Include/exclude parents
  includeParents: CharacterOption[] = [];
  excludeParents: CharacterOption[] = [];
  includeGrandParents: CharacterOption[] = [];
  excludeGrandParents: CharacterOption[] = [];
  includeGreatGrandParents: CharacterOption[] = [];
  excludeGreatGrandParents: CharacterOption[] = [];

  // 5. Spark / Factor filters on parents
  parentFactorFilters: FactorFilter[] = [];
  factorSearchOpen = false;
  sparkScopes: { value: SparkScope; label: string; short: string }[] = [
    { value: 'any', label: 'Any', short: 'Any' },
    { value: 'parent', label: 'Parent', short: 'P' },
    { value: 'grandparent', label: 'Grand Parent', short: 'GP' },
    { value: 'greatgrandparent', label: 'Grand Grand Parent', short: 'GGP' },
  ];

  // 6. Race schedule filter
  filterSelectedRaceIds: number[] = [];

  // Drag state
  dragOver = false;

  @ViewChildren('scrollSentinel') scrollSentinels!: QueryList<ElementRef>;
  private scrollObserver?: IntersectionObserver;

  private ctxSub?: Subscription;
  private filterChange$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private profileService: ProfileService,
    private factorService: FactorService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) { }

  ngOnInit(): void {
    this.filterChange$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilters();
      this.cdr.markForCheck();
    });
    this.ctxSub = this.profileService.profileCtx$.subscribe(ctx => {
      this.isOwnProfile = ctx.isOwnProfile;
      if (ctx.profile) {
        this.accountId = ctx.profile.trainer.account_id;
        this.veterans = ctx.profile.veterans ?? [];
        this.loading = false;
        this.computeStatBounds();
        this.applyFilters();
      }
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    this.setupScrollObserver();
    this.scrollSentinels.changes.subscribe(() => this.setupScrollObserver());
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
    this.ctxSub?.unsubscribe();
  }

  private setupScrollObserver(): void {
    this.scrollObserver?.disconnect();
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting) && this.displayed.length < this.filtered.length) {
          this.ngZone.run(() => this.showMore());
        }
      },
      { rootMargin: '200px' }
    );
    this.scrollSentinels.forEach(el => this.scrollObserver!.observe(el.nativeElement));
  }

  // ── Upload ────────────────────────────────────

  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragOver = true; }
  onDragLeave(): void { this.dragOver = false; }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processFile(file);
    input.value = '';
  }

  private processFile(file: File): void {
    if (!file.name.endsWith('.json')) {
      this.uploadFeedback = { type: 'error', message: 'Only .json files are accepted.' };
      return;
    }
    this.uploading = true;
    this.uploadFeedback = null;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const arr = Array.isArray(raw) ? raw : [raw];
        this.profileService.ingestVeteranList(arr, this.accountId).subscribe({
          next: res => {
            this.uploading = false;
            this.uploadFeedback = { type: 'success', message: `Done — ${res.inserted} added, ${res.updated} updated, ${res.total} total.` };
            this.cdr.markForCheck();
            // Reload profile to pick up new veterans
            this.profileService.getProfile(this.accountId).subscribe(p => {
              this.profileService.patchProfileCtx({ profile: p });
            });
          },
          error: () => {
            this.uploading = false;
            this.uploadFeedback = { type: 'error', message: 'Upload failed. Check format and try again.' };
            this.cdr.markForCheck();
          },
        });
      } catch {
        this.uploading = false;
        this.uploadFeedback = { type: 'error', message: 'Invalid JSON file.' };
        this.cdr.markForCheck();
      }
    };
    reader.readAsText(file);
  }

  // ── Filters & sort ────────────────────────────

  applyFilters(): void {
    let list = [...this.veterans];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(v => {
        const name = getCharacterName(v.card_id).toLowerCase();
        return name.includes(q);
      });
    }

    if (this.filterDistance != null) {
      list = list.filter(v => v.distance_type === this.filterDistance);
    }
    if (this.filterStyle != null) {
      list = list.filter(v => v.running_style === this.filterStyle);
    }
    if (this.filterMinTotal > 0) {
      list = list.filter(v => getTotalStats(v) >= this.filterMinTotal);
    }

    // Stat range filters
    if (this.filterSpeedMin > this.statBoundsMin.speed || this.filterSpeedMax < this.statBoundsMax.speed)
      list = list.filter(v => { const s = v.speed ?? 0; return s >= this.filterSpeedMin && s <= this.filterSpeedMax; });
    if (this.filterStaminaMin > this.statBoundsMin.stamina || this.filterStaminaMax < this.statBoundsMax.stamina)
      list = list.filter(v => { const s = v.stamina ?? 0; return s >= this.filterStaminaMin && s <= this.filterStaminaMax; });
    if (this.filterPowerMin > this.statBoundsMin.power || this.filterPowerMax < this.statBoundsMax.power)
      list = list.filter(v => { const s = v.power ?? 0; return s >= this.filterPowerMin && s <= this.filterPowerMax; });
    if (this.filterGutsMin > this.statBoundsMin.guts || this.filterGutsMax < this.statBoundsMax.guts)
      list = list.filter(v => { const s = v.guts ?? 0; return s >= this.filterGutsMin && s <= this.filterGutsMax; });
    if (this.filterWizMin > this.statBoundsMin.wiz || this.filterWizMax < this.statBoundsMax.wiz)
      list = list.filter(v => { const s = v.wiz ?? 0; return s >= this.filterWizMin && s <= this.filterWizMax; });

    // Aptitude filters
    list = this.applyAptFilter(list, 'proper_ground_turf', this.filterAptTurf);
    list = this.applyAptFilter(list, 'proper_ground_dirt', this.filterAptDirt);
    list = this.applyAptFilter(list, 'proper_distance_short', this.filterAptSprint);
    list = this.applyAptFilter(list, 'proper_distance_mile', this.filterAptMile);
    list = this.applyAptFilter(list, 'proper_distance_middle', this.filterAptMiddle);
    list = this.applyAptFilter(list, 'proper_distance_long', this.filterAptLong);
    list = this.applyAptFilter(list, 'proper_running_style_nige', this.filterAptNige);
    list = this.applyAptFilter(list, 'proper_running_style_senko', this.filterAptSenko);
    list = this.applyAptFilter(list, 'proper_running_style_sashi', this.filterAptSashi);
    list = this.applyAptFilter(list, 'proper_running_style_oikomi', this.filterAptOikomi);

    // Skill filters (just check existence, no level requirement)
    if (this.skillFilters.length > 0) {
      const activeSkillFilters = this.skillFilters.filter(sf => sf.skillId != null);
      if (activeSkillFilters.length > 0) {
        list = list.filter(v => {
          const encoded = this.getEncodedSkills(v);
          return activeSkillFilters.every(sf => {
            return encoded.some(e => Math.floor(e / 10) === sf.skillId);
          });
        });
      }
    }

    // Include/exclude parents (the vet itself, matched by card_id)
    if (this.includeParents.length > 0) {
      const ids = new Set(this.includeParents.map(c => c.id));
      list = list.filter(v => v.card_id != null && ids.has(v.card_id));
    }
    if (this.excludeParents.length > 0) {
      const ids = new Set(this.excludeParents.map(c => c.id));
      list = list.filter(v => v.card_id == null || !ids.has(v.card_id));
    }

    // Include/exclude grand parents (succession positions 10, 20)
    if (this.includeGrandParents.length > 0) {
      const ids = new Set(this.includeGrandParents.map(c => c.id));
      list = list.filter(v => {
        if (!v.succession_chara_array) return false;
        const gps = v.succession_chara_array.filter(s => s.position_id === 10 || s.position_id === 20);
        return gps.some(gp => ids.has(gp.card_id));
      });
    }
    if (this.excludeGrandParents.length > 0) {
      const ids = new Set(this.excludeGrandParents.map(c => c.id));
      list = list.filter(v => {
        if (!v.succession_chara_array) return true;
        const gps = v.succession_chara_array.filter(s => s.position_id === 10 || s.position_id === 20);
        return !gps.some(gp => ids.has(gp.card_id));
      });
    }

    // Include/exclude grand grand parents (succession positions 11, 12, 21, 22)
    if (this.includeGreatGrandParents.length > 0) {
      const ids = new Set(this.includeGreatGrandParents.map(c => c.id));
      list = list.filter(v => {
        if (!v.succession_chara_array) return false;
        const ggps = v.succession_chara_array.filter(s => [11, 12, 21, 22].includes(s.position_id));
        return ggps.some(ggp => ids.has(ggp.card_id));
      });
    }
    if (this.excludeGreatGrandParents.length > 0) {
      const ids = new Set(this.excludeGreatGrandParents.map(c => c.id));
      list = list.filter(v => {
        if (!v.succession_chara_array) return true;
        const ggps = v.succession_chara_array.filter(s => [11, 12, 21, 22].includes(s.position_id));
        return !ggps.some(ggp => ids.has(ggp.card_id));
      });
    }

    // Factor filters (scope-aware, duplicate rows = require multiple matches)
    if (this.parentFactorFilters.length > 0) {
      const activeFactorFilters = this.parentFactorFilters.filter(ff => ff.factorId != null);
      if (activeFactorFilters.length > 0) {
        // Group identical filters to get required counts
        const grouped = new Map<string, { factorId: string; scope: SparkScope; minLevel: number; requiredCount: number }>();
        for (const ff of activeFactorFilters) {
          const key = `${ff.factorId}|${ff.scope}|${ff.minLevel}`;
          const existing = grouped.get(key);
          if (existing) {
            existing.requiredCount++;
          } else {
            grouped.set(key, { factorId: ff.factorId!, scope: ff.scope, minLevel: ff.minLevel, requiredCount: 1 });
          }
        }

        const gpPositions = new Set([10, 20]);
        const ggpPositions = new Set([11, 12, 21, 22]);
        list = list.filter(v => {
          return [...grouped.values()].every(ff => {
            const countFactorMatches = (node: any) => {
              const factors = this.getFactors(node);
              return factors.filter(f => {
                const baseId = f.id.toString().slice(0, -1);
                return baseId === ff.factorId && f.level >= ff.minLevel;
              }).length;
            };

            let totalMatches = 0;

            if (ff.scope === 'parent') {
              return countFactorMatches(v) >= ff.requiredCount;
            }

            if (!v.succession_chara_array) return false;

            if (ff.scope === 'grandparent') {
              totalMatches = v.succession_chara_array
                .filter(c => gpPositions.has(c.position_id))
                .reduce((sum, c) => sum + countFactorMatches(c), 0);
              return totalMatches >= ff.requiredCount;
            }
            if (ff.scope === 'greatgrandparent') {
              totalMatches = v.succession_chara_array
                .filter(c => ggpPositions.has(c.position_id))
                .reduce((sum, c) => sum + countFactorMatches(c), 0);
              return totalMatches >= ff.requiredCount;
            }
            // 'any' — check vet itself + all succession
            totalMatches = countFactorMatches(v);
            if (v.succession_chara_array) {
              totalMatches += v.succession_chara_array.reduce((sum, c) => sum + countFactorMatches(c), 0);
            }
            return totalMatches >= ff.requiredCount;
          });
        });
      }
    }

    // Race schedule filter — match by race_instance_id via saddle mapping
    if (this.filterSelectedRaceIds.length > 0) {
      list = list.filter(v => {
        if (!v.succession_chara_array) return false;
        const allSaddles = new Set<number>();
        v.succession_chara_array.forEach(s => {
          s.win_saddle_id_array?.forEach(id => allSaddles.add(id));
        });
        // Check if this veteran has saddles associated with the selected races
        return this.filterSelectedRaceIds.some(raceId => {
          return this.getRaceSaddleIds(raceId).some(sid => allSaddles.has(sid));
        });
      });
    }

    list.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      switch (this.sortField) {
        case 'total': va = getTotalStats(a); vb = getTotalStats(b); break;
        case 'speed': va = a.speed ?? 0; vb = b.speed ?? 0; break;
        case 'stamina': va = a.stamina ?? 0; vb = b.stamina ?? 0; break;
        case 'power': va = a.power ?? 0; vb = b.power ?? 0; break;
        case 'guts': va = a.guts ?? 0; vb = b.guts ?? 0; break;
        case 'wiz': va = a.wiz ?? 0; vb = b.wiz ?? 0; break;
        case 'rank_score': va = a.rank_score ?? 0; vb = b.rank_score ?? 0; break;
        case 'blue': va = this.getStarSum(a, 'blue'); vb = this.getStarSum(b, 'blue'); break;
        case 'pink': va = this.getStarSum(a, 'pink'); vb = this.getStarSum(b, 'pink'); break;
        case 'green': va = this.getStarSum(a, 'green'); vb = this.getStarSum(b, 'green'); break;
        case 'name': va = getCharacterName(a.card_id); vb = getCharacterName(b.card_id); break;
      }
      if (typeof va === 'string') return this.sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return this.sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    this.filtered = list;
    this.buildDisplay();
  }

  private buildDisplay(): void {
    this.displayed = this.filtered.slice(0, this.pageSize).map(v => this.buildVeteranDisplay(v));
  }

  private buildVeteranDisplay(v: VeteranMember): VeteranDisplay {
    const encodedSkills = this.getEncodedSkills(v);
    const factors = this.getFactors(v);
    const parents = this.getSuccessionParents(v);
    return {
      veteran: v,
      characterName: getCharacterName(v.card_id),
      cardImage: getCardImage(v.card_id),
      scenarioName: getScenarioName(v.scenario_id),
      distanceName: getDistanceName(v.distance_type),
      runningStyleName: getRunningStyleName(v.running_style),
      rankGrade: getRankGrade(v.rank_score),
      rankGradeColor: getRankGradeColor(v.rank_score),
      totalStats: getTotalStats(v),
      starDisplay: getStarDisplay(v.rarity),
      affinityScore: (v.inheritance as any)?.affinity_score ?? null,
      aptTurf: getAptGrade(v.proper_ground_turf),
      aptDirt: getAptGrade(v.proper_ground_dirt),
      aptSprint: getAptGrade(v.proper_distance_short),
      aptMile: getAptGrade(v.proper_distance_mile),
      aptMiddle: getAptGrade(v.proper_distance_middle),
      aptLong: getAptGrade(v.proper_distance_long),
      aptNige: getAptGrade(v.proper_running_style_nige),
      aptSenko: getAptGrade(v.proper_running_style_senko),
      aptSashi: getAptGrade(v.proper_running_style_sashi),
      aptOikomi: getAptGrade(v.proper_running_style_oikomi),
      skills: encodedSkills.map(sid => ({
        encodedId: sid,
        icon: getSkillIcon(sid),
        name: getSkillName(sid),
        level: getSkillLevel(sid),
        rarityClass: getSkillRarityClass(sid),
      })),
      factors,
      coloredFactors: factors.filter(f => f.color !== 'white'),
      whiteStarSum: factors.filter(f => f.color === 'white').reduce((s, f) => s + (f.level || 0), 0),
      sparkTotals: this.computeSparkTotals(v),
      parentSparkTotals: this.computeSparkTotals(v, [10, 20]),
      gpSparkTotals: this.computeSparkTotals(v, [11, 12, 21, 22]),
      successionParents: parents.map(p => ({
        ...p,
        _name: getCharacterName(p.card_id),
        _image: getCardImage(p.card_id),
        _factors: this.getFactors(p),
        _gps: this.getSuccessionGrandparents(v, p.position_id).map(gp => ({
          ...gp,
          _name: getCharacterName(gp.card_id),
          _image: getCardImage(gp.card_id),
          _factors: this.getFactors(gp),
        })),
      })),
    };
  }

  showMore(): void {
    const nextBatch = this.filtered.slice(this.displayed.length, this.displayed.length + this.pageSize);
    this.displayed = [...this.displayed, ...nextBatch.map(v => this.buildVeteranDisplay(v))];
    this.cdr.markForCheck();
  }

  private computeSparkTotals(v: VeteranMember, positionIds?: number[]): SparkTotals {
    const totals: SparkTotals = { blue: 0, pink: 0, green: 0, white: 0 };
    if (!v.succession_chara_array) return totals;
    const charas = positionIds
      ? v.succession_chara_array.filter(c => positionIds.includes(c.position_id))
      : v.succession_chara_array;
    for (const chara of charas) {
      const factors = this.getFactors(chara);
      for (const f of factors) {
        totals[f.color] += f.level || 0;
      }
    }
    return totals;
  }

  private applyAptFilter(list: VeteranMember[], field: keyof VeteranMember, minGrade: string | null): VeteranMember[] {
    if (!minGrade) return list;
    const threshold = APT_GRADES.indexOf(minGrade);
    if (threshold < 0) return list;
    return list.filter(v => {
      const val = v[field] as number | null;
      if (val == null) return false;
      const grade = getAptGrade(val);
      const idx = APT_GRADES.indexOf(grade);
      return idx >= 0 && idx <= threshold;
    });
  }

  private computeStatBounds(): void {
    if (!this.veterans.length) return;
    const fields = ['speed', 'stamina', 'power', 'guts', 'wiz'] as const;
    for (const f of fields) {
      const vals = this.veterans.map(v => (v[f] ?? 0) as number).filter(v => v > 0);
      if (!vals.length) continue;
      this.statBoundsMin[f] = Math.floor(Math.min(...vals) / 50) * 50;
      this.statBoundsMax[f] = Math.ceil(Math.max(...vals) / 50) * 50;
    }
    this.recomputeStatTicks();
    this.resetStatRanges();
  }

  private recomputeStatTicks(): void {
    const fields = ['speed', 'stamina', 'power', 'guts', 'wiz'] as const;
    for (const f of fields) {
      const min = this.statBoundsMin[f];
      const max = this.statBoundsMax[f];
      const range = max - min || 1;
      const ticks: { value: number; label: boolean; percent: number }[] = [];
      for (let v = min; v <= max; v += 50) {
        ticks.push({
          value: v,
          label: v === min || v === max || v % 200 === 0,
          percent: ((v - min) / range) * 100
        });
      }
      this.statTicks[f] = ticks;
    }
  }

  private resetStatRanges(): void {
    this.filterSpeedMin = this.statBoundsMin.speed; this.filterSpeedMax = this.statBoundsMax.speed;
    this.filterStaminaMin = this.statBoundsMin.stamina; this.filterStaminaMax = this.statBoundsMax.stamina;
    this.filterPowerMin = this.statBoundsMin.power; this.filterPowerMax = this.statBoundsMax.power;
    this.filterGutsMin = this.statBoundsMin.guts; this.filterGutsMax = this.statBoundsMax.guts;
    this.filterWizMin = this.statBoundsMin.wiz; this.filterWizMax = this.statBoundsMax.wiz;
  }

  scheduleFilter(): void {
    this.filterChange$.next();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'desc';
    }
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterDistance = null;
    this.filterStyle = null;
    this.filterMinTotal = 0;
    // Stat ranges — reset to full data bounds
    this.resetStatRanges();
    this.filterAptTurf = null;
    this.filterAptDirt = null;
    this.filterAptSprint = null;
    this.filterAptMile = null;
    this.filterAptMiddle = null;
    this.filterAptLong = null;
    this.filterAptNige = null;
    this.filterAptSenko = null;
    this.filterAptSashi = null;
    this.filterAptOikomi = null;
    this.skillFilters = [];
    this.includeParents = [];
    this.excludeParents = [];
    this.includeGrandParents = [];
    this.excludeGrandParents = [];
    this.includeGreatGrandParents = [];
    this.excludeGreatGrandParents = [];
    this.parentFactorFilters = [];
    this.filterSelectedRaceIds = [];
    this.applyFilters(); // immediate — user clicked clear
  }

  get activeFilterCount(): number {
    let c = 0;
    if (this.filterDistance != null) c++;
    if (this.filterStyle != null) c++;
    if (this.filterMinTotal > 0) c++;
    if (this.searchQuery) c++;
    if (this.filterSpeedMin > this.statBoundsMin.speed || this.filterSpeedMax < this.statBoundsMax.speed) c++;
    if (this.filterStaminaMin > this.statBoundsMin.stamina || this.filterStaminaMax < this.statBoundsMax.stamina) c++;
    if (this.filterPowerMin > this.statBoundsMin.power || this.filterPowerMax < this.statBoundsMax.power) c++;
    if (this.filterGutsMin > this.statBoundsMin.guts || this.filterGutsMax < this.statBoundsMax.guts) c++;
    if (this.filterWizMin > this.statBoundsMin.wiz || this.filterWizMax < this.statBoundsMax.wiz) c++;
    if (this.filterAptTurf) c++;
    if (this.filterAptDirt) c++;
    if (this.filterAptSprint) c++;
    if (this.filterAptMile) c++;
    if (this.filterAptMiddle) c++;
    if (this.filterAptLong) c++;
    if (this.filterAptNige) c++;
    if (this.filterAptSenko) c++;
    if (this.filterAptSashi) c++;
    if (this.filterAptOikomi) c++;
    c += this.skillFilters.filter(sf => sf.skillId != null).length;
    c += this.includeParents.length;
    c += this.excludeParents.length;
    c += this.includeGrandParents.length;
    c += this.excludeGrandParents.length;
    c += this.includeGreatGrandParents.length;
    c += this.excludeGreatGrandParents.length;
    c += this.parentFactorFilters.filter(ff => ff.factorId != null).length;
    c += this.filterSelectedRaceIds.length;
    return c;
  }

  // ── Advanced filter helpers ───────────────────

  toggleSection(section: string): void {
    this.expandedSections[section] = !this.expandedSections[section];
    if (section === 'stats' && this.expandedSections[section]) {
      this.statsSectionRendered = true;
    }
  }

  isSectionExpanded(section: string): boolean {
    return !!this.expandedSections[section];
  }

  // Aptitude filter helpers (avoids dynamic this[key] in strict templates)
  private aptFilterMap: Record<string, () => string | null> = {
    filterAptTurf: () => this.filterAptTurf,
    filterAptDirt: () => this.filterAptDirt,
    filterAptSprint: () => this.filterAptSprint,
    filterAptMile: () => this.filterAptMile,
    filterAptMiddle: () => this.filterAptMiddle,
    filterAptLong: () => this.filterAptLong,
    filterAptNige: () => this.filterAptNige,
    filterAptSenko: () => this.filterAptSenko,
    filterAptSashi: () => this.filterAptSashi,
    filterAptOikomi: () => this.filterAptOikomi,
  };

  getAptFilter(key: string): string | null {
    return this.aptFilterMap[key]?.() ?? null;
  }

  /** Returns true if this grade passes the current aptitude filter (at or better than selected) */
  isGradeHighlighted(key: string, grade: string): boolean {
    const selected = this.getAptFilter(key);
    if (!selected) return false;
    const selectedIdx = APT_GRADES.indexOf(selected);
    const gradeIdx = APT_GRADES.indexOf(grade);
    return gradeIdx >= 0 && gradeIdx <= selectedIdx;
  }

  setAptFilter(key: string, value: string | null): void {
    switch (key) {
      case 'filterAptTurf': this.filterAptTurf = value; break;
      case 'filterAptDirt': this.filterAptDirt = value; break;
      case 'filterAptSprint': this.filterAptSprint = value; break;
      case 'filterAptMile': this.filterAptMile = value; break;
      case 'filterAptMiddle': this.filterAptMiddle = value; break;
      case 'filterAptLong': this.filterAptLong = value; break;
      case 'filterAptNige': this.filterAptNige = value; break;
      case 'filterAptSenko': this.filterAptSenko = value; break;
      case 'filterAptSashi': this.filterAptSashi = value; break;
      case 'filterAptOikomi': this.filterAptOikomi = value; break;
    }
    this.filterChange$.next();
  }

  // Skills
  searchSkills(filter: SkillFilter): void {
    const q = filter.searchQuery.toLowerCase().trim();
    if (!q) { filter.searchResults = []; return; }
    filter.searchResults = SKILLS
      .filter(s => s.name.toLowerCase().includes(q))
      .slice(0, 20)
      .map(s => ({ id: s.skill_id, name: s.name, rarity: s.rarity ?? 0 }));
  }

  addEmptySkillFilter(): void {
    this.skillFilters.push({ skillId: null, name: '', searchQuery: '', searchResults: [] });
  }

  selectSkillForFilter(filter: SkillFilter, skill: SkillOption): void {
    filter.skillId = skill.id;
    filter.name = skill.name;
    filter.searchQuery = '';
    filter.searchResults = [];
    this.filterChange$.next();
  }

  addSkillFilter(skill: SkillOption): void {
    this.skillFilters.push({ skillId: skill.id, name: skill.name, searchQuery: '', searchResults: [] });
    this.filterChange$.next();
  }

  removeSkillFilter(index: number): void {
    this.skillFilters.splice(index, 1);
    this.filterChange$.next();
  }

  // Parents / Grand Parents / Grand Grand Parents
  openParentDialog(target: 'includeParent' | 'excludeParent' | 'includeGP' | 'excludeGP' | 'includeGGP' | 'excludeGGP'): void {
    const list = this.getParentList(target);
    const mode = target.startsWith('include') ? 'include' : 'exclude';
    const dialogRef = this.dialog.open(CharacterSelectDialogComponent, {
      width: '90%',
      maxWidth: '600px',
      height: '80vh',
      panelClass: 'modern-dialog-panel',
      data: {
        multiSelect: true,
        existingIds: list.map(c => c.id),
        mode
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result && Array.isArray(result)) {
        result.forEach((char: any) => {
          if (!list.some(c => c.id === char.id)) {
            list.push({ id: char.id, name: char.name, image: char.image ?? null });
          }
        });
        this.filterChange$.next();
        this.cdr.markForCheck();
      }
    });
  }

  removeParent(target: 'includeParent' | 'excludeParent' | 'includeGP' | 'excludeGP' | 'includeGGP' | 'excludeGGP', index: number): void {
    this.getParentList(target).splice(index, 1);
    this.filterChange$.next();
  }

  private getParentList(target: string | null): CharacterOption[] {
    switch (target) {
      case 'includeParent': return this.includeParents;
      case 'excludeParent': return this.excludeParents;
      case 'includeGP': return this.includeGrandParents;
      case 'excludeGP': return this.excludeGrandParents;
      case 'includeGGP': return this.includeGreatGrandParents;
      case 'excludeGGP': return this.excludeGreatGrandParents;
      default: return [];
    }
  }

  getCharacterImagePath(imageName: string | null): string {
    if (!imageName) return '';
    if (imageName.startsWith('assets/')) return imageName;
    return `assets/images/character_stand/${imageName}`;
  }

  // Factors
  searchFactors(filter: FactorFilter): void {
    const q = filter.searchQuery.toLowerCase().trim();
    if (!q) { filter.searchResults = []; return; }
    // Build unique factor list from all veterans' succession_chara
    const seen = new Map<string, { id: string; name: string; type: number; color: FactorColor }>();
    for (const v of this.veterans) {
      if (!v.succession_chara_array) continue;
      for (const chara of v.succession_chara_array) {
        const factors = this.getFactors(chara);
        for (const f of factors) {
          const baseId = f.id.toString().slice(0, -1);
          if (!seen.has(baseId) && f.name.toLowerCase().includes(q)) {
            seen.set(baseId, { id: baseId, name: f.name, type: f.type, color: f.color });
          }
        }
      }
    }
    filter.searchResults = [...seen.values()].slice(0, 20);
  }

  addEmptyFactorFilter(): void {
    this.parentFactorFilters.push({ factorId: null, name: '', color: 'white', minLevel: 1, scope: 'any', searchQuery: '', searchResults: [] });
  }

  selectFactorForFilter(filter: FactorFilter, factor: { id: string; name: string; type: number; color: FactorColor }): void {
    filter.factorId = factor.id;
    filter.name = factor.name;
    filter.color = factor.color;
    filter.searchQuery = '';
    filter.searchResults = [];
    this.filterChange$.next();
  }

  addFactorFilter(factor: { id: string; name: string; type: number; color: FactorColor }): void {
    this.parentFactorFilters.push({ factorId: factor.id, name: factor.name, color: factor.color, minLevel: 1, scope: 'any', searchQuery: '', searchResults: [] });
    this.filterChange$.next();
  }

  removeFactorFilter(index: number): void {
    this.parentFactorFilters.splice(index, 1);
    this.filterChange$.next();
  }

  // Race schedule selection
  onRaceSelectionChanged(raceIds: number[]): void {
    this.filterSelectedRaceIds = raceIds;
    this.filterChange$.next();
  }

  private raceSaddleCache = new Map<number, number[]>();
  private getRaceSaddleIds(raceInstanceId: number): number[] {
    if (this.raceSaddleCache.has(raceInstanceId)) {
      return this.raceSaddleCache.get(raceInstanceId)!;
    }
    const saddleIds: number[] = [];
    for (const race of (RACE_DATA as any).races) {
      if (race.race_instance_id === raceInstanceId) {
        for (const ws of race.win_saddles ?? []) {
          if (ws.required_race_instance_ids?.length === 1) {
            saddleIds.push(ws.saddle_id);
          }
        }
        break;
      }
    }
    this.raceSaddleCache.set(raceInstanceId, saddleIds);
    return saddleIds;
  }

  openDetail(v: VeteranMember): void {
    this.dialog.open(VeteranDetailDialogComponent, {
      data: { veteran: v } as VeteranDetailData,
      panelClass: 'modern-dialog-panel',
      width: '640px',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });
  }

  // ── Helpers ───────────────────────────────────

  getCharacterName(cardId: number | null): string { return getCharacterName(cardId); }
  getCardImage(cardId: number | null): string | null { return getCardImage(cardId); }
  getDistanceName(t: number | null): string { return getDistanceName(t); }
  getRunningStyleName(s: number | null): string { return getRunningStyleName(s); }
  getScenarioName(id: number | null): string { return getScenarioName(id); }
  getTotalStats(m: any): number { return getTotalStats(m); }
  getAptGrade(v: number | null): string { return getAptGrade(v); }
  getAptIcon(v: number | null): string { return getAptIcon(v); }
  getRankGrade(s: number | null): string { return getRankGrade(s); }
  getRankGradeColor(s: number | null): string { return getRankGradeColor(s); }
  getStarDisplay(r: number | null): { filled: boolean; talent: boolean }[] { return getStarDisplay(r); }
  getSkillName(id: number): string { return getSkillName(id); }
  getSkillLevel(id: number): number { return getSkillLevel(id); }
  getSkillIcon(id: number): string | null { return getSkillIcon(id); }
  getSkillRarityClass(id: number): string { return getSkillRarityClass(id); }

  /** Convert skill_array [{skill_id,level}] or encoded skills[] to encoded IDs */
  getEncodedSkills(v: VeteranMember): number[] {
    if (v.skill_array && v.skill_array.length > 0) {
      return v.skill_array.map(s => s.skill_id * 10 + s.level);
    }
    return v.skills ?? [];
  }

  getStarSum(v: VeteranMember, color: FactorColor): number {
    if (!v.inheritance) return 0;
    switch (color) {
      case 'blue': return v.inheritance.blue_stars_sum ?? 0;
      case 'pink': return v.inheritance.pink_stars_sum ?? 0;
      case 'green': return v.inheritance.green_stars_sum ?? 0;
      case 'white': return v.inheritance.white_stars_sum ?? 0;
    }
  }



  getSliderTicks(min: number, max: number, step = 50, labelEvery = 200): { value: number; label: boolean }[] {
    const ticks: { value: number; label: boolean }[] = [];
    for (let v = min; v <= max; v += step) {
      ticks.push({ value: v, label: v === min || v === max || v % labelEvery === 0 });
    }
    return ticks;
  }

  getTickPercent(val: number, min: number, max: number): number {
    if (max === min) return 0;
    return ((val - min) / (max - min)) * 100;
  }



  /** Resolve factor_info_array entries to display info */
  resolveFactors(entries: FactorInfoEntry[] | null | undefined): ResolvedFactor[] {
    if (!entries || entries.length === 0) return [];
    const colorOrder: Record<string, number> = { blue: 0, pink: 1, green: 2, white: 3 };
    return entries.map(e => {
      const spark = this.factorService.resolveSpark(e.factor_id);
      return {
        id: e.factor_id,
        level: spark.level,
        name: spark.name,
        type: spark.type,
        color: this.factorTypeToColor(spark.type),
      };
    }).sort((a, b) => (colorOrder[a.color] ?? 9) - (colorOrder[b.color] ?? 9));
  }

  /** Resolve plain factor_id_array (last digit = level) to display info */
  resolveFactorIds(ids: number[] | null | undefined): ResolvedFactor[] {
    if (!ids || ids.length === 0) return [];
    const colorOrder: Record<string, number> = { blue: 0, pink: 1, green: 2, white: 3 };
    return ids.map(id => {
      const spark = this.factorService.resolveSpark(id);
      return {
        id: id,
        level: spark.level,
        name: spark.name,
        type: spark.type,
        color: this.factorTypeToColor(spark.type),
      };
    }).sort((a, b) => (colorOrder[a.color] ?? 9) - (colorOrder[b.color] ?? 9));
  }

  /** Unified factor resolver: prefers factor_info_array, falls back to factor_id_array */
  getFactors(node: { factor_info_array?: FactorInfoEntry[] | null; factor_id_array?: number[] | null; factors?: number[] | null }): ResolvedFactor[] {
    if (node.factor_info_array && node.factor_info_array.length > 0) {
      return this.resolveFactors(node.factor_info_array);
    }
    return this.resolveFactorIds(node.factor_id_array || node.factors);
  }

  private factorTypeToColor(type: number): FactorColor {
    if (type === 0) return 'blue';
    if (type === 1) return 'pink';
    if (type === 5) return 'green';
    return 'white';
  }

  /** Group resolved factors by color for spark-row display */
  resolveFactorsByColor(entries: FactorInfoEntry[] | null | undefined): { color: FactorColor; factors: ResolvedFactor[] }[] {
    const all = this.resolveFactors(entries);
    const groups = new Map<FactorColor, ResolvedFactor[]>();
    for (const f of all) {
      const list = groups.get(f.color) || [];
      list.push(f);
      groups.set(f.color, list);
    }
    const order: FactorColor[] = ['blue', 'pink', 'green', 'white'];
    return order.filter(c => groups.has(c)).map(c => ({ color: c, factors: groups.get(c)! }));
  }

  /** Get non-white (blue, pink, green) factors for table display */
  getColoredFactors(node: { factor_info_array?: FactorInfoEntry[] | null; factor_id_array?: number[] | null; factors?: number[] | null }): ResolvedFactor[] {
    return this.getFactors(node).filter(f => f.color !== 'white');
  }

  /** Sum of white spark levels for table display */
  getWhiteStarSum(node: { factor_info_array?: FactorInfoEntry[] | null; factor_id_array?: number[] | null; factors?: number[] | null }): number {
    return this.getFactors(node).filter(f => f.color === 'white').reduce((s, f) => s + (f.level || 0), 0);
  }

  getSuccessionParents(v: VeteranMember): SuccessionChara[] {
    if (!v.succession_chara_array) return [];
    return v.succession_chara_array.filter(s => s.position_id === 10 || s.position_id === 20);
  }

  getSuccessionGrandparents(v: VeteranMember, parentPositionId: number): SuccessionChara[] {
    if (!v.succession_chara_array) return [];
    const base = parentPositionId === 10 ? 11 : 21;
    return v.succession_chara_array.filter(s => s.position_id === base || s.position_id === base + 1);
  }

  /** Sum of factor levels for a SuccessionChara (for affinity display) */
  getParentFactorSum(chara: SuccessionChara): number {
    const factors = this.getFactors(chara);
    return factors.reduce((s, f) => s + (f.level || 0), 0);
  }

  /** Number of race wins (saddles) for a SuccessionChara */
  getWinSaddleCount(chara: SuccessionChara): number {
    return chara.win_saddle_id_array ? chara.win_saddle_id_array.length : 0;
  }

  /** Overall affinity score from VeteranInheritance if available */
  getAffinityScore(v: VeteranMember): number | null {
    return (v.inheritance as any)?.affinity_score ?? null;
  }

  /** Quick assessment: is this a good ace candidate? (high stats + good aptitudes) */
  getAceScore(v: VeteranMember): number {
    const total = getTotalStats(v);
    const aptBonus = this.bestAptSum(v) * 50;
    return total + aptBonus + (v.rank_score ?? 0) / 2;
  }

  private bestAptSum(v: VeteranMember): number {
    const ground = Math.max(v.proper_ground_turf ?? 0, v.proper_ground_dirt ?? 0);
    const dist = Math.max(
      v.proper_distance_short ?? 0, v.proper_distance_mile ?? 0,
      v.proper_distance_middle ?? 0, v.proper_distance_long ?? 0
    );
    const style = Math.max(
      v.proper_running_style_nige ?? 0, v.proper_running_style_senko ?? 0,
      v.proper_running_style_sashi ?? 0, v.proper_running_style_oikomi ?? 0
    );
    return ground + dist + style;
  }

  /** Breeding value: factor star sums */
  getBreedingScore(v: VeteranMember): number {
    return this.getStarSum(v, 'blue') * 3
      + this.getStarSum(v, 'pink') * 2
      + this.getStarSum(v, 'green') * 4
      + this.getStarSum(v, 'white');
  }

  trackByVeteran(_i: number, v: VeteranMember): number {
    return v.trained_chara_id ?? v.member_id ?? _i;
  }

  trackByDisplay(_i: number, d: VeteranDisplay): number {
    return d.veteran.trained_chara_id ?? d.veteran.member_id ?? _i;
  }

  trackBySkill(_i: number, s: SkillDisplay): number {
    return s.encodedId;
  }

  trackByFactor(_i: number, f: ResolvedFactor): number {
    return f.id;
  }
}
