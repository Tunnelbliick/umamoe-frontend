import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProfileService } from '../../services/profile.service';
import { UserProfileResponse, CircleHistoryEntry, ProfileVisibility } from '../../models/profile.model';
import { AuthService } from '../../services/auth.service';
import { getCharacterById } from '../../data/character.data';
import { getSupportCardById } from '../../data/support-cards.data';
import { FactorService, SparkInfo } from '../../services/factor.service';
import { ProfileHeaderComponent } from './profile-header/profile-header.component';
import { ResolveSparksPipe } from '../../pipes/resolve-sparks.pipe';
import { InheritanceEntryComponent } from '../../components/inheritance-entry/inheritance-entry.component';
import { RankBadgeComponent } from '../../components/rank-badge/rank-badge.component';
import { InheritanceRecord } from '../../models/inheritance.model';
import { Meta, Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import {
    getAptGrade, getRankGrade, getRankGradeColor, getStarDisplay,
    getDistanceName, getRunningStyleName, getScenarioName, getTotalStats,
    getCardImage, getSkillName, getSkillLevel, getSkillIcon, getSkillRarityClass,
} from './profile-helpers';

export interface CircleMembership {
    circle_id: number;
    circle_name: string;
    from: { year: number; month: number };
    to: { year: number; month: number };
    months: number;
    current: boolean;
}

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, RouterModule, RouterOutlet, MatIconModule, ResolveSparksPipe, ProfileHeaderComponent, InheritanceEntryComponent, RankBadgeComponent],
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit, OnDestroy {
    profile: UserProfileResponse | null = null;
    loading = true;
    error: string | null = null;
    profileHidden = false;
    accountId = '';
    circleMemberships: CircleMembership[] = [];
    stadiumByDistance: { distance: string; members: any[] }[] = [];
    selectedStadiumTab = 0;
    hasActiveChild = false;
    inheritanceRecord: InheritanceRecord | null = null;

    // Owner controls
    isOwnProfile = false;
    visibility: ProfileVisibility = { profile_hidden: false, hidden_sections: [] };
    savingVisibility = false;
    private authSub?: Subscription;

    constructor(
        private route: ActivatedRoute,
        private profileService: ProfileService,
        private authService: AuthService,
        private factorService: FactorService,
        private title: Title,
        private meta: Meta
    ) { }

    ngOnInit(): void {
        this.accountId = this.route.snapshot.paramMap.get('accountId') || '';
        if (!this.accountId) {
            this.error = 'No account ID provided.';
            this.loading = false;
            return;
        }
        this.loadProfile();
        this.checkOwnership();
    }

    ngOnDestroy(): void {
        this.authSub?.unsubscribe();
        this.profileService.resetProfileCtx();
    }

    onActivate(_comp: any): void { this.hasActiveChild = true; }
    onDeactivate(_comp: any): void { this.hasActiveChild = false; }

    private checkOwnership(): void {
        this.authSub = this.authService.user$.subscribe(user => {
            if (user) {
                this.authService.getLinkedAccounts().subscribe({
                    next: (accounts) => {
                        this.isOwnProfile = accounts.some(a => a.account_id === this.accountId);
                        this.profileService.patchProfileCtx({ isOwnProfile: this.isOwnProfile });
                        if (this.isOwnProfile) {
                            this.loadVisibility();
                        }
                    },
                    error: () => {
                        this.isOwnProfile = false;
                        this.profileService.patchProfileCtx({ isOwnProfile: false });
                    }
                });
            } else {
                this.isOwnProfile = false;
                this.profileService.patchProfileCtx({ isOwnProfile: false });
            }
        });
    }

    private loadVisibility(): void {
        this.profileService.getVisibility(this.accountId).subscribe({
            next: (v) => {
                this.visibility = v;
            },
            error: () => {
                // No settings yet — defaults are all visible
                this.visibility = { profile_hidden: false, hidden_sections: [] };
            }
        });
    }

    private saveVisibility(): void {
        this.savingVisibility = true;
        this.profileService.updateVisibility(this.accountId, this.visibility).subscribe({
            next: (v) => {
                this.visibility = v;
                this.savingVisibility = false;
            },
            error: () => {
                this.savingVisibility = false;
            }
        });
    }

    toggleProfileHidden(): void {
        this.visibility.profile_hidden = !this.visibility.profile_hidden;
        this.saveVisibility();
    }

    toggleSection(section: string): void {
        const idx = this.visibility.hidden_sections.indexOf(section);
        if (idx >= 0) {
            this.visibility.hidden_sections.splice(idx, 1);
        } else {
            this.visibility.hidden_sections.push(section);
        }
        this.saveVisibility();
    }

    isSectionVisible(section: string): boolean {
        return !this.visibility.hidden_sections.includes(section);
    }

    private loadProfile(): void {
        this.loading = true;
        this.error = null;
        this.profileService.getProfile(this.accountId).subscribe({
            next: (profile) => {
                this.profile = profile;
                this.profileService.patchProfileCtx({ profile });
                this.circleMemberships = this.buildCircleMemberships(profile.circle_history);
                this.stadiumByDistance = this.getStadiumByDistance();
                this.inheritanceRecord = this.buildInheritanceRecord(profile);
                this.loading = false;
                const name = profile.trainer.name || this.accountId;
                this.title.setTitle(`${name} | uma.moe`);
                this.meta.updateTag({ property: 'og:title', content: `${name} — Trainer Profile | uma.moe` });
            },
            error: (err) => {
                this.loading = false;
                if (err.status === 404) {
                    this.error = 'Trainer not found.';
                } else if (err.status === 403) {
                    this.profileHidden = true;
                } else {
                    this.error = 'Failed to load profile.';
                }
            }
        });
    }

    private buildCircleMemberships(history: CircleHistoryEntry[]): CircleMembership[] {
        if (!history || history.length === 0) return [];

        // Sort oldest first
        const sorted = [...history].sort((a, b) =>
            a.year !== b.year ? a.year - b.year : a.month - b.month
        );

        const memberships: CircleMembership[] = [];
        let current: CircleMembership | null = null;

        for (const entry of sorted) {
            if (current && current.circle_id === entry.circle_id) {
                current.to = { year: entry.year, month: entry.month };
                current.months++;
            } else {
                if (current) memberships.push(current);
                current = {
                    circle_id: entry.circle_id,
                    circle_name: entry.circle_name,
                    from: { year: entry.year, month: entry.month },
                    to: { year: entry.year, month: entry.month },
                    months: 1,
                    current: false,
                };
            }
        }
        if (current) memberships.push(current);

        // Mark the last one as current if it matches the current circle
        if (memberships.length > 0 && this.profile?.circle) {
            const last = memberships[memberships.length - 1];
            if (last.circle_id === this.profile.circle.circle_id) {
                last.current = true;
            }
        }

        // Return newest first
        return memberships.reverse();
    }

    getCharacterImage(charId: number): string | null {
        const char = getCharacterById(charId);
        return char ? `assets/images/character_stand/${char.image}` : null;
    }

    getCharacterName(charId: number): string {
        const char = getCharacterById(charId);
        return char?.name || `Character ${charId}`;
    }

    getSupportCardImage(): string | null {
        if (!this.profile?.support_card) return null;
        const card = getSupportCardById(this.profile.support_card.support_card_id.toString());
        return card?.imageUrl || null;
    }

    getSupportCardName(): string {
        if (!this.profile?.support_card) return 'Unknown';
        const card = getSupportCardById(this.profile.support_card.support_card_id.toString());
        return card?.name || `Card #${this.profile.support_card.support_card_id}`;
    }

    resolveSparks(sparkIds: number[]): SparkInfo[] {
        return this.factorService.resolveSparks(sparkIds);
    }

    formatNumber(n: number): string {
        if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n.toLocaleString();
    }

    formatRank(n: number): string {
        if (n >= 1_000_000) return Math.round(n / 1_000_000) + 'M';
        if (n >= 1_000) return Math.round(n / 1_000) + 'K';
        return n.toLocaleString();
    }

    getMonthName(month: number): string {
        return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' });
    }

    getGainColor(gain: number): string {
        if (gain > 0) return '#81c784';
        if (gain < 0) return '#e57373';
        return 'rgba(255,255,255,0.5)';
    }

    getLimitBreakArray(count: number): { filled: boolean }[] {
        return Array.from({ length: 4 }, (_, i) => ({ filled: i < count }));
    }

    getRarityIcon(rarity: number): string {
        const idx = rarity < 11 ? '0' + (rarity - 1) : String(rarity - 1);
        return `/assets/images/icon/ranks/utx_txt_rank_${idx}.png`;
    }

    private buildInheritanceRecord(profile: UserProfileResponse): InheritanceRecord | null {
        if (!profile.inheritance) return null;
        const inh = profile.inheritance;
        return {
            id: inh.inheritance_id,
            account_id: inh.account_id,
            main_parent_id: inh.main_parent_id,
            parent_left_id: inh.parent_left_id,
            parent_right_id: inh.parent_right_id,
            parent_rank: inh.parent_rank,
            parent_rarity: inh.parent_rarity,
            blue_sparks: inh.blue_sparks,
            pink_sparks: inh.pink_sparks,
            green_sparks: inh.green_sparks,
            white_sparks: inh.white_sparks,
            win_count: inh.win_count,
            white_count: inh.white_count,
            affinity_score: inh.affinity_score ?? undefined,
            main_blue_factors: inh.main_blue_factors,
            main_pink_factors: inh.main_pink_factors,
            main_green_factors: inh.main_green_factors,
            main_white_factors: inh.main_white_factors,
            main_white_count: inh.main_white_count,
            support_card_id: profile.support_card?.support_card_id,
            limit_break_count: profile.support_card?.limit_break_count,
            race_results: inh.race_results,
            main_win_saddles: inh.main_win_saddles,
            left_win_saddles: inh.left_win_saddles,
            right_win_saddles: inh.right_win_saddles,
            upvotes: 0,
            downvotes: 0,
        };
    }

    getTeamClassName(teamClass: number | null): string {
        if (teamClass == null) return '—';
        const names: Record<number, string> = { 1: 'Class 1', 2: 'Class 2', 3: 'Class 3', 4: 'Class 4', 5: 'Class 5', 6: 'Class 6', 7: 'Open' };
        return names[teamClass] || `Class ${teamClass}`;
    }

    getDistanceName(type: number | null): string { return getDistanceName(type); }

    getStadiumByDistance(): { distance: string; members: any[] }[] {
        if (!this.profile?.team_stadium) return [];
        const order = [1, 2, 3, 4, 5];
        const grouped = new Map<number, any[]>();
        for (const m of this.profile.team_stadium) {
            const d = m.distance_type ?? 0;
            if (!grouped.has(d)) grouped.set(d, []);
            grouped.get(d)!.push(m);
        }
        const result: { distance: string; members: any[] }[] = [];
        for (const d of order) {
            if (grouped.has(d)) {
                result.push({ distance: getDistanceName(d), members: grouped.get(d)! });
                grouped.delete(d);
            }
        }
        for (const [d, members] of grouped) {
            result.push({ distance: getDistanceName(d), members });
        }
        return result;
    }

    getRunningStyleName(style: number | null): string { return getRunningStyleName(style); }
    getScenarioName(id: number | null): string { return getScenarioName(id); }
    getTotalStats(m: any): number { return getTotalStats(m); }
    getCardImage(cardId: number | null): string | null { return getCardImage(cardId); }
    getSkillName(skillId: number): string { return getSkillName(skillId); }
    getSkillLevel(skillId: number): number { return getSkillLevel(skillId); }
    getSkillIcon(skillId: number): string | null { return getSkillIcon(skillId); }
    getSkillRarityClass(skillId: number): string { return getSkillRarityClass(skillId); }
    getAptGrade(val: number | null): string { return getAptGrade(val); }
    getRankGrade(score: number | null): string { return getRankGrade(score); }
    getRankGradeColor(score: number | null): string { return getRankGradeColor(score); }
    getStarDisplay(rarity: number | null): { filled: boolean; talent: boolean }[] { return getStarDisplay(rarity); }

}

