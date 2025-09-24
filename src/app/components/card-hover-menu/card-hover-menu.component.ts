import { Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { PrecomputedCardData } from '../../models/precomputed-tierlist.model';
import { trigger, transition, style, animate, state } from '@angular/animations';

Chart.register(...registerables);

@Component({
  selector: 'app-card-hover-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div 
      class="hover-menu" 
      *ngIf="card && isVisible"
      [style.left.px]="getAdjustedPosition().x"
      [style.top.px]="getAdjustedPosition().y"
      [@fadeInScale]>
      
      <div class="hover-content">
        <!-- Card Header -->
        <div class="card-header">
          <img 
            [src]="getCardImageUrl(card)" 
            [alt]="card.name"
            class="card-image">
          <div class="card-info">
            <h4 class="card-name">{{ card.name }}</h4>
            <div class="card-stats">
              <span class="current-score">{{ getCurrentScore().toFixed(0) }} pts</span>
              <span class="tier-chip" [style.background-color]="getTierColor(getCurrentTier())">
                {{ getCurrentTier() }}
              </span>
            </div>
          </div>
        </div>

        <!-- LB Progression Chart -->
        <div class="progression-section">
          <h5>Limit Break Progression</h5>
          <div class="chart-container">
            <canvas #progressionChart width="300" height="100"></canvas>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="quick-stats">
          <div class="stat-item">
            <span class="label">Power Spike:</span>
            <span class="value">{{ getPowerSpikeInfo() }}</span>
          </div>
          <div class="stat-item">
            <span class="label">Total Growth:</span>
            <span class="value">+{{ getTotalGrowthPercent() }}%</span>
          </div>
        </div>

        <!-- Tier Progression -->
        <div class="tier-progression" *ngIf="card.tiers.length > 0">
          <h5>Tier Progression by LB</h5>
          <div class="tier-progression-grid">
            <div 
              *ngFor="let tier of card.tiers; let i = index"
              class="tier-item"
              [class.unavailable]="card.scores[i] <= 0">
              <span class="lb-label">LB{{ i }}</span>
              <span 
                class="tier-badge" 
                [style.background-color]="getTierColor(tier)"
                [class.na-tier]="tier === 'N/A' || card.scores[i] <= 0">
                {{ card.scores[i] > 0 ? tier : 'N/A' }}
              </span>
              <span class="score" *ngIf="card.scores[i] > 0">
                {{ card.scores[i] }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./card-hover-menu.component.scss'],
  animations: [
    trigger('fadeInScale', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'scale(0.95) translateY(-10px)'
        }),
        animate('200ms ease-out', style({
          opacity: 1,
          transform: 'scale(1) translateY(0)'
        }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({
          opacity: 0,
          transform: 'scale(0.95) translateY(-10px)'
        }))
      ])
    ])
  ]
})
export class CardHoverMenuComponent implements OnChanges {
  @ViewChild('progressionChart', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() card: PrecomputedCardData | null = null;
  @Input() isVisible: boolean = false;
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };
  @Input() currentLB: number = 4; // Current LB level being viewed
  @Output() close = new EventEmitter<void>();

  private chart: Chart | null = null;
  private cachedAdjustedPosition: { x: number; y: number } | null = null;

  tierColors: { [key: string]: string } = {
    'S+': '#ff1744',
    'S': '#ff6b35',
    'A': '#f7931e',
    'B': '#ffcd3c',
    'C': '#7cb342',
    'D': '#26a69a'
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['position']) {
      this.cachedAdjustedPosition = null; // Reset cache when position changes
    }

