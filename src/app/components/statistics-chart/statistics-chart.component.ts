import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, OnChanges, SimpleChanges, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { ColorsService } from '../../services/colors.service';

Chart.register(...registerables);

export interface ChartDataPoint {
  label: string;
  value: number;
  percentage?: number;
  color?: string;
  imageUrl?: string;
  id?: string | number;
  type?: string;
  character_color?: string; // Color from game database
  composition?: { [cardType: string]: number }; // For stat symbol compositions
}

export interface ChartConfig {
  type: 'bar' | 'doughnut' | 'line' | 'horizontalBar';
  title?: string;
  showLegend?: boolean;
  stacked?: boolean;
  height?: number;
  colors?: string[];
  centerText?: string | number; // For doughnut charts
  showImages?: boolean; // Whether to show images next to labels
  imageSize?: number; // Size of images in pixels
  verticalImages?: boolean; // Whether to show images vertically (at bottom of bars)
  totalEntries?: number; // Total entries for percentage calculation
  showStatSymbols?: boolean; // Whether to show stat symbols for compositions
}

@Component({
  selector: 'app-statistics-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-wrapper" [style.height.px]="config.height || 300">
      <!-- Stat Symbol List View -->
      <div *ngIf="showStatSymbolList; else imageListCheck" class="stat-symbol-list-view">
        <div class="stat-symbol-item" 
             *ngFor="let item of data; trackBy: trackByLabel; let i = index">
          <!-- Full background container -->
          <div class="bar-background"></div>
          
          <!-- Value bar that fills based on percentage -->
          <div class="percentage-bar-fill"
               [style.width.%]="getDisplayPercentage(item)"
               [style.background-color]="getItemColor(item, i)">
          </div>
          
          <!-- Content overlay -->
          <div class="item-content">
            <div class="stat-symbols-container">
              <ng-container *ngFor="let statType of getStatTypes(item.composition); let statIndex = index">
                <img *ngFor="let symbol of getStatSymbolsForType(item.composition!, statType); let symbolIndex = index"
                     [src]="getStatIconUrl(statType)"
                     [alt]="statType"
                     class="stat-symbol"
                     [style.width.px]="24"
                     [style.height.px]="24">
              </ng-container>
            </div>
            <div class="item-info">
              <div class="item-value">
                {{ formatDisplayValue(item.value) }}
                <span class="item-percentage">({{ getActualPercentage(item).toFixed(1) }}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Image List View with Horizontal Bar Background -->
      <ng-template #imageListCheck>
        <div *ngIf="showImageList; else chartView" class="image-list-view">
          <div class="image-item" 
               *ngFor="let item of data; trackBy: trackByLabel; let i = index"
               class="horizontal-bar-item">
            <!-- Full background container -->
            <div class="bar-background"></div>
            
            <!-- Value bar that fills based on percentage -->
            <div class="percentage-bar-fill"
                 [style.width.%]="getDisplayPercentage(item)"
                 [style.background-color]="getItemColor(item, i)">
            </div>
            
            <!-- Content overlay -->
            <div class="item-content">
              <div class="image-container">
                <img [src]="item.imageUrl" 
                     [alt]="item.label"
                     [style.width.px]="getResponsiveImageSize()"
                     [style.height.px]="getResponsiveImageSize()"
                     (error)="handleImageError($event)"
                     class="item-image">
              </div>
              <div class="item-info">
                <div class="item-label">{{ item.label }}</div>
                <div class="item-value">
                  {{ formatDisplayValue(item.value) }}
                  <span class="item-percentage">({{ getActualPercentage(item).toFixed(1) }}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-template>
      
      <!-- Chart View (includes both regular charts and image-based charts) -->
      <ng-template #chartView>
        <canvas #chartCanvas></canvas>
      </ng-template>
    </div>
  `,
  styleUrls: ['./statistics-chart.component.scss']
})
export class StatisticsChartComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() data: ChartDataPoint[] = [];
  @Input() config: ChartConfig = { type: 'bar' };
  @Input() multiSeries: { [seriesName: string]: ChartDataPoint[] } | any[] = {};

  private chart: Chart | null = null;
  private colorsService = inject(ColorsService);
  private cdr = inject(ChangeDetectorRef);
  private imageCache = new Map<string, HTMLImageElement>();
  private resizeListener?: () => void;
  private lastDataHash: string = '';

  // Cached display state properties - computed only when inputs change
  private _showImageList: boolean = false;
  private _showStatSymbolList: boolean = false;
  private _showVerticalImageBar: boolean = false;
  private _shouldUseChartWithImages: boolean = false;
  private _statTypesCache = new Map<string, string[]>();

  // Safe getter for template binding
  get showImageList(): boolean {
    return this._showImageList;
  }

  // Safe getter for stat symbol list template binding
  get showStatSymbolList(): boolean {
    return this._showStatSymbolList;
  }

  // Safe getter for vertical image bar template binding
  get showVerticalImageBar(): boolean {
    return this._showVerticalImageBar;
  }

  // Safe getter to determine if we should use Chart.js with images
  get shouldUseChartWithImages(): boolean {
    return this._shouldUseChartWithImages;
  }

  private get defaultColors(): string[] {
    return this.colorsService.getChartColors();
  }

  // Hash-based color generation for consistent colors based on composition - now uses ColorsService
  private generateHashColor(composition: { [cardType: string]: number } | string): string {
    // Convert composition object to a stable string
    let hashString: string;
    if (typeof composition === 'string') {
      hashString = composition;
    } else {
      // Sort keys for consistent hashing
      const sortedKeys = Object.keys(composition).sort();
      hashString = sortedKeys.map(key => `${key}:${composition[key]}`).join('|');
    }

    // Use ColorsService hash-based color generation
    return this.colorsService.getHashBasedColor(hashString);
  }

  ngOnInit(): void {
    // Add roundRect polyfill for older browsers
    this.addRoundRectPolyfill();

    // Compute initial display state
    this.computeDisplayState();

    // Preload images first, then initialize chart to prevent loading delay
    this.preloadImagesAndInitialize();
  }

  private computeDisplayState(): void {
    // Compute showImageList
    this._showImageList = !!(
      this.config?.showImages &&
      !this.config?.verticalImages && // Not vertical images
      !this.config?.showStatSymbols && // Not stat symbols
      this.data?.length > 0 &&
      this.data.every(item =>
        item.imageUrl &&
        item.imageUrl.trim() !== '' &&
        item.imageUrl !== 'undefined' &&
        item.imageUrl !== 'null'
      )
    );

    // Compute showStatSymbolList
    this._showStatSymbolList = !!(
      this.config?.showStatSymbols &&
      this.data?.length > 0 &&
      this.data.every(item => item.composition)
    );

    // Compute showVerticalImageBar
    this._showVerticalImageBar = !!(
      this.config?.showImages &&
      this.config?.verticalImages && // Must be vertical images
      this.data?.length > 0 &&
      this.data.every(item =>
        item.imageUrl &&
        item.imageUrl.trim() !== '' &&
        item.imageUrl !== 'undefined' &&
        item.imageUrl !== 'null'
      )
    );

    // Compute shouldUseChartWithImages
    this._shouldUseChartWithImages = !!(this.config?.showImages && this.config?.verticalImages);
  }

  private async preloadImagesAndInitialize(): Promise<void> {
    try {
      // If we need images, preload them first
      if (this.shouldUseChartWithImages && this.data && this.data.length > 0) {
        await this.preloadImages();
      }

      // Small delay to ensure ViewChild is available
      setTimeout(() => {
        this.initializeChart();
        this.setupResizeListener();
      }, 50);
    } catch (error) {
      console.warn('Error preloading images, initializing chart anyway:', error);
      setTimeout(() => {
        this.initializeChart();
        this.setupResizeListener();
      }, 50);
    }
  }

  private setupResizeListener(): void {
    if (typeof window === 'undefined') return;

    this.resizeListener = () => {
      // Debounce resize events
      clearTimeout((this as any).resizeTimeout);
      (this as any).resizeTimeout = setTimeout(() => {
        if (this.chart && this.shouldUseChartWithImages) {
          // Update chart with new responsive settings
          this.chart.update('none'); // Update without animation for better performance
        }
      }, 150);
    };

    window.addEventListener('resize', this.resizeListener);
    window.addEventListener('orientationchange', this.resizeListener);
  }

  /**
   * Get responsive image size based on screen width and number of items
   */
  getResponsiveImageSize(): number {
    const baseSize = this.config.imageSize || 60;
    const screenWidth = window.innerWidth;
    const itemCount = this.data?.length || 1;

    // Calculate available width per item
    const availableWidth = screenWidth * 0.85; // 85% of screen width
    const widthPerItem = availableWidth / itemCount;

    let responsiveSize: number;

    if (screenWidth < 576) {
      // Mobile small: limit size based on available width
      responsiveSize = Math.min(baseSize * 0.6, widthPerItem * 0.8, 40);
    } else if (screenWidth < 768) {
      // Mobile: slightly larger
      responsiveSize = Math.min(baseSize * 0.7, widthPerItem * 0.85, 48);
    } else if (screenWidth < 992) {
      // Tablet
      responsiveSize = Math.min(baseSize * 0.85, widthPerItem * 0.9, 56);
    } else {
      // Desktop - use full size but respect available space
      responsiveSize = Math.min(baseSize, widthPerItem * 0.95);
    }

    // Ensure minimum size for visibility
    return Math.max(responsiveSize, 28);
  }

  /**
   * Get responsive bottom padding for chart based on image size and layout
   */
  private getResponsiveBottomPadding(): number {
    const imageSize = this.getResponsiveImageSize();
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // On mobile with staggered layout at bottom, we need space for two rows
      return (imageSize * 2) + 40; // Two rows of images + margins
    } else {
      // Desktop: single row at bottom
      return imageSize + 20; // One row + margin
    }
  }

  /**
   * Get responsive top padding for chart to accommodate top images on mobile
   */
  private getResponsiveTopPadding(): number {
    // No top padding needed since all images are at the bottom
    return 0;
  }

  private addRoundRectPolyfill(): void {
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function (x: number, y: number, width: number, height: number, radii: number | number[]) {
        const radius = Array.isArray(radii) ? radii[0] : radii;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
      };
    }
  }

  ngAfterViewInit(): void {
    // Also try to initialize after view init
    if (!this.chart) {
      setTimeout(() => this.initializeChart(), 50);
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }

    // Clean up resize listener
    if (this.resizeListener && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener);
      window.removeEventListener('orientationchange', this.resizeListener);
    }

    // Clear any pending resize timeout
    if ((this as any).resizeTimeout) {
      clearTimeout((this as any).resizeTimeout);
    }

    // Clear image cache to prevent memory leaks
    this.imageCache.clear();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Recompute display state when inputs change
    if (changes['data'] || changes['config']) {
      this.computeDisplayState();
      // Clear caches when data changes
      this._statTypesCache.clear();
    }

    // Only update if we have a chart and there are meaningful changes
    if (!this.chart) return;

    let shouldUpdate = false;
    let needsImagePreload = false;

    // Check for data changes
    if (changes['data']) {
      const currentData = changes['data'].currentValue;
      const previousData = changes['data'].previousValue;
      
      // Only update if data actually changed (not just new reference)
      if (this.hasDataChanged(previousData, currentData)) {
        shouldUpdate = true;
        if (this.shouldUseChartWithImages && currentData && currentData.length > 0) {
          needsImagePreload = true;
        }
      }
    }

    // Check for config or multiSeries changes
    if (changes['config'] && !changes['config'].firstChange) {
      shouldUpdate = true;
    }
    
    if (changes['multiSeries'] && !changes['multiSeries'].firstChange) {
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      if (needsImagePreload) {
        this.preloadImages().then(() => {
          this.updateChart();
        }).catch(error => {
          console.warn('Error preloading new images, updating chart anyway:', error);
          this.updateChart();
        });
      } else {
        this.updateChart();
      }
    }
  }

  private hasDataChanged(previousData: any, currentData: any): boolean {
    // If either is null/undefined, they're different if they're not equal
    if (!previousData || !currentData) {
      return previousData !== currentData;
    }

    // If array lengths are different, data changed
    if (Array.isArray(previousData) && Array.isArray(currentData)) {
      if (previousData.length !== currentData.length) return true;
      
      // Compare each item
      for (let i = 0; i < currentData.length; i++) {
        const prev = previousData[i];
        const curr = currentData[i];
        
        if (!prev || !curr) return prev !== curr;
        
        // Compare key properties
        if (prev.label !== curr.label || 
            prev.value !== curr.value || 
            prev.percentage !== curr.percentage ||
            prev.imageUrl !== curr.imageUrl) {
          return true;
        }
      }
      return false;
    }

    // For non-array data, do a simple comparison
    return JSON.stringify(previousData) !== JSON.stringify(currentData);
  }

  private initializeChart(): void {
    if (this.showImageList || this.showStatSymbolList) {
      return;
    }

    if (!this.chartCanvas?.nativeElement) {
      setTimeout(() => this.initializeChart(), 100);
      return;
    }

    // Destroy existing chart before creating a new one
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    const chartConfig = this.getChartConfiguration();

    // Register center text plugin for doughnut charts
    if (this.config.type === 'doughnut' && this.config.centerText !== undefined) {
      const centerTextPlugin = {
        id: 'centerText',
        afterDraw: (chart: any) => {
          const ctx = chart.ctx;
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 50px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const text = String(this.config.centerText);
          ctx.fillText(text, centerX, centerY);
          ctx.restore();
        }
      };

      chartConfig.plugins = chartConfig.plugins || [];
      (chartConfig.plugins as any[]).push(centerTextPlugin);
    }

    // Add icon plugin for doughnut charts (type distribution)
    if (this.config.type === 'doughnut' && this.data.some(item => item.type)) {
      const iconPlugin = {
        id: 'doughnutIcons',
        afterDraw: (chart: any) => {
          const ctx = chart.ctx;
          const meta = chart.getDatasetMeta(0);
          
          if (!meta || !meta.data || meta.data.length === 0) {
            return;
          }
          
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
          
          // Calculate the middle radius between inner and outer radius
          const innerRadius = meta.innerRadius || 0;
          const outerRadius = meta.outerRadius || 0;
          const middleRadius = (innerRadius + outerRadius) / 2;

          // Calculate total value for percentage calculation
          const total = this.data.reduce((sum, item) => sum + item.value, 0);
          if (total === 0) return;

          // Start angle at top of circle (-90 degrees in radians)
          let currentAngle = -Math.PI / 2;

          // Draw icons for each segment
          this.data.forEach((item, index) => {
            if (item.type && item.value > 0) {
              // Calculate the angle for this segment based on its percentage of total
              const segmentAngle = (item.value / total) * 2 * Math.PI;
              const middleAngle = currentAngle + (segmentAngle / 2);
              
              // Calculate icon position in the middle of the segment
              const iconX = centerX + Math.cos(middleAngle) * middleRadius;
              const iconY = centerY + Math.sin(middleAngle) * middleRadius;
              
              // Get type icon URL
              const iconUrl = this.getTypeIconUrl(item.type);
              const img = this.imageCache.get(iconUrl);
              
              if (img && img.complete && img.naturalHeight !== 0) {
                const iconSize = 24;
                ctx.save();
                
                // Add subtle shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                
                // Draw the icon
                ctx.drawImage(img, iconX - iconSize/2, iconY - iconSize/2, iconSize, iconSize);
                ctx.restore();
              } else {
                // Draw a placeholder while loading
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;
                ctx.fillText(item.type.substring(0, 1).toUpperCase(), iconX, iconY);
                ctx.restore();
                
                // Load and cache the icon
                this.loadImage(iconUrl).then(() => {
                  if (this.chart) {
                    this.chart.update('none');
                  }
                }).catch(() => {
                  // Silent fail, placeholder will remain
                });
              }
              
              // Move to the next segment
              currentAngle += segmentAngle;
            }
          });
        }
      };

      chartConfig.plugins = chartConfig.plugins || [];
      (chartConfig.plugins as any[]).push(iconPlugin);
    }

    try {

      // Add custom image plugin for vertical image bars
      if (this.shouldUseChartWithImages) {
        const imagePlugin = {
          id: 'characterImages',
          afterDraw: (chart: any) => {
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const meta = chart.getDatasetMeta(0);
            const imageSize = this.getResponsiveImageSize();
            const isMobile = window.innerWidth < 768;

            this.data.forEach((item, index) => {
              if (item.imageUrl && meta.data[index]) {
                const bar = meta.data[index];
                const x = bar.x;
                const chartBottom = chartArea.bottom;

                const img = this.imageCache.get(item.imageUrl);
                if (img && img.complete && img.naturalHeight !== 0) {
                  // Calculate staggered position at bottom
                  // On mobile: alternate between two rows at the bottom
                  // On desktop: single row at bottom
                  let imgX: number, imgY: number;

                  if (isMobile) {
                    // Stagger images in two rows at the bottom
                    const isLowerRow = index % 2 === 0;
                    imgX = x - imageSize / 2;
                    imgY = isLowerRow
                      ? chartBottom + 10  // First row (closer to chart)
                      : chartBottom + imageSize + 20; // Second row (below first row)

                    // Draw connecting line from bar to image
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath();
                    ctx.moveTo(x, chartBottom);
                    ctx.lineTo(x, imgY + imageSize / 2); // Connect to center of image
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw small dot at bar bottom
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.beginPath();
                    ctx.arc(x, chartBottom, 3, 0, 2 * Math.PI);
                    ctx.fill();

                    // Draw small dot at image connection point
                    ctx.beginPath();
                    ctx.arc(x, imgY + imageSize / 2, 2, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.restore();
                  } else {
                    // Desktop: single row at bottom
                    imgX = x - imageSize / 2;
                    imgY = chartBottom + 10;
                  }

                  // Draw character image with border for better visibility
                  ctx.save();

                  // Add subtle shadow/glow for better visibility
                  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                  ctx.shadowBlur = 4;
                  ctx.shadowOffsetX = 0;
                  ctx.shadowOffsetY = 2;

                  // Draw the image
                  ctx.drawImage(img, imgX, imgY, imageSize, imageSize);

                  ctx.restore();
                }
              }
            });
          }
        };

        chartConfig.plugins = chartConfig.plugins || [];
        (chartConfig.plugins as any[]).push(imagePlugin);
      }

      this.chart = new Chart(ctx, chartConfig);
    } catch (error) {
      console.error('Error creating chart:', error);
      
      // If chart creation failed due to canvas being in use, try to clean up and retry once
      if (error instanceof Error && error.message.includes('Canvas is already in use')) {
        // Try to find and destroy any existing chart instances on this canvas
        Chart.getChart(ctx.canvas)?.destroy();
        
        // Retry chart creation once
        try {
          this.chart = new Chart(ctx, chartConfig);
        } catch (retryError) {
          console.error('Failed to create chart even after cleanup:', retryError);
        }
      }
    }
  }

  private getChartConfiguration(): ChartConfiguration {
    // Auto-detect if this should be a horizontal bar chart
    const shouldUseHorizontalBar = this.shouldUseHorizontalBar();
    const isHorizontalBar = this.config.type === 'horizontalBar' || shouldUseHorizontalBar;
    const isVerticalImageBar = this.shouldUseChartWithImages;
    const chartType = isHorizontalBar ? 'bar' : this.config.type;

    let datasets: any[] = [];
    let labels: string[] = [];

    // Handle vertical image bar case
    if (isVerticalImageBar) {
      labels = this.data.map(item => ''); // Empty labels since we'll draw images

      const intelligentColors = this.data.map((item, index) => {
        if (item.color) {
          return item.color;
        }
        // Check for character_color from the item data
        if (item.character_color) {
          return item.character_color.startsWith('#') ? item.character_color : `#${item.character_color}`;
        }
        return this.colorsService.getIntelligentColorForItem(item, index);
      });

      datasets = [{
        label: 'Usage',
        data: this.data.map(item => item.value),
        backgroundColor: intelligentColors,
        borderColor: intelligentColors,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }];
    }
    // Handle multi-series data (for stacked charts)
    else if (Array.isArray(this.multiSeries) && this.multiSeries.length > 0) {
      // New format: array of series objects with name, data, backgroundColor
      const firstSeries = this.multiSeries[0];
      if (firstSeries && firstSeries.data) {
        labels = firstSeries.data.map((item: any) => item.x || item.label);

        this.multiSeries.forEach((series: any, index: number) => {
          const color = this.colorsService.getIntelligentColorForLabel(series.name, index);

          datasets.push({
            label: series.name,
            data: series.data.map((item: any) => item.y || item.value),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
          });
        });
      }
    } else if (Object.keys(this.multiSeries).length > 0) {
      // Old format: object with series names as keys
      labels = [...new Set(Object.values(this.multiSeries as { [key: string]: ChartDataPoint[] }).flat().map(item => item.label))];

      Object.entries(this.multiSeries as { [key: string]: ChartDataPoint[] }).forEach(([seriesName, seriesData], index) => {
        const data = labels.map(label => {
          const item = seriesData.find((d: ChartDataPoint) => d.label === label);
          return item ? item.value : 0;
        });

        const color = this.colorsService.getIntelligentColorForLabel(seriesName, index);

        datasets.push({
          label: seriesName,
          data,
          backgroundColor: color,
          borderColor: color,
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        });
      });
    } else {
      // Handle single series data
      labels = this.data.map(item => item.label);

      // For single series, try to detect if labels are stats or classes
      const intelligentColors = labels.map((label, index) => {
        if (this.data[index].color) {
          return this.data[index].color!;
        }

        // Use hash-based colors for compositions
        if (this.data[index].composition) {
          return this.generateHashColor(this.data[index].composition!);
        }

        return this.colorsService.getIntelligentColorForLabel(label, index);
      });

      datasets = [{
        label: 'Value',
        data: this.data.map(item => item.value),
        backgroundColor: intelligentColors,
        borderColor: intelligentColors,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }];
    }

    const baseOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: this.config.showLegend !== false && !isVerticalImageBar && (
            (Array.isArray(this.multiSeries) && this.multiSeries.length > 1) ||
            (!Array.isArray(this.multiSeries) && Object.keys(this.multiSeries).length > 1)
          ),
          position: 'top',
          labels: {
            color: 'rgba(255, 255, 255, 0.8)',
            font: {
              size: 12
            },
            padding: 20,
            usePointStyle: true,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: (context: any) => {
              if (this.config.type === 'doughnut') {
                // Fix for doughnut chart tooltips
                const dataIndex = context.dataIndex;
                const item = this.data[dataIndex];
                const value = context.raw || item.value || 0;
                const percentage = item.percentage || ((value / this.data.reduce((sum, d) => sum + d.value, 0)) * 100);
                return `${item.label}: ${this.formatValue(value)} (${percentage.toFixed(1)}%)`;
              } else if (isVerticalImageBar) {
                const dataIndex = context.dataIndex;
                const item = this.data[dataIndex];
                const value = context.parsed.y || context.parsed.x || 0;
                return `${item.label}: ${this.formatValueWithPercentage(value, this.config.totalEntries)}`;
              }
              const label = context.dataset.label || '';
              const value = context.parsed.y || context.parsed.x || 0;
              return `${label}: ${this.formatValueWithPercentage(value, this.config.totalEntries)}`;
            }
          }
        }
      }
    };

    if (this.config.type === 'doughnut') {
      baseOptions.cutout = '60%';
      baseOptions.plugins.legend.position = 'right';
    } else {
      // Bar chart options
      const scaleOptions = {
        ticks: {
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          lineWidth: 1
        }
      };

      if (isVerticalImageBar) {
        // Special configuration for vertical image bars
        baseOptions.scales = {
          x: {
            ...scaleOptions,
            display: false, // Hide x-axis since we'll draw images manually
          },
          y: {
            ...scaleOptions,
            beginAtZero: true,
            ticks: {
              ...scaleOptions.ticks,
              callback: (value: any) => this.formatValue(value)
            }
          }
        };
        baseOptions.layout = {
          padding: {
            top: this.getResponsiveTopPadding(), // Space for top images on mobile
            bottom: this.getResponsiveBottomPadding() // Dynamic padding based on screen size
          }
        };
      } else if (isHorizontalBar) {
        baseOptions.indexAxis = 'y';
        baseOptions.scales = {
          x: { ...scaleOptions, beginAtZero: true },
          y: scaleOptions
        };
      } else {
        baseOptions.scales = {
          x: scaleOptions,
          y: { ...scaleOptions, beginAtZero: true }
        };
      }

      if (this.config.stacked) {
        baseOptions.scales.x.stacked = true;
        baseOptions.scales.y.stacked = true;
      }
    }

    return {
      type: chartType as ChartType,
      data: { labels, datasets },
      options: baseOptions
    };
  }

  private updateChart(): void {
    if (!this.chart) return;

    const config = this.getChartConfiguration();
    
    // Only update if configuration actually changed
    const newDataHash = JSON.stringify(config.data);
    if (this.lastDataHash === newDataHash) {
      return;
    }
    
    this.lastDataHash = newDataHash;
    this.chart.data = config.data!;
    this.chart.options = config.options!;
    this.chart.update('none');

    // If using images, trigger a redraw after a short delay to ensure images are loaded
    if (this.shouldUseChartWithImages && this.data && this.data.some(item => item.imageUrl)) {
      setTimeout(() => {
        if (this.chart) {
          this.chart.update('none');
        }
      }, 100);
    }
  }

  private getColor(index: number): string {
    const colors = this.config.colors || this.colorsService.getChartColors();
    return colors[index % colors.length];
  }

  private getIntelligentColor(label: string, index: number): string {
    return this.colorsService.getIntelligentColorForLabel(label, index);
  }

  private formatValue(value: number): string {
    if (value >= 1000000) {
      // For millions, show one decimal place if it makes sense
      const millions = value / 1000000;
      if (millions >= 10) {
        return `${Math.round(millions)}M`;
      } else {
        return `${millions.toFixed(1)}M`;
      }
    } else if (value >= 1000) {
      // For thousands, show one decimal place if it makes sense
      const thousands = value / 1000;
      if (thousands >= 10) {
        return `${Math.round(thousands)}K`;
      } else {
        return `${thousands.toFixed(1)}K`;
      }
    }
    return value.toString();
  }

  private formatValueWithPercentage(value: number, totalEntries?: number): string {
    const formattedValue = this.formatValue(value);

    if (totalEntries && totalEntries > 0) {
      const percentage = ((value / totalEntries) * 100).toFixed(1);
      return `${formattedValue} (${percentage}%)`;
    }

    return formattedValue;
  }

  private shouldUseHorizontalBar(): boolean {
    // Use horizontal bar for support card data or when we have long labels
    if (!this.data || this.data.length === 0) {
      return false;
    }

    // Check if any data items have support card IDs or types
    const hasSupportCardData = this.data.some(item =>
      item.id !== undefined ||
      item.type !== undefined ||
      (item.label && item.label.length > 15) // Long labels work better with horizontal bars
    );

    return hasSupportCardData && this.config.type === 'bar';
  }

  // Template helper methods
  getDisplayPercentage(item: ChartDataPoint): number {
    // Calculate relative percentage based on max value for bar width display
    if (!this.data || this.data.length === 0) {
      return 0;
    }

    const maxValue = Math.max(...this.data.map(dataItem => dataItem.value));
    if (maxValue === 0) {
      return 0;
    }

    // Scale the bars to use more of the available width while maintaining proportions
    // The highest value gets 95% width, others scale proportionally
    const relativePercentage = (item.value / maxValue) * 95;

    // Ensure minimum visibility for very small values
    if (relativePercentage > 0 && relativePercentage < 3) {
      return 3; // Minimum 3% width for visibility
    }

    return relativePercentage;
  }

  getActualPercentage(item: ChartDataPoint): number {
    // Always use pre-calculated percentage if available
    if (item.percentage !== undefined && item.percentage !== null) {
      return item.percentage;
    }

    // Fallback: calculate relative to dataset total
    const total = this.data.reduce((sum, d) => sum + d.value, 0);
    return total > 0 ? (item.value / total) * 100 : 0;
  }

  getItemColor(item: ChartDataPoint, index: number): string {
    if (item.color) {
      return item.color;
    }

    // Use hash-based colors for compositions (deck combinations)
    if (item.composition) {
      return this.generateHashColor(item.composition);
    }

    // Check for character_color from the item data
    if (item.character_color) {
      return item.character_color.startsWith('#') ? item.character_color : `#${item.character_color}`;
    }

    return this.colorsService.getIntelligentColorForItem(item, index);
  }

  trackByLabel(index: number, item: ChartDataPoint): string {
    return item.label;
  }

  handleImageError(event: any): void {
    // Hide broken images or show fallback
    event.target.style.display = 'none';
  }

  formatDisplayValue(value: number): string {
    return this.formatValue(value);
  }

  // Stat symbol helper methods (with caching for performance)
  getStatTypes(composition?: { [cardType: string]: number }): string[] {
    if (!composition) return [];

    // Create cache key from composition
    const cacheKey = JSON.stringify(composition);
    if (this._statTypesCache.has(cacheKey)) {
      return this._statTypesCache.get(cacheKey)!;
    }

    // Define the desired stat order: Speed, Stamina, Power, Guts, Intelligence, Friend, Group
    const statOrder = ['Speed', 'Stamina', 'Power', 'Guts', 'Intelligence', 'Friend', 'Group'];

    // Create a normalized map of what stats are available in the composition
    const availableStats = Object.keys(composition);

    // Create a map to normalize stat names to their canonical form
    const normalizedMap = new Map<string, string>();
    availableStats.forEach(stat => {
      const lower = stat.toLowerCase();
      if (lower === 'speed') normalizedMap.set(stat, 'Speed');
      else if (lower === 'stamina') normalizedMap.set(stat, 'Stamina');
      else if (lower === 'power') normalizedMap.set(stat, 'Power');
      else if (lower === 'guts') normalizedMap.set(stat, 'Guts');
      else if (lower === 'intelligence' || lower === 'wiz' || lower === 'wisdom' || lower === 'wit') {
        normalizedMap.set(stat, 'Intelligence');
      }
      else if (lower === 'friend') normalizedMap.set(stat, 'Friend');
      else if (lower === 'group') normalizedMap.set(stat, 'Group');
    });

    // Build result array in the correct order
    const result: string[] = [];

    // Go through the desired order and add stats that exist in composition
    statOrder.forEach(canonicalStat => {
      // Find the original key in composition that maps to this canonical stat
      const originalKey = availableStats.find(key => normalizedMap.get(key) === canonicalStat);
      if (originalKey && composition[originalKey] > 0) {
        result.push(originalKey);
      }
    });

    // Cache the result
    this._statTypesCache.set(cacheKey, result);
    return result;
  }

  getStatSymbolsForType(composition: { [cardType: string]: number }, statType: string): number[] {
    const count = composition[statType] || 0;
    return new Array(count).fill(0).map((_, index) => index);
  }

  getStatIconUrl(statType: string): string {
    const typeMap: { [key: string]: string } = {
      'speed': '/assets/images/icon/stats/speed.png',
      'power': '/assets/images/icon/stats/power.png',
      'stamina': '/assets/images/icon/stats/stamina.png',
      'wiz': '/assets/images/icon/stats/wit.png',
      'wisdom': '/assets/images/icon/stats/wit.png',
      'intelligence': '/assets/images/icon/stats/wit.png',
      'wit': '/assets/images/icon/stats/wit.png',
      'guts': '/assets/images/icon/stats/guts.png',
      'friend': '/assets/images/icon/stats/friend.png',
      'group': '/assets/images/icon/stats/group.png'
    };
    return typeMap[statType.toLowerCase()] || typeMap['speed'];
  }

  getTypeIconUrl(cardType: string): string {
    const typeMap: { [key: string]: string } = {
      'speed': '/assets/images/icon/stats/speed.png',
      'power': '/assets/images/icon/stats/power.png', 
      'stamina': '/assets/images/icon/stats/stamina.png',
      'wiz': '/assets/images/icon/stats/wit.png',
      'wisdom': '/assets/images/icon/stats/wit.png',
      'intelligence': '/assets/images/icon/stats/wit.png',
      'wit': '/assets/images/icon/stats/wit.png',
      'guts': '/assets/images/icon/stats/guts.png',
      'friend': '/assets/images/icon/stats/friend.png',
      'group': '/assets/images/icon/stats/group.png'
    };
    return typeMap[cardType.toLowerCase()] || typeMap['speed'];
  }

  // Helper method to load and cache images
  private async loadImage(url: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) {
      const cachedImg = this.imageCache.get(url)!;
      // Check if cached image is still valid
      if (cachedImg.complete && cachedImg.naturalHeight !== 0) {
        return cachedImg;
      } else {
        // Remove invalid cached image
        this.imageCache.delete(url);
      }
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        this.imageCache.set(url, img);
        resolve(img);
      };
      
      img.onerror = () => {
        // Create a placeholder image instead of rejecting
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw a simple placeholder using ColorsService color
          const primaryColor = this.colorsService.getClassColor('overall');
          ctx.fillStyle = primaryColor + '40'; // Add alpha for transparency
          ctx.fillRect(0, 0, 64, 64);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('?', 32, 36);
        }
        
        const placeholderImg = new Image();
        placeholderImg.src = canvas.toDataURL();
        placeholderImg.onload = () => {
          this.imageCache.set(url, placeholderImg);
          resolve(placeholderImg);
        };
      };
      
      img.src = url;
    });
  }

  // Preload all images for the chart
  private async preloadImages(): Promise<HTMLImageElement[]> {
    if (!this.data || this.data.length === 0) return [];

    const imagePromises: Promise<HTMLImageElement>[] = [];
    
    // Preload character images
    this.data
      .filter(item => item.imageUrl && item.imageUrl.trim() !== '' && item.imageUrl !== 'undefined' && item.imageUrl !== 'null')
      .forEach(item => {
        imagePromises.push(
          this.loadImage(item.imageUrl!).catch(error => {
            throw error;
          })
        );
      });

    // Preload type icons for doughnut charts
    if (this.config.type === 'doughnut') {
      const uniqueTypes = [...new Set(this.data.map(item => item.type).filter(type => type))];
      
      uniqueTypes.forEach(type => {
        const iconUrl = this.getTypeIconUrl(type!);
        imagePromises.push(
          this.loadImage(iconUrl).catch(error => {
            throw error;
          })
        );
      });
    }

    try {
      const results = await Promise.allSettled(imagePromises);
      
      const loadedImages = results
        .filter((result): result is PromiseFulfilledResult<HTMLImageElement> => result.status === 'fulfilled')
        .map(result => result.value);
        
      return loadedImages;
    } catch (error) {
      return [];
    }
  }
}
