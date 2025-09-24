import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { TimelineService } from '../../services/timeline.service';
import { TimelineEvent, EventType } from '../../models/timeline.model';

interface ProcessedEvent {
  id: string;
  type: EventType;
  name: string;
  description?: string;
  date: Date;
  imagePath?: string;
}

interface VerticalTimelineItem {
  date: Date;
  label: string;
  type: 'month' | 'year' | 'milestone' | 'event' | 'anniversary' | 'grouped-events' | 'today';
  eventData?: TimelineEvent;
  groupedEvents?: TimelineEvent[]; // For multiple events on the same date
  isGrouped?: boolean;
}

interface EventFilters {
  showCharacters: boolean;
  showSupports: boolean;
  showStoryEvents: boolean;
  showChampionsMeetings: boolean;
  showLegendRaces: boolean;
  showPaidBanners: boolean;
  searchQuery: string;
}

@Component({
  selector: 'app-timeline-vertical',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  templateUrl: './timeline-vertical.component.html',
  styleUrls: ['./timeline-vertical.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineVerticalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Timeline configuration
  globalReleaseDate = new Date('2025-06-26');
  endDate = new Date('2027-06-26');
  today = new Date();

  // Data
  allEvents: TimelineEvent[] = [];
  timelineItems: VerticalTimelineItem[] = [];

  // Filters
  eventFilters: EventFilters = {
    showCharacters: true,
    showSupports: true,
    showStoryEvents: true,
    showChampionsMeetings: true,
    showLegendRaces: true,
    showPaidBanners: false, // Off by default
    searchQuery: ''
  };

  // Search state
  searchResults: VerticalTimelineItem[] = [];
  currentSearchIndex = 0;

  constructor(
    private timelineService: TimelineService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadTimelineData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTimelineData() {
    this.timelineService.events$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (events: TimelineEvent[]) => {
          this.allEvents = events;
          this.generateTimelineItems();
          this.cdr.markForCheck();
        },
        error: (error: any) => {
          console.error('Error loading timeline data:', error);
        }
      });
  }

  private generateTimelineItems() {
    const items: VerticalTimelineItem[] = [];
    const filteredEvents = this.getFilteredEvents();

    // Group events by date
    const eventsByDate = new Map<string, TimelineEvent[]>();
    filteredEvents.forEach(event => {
      // Use the estimatedGlobalDate or globalReleaseDate as the date
      const eventDate = event.estimatedGlobalDate || event.globalReleaseDate || event.jpReleaseDate;
      const dateKey = eventDate.toDateString();
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, []);
      }
      eventsByDate.get(dateKey)!.push(event);
    });

    // Create timeline items
    const sortedDates = Array.from(eventsByDate.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    let currentMonth = '';
    let currentYear = '';

    sortedDates.forEach(dateKey => {
      const date = new Date(dateKey);
      const events = eventsByDate.get(dateKey)!;

      // Add year marker if year changed
      const yearStr = date.getFullYear().toString();
      if (yearStr !== currentYear) {
        currentYear = yearStr;
        items.push({
          date,
          label: yearStr,
          type: 'year'
        });
      }

      // Add month marker if month changed
      const monthStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (monthStr !== currentMonth) {
        currentMonth = monthStr;
        items.push({
          date,
          label: date.toLocaleDateString('en-US', { month: 'long' }),
          type: 'month'
        });
      }

      // Add today marker if this is today
      if (this.isSameDay(date, this.today)) {
        items.push({
          date: this.today,
          label: 'Today',
          type: 'today'
        });
      }

      // Add events
      if (events.length === 1) {
        items.push({
          date,
          label: events[0].title,
          type: 'event',
          eventData: events[0],
          isGrouped: false
        });
      } else {
        // Multiple events on same date
        items.push({
          date,
          label: `${events.length} events`,
          type: 'grouped-events',
          groupedEvents: events,
          isGrouped: true
        });
      }
    });

    this.timelineItems = items;
    this.updateSearchResults();
  }

  private getFilteredEvents(): TimelineEvent[] {
    return this.allEvents.filter(event => {
      // Apply type filters
      if (event.type === EventType.CHARACTER_BANNER && !this.eventFilters.showCharacters) return false;
      if (event.type === EventType.SUPPORT_CARD_BANNER && !this.eventFilters.showSupports) return false;
      if (event.type === EventType.STORY_EVENT && !this.eventFilters.showStoryEvents) return false;
      if (event.type === EventType.CHAMPIONS_MEETING && !this.eventFilters.showChampionsMeetings) return false;
      if (event.type === EventType.LEGEND_RACE && !this.eventFilters.showLegendRaces) return false;
      if (event.type === EventType.PAID_BANNER && !this.eventFilters.showPaidBanners) return false;

      // Apply search filter
      if (this.eventFilters.searchQuery.trim()) {
        const query = this.eventFilters.searchQuery.toLowerCase();
        return event.title.toLowerCase().includes(query) ||
               (event.description && event.description.toLowerCase().includes(query));
      }

      return true;
    });
  }

  private updateSearchResults() {
    if (!this.eventFilters.searchQuery.trim()) {
      this.searchResults = [];
      this.currentSearchIndex = 0;
      return;
    }

    const query = this.eventFilters.searchQuery.toLowerCase();
    this.searchResults = this.timelineItems.filter(item => {
      if (item.type === 'event' && item.eventData) {
        return item.eventData.title.toLowerCase().includes(query) ||
               (item.eventData.description && item.eventData.description.toLowerCase().includes(query));
      }
      if (item.type === 'grouped-events' && item.groupedEvents) {
        return item.groupedEvents.some(event => 
          event.title.toLowerCase().includes(query) ||
          (event.description && event.description.toLowerCase().includes(query))
        );
      }
      return false;
    });
    this.currentSearchIndex = 0;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Filter toggle methods
  toggleCharacterBanners() {
    this.eventFilters.showCharacters = !this.eventFilters.showCharacters;
    this.generateTimelineItems();
    this.cdr.markForCheck();
  }

  toggleSupportBanners() {
    this.eventFilters.showSupports = !this.eventFilters.showSupports;
    this.generateTimelineItems();
    this.cdr.markForCheck();
  }

  toggleStoryEvents() {
    this.eventFilters.showStoryEvents = !this.eventFilters.showStoryEvents;
    this.generateTimelineItems();
    this.cdr.markForCheck();
  }

  toggleChampionsMeetings() {
    this.eventFilters.showChampionsMeetings = !this.eventFilters.showChampionsMeetings;
    this.generateTimelineItems();
    this.cdr.markForCheck();
  }

  toggleLegendRaces() {
    this.eventFilters.showLegendRaces = !this.eventFilters.showLegendRaces;
    this.generateTimelineItems();
    this.cdr.markForCheck();
  }

  togglePaidBanners() {
    this.eventFilters.showPaidBanners = !this.eventFilters.showPaidBanners;
    this.generateTimelineItems();
    this.cdr.markForCheck();
  }

  onSearchChange() {
    this.generateTimelineItems();
    this.cdr.markForCheck();
  }

  // Search navigation
  navigateToNextResult() {
    if (this.searchResults.length > 0) {
      this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
      this.scrollToSearchResult();
    }
  }

  navigateToPreviousResult() {
    if (this.searchResults.length > 0) {
      this.currentSearchIndex = this.currentSearchIndex === 0 
        ? this.searchResults.length - 1 
        : this.currentSearchIndex - 1;
      this.scrollToSearchResult();
    }
  }

  private scrollToSearchResult() {
    // In vertical layout, we can scroll to the specific item
    const resultItem = this.searchResults[this.currentSearchIndex];
    const itemIndex = this.timelineItems.indexOf(resultItem);
    if (itemIndex >= 0) {
      // Scroll to item (implementation depends on how you want to handle scrolling)
      const element = document.querySelector(`[data-timeline-index="${itemIndex}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // Utility methods
  getFilteredEventCount(): number {
    return this.getFilteredEvents().length;
  }

  getTotalEventCount(): number {
    return this.allEvents.length;
  }

  hasSearchResults(): boolean {
    return this.searchResults.length > 0;
  }

  getEventTypeIcon(type: EventType): string {
    switch (type) {
      case EventType.CHARACTER_BANNER: return 'person';
      case EventType.SUPPORT_CARD_BANNER: return 'style';
      case EventType.STORY_EVENT: return 'book';
      case EventType.CHAMPIONS_MEETING: return 'emoji_events';
      case EventType.LEGEND_RACE: return 'sports_score';
      case EventType.PAID_BANNER: return 'paid';
      default: return 'event';
    }
  }

  getEventTypeClass(type: EventType): string {
    switch (type) {
      case EventType.CHARACTER_BANNER: return 'event-type-character_banner';
      case EventType.SUPPORT_CARD_BANNER: return 'event-type-support_banner';
      case EventType.STORY_EVENT: return 'event-type-story_event';
      case EventType.CHAMPIONS_MEETING: return 'event-type-champions_meeting';
      case EventType.LEGEND_RACE: return 'event-type-legend_race';
      case EventType.PAID_BANNER: return 'event-type-paid_banner';
      default: return '';
    }
  }

  trackByItem(index: number, item: VerticalTimelineItem): any {
    return item.type === 'event' && item.eventData ? item.eventData.id : `${item.type}-${item.date.getTime()}`;
  }

  getMarkerClass(item: VerticalTimelineItem): string {
    return `marker-${item.type}`;
  }

  getItemClass(item: VerticalTimelineItem): string {
    return `item-${item.type}`;
  }

  getEventDate(event: TimelineEvent): Date {
    return event.estimatedGlobalDate || event.globalReleaseDate || event.jpReleaseDate;
  }

  handleImageError(event: Event, imageName: string) {
    const img = event.target as HTMLImageElement;
    // Create a placeholder with the event name
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, 120, 80);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(imageName, 60, 45);
    }
    img.src = canvas.toDataURL();
  }
}
