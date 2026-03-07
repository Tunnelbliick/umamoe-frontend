import { Component, OnInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NavigationComponent } from './components/navigation/navigation.component';
import { SnowComponent } from './components/snow/snow.component';
import { StatsService } from './services/stats.service';
import { ThemeService } from './services/theme.service';
import { UpdateNotificationService } from './services/update-notification.service';
import { RateLimitService } from './services/rate-limit.service';
import { environment } from '../environments/environment';
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
  constructor(
    private statsService: StatsService, 
    private router: Router,
    private themeService: ThemeService,
    private dialog: MatDialog,
    private updateNotificationService: UpdateNotificationService,
    private rateLimitService: RateLimitService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}
  // Debug shortcut: Ctrl+Shift+L to test rate limit popup (dev only)
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!environment.production && event.ctrlKey && event.shiftKey && event.key === 'L') {
      event.preventDefault();
      this.rateLimitService.showRateLimitPopup(60); // Show with 60 second countdown
    }
  }
  ngOnInit(): void {
    // Check for update notification
    if (isPlatformBrowser(this.platformId)) {
      // Small delay to let the app settle before showing popup
      setTimeout(() => {
        this.updateNotificationService.checkAndShowUpdate();
      }, 1000);
    }
    // Ensure tracking on route changes (in case user keeps tab open across days)
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      throttleTime(60000) // Only check once per minute max
    ).subscribe(() => {
      this.statsService.ensureDailyTracking();
    });
  }
}
