import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { Meta, Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { StatsService, StatsResponse } from '../../services/stats.service';
import { LocaleNumberPipe } from '../../pipes/locale-number.pipe';
@Component({
  selector: 'app-tools',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatCardModule,
    LocaleNumberPipe
  ],
  templateUrl: './tools.component.html',
  styleUrl: './tools.component.scss'
})
export class ToolsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  stats: StatsResponse | null = null;
  loading = true;
  tasksToday = 0;
  accountsUpdatedToday = 0;
  accounts7d = 0;
  umasTracked = 0;
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
    this.tasksToday = stats.today.tasks_24h;
    this.accountsUpdatedToday = stats.freshness.accounts_24h;
    this.accounts7d = stats.freshness.accounts_7d;
    this.umasTracked = stats.freshness.umas_tracked;
  }
}
