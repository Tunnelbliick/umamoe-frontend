import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-wip-placeholder',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterModule
  ],
  template: `
    <div class="wip-placeholder">
      <div class="wip-content">
        <div class="wip-card card">
          <div class="wip-icon">
            <mat-icon>{{icon}}</mat-icon>
          </div>
          
          <h1>{{title}}</h1>
          <p class="wip-description">{{description}}</p>
          
          <div class="wip-status">
            <mat-icon class="status-icon">construction</mat-icon>
            <span class="status-text">Work in Progress</span>
          </div>

          <div class="wip-actions">
            <button mat-raised-button routerLink="/" color="primary">
              <mat-icon>home</mat-icon>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wip-placeholder {
      min-height: 100vh;
      background: var(--bg-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .wip-content {
      max-width: 600px;
      width: 100%;
    }

    .wip-card {
      text-align: center;
      padding: 3rem 2rem;
      position: relative;
      overflow: hidden;
    }

    .wip-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff9800, #2196f3, #4caf50, #e91e63);
      background-size: 400% 400%;
      animation: gradientShift 3s ease-in-out infinite;
    }

    @keyframes gradientShift {
      0%, 100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }

    .wip-icon {
      margin-bottom: 1.5rem;
      
      mat-icon {
        font-size: 4rem;
        width: 4rem;
        height: 4rem;
        color: var(--accent-primary);
      }
    }

    h1 {
      margin: 0 0 1rem 0;
      font-size: 2.5rem;
      font-weight: 600;
      background: var(--gradient-accent);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .wip-description {
      margin: 0 0 2rem 0;
      color: var(--text-secondary);
      font-size: 1.125rem;
      line-height: 1.6;
    }

    .wip-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
      padding: 0.75rem 1.5rem;
      background: rgba(255, 152, 0, 0.1);
      border: 1px solid var(--accent-warning);
      border-radius: 25px;
      color: var(--accent-warning);
      font-weight: 500;
    }

    .status-icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }

    .launch-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
      padding: 0.75rem 1.5rem;
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid var(--accent-success);
      border-radius: 25px;
      color: var(--accent-success);
      font-weight: 500;
    }

    .launch-icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }

    .wip-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 2rem;

      button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }
    }

    @media (max-width: 768px) {
      .wip-placeholder {
        padding: 1rem;
      }

      .wip-card {
        padding: 2rem 1.5rem;
      }

      h1 {
        font-size: 2rem;
      }

      .wip-description {
        font-size: 1rem;
      }

      .wip-actions {
        gap: 0.5rem;
      }
    }
  `]
})
export class WipPlaceholderComponent implements OnInit {
  @Input() title: string = 'Coming Soon';
  @Input() description: string = 'This feature is currently under development and will be available in the future.';
  @Input() icon: string = 'build';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    // Override with route data if available
    const routeData = this.route.snapshot.data;
    if (routeData['title']) this.title = routeData['title'];
    if (routeData['description']) this.description = routeData['description'];
    if (routeData['icon']) this.icon = routeData['icon'];
  }
}
