// Timeline data
// This file contains all timeline event information bundled with the application
// Data is imported at build time, so it doesn't appear in network requests

import characterBannersData from '../../data/character_banners.json';
import supportBannersData from '../../data/supports_banners.json';
import paidBannersData from '../../data/paid_gacha_banners.json';
import storyEventsData from '../../data/story_events.json';
import championsMeetingData from '../../data/champions_meeting.json';
import legendRacesData from '../../data/legend_races.json';

// Import types from timeline model
import { 
  CharacterBanner, 
  SupportBanner, 
  PaidBanner, 
  StoryEvent, 
  ChampionsMeeting, 
  LegendRace 
} from '../models/timeline.model';

// Export all data with proper typing
export const CHARACTER_BANNERS: CharacterBanner[] = characterBannersData as CharacterBanner[];
export const SUPPORT_BANNERS: SupportBanner[] = supportBannersData as SupportBanner[];
export const PAID_BANNERS: PaidBanner[] = paidBannersData as PaidBanner[];
export const STORY_EVENTS: StoryEvent[] = storyEventsData as StoryEvent[];
export const CHAMPIONS_MEETINGS: ChampionsMeeting[] = championsMeetingData as ChampionsMeeting[];
export const LEGEND_RACES: LegendRace[] = legendRacesData as LegendRace[];

// Export getters for convenience
export function getAllCharacterBanners(): CharacterBanner[] {
  return CHARACTER_BANNERS;
}

export function getAllSupportBanners(): SupportBanner[] {
  return SUPPORT_BANNERS;
}

export function getAllPaidBanners(): PaidBanner[] {
  return PAID_BANNERS;
}

export function getAllStoryEvents(): StoryEvent[] {
  return STORY_EVENTS;
}

export function getAllChampionsMeetings(): ChampionsMeeting[] {
  return CHAMPIONS_MEETINGS;
}

export function getAllLegendRaces(): LegendRace[] {
  return LEGEND_RACES;
}