    if (changes['card'] && this.card && this.isVisible) {
      setTimeout(() => this.initializeChart(), 0);
    }
    if (changes['isVisible'] && !this.isVisible && this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private initializeChart(): void {
    if (!this.chartCanvas?.nativeElement || !this.card) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    // Register tier chip plugin with improved logic
    const tierChipPlugin = {
      id: 'tierChips',
      afterDatasetsDraw: (chart: any) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);

        // Ensure we have valid data
        if (!meta?.data || !this.card?.tiers || !this.card?.scores) return;

        meta.data.forEach((point: any, index: number) => {
          // Skip if point is not valid or data is unavailable
          if (!point || index >= this.card!.scores.length || index >= this.card!.tiers.length) return;

          const score = this.card!.scores[index];
          const tier = this.card!.tiers[index];

          // Skip unavailable LB levels or invalid tiers
          if (score <= 0 || !tier || tier === 'N/A') return;

          const color = this.getTierColor(tier);

          // Draw tier chip
          const chipX = point.x;
          const chipY = point.y - 30; // Increased distance from point
          const chipWidth = 32;
          const chipHeight = 18;
          const borderRadius = 6;

          ctx.save();

          // Draw chip background with proper border radius
          ctx.fillStyle = color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;

          // Create rounded rectangle path
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(
              chipX - chipWidth / 2,
              chipY - chipHeight / 2,
              chipWidth,
              chipHeight,
              borderRadius
            );
          } else {
            ctx.rect(
              chipX - chipWidth / 2,
              chipY - chipHeight / 2,
              chipWidth,
              chipHeight
            );
          }
          ctx.fill();
          ctx.stroke();

          // Draw chip text with better visibility
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 2;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;

          ctx.fillText(tier, chipX, chipY);

          ctx.restore();

          // Draw score below the point
          ctx.save();
          ctx.fillStyle = color;
          ctx.font = '12px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          // Position the score label below the point
          const scoreLabelY = point.y + 15;
          ctx.fillText(score.toString(), chipX, scoreLabelY);

          ctx.restore();
        });
      }
    };

    const config: ChartConfiguration = {
      type: 'line' as ChartType,
      data: {
        labels: ['LB0', 'LB1', 'LB2', 'LB3', 'LB4'],
        datasets: [
          {
            label: 'Score Progression',
            data: this.card.scores,
            borderColor: '#2196f3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: this.card.scores.map((score, index) => {
              if (score <= 0 || index >= this.card!.tiers.length) return 'var(--text-muted)';
              const tier = this.card!.tiers[index];
              return this.getTierColor(tier);
            }),
            pointBorderColor: this.card.scores.map((score, index) => {
              if (score <= 0 || index >= this.card!.tiers.length) return 'var(--border-secondary)';
              const tier = this.card!.tiers[index];
              return this.getTierColor(tier);
            }),
            pointBorderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 10,
            tension: 0.3,
            fill: false
          }
        ]
      },
      plugins: [tierChipPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 40, // Space for tier chips
            right: 20,
            left: 20,
            bottom: 15 // Increased to accommodate score labels
          },
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false // Disable default tooltips since we have tier chips
          },
        },
        scales: {
          x: {
            display: false,
          },
          y: {
            display: false,
          }
        },
        animation: {
          duration: 800,
          easing: 'easeInOutQuart'
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  getCurrentScore(): number {
    return this.card?.scores[this.currentLB] || 0;
  }

  getCurrentTier(): string {
    return this.card?.tiers[this.currentLB] || 'D';
  }

  getTierColor(tier: string): string {
    return this.tierColors[tier] || '#999';
  }

  getCardImageUrl(card: PrecomputedCardData): string {
    return `/assets/images/support_card/half/support_card_s_${card.id}.png`;
  }

  getBestLB(): number {
    if (!this.card) return 0;
    const maxScore = Math.max(...this.card.scores);
    return this.card.scores.indexOf(maxScore);
  }

  getPowerSpikeInfo(): string {
    if (!this.card?.powerProgression?.powerSpike) {
      // Calculate power spikes from scores
      const powerSpikes: number[] = [];
      for (let i = 1; i < this.card!.scores.length; i++) {
        if (this.card!.scores[i] > 0 && this.card!.scores[i - 1] > 0) {
          const increase = ((this.card!.scores[i] - this.card!.scores[i - 1]) / this.card!.scores[i - 1]) * 100;
          if (increase > 15) {
            powerSpikes.push(i);
          }
        }
      }
      if (powerSpikes.length === 0) return 'Gradual';
      return powerSpikes.map(lb => `LB${lb}`).join(', ');
    }
    return this.card.powerProgression.powerSpike;
  }

  getTotalGrowthPercent(): string {
    if (!this.card) return '0';

    if (this.card.powerProgression?.totalGrowthPercent) {
      return this.card.powerProgression.totalGrowthPercent.toFixed(0);
    }

    // Calculate from scores
    const lb0Score = this.card.scores[0];
    const lb4Score = this.card.scores[4];

    if (lb0Score <= 0) return '0';

    const growth = ((lb4Score - lb0Score) / lb0Score) * 100;
    return growth.toFixed(0);
  }

  getAdjustedPosition(): { x: number; y: number } {
    if (this.cachedAdjustedPosition) {
      return this.cachedAdjustedPosition;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 320; // Match your CSS
    const menuHeight = 400;

    let x = this.position.x;
    let y = this.position.y;

    // Horizontal adjustment
    if (x + menuWidth + 40 > viewportWidth) {
      x = x - menuWidth - 40;
    } else {
      x = x + 20;
    }

    // Vertical adjustment
    if (y - menuHeight / 2 < 0) {
      y = 0;
    } else if (y + menuHeight / 2 > viewportHeight) {
      y = viewportHeight - menuHeight;
    } else {
      y = y - menuHeight / 2;
    }

    this.cachedAdjustedPosition = { x, y };
    return this.cachedAdjustedPosition;
  }

  // Remove or deprecate the old getTransform method
  getTransform(): string {
    return ''; // No longer used
  }
}
