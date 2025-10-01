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
import { TimelineService } from '../../services/timeline.service';
import { TimelineEvent, EventType } from '../../models/timeline.model';
import { Subscription } from 'rxjs';

interface MobileTimelineItem {
    date: Date;
    label: string;
    type: 'milestone' | 'event' | 'anniversary' | 'today' | 'year';
    eventData?: TimelineEvent;
    groupedEvents?: TimelineEvent[]; // For multiple events on the same date
    isGrouped?: boolean;
    daysSinceStart: number;
    daysFromToday: number;
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
    selector: 'app-mobile-timeline',
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
    templateUrl: './mobile-timeline.component.html',
    styleUrls: ['./mobile-timeline.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileTimelineComponent implements OnInit, OnDestroy {
    // Configuration - use UTC date
    globalReleaseDate = new Date(Date.UTC(2025, 5, 26, 22, 0, 0)); // June 26, 2025, 22:00 UTC
    timelineItems: MobileTimelineItem[] = [];
    timelineEvents: TimelineEvent[] = [];

    // Event filtering
    eventFilters: EventFilters = {
        showCharacters: true,
        showSupports: true,
        showStoryEvents: true,
        showChampionsMeetings: true,
        showLegendRaces: true,
        showPaidBanners: true,
        searchQuery: ''
    };

    // UI state
    isFilterPanelExpanded = false;

    // Subscriptions
    private eventsSubscription?: Subscription;
    private todayUpdateInterval?: number;

    constructor(
        private timelineService: TimelineService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.eventsSubscription = this.timelineService.events$.subscribe(events => {
            this.timelineEvents = events;
            this.generateTimelineItems();
            this.cdr.detectChanges();
        });

        // Set up periodic updates for the today marker (every 5 minutes)
        this.setupTodayMarkerUpdate();
    }

    ngOnDestroy(): void {
        if (this.eventsSubscription) {
            this.eventsSubscription.unsubscribe();
        }
        if (this.todayUpdateInterval) {
            clearInterval(this.todayUpdateInterval);
        }
    }

    private setupTodayMarkerUpdate(): void {
        // Update the today marker every 5 minutes
        this.todayUpdateInterval = window.setInterval(() => {
            // Only regenerate if we have events
            if (this.timelineEvents.length > 0 && !document.hidden) {
                this.generateTimelineItems();
                this.cdr.detectChanges();
            }
        }, 5 * 60 * 1000); // 5 minutes in milliseconds
    }

    private generateTimelineItems(): void {
        this.timelineItems = [];

        // Calculate end date based on last event
        let actualEndDate = new Date(this.globalReleaseDate);
        if (this.timelineEvents.length > 0) {
            const latestEventDate = this.timelineEvents.reduce((latest, event) => {
                const eventDate = event.globalReleaseDate || event.jpReleaseDate;
                return eventDate > latest ? eventDate : latest;
            }, new Date(this.globalReleaseDate));

            actualEndDate = new Date(latestEventDate);
            actualEndDate.setUTCDate(actualEndDate.getUTCDate() + 14);
        }

        // Add milestone markers
        this.timelineItems.push({
            date: new Date(this.globalReleaseDate),
            label: 'Global Launch',
            type: 'milestone',
            daysSinceStart: 0,
            daysFromToday: this.calculateDaysFromTodayUTC(new Date(this.globalReleaseDate))
        });

        // Add today marker if within range (with UTC handling)
        const today = new Date();
        if (today >= this.globalReleaseDate && today <= actualEndDate) {
            const daysSinceStart = this.calculateDaysSinceStartUTC(today);
            this.timelineItems.push({
                date: new Date(today),
                label: 'Today',
                type: 'today',
                daysSinceStart,
                daysFromToday: 0 // Today is always 0 days from today
            });
        }

        // Generate anniversary markers
        this.generateAnniversaryMarkers(actualEndDate);

        // Process events with filtering
        const filteredEvents = this.timelineEvents.filter(event => this.shouldShowEvent(event));

        // Group events by date (using UTC date strings)
        const eventsByDate = new Map<string, TimelineEvent[]>();
        filteredEvents.forEach(event => {
            const eventDate = event.globalReleaseDate || event.jpReleaseDate;
            const dateKey = this.getUTCDateString(eventDate);

            if (!eventsByDate.has(dateKey)) {
                eventsByDate.set(dateKey, []);
            }
            eventsByDate.get(dateKey)!.push(event);
        });

        // Add grouped events to timeline
        eventsByDate.forEach((events, dateKey) => {
            const eventDate = new Date(dateKey);
            const daysSinceStart = this.calculateDaysSinceStartUTC(eventDate);

            if (events.length === 1) {
                // Single event
                this.timelineItems.push({
                    date: eventDate,
                    label: events[0].title,
                    type: 'event',
                    eventData: events[0],
                    isGrouped: false,
                    daysSinceStart,
                    daysFromToday: this.calculateDaysFromTodayUTC(eventDate)
                });
            } else {
                // Multiple events on same date - create a grouped item
                this.timelineItems.push({
                    date: eventDate,
                    label: `${events.length} Events`,
                    type: 'event',
                    groupedEvents: events,
                    isGrouped: true,
                    daysSinceStart,
                    daysFromToday: this.calculateDaysFromTodayUTC(eventDate)
                });
            }
        });

        // Add year markers
        this.generateYearMarkers(actualEndDate);

        // Sort by date
        this.timelineItems.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    private shouldShowEvent(event: TimelineEvent): boolean {
        // Apply event type filters
        if (event.type === EventType.CHARACTER_BANNER && !this.eventFilters.showCharacters) return false;
        if (event.type === EventType.SUPPORT_CARD_BANNER && !this.eventFilters.showSupports) return false;
        if (event.type === EventType.PAID_BANNER && !this.eventFilters.showPaidBanners) return false;
        if (event.type === EventType.STORY_EVENT && !this.eventFilters.showStoryEvents) return false;
        if (event.type === EventType.CHAMPIONS_MEETING && !this.eventFilters.showChampionsMeetings) return false;
        if (event.type === EventType.LEGEND_RACE && !this.eventFilters.showLegendRaces) return false;

        // Handle other event types under story events
        if (event.type !== EventType.CHARACTER_BANNER &&
            event.type !== EventType.SUPPORT_CARD_BANNER &&
            event.type !== EventType.PAID_BANNER &&
            event.type !== EventType.STORY_EVENT &&
            event.type !== EventType.CHAMPIONS_MEETING &&
            event.type !== EventType.LEGEND_RACE &&
            !this.eventFilters.showStoryEvents) return false;

        // Apply search filter
        if (this.eventFilters.searchQuery.trim()) {
            const searchTerm = this.eventFilters.searchQuery.toLowerCase().trim();
            const charactersMatch = event.relatedCharacters?.some(char =>
                char.toLowerCase().includes(searchTerm));
            const supportsMatch = event.relatedSupportCards?.some(support =>
                support.toLowerCase().includes(searchTerm));

            if (!charactersMatch && !supportsMatch) {
                return false;
            }
        }

        const eventDate = event.globalReleaseDate || event.jpReleaseDate;
        return eventDate >= this.globalReleaseDate;
    }

    private generateAnniversaryMarkers(endDate: Date): void {
        // Confirmed Global Anniversaries (matching desktop timeline)
        const CONFIRMED_GLOBAL_ANNIVERSARIES = [
            { date: new Date(Date.UTC(2025, 9, 26, 22, 0, 0)), label: '0.5 Year Anniversary' }, // Oct 26, 2025 - Half Anniversary
            // Future anniversaries can be added here as they're announced
        ];

        CONFIRMED_GLOBAL_ANNIVERSARIES.forEach(anniversary => {
            if (anniversary.date <= endDate && anniversary.date >= this.globalReleaseDate) {
                const daysSinceStart = this.calculateDaysSinceStartUTC(anniversary.date);
                this.timelineItems.push({
                    date: new Date(anniversary.date),
                    label: anniversary.label,
                    type: 'anniversary',
                    daysSinceStart,
                    daysFromToday: this.calculateDaysFromTodayUTC(anniversary.date)
                });
            }
        });

        // If we want to extrapolate future anniversaries after the last confirmed one
        // We can use a pattern, but for now we'll only show confirmed anniversaries
        // to match the desktop timeline behavior
    }

    private generateYearMarkers(endDate: Date): void {
        const currentDate = new Date(this.globalReleaseDate);
        const yearMarkerEndDate = new Date(Math.min(endDate.getTime(), 
            Date.UTC(this.globalReleaseDate.getUTCFullYear() + 10, 0, 1)));

        while (currentDate <= yearMarkerEndDate) {
            if (currentDate.getUTCMonth() === 0 && currentDate.getUTCDate() === 1 && 
                currentDate.getUTCFullYear() >= this.globalReleaseDate.getUTCFullYear()) {
                const daysSinceStart = this.calculateDaysSinceStartUTC(currentDate);

                this.timelineItems.push({
                    date: new Date(currentDate),
                    label: currentDate.getUTCFullYear().toString(),
                    type: 'year',
                    daysSinceStart,
                    daysFromToday: this.calculateDaysFromTodayUTC(currentDate)
                });
            }
            currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
            currentDate.setUTCDate(1);
        }
    }

    // Helper method to calculate days from today using UTC
    private calculateDaysFromTodayUTC(date: Date): number {
        const today = new Date();
        // Today at 22:00 UTC (event time)
        const todayEventTime = new Date(Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
            22, 0, 0, 0
        ));
        
        // Event date at 22:00 UTC
        const eventDateTime = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            22, 0, 0, 0
        ));
        
