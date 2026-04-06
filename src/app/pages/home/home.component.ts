import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { StatsService, StatsResponse } from '../../services/stats.service';
import { DomainMigrationService } from '../../services/domain-migration.service';
import { CookieConsentService } from '../../services/cookie-consent.service';
import { DomainMigrationPopupComponent } from '../../components/domain-migration-popup/domain-migration-popup.component';
import { Meta, Title } from '@angular/platform-browser';
import { ThemeService } from '../../services/theme.service';
import { LocaleNumberPipe } from '../../pipes/locale-number.pipe';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    LocaleNumberPipe
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  stats: StatsResponse | null = null;
  loading = true;
  isChristmas$ = this.themeService.isChristmas$;
  tasksToday = 0;
  accountsUpdatedToday = 0;
  accounts7d = 0;
  umasTracked = 0;
  constructor(
    private statsService: StatsService, 
    private meta: Meta, 
    private title: Title,
    private dialog: MatDialog,
    private domainMigrationService: DomainMigrationService,
    private themeService: ThemeService,
    private cookieConsentService: CookieConsentService
  ) {
    this.title.setTitle('honse.moe Umamusume Database & Tools');
    this.meta.addTags([
      { name: 'description', content: 'Umamusume Database, Timeline, Tierlist, and tools for the global version' },
      { property: 'og:title', content: 'honse.moe Umamusume Database & Tools' },
      { property: 'og:description', content: 'Umamusume Database, Timeline, Tierlist, and tools for the global version.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://honsemoe.com/' },
      { property: 'og:image', content: 'https://honsemoe.com/assets/logo.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'honse.moe Umamusume Database & Tools' },
      { name: 'twitter:description', content: 'Meta-based Umamusume Database, Timeline, Tierlist, and tools for the global version.' },
      { name: 'twitter:image', content: 'https://honsemoe.com/assets/logo.png' }
    ]);
  }
  ngOnInit() {
    this.statsService.ensureDailyTracking();
    this.loadStats();
    this.checkForDomainMigrationPopup();
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
  onLogoError(event: Event) {
    const target = event.target as HTMLImageElement;
    target.src = 'assets/logo.png';
  }
  openCookieSettings(): void {
    this.cookieConsentService.reopenBanner();
  }
  private checkForDomainMigrationPopup() {
    // Small delay to ensure the component is fully rendered
    setTimeout(() => {
      if (this.domainMigrationService.shouldShowPopup()) {
        const dialogRef = this.dialog.open(DomainMigrationPopupComponent, {
          width: '90vw',
          maxWidth: '520px',
          disableClose: false,
          autoFocus: true,
          panelClass: 'domain-migration-dialog'
        });
        dialogRef.afterClosed().subscribe(() => {
          this.domainMigrationService.markPopupAsShown();
        });
      }
    }, 500);
  }
}
