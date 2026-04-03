import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="page-body">
      <div class="wip-body">
        <mat-icon>construction</mat-icon>
        <h3>Work in Progress</h3>
        <p>Achievements display is currently under development.</p>
      </div>
    </div>
  `,
  styles: [`
    .page-body { max-width: 1200px; margin: 0 auto; padding: 1.5rem 2rem 2rem; display: flex; flex-direction: column; gap: 1.5rem; box-sizing: border-box; }
    .wip-body { display: flex; flex-direction: column; align-items: center; padding: 5rem 2rem; gap: 1rem; background: rgba(255,152,0,0.03); border: 1px solid rgba(255,152,0,0.12); border-radius: 12px; }
    .wip-body mat-icon { font-size: 3.5rem; width: 3.5rem; height: 3.5rem; color: rgba(255,152,0,0.45); }
    .wip-body h3 { margin: 0; font-size: 1rem; font-weight: 700; color: rgba(255,152,0,0.7); letter-spacing: 0.08em; text-transform: uppercase; }
    .wip-body p { margin: 0; font-size: 0.875rem; color: rgba(255,255,255,0.3); }
  `]
})
export class AchievementsComponent {}
