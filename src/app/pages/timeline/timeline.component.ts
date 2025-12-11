import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, NgZone, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { TimelineService } from '../../services/timeline.service';
import { TimelineEvent, EventType } from '../../models/timeline.model';
import { MobileTimelineComponent } from '../../components/mobile-timeline/mobile-timeline.component';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Meta, Title } from '@angular/platform-browser';

interface TimelineItem {
    date: Date;
    label: string;
    type: 'month' | 'year' | 'milestone' | 'event' | 'anniversary' | 'grouped-events' | 'today';
    position: number;
    side?: 'top' | 'bottom';
    eventData?: TimelineEvent;
    groupedEvents?: TimelineEvent[]; // For multiple events on the same date
    groupIndex?: number; // Index within a group of events on the same date
    isGrouped?: boolean; // Whether this item is part of a group
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

const CONFIRMED_GLOBAL_ANNIVERSARIES = new Map<number, Date>([
    // 1 => First half-anniversary (6 months after launch)
    // Oct 26, 2025 at 22:00 UTC = Oct 26, 2025 at 23:00 CET (11:00 PM) in Europe after DST ends
    [1, new Date(Date.UTC(2025, 9, 26, 22, 0, 0))]
]);

@Component({
    selector: 'app-timeline',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatChipsModule,
        MatSlideToggleModule,
        MatButtonToggleModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        FormsModule,
        ScrollingModule,
        MobileTimelineComponent
    ],
    templateUrl: './timeline.component.html',
    styleUrls: ['./timeline.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush // Enable OnPush for better performance
})
export class TimelineComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('timelineContainer', { static: false }) timelineContainer!: ElementRef;

    // Timeline configuration
    globalReleaseDate = new Date('2025-06-26T22:00:00Z'); // Global launch date
    endDate = new Date('2027-06-26'); // 2 years instead of 4

    // Responsive design
    isMobile = false;
    mobileBreakpoint = 950; // Width in pixels for mobile breakpoint
    isCompactMode = false; // For floating filter card
    compactModeHeightThreshold = 1200; // Height threshold for compact mode

    // Virtual rendering configuration
    itemSize = 300; // Width per item for spacing calculation
    allTimelineItems: TimelineItem[] = []; // All items (for data)
    visibleTimelineItems: TimelineItem[] = []; // Only visible items (for rendering)
    viewportWidth = 0;
    scrollLeft = 0;
    bufferSize = 5; // Number of items to render outside viewport for smooth scrolling

    // Timeline dimensions
    totalDays = 0;
    pixelsPerDay = 150;
    totalWidth = 0;
    initialOffset = 350;

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

    // Search navigation
    searchResultIndices: number[] = [];
    currentSearchIndex: number = -1;

    // Service subscription
    private eventsSubscription?: Subscription;
    private scrollSubscription?: Subscription;
    timelineEvents: TimelineEvent[] = [];

    // Drag to scroll properties
    isDragging = false;
    hasDragged = false;
    private startX = 0;
    private scrollStart = 0;
    private dragAnimationFrame?: number;
    private boundMouseMove = this.onMouseMove.bind(this);
    private boundMouseUp = this.onMouseUp.bind(this);

    // Velocity scrolling properties
    private lastX = 0;
    private lastTime = 0;
    private velocityX = 0;
    private momentumAnimation?: number;
    private isDecelerating = false;

    // Dynamic scaling properties
    cardScale = 1;
    cardVerticalOffsetBottom = 60;  // For items below the timeline
    cardVerticalOffsetTop = 60;     // For items above the timeline
    cardTransformOffset = 25;
    private resizeObserver?: ResizeObserver;

