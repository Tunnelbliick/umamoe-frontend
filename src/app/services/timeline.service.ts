import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TimelineEvent, EventType, TimelineFilters, ReleaseCalculation, TimelineConfig, CharacterBanner, SupportBanner, PaidBanner, StoryEvent, ChampionsMeeting, LegendRace } from '../models/timeline.model';
import { HttpClient } from '@angular/common/http';
import {
  getAllCharacterBanners,
  getAllSupportBanners,
  getAllPaidBanners,
  getAllStoryEvents,
  getAllChampionsMeetings,
  getAllLegendRaces
} from '../data/timeline-data';

// ============================================
// CONFIRMED GLOBAL RELEASE DATES
// Add new confirmed dates here as they are announced
// All dates are in UTC
// ============================================

// Character Banner confirmed dates (banner image -> global release date)
const CONFIRMED_CHARACTER_BANNER_DATES = new Map<string, Date>([
  ['2021_30004.png', new Date(Date.UTC(2025, 5, 27))], // TM Opera O - launch day (June 27, 2025)
  ['2021_30006.png', new Date(Date.UTC(2025, 6, 2))], // Mihono Bourbon (July 2, 2025)
  ['2021_30008.png', new Date(Date.UTC(2025, 6, 10))], // Biwa Hayahide (July 10, 2025)
  ['2021_30010.png', new Date(Date.UTC(2025, 6, 16))], // Tokai Teio (July 16, 2025)
  ['2021_30012.png', new Date(Date.UTC(2025, 6, 27))], // Banner (July 27, 2025)
  ['2021_30014.png', new Date(Date.UTC(2025, 7, 3))], // Banner (August 3, 2025)
  ['2021_30016.png', new Date(Date.UTC(2025, 7, 11))], // Banner (August 11, 2025)
  ['2021_30018.png', new Date(Date.UTC(2025, 7, 20))], // Banner (August 20, 2025)
  ['2021_30020.png', new Date(Date.UTC(2025, 7, 28))], // Banner (August 28, 2025)
  ['2021_30022.png', new Date(Date.UTC(2025, 8, 7))], // Banner (September 7, 2025)
  ['2021_30024.png', new Date(Date.UTC(2025, 8, 17))], // Banner (September 17, 2025)
  ['2021_30026.png', new Date(Date.UTC(2025, 8, 21))], // Banner (September 21, 2025)
  // Add more confirmed character banner dates here as they're announced
]);

// Support Banner confirmed dates (banner image -> global release date)
const CONFIRMED_SUPPORT_BANNER_DATES = new Map<string, Date>([
  ['2021_30005.png', new Date(Date.UTC(2025, 5, 27))], // TM Opera O support - launch day
  ['2021_30007.png', new Date(Date.UTC(2025, 6, 2))], // Mihono Bourbon support
  ['2021_30009.png', new Date(Date.UTC(2025, 6, 10))], // Biwa Hayahide support
  ['2021_30011.png', new Date(Date.UTC(2025, 6, 16))], // Tokai Teio support
  ['2021_30013.png', new Date(Date.UTC(2025, 6, 27))], // Support
  ['2021_30015.png', new Date(Date.UTC(2025, 7, 3))], // Support
  ['2021_30017.png', new Date(Date.UTC(2025, 7, 11))], // Support
  ['2021_30019.png', new Date(Date.UTC(2025, 7, 20))], // Support
  ['2021_30021.png', new Date(Date.UTC(2025, 7, 28))], // Support
  ['2021_30023.png', new Date(Date.UTC(2025, 8, 7))], // Support
  ['2021_30025.png', new Date(Date.UTC(2025, 8, 17))], // Support
  ['2021_30027.png', new Date(Date.UTC(2025, 8, 21))], // Support
  // Add more confirmed support banner dates here as they're announced
]);

// Story Event confirmed dates (banner image -> global release date)
const CONFIRMED_STORY_EVENT_DATES = new Map<string, Date>([
  ['03_chase_your_dreams_banner.png', new Date(Date.UTC(2025, 5, 27))],
  ['03_brand_new_friend_banner.png', new Date(Date.UTC(2025, 6, 16))],
  ['05_blooming_maidens_june_pride_banner.png', new Date(Date.UTC(2025, 7, 28))],
  ['06_fantasy_world_uma_nest_banner.png', new Date(Date.UTC(2025, 8, 21))],
]);

