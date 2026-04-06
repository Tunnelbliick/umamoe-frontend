import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { InheritanceRecord } from '../../models/inheritance.model';
import { FactorService, SparkInfo } from '../../services/factor.service';
import { getCharacterById } from '../../data/character.data';
import { ResolveSparksPipe } from '../../pipes/resolve-sparks.pipe';
import { TrainerIdFormatPipe } from '../../pipes/trainer-id-format.pipe';
import { RaceResultsDialogComponent, RaceResultsDialogData } from '../race-results-dialog/race-results-dialog.component';
import { RankBadgeComponent } from '../rank-badge/rank-badge.component';
import { LocaleNumberPipe } from '../../pipes/locale-number.pipe';

@Component({
    selector: 'app-inheritance-entry',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDialogModule, ResolveSparksPipe, TrainerIdFormatPipe, DatePipe, RankBadgeComponent, LocaleNumberPipe],
    templateUrl: './inheritance-entry.component.html',
    styleUrl: './inheritance-entry.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InheritanceEntryComponent {
    /** The inheritance record to display */
    @Input({ required: true }) record!: InheritanceRecord;

    /** Support card image URL (pre-resolved by parent) */
    @Input() supportCardImageUrl: string | null = null;

    /** Support card limit break count */
    @Input() supportCardLimitBreak: number | null = null;

    /** Whether to show the database-specific header (trainer info, actions, verification) */
    @Input() showDatabaseHeader = false;

    /** Whether this record has max followers */
    @Input() isMaxFollowers = false;

    /** Function to check if a spark matches active filters (database only) */
    @Input() sparkMatchFn?: (spark: SparkInfo, record: InheritanceRecord) => boolean;

    /** Function to get the level contributed by the main parent */
    @Input() mainParentLevelFn?: (spark: SparkInfo, record: InheritanceRecord) => string | undefined;

    @Output() copyInfo = new EventEmitter<InheritanceRecord>();
    @Output() copyTrainerId = new EventEmitter<{ accountId: string; event: Event }>();
    @Output() reportUnavailable = new EventEmitter<{ accountId: string; event: Event }>();

    /** Spark display mode — driven by parent (global toggle) */
    @Input() sparkViewMode: 'merged' | 'split' = 'merged';
    /** Currently focused parent in split view */
    selectedParent: 'main' | 'left' | 'right' | null = null;

    constructor(private factorService: FactorService, private dialog: MatDialog) {}

    isV2Record(): boolean {
        return typeof this.record.id === 'number';
    }

    getCharacterImage(charId: number): string | null {
        const char = getCharacterById(charId);
        return char ? `assets/images/character_stand/${char.image}` : null;
    }

    getCharacterName(charId: number): string {
        const char = getCharacterById(charId);
        return char?.name || `Character ${charId}`;
    }

    getSupportCardImageUrl(supportCardId: number): string {
        return `/assets/images/support_card/half/support_card_s_${supportCardId}.png`;
    }

    handleSupportCardImageError(event: Event): void {
        const img = event.target as HTMLImageElement;
        const wrapper = img.closest('.support-card-section');
        if (wrapper) wrapper.classList.add('image-error');
    }

    getLimitBreakArray(count: number): { filled: boolean }[] {
        return Array.from({ length: 4 }, (_, i) => ({ filled: i < count }));
    }

    getRarityIcon(rarity: number): string {
        const idx = rarity < 11 ? '0' + (rarity - 1) : String(rarity - 1);
        return `/assets/images/icon/ranks/utx_txt_rank_${idx}.png`;
    }

    resolveSparks(sparkIds: number[]): SparkInfo[] {
        return this.factorService.resolveSparks(sparkIds);
    }

    isSparkMatched(spark: SparkInfo): boolean {
        return this.sparkMatchFn ? this.sparkMatchFn(spark, this.record) : false;
    }

    getLevelFromMainParent(spark: SparkInfo): string | undefined {
        return this.mainParentLevelFn ? this.mainParentLevelFn(spark, this.record) : undefined;
    }

    getBlueStarsSum(): number {
        return (this.record.blue_sparks || []).reduce((sum, id) => sum + (id % 10), 0);
    }

    selectParent(parent: 'main' | 'left' | 'right', event: Event): void {
        event.stopPropagation();
        this.selectedParent = this.selectedParent === parent ? null : parent;
    }

    /** Wraps a single nullable factor ID in an array for use with the resolveSparks pipe */
    getParentSingleSpark(id: number | undefined): number[] {
        return id ? [id] : [];
    }

    getSelectedBlueFactor(): number[] {
        return this.getParentSingleSpark(
            this.selectedParent === 'main' ? this.record.main_blue_factors
            : this.selectedParent === 'left' ? this.record.left_blue_factors
            : this.selectedParent === 'right' ? this.record.right_blue_factors
            : undefined
        );
    }

    getSelectedPinkFactor(): number[] {
        return this.getParentSingleSpark(
            this.selectedParent === 'main' ? this.record.main_pink_factors
            : this.selectedParent === 'left' ? this.record.left_pink_factors
            : this.selectedParent === 'right' ? this.record.right_pink_factors
            : undefined
        );
    }

    getSelectedGreenFactor(): number[] {
        return this.getParentSingleSpark(
            this.selectedParent === 'main' ? this.record.main_green_factors
            : this.selectedParent === 'left' ? this.record.left_green_factors
            : this.selectedParent === 'right' ? this.record.right_green_factors
            : undefined
        );
    }

    getSelectedWhiteFactors(): number[] {
        if (!this.selectedParent) return [];
        const arr = this.selectedParent === 'main' ? this.record.main_white_factors
                  : this.selectedParent === 'left' ? this.record.left_white_factors
                  : this.record.right_white_factors;
        return arr ?? [];
    }

    hasWinSaddles(parent: 'main' | 'left' | 'right'): boolean {
        const saddles = parent === 'main' ? this.record.main_win_saddles
                      : parent === 'left' ? this.record.left_win_saddles
                      : this.record.right_win_saddles;
        return !!saddles && saddles.length > 0;
    }

    openRaceResults(parent: 'main' | 'left' | 'right', event: Event): void {
        event.stopPropagation();
        const saddles = parent === 'main' ? this.record.main_win_saddles ?? []
                      : parent === 'left' ? this.record.left_win_saddles ?? []
                      : this.record.right_win_saddles ?? [];
        const charId = parent === 'main' ? this.record.main_parent_id
                     : parent === 'left' ? this.record.parent_left_id
                     : this.record.parent_right_id;
        const charName = charId ? this.getCharacterName(charId) : 'Parent';
        const runRaceIds = parent === 'main' ? (this.record.race_results ?? []) : [];
        this.dialog.open(RaceResultsDialogComponent, {
            data: { charId, charName, winSaddleIds: saddles, runRaceIds } as RaceResultsDialogData,
            panelClass: 'modern-dialog-panel',
            width: '900px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            autoFocus: false,
        });
    }

    getPinkStarsSum(): number {
        return (this.record.pink_sparks || []).reduce((sum, id) => sum + (id % 10), 0);
    }

    getGreenStarsSum(): number {
        return (this.record.green_sparks || []).reduce((sum, id) => sum + (id % 10), 0);
    }

    getWhiteStarsSum(): number {
        return (this.record.white_sparks || []).reduce((sum, id) => sum + (id % 10), 0);
    }

    onCopyInfo(event: Event): void {
        event.stopPropagation();
        this.copyInfo.emit(this.record);
    }

    onCopyTrainerId(event: Event): void {
        event.stopPropagation();
        const id = this.record.account_id || this.record.trainer_id || '';
        this.copyTrainerId.emit({ accountId: id, event });
    }

    onReportUnavailable(event: Event): void {
        event.stopPropagation();
        const id = this.record.account_id || this.record.trainer_id || '';
        this.reportUnavailable.emit({ accountId: id, event });
    }
}
