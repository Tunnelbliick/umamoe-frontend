import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables, ScatterDataPoint, Plugin } from 'chart.js';
import { TIER_PERCENTILES } from '../../models/tierlist-calculation.model';
import { PrecomputedCardData } from '../../models/precomputed-tierlist.model';

Chart.register(...registerables);

// Custom plugin for rendering card images
const cardImagePlugin: Plugin = {
  id: 'cardImages',
  afterDatasetsDraw: (chart: any) => {
    const { ctx } = chart;
    const imageCache = (chart as any).imageCache || {};
    (chart as any).imageCache = imageCache;

    chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta.hidden) {
        meta.data.forEach((element: any, index: number) => {
          const dataPoint = dataset.data[index] as ScatterPoint;
          if (dataPoint && dataPoint.imageUrl) {
            const { x, y } = element.getProps(['x', 'y'], true);
            const size = (chart as any).dynamicImageSize || 60; // Use dynamic size

            // Load and cache images
            if (!imageCache[dataPoint.imageUrl]) {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = dataPoint.imageUrl;
              imageCache[dataPoint.imageUrl] = { img, loaded: false };
              
              img.onload = () => {
                imageCache[dataPoint.imageUrl].loaded = true;
                chart.render();
              };
              
              img.onerror = () => {
                console.warn(`Failed to load image: ${dataPoint.imageUrl}`);
                imageCache[dataPoint.imageUrl].loaded = false;
              };
            }

            const cachedImage = imageCache[dataPoint.imageUrl];
            if (cachedImage && cachedImage.loaded && cachedImage.img.complete) {
              ctx.save();
              
              // Draw rounded border
              const radius = 6;
              ctx.beginPath();
              ctx.roundRect(x - size/2, y - size/2, size, size, radius);
              ctx.strokeStyle = dataset.borderColor;
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.clip();
              
              // Draw image
              ctx.drawImage(cachedImage.img, x - size/2, y - size/2, size, size);
              
              ctx.restore();
              
              // Draw tier label above image
              ctx.save();
              
              ctx.restore();
            } else {
              // Fallback: draw colored circle with tier text
              ctx.save();
              ctx.beginPath();
              ctx.arc(x, y, size/2, 0, 2 * Math.PI);
              ctx.fillStyle = dataset.backgroundColor;
              ctx.fill();
              ctx.strokeStyle = dataset.borderColor;
              ctx.lineWidth = 2;
              ctx.stroke();
              
              // Draw tier text
              ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
              ctx.fillStyle = 'white';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(dataPoint.tier, x, y);
              
              ctx.restore();
            }
          }
        });
      }
    });
  }
};

interface ScatterPoint extends ScatterDataPoint {
  cardId: string;
  cardName: string;
  imageUrl: string;
  tier: string;
  card: PrecomputedCardData;
}