// Paid Banner confirmed dates (banner image -> global release date)
const CONFIRMED_PAID_BANNER_DATES = new Map<string, Date>([
  // ['50003.png', new Date(Date.UTC(2025, 9, 18))], // TM Opera O paid banner (October 18, 2025)
  //  ['50004.png', new Date(Date.UTC(2025, 9, 18))], // Mihono Bourbon paid banner

  // Add confirmed paid banner dates here as they're announced
]);

// Champions Meeting confirmed dates (index -> global release date)
// Use format: champions_meeting_0, champions_meeting_1, etc.
const CONFIRMED_CHAMPIONS_MEETING_DATES = new Map<string, Date>([
  ['champions_meeting_0', new Date(Date.UTC(2025, 7, 17))], // First Champions Meeting (August 17, 2025)
  ['champions_meeting_1', new Date(Date.UTC(2025, 8, 7))], // Second Champions Meeting
  // Add more confirmed champions meeting dates here as they're announced
]);

// Legend Race confirmed dates (index -> global release date)
// Use format: legend_race_0, legend_race_1, etc.
const CONFIRMED_LEGEND_RACE_DATES = new Map<string, Date>([
  ['legend_race_0', new Date(Date.UTC(2025, 6, 6))], // First Legend Race (July 6, 2025)
  ['legend_race_1', new Date(Date.UTC(2025, 6, 27))], // Second Legend Race (July 27, 2025)
  ['legend_race_2', new Date(Date.UTC(2025, 7, 21))], // Third Legend Race (August 21, 2025)
  ['legend_race_3', new Date(Date.UTC(2025, 8, 11))], // Fourth Legend Race (September 11, 2025)
  // Add more confirmed legend race dates here as they're announced
]);

// ============================================
// TIMELINE CONFIGURATION
// ============================================

const JP_LAUNCH_DATE = new Date(Date.UTC(2021, 1, 24)); // JP launch date - February 24, 2021 UTC
const GLOBAL_LAUNCH_DATE = new Date(Date.UTC(2025, 5, 26)); // Global launch date - June 26, 2025 UTC

// Fallback acceleration rate if we don't have enough confirmed dates
const FALLBACK_ACCELERATION_RATE = 1.57;

// Tweak factor to adjust acceleration rate (1.0 = no change, 0.8 = slower, 1.2 = faster)
const ACCELERATION_TWEAK_FACTOR = 0.85;

