export interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  jpReleaseDate: Date;
  globalReleaseDate?: Date;
  estimatedEndDate?: Date;
  estimatedGlobalDate?: Date;
  isConfirmed: boolean;
  bannerDuration?: number; // days
  tags?: string[];
  relatedCharacters?: string[];
  relatedSupportCards?: string[];
  imagePath?: string; // Path to banner image
  gametoraURL?: string;
}

export enum EventType {
  CHARACTER_BANNER = 'character_banner',
  SUPPORT_CARD_BANNER = 'support_card_banner',
  PAID_BANNER = 'paid_banner',
  STORY_EVENT = 'story_event',
  TRAINING_EVENT = 'training_event',
  CAMPAIGN = 'campaign',
  SCENARIO_RELEASE = 'scenario_release',
  GAME_UPDATE = 'game_update',
  ANNIVERSARY = 'anniversary',
  COLLABORATION = 'collaboration',
  CHAMPIONS_MEETING = 'champions_meeting',
  LEGEND_RACE = 'legend_race',
  EVENT = 'event' // General event type for backward compatibility
}

export interface TimelineFilters {
  eventTypes?: EventType[];
  showEstimated?: boolean;
  showConfirmed?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
}

export interface ReleaseCalculation {
  jpLaunchDate: Date;
  globalLaunchDate: Date;
  baseDelayDays: number; // Initial gap between JP and Global
  catchupRate: number; // Rate at which Global is catching up (0.5 = half the delay each period)
  accelerationStart: Date; // When the accelerated schedule started
}

export interface CharacterBanner {
  year: number;
  image: string;
  image_url: string;
  start_date: string;
  end_date: string;
  pickup_characters: string[];
  image_path: string;
  start_date_string: string;
  end_date_string: string;
}

export interface SupportBanner {
  year: number;
  image: string;
  image_url: string;
  start_date: string;
  end_date: string;
  pickup_characters: string[];
}

export interface PaidBanner {
  year?: number;
  image: string;
  start_date?: string;
  end_date?: string;
  pickup_characters?: string[];
  image_path?: string;
  start_date_string?: string;
  end_date_string?: string;
}

export interface TimelineConfig {
  calculation: ReleaseCalculation;
  confirmedEvents: TimelineEvent[];
  lastUpdated: Date;
}

// New event interfaces
export interface StoryEvent {
  event_name: string;
  image: string;
  image_url: string;
  start_date: string;
  end_date: string;
}

export interface ChampionsMeeting {
  name: string;
  start_date: string;
  end_date: string;
  track?: string;
  distance?: string;
  conditions?: string;
}

export interface LegendRace {
  race_name: string;
  start_date: string;
  end_date: string;
  course?: string;
  bosses?: {
    name: string;
    image: string;
    image_url: string;
    phase_start: string;
    phase_end: string;
    stats: {
      Speed: number;
      Stamina: number;
      Power: number;
      Guts: number;
      Wisdom: number;
    };
  }[];
}
