import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { UserProfileResponse, ProfileVisibility } from '../../../models/profile.model';
import { getCharacterById } from '../../../data/character.data';
import { ProfileService } from '../../../services/profile.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-profile-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <div class="page-header">
      <div class="header-content">
        <div class="trainer-row">
          <div class="trainer-avatar" *ngIf="profile.inheritance">
            <img [src]="getCharacterImage(profile.inheritance.main_parent_id)"
                 [alt]="getCharacterName(profile.inheritance.main_parent_id)"
                 *ngIf="getCharacterImage(profile.inheritance.main_parent_id)">
            <mat-icon *ngIf="!getCharacterImage(profile.inheritance.main_parent_id)">person</mat-icon>
          </div>
          <div class="trainer-avatar" *ngIf="!profile.inheritance">
            <mat-icon>person</mat-icon>
          </div>
          <div class="trainer-details">
            <h1>{{ profile.trainer.name || 'Unknown Trainer' }}</h1>
            <div class="trainer-meta">
              <span class="meta-item">
                <mat-icon>tag</mat-icon>
                <span class="mono">{{ profile.trainer.account_id }}</span>
              </span>
              <span class="meta-item" *ngIf="profile.trainer.follower_num">
                <mat-icon>people</mat-icon>
                <span>{{ profile.trainer.follower_num | number }} followers</span>
              </span>
              <span class="meta-item" *ngIf="profile.trainer.own_follow_num != null">
                <mat-icon>person_add</mat-icon>
                <span>{{ profile.trainer.own_follow_num | number }} following</span>
              </span>
              <span class="meta-item" *ngIf="profile.circle">
                <mat-icon>groups</mat-icon>
                <a [routerLink]="['/circles', profile.circle!.circle_id]" class="circle-link">
                  {{ profile.circle!.name }}
                </a>
              </span>
              <span class="meta-item" *ngIf="profile.trainer.team_class != null">
                <mat-icon>military_tech</mat-icon>
                <span>{{ getTeamClassName(profile.trainer.team_class) }}</span>
              </span>
              <span class="meta-item" *ngIf="profile.trainer.rank_score != null">
                <mat-icon>star_rate</mat-icon>
                <span class="mono">{{ profile.trainer.rank_score | number }}</span>
              </span>
            </div>
            <p class="trainer-comment" *ngIf="profile.trainer.comment">{{ profile.trainer.comment }}</p>
          </div>
        </div>

        <div class="quick-stats">
          <div class="stat-card" *ngIf="profile.fan_history.alltime">
            <div class="stat-value mono">{{ formatNumber(profile.fan_history.alltime.total_fans) }}</div>
            <div class="stat-label">Total Fans</div>
          </div>
          <div class="stat-card" *ngIf="profile.fan_history.rolling">
            <div class="stat-value mono" [style.color]="getGainColor(profile.fan_history.rolling.gain_7d)">
              {{ profile.fan_history.rolling.gain_7d >= 0 ? '+' : '' }}{{ formatNumber(profile.fan_history.rolling.gain_7d) }}
            </div>
            <div class="stat-label">7-Day Gain</div>
          </div>
          <div class="stat-card" *ngIf="profile.fan_history.alltime">
            <div class="stat-value mono">#{{ profile.fan_history.alltime.rank_total_fans | number }}</div>
            <div class="stat-label">Global Rank</div>
          </div>
          <div class="stat-card" *ngIf="profile.trainer.team_evaluation_point != null">
            <div class="stat-value mono">{{ profile.trainer.team_evaluation_point | number }}</div>
            <div class="stat-label">Team Eval</div>
          </div>
          <div class="stat-card" *ngIf="profile.trainer.best_team_class != null">
            <div class="stat-value mono">{{ getTeamClassName(profile.trainer.best_team_class) }}</div>
            <div class="stat-label">Best Class</div>
          </div>
          <div class="stat-card" *ngIf="profile.fan_history.rolling">
            <div class="stat-value mono" [style.color]="getGainColor(profile.fan_history.rolling.gain_30d)">
              {{ profile.fan_history.rolling.gain_30d >= 0 ? '+' : '' }}{{ formatNumber(profile.fan_history.rolling.gain_30d) }}
            </div>
            <div class="stat-label">30-Day Gain</div>
          </div>
        </div>
      </div>
    </div>
    <div class="owner-controls" *ngIf="isOwnProfile">
      <div class="owner-controls-inner">
        <div class="owner-label">
          <mat-icon>tune</mat-icon>
          <span>Visibility</span>
        </div>
        <div class="owner-row-right">
          <span class="saving-indicator" *ngIf="savingVisibility">
            <mat-icon class="spin-small">sync</mat-icon>
          </span>
          <button class="profile-hidden-toggle" [class.active]="visibility.profile_hidden" (click)="toggleProfileHidden()">
            <span class="toggle-track"><span class="toggle-knob"></span></span>
            <span class="toggle-label">{{ visibility.profile_hidden ? 'Entire Profile Hidden' : 'Profile Visible' }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      background: linear-gradient(135deg, rgba(100,181,246,0.08) 0%, rgba(129,199,132,0.06) 100%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 2rem 0;
    }
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
    }
    .trainer-row {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    @media (max-width: 600px) {
      .trainer-row { flex-direction: column; align-items: flex-start; gap: 1rem; }
    }
    .trainer-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    .trainer-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .trainer-avatar mat-icon { font-size: 2.5rem; width: 2.5rem; height: 2.5rem; color: rgba(255,255,255,0.3); }
    .trainer-details { flex: 1; min-width: 0; }
    .trainer-details h1 { margin: 0 0 0.5rem; font-size: 1.6rem; font-weight: 700; color: #fff; }
    .trainer-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 0.6rem;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: rgba(255,255,255,0.5);
      font-size: 0.8rem;
    }
    .meta-item mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .meta-item a.circle-link { color: #64b5f6; text-decoration: none; }
    .meta-item a.circle-link:hover { text-decoration: underline; }
    .trainer-comment {
      margin: 0;
      color: rgba(255,255,255,0.4);
      font-size: 0.8rem;
      border-left: 2px solid rgba(255,255,255,0.1);
      padding-left: 0.75rem;
      word-break: break-all;
      font-family: monospace;
    }
    .quick-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 0.75rem;
      margin-top: 1.25rem;
    }
    .stat-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 0.75rem 0.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      transition: background 0.2s ease, transform 0.2s ease;
    }
    .stat-card:hover { background: rgba(255,255,255,0.07); transform: translateY(-1px); }
    .stat-value { font-size: 1.15rem; font-weight: 700; color: #fff; line-height: 1.2; }
    .stat-label { font-size: 0.7rem; color: rgba(255,255,255,0.4); margin-top: 0.2rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .owner-controls { background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); }
    .owner-controls-inner { max-width: 1200px; margin: 0 auto; padding: 0.5rem 2rem; display: flex; align-items: center; justify-content: space-between; }
    .owner-label { display: flex; align-items: center; gap: 0.4rem; color: rgba(255,255,255,0.35); font-size: 0.7rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.6px; }
    .owner-label mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .owner-row-right { display: flex; align-items: center; gap: 0.75rem; }
    .saving-indicator { color: rgba(255,255,255,0.3); display: flex; align-items: center; }
    .profile-hidden-toggle { display: flex; align-items: center; gap: 0.5rem; padding: 0; border: none; background: none; cursor: pointer; font-size: 0.8rem; color: rgba(255,255,255,0.6); transition: color 0.2s; }
    .profile-hidden-toggle:hover { color: rgba(255,255,255,0.8); }
    .toggle-track { position: relative; width: 34px; height: 18px; border-radius: 9px; background: rgba(255,255,255,0.12); transition: background 0.25s; flex-shrink: 0; }
    .toggle-knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,0.5); transition: all 0.25s; }
    .toggle-label { font-weight: 500; }
    .profile-hidden-toggle.active { color: #e57373; }
    .profile-hidden-toggle.active .toggle-track { background: rgba(229,115,115,0.35); }
    .profile-hidden-toggle.active .toggle-knob { left: 18px; background: #e57373; }
    @keyframes spin-small { to { transform: rotate(360deg); } }
    .spin-small { animation: spin-small 1s linear infinite; }
    @media (max-width: 600px) {
      .page-header { padding: 1.25rem 0; }
      .header-content { padding: 0 1rem; }
      .trainer-avatar { width: 60px; height: 60px; }
      .trainer-details h1 { font-size: 1.2rem; }
      .trainer-meta { gap: 0.5rem; }
      .quick-stats { gap: 0.5rem; grid-template-columns: repeat(3, 1fr); }
      .stat-card { padding: 0.5rem 0.35rem; }
      .stat-value { font-size: 0.95rem; }
      .stat-label { font-size: 0.6rem; }
      .owner-controls-inner { padding: 0.5rem 1rem; }
    }
    @media (max-width: 400px) {
      .quick-stats { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class ProfileHeaderComponent implements OnInit {
  @Input() profile!: UserProfileResponse;

  isOwnProfile = false;
  visibility: ProfileVisibility = { profile_hidden: false, hidden_sections: [] };
  savingVisibility = false;

  constructor(
    private profileService: ProfileService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.authService.getLinkedAccounts().subscribe({
          next: (accounts) => {
            this.isOwnProfile = accounts.some(a => a.account_id === this.profile.trainer.account_id);
            this.profileService.patchProfileCtx({ isOwnProfile: this.isOwnProfile });
            if (this.isOwnProfile) this.loadVisibility();
          },
          error: () => { this.isOwnProfile = false; }
        });
      } else {
        this.isOwnProfile = false;
      }
    });
  }

  private loadVisibility(): void {
    this.profileService.getVisibility(this.profile.trainer.account_id).subscribe({
      next: (v) => { this.visibility = v; this.profileService.patchProfileCtx({ visibility: v }); },
      error: () => { this.visibility = { profile_hidden: false, hidden_sections: [] }; }
    });
  }

  toggleProfileHidden(): void {
    this.visibility.profile_hidden = !this.visibility.profile_hidden;
    this.savingVisibility = true;
    this.profileService.updateVisibility(this.profile.trainer.account_id, this.visibility).subscribe({
      next: (v) => { this.visibility = v; this.savingVisibility = false; this.profileService.patchProfileCtx({ visibility: v }); },
      error: () => { this.savingVisibility = false; }
    });
  }

  getCharacterImage(charId: number): string | null {
    const char = getCharacterById(charId);
    return char ? `assets/images/character_stand/${char.image}` : null;
  }

  getCharacterName(charId: number): string {
    const char = getCharacterById(charId);
    return char?.name || `Character ${charId}`;
  }

  formatNumber(n: number): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  getGainColor(gain: number): string {
    if (gain > 0) return '#81c784';
    if (gain < 0) return '#e57373';
    return 'rgba(255,255,255,0.5)';
  }

  getTeamClassName(teamClass: number | null): string {
    if (teamClass == null) return '—';
    const names: Record<number, string> = { 1: 'Class 1', 2: 'Class 2', 3: 'Class 3', 4: 'Class 4', 5: 'Class 5', 6: 'Class 6', 7: 'Open' };
    return names[teamClass] || `Class ${teamClass}`;
  }
}