        // If today's event time hasn't passed yet, use yesterday's event time as reference
        const referenceTime = today < todayEventTime 
            ? new Date(todayEventTime.getTime() - 24 * 60 * 60 * 1000)
            : todayEventTime;
        
        return Math.floor((eventDateTime.getTime() - referenceTime.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Helper method to calculate days since start using UTC
    private calculateDaysSinceStartUTC(date: Date): number {
        // Global release at 22:00 UTC
        const startUTC = new Date(Date.UTC(
            this.globalReleaseDate.getUTCFullYear(),
            this.globalReleaseDate.getUTCMonth(),
            this.globalReleaseDate.getUTCDate(),
            22, 0, 0, 0
        ));
        
        // Date at 22:00 UTC
        const dateUTC = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            22, 0, 0, 0
        ));
        
        return Math.floor((dateUTC.getTime() - startUTC.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Helper method to get UTC date string for grouping
    private getUTCDateString(date: Date): string {
        // Group by the event date at 22:00 UTC
        return new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            22, 0, 0, 0
        )).toISOString();
    }

    // Filter methods
    onSearchChange(): void {
        this.generateTimelineItems();
        this.cdr.detectChanges();
    }

    toggleCharacterFilter(): void {
        this.generateTimelineItems();
        this.cdr.detectChanges();
    }

    toggleSupportFilter(): void {
        this.generateTimelineItems();
        this.cdr.detectChanges();
    }

    toggleStoryEventsFilter(): void {
        this.generateTimelineItems();
        this.cdr.detectChanges();
    }

    toggleChampionsMeetingsFilter(): void {
        this.generateTimelineItems();
        this.cdr.detectChanges();
    }

    toggleLegendRacesFilter(): void {
        this.generateTimelineItems();
        this.cdr.detectChanges();
    }

    togglePaidBannersFilter(): void {
        this.generateTimelineItems();
        this.cdr.detectChanges();
    }

    getFilteredEventCount(): number {
        return this.timelineEvents.filter(event => this.shouldShowEvent(event)).length;
    }

    getTotalEventCount(): number {
        return this.timelineEvents.length;
    }

    // Helper methods for filtering event counts in template
    getCharacterBannerCount(): number {
        return this.timelineEvents.filter(e => e.type === EventType.CHARACTER_BANNER).length;
    }

    getSupportCardBannerCount(): number {
        return this.timelineEvents.filter(e => e.type === EventType.SUPPORT_CARD_BANNER).length;
    }

    getStoryEventCount(): number {
        return this.timelineEvents.filter(e => e.type === EventType.STORY_EVENT).length;
    }

    getChampionsMeetingCount(): number {
        return this.timelineEvents.filter(e => e.type === EventType.CHAMPIONS_MEETING).length;
    }

    getLegendRaceCount(): number {
        return this.timelineEvents.filter(e => e.type === EventType.LEGEND_RACE).length;
    }

    getPaidBannerCount(): number {
        return this.timelineEvents.filter(e => e.type === EventType.PAID_BANNER).length;
    }

    onImageError(event: any): void {
        (event.target as HTMLImageElement).style.display = 'none';
    }

    scrollToToday(): void {
        const todayItem = this.timelineItems.find(item => item.type === 'today');
        if (todayItem) {
            const element = document.getElementById(`timeline-item-${todayItem.daysSinceStart}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    toggleFilterPanel(): void {
        this.isFilterPanelExpanded = !this.isFilterPanelExpanded;
        this.cdr.detectChanges();
    }

    trackByItemDate(index: number, item: MobileTimelineItem): string {
        return `${item.date.getTime()}-${item.type}-${item.isGrouped ? 'grouped' : 'single'}`;
    }

    // Helper methods for event type checking
    isCharacterBanner(eventType?: EventType): boolean {
        return eventType === EventType.CHARACTER_BANNER;
    }

    isSupportCardBanner(eventType?: EventType): boolean {
        return eventType === EventType.SUPPORT_CARD_BANNER;
    }

    isStoryEvent(eventType?: EventType): boolean {
        return eventType === EventType.STORY_EVENT;
    }

    isChampionsMeeting(eventType?: EventType): boolean {
        return eventType === EventType.CHAMPIONS_MEETING;
    }

    isLegendRace(eventType?: EventType): boolean {
        return eventType === EventType.LEGEND_RACE;
    }

    isPaidBanner(eventType?: EventType): boolean {
        return eventType === EventType.PAID_BANNER;
    }

    // Helper method to get event image URL
    getEventImageUrl(event?: TimelineEvent): string | undefined {
        return event?.imagePath;
    }

    // Helper method to safely get event title
    getEventTitle(event?: TimelineEvent): string {
        return event?.title || '';
    }

    // Format date for mobile timeline items
    formatDateForItem(item: MobileTimelineItem): string {
        if (!item.date) return '';

        const dateOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        };

        const formatSingleDate = (date: Date): string => {
            return date.toLocaleDateString('en-US', dateOptions);
        };

        // Check confirmation status from event data or grouped events
        let isConfirmed = true;
        if (item.eventData) {
            isConfirmed = item.eventData.isConfirmed !== false;
        } else if (item.groupedEvents && item.groupedEvents.length > 0) {
            // For grouped events, show ~ if any event is unconfirmed
            isConfirmed = item.groupedEvents.every(event => event.isConfirmed !== false);
        }

        const prefix = isConfirmed ? '' : '~';
        return `${prefix}${formatSingleDate(item.date)}`;
    }

    // Format date to ensure consistent display (same as desktop timeline)
    formatDate(event: TimelineEvent): string {
        const eventDate = event.globalReleaseDate || event.jpReleaseDate;
        if (!eventDate) return '';

        const dateOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        };

        const formatSingleDate = (date: Date): string => {
            return date.toLocaleDateString('en-US', dateOptions);
        };

        // Simple date formatting with confirmation indicator
        const isConfirmed = event.isConfirmed;
        const prefix = isConfirmed ? '' : '~';
        
        return `${prefix}${formatSingleDate(eventDate)}`;
    }

    // Open gametora URL if available
    openGametoraLink(event?: TimelineEvent): void {
        if (event?.gametoraURL) {
            window.open(event.gametoraURL, '_blank', 'noopener,noreferrer');
        }
    }

    // Check if event has gametora link
    hasGametoraLink(event?: TimelineEvent): boolean {
        return !!(event?.gametoraURL);
    }
}
