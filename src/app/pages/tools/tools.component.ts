import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { Meta, Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { StatsService, StatsResponse } from '../../services/stats.service';

@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss'
})
export class ToolsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  stats: StatsResponse | null = null;
  loading = true;

  dailyUsers = 0;
  totalAccounts = 0;
  totalCircles = 0;
  totalCharacters = 0;

  constructor(
    private meta: Meta,
    private title: Title,
    private statsService: StatsService
  ) {
    this.title.setTitle('Tools & Calculators - honse.moe');
    this.meta.addTags([
      { name: 'description', content: 'Calculation tools and utilities for Umamusume trainers including statistics, training calculators, and simulation tools' },
      { property: 'og:title', content: 'Tools & Calculators - honse.moe' },
      { property: 'og:description', content: 'Comprehensive toolkit for Umamusume trainers with calculation tools and simulation utilities' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://honsemoe.com/tools' }
    ]);
  }

  ngOnInit(): void {
    this.loadStats();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStats() {
    this.statsService.getStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.updateDisplayValues(stats);
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  private updateDisplayValues(stats: StatsResponse) {
    this.dailyUsers = Math.round(stats.rolling_averages.unique_visitors_7_day);
    this.totalAccounts = stats.totals.total_accounts_tracked;
    this.totalCircles = stats.totals.total_circles_tracked;
    this.totalCharacters = stats.totals.total_characters;
  }
}