// Helper function to parse date strings as UTC
function parseAsUTC(dateString: string): Date {
  // Handle special case for "None"
  if (dateString === "None") {
    return JP_LAUNCH_DATE;
  }

  // Parse the date string and create a UTC date
  const parts = dateString.split(/[-T:]/);
  if (parts.length >= 3) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
    const day = parseInt(parts[2]);
    const hour = parts[3] ? parseInt(parts[3]) : 0;
    const minute = parts[4] ? parseInt(parts[4]) : 0;
    const second = parts[5] ? parseInt(parts[5].split('.')[0]) : 0;

    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  // Fallback to regular parsing if format is unexpected
  const date = new Date(dateString);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

// Helper function to add days to a UTC date
function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// Helper function to get days difference between two UTC dates
function getDaysDifferenceUTC(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

@Injectable({
  providedIn: 'root'
})
export class TimelineService {
  private timelineConfig: TimelineConfig = {
    calculation: {
      jpLaunchDate: JP_LAUNCH_DATE,
      globalLaunchDate: GLOBAL_LAUNCH_DATE,
      baseDelayDays: getDaysDifferenceUTC(JP_LAUNCH_DATE, GLOBAL_LAUNCH_DATE),
      catchupRate: FALLBACK_ACCELERATION_RATE,
      accelerationStart: GLOBAL_LAUNCH_DATE
    },
    confirmedEvents: [],
    lastUpdated: new Date()
  };

  private eventsSubject = new BehaviorSubject<TimelineEvent[]>([]);
  public events$ = this.eventsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadTimelineData();
  }

  /**
   * Calculate acceleration rate based on the last month of confirmed dates
   * This gives us the most recent and accurate acceleration pattern
   */
  private calculateRecentAccelerationRate(confirmedDates: Array<{ jp: Date, global: Date }>): number {
    if (confirmedDates.length < 2) {
      return FALLBACK_ACCELERATION_RATE;
    }

    // Sort by global date
    const sorted = [...confirmedDates].sort((a, b) => a.global.getTime() - b.global.getTime());
    
    // Get the most recent confirmed date
    const mostRecent = sorted[sorted.length - 1];
    
    // Find dates from the last 30 days before the most recent
    const thirtyDaysAgo = new Date(mostRecent.global);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    
    const lastMonthDates = sorted.filter(d => 
      d.global >= thirtyDaysAgo && d.global <= mostRecent.global
    );
    
    // If we don't have enough dates in the last month, use the last 3-4 confirmed dates
    const datesToUse = lastMonthDates.length >= 2 ? lastMonthDates : sorted.slice(-4);
    
    if (datesToUse.length < 2) {
      return FALLBACK_ACCELERATION_RATE;
    }

    // Calculate the average acceleration rate from these recent dates
    let totalJpDays = 0;
    let totalGlobalDays = 0;
    
    for (let i = 1; i < datesToUse.length; i++) {
      const jpDiff = getDaysDifferenceUTC(datesToUse[i - 1].jp, datesToUse[i].jp);
      const globalDiff = getDaysDifferenceUTC(datesToUse[i - 1].global, datesToUse[i].global);
      
      if (globalDiff > 0) { // Avoid division by zero
        totalJpDays += jpDiff;
        totalGlobalDays += globalDiff;
      }
    }
    
    if (totalGlobalDays === 0) {
      return FALLBACK_ACCELERATION_RATE;
    }
    
    const rate = totalJpDays / totalGlobalDays;
    
    // Apply tweak factor to slow down or speed up the acceleration
    const adjustedRate = rate * ACCELERATION_TWEAK_FACTOR;
    
    // Clamp to reasonable values (between 1.2x and 2.0x acceleration)
    return Math.min(Math.max(adjustedRate, 1.2), 2.0);
  }

  /**
   * Calculate global release date using confirmed dates for extrapolation
   * Uses only the last month of confirmed dates for more accurate predictions
   * All calculations are done in UTC
   */
  private calculateGlobalDate(jpDate: Date, confirmedDates: Array<{ jp: Date, global: Date }>): Date {
    // Sort confirmed dates by JP date
    const sortedDates = confirmedDates.sort((a, b) => a.jp.getTime() - b.jp.getTime());

    if (sortedDates.length === 0) {
      // No confirmed dates, use fallback acceleration rate
      return this.calculateGlobalDateWithFallback(jpDate);
    }

    // Calculate the recent acceleration rate based on last month's data
    const recentRate = this.calculateRecentAccelerationRate(sortedDates);

    // Find the two closest confirmed dates (before and after jpDate)
    let before: { jp: Date, global: Date } | null = null;
    let after: { jp: Date, global: Date } | null = null;

    for (let i = 0; i < sortedDates.length; i++) {
      if (sortedDates[i].jp.getTime() <= jpDate.getTime()) {
        before = sortedDates[i];
      } else if (!after) {
        after = sortedDates[i];
        break;
      }
    }

    // Case 1: We have confirmed dates on both sides - interpolate
    if (before && after) {
      const jpRange = after.jp.getTime() - before.jp.getTime();
      const globalRange = after.global.getTime() - before.global.getTime();
      const jpProgress = jpDate.getTime() - before.jp.getTime();

      const ratio = globalRange / jpRange;
      const globalProgress = jpProgress * ratio;

      return new Date(before.global.getTime() + globalProgress);
    }

    // Case 2: We only have dates before - extrapolate forward using recent rate
    if (before) {
      const jpDaysAfter = getDaysDifferenceUTC(before.jp, jpDate);
      const globalDaysAfter = jpDaysAfter / recentRate;

      return addDaysUTC(before.global, globalDaysAfter);
    }

    // Case 3: We only have dates after - extrapolate backward using recent rate
    if (after) {
      const jpDaysBefore = getDaysDifferenceUTC(jpDate, after.jp);
      const globalDaysBefore = jpDaysBefore / recentRate;

      return addDaysUTC(after.global, -globalDaysBefore);
    }

    // Fallback to simple calculation
    return this.calculateGlobalDateWithFallback(jpDate);
  }

  /**
   * Fallback calculation using fixed acceleration rate
   * All calculations are done in UTC
   */
  private calculateGlobalDateWithFallback(jpDate: Date): Date {
    const daysSinceJpLaunch = getDaysDifferenceUTC(JP_LAUNCH_DATE, jpDate);
    const adjustedRate = FALLBACK_ACCELERATION_RATE * ACCELERATION_TWEAK_FACTOR;
    const adjustedDays = Math.floor(daysSinceJpLaunch / adjustedRate);

    return addDaysUTC(GLOBAL_LAUNCH_DATE, adjustedDays);
  }

  /**
   * Get all confirmed dates for a specific event type
   * Also combines with character/support banner dates for better extrapolation
   */
  private getConfirmedDatesForType(type: 'character' | 'support' | 'story' | 'paid' | 'champions' | 'legend', banners?: any[]): Array<{ jp: Date, global: Date }> {
    const confirmedDates: Array<{ jp: Date, global: Date }> = [];

    let dateMap: Map<string, Date>;

    switch (type) {
      case 'character':
        dateMap = CONFIRMED_CHARACTER_BANNER_DATES;
        break;
      case 'support':
        dateMap = CONFIRMED_SUPPORT_BANNER_DATES;
        break;
      case 'story':
        dateMap = CONFIRMED_STORY_EVENT_DATES;
        break;
      case 'paid':
        dateMap = CONFIRMED_PAID_BANNER_DATES;
        break;
      case 'champions':
        dateMap = CONFIRMED_CHAMPIONS_MEETING_DATES;
        break;
      case 'legend':
        dateMap = CONFIRMED_LEGEND_RACE_DATES;
        break;
      default:
        return [];
    }

    // Build array of confirmed JP->Global date mappings
    if (banners) {
      banners.forEach((banner, index) => {
        let key: string;
        let jpDate: Date | null = null;

        if (type === 'champions') {
          // Use indexed key for champions meetings
          key = `champions_meeting_${index}`;
          jpDate = parseAsUTC(banner.start_date);
        } else if (type === 'legend') {
          // Use indexed key for legend races
          key = `legend_race_${index}`;
          jpDate = parseAsUTC(banner.start_date);
        } else {
          // For other types, use the image name as key
          key = banner.image;
          if (banner.start_date_string === "None") {
            jpDate = JP_LAUNCH_DATE;
          } else if (banner.start_date) {
            jpDate = parseAsUTC(banner.start_date);
          }
        }

        const globalDate = dateMap.get(key);
        if (globalDate && jpDate && !isNaN(jpDate.getTime())) {
          confirmedDates.push({ jp: jpDate, global: globalDate });
        }
      });
    }

    // For non-banner events (story, champions, legend), also include character banner dates
    // This gives us more data points for accurate extrapolation
    if (type === 'story' || type === 'champions' || type === 'legend') {
      const characterBanners = getAllCharacterBanners();
      if (characterBanners) {
        characterBanners.forEach(banner => {
          const globalDate = CONFIRMED_CHARACTER_BANNER_DATES.get(banner.image);
          if (globalDate) {
            let jpDate: Date;
            if (banner.start_date_string === "None") {
              jpDate = JP_LAUNCH_DATE;
            } else {
              jpDate = parseAsUTC(banner.start_date);
            }
            if (!isNaN(jpDate.getTime())) {
              confirmedDates.push({ jp: jpDate, global: globalDate });
            }
          }
        });
      }
    }

    return confirmedDates;
  }

  private async loadTimelineData(): Promise<void> {
    try {
      // Get all event data from bundled modules
      const characterBanners = getAllCharacterBanners();
      const supportBanners = getAllSupportBanners();
      const paidBanners = getAllPaidBanners();
      const storyEvents = getAllStoryEvents();
      const championsMeetings = getAllChampionsMeetings();
      const legendRaces = getAllLegendRaces();

      const events: TimelineEvent[] = [];

      // Process character banners
      if (characterBanners) {
        const characterEvents = this.processCharacterBanners(characterBanners);
        events.push(...characterEvents);
      }

      // Process support banners
      if (supportBanners) {
        const supportEvents = this.processSupportBanners(supportBanners);
        events.push(...supportEvents);
      }

      // Process paid banners
      if (paidBanners) {
        const paidEvents = this.processPaidBanners(paidBanners);
        events.push(...paidEvents);
      }

      // Process story events
      if (storyEvents) {
        const storyEventItems = this.processStoryEvents(storyEvents);
        events.push(...storyEventItems);
      }

      // Process champions meetings
      if (championsMeetings) {
        const championsMeetingItems = this.processChampionsMeetings(championsMeetings);
        events.push(...championsMeetingItems);
      }

      // Process legend races
      if (legendRaces) {
        const legendRaceItems = this.processLegendRaces(legendRaces);
        events.push(...legendRaceItems);
      }

      // Sort all events by date
      events.sort((a, b) => {
        const dateA = a.globalReleaseDate || a.jpReleaseDate;
        const dateB = b.globalReleaseDate || b.jpReleaseDate;
        return dateA.getTime() - dateB.getTime();
      });

      this.eventsSubject.next(events);
    } catch (error) {
      console.error('Failed to load timeline data:', error);
      // Fallback to empty events
      this.eventsSubject.next([]);
    }
  }

  private processCharacterBanners(banners: CharacterBanner[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Get confirmed dates for interpolation
    const confirmedDates = this.getConfirmedDatesForType('character', banners);

    // Process character banners
    const processedBanners = banners
      .map(banner => this.processBannerDates(banner))
      .filter(banner => banner.processedStartDate) // Filter out invalid dates
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());

    processedBanners.forEach((banner, index) => {
      // Extract character names from pickup_characters
      const characters = banner.pickup_characters.map(char => {
        // Extract character name from string like "Special Week (Original)[New,0.3334% rate]"
        const match = char.match(/^([^(]+)/);
        return match ? match[1].trim() : char;
      });

      // Check if this banner has a confirmed date
      const confirmedGlobalDate = CONFIRMED_CHARACTER_BANNER_DATES.get(banner.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(banner.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;

      const bannerid = banner.image.split('_').pop()?.replace('.png', '') || '';
      const duration = this.calculateBannerDuration(banner.processedStartDate!, banner.processedEndDate!);

      const event: TimelineEvent = {
        id: `banner-${banner.image.replace('.png', '')}`,
        type: EventType.CHARACTER_BANNER,
        title: characters.length > 1 ? `${characters[0]} + ${characters.length - 1} more` : characters[0] || 'Character Banner',
        description: `Character banner featuring: ${characters.join(', ')}`,
        jpReleaseDate: banner.processedStartDate!,
        globalReleaseDate: globalDate,
        estimatedEndDate: this.calculateEndDate(globalDate, duration),
        isConfirmed: isConfirmed,
        bannerDuration: duration,
        tags: ['character-banner'],
        relatedCharacters: characters,
        imagePath: banner.image_path,
        gametoraURL: `https://gametora.com/umamusume/gacha/history?server=ja&year=${banner.year}&type=char#${bannerid}`
      };

      events.push(event);
    });

    return events;
  }

  private processSupportBanners(banners: SupportBanner[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Get confirmed dates for interpolation
    const confirmedDates = this.getConfirmedDatesForType('support', banners);

    // Process support banners
    const processedBanners = banners
      .map(banner => this.processSupportBannerDates(banner))
      .filter(banner => banner.processedStartDate) // Filter out invalid dates
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());

    processedBanners.forEach((banner, index) => {
      // Extract support card names from pickup_characters
      const supportCards = banner.pickup_characters.map(char => {
        // Extract support card name from string like "Admire Vega (SSR power)[New,0.75% rate]"
        const match = char.match(/^([^(]+)/);
        return match ? match[1].trim() : char;
      });

      const confirmedGlobalDate = CONFIRMED_SUPPORT_BANNER_DATES.get(banner.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(banner.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;

      const bannerid = banner.image.split('_').pop()?.replace('.png', '') || '';
      const duration = this.calculateBannerDuration(banner.processedStartDate!, banner.processedEndDate!) - 1;

      const event: TimelineEvent = {
        id: `support-banner-${banner.image.replace('.png', '')}`,
        type: EventType.SUPPORT_CARD_BANNER,
        title: supportCards.length > 1 ? `${supportCards[0]} + ${supportCards.length - 1} more` : supportCards[0] || 'Support Card Banner',
        description: `Support card banner featuring: ${supportCards.join(', ')}`,
        jpReleaseDate: banner.processedStartDate!,
        globalReleaseDate: globalDate,
        estimatedEndDate: this.calculateEndDate(globalDate, duration),
        isConfirmed: isConfirmed,
        bannerDuration: duration,
        tags: ['support-banner'],
        relatedSupportCards: supportCards,
        imagePath: `assets/images/support/banner/${banner.image}`, // Support banners don't have image paths in the current data structure
        gametoraURL: `https://gametora.com/umamusume/gacha/history?server=ja&year=${banner.year}&type=sup#${bannerid}`
      };

      events.push(event);
    });

    return events;
  }

  private processStoryEvents(storyEvents: StoryEvent[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Get confirmed dates for interpolation
    const confirmedDates = this.getConfirmedDatesForType('story', storyEvents);

    const processedEvents = storyEvents
      .map(event => this.processEventDates(event))
      .filter(event => event.processedStartDate) // Filter out invalid dates
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());

    processedEvents.forEach(event => {
      const storyEvent = event as StoryEvent & { processedStartDate?: Date; processedEndDate?: Date };
      const confirmedGlobalDate = CONFIRMED_STORY_EVENT_DATES.get(storyEvent.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(event.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;

      const duration = this.calculateBannerDuration(event.processedStartDate!, event.processedEndDate!);

      const timelineEvent: TimelineEvent = {
        id: `story-event-${storyEvent.image.replace('.png', '')}`,
        type: EventType.STORY_EVENT,
        title: storyEvent.event_name,
        description: `Story Event: ${storyEvent.event_name}`,
        jpReleaseDate: event.processedStartDate!,
        globalReleaseDate: globalDate,
        estimatedEndDate: this.calculateEndDate(globalDate, duration),
        isConfirmed: isConfirmed,
        bannerDuration: duration,
        tags: ['event', 'story-event'],
        imagePath: `assets/images/story/${storyEvent.image}`
      };

      events.push(timelineEvent);
    });

    return events;
  }

  private processChampionsMeetings(championsMeetings: ChampionsMeeting[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Sort championships by JP date to ensure consistent indexing
    const sortedChampionsMeetings = [...championsMeetings]
      .map(event => this.processEventDates(event))
      .filter(event => event.processedStartDate)
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());

    // Get confirmed dates for interpolation
    const confirmedDates = this.getConfirmedDatesForType('champions', sortedChampionsMeetings);

    sortedChampionsMeetings.forEach((event, index) => {
      const championsEvent = event as ChampionsMeeting & { processedStartDate?: Date; processedEndDate?: Date };

      // Check for confirmed date using the index
      const indexKey = `champions_meeting_${index}`;
      const confirmedGlobalDate = CONFIRMED_CHAMPIONS_MEETING_DATES.get(indexKey);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(event.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;

      const duration = this.calculateBannerDuration(event.processedStartDate!, event.processedEndDate!);

      const timelineEvent: TimelineEvent = {
        id: `champions-meeting-${index}`,
        type: EventType.CHAMPIONS_MEETING,
        title: `Champions Meeting: ${championsEvent.name}`,
        description: `${championsEvent.track}<br>${championsEvent.distance || ''}</br>${championsEvent.conditions || ''}`,
        jpReleaseDate: event.processedStartDate!,
        estimatedEndDate: this.calculateEndDate(globalDate, duration),
        globalReleaseDate: globalDate,
        isConfirmed: isConfirmed,
        bannerDuration: duration,
        tags: ['champions-meeting', championsEvent.name.toLowerCase()],
        // No specific image for Champions Meeting yet
      };

      events.push(timelineEvent);
    });

    return events;
  }

  private processLegendRaces(legendRaces: LegendRace[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Sort legend races by JP date to ensure consistent indexing
    const sortedLegendRaces = [...legendRaces]
      .map(event => this.processEventDates(event))
      .filter(event => event.processedStartDate)
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());

    // Get confirmed dates for interpolation
    const confirmedDates = this.getConfirmedDatesForType('legend', sortedLegendRaces);

    sortedLegendRaces.forEach((event, index) => {
      const legendEvent = event as LegendRace & { processedStartDate?: Date; processedEndDate?: Date };

      // Check for confirmed date using the index
      const indexKey = `legend_race_${index}`;
      const confirmedGlobalDate = CONFIRMED_LEGEND_RACE_DATES.get(indexKey);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(event.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;

      // Use the first boss image if available, otherwise no image
      let imagePath: string | undefined;
      if (legendEvent.bosses && legendEvent.bosses.length > 0 && legendEvent.bosses[0].image) {
        imagePath = `assets/images/legend/boss/${legendEvent.bosses[0].image}`;
      }

      let bossImages: string[] = [];
      legendEvent.bosses?.forEach(boss => {
        if (boss.image) {
          bossImages.push(`assets/images/legend/boss/${boss.image}`);
        }
      });

      const duration = this.calculateBannerDuration(event.processedStartDate!, event.processedEndDate!);

      const timelineEvent: TimelineEvent = {
        id: `legend-race-${index}`,
        type: EventType.LEGEND_RACE,
        title: legendEvent.race_name,
        description: legendEvent.course,
        jpReleaseDate: event.processedStartDate!,
        globalReleaseDate: globalDate,
        estimatedEndDate: this.calculateEndDate(globalDate, duration),
        isConfirmed: isConfirmed,
        bannerDuration: duration,
        tags: ['event', 'legend-race'],
        relatedCharacters: bossImages,
        imagePath: imagePath
      };

      events.push(timelineEvent);
    });

    return events;
  }

  private processPaidBanners(banners: PaidBanner[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Get confirmed dates for interpolation
    const confirmedDates = this.getConfirmedDatesForType('paid', banners);

    // Process paid banners
    const processedBanners = banners
      .map(banner => this.processPaidBannerDates(banner))
      .filter(banner => banner.processedStartDate) // Filter out invalid dates
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());

    processedBanners.forEach((banner, index) => {
      // Extract character names from pickup_characters if available
      const characters = banner.pickup_characters?.map(char => {
        // Extract character name from string like "Special Week (Original)[New,0.3334% rate]"
        const match = char.match(/^([^(]+)/);
        return match ? match[1].trim() : char;
      }) || [];

      const confirmedGlobalDate = CONFIRMED_PAID_BANNER_DATES.get(banner.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(banner.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;

      const duration = banner.processedEndDate ?
        this.calculateBannerDuration(banner.processedStartDate!, banner.processedEndDate!) :
        14;

      const event: TimelineEvent = {
        id: `paid-banner-${banner.image.replace('.png', '')}`,
        type: EventType.PAID_BANNER,
        title: characters.length > 0 ?
          (characters.length > 1 ? `${characters[0]} + ${characters.length - 1} more` : characters[0]) :
          'Paid Banner',
        description: characters.length > 0 ?
          `Paid banner featuring: ${characters.join(', ')}` :
          'Paid banner',
        jpReleaseDate: banner.processedStartDate!,
        estimatedEndDate: this.calculateEndDate(globalDate, duration),
        globalReleaseDate: globalDate,
        isConfirmed: isConfirmed,
        bannerDuration: duration,
        tags: ['paid-banner'],
        relatedCharacters: characters,
        imagePath: `assets/images/paid/banner/${banner.image}`
      };

      events.push(event);
    });

    return events;
  }

  // Helper methods for processing dates - all use UTC
  private processBannerDates(banner: CharacterBanner): CharacterBanner & { processedStartDate?: Date; processedEndDate?: Date } {
    const processed = { ...banner } as CharacterBanner & { processedStartDate?: Date; processedEndDate?: Date };

    // Handle the special case where start_date_string is "None" (game release)
    if (banner.start_date_string === "None") {
      processed.processedStartDate = JP_LAUNCH_DATE; // Already in UTC
    } else {
      // Parse the start_date as UTC
      processed.processedStartDate = parseAsUTC(banner.start_date);
    }

    // Parse end_date as UTC
    processed.processedEndDate = parseAsUTC(banner.end_date);

    return processed;
  }

  private calculateBannerDuration(startDate: Date, endDate: Date): number {
    return getDaysDifferenceUTC(startDate, endDate);
  }

  private processSupportBannerDates(banner: SupportBanner): SupportBanner & { processedStartDate?: Date; processedEndDate?: Date } {
    const processed = { ...banner } as SupportBanner & { processedStartDate?: Date; processedEndDate?: Date };

    // Parse start_date as UTC
    processed.processedStartDate = parseAsUTC(banner.start_date);

    // Parse end_date as UTC
    processed.processedEndDate = parseAsUTC(banner.end_date);

    return processed;
  }

  private processEventDates(event: StoryEvent | ChampionsMeeting | LegendRace): (StoryEvent | ChampionsMeeting | LegendRace) & { processedStartDate?: Date; processedEndDate?: Date } {
    const processed = { ...event } as (StoryEvent | ChampionsMeeting | LegendRace) & { processedStartDate?: Date; processedEndDate?: Date };

    // Parse start_date as UTC
    processed.processedStartDate = parseAsUTC(event.start_date);

    // Parse end_date as UTC
    processed.processedEndDate = parseAsUTC(event.end_date);

    return processed;
  }

  private processPaidBannerDates(banner: PaidBanner): PaidBanner & { processedStartDate?: Date; processedEndDate?: Date } {
    const processed = { ...banner } as PaidBanner & { processedStartDate?: Date; processedEndDate?: Date };

    // Handle empty start_date by using global release date
    if (!banner.start_date || banner.start_date.trim() === '') {
      processed.processedStartDate = GLOBAL_LAUNCH_DATE; // Already in UTC
    } else {
      // Parse the start_date as UTC
      processed.processedStartDate = parseAsUTC(banner.start_date);
    }

    // Parse end_date if available as UTC
    if (banner.end_date && banner.end_date.trim() !== '') {
      processed.processedEndDate = parseAsUTC(banner.end_date);
    }

    return processed;
  }

  generateTimeline(): void {
    // Timeline is now generated from character and support banner data
    // This method can be used to refresh the timeline
    this.loadTimelineData();
  }

  updateConfirmedEvent(eventId: string, confirmedDate: Date): void {
    const events = this.eventsSubject.value;
    const eventIndex = events.findIndex(e => e.id === eventId);

    if (eventIndex !== -1) {
      events[eventIndex] = {
        ...events[eventIndex],
        globalReleaseDate: confirmedDate,
        isConfirmed: true
      };

      this.eventsSubject.next([...events]);
    }
  }

  filterEvents(filters: TimelineFilters): Observable<TimelineEvent[]> {
    return new Observable(observer => {
      this.events$.subscribe(events => {
        let filtered = events;

        if (filters.eventTypes && filters.eventTypes.length > 0) {
          filtered = filtered.filter(event => filters.eventTypes!.includes(event.type));
        }

        if (filters.showConfirmed !== undefined || filters.showEstimated !== undefined) {
          filtered = filtered.filter(event => {
            if (filters.showConfirmed === false && event.isConfirmed) return false;
            if (filters.showEstimated === false && !event.isConfirmed) return false;
            return true;
          });
        }

        if (filters.searchTerm) {
          const searchLower = filters.searchTerm.toLowerCase();
          filtered = filtered.filter(event =>
            event.title.toLowerCase().includes(searchLower) ||
            event.description?.toLowerCase().includes(searchLower) ||
            event.tags?.some(tag => tag.toLowerCase().includes(searchLower))
          );
        }

        if (filters.dateRange) {
          filtered = filtered.filter(event => {
            const eventDate = event.globalReleaseDate || event.jpReleaseDate;
            if (!eventDate) return false;

            return eventDate >= filters.dateRange!.start && eventDate <= filters.dateRange!.end;
          });
        }

        observer.next(filtered);
      });
    });
  }

  calculateEndDate(globalDate: Date, durationInDays: number): Date {
    const endDate = new Date(globalDate);
    endDate.setDate(endDate.getDate() + durationInDays);
    endDate.setUTCHours(22, 0, 0, 0); // Set to 22:00 UTC (10 PM UTC)
    return endDate;
  }

  getCalculationConfig(): ReleaseCalculation {
    return { ...this.timelineConfig.calculation };
  }
}
