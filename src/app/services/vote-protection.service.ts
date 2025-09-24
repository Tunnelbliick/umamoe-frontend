import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomainStorageService } from './domain-storage.service';

export interface VoteProtectionConfig {
  voteCooldownMs?: number;        // Cooldown per record (default: 2000ms)
  globalCooldownMs?: number;      // Global cooldown between any votes (default: 500ms)
  maxVotesPerRecord?: number;     // Max votes per record per session (default: unlimited)
  showCooldownMessages?: boolean; // Show cooldown messages (default: true)
}

export interface StoredVote {
  recordId: string;
  voteType: 'up' | 'down';
  timestamp: number;
}

export interface VoteState {
  hasVoted: boolean;
  voteType: 'up' | 'down' | null;
  canVote: boolean;
  cooldownRemaining: number;
  isInProgress: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VoteProtectionService {
  private votingInProgress = new Set<string>();
  private voteHistory = new Map<string, number>();
  private voteCount = new Map<string, number>();
  private lastVoteTime = 0;

  // Report protection
  private reportedTrainers = new Set<string>();
  private reportingInProgress = new Set<string>();

  private readonly STORAGE_KEY = 'inheritance_votes';
  private readonly REPORTS_STORAGE_KEY = 'reported_trainers';
  private readonly MAX_STORED_DAYS = 30;

  private readonly defaultConfig: Required<VoteProtectionConfig> = {
    voteCooldownMs: 2000,
    globalCooldownMs: 500,
    maxVotesPerRecord: Number.MAX_SAFE_INTEGER,
    showCooldownMessages: true
  };

  constructor(private snackBar: MatSnackBar, private domainStorage: DomainStorageService) {
    this.loadStoredVotes();
    this.loadReportedTrainers();
  }

  /**
   * Load votes from localStorage
   */
  private loadStoredVotes(): void {
    try {
      const stored = this.domainStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const votes: StoredVote[] = JSON.parse(stored);
      const cutoff = Date.now() - (this.MAX_STORED_DAYS * 24 * 60 * 60 * 1000);
      
      // Filter out old votes and update storage
      const validVotes = votes.filter(vote => vote.timestamp > cutoff);
      if (validVotes.length !== votes.length) {
        this.saveStoredVotes(validVotes);
      }
    } catch (error) {
      console.warn('Error loading stored votes:', error);
    }
  }

  /**
   * Save votes to localStorage
   */
  private saveStoredVotes(votes: StoredVote[]): void {
    try {
      this.domainStorage.setItem(this.STORAGE_KEY, JSON.stringify(votes));
    } catch (error) {
      console.warn('Error saving votes to localStorage:', error);
    }
  }

  /**
   * Get stored votes from localStorage
   */
  private getStoredVotes(): StoredVote[] {
    try {
      const stored = this.domainStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Error reading stored votes:', error);
      return [];
    }
  }

  /**
   * Check if voting is allowed for a specific record
   */
  canVote(recordId: string, config: VoteProtectionConfig = {}): boolean {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    // Check if user has already voted (stored votes take precedence)
    if (this.hasVoted(recordId)) {
      return false;
    }
    
    if (this.votingInProgress.has(recordId)) return false;
    
    const now = Date.now();
    
    // Check global cooldown
    if (now - this.lastVoteTime < finalConfig.globalCooldownMs) return false;
    
    // Check record-specific cooldown
    const lastVoteOnRecord = this.voteHistory.get(recordId) || 0;
    if (now - lastVoteOnRecord < finalConfig.voteCooldownMs) return false;
    
    // Check vote count limit
    const currentVoteCount = this.voteCount.get(recordId) || 0;
    if (currentVoteCount >= finalConfig.maxVotesPerRecord) return false;
    
    return true;
  }

  /**
   * Start voting process - marks record as voting in progress
   */
  startVoting(recordId: string): boolean {
    if (this.votingInProgress.has(recordId)) return false;
    
    this.votingInProgress.add(recordId);
    this.lastVoteTime = Date.now();
    return true;
  }

  /**
   * Complete voting process - updates history and clears progress state
   */
  completeVoting(recordId: string, success: boolean = true): void {
    this.votingInProgress.delete(recordId);
    
    if (success) {
      this.voteHistory.set(recordId, Date.now());
      const currentCount = this.voteCount.get(recordId) || 0;
      this.voteCount.set(recordId, currentCount + 1);
    }
  }

  /**
   * Check if voting is currently in progress for a record
   */
  isVotingInProgress(recordId: string): boolean {
    return this.votingInProgress.has(recordId);
  }

  /**
   * Get cooldown message for UI display
   */
  getCooldownMessage(recordId: string, config: VoteProtectionConfig = {}): string {
    const finalConfig = { ...this.defaultConfig, ...config };
    const now = Date.now();
    
    // Check vote count limit
    const currentVoteCount = this.voteCount.get(recordId) || 0;
    if (currentVoteCount >= finalConfig.maxVotesPerRecord) {
      return 'Vote limit reached';
    }
    
    // Check record-specific cooldown
    const lastVoteOnRecord = this.voteHistory.get(recordId) || 0;
    const timeSinceLastVote = now - lastVoteOnRecord;
    
    if (timeSinceLastVote < finalConfig.voteCooldownMs) {
      const remainingTime = Math.ceil((finalConfig.voteCooldownMs - timeSinceLastVote) / 1000);
      return `Wait ${remainingTime}s`;
    }
    
    // Check global cooldown
    const globalTimeSinceLastVote = now - this.lastVoteTime;
    if (globalTimeSinceLastVote < finalConfig.globalCooldownMs) {
      return 'Please wait...';
    }
    
    return '';
  }

  /**
   * Show appropriate cooldown message in snackbar
   */
  showCooldownMessage(recordId: string, config: VoteProtectionConfig = {}): void {
    const finalConfig = { ...this.defaultConfig, ...config };
    if (!finalConfig.showCooldownMessages) return;
    
    const message = this.getCooldownMessage(recordId, config);
    if (message) {
      this.snackBar.open(message, 'Close', { duration: 1500 });
    }
  }

  /**
   * Attempt to vote with built-in protection checks
   */
  tryVote(
    recordId: string, 
    voteCallback: () => void, 
    config: VoteProtectionConfig = {}
  ): boolean {
    if (!this.canVote(recordId, config)) {
      this.showCooldownMessage(recordId, config);
      return false;
    }
    
    if (!this.startVoting(recordId)) {
      this.snackBar.open('Vote in progress, please wait...', 'Close', { duration: 1500 });
      return false;
    }
    
    voteCallback();
    return true;
  }

  /**
   * Clear all voting data (useful for cleanup)
   */
  clearVotingData(): void {
    this.votingInProgress.clear();
    this.voteHistory.clear();
    this.voteCount.clear();
    this.lastVoteTime = 0;
    
    // Also clear localStorage
    this.domainStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Get voting statistics
   */
  getVotingStats(): {
    inProgress: number;
    totalVotes: number;
    recordsVotedOn: number;
  } {
    const totalVotes = Array.from(this.voteCount.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      inProgress: this.votingInProgress.size,
      totalVotes,
      recordsVotedOn: this.voteCount.size
    };
  }

  /**
   * Get comprehensive vote state for a record
   */
  getVoteState(recordId: string, config: VoteProtectionConfig = {}): VoteState {
    const finalConfig = { ...this.defaultConfig, ...config };
    const storedVotes = this.getStoredVotes();
    const existingVote = storedVotes.find(v => v.recordId === recordId);
    
    const now = Date.now();
    const lastVoteOnRecord = this.voteHistory.get(recordId) || 0;
    const timeSinceLastVote = now - lastVoteOnRecord;
    const globalTimeSinceLastVote = now - this.lastVoteTime;
    
    const recordCooldownRemaining = Math.max(0, finalConfig.voteCooldownMs - timeSinceLastVote);
    const globalCooldownRemaining = Math.max(0, finalConfig.globalCooldownMs - globalTimeSinceLastVote);
    const cooldownRemaining = Math.max(recordCooldownRemaining, globalCooldownRemaining);
    
    return {
      hasVoted: !!existingVote,
      voteType: existingVote?.voteType || null,
      canVote: this.canVote(recordId, config),
      cooldownRemaining: Math.ceil(cooldownRemaining / 1000),
      isInProgress: this.isVotingInProgress(recordId)
    };
  }

  /**
   * Record a vote in localStorage
   */
  recordVote(recordId: string, voteType: 'up' | 'down'): boolean {
    const votes = this.getStoredVotes();
    
    // Remove existing vote for this record if any
    const filteredVotes = votes.filter(v => v.recordId !== recordId);
    
    // Add new vote
    const newVote: StoredVote = {
      recordId,
      voteType,
      timestamp: Date.now()
    };
    
    filteredVotes.push(newVote);
    this.saveStoredVotes(filteredVotes);
    
    return true;
  }

  /**
   * Remove a vote from localStorage
   */
  removeVote(recordId: string): boolean {
    const votes = this.getStoredVotes();
    const filteredVotes = votes.filter(v => v.recordId !== recordId);
    
    if (filteredVotes.length !== votes.length) {
      this.saveStoredVotes(filteredVotes);
      return true;
    }
    
    return false;
  }

  /**
   * Check if user has already voted on a record
   */
  hasVoted(recordId: string): boolean {
    const votes = this.getStoredVotes();
    return votes.some(v => v.recordId === recordId);
  }

  /**
   * Get user's vote type for a record
   */
  getUserVote(recordId: string): 'up' | 'down' | null {
    const votes = this.getStoredVotes();
    const vote = votes.find(v => v.recordId === recordId);
    return vote?.voteType || null;
  }

  // === REPORT PROTECTION METHODS ===

  /**
   * Load reported trainers from localStorage
   */
  private loadReportedTrainers(): void {
    try {
      const stored = this.domainStorage.getItem(this.REPORTS_STORAGE_KEY);
      if (stored) {
        const reports = JSON.parse(stored) as string[];
        this.reportedTrainers = new Set(reports);
      }
    } catch (error) {
      console.warn('Failed to load reported trainers from localStorage:', error);
      this.reportedTrainers = new Set();
    }
  }

  /**
   * Save reported trainers to localStorage
   */
  private saveReportedTrainers(): void {
    try {
      const reports = Array.from(this.reportedTrainers);
      this.domainStorage.setItem(this.REPORTS_STORAGE_KEY, JSON.stringify(reports));
    } catch (error) {
      console.warn('Failed to save reported trainers to localStorage:', error);
    }
  }

  /**
   * Check if a trainer has already been reported
   */
  hasReported(trainerId: string): boolean {
    return this.reportedTrainers.has(trainerId);
  }

  /**
   * Check if reporting is in progress for a trainer
   */
  isReportingInProgress(trainerId: string): boolean {
    return this.reportingInProgress.has(trainerId);
  }

  /**
   * Check if user can report a trainer (not already reported and not in progress)
   */
  canReport(trainerId: string): boolean {
    return !this.hasReported(trainerId) && !this.isReportingInProgress(trainerId);
  }

  /**
   * Attempt to report a trainer
   */
  attemptReport(trainerId: string, showMessages: boolean = true): boolean {
    if (this.hasReported(trainerId)) {
      if (showMessages) {
        this.snackBar.open('You have already reported this trainer', 'Close', { duration: 3000 });
      }
      return false;
    }

    if (this.isReportingInProgress(trainerId)) {
      if (showMessages) {
        this.snackBar.open('Report already in progress', 'Close', { duration: 2000 });
      }
      return false;
    }

    // Mark as in progress
    this.reportingInProgress.add(trainerId);
    return true;
  }

  /**
   * Mark report as completed (successful)
   */
  markReportCompleted(trainerId: string): void {
    this.reportingInProgress.delete(trainerId);
    this.reportedTrainers.add(trainerId);
    this.saveReportedTrainers();
  }

  /**
   * Mark report as failed (remove from in-progress)
   */
  markReportFailed(trainerId: string): void {
    this.reportingInProgress.delete(trainerId);
  }

  /**
   * Clear all reported trainers (for debugging/admin purposes)
   */
  clearReportedTrainers(): void {
    this.reportedTrainers.clear();
    this.reportingInProgress.clear();
    this.domainStorage.removeItem(this.REPORTS_STORAGE_KEY);
  }
}
