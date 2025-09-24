import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavigationComponent } from './components/navigation/navigation.component';
import { StatsService } from './services/stats.service';
import { filter, throttleTime } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavigationComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'uma-gacha-hub';

  constructor(private statsService: StatsService, private router: Router) {}

  ngOnInit(): void {
    // Ensure tracking on route changes (in case user keeps tab open across days)
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      throttleTime(60000) // Only check once per minute max
    ).subscribe(() => {
      this.statsService.ensureDailyTracking();
    });
  }
}
