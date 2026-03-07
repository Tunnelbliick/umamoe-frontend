import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TimelineEvent, EventType, TimelineFilters, ReleaseCalculation, TimelineConfig, CharacterBanner, SupportBanner, PaidBanner, StoryEvent, ChampionsMeeting, LegendRace, Campaign } from '../models/timeline.model';
import { HttpClient } from '@angular/common/http';
import {
  getAllCharacterBanners,
  getAllSupportBanners,
  getAllPaidBanners,
  getAllStoryEvents,
  getAllChampionsMeetings,
  getAllLegendRaces,
  getAllCampaigns
} from '../data/timeline-data';
import characterNamesData from '../../data/character_names.json';
import supportCardsDbData from '../../data/support-cards-db.json';
// ============================================
// CHARACTER & SUPPORT NAME LOOKUPS
// ============================================
interface CharacterNameEntry {
  name: string;
  skins: Record<string, string>;
}
const CHARACTER_NAMES: Record<string, CharacterNameEntry> = characterNamesData as any;
const SUPPORT_CARDS_DB: { id: string; name: string; rarity: number; type: string }[] = supportCardsDbData as any;
// Build lookup maps
const SUPPORT_CARD_NAME_MAP = new Map<number, { name: string; rarity: number; type: string }>();
SUPPORT_CARDS_DB.forEach(card => {
  SUPPORT_CARD_NAME_MAP.set(parseInt(card.id, 10), { name: card.name, rarity: card.rarity, type: card.type });
});
function resolveCharacterName(cardId: number): string {
  const charaId = Math.floor(cardId / 100).toString();
  const entry = CHARACTER_NAMES[charaId];
  return entry?.name || `Unknown_${cardId}`;
}
function resolveSupportName(cardId: number): string {
  const info = SUPPORT_CARD_NAME_MAP.get(cardId);
  return info?.name || `Unknown_${cardId}`;
}
// ============================================
// CONFIRMED GLOBAL RELEASE DATES
// Add new confirmed dates here as they are announced
// All dates are in UTC
// ============================================
// Character Banner confirmed dates (banner image -> global release date)
// All times are 22:00 UTC to display as midnight in GMT+2
const CONFIRMED_CHARACTER_BANNER_DATES = new Map<string, Date>([
  ['2021_30004.png', new Date(Date.UTC(2025, 5, 27, 22, 0, 0))], // June 27, 2025 22:00 UTC
  ['2021_30006.png', new Date(Date.UTC(2025, 6, 2, 22, 0, 0))], // July 2, 2025 22:00 UTC
  ['2021_30008.png', new Date(Date.UTC(2025, 6, 10, 22, 0, 0))], // July 10, 2025 22:00 UTC
  ['2021_30010.png', new Date(Date.UTC(2025, 6, 16, 22, 0, 0))], // July 16, 2025 22:00 UTC
  ['2021_30012.png', new Date(Date.UTC(2025, 6, 27, 22, 0, 0))], // July 27, 2025 22:00 UTC
  ['2021_30014.png', new Date(Date.UTC(2025, 7, 3, 22, 0, 0))], // August 3, 2025 22:00 UTC
  ['2021_30016.png', new Date(Date.UTC(2025, 7, 11, 22, 0, 0))], // August 11, 2025 22:00 UTC
  ['2021_30018.png', new Date(Date.UTC(2025, 7, 20, 22, 0, 0))], // August 20, 2025 22:00 UTC
  ['2021_30020.png', new Date(Date.UTC(2025, 7, 28, 22, 0, 0))], // August 28, 2025 22:00 UTC
  ['2021_30022.png', new Date(Date.UTC(2025, 8, 7, 22, 0, 0))], // September 7, 2025 22:00 UTC
  ['2021_30024.png', new Date(Date.UTC(2025, 8, 17, 22, 0, 0))], // September 17, 2025 22:00 UTC
  ['2021_30026.png', new Date(Date.UTC(2025, 8, 21, 22, 0, 0))], // September 21, 2025 22:00 UTC
  ['2021_30028.png', new Date(Date.UTC(2025, 9, 2, 22, 0, 0))], // October 2, 2025 22:00 UTC
  ['2021_30030.png', new Date(Date.UTC(2025, 9, 7, 22, 0, 0))], // October 7, 2025 22:00 UTC
  ['2021_30032.png', new Date(Date.UTC(2025, 9, 14, 22, 0, 0))], // October 14, 2025 22:00 UTC
  ['2021_30034.png', new Date(Date.UTC(2025, 9, 21, 22, 0, 0))], // October 21, 2025 22:00 UTC
  ['2021_30036.png', new Date(Date.UTC(2025, 9, 30, 22, 0, 0))], // October 30, 2025 22:00 UTC
  ['2021_30038.png', new Date(Date.UTC(2025, 10, 6, 22, 0, 0))], // November 7, 2025 22:00 UTC
  ['2021_30040.png', new Date(Date.UTC(2025, 10, 11, 22, 0, 0))], // November 14, 2025 22:00 UTC
  ['2021_30042.png', new Date(Date.UTC(2025, 10, 19, 22, 0, 0))], // November 21, 2025 22:00 UTC
  ['2021_30044.png', new Date(Date.UTC(2025, 10, 24, 22, 0, 0))], // November 28, 2025 22:00 UTC
  ['2021_30046.png', new Date(Date.UTC(2025, 11, 1, 22, 0, 0))], // December 5, 2025 22:00 UTC
  ['2021_30048.png', new Date(Date.UTC(2025, 11, 8, 22, 0, 0))], // December 12, 2025 22:00 UTC
  ['2021_30050.png', new Date(Date.UTC(2025, 11, 14, 22, 0, 0))], // December 19, 2025 22:00 UTC
  ['2021_30052.png', new Date(Date.UTC(2025, 11, 18, 22, 0, 0))], // December 26, 2025 22:00 UTC
  ['2021_30054.png', new Date(Date.UTC(2025, 11, 28, 22, 0, 0))], // January 2, 2026 22:00 UTC
  ['2021_30056.png', new Date(Date.UTC(2026, 0, 5, 22, 0, 0))], // January 8, 2026 22:00 UTC
  ['2021_30058.png', new Date(Date.UTC(2026, 0, 15, 22, 0, 0))], // January 16, 2026 22:00 UTC
  ['2021_30060.png', new Date(Date.UTC(2026, 0, 22, 22, 0, 0))], // January 24, 2026 22:00 UTC
  ['2021_30062.png', new Date(Date.UTC(2026, 0, 29, 22, 0, 0))], // February 4, 2026 22:00 UTC
  ['2022_30064.png', new Date(Date.UTC(2026, 1, 5, 22, 0, 0))], // February 11, 2026 22:00 UTC
  ['2022_30066.png', new Date(Date.UTC(2026, 1, 11, 22, 0, 0))], // February 18, 2026 22:00 UTC
  ['2022_30068.png', new Date(Date.UTC(2026, 1, 18, 22, 0, 0))], // February 26, 2026 22:00 UTC
  ['2022_30070.png', new Date(Date.UTC(2026, 1, 25, 22, 0, 0))], // March 5, 2026 22:00 UTC
  ['2022_30072.png', new Date(Date.UTC(2026, 2, 5, 22, 0, 0))], // March 11, 2026 22:00 UTC
  ['2022_30074.png', new Date(Date.UTC(2026, 2, 12, 22, 0, 0))], // March 18, 2026 22:00 UTC
  ['2022_30076.png', new Date(Date.UTC(2026, 2, 22, 22, 0, 0))], // March 25, 2026 22:00 UTC
  ['2022_30078.png', new Date(Date.UTC(2026, 2, 26, 22, 0, 0))], // April 1, 2026 22:00 UTC
  // Add more confirmed character banner dates here as they're announced
]);
// Support Banner confirmed dates (banner image -> global release date)
// All times are 22:00 UTC to display as midnight in GMT+2
const CONFIRMED_SUPPORT_BANNER_DATES = new Map<string, Date>([
  ['2021_30005.png', new Date(Date.UTC(2025, 5, 27, 22, 0, 0))], // June 27, 2025 22:00 UTC
  ['2021_30007.png', new Date(Date.UTC(2025, 6, 2, 22, 0, 0))], // July 2, 2025 22:00 UTC
  ['2021_30009.png', new Date(Date.UTC(2025, 6, 10, 22, 0, 0))], // July 10, 2025 22:00 UTC
  ['2021_30011.png', new Date(Date.UTC(2025, 6, 16, 22, 0, 0))], // July 16, 2025 22:00 UTC
  ['2021_30013.png', new Date(Date.UTC(2025, 6, 27, 22, 0, 0))], // July 27, 2025 22:00 UTC
  ['2021_30015.png', new Date(Date.UTC(2025, 7, 3, 22, 0, 0))], // August 3, 2025 22:00 UTC
  ['2021_30017.png', new Date(Date.UTC(2025, 7, 11, 22, 0, 0))], // August 11, 2025 22:00 UTC
  ['2021_30019.png', new Date(Date.UTC(2025, 7, 20, 22, 0, 0))], // August 20, 2025 22:00 UTC
  ['2021_30021.png', new Date(Date.UTC(2025, 7, 28, 22, 0, 0))], // August 28, 2025 22:00 UTC
  ['2021_30023.png', new Date(Date.UTC(2025, 8, 7, 22, 0, 0))], // September 7, 2025 22:00 UTC
  ['2021_30025.png', new Date(Date.UTC(2025, 8, 17, 22, 0, 0))], // September 17, 2025 22:00 UTC
  ['2021_30027.png', new Date(Date.UTC(2025, 8, 21, 22, 0, 0))], // September 21, 2025 22:00 UTC
  ['2021_30029.png', new Date(Date.UTC(2025, 9, 2, 22, 0, 0))], // October 2, 2025 22:00 UTC
  ['2021_30031.png', new Date(Date.UTC(2025, 9, 7, 22, 0, 0))], // October 7, 2025 22:00 UTC
  ['2021_30033.png', new Date(Date.UTC(2025, 9, 14, 22, 0, 0))], // October 14, 2025 22:00 UTC
  ['2021_30035.png', new Date(Date.UTC(2025, 9, 21, 22, 0, 0))], // October 21, 2025 22:00 UTC
  ['2021_30037.png', new Date(Date.UTC(2025, 9, 30, 22, 0, 0))], // October 30, 2025 22:00 UTC
  ['2021_30039.png', new Date(Date.UTC(2025, 10, 6, 22, 0, 0))], // November 7, 2025 22:00 UTC
  ['2021_30041.png', new Date(Date.UTC(2025, 10, 11, 22, 0, 0))], // November 14, 2025 22:00 UTC
  ['2021_30043.png', new Date(Date.UTC(2025, 10, 19, 22, 0, 0))], // November 21, 2025 22:00 UTC
  ['2021_30045.png', new Date(Date.UTC(2025, 10, 24, 22, 0, 0))], // November 28, 2025 22:00 UTC
  ['2021_30047.png', new Date(Date.UTC(2025, 11, 1, 22, 0, 0))], // December 5, 2025 22:00 UTC
  ['2021_30049.png', new Date(Date.UTC(2025, 11, 8, 22, 0, 0))], // December 12, 2025 22:00 UTC
  ['2021_30051.png', new Date(Date.UTC(2025, 11, 14, 22, 0, 0))], // December 19, 2025 22:00 UTC
  ['2021_30053.png', new Date(Date.UTC(2025, 11, 18, 22, 0, 0))], // December 26, 2025 22:00 UTC
  ['2021_30055.png', new Date(Date.UTC(2025, 11, 28, 22, 0, 0))], // January 2, 2026 22:00 UTC
  ['2021_30057.png', new Date(Date.UTC(2026, 0, 5, 22, 0, 0))], // January 8, 2026 22:00 UTC
  ['2021_30059.png', new Date(Date.UTC(2026, 0, 15, 22, 0, 0))], // January 16, 2026 22:00 UTC
  ['2021_30061.png', new Date(Date.UTC(2026, 0, 22, 22, 0, 0))], // January 24, 2026 22:00 UTC
  ['2021_30063.png', new Date(Date.UTC(2026, 0, 29, 22, 0, 0))], // February 4, 2026 22:00 UTC
  ['2022_30065.png', new Date(Date.UTC(2026, 1, 5, 22, 0, 0))], // February 11, 2026 22:00 UTC
  ['2022_30067.png', new Date(Date.UTC(2026, 1, 11, 22, 0, 0))], // February 18, 2026 22:00 UTC
  ['2022_30069.png', new Date(Date.UTC(2026, 1, 18, 22, 0, 0))], // February 26, 2026 22:00 UTC
  ['2022_30071.png', new Date(Date.UTC(2026, 1, 25, 22, 0, 0))], // March 5, 2026 22:00 UTC
  ['2022_30073.png', new Date(Date.UTC(2026, 2, 5, 22, 0, 0))], // March 11, 2026 22:00 UTC
  ['2022_30075.png', new Date(Date.UTC(2026, 2, 12, 22, 0, 0))], // March 18, 2026 22:00 UTC
  ['2022_30077.png', new Date(Date.UTC(2026, 2, 22, 22, 0, 0))], // March 25, 2026 22:00 UTC
  ['2022_30079.png', new Date(Date.UTC(2026, 2, 26, 22, 0, 0))], // April 1, 2026 22:00 UTC
  // Add more confirmed support banner dates here as they're announced
]);
// Story Event confirmed dates (banner image -> global release date)
const CONFIRMED_STORY_EVENT_DATES = new Map<string, Date>([
  ['03_chase_your_dreams_banner.png', new Date(Date.UTC(2025, 5, 27, 22, 0, 0))],
  ['03_brand_new_friend_banner.png', new Date(Date.UTC(2025, 6, 16, 22, 0, 0))],
  ['05_blooming_maidens_june_pride_banner.png', new Date(Date.UTC(2025, 7, 28, 22, 0, 0))],
  ['06_fantasy_world_uma_nest_banner.png', new Date(Date.UTC(2025, 8, 21, 22, 0, 0))],
  ['07_uma_musume_summer_story_banner.png', new Date(Date.UTC(2025, 9, 14, 22, 0, 0))],
  ['09_make_up_in_halloween_banner.png', new Date(Date.UTC(2025, 10, 24, 22, 0, 0))],
  ['10_the_sounds_of_autumn_banner.png', new Date(Date.UTC(2025, 11, 14, 22, 0, 0))],
  ['11_miracles_of_the_holy_night_banner.png', new Date(Date.UTC(2026, 0, 5, 22, 0, 0))],
  ['01_patisserie_grandeur_banner.png', new Date(Date.UTC(2026, 1, 18, 22, 0, 0))],
  ['02_flapping_run_up_banner.png', new Date(Date.UTC(2026, 2, 12, 22, 0, 0))],
]);
// Paid Banner confirmed dates (banner image -> global release date)
const CONFIRMED_PAID_BANNER_DATES = new Map<string, Date>([
  ['50003.png', new Date(Date.UTC(2025, 10, 3, 22, 0, 0))],
  ['50004.png', new Date(Date.UTC(2025, 10, 3, 22, 0, 0))],
  /*['50007.png', new Date(Date.UTC(2026, 2, 5, 22, 0, 0))],
  ['50008.png', new Date(Date.UTC(2026, 2, 5, 22, 0, 0))],
  ['50009.png', new Date(Date.UTC(2026, 6, 8, 22, 0, 0))],
  ['50010.png', new Date(Date.UTC(2026, 6, 8, 22, 0, 0))],*/
  // generate 50029.png - 50048.png on the
]);
// Champions Meeting confirmed dates (index -> global release date)
// Use format: champions_meeting_0, champions_meeting_1, etc.
const CONFIRMED_CHAMPIONS_MEETING_DATES = new Map<string, Date>([
  ['champions_meeting_0', new Date(Date.UTC(2025, 7, 17, 22, 0, 0))], // First Champions Meeting (August 17, 2025)
  ['champions_meeting_1', new Date(Date.UTC(2025, 8, 7, 22, 0, 0))], // Second Champions Meeting
  ['champions_meeting_2', new Date(Date.UTC(2025, 9, 7, 22, 0, 0))], // Third Champions Meeting (September 16, 2025)
  ['champions_meeting_3', new Date(Date.UTC(2025, 9, 30, 22, 0, 0))], // Fourth Champions Meeting (September 30, 2025)
  ['champions_meeting_4', new Date(Date.UTC(2025, 10, 16, 22, 0, 0))], // Fifth Champions Meeting (October 21, 2025)
  ['champions_meeting_5', new Date(Date.UTC(2025, 11, 8, 22, 0, 0))], // Sixth Champions Meeting (November 4, 2025)
  ['champions_meeting_6', new Date(Date.UTC(2025, 11, 28, 22, 0, 0))], // Seventh Champions Meeting (December 2, 2025)
  ['champions_meeting_7', new Date(Date.UTC(2026, 0, 19, 22, 0, 0))], // Eighth Champions Meeting (January 15, 2026)
  ['champions_meeting_8', new Date(Date.UTC(2026, 1, 9, 22, 0, 0))], // Ninth Champions Meeting (February 4, 2026)
  ['champions_meeting_9', new Date(Date.UTC(2026, 2, 2, 22, 0, 0))], // Tenth Champions Meeting (February 25, 2026)
  ['champions_meeting_10', new Date(Date.UTC(2026, 2, 26, 22, 0, 0))], // Eleventh Champions Meeting (March 17, 2026)
  // Add more confirmed champions meeting dates here as they're announced
]);
// Legend Race confirmed dates (index -> global release date)
// Use format: legend_race_0, legend_race_1, etc.
const CONFIRMED_LEGEND_RACE_DATES = new Map<string, Date>([
  ['legend_race_0', new Date(Date.UTC(2025, 6, 6, 22, 0, 0))], // First Legend Race (July 6, 2025)
  ['legend_race_1', new Date(Date.UTC(2025, 6, 27, 22, 0, 0))], // Second Legend Race (July 27, 2025)
  ['legend_race_2', new Date(Date.UTC(2025, 7, 21, 22, 0, 0))], // Third Legend Race (August 21, 2025)
  ['legend_race_3', new Date(Date.UTC(2025, 8, 11, 22, 0, 0))], // Fourth Legend Race (September 11, 2025)
  ['legend_race_4', new Date(Date.UTC(2025, 9, 26, 22, 0, 0))], // Fifth Legend Race (October 26, 2025)
  ['legend_race_5', new Date(Date.UTC(2025, 10, 13, 22, 0, 0))], // Sixth Legend Race (November 21, 2025)
  ['legend_race_6', new Date(Date.UTC(2025, 11, 4, 22, 0, 0))], // Seventh
  ['legend_race_7', new Date(Date.UTC(2025, 11, 22, 22, 0, 0))], //
  ['legend_race_8', new Date(Date.UTC(2026, 0, 22, 22, 0, 0))], //
  ['legend_race_9', new Date(Date.UTC(2026, 1, 26, 22, 0, 0))], //
  ['legend_race_10', new Date(Date.UTC(2026, 2, 23, 22, 0, 0))], //
  // Add more confirmed legend race dates here as they're announced
]);
// Campaign confirmed dates (campaign image -> global release date)
const CONFIRMED_CAMPAIGN_DATES = new Map<string, Date>([
  // Add confirmed campaign dates here as they're announced
]);
// ============================================
// TIMELINE CONFIGURATION
// ============================================
const JP_LAUNCH_DATE = new Date(Date.UTC(2021, 1, 24)); // JP launch date - February 24, 2021 UTC
const GLOBAL_LAUNCH_DATE = new Date(Date.UTC(2025, 5, 26)); // Global launch date - June 26, 2025 UTC
// Fallback acceleration rate if we don't have enough confirmed dates
const FALLBACK_ACCELERATION_RATE = 1.6;
// Banner-specific tweak factors (index -> tweak factor)
// Index 0 = first unconfirmed banner after the last confirmed date
// 1.0 = no change, 0.8 = slower, 1.2 = faster
const BANNER_TWEAK_FACTORS = new Map<number, number>([]);
// Extra days to add to the extrapolated global date for specific unconfirmed banner periods and ALL subsequent events.
// This is useful for manually spacing out specific banners that are predicted too early/late.
// Key: Unconfirmed banner index (0 = first unconfirmed banner, 1 = second, ইত্যাদি.)
// Value: Number of days to delay (can be negative to bring forward)
const UNCONFIRMED_GAP_DAYS = new Map<number, number>([
  [0, 2], // Shift the first unpredicted banner block back by 14 days (adjust as needed)
]);
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
// Helper function to check if a date falls during DST (Daylight Saving Time) in Europe
// DST in Europe: Last Sunday of March (02:00 UTC) to Last Sunday of October (03:00 UTC)
function isDST(date: Date): boolean {
  const year = date.getUTCFullYear();
  // Find last Sunday of March
  const marchLastDay = new Date(Date.UTC(year, 2, 31, 1, 0, 0)); // March 31st at 01:00 UTC
  const marchLastSunday = new Date(marchLastDay);
  marchLastSunday.setUTCDate(31 - (marchLastDay.getUTCDay()));
  // Find last Sunday of October  
  const octoberLastDay = new Date(Date.UTC(year, 9, 31, 1, 0, 0)); // October 31st at 01:00 UTC
  const octoberLastSunday = new Date(octoberLastDay);
  octoberLastSunday.setUTCDate(31 - (octoberLastDay.getUTCDay()));
  // Check if date is between these two dates
  return date >= marchLastSunday && date < octoberLastSunday;
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
  // Cached unified confirmed dates for consistent extrapolation across all event types
  private unifiedConfirmedDates: Array<{ jp: Date, global: Date }> | null = null;
  private unconfirmedBannerJpDates: Date[] | null = null;
  constructor(private http: HttpClient) {
    this.loadTimelineData();
  }
  /**
   * Normalize a date to midnight UTC (00:00:00.000)
   * This ensures events on the same JP day always produce the same Global day
   */
  private normalizeToMidnightUTC(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));
  }
  /**
   * Build a unified pool of ALL confirmed dates across all event types.
   * This ensures all extrapolations use the same acceleration rate and anchor points,
   * preventing desync between different event types.
   * All JP dates are normalized to midnight UTC.
   */
  private getUnifiedConfirmedDates(): Array<{ jp: Date, global: Date }> {
    if (this.unifiedConfirmedDates) {
      return this.unifiedConfirmedDates;
    }
    const confirmedDates: Array<{ jp: Date, global: Date }> = [];
    // Add character banner confirmed dates
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
            confirmedDates.push({ jp: this.normalizeToMidnightUTC(jpDate), global: globalDate });
          }
        }
      });
    }
    // Add support banner confirmed dates
    const supportBanners = getAllSupportBanners();
    if (supportBanners) {
      supportBanners.forEach(banner => {
        const globalDate = CONFIRMED_SUPPORT_BANNER_DATES.get(banner.image);
        if (globalDate) {
          const jpDate = parseAsUTC(banner.start_date);
          if (!isNaN(jpDate.getTime())) {
            confirmedDates.push({ jp: this.normalizeToMidnightUTC(jpDate), global: globalDate });
          }
        }
      });
    }
    // Add story event confirmed dates
    const storyEvents = getAllStoryEvents();
    if (storyEvents) {
      storyEvents.forEach(event => {
        const globalDate = CONFIRMED_STORY_EVENT_DATES.get(event.image);
        if (globalDate) {
          const jpDate = parseAsUTC(event.start_date);
          if (!isNaN(jpDate.getTime())) {
            confirmedDates.push({ jp: this.normalizeToMidnightUTC(jpDate), global: globalDate });
          }
        }
      });
    }
    // Add champions meeting confirmed dates
    const championsMeetings = getAllChampionsMeetings();
    if (championsMeetings) {
      const sortedMeetings = [...championsMeetings]
        .map(event => ({ ...event, processedStartDate: parseAsUTC(event.start_date) }))
        .filter(event => !isNaN(event.processedStartDate.getTime()))
        .sort((a, b) => a.processedStartDate.getTime() - b.processedStartDate.getTime());
      sortedMeetings.forEach((event, index) => {
        const globalDate = CONFIRMED_CHAMPIONS_MEETING_DATES.get(`champions_meeting_${index}`);
        if (globalDate) {
          confirmedDates.push({ jp: this.normalizeToMidnightUTC(event.processedStartDate), global: globalDate });
        }
      });
    }
    // Add legend race confirmed dates
    const legendRaces = getAllLegendRaces();
    if (legendRaces) {
      const sortedRaces = [...legendRaces]
        .map(event => ({ ...event, processedStartDate: parseAsUTC(event.start_date) }))
        .filter(event => !isNaN(event.processedStartDate.getTime()))
        .sort((a, b) => a.processedStartDate.getTime() - b.processedStartDate.getTime());
      sortedRaces.forEach((event, index) => {
        const globalDate = CONFIRMED_LEGEND_RACE_DATES.get(`legend_race_${index}`);
        if (globalDate) {
          confirmedDates.push({ jp: this.normalizeToMidnightUTC(event.processedStartDate), global: globalDate });
        }
      });
    }
    // Add paid banner confirmed dates
    const paidBanners = getAllPaidBanners();
    if (paidBanners) {
      paidBanners.forEach(banner => {
        const globalDate = CONFIRMED_PAID_BANNER_DATES.get(banner.image);
        if (globalDate && banner.start_date && banner.start_date.trim() !== '') {
          const jpDate = parseAsUTC(banner.start_date);
          if (!isNaN(jpDate.getTime())) {
            confirmedDates.push({ jp: this.normalizeToMidnightUTC(jpDate), global: globalDate });
          }
        }
      });
    }
    // Sort by JP date and cache
    this.unifiedConfirmedDates = confirmedDates.sort((a, b) => a.jp.getTime() - b.jp.getTime());
    return this.unifiedConfirmedDates;
  }
  /**
   * Get the ordered JP dates of all unconfirmed character banners.
   * This aligns our extrapolation gaps to specific banner progression.
   */
  private getUnconfirmedBannerJpDates(): Date[] {
    if (this.unconfirmedBannerJpDates) return this.unconfirmedBannerJpDates;
    
    const characterBanners = getAllCharacterBanners() || [];
    
    // Process and sort all character banners by JP date
    const processed = characterBanners.map(b => ({
      image: b.image,
      jp: this.normalizeToMidnightUTC(b.start_date_string === "None" ? JP_LAUNCH_DATE : parseAsUTC(b.start_date))
    })).filter(b => !isNaN(b.jp.getTime())).sort((a, b) => a.jp.getTime() - b.jp.getTime());
    
    // Find the highest index of a confirmed banner
    let lastConfirmedIdx = -1;
    for (let i = 0; i < processed.length; i++) {
        if (CONFIRMED_CHARACTER_BANNER_DATES.has(processed[i].image)) {
            lastConfirmedIdx = Math.max(lastConfirmedIdx, i);
        }
    }
    
    // Collect unique JP dates of the remaining unconfirmed banners
    const jpDates: Date[] = [];
    for (let i = lastConfirmedIdx + 1; i < processed.length; i++) {
        const jp = processed[i].jp;
        if (jpDates.length === 0 || jpDates[jpDates.length - 1].getTime() !== jp.getTime()) {
            jpDates.push(jp);
        }
    }
    
    this.unconfirmedBannerJpDates = jpDates;
    return jpDates;
  }
  /**
   * Calculate acceleration rate based on the last 3 months of confirmed dates.
   * This gives us a more stable and accurate acceleration pattern by looking at broader trends.
   * Uses weighted averages, but with a more gradual decay to consider 3 months of history.
   */
  private calculateRecentAccelerationRate(confirmedDates: Array<{ jp: Date, global: Date }>, tweakFactor: number = 1.0): number {
    if (confirmedDates.length < 2) {
      return FALLBACK_ACCELERATION_RATE;
    }
    // Sort by global date to process chronologically
    const sorted = [...confirmedDates].sort((a, b) => a.global.getTime() - b.global.getTime());
    // Get the most recent date to establish our "current time" for the 3-month window
    const mostRecentDate = sorted[sorted.length - 1].global;
    
    // Calculate the cutoff date (3 months ago from the most recent confirmed date)
    const threeMonthsAgo = new Date(mostRecentDate);
    threeMonthsAgo.setUTCMonth(threeMonthsAgo.getUTCMonth() - 3);
    // Filter dates to only include those strictly within the last 3 months
    const datesToUse = sorted.filter(d => d.global.getTime() >= threeMonthsAgo.getTime());
    // Fallback if not enough dates in the window (e.g. at global launch time)
    if (datesToUse.length < 2) {
      // Just use the last 15 globally if we don't have enough strictly in the 3 month window
      const fallbackDates = sorted.slice(-15);
      if (fallbackDates.length < 2) {
         return FALLBACK_ACCELERATION_RATE;
      }
      return this.calculateRateFromDates(fallbackDates, tweakFactor);
    }
    return this.calculateRateFromDates(datesToUse, tweakFactor);
  }
  private calculateRateFromDates(datesToUse: Array<{ jp: Date, global: Date }>, tweakFactor: number): number {
    // Calculate weighted acceleration rate
    // We want to track the overall trend over the 3 months
    let weightedJpDays = 0;
    let weightedGlobalDays = 0;
    let totalWeight = 0;
    for (let i = 1; i < datesToUse.length; i++) {
      const jpDiff = getDaysDifferenceUTC(datesToUse[i - 1].jp, datesToUse[i].jp);
      const globalDiff = getDaysDifferenceUTC(datesToUse[i - 1].global, datesToUse[i].global);
      // Only consider meaningful gaps to avoid noise from same-day event clumps
      if (globalDiff > 0 && jpDiff > 0) {
        // Less aggressive exponential decay to give more stable weight to the whole 3-month period
        // Uses a factor of 10 instead of 3 to make the curve much flatter
        const weight = Math.exp((i - datesToUse.length + 1) / 10);
        weightedJpDays += jpDiff * weight;
        weightedGlobalDays += globalDiff * weight;
        totalWeight += weight;
      }
    }
    if (weightedGlobalDays === 0 || totalWeight === 0) {
      return FALLBACK_ACCELERATION_RATE;
    }
    const rate = weightedJpDays / weightedGlobalDays;
    // Apply tweak factor (1.0 = no change)
    const adjustedRate = rate * tweakFactor;
    // Clamp to reasonable values (between 1.2x and 2.5x acceleration)
    return Math.min(Math.max(adjustedRate, 1.2), 2.5);
  }
  /**
   * Calculate global release date using confirmed dates for extrapolation
   * Uses only the last month of confirmed dates for more accurate predictions
   * All calculations are done in UTC
   * Returns dates normalized to 22:00 UTC (midnight in GMT+2)
   * 
   * @param jpDate - The JP release date to calculate global date for
   * @param _confirmedDates - DEPRECATED: Now uses unified confirmed dates for consistency
   */
  public calculateGlobalDate(jpDate: Date, _confirmedDates?: Array<{ jp: Date, global: Date }>): Date {
    // Always use unified confirmed dates to ensure consistent extrapolation across all event types
    const unifiedDates = this.getUnifiedConfirmedDates();
    // Normalize JP date to midnight UTC to ensure events on the same JP day get the same Global day
    const normalizedJpDate = new Date(Date.UTC(
      jpDate.getUTCFullYear(),
      jpDate.getUTCMonth(),
      jpDate.getUTCDate(),
      0, 0, 0, 0
    ));
    // Sort confirmed dates by JP date
    const sortedByJp = [...unifiedDates].sort((a, b) => a.jp.getTime() - b.jp.getTime());
    // Also sort by global date to find the most recent anchor
    const sortedByGlobal = [...unifiedDates].sort((a, b) => a.global.getTime() - b.global.getTime());
    if (sortedByJp.length === 0) {
      // No confirmed dates, use fallback acceleration rate
      return this.calculateGlobalDateWithFallback(normalizedJpDate);
    }
    // Get the most recent confirmed date (by global date) as our primary anchor
    const mostRecentAnchor = sortedByGlobal[sortedByGlobal.length - 1];
    // Find the two closest confirmed dates (before and after jpDate) by JP date
    let before: { jp: Date, global: Date } | null = null;
    let after: { jp: Date, global: Date } | null = null;
    for (let i = 0; i < sortedByJp.length; i++) {
      if (sortedByJp[i].jp.getTime() <= normalizedJpDate.getTime()) {
        before = sortedByJp[i];
      } else if (!after) {
        after = sortedByJp[i];
        break;
      }
    }
    // Determine current unconfirmed banner index and cumulative gap days
    let currentBannerIndex = 0;
    let totalGapDays = 0;
    const unconfirmedDates = this.getUnconfirmedBannerJpDates();
    if (unconfirmedDates.length > 0 && normalizedJpDate.getTime() >= unconfirmedDates[0].getTime()) {
      for (let i = 0; i < unconfirmedDates.length; i++) {
        if (normalizedJpDate.getTime() >= unconfirmedDates[i].getTime()) {
          currentBannerIndex = i;
          if (UNCONFIRMED_GAP_DAYS.has(i)) {
            totalGapDays += UNCONFIRMED_GAP_DAYS.get(i)!;
          }
        } else {
          break;
        }
      }
    }
    // Determine tweak factor based on banner index
    const tweakFactor = BANNER_TWEAK_FACTORS.has(currentBannerIndex)
      ? BANNER_TWEAK_FACTORS.get(currentBannerIndex)!
      : 1.0;
    // Calculate the recent acceleration rate with the appropriate tweak factor
    const recentRate = this.calculateRecentAccelerationRate(sortedByJp, tweakFactor);
    let calculatedDate: Date;
    // Case 1: We have confirmed dates on both sides - interpolate
    if (before && after) {
      const jpRange = after.jp.getTime() - before.jp.getTime();
      const globalRange = after.global.getTime() - before.global.getTime();
      const jpProgress = normalizedJpDate.getTime() - before.jp.getTime();
      const ratio = globalRange / jpRange;
      const globalProgress = jpProgress * ratio;
      calculatedDate = new Date(before.global.getTime() + globalProgress);
    }
    // Case 2: We only have dates before (future event) - extrapolate forward
    // Always use the most recent confirmed date as anchor for best accuracy
    else if (before) {
      // Use the most recent anchor point for future extrapolation
      const anchor = mostRecentAnchor;
      const jpDaysAfter = getDaysDifferenceUTC(anchor.jp, normalizedJpDate);
      const globalDaysAfter = Math.round(jpDaysAfter / recentRate);
      calculatedDate = addDaysUTC(anchor.global, globalDaysAfter);
      
      // Apply unconfirmed gap delays to purely extrapolated events
      if (totalGapDays !== 0) {
        calculatedDate = addDaysUTC(calculatedDate, totalGapDays);
      }
    }
    // Case 3: We only have dates after - extrapolate backward using recent rate
    else if (after) {
      const jpDaysBefore = getDaysDifferenceUTC(normalizedJpDate, after.jp);
      const globalDaysBefore = Math.round(jpDaysBefore / recentRate);
      calculatedDate = addDaysUTC(after.global, -globalDaysBefore);
    }
    // Fallback to simple calculation
    else {
      calculatedDate = this.calculateGlobalDateWithFallback(normalizedJpDate);
    }
    // Normalize to 22:00 UTC (midnight in GMT+2) to match confirmed banner times
    const normalized = new Date(Date.UTC(
      calculatedDate.getUTCFullYear(),
      calculatedDate.getUTCMonth(),
      calculatedDate.getUTCDate(),
      22, 0, 0, 0
    ));
    return normalized;
  }
  /**
   * Fallback calculation using fixed acceleration rate
   * All calculations are done in UTC
   * Returns dates normalized to 22:00 UTC (midnight in GMT+2)
   */
  private calculateGlobalDateWithFallback(jpDate: Date): Date {
    const daysSinceJpLaunch = getDaysDifferenceUTC(JP_LAUNCH_DATE, jpDate);
    const adjustedDays = Math.floor(daysSinceJpLaunch / FALLBACK_ACCELERATION_RATE);
    const calculatedDate = addDaysUTC(GLOBAL_LAUNCH_DATE, adjustedDays);
    // Normalize to 22:00 UTC (midnight in GMT+2) to match confirmed banner times
    const normalized = new Date(Date.UTC(
      calculatedDate.getUTCFullYear(),
      calculatedDate.getUTCMonth(),
      calculatedDate.getUTCDate(),
      22, 0, 0, 0
    ));
    return normalized;
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
    // For non-banner events (story, champions, legend, paid), also include character banner dates
    // This gives us more data points for accurate extrapolation
    if (type === 'story' || type === 'champions' || type === 'legend' || type === 'paid') {
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
    // Paid banners usually accompany character/support releases, so reuse confirmed support banner dates as anchors
    if (type === 'paid') {
      const supportBanners = getAllSupportBanners();
      if (supportBanners) {
        supportBanners.forEach(banner => {
          const globalDate = CONFIRMED_SUPPORT_BANNER_DATES.get(banner.image);
          if (!globalDate) {
            return;
          }
          const jpDate = parseAsUTC(banner.start_date);
          if (!isNaN(jpDate.getTime())) {
            confirmedDates.push({ jp: jpDate, global: globalDate });
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
      const campaigns = getAllCampaigns();
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
      // Process campaigns
      if (campaigns) {
        const campaignItems = this.processCampaigns(campaigns);
        events.push(...campaignItems);
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
    // Find the index of the last confirmed banner to calculate unconfirmed indices
    let lastConfirmedIndex = -1;
    for (let i = processedBanners.length - 1; i >= 0; i--) {
      if (CONFIRMED_CHARACTER_BANNER_DATES.has(processedBanners[i].image)) {
        lastConfirmedIndex = i;
        break;
      }
    }
    processedBanners.forEach((banner, index) => {
      // Resolve character names from pickup_card_ids
      const characters = banner.pickup_card_ids.map(id => resolveCharacterName(id));
      // Check if this banner has a confirmed date
      const confirmedGlobalDate = CONFIRMED_CHARACTER_BANNER_DATES.get(banner.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(banner.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;
      const bannerid = banner.image.split('_').pop()?.replace('.png', '') || '';
      const duration = this.calculateBannerDuration(banner.processedStartDate!, banner.processedEndDate!);
      const adjustment = isDST(globalDate) ? 0 : 1; // Adjust for DST
      const event: TimelineEvent = {
        id: `banner-${banner.image.replace('.png', '')}`,
        type: EventType.CHARACTER_BANNER,
        title: characters.length > 1 ? `${characters[0]} + ${characters.length - 1} more` : characters[0] || 'Character Banner',
        description: `Character banner featuring: ${characters.join(', ')}`,
        jpReleaseDate: banner.processedStartDate!,
        globalReleaseDate: globalDate,
        estimatedEndDate: this.calculateEndDate(globalDate, duration + adjustment),
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
    // Find the index of the last confirmed banner to calculate unconfirmed indices
    let lastConfirmedIndex = -1;
    for (let i = processedBanners.length - 1; i >= 0; i--) {
      if (CONFIRMED_SUPPORT_BANNER_DATES.has(processedBanners[i].image)) {
        lastConfirmedIndex = i;
        break;
      }
    }
    processedBanners.forEach((banner, index) => {
      // Resolve support card names from pickup_card_ids
      const supportCards = banner.pickup_card_ids.map(id => resolveSupportName(id));
      const confirmedGlobalDate = CONFIRMED_SUPPORT_BANNER_DATES.get(banner.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(banner.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;
      const bannerid = banner.image.split('_').pop()?.replace('.png', '') || '';
      const duration = this.calculateBannerDuration(banner.processedStartDate!, banner.processedEndDate!);
      const adjustment = isDST(globalDate) ? -1 : 0; // Adjust for DST
      const event: TimelineEvent = {
        id: `support-banner-${banner.image.replace('.png', '')}`,
        type: EventType.SUPPORT_CARD_BANNER,
        title: supportCards.length > 1 ? `${supportCards[0]} + ${supportCards.length - 1} more` : supportCards[0] || 'Support Card Banner',
        description: `Support card banner featuring: ${supportCards.join(', ')}`,
        jpReleaseDate: banner.processedStartDate!,
        globalReleaseDate: globalDate,
        estimatedEndDate: this.calculateEndDate(globalDate, duration + adjustment),
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
      // Champions Meetings have a 3-day signup period, but DST affects the calculation
      // During summer time (DST active): use +2 days
      // During winter time (DST inactive): use +4 days
      const signupPeriodAdjustment = isDST(globalDate) ? 2 : 4;
      const timelineEvent: TimelineEvent = {
        id: `champions-meeting-${index}`,
        type: EventType.CHAMPIONS_MEETING,
        title: `Champions Meeting: ${championsEvent.name}`,
        description: `${championsEvent.track}<br>${championsEvent.distance || ''}</br>${championsEvent.conditions || ''}`,
        jpReleaseDate: event.processedStartDate!,
        estimatedEndDate: this.calculateEndDate(globalDate, duration + signupPeriodAdjustment),
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
      const adjustment = isDST(globalDate) ? 0 : 1; // Adjust for DST
      const timelineEvent: TimelineEvent = {
        id: `legend-race-${index}`,
        type: EventType.LEGEND_RACE,
        title: legendEvent.race_name,
        description: legendEvent.course,
        jpReleaseDate: event.processedStartDate!,
        globalReleaseDate: globalDate,
        estimatedEndDate: this.calculateEndDate(globalDate, duration + adjustment),
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
    // Split banners:
    //  - "individual": has pickups, OR has an image (non-type-14 no-pickup banners)
    //  - "bundle": type-14 no-pickup banners (large multi-sub-banner sets, typically no distinct image)
    const individualBanners: PaidBanner[] = [];
    const withoutPickups: PaidBanner[] = [];
    banners.forEach(banner => {
      if (banner.pickup_card_ids.length > 0 || banner.gacha_type !== 14) {
        individualBanners.push(banner);
      } else {
        withoutPickups.push(banner);
      }
    });
    // Process individual banners (with pickups, or imageable no-pickup banners)
    const processedBanners = individualBanners
      .map(banner => this.processPaidBannerDates(banner))
      .filter(banner => banner.processedStartDate) // Filter out invalid dates
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());
    processedBanners.forEach((banner, index) => {
      // Resolve pickup names based on card type
      const characters: string[] = banner.pickup_card_ids.map(id =>
        banner.card_type === 'character' ? resolveCharacterName(id) : resolveSupportName(id)
      );
      const confirmedGlobalDate = CONFIRMED_PAID_BANNER_DATES.get(banner.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(banner.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;
      const duration = banner.processedEndDate ?
        this.calculateBannerDuration(banner.processedStartDate!, banner.processedEndDate!) :
        14;
      const event: TimelineEvent = {
        id: `paid-banner-${banner.gacha_id}`,
        type: EventType.PAID_BANNER,
        title: characters.length > 0 ?
          (characters.length > 1 ? `${characters[0]} + ${characters.length - 1} more` : characters[0]) :
          (banner.card_type === 'character' ? 'Premium Character Banner' : 'Premium Support Banner'),
        description: characters.length > 0 ?
          `Paid banner featuring: ${characters.join(', ')}` :
          `Paid ${banner.card_type} banner`,
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
    // Bundle no-pickup banners by month into single grouped events
    const processedNoPickup = withoutPickups
      .map(banner => this.processPaidBannerDates(banner))
      .filter(banner => banner.processedStartDate)
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());
    // Group by year-month
    const monthGroups = new Map<string, typeof processedNoPickup>();
    processedNoPickup.forEach(banner => {
      const d = banner.processedStartDate!;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!monthGroups.has(key)) monthGroups.set(key, []);
      monthGroups.get(key)!.push(banner);
    });
    monthGroups.forEach((group, monthKey) => {
      // Use the earliest banner's date as the representative date
      const representative = group[0];
      const count = group.length;
      const confirmedGlobalDate = CONFIRMED_PAID_BANNER_DATES.get(representative.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(representative.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;
      const event: TimelineEvent = {
        id: `paid-banner-bundle-${monthKey}`,
        type: EventType.PAID_BANNER,
        title: `${count} Other Paid Banner${count > 1 ? 's' : ''}`,
        description: `${count} other paid banner${count > 1 ? 's' : ''} without featured pickups`,
        jpReleaseDate: representative.processedStartDate!,
        estimatedEndDate: this.calculateEndDate(globalDate, 14),
        globalReleaseDate: globalDate,
        isConfirmed: isConfirmed,
        bannerDuration: 14,
        tags: ['paid-banner'],
        relatedCharacters: [],
        // No imagePath — will show placeholder icon
      };
      events.push(event);
    });
    return events;
  }
  private processCampaigns(campaigns: Campaign[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    // Get confirmed dates for interpolation
    const confirmedDates = this.getUnifiedConfirmedDates();
    const processedCampaigns = campaigns
      .map(campaign => {
        const processed = { ...campaign } as Campaign & { processedStartDate?: Date; processedEndDate?: Date };
        processed.processedStartDate = parseAsUTC(campaign.start_date);
        processed.processedEndDate = parseAsUTC(campaign.end_date);
        return processed;
      })
      .filter(c => c.processedStartDate && !isNaN(c.processedStartDate.getTime()))
      .sort((a, b) => a.processedStartDate!.getTime() - b.processedStartDate!.getTime());
    processedCampaigns.forEach(campaign => {
      const confirmedGlobalDate = CONFIRMED_CAMPAIGN_DATES.get(campaign.image);
      const globalDate = confirmedGlobalDate || this.calculateGlobalDate(campaign.processedStartDate!, confirmedDates);
      const isConfirmed = !!confirmedGlobalDate;
      const duration = campaign.processedEndDate
        ? this.calculateBannerDuration(campaign.processedStartDate!, campaign.processedEndDate!)
        : 7;
      const adjustment = isDST(globalDate) ? 0 : 1;
      const event: TimelineEvent = {
        id: `campaign-${campaign.campaign_id}`,
        type: EventType.CAMPAIGN,
        title: `Mission Campaign`,
        jpReleaseDate: campaign.processedStartDate!,
        globalReleaseDate: globalDate,
        estimatedEndDate: this.calculateEndDate(globalDate, duration + adjustment),
        isConfirmed: isConfirmed,
        bannerDuration: duration,
        tags: ['mission campaign'],
        imagePath: `assets/images/campaign/${campaign.image}`
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
    // Parse the start_date as UTC
    processed.processedStartDate = parseAsUTC(banner.start_date);
    // Parse end_date as UTC
    processed.processedEndDate = parseAsUTC(banner.end_date);
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
    // Create new date from UTC timestamp to avoid timezone issues
    const endDate = new Date(globalDate.getTime());
    // Add days using UTC date methods to ensure proper calculation
    endDate.setUTCDate(endDate.getUTCDate() + durationInDays);
    endDate.setUTCHours(22, 0, 0, 0); // Set to 22:00 UTC (10 PM UTC)
    return endDate;
  }
  getCalculationConfig(): ReleaseCalculation {
    return { ...this.timelineConfig.calculation };
  }
}
