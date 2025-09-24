import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Subject, takeUntil } from 'rxjs';
import { Meta, Title } from '@angular/platform-browser';

import { InheritanceService } from '../../services/inheritance.service';
import { VoteProtectionService, VoteState } from '../../services/vote-protection.service';
import { FactorService, SparkInfo } from '../../services/factor.service';
import { SupportCardService } from '../../services/support-card.service';
import { InheritanceFilterComponent, InheritanceFilters } from './inheritance-filter.component';
import { TrainerSubmitDialogComponent, TrainerSubmissionConfig } from '../../components/trainer-submit-dialog/trainer-submit-dialog.component';
import { TrainerIdFormatPipe } from '../../pipes/trainer-id-format.pipe';
import {
  InheritanceRecord,
  InheritanceSearchFilters
} from '../../models/inheritance.model';
import { SearchResult } from '../../models/common.model';
import { SupportCardShort } from '../../models/support-card.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-inheritance-database',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    InheritanceFilterComponent,
    TrainerIdFormatPipe
  ],
  templateUrl: './inheritance-database.component.html',
  styleUrl: './inheritance-database.component.scss'
})
export class InheritanceDatabaseComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  environment = environment;
  isMobile = false;
  mobileBreakpoint = 1000; // Adjust as needed for your design
  loading = false;
  loadingMore = false;
  allRecords: InheritanceRecord[] = [];
  currentFilters: InheritanceFilters | null = null;
  hasMoreRecords = true;

  // Infinite scroll properties
  pageSize = 12;
  currentPage = 0;

  totalRecords = 0; // Total records from the search result

  // Sorting properties
  currentSortBy = 'win_count';
  currentSortOrder: 'asc' | 'desc' = 'desc';

  sortOptions = [
    { value: 'win_count', label: 'G1 Wins' },
    { value: 'white_count', label: 'White Count' },
    { value: 'score', label: 'Score' },
    { value: 'submitted_at', label: 'Most Recent' },
  ];

  // Vote state tracking
  voteStates = new Map<string, VoteState>();

  // Trainer ID filter from URL parameters
  trainerIdFilter: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private inheritanceService: InheritanceService,
    private voteProtection: VoteProtectionService,
    private factorService: FactorService,
    private supportCardService: SupportCardService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private meta: Meta,
    private title: Title
  ) {
    this.title.setTitle('Inheritance Database | honse.moe');
    this.meta.addTags([
      { name: 'description', content: 'Browse and search the Umamusume inheritance database. Find optimal inheritance skills and combinations for your team.' },
      { property: 'og:title', content: 'Inheritance Database | honse.moe' },
      { property: 'og:description', content: 'Browse and search the Umamusume inheritance database. Find optimal inheritance skills and combinations for your team.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://honsemoe.com/inheritance-database' },
      { property: 'og:image', content: 'https://honsemoe.com/assets/logo.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Inheritance Database | honse.moe' },
      { name: 'twitter:description', content: 'Browse and search the Umamusume inheritance database. Find optimal inheritance skills and combinations for your team.' },
      { name: 'twitter:image', content: 'https://honsemoe.com/assets/logo.png' }
    ]);
  }

  ngOnInit() {
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
        this.title.setTitle(`Inheritance Database - Trainer ${trainerId} | honse.moe`);
        this.meta.updateTag({ 
          name: 'description', 
          content: `Browse inheritance records for trainer ${trainerId} in the Umamusume database.` 
        });
      } else if (!trainerId && this.trainerIdFilter) {
        // Trainer ID parameter was removed, clear filter
        this.trainerIdFilter = null;
        this.currentPage = 0;
        this.allRecords = [];
        this.hasMoreRecords = true;
        this.searchRecords();
        
        // Reset title and meta tags
        this.title.setTitle('Inheritance Database | honse.moe');
        this.meta.updateTag({ 
          name: 'description', 
          content: 'Browse and search the Umamusume inheritance database. Find optimal inheritance skills and combinations for your team.' 
        });
      }
    });

    // Initial search (will include trainer_id if present in URL)
    if (!this.trainerIdFilter) {
      this.searchRecords();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFiltersChanged(filters: InheritanceFilters) {
    if (!environment.production) {
      console.log('Filters changed:', filters);
    }
    this.currentFilters = filters;
    this.currentPage = 0; // Reset to first page
    this.allRecords = []; // Clear existing records
    this.hasMoreRecords = true;
    this.searchRecords();
  }

  onSortChanged(event: any) {
    this.currentSortBy = event.value;
    this.currentPage = 0; // Reset to first page when sorting changes
    this.allRecords = []; // Clear existing records
    this.hasMoreRecords = true;
    this.searchRecords();
  }

  searchRecords() {
    if (this.loading || this.loadingMore) {
      return; // Prevent multiple simultaneous requests
    }

    // Set appropriate loading state
    if (this.currentPage === 0) {
      this.loading = true;
    } else {
      this.loadingMore = true;
    }

    // Convert filter component format to service format
    const searchFilters: InheritanceSearchFilters = {
      trainerId: this.trainerIdFilter || undefined, // Add trainer ID filter from URL
      umaId: this.currentFilters?.selectedCharacterId || undefined,
      page: this.currentPage,
      pageSize: this.pageSize,
      sortBy: this.mapSortByToBackend(this.currentSortBy),
      sortOrder: 'desc', // All V2 API sorts are descending
      minParentRank: (this.currentFilters?.parentRank && this.currentFilters.parentRank > 0) ? this.currentFilters.parentRank : undefined,
      minWinCount: (this.currentFilters?.winCount && this.currentFilters.winCount > 0) ? this.currentFilters.winCount : undefined,
      minWhiteCount: (this.currentFilters?.whiteCount && this.currentFilters.whiteCount > 0) ? this.currentFilters.whiteCount : undefined
    };

    // Convert main stats (blue sparks) to backend format using factor IDs
    if (this.currentFilters?.mainStats) {
      this.currentFilters.mainStats.forEach(stat => {
        if (stat.type && stat.level && stat.level > 0) {
          // Factor ID mapping for blue sparks (main stats)
          switch (stat.type) {
            case '10': // Speed
              searchFilters.speedSpark = stat.level;
              break;
            case '20': // Stamina
              searchFilters.staminaSpark = stat.level;
              break;
            case '30': // Power
              searchFilters.powerSpark = stat.level;
              break;
            case '40': // Guts
              searchFilters.gutsSpark = stat.level;
              break;
            case '50': // Wit
              searchFilters.witSpark = stat.level;
              break;
          }
        }
      });
    }

    // Convert aptitudes (pink sparks) to backend format using factor IDs
    if (this.currentFilters?.aptitudes) {
      this.currentFilters.aptitudes.forEach(aptitude => {
        if (aptitude.type && aptitude.level && aptitude.level > 0) {
          // Factor ID mapping for pink sparks (aptitudes)
          switch (aptitude.type) {
            case '110': // Turf
              searchFilters.turfSpark = aptitude.level;
              break;
            case '120': // Dirt
              searchFilters.dirtSpark = aptitude.level;
              break;
            case '310': // Sprint
              searchFilters.sprintSpark = aptitude.level;
              break;
            case '320': // Mile
              searchFilters.mileSpark = aptitude.level;
              break;
            case '330': // Middle
              searchFilters.middleSpark = aptitude.level;
              break;
            case '340': // Long
              searchFilters.longSpark = aptitude.level;
              break;
            case '210': // Front Runner
              searchFilters.frontRunnerSpark = aptitude.level;
              break;
            case '220': // Pace Chaser
              searchFilters.paceChaserSpark = aptitude.level;
              break;
            case '230': // Late Surger
              searchFilters.lateSurgerSpark = aptitude.level;
              break;
            case '240': // End
              searchFilters.endSpark = aptitude.level;
              break;
          }
        }
      });
    }

    // Convert skills (green sparks) to unique skills array with levels
    if (this.currentFilters?.skills && this.currentFilters.skills.length > 0) {
      const uniqueSkillIds: number[] = [];
      const skillLevels: { [skillId: number]: number } = {};

      this.currentFilters.skills.forEach(skill => {
        if (skill.type && skill.level && skill.level > 0) {
          // Parse skill type as skill ID if it's a number
          const skillId = parseInt(skill.type, 10);
          if (!isNaN(skillId)) {
            uniqueSkillIds.push(skillId);
            skillLevels[skillId] = skill.level;
          }
        }
      });

      if (uniqueSkillIds.length > 0) {
        searchFilters.uniqueSkills = uniqueSkillIds;
        searchFilters.skillLevels = skillLevels;
      }
    }

    // Convert white sparks to backend format using factor IDs
    if (this.currentFilters?.whiteSparks && this.currentFilters.whiteSparks.length > 0) {
      const whiteSparkFactors: number[] = [];

      this.currentFilters.whiteSparks.forEach(whiteSpark => {
        if (whiteSpark.type && whiteSpark.level && whiteSpark.level > 0) {
          // Create spark value: factorId + level (concatenated as number)
          const factorId = parseInt(whiteSpark.type, 10);
          if (!isNaN(factorId)) {
            const sparkValue = parseInt(`${factorId}${whiteSpark.level}`, 10);
            whiteSparkFactors.push(sparkValue);
          }
        }
      });

      if (whiteSparkFactors.length > 0) {
        searchFilters.whiteSparkFactors = whiteSparkFactors;
      }
    }

    this.inheritanceService.searchInheritance(searchFilters, searchFilters.page, searchFilters.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {

          this.totalRecords = result.total || 0;

          if (this.currentPage === 0) {
            // First page or new search - replace all records
            this.allRecords = result.items || [];
          } else {
            // Subsequent pages - append to existing records
            this.allRecords = [...this.allRecords, ...(result.items || [])];
          }

          // Check if there are more records to load
          this.hasMoreRecords = (result.items?.length || 0) >= this.pageSize;

          if (!environment.production) {
            console.log('V2 Search result:', result);
            console.log('Total records loaded:', this.allRecords.length);
          }

          this.updateVoteStates();
          this.loading = false;
          this.loadingMore = false;
        },
        error: (error) => {
          console.error('V2 Search error:', error);
          this.loading = false;
          this.loadingMore = false;
          this.snackBar.open('Error loading records', 'Close', { duration: 3000 });
        }
      });
  }

  loadMoreRecords() {
    if (!this.hasMoreRecords || this.loading || this.loadingMore) {
      return;
    }

    this.currentPage++;
    this.searchRecords();
  }

  private getStatLevel(statType: string): number | undefined {
    if (!this.currentFilters?.mainStats) return undefined;
    const stat = this.currentFilters.mainStats.find(s => s.type === statType);
    return stat?.level;
  }

  private getAptitudeLevel(aptitudeType: string): number | undefined {
    if (!this.currentFilters?.aptitudes) return undefined;
    const aptitude = this.currentFilters.aptitudes.find(a => a.type === aptitudeType);
    return aptitude?.level;
  }

  hasActiveFilters(): boolean {
    if (!this.currentFilters && !this.trainerIdFilter) return false;

    return !!(
      this.trainerIdFilter ||
      this.currentFilters?.selectedCharacterId ||
      (this.currentFilters?.mainStats && this.currentFilters.mainStats.length > 0) ||
      (this.currentFilters?.aptitudes && this.currentFilters.aptitudes.length > 0) ||
      (this.currentFilters?.skills && this.currentFilters.skills.length > 0) ||
      (this.currentFilters?.whiteSparks && this.currentFilters.whiteSparks.length > 0)
    );
  }

  getStarArray(rating: number): number[] {
    if (!rating || rating < 0) return [];
    return Array(Math.floor(rating)).fill(0);
  }

  getEmptyStarArray(rating: number): number[] {
    if (!rating || rating < 0) return Array(5).fill(0);
    return Array(5 - Math.floor(rating)).fill(0);
  }

  // Helper methods for vote state
  getVoteState(recordId: string): VoteState {
    const voteState = this.voteProtection.getVoteState(recordId);
    if (!environment.production) {
      console.log(`Vote state for ${recordId}:`, voteState);
    }
    return voteState;
  }

  updateVoteStates() {
    if (this.allRecords?.length > 0) {
      this.allRecords.forEach(record => {
        const recordId = record.id.toString(); // Convert to string for vote tracking
        const voteState = this.voteProtection.getVoteState(recordId);
        this.voteStates.set(recordId, voteState);
        if (!environment.production) {
          console.log(`Updated vote state for ${recordId}:`, voteState);
        }
      });
    }
  }

  // Helper methods for template to check record type
  isV2Record(record: InheritanceRecord): boolean {
    return typeof record.id === 'number';
  }

  isV1Record(record: InheritanceRecord): boolean {
    return typeof record.id === 'string';
  }

  // Helper methods for resolving spark IDs to meaningful names
  resolveSparks(sparkIds: number[]): SparkInfo[] {
    return this.factorService.resolveSparks(sparkIds);
  }

  // Get main parent factors for each spark type
  getMainParentFactors(record: InheritanceRecord, sparkType: 'blue' | 'pink' | 'green' | 'white'): SparkInfo[] {
    if (!this.isV2Record(record)) return [];

    let sparkArray: number[] = [];
    let mainCount = 0;

    switch (sparkType) {
      case 'blue':
        sparkArray = record.blue_sparks || [];
        mainCount = record.main_blue_factors || 0;
        break;
      case 'pink':
        sparkArray = record.pink_sparks || [];
        mainCount = record.main_pink_factors || 0;
        break;
      case 'green':
        sparkArray = record.green_sparks || [];
        mainCount = record.main_green_factors || 0;
        break;
      case 'white':
        sparkArray = record.white_sparks || [];
        mainCount = record.main_white_count || 0;
        break;
    }

    // Return the first N sparks (main parent contribution)
    const mainParentSparkIds = sparkArray.slice(0, mainCount);
    return this.resolveSparks(mainParentSparkIds);
  }

  resolveSpark(sparkId: number): SparkInfo {
    return this.factorService.resolveSpark(sparkId);
  }

  isVotingInProgress(recordId: string): boolean {
    const voteState = this.voteStates.get(recordId);
    if (!voteState) {
      const freshState = this.voteProtection.getVoteState(recordId);
      this.voteStates.set(recordId, freshState);
      return freshState.isInProgress;
    }
    return voteState.isInProgress;
  }

  canVoteOnRecord(recordId: string): boolean {
    const voteState = this.voteStates.get(recordId);
    if (!voteState) {
      const freshState = this.voteProtection.getVoteState(recordId);
      this.voteStates.set(recordId, freshState);
      return freshState.canVote && !freshState.isInProgress;
    }
    return voteState.canVote && !voteState.isInProgress;
  }

  getVoteCooldownMessage(recordId: string): string {
    return this.voteProtection.getCooldownMessage(recordId);
  }

  hasUserVoted(recordId: string): boolean {
    const voteState = this.voteStates.get(recordId);
    if (!voteState) {
      const freshState = this.voteProtection.getVoteState(recordId);
      this.voteStates.set(recordId, freshState);
      return freshState.hasVoted;
    }
    return voteState.hasVoted;
  }

  getUserVoteType(recordId: string): 'up' | 'down' | null {
    const voteState = this.voteStates.get(recordId);
    if (!voteState) {
      const freshState = this.voteProtection.getVoteState(recordId);
      this.voteStates.set(recordId, freshState);
      return freshState.voteType;
    }
    return voteState.voteType;
  }

  // Force refresh vote state for a specific record (for debugging)
  refreshVoteState(recordId: string) {
    const freshState = this.voteProtection.getVoteState(recordId);
    this.voteStates.set(recordId, freshState);
    if (!environment.production) {
      console.log(`Refreshed vote state for ${recordId}:`, freshState);
    }
  }

  voteRecord(recordId: string, vote: number) {
    if (!recordId) return;

    const voteType = vote === 1 ? 'up' : 'down';

    // Check if user has already voted
    if (this.voteProtection.hasVoted(recordId)) {
      this.snackBar.open('You have already voted on this record', 'Close', { duration: 2000 });
      return;
    }

    // Use vote protection service to execute the vote
    const success = this.voteProtection.tryVote(recordId, () => {
      if (!environment.production) {
        console.log(`Voting ${voteType} on record:`, recordId);
      }

      this.inheritanceService.voteOnInheritance(recordId, voteType)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (voteResult) => {
            if (!environment.production) {
              console.log('Vote successful:', voteResult);
            }

            // Record the vote in localStorage
            this.voteProtection.recordVote(recordId, voteType);

            this.snackBar.open(`Vote recorded!`, 'Close', { duration: 2000 });

            // Update the record in our current results
            if (this.allRecords?.length > 0) {
              const recordIndex = this.allRecords.findIndex(r => r.id === recordId);
              if (recordIndex >= 0) {
                this.allRecords[recordIndex].upvotes = voteResult.upvotes;
                this.allRecords[recordIndex].downvotes = voteResult.downvotes;
              }
            }

            // Mark voting as complete
            this.voteProtection.completeVoting(recordId, true);

            // Update vote state to reflect the new vote
            this.voteStates.set(recordId, this.voteProtection.getVoteState(recordId));
          },
          error: (error) => {
            console.error('Error voting:', error);
            this.snackBar.open(
              `Failed to vote: ${error.message || 'Unknown error'}`,
              'Close',
              { duration: 3000 }
            );

            // Mark voting as complete (failed)
            this.voteProtection.completeVoting(recordId, false);

            // Update vote state
            this.voteStates.set(recordId, this.voteProtection.getVoteState(recordId));
          }
        });
    });

    if (!success) {
      if (!environment.production) {
        console.log('Vote blocked by protection service');
      }
    } else {
      // Update vote state to show voting in progress
      this.voteStates.set(recordId, { ...this.voteProtection.getVoteState(recordId), isInProgress: true });
    }
  }

  // Rating methods (aliases for voting methods to match HTML template expectations)
  rateRecord(recordId: string, rating: number) {
    // Convert rating to vote: 1 (helpful) = upvote, -1 (unhelpful) = downvote
    const vote = rating > 0 ? 1 : 0;
    this.voteRecord(recordId, vote);
  }

  canRateRecord(recordId: string): boolean {
    return this.canVoteOnRecord(recordId);
  }

  hasUserRated(recordId: string): boolean {
    return this.hasUserVoted(recordId);
  }


  getRatingCooldownMessage(recordId: string): string {
    return this.getVoteCooldownMessage(recordId);
  }

  isRatingInProgress(recordId: string): boolean {
    return this.isVotingInProgress(recordId);
  }

  viewRecord(record: InheritanceRecord) {
    if (!record?.id) return;

    if (!environment.production) {
      console.log('Fetching detailed record:', record.id);
    }

    this.inheritanceService.getInheritanceById(record.id.toString())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detailedRecord) => {
          if (!environment.production) {
            console.log('Detailed record:', detailedRecord);
          }
          // TODO: Open a detailed view dialog or navigate to detail page
          this.snackBar.open('Record details loaded successfully', 'Close', { duration: 2000 });
        },
        error: (error) => {
          console.error('Error fetching record details:', error);
          this.snackBar.open(
            `Failed to load record details: ${error.message || 'Unknown error'}`,
            'Close',
            { duration: 3000 }
          );
        }
      });
  }

  async shareRecord(record: InheritanceRecord) {
    if (!record?.id) return;
    const url = `${window.location.origin}/inheritance/${record.id}`;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText('');
        await navigator.clipboard.writeText(url);
        this.snackBar.open('Link copied to clipboard', 'Close', { duration: 2000 });
      } else {
        this.fallbackCopyToClipboard(url);
      }
    } catch (error) {
      console.warn('Clipboard API failed for share, using fallback:', error);
      this.fallbackCopyToClipboard(url);
    }
  }

  openSubmitDialog() {
    const config: TrainerSubmissionConfig = {
      title: 'Share Trainer ID',
      subtitle: 'Help the community grow'
    };

    const dialogRef = this.dialog.open(TrainerSubmitDialogComponent, {
      maxWidth: '500px',
      disableClose: false,
      data: config
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.trainerId) {
        if (!environment.production) {
          console.log('Submitting trainer ID:', result.trainerId);
        }

        // For now, just show success message since we're only collecting trainer ID
        this.snackBar.open('Trainer ID submitted successfully!', 'Close', { duration: 3000 });

        // Refresh the records list
        this.searchRecords();
      }
    });
  }

  // Scroll detection for infinite scroll
  @HostListener('window:scroll', ['$event'])
  onWindowScroll() {
    const threshold = 300; // Load more when 300px from bottom
    const position = window.pageYOffset + window.innerHeight;
    const height = document.documentElement.scrollHeight;

    if (position > height - threshold && this.hasMoreRecords && !this.loading && !this.loadingMore) {
      this.loadMoreRecords();
    }
  }

  // Copy trainer ID to clipboard
  async copyTrainerId(trainerId: string, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!trainerId) {
      this.snackBar.open('No trainer ID to copy', 'Close', { duration: 2000 });
      return;
    }

    try {
      // Check if clipboard API is supported and we have permission
      if (navigator.clipboard && window.isSecureContext) {
        // Clear clipboard first, then write new content
        await navigator.clipboard.writeText('');
        await navigator.clipboard.writeText(trainerId);
        this.snackBar.open(`Trainer ID copied: ${trainerId}`, 'Close', { duration: 2000 });
      } else {
        // Use fallback method
        this.fallbackCopyToClipboard(trainerId);
      }
    } catch (error) {
      console.warn('Clipboard API failed, using fallback:', error);
      this.fallbackCopyToClipboard(trainerId);
    }
  }

  private fallbackCopyToClipboard(text: string) {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make it invisible and non-interactive
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    textArea.setAttribute('aria-hidden', 'true');

    // Add to DOM, select, copy, then remove
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.snackBar.open(`Trainer ID copied: ${text}`, 'Close', { duration: 2000 });
      } else {
        this.snackBar.open('Failed to copy trainer ID', 'Close', { duration: 2000 });
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      this.snackBar.open('Failed to copy trainer ID', 'Close', { duration: 2000 });
    } finally {
      document.body.removeChild(textArea);
    }
  }

  // Report trainer friend list as full
  reportUnavailable(trainerId: string, event: Event) {
    event.stopPropagation();

    // Check if user can report this trainer
    if (!this.voteProtection.canReport(trainerId)) {
      return; // Protection service will show appropriate message
    }

    // Show confirmation dialog
    const confirmed = confirm(`Report trainer ${trainerId} as unavailable or friend list full?`);
    if (!confirmed) {
      return;
    }

    // Attempt to start the report process
    if (!this.voteProtection.attemptReport(trainerId)) {
      return; // Protection service will show appropriate message
    }

    // Call backend API to report user
    this.inheritanceService.reportUserUnavailable(trainerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.voteProtection.markReportCompleted(trainerId);
          this.snackBar.open('Trainer reported as unavailable', 'Close', { duration: 2000 });
          this.searchRecords();
        },
        error: (error: any) => {
          this.voteProtection.markReportFailed(trainerId);
          console.error('Failed to report trainer:', error);
          // For now, show success even if backend fails (graceful degradation)
          this.snackBar.open('Report submitted (service temporarily unavailable)', 'Close', { duration: 3000 });
        }
      });
  }

  // Check if trainer has been reported
  hasReportedTrainer(trainerId: string): boolean {
    return this.voteProtection.hasReported(trainerId);
  }

  // Check if reporting is in progress
  isReportingInProgress(trainerId: string): boolean {
    return this.voteProtection.isReportingInProgress(trainerId);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.checkMobileBreakpoint();
  }

  private checkMobileBreakpoint(): void {
    const wasIsMobile = this.isMobile;
    this.isMobile = window.innerWidth < this.mobileBreakpoint;
  }

  private mapSortByToBackend(sortBy: string): 'submitted_at' | 'upvotes' | 'downvotes' | 'trainer_id' | 'verified' | 'submittedAt' | 'createdAt' | 'rating' | 'votes' | 'views' | 'totalStats' | 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom' | 'win_count' | 'white_count' | 'score' {
    const sortMapping: { [key: string]: 'submitted_at' | 'upvotes' | 'downvotes' | 'trainer_id' | 'verified' | 'submittedAt' | 'createdAt' | 'rating' | 'votes' | 'views' | 'totalStats' | 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom' | 'win_count' | 'white_count' | 'score' } = {
      'win_count': 'win_count',
      'white_count': 'white_count',
      'score': 'score',
      'submitted_at': 'submitted_at', // This maps to last_updated in V2 API
      'upvotes': 'upvotes',
      'downvotes': 'downvotes',
      'trainer_id': 'trainer_id',
      'verified': 'verified'
    };
    return sortMapping[sortBy] || 'win_count';
  }

  getLevelFromMainParent(currentspark: SparkInfo, record: InheritanceRecord): string | undefined {

    let id = currentspark.factorId;

    let main_factors = [record.main_blue_factors, record.main_pink_factors, record.main_green_factors].concat(record.main_white_factors || []);

    // Strip the last digit from each spark value to get the factor ID
    let factorIds = main_factors
      .filter(spark => spark !== undefined && spark !== null)
      .map(spark => spark!.toString().slice(0, -1));

    const mainFactorId = factorIds.findIndex(factorId => factorId === id);
    if (mainFactorId !== -1)
      return main_factors[mainFactorId]?.toString().slice(-1);


    return undefined;
  }

  // Support card helper methods
  getSupportCardInfo(supportCardId: number): Promise<SupportCardShort | undefined> {
    return this.supportCardService.getSupportCardById(supportCardId.toString()).pipe().toPromise();
  }

  getSupportCardImageUrl(supportCardId: number): string {
    return `/assets/images/support_card/half/support_card_s_${supportCardId}.png`;
  }

  getSupportCardName(supportCardId: number): string {
    // For now, return a fallback until we implement card lookup
    return `Support Card ${supportCardId}`;
  }

  // Limit break display helper - matches support cards database format
  getLimitBreakArray(limitBreakCount: number): { filled: boolean }[] {
    // Maximum limit break is typically 4 for SSR cards
    const maxLimitBreak = 4;
    const icons = [];

    for (let i = 0; i < maxLimitBreak; i++) {
      icons.push({
        filled: i < limitBreakCount
      });
    }

    return icons;
  }

  // Handle support card image loading errors
  handleSupportCardImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    const wrapper = imgElement.closest('.support-card-wrapper');
    if (wrapper) {
      wrapper.classList.add('image-error');
    }
  }

  copyUserId(trainerId: string | undefined, event: Event) {
    event.stopPropagation();

    if (!trainerId || trainerId.trim() === '') return;

    navigator.clipboard.writeText(trainerId).then(() => {
      this.snackBar.open('Trainer ID copied to clipboard', 'Close', { duration: 2000 });
    }).catch(() => {
      this.snackBar.open('Failed to copy Trainer ID', 'Close', { duration: 2000 });
    });
  }
}