    constructor(private timelineService: TimelineService, private ngZone: NgZone, private cdr: ChangeDetectorRef, private meta: Meta, private title: Title) {
        this.title.setTitle('Timeline | honse.moe');
        this.meta.addTags([
            { name: 'description', content: 'Check the estimated release timeline for the global version. When does your favorite character release?' },
            { property: 'og:title', content: 'Timeline | honse.moe Umamusume Tools' },
            { property: 'og:description', content: 'Check the estimated release timeline for the global version. When does your favorite character release?' },
            { property: 'og:type', content: 'website' },
            { property: 'og:url', content: 'https://honse.moe/timeline' },
            { property: 'og:image', content: 'https://honse.moe/assets/logo.png' },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: 'Timeline | honse.moe' },
            { name: 'twitter:description', content: 'Check the estimated release timeline for the global version. When does your favorite character release?' },
            { name: 'twitter:image', content: 'https://honse.moe/assets/logo.png' }
        ]);
    }

    @HostListener('window:resize', ['$event'])
    onResize(event: any): void {
        this.checkMobileBreakpoint();
        this.checkCompactMode();
        this.calculateDynamicScale();
        if (!this.isMobile) {
            // Recalculate viewport for desktop timeline
            this.updateVisibleItems();
        }
    }

    @HostListener('wheel', ['$event'])
    onWheel(event: WheelEvent): void {
        if (!this.timelineContainer || this.isMobile) return;

        // Always handle wheel events for horizontal scrolling on the timeline
        event.preventDefault();

        const container = this.timelineContainer.nativeElement;

        // Determine scroll direction and amount
        let scrollAmount = 0;

        // If it's already a horizontal wheel event (some mice/trackpads support this)
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            scrollAmount = event.deltaX;
        } else {
            // Convert vertical wheel to horizontal scroll
            scrollAmount = event.deltaY;
        }

        // Multiply by 10 for faster scrolling as requested
        scrollAmount *= 10;

        // Apply the scroll
        container.scrollLeft += scrollAmount;
    }

    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        if (!this.timelineContainer || this.isMobile) return;

        // Only handle if timeline is focused or no input is focused
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            return;
        }

        const container = this.timelineContainer.nativeElement;
        const scrollAmount = 300; // Pixels to scroll
        const pageScrollAmount = container.clientWidth * 0.8; // 80% of viewport for page up/down

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                container.scrollLeft -= scrollAmount;
                break;
            case 'ArrowRight':
                event.preventDefault();
                container.scrollLeft += scrollAmount;
                break;
            case 'PageUp':
                event.preventDefault();
                container.scrollLeft -= pageScrollAmount;
                break;
            case 'PageDown':
                event.preventDefault();
                container.scrollLeft += pageScrollAmount;
                break;
            case 'Home':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.scrollToStart();
                }
                break;
            case 'End':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.scrollToEnd();
                }
                break;
        }
    }

    // Drag to scroll functionality
    onMouseDown(event: MouseEvent): void {
        if (!this.timelineContainer || this.isMobile) return;

        // Only handle left mouse button, ignore middle mouse button for page scrolling
        if (event.button !== 0) return;

        event.preventDefault();
        this.isDragging = true;
        this.hasDragged = false;
        this.isDecelerating = false;

        // Cancel any ongoing momentum
        if (this.momentumAnimation) {
            cancelAnimationFrame(this.momentumAnimation);
            this.momentumAnimation = undefined;
        }

        const container = this.timelineContainer.nativeElement;

        // Get the exact mouse position relative to the page
        this.startX = event.pageX;
        this.scrollStart = container.scrollLeft;

        // Initialize velocity tracking
        this.lastX = event.pageX;
        this.lastTime = performance.now();
        this.velocityX = 0;

        // Add global mouse event listeners
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);

        // Change cursor to indicate dragging
        container.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        // Add dragging class for CSS optimizations
        container.classList.add('is-dragging');
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.isDragging || !this.timelineContainer) return;

        event.preventDefault();

        const container = this.timelineContainer.nativeElement;
        const currentTime = performance.now();
        const currentX = event.pageX;

        // Check if we've moved enough to consider it a drag
        if (!this.hasDragged && Math.abs(currentX - this.startX) > 5) {
            this.hasDragged = true;
        }

        // Calculate velocity for momentum
        const timeDelta = currentTime - this.lastTime;
        if (timeDelta > 0) {
            this.velocityX = (currentX - this.lastX) / timeDelta * 16; // Convert to pixels per frame (60fps)
        }

        this.lastX = currentX;
        this.lastTime = currentTime;

        // Calculate new scroll position
        const deltaX = currentX - this.startX;
        const newScrollLeft = this.scrollStart - deltaX;

        // Apply scroll immediately without requestAnimationFrame for instant feedback
        container.scrollLeft = newScrollLeft;

        // Update visible items without requestAnimationFrame for immediate response
        this.updateVisibleItemsSync();
    }

    private onMouseUp(event: MouseEvent): void {
        if (!this.isDragging) return;

        this.isDragging = false;

        // Remove global mouse event listeners
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);

        // Reset cursor and user selection
        if (this.timelineContainer) {
            const container = this.timelineContainer.nativeElement;
            container.style.cursor = 'grab';
            container.classList.remove('is-dragging');
        }
        document.body.style.userSelect = '';

        // Start momentum scrolling if velocity is significant
        if (Math.abs(this.velocityX) > 0.5) {
            this.startMomentum();
        }
    }

    private startMomentum(): void {
        if (!this.timelineContainer || this.isDecelerating) return;

        this.isDecelerating = true;
        const container = this.timelineContainer.nativeElement;
        const friction = 0.92; // Slightly lower friction for smoother deceleration
        const minVelocity = 0.1; // Minimum velocity before stopping

        const animate = () => {
            if (!this.isDecelerating || !this.timelineContainer) return;

            // Apply velocity to scroll position
            container.scrollLeft -= this.velocityX;

            // Apply friction
            this.velocityX *= friction;

            // Update visible items
            this.updateVisibleItemsSync();

            // Continue animation if velocity is significant
            if (Math.abs(this.velocityX) > minVelocity) {
                this.momentumAnimation = requestAnimationFrame(animate);
            } else {
                // Stop momentum
                this.isDecelerating = false;
                this.velocityX = 0;
                this.momentumAnimation = undefined;

                // Final update
                this.cdr.detectChanges();
            }
        };

        animate();
    }

    ngOnInit(): void {
        // Check initial screen size
        this.checkMobileBreakpoint();
        this.checkCompactMode();

        // Subscribe to timeline events from the service
        this.eventsSubscription = this.timelineService.events$.subscribe(events => {
            this.timelineEvents = events;
            this.generateTimelineItems();
            this.updateVisibleItemsSync(true);
            // Trigger change detection manually
            this.cdr.detectChanges();
        });

        this.generateTimelineItems();

    }

    ngAfterViewInit(): void {
        this.setupScrollListener();
        this.setupResizeObserver();
        this.calculateDynamicScale();

        // Detect if we're in Chrome
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

        // Chrome-specific scroll fix: Force reflow to ensure scrollbars are recognized
        setTimeout(() => {
            if (this.timelineContainer) {
                const container = this.timelineContainer.nativeElement;

                // Chrome-specific optimizations
                if (isChrome) {
                    // Disable smooth scrolling for drag operations
                    container.style.scrollBehavior = 'auto';

                    // Force GPU acceleration
                    container.style.transform = 'translateZ(0)';
                    container.style.willChange = 'scroll-position';
                }

                // Force Chrome to recalculate scrollable area
                const originalOverflow = container.style.overflowX;
                container.style.overflowX = 'hidden';
                container.offsetHeight; // Force reflow
                container.style.overflowX = originalOverflow || 'auto';

                // Additional Chrome fix: temporarily adjust width to trigger scrollbar recognition
                const track = container.querySelector('.timeline-track') as HTMLElement;
                if (track) {
                    const originalWidth = track.style.width;
                    track.style.width = (track.offsetWidth + 1) + 'px';
                    track.offsetWidth; // Force reflow
                    track.style.width = originalWidth;
                }

                // Initial viewport calculation
                this.updateVisibleItems();
            }
            this.scrollToToday();
        }, 100);

        this.updateVisibleItemsSync(true);
        // Trigger change detection manually
        this.cdr.detectChanges();
    }

    ngOnDestroy(): void {
        if (this.eventsSubscription) {
            this.eventsSubscription.unsubscribe();
        }
        if (this.scrollSubscription) {
            this.scrollSubscription.unsubscribe();
        }

        // Clean up drag event listeners
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);

        // Clean up animations
        if (this.dragAnimationFrame) {
            cancelAnimationFrame(this.dragAnimationFrame);
        }
        if (this.momentumAnimation) {
            cancelAnimationFrame(this.momentumAnimation);
        }

        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        // Reset body styles
        document.body.style.userSelect = '';
    }

    private generateTimelineItems(): void {
        this.allTimelineItems = [];

        // First, calculate the actual end date based on the last event
        let actualEndDate = new Date(this.globalReleaseDate);
        if (this.timelineEvents.length > 0) {
            // Find the latest event date
            const latestEventDate = this.timelineEvents.reduce((latest, event) => {
                const eventDate = event.globalReleaseDate || event.jpReleaseDate;
                return eventDate > latest ? eventDate : latest;
            }, new Date(this.globalReleaseDate));

            // Add minimal padding after the last event (e.g., 2 weeks)
            actualEndDate = new Date(latestEventDate);
            actualEndDate.setDate(actualEndDate.getDate() + 14);
        } else {
            // Fallback to original end date if no events
            actualEndDate = this.endDate;
        }

        this.totalDays = Math.ceil((actualEndDate.getTime() - this.globalReleaseDate.getTime()) / (1000 * 60 * 60 * 24));
        this.updateTimelineWidth();

        const currentDate = new Date(this.globalReleaseDate);
        let position = 0;

        // Add rocket marker for global release (just a marker, no card)
        this.allTimelineItems.push({
            date: new Date(this.globalReleaseDate),
            label: 'Global Launch',
            type: 'milestone',
            position: this.initialOffset
        });

        // Generate anniversary markers
        this.generateAnniversaryMarkers(actualEndDate);

        // Generate events from service data with filtering and grouping
        const filteredEvents = this.timelineEvents.filter(event => {
            // Apply event type filters
            if (event.type === EventType.CHARACTER_BANNER && !this.eventFilters.showCharacters) return false;
            if (event.type === EventType.SUPPORT_CARD_BANNER && !this.eventFilters.showSupports) return false;
            if (event.type === EventType.PAID_BANNER && !this.eventFilters.showPaidBanners) return false;
            if (event.type === EventType.STORY_EVENT && !this.eventFilters.showStoryEvents) return false;
            if (event.type === EventType.CHAMPIONS_MEETING && !this.eventFilters.showChampionsMeetings) return false;
            if (event.type === EventType.LEGEND_RACE && !this.eventFilters.showLegendRaces) return false;

            // Handle other event types (campaigns, updates, etc.) under story events
            if (event.type !== EventType.CHARACTER_BANNER &&
                event.type !== EventType.SUPPORT_CARD_BANNER &&
                event.type !== EventType.PAID_BANNER &&
                event.type !== EventType.STORY_EVENT &&
                event.type !== EventType.CHAMPIONS_MEETING &&
                event.type !== EventType.LEGEND_RACE &&
                !this.eventFilters.showStoryEvents) return false;

            // Apply search filter - only search in tags (characters and support cards)
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
        });

        // Group events by date (same day)
        const eventsByDate = new Map<string, { date: Date, events: TimelineEvent[] }>();
        filteredEvents.forEach(event => {
            const eventDate = event.globalReleaseDate || event.jpReleaseDate;
            // Use date string as key for grouping, but preserve the actual Date object
            const dateKey = `${eventDate.getUTCFullYear()}-${eventDate.getUTCMonth()}-${eventDate.getUTCDate()}`;

            if (!eventsByDate.has(dateKey)) {
                eventsByDate.set(dateKey, { date: eventDate, events: [] });
            }
            eventsByDate.get(dateKey)!.events.push(event);
        });

        // Generate timeline items for grouped events
        let alternateIndex = 0;

        // Sort events by date first to ensure consistent alternation
        const sortedEventDates = Array.from(eventsByDate.entries())
            .sort(([, a], [, b]) => a.date.getTime() - b.date.getTime());

        sortedEventDates.forEach(([dateKey, { date: eventDate, events }]) => {
            const daysSinceStart = Math.ceil((eventDate.getTime() - this.globalReleaseDate.getTime()) / (1000 * 60 * 60 * 24));
            const basePosition = daysSinceStart * this.pixelsPerDay;

            // Determine side - simple alternation based on index
            const side: 'top' | 'bottom' = alternateIndex % 2 === 0 ? 'top' : 'bottom';

            if (events.length === 1) {
                // Single event - display normally
                this.allTimelineItems.push({
                    date: eventDate,  // Use the original date with time preserved
                    label: events[0].title,
                    type: 'event',
                    position: basePosition + this.initialOffset,
                    side: side,
                    eventData: events[0],
                    isGrouped: false
                });
            } else {
                // Multiple events on same date - display side by side
                events.forEach((event, groupIndex) => {
                    this.allTimelineItems.push({
                        date: eventDate,  // Use the original date with time preserved
                        label: event.title,
                        type: 'event',
                        position: basePosition + this.initialOffset,
                        side: side,
                        eventData: event,
                        isGrouped: true,
                        groupIndex: groupIndex,
                        groupedEvents: events // Include all events in the group for reference
                    });
                });
            }

            // Always increment alternateIndex for each date group
            alternateIndex++;
        });

        // Generate year markers up to the actual end date, but don't extend timeline unnecessarily
        const yearMarkerEndDate = new Date(Math.min(actualEndDate.getTime(), new Date(this.globalReleaseDate.getFullYear() + 10, 0, 1).getTime()));
        while (currentDate <= yearMarkerEndDate) {
            const daysSinceStart = Math.ceil((currentDate.getTime() - this.globalReleaseDate.getTime()) / (1000 * 60 * 60 * 24));
            position = daysSinceStart * this.pixelsPerDay;

            // Add year markers only for January 1st and only if it's not too far in the future
            if (currentDate.getMonth() === 0 && currentDate.getDate() === 1 && currentDate.getFullYear() >= this.globalReleaseDate.getFullYear()) {
                this.allTimelineItems.push({
                    date: new Date(currentDate),
                    label: currentDate.getFullYear().toString(),
                    type: 'year',
                    position: position + this.initialOffset,
                });
            }

            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(1);
        }

        // Add today marker if it's within our timeline range
        const today = new Date();
        if (today >= this.globalReleaseDate && today <= actualEndDate) {
            // Get the start of today in UTC
            const todayStartUTC = new Date(Date.UTC(
                today.getUTCFullYear(),
                today.getUTCMonth(),
                today.getUTCDate(),
                0, 0, 0, 0
            ));

            // Calculate days since global release to the start of today (UTC)
            // Use Math.floor for correct day count
            const daysSinceStart = Math.floor((todayStartUTC.getTime() - this.globalReleaseDate.getTime()) / (1000 * 60 * 60 * 24));

            // Calculate how far through the current day we are in UTC (0.0 to 1.0)
            // Directly use UTC hours and minutes from the current time
            const todayProgress = (today.getUTCHours() * 60 + today.getUTCMinutes()) / (24 * 60);

            // Position today marker: base position + progress through the day
            const todayPosition = (daysSinceStart + todayProgress) * this.pixelsPerDay;

            this.allTimelineItems.push({
                date: today, // Just use the original Date object
                label: 'Today',
                type: 'today',
                position: todayPosition + this.initialOffset
            });
        }

        // After generating all items, update visible items
        this.updateVisibleItems();
    }

    private updateTimelineWidth(): void {
        this.totalWidth = this.totalDays * this.pixelsPerDay;
    }

    scrollToToday(): void {
        const today = new Date();
        const daysSinceStart = Math.max(0, Math.ceil((today.getTime() - this.globalReleaseDate.getTime()) / (1000 * 60 * 60 * 24)));
        const scrollPosition = daysSinceStart * this.pixelsPerDay;

        if (this.timelineContainer) {
            this.timelineContainer.nativeElement.scrollLeft = scrollPosition - (this.timelineContainer.nativeElement.clientWidth / 2);
        }
    }

    scrollToStart(): void {
        if (this.timelineContainer) {
            this.timelineContainer.nativeElement.scrollLeft = 0;
        }
    }

    scrollToEnd(): void {
        if (this.timelineContainer) {
            this.timelineContainer.nativeElement.scrollLeft = this.totalWidth;
        }
    }

    onScroll(event: Event): void {
        // Handle scroll events if needed - keep minimal to avoid performance issues
    }

    getDateFromPosition(position: number): Date {
        const days = position / this.pixelsPerDay;
        const date = new Date(this.globalReleaseDate);
        date.setDate(date.getDate() + days);
        return date;
    }

    getCurrentScrollDate(): string {
        if (!this.timelineContainer) return '';

        const scrollPosition = this.timelineContainer.nativeElement.scrollLeft;
        const centerPosition = scrollPosition + (this.timelineContainer.nativeElement.clientWidth / 2);
        const date = this.getDateFromPosition(centerPosition);

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    onImageError(event: any): void {
        (event.target as HTMLImageElement).style.display = 'none';
    }

    // TrackBy function to optimize *ngFor performance
    trackTimelineItem(index: number, item: TimelineItem): any {
        // Use a combination of position and date for unique tracking
        // This prevents unnecessary DOM updates when scrolling
        return `${item.position}-${item.date.getTime()}-${item.type}`;
    }

    // Filter methods
    onSearchChange(): void {
        // Only regenerate if search actually changed
        this.generateTimelineItems();
        this.updateSearchResults();
        this.updateVisibleItemsSync(true);
        this.cdr.detectChanges();
    }

    private updateSearchResults(): void {
        this.searchResultIndices = [];
        this.currentSearchIndex = -1;

        if (!this.eventFilters.searchQuery.trim()) {
            return;
        }

        // Find all timeline items that match the search
        this.searchResultIndices = this.allTimelineItems
            .map((item: TimelineItem, index: number) => ({ item, index }))
            .filter(({ item }: { item: TimelineItem }) => {
                if (item.type !== 'event' || !item.eventData) return false;

                const searchTerm = this.eventFilters.searchQuery.toLowerCase().trim();
                const charactersMatch = item.eventData.relatedCharacters?.some((char: string) =>
                    char.toLowerCase().includes(searchTerm));
                const supportsMatch = item.eventData.relatedSupportCards?.some((support: string) =>
                    support.toLowerCase().includes(searchTerm));

                return charactersMatch || supportsMatch;
            })
            .map(({ index }: { index: number }) => index);
    }

    jumpToNextResult(): void {
        if (this.searchResultIndices.length === 0) return;

        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResultIndices.length;
        this.scrollToSearchResult();
    }

    jumpToPreviousResult(): void {
        if (this.searchResultIndices.length === 0) return;

        this.currentSearchIndex = this.currentSearchIndex <= 0
            ? this.searchResultIndices.length - 1
            : this.currentSearchIndex - 1;
        this.scrollToSearchResult();
    }

    private scrollToSearchResult(): void {
        if (this.currentSearchIndex === -1 || !this.timelineContainer) return;

        const resultIndex = this.searchResultIndices[this.currentSearchIndex];
        const targetItem = this.allTimelineItems[resultIndex];

        if (targetItem) {
            const scrollPosition = targetItem.position - (this.timelineContainer.nativeElement.clientWidth / 2);

            // Use immediate scroll instead of smooth scroll for faster navigation
            this.timelineContainer.nativeElement.scrollLeft = Math.max(0, scrollPosition);

            // Force immediate update of visible items
            this.updateVisibleItemsSync(true);
            this.cdr.detectChanges();
        }
    }

    getCurrentSearchPosition(): string {
        if (this.searchResultIndices.length === 0) return '';
        return `${this.currentSearchIndex + 1} of ${this.searchResultIndices.length}`;
    }

    hasSearchResults(): boolean {
        return this.searchResultIndices.length > 0;
    }

    toggleCharacterFilter(): void {
        this.eventFilters.showCharacters = !this.eventFilters.showCharacters;
        this.generateTimelineItems();
        this.updateVisibleItemsSync(true);
        this.cdr.detectChanges();
    }

    toggleSupportFilter(): void {
        this.eventFilters.showSupports = !this.eventFilters.showSupports;
        this.generateTimelineItems();
        this.updateVisibleItemsSync(true);
        this.cdr.detectChanges();
    }

    toggleStoryEventsFilter(): void {
        this.eventFilters.showStoryEvents = !this.eventFilters.showStoryEvents;
        this.generateTimelineItems();
        this.updateVisibleItemsSync(true);
        this.cdr.detectChanges();
    }

    toggleChampionsMeetingsFilter(): void {
        this.eventFilters.showChampionsMeetings = !this.eventFilters.showChampionsMeetings;
        this.generateTimelineItems();
        this.updateVisibleItemsSync(true);
        this.cdr.detectChanges();
    }

    toggleLegendRacesFilter(): void {
        this.eventFilters.showLegendRaces = !this.eventFilters.showLegendRaces;
        this.generateTimelineItems();
        this.updateVisibleItemsSync(true);
        this.cdr.detectChanges();
    }

    togglePaidBannersFilter(): void {
        this.eventFilters.showPaidBanners = !this.eventFilters.showPaidBanners;
        this.generateTimelineItems();
        this.updateVisibleItemsSync(true);
        this.cdr.detectChanges();
    }

    getFilteredEventCount(): number {
        return this.timelineEvents.filter(event => {
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

            // Apply search filter - only search in tags (characters and support cards)
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

            return true;
        }).length;
    }

    getTotalEventCount(): number {
        return this.timelineEvents.length;
    }

    private generateAnniversaryMarkers(endDate: Date): void {
        // Use UTC dates to avoid timezone issues
        const jpLaunchDate = new Date(Date.UTC(2021, 1, 24)); // February 24, 2021 (month is 0-indexed)
        const globalReleaseDate = new Date(Date.UTC(2025, 5, 26, 22, 0, 0)); // June 26, 2025 22:00 UTC

        // Generate half-year and full-year anniversaries based on JP timeline
        let anniversaryCount = 0;

        while (true) {
            anniversaryCount++;

            // Calculate the JP anniversary date by adding 6-month intervals
            // Use precise year/month arithmetic to avoid setMonth() issues
            const monthsToAdd = anniversaryCount * 6;
            const jpAnniversaryYear = jpLaunchDate.getUTCFullYear() + Math.floor(monthsToAdd / 12);
            const jpAnniversaryMonth = jpLaunchDate.getUTCMonth() + (monthsToAdd % 12);

            // Handle month overflow
            const finalYear = jpAnniversaryYear + Math.floor(jpAnniversaryMonth / 12);
            const finalMonth = jpAnniversaryMonth % 12;

            const jpAnniversaryDate = new Date(Date.UTC(finalYear, finalMonth, jpLaunchDate.getUTCDate()));

            let globalAnniversaryDate: Date;
            const confirmedAnniversaryDate = CONFIRMED_GLOBAL_ANNIVERSARIES.get(anniversaryCount);

            if (confirmedAnniversaryDate) {
                // Use confirmed date when available (already in UTC)
                globalAnniversaryDate = new Date(confirmedAnniversaryDate);
            } else {
                // Calculate days since JP launch using UTC precision
                const daysSinceJpLaunch = Math.round((jpAnniversaryDate.getTime() - jpLaunchDate.getTime()) / (1000 * 60 * 60 * 24));

                // Apply acceleration to estimate the global schedule
                const adjustedDays = Math.round(daysSinceJpLaunch / 1.45);

                // Calculate global anniversary date using UTC
                globalAnniversaryDate = new Date(globalReleaseDate.getTime() + (adjustedDays * 24 * 60 * 60 * 1000));
            }

            // Stop if the anniversary is beyond our timeline end date
            if (globalAnniversaryDate > endDate) {
                break;
            }

            // Calculate position using consistent UTC precision
            var daysSinceStart = Math.round((globalAnniversaryDate.getTime() - this.globalReleaseDate.getTime()) / (1000 * 60 * 60 * 24));

            if (anniversaryCount == 2 || anniversaryCount == 5 || anniversaryCount == 8) {
                //daysSinceStart += 1;
            }

            const position = daysSinceStart * this.pixelsPerDay;

            const isFullYear = anniversaryCount % 2 === 0;
            const anniversaryLabel = isFullYear
                ? `${anniversaryCount / 2} Year Anniversary`
                : `${Math.floor(anniversaryCount / 2)}.5 Year Anniversary`;

            this.allTimelineItems.push({
                date: new Date(globalAnniversaryDate),
                label: anniversaryLabel,
                type: 'anniversary',
                position: position + this.initialOffset
            });
        }
    }

    // Chrome scroll fix utility method
    forceScrollbarUpdate(): void {
        if (this.timelineContainer) {
            const container = this.timelineContainer.nativeElement;
            // Force Chrome to recalculate scrollbars
            const currentScroll = container.scrollLeft;
            container.style.display = 'none';
            container.offsetHeight; // Force reflow
            container.style.display = '';
            container.scrollLeft = currentScroll;
        }
    }

    // Virtual scrolling implementation
    private updateVisibleItems(): void {


        if (!this.timelineContainer) {
            // Initial load: show items that would be visible at scroll position 0
            // Since items start at initialOffset, we want to show items from that position
            const initialViewportEnd = this.initialOffset + 1200; // Assume ~1200px viewport width initially
            this.visibleTimelineItems = this.allTimelineItems.filter(item =>
                item.position <= initialViewportEnd
            ).slice(0, 100); // Increased from 50 to 100 for initial load
            return;
        }

        const containerElement = this.timelineContainer.nativeElement;
        let newScrollLeft = containerElement.scrollLeft;
        const newViewportWidth = containerElement.clientWidth;

        // Normalize scroll position to prevent negative values from causing issues
        newScrollLeft = Math.max(0, newScrollLeft);

        // Only recalculate if scroll position or viewport size changed significantly
        if (Math.abs(newScrollLeft - this.scrollLeft) < 10 &&
            Math.abs(newViewportWidth - this.viewportWidth) < 10 &&
            this.visibleTimelineItems.length > 0) { // Don't skip if no items are visible
            return; // Skip update if change is minimal
        }

        this.viewportWidth = newViewportWidth;
        this.scrollLeft = newScrollLeft;

        // Use much larger buffer to prevent items from disappearing
        const generousBufferSize = this.bufferSize * 4; // Increased from 2 to 4
        const bufferWidth = generousBufferSize * this.itemSize;

        // Calculate viewport bounds very generously
        let viewportStart: number;
        let viewportEnd: number;

        if (this.scrollLeft <= this.initialOffset) {
            // When at or near the beginning, always show items from position 0
            viewportStart = -bufferWidth;
            viewportEnd = this.scrollLeft + this.viewportWidth + bufferWidth;
        } else {
            // Normal scrolling - use generous buffers
            viewportStart = Math.max(-bufferWidth, this.scrollLeft - bufferWidth);
            viewportEnd = this.scrollLeft + this.viewportWidth + bufferWidth;
        }

        // Use more efficient filtering for frequent updates
        const newVisibleItems: TimelineItem[] = [];

        for (let i = 0; i < this.allTimelineItems.length; i++) {
            const item = this.allTimelineItems[i];
            const itemStart = item.position;
            const itemWidth = item.isGrouped ?
                ((item.groupIndex || 0) * 290 + 300) :
                300;
            const itemEnd = itemStart + itemWidth;

            if (itemEnd >= viewportStart && itemStart <= viewportEnd) {
                newVisibleItems.push(item);
            }

            // Remove early exit optimization to ensure we don't miss items
            // Better to check all items than risk missing some
        }

        // Multiple fallback strategies if no items are visible
        if (newVisibleItems.length === 0 && this.allTimelineItems.length > 0) {
            console.warn('No items visible in updateVisibleItems, applying fallbacks');

            // Strategy 1: Mega buffer around scroll position
            const megaBufferStart = this.scrollLeft - (this.viewportWidth * 2);
            const megaBufferEnd = this.scrollLeft + (this.viewportWidth * 3);

            for (let i = 0; i < this.allTimelineItems.length; i++) {
                const item = this.allTimelineItems[i];
                if (item.position >= megaBufferStart && item.position <= megaBufferEnd) {
                    newVisibleItems.push(item);
                }
            }

            // Strategy 2: Show first items if still empty
            if (newVisibleItems.length === 0) {
                newVisibleItems.push(...this.allTimelineItems.slice(0, 100));
            }
        }

        this.visibleTimelineItems = newVisibleItems;

        if (!environment.production) {
            console.log(`Regular update rendered ${this.visibleTimelineItems.length} timeline items`);
        }
    }

    // Synchronous version for immediate scroll updates (no Angular zone)
    private updateVisibleItemsSync(isInitial?: boolean): void {
        if (!this.timelineContainer) {
            return;
        }

        const containerElement = this.timelineContainer.nativeElement;
        let newScrollLeft = containerElement.scrollLeft;
        const newViewportWidth = containerElement.clientWidth;

        // Normalize scroll position to prevent negative values from causing issues
        newScrollLeft = Math.max(0, newScrollLeft);

        // Only recalculate if scroll position changed significantly
        if (Math.abs(newScrollLeft - this.scrollLeft) < 5 && isInitial == undefined) {
            return; // Skip update if change is very minimal during fast scrolling
        }

        this.viewportWidth = newViewportWidth;
        this.scrollLeft = newScrollLeft;

        // Use much larger buffer to prevent items from disappearing
        // Better to render too much than have things pop in and out
        const generousBufferSize = this.bufferSize * 1; // Increased from 2 to 6
        const bufferWidth = generousBufferSize * this.itemSize;

        // Calculate viewport bounds very generously
        // Always include items from the beginning when scrollLeft is small
        let viewportStart: number;
        let viewportEnd: number;

        if (this.scrollLeft <= this.initialOffset) {
            // When at or near the beginning, always show items from position 0
            viewportStart = -bufferWidth;
            viewportEnd = this.scrollLeft + this.viewportWidth + bufferWidth;
        } else {
            // Normal scrolling - use generous buffers
            viewportStart = Math.max(-bufferWidth, this.scrollLeft - bufferWidth);
            viewportEnd = this.scrollLeft + this.viewportWidth + bufferWidth;
        }

        // Fast filtering for immediate updates
        const newVisibleItems: TimelineItem[] = [];

        if (!environment.production) {
            console.log(`scroll: ${this.scrollLeft}, viewport: (${viewportStart}, ${viewportEnd}), initialOffset: ${this.initialOffset}`);
        }

        for (let i = 0; i < this.allTimelineItems.length; i++) {
            const item = this.allTimelineItems[i];
            const itemStart = item.position;

            // Calculate item end position more accurately
            const itemWidth = item.isGrouped ?
                ((item.groupIndex || 0) * 290 + 300) :
                300;
            const itemEnd = itemStart + itemWidth;

            // Very generous visibility check - include items that might be partially visible
            const isVisible = itemEnd >= viewportStart && itemStart <= viewportEnd;

            if (isVisible) {
                newVisibleItems.push(item);
            }
        }

        // Always ensure we have visible items - multiple fallback strategies
        if (newVisibleItems.length === 0 && this.allTimelineItems.length > 0) {
            console.warn('No items visible, applying fallback strategies');

            // Strategy 1: Show items around current scroll position with huge buffer
            const megaBufferStart = this.scrollLeft - (this.viewportWidth * 2);
            const megaBufferEnd = this.scrollLeft + (this.viewportWidth * 3);

            for (let i = 0; i < this.allTimelineItems.length; i++) {
                const item = this.allTimelineItems[i];
                if (item.position >= megaBufferStart && item.position <= megaBufferEnd) {
                    newVisibleItems.push(item);
                }
            }

            // Strategy 2: If still nothing, show first N items (beginning of timeline)
            if (newVisibleItems.length === 0) {
                console.warn('Mega buffer failed, showing first 50 items');
                newVisibleItems.push(...this.allTimelineItems.slice(0, 50));
            }

            // Strategy 3: If STILL nothing, show items around initialOffset
            if (newVisibleItems.length === 0) {
                console.warn('All strategies failed, showing items around initialOffset');
                for (let i = 0; i < this.allTimelineItems.length; i++) {
                    const item = this.allTimelineItems[i];
                    if (item.position >= (this.initialOffset - 1000) && item.position <= (this.initialOffset + 2000)) {
                        newVisibleItems.push(item);
                    }
                }
            }
        }

        this.visibleTimelineItems = newVisibleItems;

        // Remove the arbitrary limit - let it render more items if needed
        // The user prefers too many items over items disappearing

        if (!environment.production) {
            console.log(`Rendered ${this.visibleTimelineItems.length} timeline items`);
        }
    }

    private setupScrollListener(): void {
        if (this.timelineContainer) {
            this.scrollSubscription = new Subscription();

            // Use immediate + throttled scroll updates for smooth rendering during scroll
            this.ngZone.runOutsideAngular(() => {
                let scrollTimeout: number;
                let lastUpdateTime = 0;
                const throttleDelay = 8; // ~120fps for immediate updates during scroll

                const scrollHandler = () => {
                    const now = performance.now();

                    // Immediate update if enough time has passed (throttled to ~120fps)
                    if (now - lastUpdateTime >= throttleDelay) {
                        lastUpdateTime = now;
                        // Update visible items outside Angular zone for better performance
                        this.updateVisibleItemsSync();
                        // Trigger change detection manually
                        this.cdr.detectChanges();
                    }

                    // Also schedule a cleanup update after scrolling stops
                    clearTimeout(scrollTimeout);
                    scrollTimeout = window.setTimeout(() => {
                        this.ngZone.run(() => {
                            this.updateVisibleItems();
                            this.cdr.detectChanges();
                        });
                    }, 50); // Cleanup after 50ms of no scrolling
                };

                this.timelineContainer.nativeElement.addEventListener('scroll', scrollHandler, { passive: true });

                if (this.scrollSubscription) {
                    this.scrollSubscription.add(() => {
                        this.timelineContainer.nativeElement.removeEventListener('scroll', scrollHandler);
                        clearTimeout(scrollTimeout);
                    });
                }
            });
        }
    }

    private checkMobileBreakpoint(): void {
        const wasIsMobile = this.isMobile;
        this.isMobile = window.innerWidth < this.mobileBreakpoint;

        if (wasIsMobile !== this.isMobile) {
            this.cdr.detectChanges();
        }
    }

    private checkCompactMode(): void {
        const wasCompactMode = this.isCompactMode;
        this.isCompactMode = window.innerHeight < this.compactModeHeightThreshold;

        if (wasCompactMode !== this.isCompactMode) {
            this.cdr.detectChanges();
        }
    }

    eventTypeToLabel(type: EventType | undefined): string {
        switch (type) {
            case EventType.CHARACTER_BANNER:
                return 'Character Banner';
            case EventType.SUPPORT_CARD_BANNER:
                return 'Support Card Banner';
            case EventType.PAID_BANNER:
                return 'Paid Banner';
            case EventType.STORY_EVENT:
                return 'Story Event';
            case EventType.CHAMPIONS_MEETING:
                return 'Champions Meeting';
            case EventType.LEGEND_RACE:
                return 'Legend Race';
            default:
                return 'Unknown Event';
        }
    }


    // Debug method for timeline item clicks
    onTimelineItemClick(item: TimelineItem): void {
        if (!environment.production) {
            console.log('Item clicked:', item);
        }
    }

    onLinkClick(event: MouseEvent): void {
        if (this.hasDragged) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    // Format date to ensure consistent display in user's local timezone
    formatDate(item: TimelineItem): string {
        if (!item.date) return '';

        // Define reusable date formatting options (displays in user's local timezone)
        const dateOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };

        // Compact format for date ranges (no year if same year)
        const compactDateOptions: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric'
        };

        const formatSingleDate = (date: Date): string => {
            return date.toLocaleDateString('en-US', dateOptions);
        };

        const formatDateRange = (startDate: Date, endDate: Date, isUnconfirmed = false): string => {
            const prefix = isUnconfirmed ? '~' : '';

            // If same year, use compact format for start date
            if (startDate.getFullYear() === endDate.getFullYear()) {
                const startStr = startDate.toLocaleDateString('en-US', compactDateOptions);
                const endStr = endDate.toLocaleDateString('en-US', dateOptions);
                return `${prefix}${startStr} – ${endStr}`; // Using en dash (–) instead of "to"
            }

            // Different years, show full dates
            return `${prefix}${formatSingleDate(startDate)} – ${formatSingleDate(endDate)}`;
        };

        // Single date items
        const singleDateTypes = ['milestone', 'today', 'year', 'anniversary'] as const;
        if (singleDateTypes.includes(item.type as any)) {
            return formatSingleDate(item.date);
        }

        // Event items with potential date ranges
        if (item.eventData) {
            const isUnconfirmed = !item.eventData.isConfirmed;

            if (item.eventData.estimatedEndDate) {
                return formatDateRange(item.date, item.eventData.estimatedEndDate, isUnconfirmed);
            }

            // Single date event
            const prefix = isUnconfirmed ? '~' : '';
            return `${prefix}${formatSingleDate(item.date)}`;
        }

        // Fallback
        return formatSingleDate(item.date);
    }

    // Alternative: Add a helper method for relative date display
    getRelativeDate(date: Date): string {
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
        if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

        return '';
    }

    // Alternative: Method to format duration between dates
    formatDuration(startDate: Date, endDate: Date): string {
        const diffTime = endDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return '';
        if (diffDays === 1) return '(1 day)';
        if (diffDays <= 7) return `(${diffDays} days)`;
        if (diffDays <= 14) return `(${Math.round(diffDays / 7)} week${diffDays > 7 ? 's' : ''})`;
        if (diffDays <= 30) return `(${Math.round(diffDays / 7)} weeks)`;

        return `(${Math.round(diffDays / 30)} month${diffDays > 30 ? 's' : ''})`;
    }

    // Dynamic scaling based on viewport height
    private setupResizeObserver(): void {
        if (!this.timelineContainer || typeof ResizeObserver === 'undefined') {
            return;
        }

        this.resizeObserver = new ResizeObserver(() => {
            this.ngZone.run(() => {
                this.calculateDynamicScale();
                this.cdr.detectChanges();
            });
        });

        this.resizeObserver.observe(this.timelineContainer.nativeElement);
    }

    private calculateDynamicScale(): void {
        if (!this.timelineContainer || this.isMobile) {
            this.cardScale = 1;
            this.cardVerticalOffsetBottom = 60;
            this.cardVerticalOffsetTop = 60;
            return;
        }

        const viewportHeight = window.innerHeight;

        const minHeight = 400;
        const maxHeight = 900;
        const minScale = 0.35;
        const maxScale = 1.0;

        const normalizedHeight = Math.max(0, Math.min(1, (viewportHeight - minHeight) / (maxHeight - minHeight)));
        this.cardScale = minScale + (normalizedHeight * (maxScale - minScale));

        const baseOffsetBottom = 60;
        this.cardVerticalOffsetBottom = baseOffsetBottom * this.cardScale;

        const baseOffsetTop = 60;
        this.cardVerticalOffsetTop = baseOffsetTop / this.cardScale;

        this.cardTransformOffset = 25 * this.cardScale;

        if (!environment.production) {
            console.log(`Viewport height: ${viewportHeight}px, Scale: ${this.cardScale.toFixed(2)}, Bottom offset: ${this.cardVerticalOffsetBottom.toFixed(1)}%, Top offset: ${this.cardVerticalOffsetTop.toFixed(1)}%`);
        }
    }

    getTransformOffset(side?: 'top' | 'bottom'): number {
        if (side === 'top') {
            return -25 * this.cardScale + ((1 / this.cardScale) - 1) * 100;
        } else {
            return 28 * this.cardScale + ((1 / this.cardScale) - 1) / 100;
        }
    }
}