import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { Meta, Title } from '@angular/platform-browser';

import { SupportCardService } from '../../services/support-card.service';
import { VoteProtectionService } from '../../services/vote-protection.service';
import { FactorService, SparkInfo } from '../../services/factor.service';
import {
  SupportCard,
  SupportCardRecord,
  SupportCardSearchFilters,
  SupportCardType,
  Rarity,
  SupportCardRecordEnriched,
  SupportCardRecordV2Enriched
} from '../../models/support-card.model';
import { SearchResult } from '../../models/common.model';
import { SupportCardFilterComponent, SupportCardFilters } from './support-card-filter.component';
import { TrainerSubmitDialogComponent, TrainerSubmissionConfig } from '../../components/trainer-submit-dialog/trainer-submit-dialog.component';
import { TrainerIdFormatPipe } from "../../pipes/trainer-id-format.pipe";
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-support-cards-database',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    SupportCardFilterComponent,
    TrainerIdFormatPipe
  ],
  templateUrl: './support-cards-database.component.html',
  styleUrl: './support-cards-database.component.scss'
})
export class SupportCardsDatabaseComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = false;
  loadingMore = false;
  allRecords: SupportCardRecordV2Enriched[] = [];
  currentFilters: SupportCardFilters | null = null;
  hasMoreRecords = true;

  // Infinite scroll properties
  pageSize = 12;
  currentPage = 0;
  totalRecords = 0; // Total records from the search result

  // Support card data cache
  private supportCardCache = new Map<string, any>();

  // Trainer ID filter from URL parameters
  trainerIdFilter: string | null = null;

  // Report tracking
  reportingInProgress = new Set<string>();
  reportedTrainers = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private supportCardService: SupportCardService,
    private voteProtectionService: VoteProtectionService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private meta: Meta,
    private title: Title,
    private factorService: FactorService // Add FactorService
  ) { }

  ngOnInit() {
    // Set Open Graph and Twitter meta tags for Support Cards Database
    const pageTitle = 'Support Card Database | honse.moe';
    const pageDesc = 'Browse and filter our Umamusume support card database.';
    const pageUrl = 'https://honsemoe.com/support-cards';
    const pageImg = 'https://honsemoe.com/assets/logo.jpg';
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: pageDesc });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: pageDesc });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: pageUrl });
    this.meta.updateTag({ property: 'og:image', content: pageImg });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: pageDesc });
    this.meta.updateTag({ name: 'twitter:image', content: pageImg });

    // Check for trainer_id URL parameter
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const trainerId = params['trainer_id'];
      if (trainerId && trainerId !== this.trainerIdFilter) {
        this.trainerIdFilter = trainerId;
        // Reset search when trainer_id parameter changes
        this.currentPage = 0;
        this.allRecords = [];
        this.hasMoreRecords = true;
        this.searchRecords();
        
        // Update page title and meta tags to reflect trainer filter
        this.title.setTitle(`Support Cards Database - Trainer ${trainerId} | honse.moe`);
        this.meta.updateTag({ 
          name: 'description', 
          content: `Browse support card records for trainer ${trainerId} in the Umamusume database.` 
        });
      } else if (!trainerId && this.trainerIdFilter) {
        // Trainer ID parameter was removed, clear filter
        this.trainerIdFilter = null;
        this.currentPage = 0;
        this.allRecords = [];
        this.hasMoreRecords = true;
        this.searchRecords();
        
        // Reset title and meta tags
        this.title.setTitle('Support Cards Database | honse.moe');
        this.meta.updateTag({ 
          name: 'description', 
          content: 'Browse and filter our Umamusume support card database.' 
        });
      }
    });

    // Load support card data for caching
    this.loadSupportCardCache();
    
    // Initial search (will include trainer_id if present in URL)
    if (!this.trainerIdFilter) {
      this.searchRecords();
    }
  }

  private loadSupportCardCache() {
    this.supportCardService.getSupportCards().subscribe(cards => {
      cards.forEach(card => {
        this.supportCardCache.set(card.id, card);
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Optional: Clear voting data when component is destroyed
    // Uncomment if you want to reset vote protection on navigation
    // this.voteProtectionService.clearVotingData();
  }

  onFiltersChanged(filters: SupportCardFilters) {
    if (!environment.production) {
      console.log('Filters changed:', filters);
    }
    this.currentFilters = filters;
    this.currentPage = 0; // Reset to first page
    this.allRecords = []; // Clear existing records
    this.hasMoreRecords = true;
    this.searchRecords();
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(event: any) {
    // Check if we're near the bottom of the page
    const threshold = 100;
    const position = window.pageYOffset + window.innerHeight;
    const height = document.body.scrollHeight;

    if (position > height - threshold && !this.loading && !this.loadingMore && this.hasMoreRecords) {
      this.loadMoreRecords();
    }
  }

  loadMoreRecords() {
    if (this.loadingMore || !this.hasMoreRecords) {
      return;
    }

    this.currentPage++;
    this.searchRecords(true); // true indicates this is loading more, not a fresh search
  }

  searchRecords(isLoadingMore = false) {
    if (this.loading || this.loadingMore) {
      return; // Prevent multiple simultaneous requests
    }

    // Set appropriate loading state
    if (isLoadingMore) {
      this.loadingMore = true;
    } else {
      this.loading = true;
    }

    // Convert our filter format to the service's expected format
    const searchFilters: SupportCardSearchFilters = {
      trainerId: this.trainerIdFilter || undefined, // Add trainer ID filter from URL
      cardId: this.currentFilters?.selectedCard?.id,
      type: (this.currentFilters?.cardType !== undefined && this.currentFilters?.cardType !== null) ? this.currentFilters.cardType : undefined,
      rarity: (this.currentFilters?.rarity !== undefined && this.currentFilters?.rarity !== null) ? this.currentFilters.rarity : undefined,
      minLimitBreak: this.currentFilters?.limitBreak,
      sortBy: 'experience', // V2: Sort by experience (more useful than submission date)
      sortOrder: 'desc'
    };

    this.supportCardService.searchSupportCardRecordsV2(searchFilters, this.currentPage + 1, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          if (isLoadingMore) {
            // Append new records to existing ones
            this.allRecords = [...this.allRecords, ...(result.items || [])];
          } else {
            // Replace records for fresh search
            this.allRecords = result.items || [];
            this.totalRecords = result.total || 0;
          }

          // Check if there are more records to load
          this.hasMoreRecords = (this.allRecords.length < (result.total || 0));


          this.loading = false;
          this.loadingMore = false;
        },
        error: (error) => {
          console.error('Search error (V2):', error);
          this.loading = false;
          this.loadingMore = false;
          this.snackBar.open('Error loading records', 'Close', { duration: 3000 });
        }
      });
  }

  resetFilters() {
    this.currentFilters = null;
    this.currentPage = 0;
    this.searchRecords();
  }

  hasActiveFilters(): boolean {
    return !!(this.trainerIdFilter ||
      this.currentFilters?.selectedCard ||
      this.currentFilters?.cardType ||
      this.currentFilters?.rarity ||
      this.currentFilters?.limitBreak);
  }

  viewRecord(record: SupportCardRecord) {
    if (!record) return;
    // TODO: Implement record details
    this.snackBar.open('Record details coming soon', 'Close', { duration: 2000 });
  }

  shareRecord(record: SupportCardRecord) {
    if (!record?.id) return;
    const url = `${window.location.origin}/support-cards/${record.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('Link copied to clipboard', 'Close', { duration: 2000 });
    }).catch(() => {
      this.snackBar.open('Failed to copy link', 'Close', { duration: 2000 });
    });
  }

  openSubmitDialog() {
    const config: TrainerSubmissionConfig = {
      title: 'Share Trainer ID',
      subtitle: 'Help the community grow'
    };

    const dialogRef = this.dialog.open(TrainerSubmitDialogComponent, {
      maxWidth: '500px',
      disableClose: false,
      panelClass: 'trainer-submit-dialog-panel',
      data: config
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.trainerId) {
        // Refresh the search results after successful submission
        this.currentPage = 0;
        this.allRecords = [];
        this.hasMoreRecords = true;
        this.searchRecords();
        this.snackBar.open('Trainer ID submitted successfully!', 'Close', { duration: 3000 });
      }
    });
  }

  // Report functionality
  reportUnavailable(trainerId: string, event: Event) {
    event.stopPropagation();

    if (!trainerId || this.reportingInProgress.has(trainerId)) {
      return;
    }

    this.reportingInProgress.add(trainerId);

    // Use actual service call instead of mock
    this.supportCardService.reportUserUnavailable(trainerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.reportingInProgress.delete(trainerId);
          this.snackBar.open(response.message || 'Trainer reported as unavailable', 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error reporting trainer:', error);
          this.reportingInProgress.delete(trainerId);
          this.snackBar.open('Failed to report trainer. Please try again.', 'Close', { duration: 3000 });
        }
      });
  }

  isReportButtonDisabled(record: SupportCardRecordV2Enriched): boolean {
    // Check if account_id is valid
    if (!this.isValidAccountId(record.account_id)) {
      return true;
    }

    // Check if already reporting this trainer
    if (this.reportingInProgress.has(record.account_id)) {
      return true;
    }

    return false;
  }

  // Simplified report function without tracking already reported
  reportUserUnavailable(trainerId: string) {
    if (!this.isValidAccountId(trainerId) || this.reportingInProgress.has(trainerId)) {
      return;
    }

    this.reportingInProgress.add(trainerId);

    this.supportCardService.reportUserUnavailable(trainerId).subscribe({
      next: (response) => {
        this.reportingInProgress.delete(trainerId);
        console.log('Report submitted successfully:', response);

        // Show success message
        this.snackBar.open(
          response.task_created
            ? 'Report submitted - user will be rechecked soon'
            : `Report submitted (${response.report_count} total reports)`,
          'Close',
          { duration: 3000, panelClass: ['success-snack'] }
        );
      },
      error: (error) => {
        this.reportingInProgress.delete(trainerId);
        console.error('Error reporting trainer:', error);

        this.snackBar.open(
          'Failed to submit report. Please try again.',
          'Close',
          { duration: 3000, panelClass: ['error-snack'] }
        );
      }
    });
  }

  hasReportedTrainer(trainerId: string): boolean {
    return this.reportedTrainers.has(trainerId);
  }

  isReportingInProgress(trainerId: string): boolean {
    return this.reportingInProgress.has(trainerId);
  }

  copyUserId(trainerId: string, event: Event) {
    event.stopPropagation();

    if (!trainerId || trainerId.trim() === '') return;

    navigator.clipboard.writeText(trainerId).then(() => {
      this.snackBar.open('Trainer ID copied to clipboard', 'Close', { duration: 2000 });
    }).catch(() => {
      this.snackBar.open('Failed to copy Trainer ID', 'Close', { duration: 2000 });
    });
  }

  // Helper method to check if account ID is valid
  isValidAccountId(accountId: string | undefined): boolean {
    const isValid = !!(accountId && accountId.trim() !== '');
    return isValid;
  }

  // Helper method to get account ID status for debugging
  getAccountIdStatus(record: SupportCardRecordV2Enriched): string {
    if (!record.account_id) {
      return 'No account_id';
    }
    if (record.account_id.trim() === '') {
      return 'Empty account_id';
    }
    return `Valid: ${record.account_id}`;
  }

  // Debug method for button state
  getButtonDisabledReason(record: SupportCardRecordV2Enriched): string {
    const reasons = [];
    if (!this.isValidAccountId(record.account_id)) {
      reasons.push('Invalid account_id');
    }
    if (this.hasReportedTrainer(record.account_id)) {
      reasons.push('Already reported');
    }
    if (this.isReportingInProgress(record.account_id)) {
      reasons.push('Report in progress');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'Should be enabled';
  }

  getLimitBreakDisplayName(limitBreak: number): string {
    switch (limitBreak) {
      case 0: return '';
      case 1: return 'LB1';
      case 2: return 'LB2';
      case 3: return 'LB3';
      case 4: return 'MLB';
      default: return `LB${limitBreak}`;
    }
  }

  getTypeDisplayName(type: SupportCardType): string {
    const typeMap = {
      [SupportCardType.SPEED]: 'Speed',
      [SupportCardType.STAMINA]: 'Stamina',
      [SupportCardType.POWER]: 'Power',
      [SupportCardType.GUTS]: 'Guts',
      [SupportCardType.WISDOM]: 'Wisdom',
      [SupportCardType.FRIEND]: 'Friend'
    };
    return typeMap[type] || 'Unknown';
  }

  getRarityDisplayName(rarity: Rarity): string {
    const rarityMap = {
      [Rarity.R]: 'R',
      [Rarity.SR]: 'SR',
      [Rarity.SSR]: 'SSR'
    };
    return rarityMap[rarity] || 'Unknown';
  }

  getLimitBreakIcons(limitBreak: number): Array<{ filled: boolean }> {
    // Maximum limit break is typically 4 for SSR cards
    const maxLimitBreak = 4;
    const icons = [];

    for (let i = 0; i < maxLimitBreak; i++) {
      icons.push({
        filled: i < limitBreak
      });
    }

    return icons;
  }

  // Inheritance-related methods
  hasInheritanceData(record: SupportCardRecordV2Enriched): boolean {
    return !!record.inheritance;
  }

  getSparkCounts(record: SupportCardRecordV2Enriched): { blue: number, pink: number, green: number, white: number } {
    if (!record.inheritance) {
      return { blue: 0, pink: 0, green: 0, white: 0 };
    }

    return {
      blue: record.inheritance.blue_sparks?.length || 0,
      pink: record.inheritance.pink_sparks?.length || 0,
      green: record.inheritance.green_sparks?.length || 0,
      white: record.inheritance.white_count || 0
    };
  }

  getDetailedSparks(record: SupportCardRecordV2Enriched): {
    blue: Array<{ name: string, level: number }>,
    pink: Array<{ name: string, level: number }>,
    green: Array<{ name: string, level: number }>
  } {
    if (!record.inheritance) {
      return { blue: [], pink: [], green: [] };
    }

    const blueSparks = (record.inheritance.blue_sparks || []).map(sparkId => {
      const factorType = Math.floor(sparkId / 10);
      const level = sparkId % 10;
      return {
        name: this.getBlueSparkName(factorType),
        level: level
      };
    });

    const pinkSparks = (record.inheritance.pink_sparks || []).map(sparkId => {
      const factorType = Math.floor(sparkId / 10);
      const level = sparkId % 10;
      return {
        name: this.getPinkSparkName(factorType),
        level: level
      };
    });

    const greenSparks = (record.inheritance.green_sparks || []).map(sparkId => {
      // Green sparks are skill IDs, would need skill lookup
      return {
        name: `Skill ${Math.floor(sparkId / 100)}`,
        level: sparkId % 10
      };
    });

    return { blue: blueSparks, pink: pinkSparks, green: greenSparks };
  }

  // Replace the resolveSparks method with one that uses factorService
  resolveSparks(sparkIds: number[] | undefined): SparkInfo[] {
    if (!sparkIds || sparkIds.length === 0) return [];
    return this.factorService.resolveSparks(sparkIds);
  }

  // Single spark resolution
  resolveSpark(sparkId: number): SparkInfo {
    return this.factorService.resolveSpark(sparkId);
  }

  private getBlueSparkName(factorType: number): string {
    const blueSparkNames: { [key: number]: string } = {
      10: 'Speed',
      20: 'Stamina',
      30: 'Power',
      40: 'Guts',
      50: 'Wisdom'
    };
    return blueSparkNames[factorType] || 'Unknown';
  }

  private getPinkSparkName(factorType: number): string {
    const pinkSparkNames: { [key: number]: string } = {
      110: 'Turf',
      120: 'Dirt',
      210: 'Runner',
      220: 'Leader',
      230: 'Betweener',
      240: 'Chaser',
      310: 'Sprint',
      320: 'Mile',
      330: 'Middle',
      340: 'Long'
    };
    return pinkSparkNames[factorType] || 'Unknown';
  }
}