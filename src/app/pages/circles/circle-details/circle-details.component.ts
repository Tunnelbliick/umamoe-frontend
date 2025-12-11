import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';

import { CircleService } from '../../../services/circle.service';
import { Circle, CircleMember, CircleHistoryPoint, CircleMemberMonthlyData } from '../../../models/circle.model';
import { DiscordLinkPipe } from '../../../pipes/discord-link.pipe';
import { MemberDisplaySettingsDialogComponent } from './member-display-settings-dialog.component';

Chart.register(...registerables);

export type CalculationType = 'monthly_gain' | 'weekly_gain' | 'daily_gain' | 'avg_daily_gain' | 'daily_avg' | 'projected_monthly' | 'total_fans';

export interface ChartLegendItem {
  name: string;
  color: string;
  hidden: boolean;
  datasetIndex: number;
}

export interface CircleDetailsConfig {
  selectedCalculation: CalculationType;
  showTotalFans: boolean;
  showSevenDayAvg: boolean;
  showDailyGain: boolean;
  showDailyAvg: boolean;
  showLastUpdated: boolean;
  showWeeklyGain: boolean;
  showProjectedMonthly: boolean;
  showMonthlyGain: boolean;
  showRole: boolean;
  showTrainerId: boolean;
}

@Component({
  selector: 'app-circle-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    DiscordLinkPipe
  ],
  templateUrl: './circle-details.component.html',
  styleUrl: './circle-details.component.scss'
})
export class CircleDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
  circleId: string | null = null;
  circle: Circle | undefined;
  members: CircleMember[] = [];
  history: CircleHistoryPoint[] = [];
  rawMemberData: CircleMemberMonthlyData[] = [];
  allMemberData: CircleMemberMonthlyData[] = [];
  loading = true;
  
  currentYear: number = new Date().getFullYear();
  currentMonth: number = new Date().getMonth() + 1;

  displayedColumns: string[] = ['name', 'role', 'fans', 'last_updated'];
  
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('memberChartCanvas') memberChartCanvas!: ElementRef<HTMLCanvasElement>;
  chart: Chart | undefined;
  memberChart: Chart | undefined;
  chartLegendItems: ChartLegendItem[] = [];
  private chartTimer: any;
  private previousVisibilityState: boolean[] | null = null;
  private isolatedMemberIndex: number | null = null;

  config: CircleDetailsConfig = {
    selectedCalculation: 'monthly_gain',
    showTotalFans: true,
    showSevenDayAvg: true,
    showDailyGain: true,
    showDailyAvg: false,
    showLastUpdated: true,
    showWeeklyGain: false,
    showProjectedMonthly: false,
    showMonthlyGain: false, // Usually covered by selectedCalculation, but can be shown explicitly
    showRole: false,
    showTrainerId: false
  };

  calculationTypes: { value: CalculationType; label: string }[] = [
    { value: 'monthly_gain', label: 'Monthly Gain' },
    { value: 'weekly_gain', label: 'Weekly Gain' },
    { value: 'daily_gain', label: 'Daily Gain' },
    { value: 'avg_daily_gain', label: 'Avg Daily Gain (7d)' },
    { value: 'daily_avg', label: 'Daily Avg (Month)' },
    { value: 'projected_monthly', label: 'Projected Monthly' },
    { value: 'total_fans', label: 'Total Fans' }
  ];

  constructor(
    private route: ActivatedRoute,
    private circleService: CircleService,
    private ngZone: NgZone,
    private dialog: MatDialog
  ) {
    this.loadConfig();
  }

  ngOnInit(): void {
    this.circleId = this.route.snapshot.paramMap.get('id');
    if (this.circleId) {
      this.loadData(this.circleId);
    }
  }

  loadConfig(): void {
    const saved = localStorage.getItem('circle_details_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with default to handle new fields
        this.config = { ...this.config, ...parsed };
      } catch (e) {
        console.error('Failed to parse circle config', e);
      }
    }
  }

  saveConfig(): void {
    localStorage.setItem('circle_details_config', JSON.stringify(this.config));
    // Re-sort members based on new calculation if needed, or just trigger change detection
    this.sortMembers();
  }

  openSettingsDialog(): void {
    const dialogRef = this.dialog.open(MemberDisplaySettingsDialogComponent, {
      width: '500px',
      panelClass: 'transparent-dialog-panel',
      data: {
        config: { ...this.config }, // Pass a copy
        calculationTypes: this.calculationTypes
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.config = result;
        this.saveConfig();
      }
    });
  }

  setCalculation(type: CalculationType): void {
    this.config.selectedCalculation = type;
    this.saveConfig();
  }

  getMemberValue(member: any): number {
    switch (this.config.selectedCalculation) {
      case 'monthly_gain': return member.monthly_gain;
      case 'weekly_gain': return member.weekly_gain;
      case 'daily_gain': return member.daily_gain;
      case 'avg_daily_gain': return member.seven_day_avg; // Using 7-day avg as "Avg Daily"
      case 'daily_avg': return member.daily_avg;
      case 'projected_monthly': return member.projected_monthly;
      case 'total_fans': return member.fan_count;
      default: return member.monthly_gain;
    }
  }

  getCalculationLabel(): string {
    return this.calculationTypes.find(t => t.value === this.config.selectedCalculation)?.label || 'Monthly Gain';
  }

  sortMembers(): void {
    // Separate active and inactive
    const active = this.members.filter(m => (m as any).isActive);
    const inactive = this.members.filter(m => !(m as any).isActive);

    // Sort active by selected calculation
    active.sort((a: any, b: any) => this.getMemberValue(b) - this.getMemberValue(a));
    
    // Sort inactive by fan count (default)
    inactive.sort((a: any, b: any) => b.fan_count - a.fan_count);

    this.members = [...active, ...inactive];
  }

  ngAfterViewInit(): void {
    // Chart initialization will happen after data load
  }

  ngOnDestroy(): void {
    if (this.chartTimer) {
      clearTimeout(this.chartTimer);
    }
    if (this.chart) {
      this.chart.destroy();
    }
    if (this.memberChart) {
      this.memberChart.destroy();
    }
  }

  loadData(id: string): void {
    this.loading = true;
    
    this.circleService.getCircleDetails(id, this.currentYear, this.currentMonth).subscribe({
      next: (response) => {
        console.log('Circle details response:', response);
        this.circle = response.circle;
        this.allMemberData = response.members;
        this.processMembersData(response.members);
        this.loading = false;
        
        // Use setTimeout to ensure DOM is fully rendered
        this.ngZone.runOutsideAngular(() => {
          this.chartTimer = setTimeout(() => {
            this.ngZone.run(() => {
              console.log('Initializing charts. History length:', this.history.length, 'RawMemberData length:', this.rawMemberData.length);
              console.log('Chart canvas element:', this.chartCanvas?.nativeElement);
              console.log('Member chart canvas element:', this.memberChartCanvas?.nativeElement);
              this.initChart();
              this.initMemberChart();
            });
          }, 100);
        });
      },
      error: (err) => {
        console.error('Failed to load circle details', err);
        this.loading = false;
      }
    });
  }

  processMembersData(monthlyData: CircleMemberMonthlyData[]): void {
    if (!monthlyData || monthlyData.length === 0) {
        console.error('No member data available');
        this.members = [];
        this.rawMemberData = [];
        this.history = [];
        return;
    }

    console.log('Processing members data. Total entries:', monthlyData.length);
    console.log('Looking for year:', this.currentYear, 'month:', this.currentMonth);
    
    // Filter for current month/year if API returns multiple
    // Use loose equality to handle string/number differences
    let currentMonthData = monthlyData.filter(m => m.year == this.currentYear && m.month == this.currentMonth);
    
    console.log('Filtered data for current month:', currentMonthData.length);
    
    // If no data matches, use all available data as fallback
    if (currentMonthData.length === 0) {
        console.warn('No data matched current month filter, using all available data');
        if (monthlyData.length > 0) {
            console.log('Sample data year/month:', monthlyData[0]?.year, '/', monthlyData[0]?.month);
        }
        currentMonthData = monthlyData;
    }

    const dataToProcess = currentMonthData;

    // Determine the effective "last day" index.
    let maxIndexWithData = 0;
    dataToProcess.forEach(m => {
        if (!m.daily_fans) return;
        for (let i = m.daily_fans.length - 1; i >= 0; i--) {
            if (m.daily_fans[i] > 0) {
                if (i > maxIndexWithData) maxIndexWithData = i;
                break; // Found last data for this member
            }
        }
    });

    const activeMembers: any[] = [];
    const inactiveMembers: any[] = [];

    // Process all members
    dataToProcess.forEach(m => {
      const fans = m.daily_fans || [];
      
      // Check if active: has data at the latest available index
      const isActive = fans.length > maxIndexWithData && fans[maxIndexWithData] > 0;
      
      // Find last non-zero fan count
      let lastFanCount = 0;
      let lastIndex = -1;
      for (let i = fans.length - 1; i >= 0; i--) {
        if (fans[i] > 0) {
          lastFanCount = fans[i];
          lastIndex = i;
          break;
        }
      }

      // Find first non-zero fan count for monthly gain baseline
      let firstFanCount = 0;
      let firstIndex = -1;
      for (let i = 0; i < fans.length; i++) {
        if (fans[i] > 0) {
          firstFanCount = fans[i];
          firstIndex = i;
          break;
        }
      }
      
      // Calculate daily gain
      let dailyGain = 0;
      if (isActive) {
        if (maxIndexWithData >= 1 && fans.length > maxIndexWithData) {
          dailyGain = fans[maxIndexWithData] - fans[maxIndexWithData - 1];
        } else if (maxIndexWithData === 0 && fans.length > 0) {
          dailyGain = fans[0];
        }
      }

      // Calculate Monthly Gain
      let monthlyGain = 0;
      if (lastFanCount > 0 && firstFanCount > 0) {
          monthlyGain = lastFanCount - firstFanCount;
      }

      // Calculate Daily Avg (Month)
      let dailyAvg = 0;
      if (monthlyGain > 0 && lastIndex > firstIndex) {
          const days = lastIndex - firstIndex;
          dailyAvg = monthlyGain / days;
      }

      // Calculate 7 Day Avg
      let sevenDayAvg = 0;
      let weeklyGain = 0;
      if (isActive && lastIndex >= 0) {
          const daysBack = 7;
          const prevIndex = lastIndex - daysBack;
          if (prevIndex >= 0 && fans[prevIndex] > 0) {
              sevenDayAvg = (lastFanCount - fans[prevIndex]) / daysBack;
              weeklyGain = lastFanCount - fans[prevIndex];
          } else if (firstIndex >= 0 && lastIndex > firstIndex) {
              // Less than 7 days of data, average over available days
              const days = lastIndex - firstIndex;
              sevenDayAvg = (lastFanCount - firstFanCount) / days;
              weeklyGain = lastFanCount - firstFanCount;
          }
      }

      // Calculate Projected Monthly
      let projectedMonthly = 0;
      const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
      // Estimate days active in current month based on data points
      // If we have data from day 1 to day X, daysActive is X.
      // If we started mid-month, it's less.
      // For simplicity, let's use the average daily gain * days in month
      if (sevenDayAvg > 0) {
        projectedMonthly = sevenDayAvg * daysInMonth;
      } else if (monthlyGain > 0 && lastIndex > firstIndex) {
         const days = lastIndex - firstIndex;
         projectedMonthly = (monthlyGain / days) * daysInMonth;
      }

      const memberObj = {
        trainer_id: m.viewer_id.toString(),
        name: m.trainer_name,
        fan_count: lastFanCount,
        last_updated: m.last_updated,
        role: this.circle?.leader_viewer_id === m.viewer_id ? 'leader' : 'member',
        daily_gain: dailyGain,
        monthly_gain: monthlyGain,
        seven_day_avg: sevenDayAvg,
        daily_avg: dailyAvg,
        weekly_gain: weeklyGain,
        projected_monthly: projectedMonthly,
        isActive: isActive
      };

      if (isActive) {
        activeMembers.push(memberObj);
      } else {
        inactiveMembers.push(memberObj);
      }
    });

    this.members = [...activeMembers, ...inactiveMembers];
    this.sortMembers();
    
    // For the chart, we only want to show ACTIVE members to avoid clutter
    
    // For the chart, we only want to show ACTIVE members to avoid clutter
    // Filter for members who have data at the latest index
    this.rawMemberData = dataToProcess.filter(m => {
        if (!m.daily_fans || m.daily_fans.length === 0) return false;
        // Check if member has any data at all
        const hasAnyData = m.daily_fans.some(f => f > 0);
        if (!hasAnyData) return false;
        // Check if member is active (has data at the latest point)
        if (m.daily_fans.length > maxIndexWithData && m.daily_fans[maxIndexWithData] > 0) {
            return true;
        }
        return false;
    });
    
    console.log('Raw member data for chart:', this.rawMemberData.length, 'out of', dataToProcess.length);

    // Process history for chart using ALL data (to keep circle total correct)
    this.processHistory(dataToProcess);
  }

  processHistory(membersData: CircleMemberMonthlyData[]): void {
    if (!membersData || !membersData.length) {
      console.warn('No members data for history');
      this.history = [];
      return;
    }

    const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
    this.history = [];

    for (let day = 0; day < daysInMonth; day++) {
      let dailyTotal = 0;
      let hasData = false;

      membersData.forEach(m => {
        if (m.daily_fans && m.daily_fans[day] > 0) {
          dailyTotal += m.daily_fans[day];
          hasData = true;
        }
      });

      if (hasData) {
        const date = new Date(this.currentYear, this.currentMonth - 1, day + 1);
        this.history.push({
          date: date.toISOString(),
          fan_count: dailyTotal
        });
      }
    }
    
    console.log('Processed history points:', this.history.length);
  }

  changeMonth(delta: number): void {
    let newMonth = this.currentMonth + delta;
    let newYear = this.currentYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    this.currentMonth = newMonth;
    this.currentYear = newYear;
    
    if (this.circleId) {
      this.loadData(this.circleId);
    }
  }

  initChart(): void {
    if (!this.chartCanvas) {
      console.error('Chart canvas not available');
      return;
    }
    
    if (!this.history || !this.history.length) {
      console.warn('No history data for chart');
      return;
    }

    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: this.history.map(h => {
          const d = new Date(h.date);
          const day = d.getDate().toString().padStart(2, '0');
          const month = (d.getMonth() + 1).toString().padStart(2, '0');
          return `${day}.${month}`;
        }),
        datasets: [{
          label: 'Total Fans',
          data: this.history.map(h => h.fan_count),
          borderColor: '#64b5f6',
          backgroundColor: 'rgba(100, 181, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#121212',
          pointBorderColor: '#64b5f6',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              callback: (value) => {
                if (typeof value === 'number') {
                  return new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value);
                }
                return value;
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(18, 18, 18, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('en-US').format(context.parsed.y);
                }
                return label;
              }
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  initMemberChart(): void {
    if (!this.memberChartCanvas) {
      console.error('Member chart canvas not available');
      return;
    }
    
    if (!this.rawMemberData || !this.rawMemberData.length) {
      console.warn('No member data for chart');
      return;
    }

    if (this.memberChart) {
      this.memberChart.destroy();
    }

    const ctx = this.memberChartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Could not get member chart canvas context');
      return;
    }

    // Determine how many days to show
    // We need to find the max index with data again, or store it.
    // Let's recalculate it quickly to be safe.
    let maxIndexWithData = 0;
    this.rawMemberData.forEach(m => {
        for (let i = m.daily_fans.length - 1; i >= 0; i--) {
            if (m.daily_fans[i] > 0) {
                if (i > maxIndexWithData) maxIndexWithData = i;
                break;
            }
        }
    });
    
    const daysToShow = maxIndexWithData + 1;

    // Generate labels (days 1 to N)
    const labels = Array.from({length: daysToShow}, (_, i) => {
      const day = (i + 1).toString().padStart(2, '0');
      const month = this.currentMonth.toString().padStart(2, '0');
      return `${day}.${month}`;
    });

    this.chartLegendItems = [];

    // Generate datasets
    const datasets = this.rawMemberData.map((member, index) => {
      // Simple color generation based on index
      const hue = (index * 137.508) % 360; // Golden angle approximation
      const color = `hsl(${hue}, 70%, 60%)`;
      
      this.chartLegendItems.push({
        name: member.trainer_name,
        color: color,
        hidden: false,
        datasetIndex: index
      });

      // Find first non-zero value to use as baseline
      let baseline = 0;
      const firstNonZero = member.daily_fans.find(v => v > 0);
      if (firstNonZero) {
        baseline = firstNonZero;
      }
      
      const data = member.daily_fans
        .slice(0, daysToShow)
        .map(val => {
          // If value is 0, return null to break the line
          if (val === 0) return null; 
          return val - baseline;
        });

      return {
        label: member.trainer_name,
        data: data,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4
      };
    });

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)'
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              callback: (value) => {
                if (typeof value === 'number') {
                  return new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value);
                }
                return value;
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false // Too many members to show legend
          },
          tooltip: {
            backgroundColor: 'rgba(18, 18, 18, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            itemSort: (a, b) => b.parsed.y - a.parsed.y, // Sort tooltip by value desc
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                
                // Calculate daily gain for this specific point
                const dataIndex = context.dataIndex;
                const dataset = context.dataset;
                const currentVal = dataset.data[dataIndex] as number;
                
                if (currentVal === null || currentVal === undefined) return label;

                let dailyGain = 0;
                if (dataIndex === 0) {
                    // For the first day shown, the gain is the value itself (since baseline is 0 relative to start)
                    // Or we can show 0 if we strictly mean "gain from previous day".
                    // But since we show cumulative gain on Y-axis, maybe user wants to see that?
                    // User said: "hint should show the gain that day instead of total gain"
                    // If Y-axis is cumulative gain from start of month (normalized), then
                    // gain that day = currentVal - prevVal.
                    dailyGain = currentVal;
                } else {
                    const prevVal = dataset.data[dataIndex - 1] as number;
                    // If prevVal is null (e.g. missing data), treat as 0 or skip?
                    // If we have a gap, the gain might be large.
                    const prev = (prevVal !== null && prevVal !== undefined) ? prevVal : 0;
                    dailyGain = currentVal - prev;
                }

                if (dailyGain > 0) {
                    label += '+' + new Intl.NumberFormat('en-US').format(dailyGain);
                } else {
                    label += new Intl.NumberFormat('en-US').format(dailyGain);
                }
                
                return label;
              }
            }
          }
        }
      }
    };

    this.memberChart = new Chart(ctx, config);
  }

  toggleMemberVisibility(index: number): void {
    if (!this.memberChart) return;
    
    const isVisible = this.memberChart.isDatasetVisible(index);
    this.memberChart.setDatasetVisibility(index, !isVisible);
    this.memberChart.update();
    
    if (this.chartLegendItems[index]) {
      this.chartLegendItems[index].hidden = isVisible;
    }
  }

  onLegendItemDblClick(index: number): void {
    if (!this.memberChart) return;

    // If we are already isolated on this member, restore state
    if (this.isolatedMemberIndex === index) {
        this.restoreVisibilityState();
    } else {
        // Isolate this member
        this.isolateMember(index);
    }
  }

  private isolateMember(index: number): void {
    if (!this.memberChart) return;

    // Save current state if not already saved (i.e. if we are not switching from another isolation)
    if (this.previousVisibilityState === null) {
        this.previousVisibilityState = this.memberChart.data.datasets.map((_, i) => 
            this.memberChart!.isDatasetVisible(i)
        );
    }

    this.isolatedMemberIndex = index;

    // Hide all except index
    this.memberChart.data.datasets.forEach((_, i) => {
        const shouldBeVisible = i === index;
        this.memberChart!.setDatasetVisibility(i, shouldBeVisible);
        if (this.chartLegendItems[i]) {
            this.chartLegendItems[i].hidden = !shouldBeVisible;
        }
    });

    this.memberChart.update();
  }

  private restoreVisibilityState(): void {
    if (!this.memberChart || !this.previousVisibilityState) return;

    this.previousVisibilityState.forEach((isVisible, i) => {
        this.memberChart!.setDatasetVisibility(i, isVisible);
        if (this.chartLegendItems[i]) {
            this.chartLegendItems[i].hidden = !isVisible;
        }
    });

    this.previousVisibilityState = null;
    this.isolatedMemberIndex = null;
    this.memberChart.update();
  }

  highlightMember(index: number, highlight: boolean): void {
    if (!this.memberChart) return;
    
    const datasets = this.memberChart.data.datasets;
    
    if (highlight) {
        datasets.forEach((dataset: any, i) => {
            if (i === index) {
                // Highlighted member
                dataset.borderWidth = 4;
                dataset.borderColor = this.chartLegendItems[i].color; // Ensure full color
                dataset.order = -1; // Bring to front
            } else {
                // Dim others
                // We can use a transparent version of their color or just a generic dim color
                // Let's try reducing opacity of their original color
                // Since we store HSL, we can change alpha
                // Or just set to a very transparent white/grey to make them fade into background
                dataset.borderColor = 'rgba(255, 255, 255, 0.15)'; 
                dataset.borderWidth = 1;
                dataset.order = 0;
            }
        });
    } else {
        // Restore all
        datasets.forEach((dataset: any, i) => {
            dataset.borderWidth = 2;
            dataset.borderColor = this.chartLegendItems[i].color;
            dataset.order = 0;
        });
    }
    
    this.memberChart.update('none');
  }

  exportStats(format: 'csv' | 'json'): void {
    if (!this.circle || !this.members.length) return;

    let content = '';
    let filename = `circle_${this.circle.circle_id}_${this.currentYear}_${this.currentMonth}_stats.${format}`;
    let type = '';

    if (format === 'json') {
      // Enrich members with daily fans data
      const enrichedMembers = this.members.map(m => {
        const rawData = this.allMemberData.find(d => d.viewer_id.toString() === m.trainer_id);
        return {
          ...m,
          daily_fans: rawData ? rawData.daily_fans : []
        };
      });

      content = JSON.stringify({
        circle: this.circle,
        members: enrichedMembers,
        history: this.history
      }, null, 2);
      type = 'application/json';
    } else {
      // Determine max days in month for headers
      const daysInMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();
      const dayHeaders = Array.from({length: daysInMonth}, (_, i) => `Day ${i + 1}`);

      const headers = [
        'Rank', 
        'Trainer ID', 
        'Name', 
        'Role', 
        'Status', 
        'Total Fans', 
        'Monthly Gain', 
        '7 Day Avg', 
        'Daily Avg',
        'Daily Gain', 
        'Last Updated',
        ...dayHeaders
      ];

      const rows = this.members.map((m, index) => {
        const rawData = this.allMemberData.find(d => d.viewer_id.toString() === m.trainer_id);
        const dailyFans = rawData ? rawData.daily_fans : [];
        
        // Pad daily fans to match days in month if needed, or just join what we have
        // We should align them to the correct day columns. 
        // Assuming daily_fans[0] is Day 1.
        const dailyFanColumns = Array.from({length: daysInMonth}, (_, i) => {
            return (dailyFans[i] !== undefined && dailyFans[i] !== null) ? dailyFans[i] : '';
        });

        return [
          index + 1,
          m.trainer_id,
          `"${m.name}"`, // Quote name to handle commas
          m.role,
          m.isActive ? 'Active' : 'Inactive',
          m.fan_count,
          m.monthly_gain || 0,
          Math.round(m.seven_day_avg || 0),
          Math.round(m.daily_avg || 0),
          m.daily_gain || 0,
          m.last_updated,
          ...dailyFanColumns
        ].join(',');
      });

      content = [headers.join(','), ...rows].join('\n');
      type = 'text/csv';
    }

    const blob = new Blob([content], { type: type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
