import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NavigationComponent } from './components/navigation/navigation.component';
import { SnowComponent } from './components/snow/snow.component';
import { ChristmasUpdatePopupComponent } from './components/christmas-update-popup/christmas-update-popup.component';
import { StatsService } from './services/stats.service';
import { ThemeService } from './services/theme.service';
import { filter, throttleTime } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavigationComponent, SnowComponent, MatDialogModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'uma-gacha-hub';
  isChristmas$ = this.themeService.isChristmas$;
  private readonly UPDATE_POPUP_KEY = 'christmas_update_2025_seen';

  constructor(
    private statsService: StatsService, 
    private router: Router,
    private themeService: ThemeService,
    private dialog: MatDialog,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Ensure tracking on route changes (in case user keeps tab open across days)
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      throttleTime(60000) // Only check once per minute max
    ).subscribe(() => {
      this.statsService.ensureDailyTracking();
    });

    // Check for update popup
    if (isPlatformBrowser(this.platformId)) {
      const seen = localStorage.getItem(this.UPDATE_POPUP_KEY);
      if (!seen) {
        // Small delay to ensure app is loaded
        setTimeout(() => {
          this.dialog.open(ChristmasUpdatePopupComponent, {
            width: '90%',
            maxWidth: '520px',
            panelClass: 'christmas-popup-dialog',
            autoFocus: false,
            disableClose: false
          });
        }, 1000);
      }
    }
  }
}