@Component({
  selector: 'app-tierlist-scatter-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <div class="chart-wrapper">
        <canvas #chartCanvas></canvas>
      </div>
    </div>
  `,
  styleUrls: ['./tierlist-scatter-chart.component.scss']
})
export class TierlistScatterChartComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() cards: PrecomputedCardData[] = [];
  @Input() selectedType: number = -1;
  @Input() selectedLB: number = 4; // Selected LB level
  @Output() cardHover = new EventEmitter<{ card: PrecomputedCardData, event: MouseEvent }>();
  @Output() cardLeave = new EventEmitter<void>();
  @Output() cardClick = new EventEmitter<{ card: PrecomputedCardData, event: MouseEvent }>();

  private chart: Chart | null = null;
  private resizeObserver: ResizeObserver | null = null;
  showImages = true;
  private dynamicImageSize = 60; // Default size

  tierColors: { [key: string]: string } = {
    'S+': '#ff1744',
    'S': '#ff6b35',
    'A': '#f7931e',
    'B': '#ffcd3c',
    'C': '#7cb342',
    'D': '#26a69a'
  };

  ngOnInit(): void {
    // Wait for DOM to be ready for better mobile initialization
    setTimeout(() => {
      this.calculateDynamicImageSize();
      this.initializeChart();
      this.setupResizeListener();
    }, 50);
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
    // Remove all listeners
    window.removeEventListener('resize', this.onResize.bind(this));
    window.removeEventListener('orientationchange', this.onResize.bind(this));
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['cards'] || changes['selectedLB']) && this.chart) {
      this.updateChart();
    }
  }

  private initializeChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const isMobile = window.innerWidth <= 768;
    const containerWidth = this.chartCanvas.nativeElement.parentElement?.clientWidth || 800;
    
    // Calculate initial point radius based on image size
    const pointRadius = this.dynamicImageSize * 0.6;
    
    // Dynamic padding based on container size
    const mobilePadding = {
      top: 5,
      right: Math.max(10, containerWidth * 0.03),
      bottom: 5,
      left: Math.max(10, containerWidth * 0.03)
    };
    
    const desktopPadding = {
      top: 0,
      right: 40,
      bottom: 0,
      left: 40
    };

    const config: ChartConfiguration = {
      type: 'scatter' as ChartType,
      data: {
        datasets: this.createDatasets()
      },
      plugins: [cardImagePlugin],
      options: {
        responsive: false,
        maintainAspectRatio: false,
        devicePixelRatio: window.devicePixelRatio || 1, // Use device pixel ratio for crisp rendering
        layout: {
          padding: isMobile ? mobilePadding : desktopPadding
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: !isMobile, // Hide title on mobile to save space
              text: 'Power Score',
              color: 'rgba(255, 255, 255, 0.8)',
              font: {
                size: isMobile ? 11 : 14,
                weight: 600
              }
            },
            grid: {
              display: true,
              color: 'rgba(255, 255, 255, 0.1)',
              lineWidth: isMobile ? 0.5 : 1
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: isMobile ? 9 : 12
              },
              maxTicksLimit: isMobile ? Math.max(4, Math.floor(containerWidth / 80)) : 10, // Dynamic tick count
              padding: isMobile ? 2 : 5
            }
          },
          y: {
            display: false, // Hide Y-axis completely
            min: 0,
            max: isMobile ? 6 : 10 // Less vertical space on mobile for better readability
          }
        },
        elements: {
          point: {
            radius: pointRadius, // Use dynamic radius
            hoverRadius: pointRadius + (isMobile ? 10 : 5), // Larger hover area on mobile
            backgroundColor: 'transparent', // Hide the default point
            borderColor: 'transparent'
          }
        },
        onHover: (event, elements) => {
          if (!isMobile) { // Only emit hover events on desktop
            if (elements.length > 0) {
              const element = elements[0];
              const dataPoint = this.chart?.data.datasets[element.datasetIndex].data[element.index] as ScatterPoint;
              if (dataPoint && event.native) {
                this.cardHover.emit({ card: dataPoint.card, event: event.native as MouseEvent });
              }
            } else {
              this.cardLeave.emit();
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const element = elements[0];
            const dataPoint = this.chart?.data.datasets[element.datasetIndex].data[element.index] as ScatterPoint;
            if (dataPoint && event.native) {
              this.cardClick.emit({ card: dataPoint.card, event: event.native as MouseEvent });
            }
          }
        },
        animation: {
          duration: isMobile ? 300 : 600, // Even faster animations on mobile
          easing: 'easeInOutQuart'
        }
      }
    };

    this.chart = new Chart(ctx, config);
    
    // Store the dynamic size in the chart instance for the plugin to access
    (this.chart as any).dynamicImageSize = this.dynamicImageSize;
  }

  private createDatasets(): any[] {
    if (!this.cards.length) return [];

    const isMobile = window.innerWidth <= 768;
    const containerWidth = this.chartCanvas.nativeElement.parentElement?.clientWidth || 800;
    
    // Group cards by exact score position for precise overlap detection
    const cardPositions = new Map<number, PrecomputedCardData[]>();
    const overlapThreshold = isMobile ? Math.max(60, containerWidth * 0.08) : 150; // Dynamic threshold based on width

    // Process all cards and group them by position
    this.cards.forEach(card => {
      const score = card.scores[this.selectedLB]; // Use selected LB score
      
      // Find if there's already a position within overlap threshold
      let foundPosition = false;
      for (const [existingScore, existingCards] of cardPositions.entries()) {
        if (Math.abs(score - existingScore) <= overlapThreshold) {
          existingCards.push(card);
          foundPosition = true;
          break;
        }
      }
      
      // If no overlapping position found, create new position
      if (!foundPosition) {
        cardPositions.set(score, [card]);
      }
    });

    // Create datasets for each tier
    const tierDatasets: { [tier: string]: ScatterPoint[] } = {};
    
    cardPositions.forEach((positionCards, baseScore) => {
      // Sort cards by tier priority (S+ highest), then by score
      positionCards.sort((a, b) => {
        const tierOrder = { 'S+': 6, 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
        const aTierValue = tierOrder[a.tiers[this.selectedLB] as keyof typeof tierOrder] || 0;
        const bTierValue = tierOrder[b.tiers[this.selectedLB] as keyof typeof tierOrder] || 0;
        
        // First sort by tier (highest tier first)
        if (bTierValue !== aTierValue) {
          return bTierValue - aTierValue;
        }
        // Then by score within the same tier (highest score first)
        return b.scores[this.selectedLB] - a.scores[this.selectedLB];
      });
      
      // Stack cards vertically from bottom up with mobile-optimized spacing
      positionCards.forEach((card, index) => {
        const tier = card.tiers[this.selectedLB]; // Use selected LB tier
        
        if (!tierDatasets[tier]) {
          tierDatasets[tier] = [];
        }
        
        // Calculate Y position with dynamic spacing based on image size and screen
        const stackHeight = isMobile ? 
          1.8 : // Very tight on mobile, scales with image size
          1.15; // Comfortable on desktop
        const baseY = 1; // Base level at bottom
        const stackY = baseY + (index * stackHeight);
        
        tierDatasets[tier].push({
          x: card.scores[this.selectedLB], // Use selected LB score for precise positioning
          y: stackY, // Use actual Y coordinates for animation
          cardId: card.id.toString(),
          cardName: card.name,
          imageUrl: this.getCardImageUrl(card),
          tier,
          card
        });
      });
    });

    // Convert to Chart.js datasets
    const datasets: any[] = [];
    const pointRadius = this.dynamicImageSize * 0.6;
    
    Object.entries(tierDatasets).forEach(([tier, points]) => {
      datasets.push({
        label: `Tier ${tier}`,
        data: points,
        backgroundColor: this.tierColors[tier] || '#888888',
        borderColor: this.tierColors[tier] || '#888888',
        borderWidth: isMobile ? 1 : 2, // Thinner borders on mobile
        pointStyle: 'circle',
        pointRadius: pointRadius, // Use dynamic radius
        pointHoverRadius: pointRadius + (isMobile ? 10 : 5), // Larger touch targets on mobile
        pointBackgroundColor: 'transparent', // Hide default points
        pointBorderColor: 'transparent'
      });
    });

    return datasets;
  }

  private getTierYPosition(tier: string): number {
    // No longer needed since we're using horizontal layout
    return 0;
  }

  private groupByTier(cards: PrecomputedCardData[]): { [tier: string]: PrecomputedCardData[] } {
    // No longer needed since we're using horizontal layout
    return {};
  }

  private getTierForPercentile(percentile: number): string {
    for (const [tier, range] of Object.entries(TIER_PERCENTILES)) {
      if (percentile >= range.min && percentile <= range.max) {
        return tier;
      }
    }
    return 'D';
  }

  private getCardImageUrl(card: PrecomputedCardData): string {
    return `/assets/images/support_card/half/support_card_s_${card.id}.png`;
  }

  private updateChart(): void {
    if (!this.chart) return;

    this.chart.data.datasets = this.createDatasets();
    this.chart.update();
  }

  toggleImages(): void {
    this.showImages = !this.showImages;
    if (this.chart) {
      this.chart.options.elements!.point!.radius = this.showImages ? 25 : 8;
      this.chart.options.elements!.point!.hoverRadius = this.showImages ? 30 : 12;
      this.updateChart();
    }
  }

  private calculateDynamicImageSize(): void {
    const containerWidth = this.chartCanvas.nativeElement.parentElement?.clientWidth || 800;
    const isMobile = window.innerWidth <= 768;
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Calculate size based on container width and device pixel ratio for crisp images
    if (isMobile) {
      // Mobile: Scale based on actual usable width and device density
      const usableWidth = containerWidth - 40; // Account for padding
      const cardCount = Math.min(this.cards.length, 20); // Estimate visible cards
      const baseSize = Math.max(12, Math.min(28, usableWidth / (cardCount * 0.8))); // Dynamic based on card density
      
      // Adjust for device pixel ratio for crisp rendering
      if (containerWidth <= 320) {
        this.dynamicImageSize = Math.max(14, baseSize * 0.8); // Very small phones
      } else if (containerWidth <= 480) {
        this.dynamicImageSize = Math.max(16, baseSize * 0.9); // Small phones
      } else {
        this.dynamicImageSize = Math.max(20, baseSize); // Large phones/tablets
      }
      
      // Ensure even numbers for crisp rendering
      this.dynamicImageSize = Math.round(this.dynamicImageSize / 2) * 2;
    } else {
      // Desktop: Larger images with more spacing
      if (containerWidth <= 1024) {
        this.dynamicImageSize = 40; // Small desktop
      } else if (containerWidth <= 1440) {
        this.dynamicImageSize = 60; // Desktop
      } else {
        this.dynamicImageSize = 70; // Large desktop
      }
    }
  }

  private setupResizeListener(): void {
    // Enhanced resize handling with throttling for better performance
    let resizeTimeout: any;
    
    const throttledResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.onResize();
      }, 100);
    };
    
    // Window resize listener
    window.addEventListener('resize', throttledResize);
    
    // Orientation change listener for mobile
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.onResize();
      }, 300); // Wait for orientation change to complete
    });
    
    // ResizeObserver for container changes
    this.resizeObserver = new ResizeObserver(throttledResize);
    
    const container = this.chartCanvas.nativeElement.parentElement;
    if (container) {
      this.resizeObserver.observe(container);
    }
  }

  private onResize(): void {
    const oldSize = this.dynamicImageSize;
    const oldMobile = window.innerWidth <= 768;
    
    this.calculateDynamicImageSize();
    
    const newMobile = window.innerWidth <= 768;
    const containerWidth = this.chartCanvas.nativeElement.parentElement?.clientWidth || 800;
    
    // Update if size changed OR if mobile/desktop state changed
    if (oldSize !== this.dynamicImageSize || oldMobile !== newMobile) {
      if (this.chart) {
        // Store the dynamic size in the chart instance for the plugin to access
        (this.chart as any).dynamicImageSize = this.dynamicImageSize;
        
        // Update point radius based on new image size
        const pointRadius = this.dynamicImageSize * 0.6;
        
        // Dynamic padding for better mobile scaling
        const mobilePadding = {
          top: 5,
          right: Math.max(10, containerWidth * 0.03),
          bottom: 5,
          left: Math.max(10, containerWidth * 0.03)
        };
        
        // Update chart options for mobile/desktop
        if (this.chart.options.scales?.['x']) {
          const xScale = this.chart.options.scales['x'] as any;
          if (xScale.title) {
            xScale.title.display = !newMobile;
            xScale.title.font = { size: newMobile ? 11 : 14, weight: 600 };
          }
          if (xScale.ticks) {
            xScale.ticks.font = { size: newMobile ? 9 : 12 };
            xScale.ticks.maxTicksLimit = newMobile ? Math.max(4, Math.floor(containerWidth / 80)) : 10;
            xScale.ticks.padding = newMobile ? 2 : 5;
          }
          if (xScale.grid) {
            xScale.grid.lineWidth = newMobile ? 0.5 : 1;
          }
        }
        
        if (this.chart.options.scales?.['y']) {
          const yScale = this.chart.options.scales['y'] as any;
          yScale.max = newMobile ? 6 : 10;
        }
        
        if (this.chart.options.layout?.padding) {
          this.chart.options.layout.padding = newMobile ? mobilePadding : {
            top: 0,
            right: 40,
            bottom: 0,
            left: 40
          };
        }
        
        if (this.chart.options.animation) {
          this.chart.options.animation.duration = newMobile ? 300 : 600;
        }
        
        // Update device pixel ratio for crisp rendering
        if (this.chart.options) {
          (this.chart.options as any).devicePixelRatio = window.devicePixelRatio || 1;
        }
        
        this.chart.data.datasets.forEach((dataset: any) => {
          dataset.pointRadius = pointRadius;
          dataset.pointHoverRadius = pointRadius + (newMobile ? 10 : 5);
          dataset.borderWidth = newMobile ? 1 : 2;
        });
        
        // Recreate datasets with new mobile settings
        this.chart.data.datasets = this.createDatasets();
        
        this.chart.update('none'); // Update without animation for smooth resize
      }
    }
  }

  get Object() {
    return Object;
  }
}
