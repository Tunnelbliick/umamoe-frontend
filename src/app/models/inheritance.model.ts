import { Character } from "./character.model";
import { Skill } from "./skill.model";

// Backend API compatible interfaces
export interface BackendInheritanceRecord {
  id: string;
  trainer_id: string;
  main_character_id: number;
  parent1_id: number;
  parent2_id: number;
  submitted_at: string; // ISO date string
  verified: boolean;
  upvotes: number;
  downvotes: number;
  notes?: string;
}

export interface BackendInheritanceRecordWithFactors extends BackendInheritanceRecord {
  blue_factors: BackendFactor[];
  pink_factors: BackendFactor[];
  unique_skills: BackendSkillFactor[];
}

export interface BackendFactor {
  type: string;
  level: number;
}

export interface BackendSkillFactor {
  skillId: number;
  level: number;
}

export interface BackendCreateInheritanceRecord {
  trainerId: string;
  mainCharacterId: number;
  parent1Id: number;
  parent2Id: number;
  blueFactors: BackendFactor[];
  pinkFactors: BackendFactor[];
  uniqueSkills: BackendSkillFactor[];
  notes?: string;
}

export interface InheritanceRecord {
  id: number | string; // Support both v1 (string) and v2 (number) IDs
  account_id?: string; // V2 API field
  trainer_id?: string; // V1 API field
  trainer_name?: string; // V2 API field
  submitted_at?: Date; // V1 API field
  verified?: boolean; // V1 API field
  upvotes: number;
  downvotes: number;
  user_vote?: 'up' | 'down' | null; // User's vote on this record
  
  // Character information
  umamusume_id?: number; // V2 API field
  main_parent_id?: number; // V2 API parent character ID
  parent_left_id?: number; // V2 API left parent ID  
  parent_right_id?: number; // V2 API right parent ID
  parent_rank?: number; // V2 API parent rank
  parent_rarity?: number; // V2 API parent rarity
  
  // V1 API character objects (legacy)
  main?: Character;
  parent1?: Character;
  parent2?: Character;
  
  // V2 API spark arrays (factor IDs)
  blue_sparks?: number[];
  pink_sparks?: number[];
  green_sparks?: number[];
  white_sparks?: number[];
  
  // V1 API factor objects (legacy)
  blue_factors?: BackendFactor[];
  pink_factors?: BackendFactor[];
  unique_skills?: SkillFactor[];
  common_skills?: BackendFactor[];
  
  // V2 API additional fields
  win_count?: number;
  white_count?: number;
  affinity_score?: number;
  follower_num?: number | null;
  last_updated?: string | null;
  
  // Main parent spark counts (from main inherit)
  main_blue_factors?: number;
  main_pink_factors?: number;
  main_green_factors?: number;
  main_white_factors?: number[];
  main_white_count?: number;
  
  // Support Card information
  support_card_id?: number;
  limit_break_count?: number;
  support_card_experience?: number;
  
  // UI helper fields
  character_name?: string;
  character_image_url?: string;
}

export interface SkillFactor {
  skill: Skill;
  level: number;
}

export interface InheritanceSearchFilters {
  // Trainer ID for direct trainer lookup
  trainerId?: string;
  trainerName?: string;
  
  // Character search
  characterId?: string;
  umaName?: string;
  umaId?: number; // For v2 API main_parent_id filter
  playerCharaId?: number; // For v2 API player_chara_id filter

  // Parent filters for v2 API
  parentLeftId?: number;
  parentRightId?: number;
  minParentRank?: number;
  minParentRarity?: number;

  // Blue Sparks (Main Stats) - 1-9 levels
  speedSpark?: number;
  staminaSpark?: number;
  powerSpark?: number;
  gutsSpark?: number;
  witSpark?: number;

  // Pink Sparks (Track/Strategy Aptitude) - 1-9 levels
  turfSpark?: number;
  dirtSpark?: number;
  sprintSpark?: number;
  mileSpark?: number;
  middleSpark?: number;
  longSpark?: number;
  frontRunnerSpark?: number;
  paceChaserSpark?: number;
  lateSurgerSpark?: number;
  endSpark?: number;

  // Green Sparks (Unique Skills) - 1-9 levels
  uniqueSkills?: number[]; // Array of skill IDs
  skillLevels?: { [skillId: number]: number }; // Map of skill ID to level (1-9)
  skillFilters?: Array<{ skillId: number | undefined; level: number | undefined }>; // Alternative format for skill filters

  // V2 API factor-based filters
  blueSparkFactors?: number[]; // Array of blue factor IDs
  pinkSparkFactors?: number[]; // Array of pink factor IDs  
  greenSparkFactors?: number[]; // Array of green factor IDs
  whiteSparkFactors?: number[]; // Array of white factor IDs

  // V2 API factor-based filters (AND logic groups)
  blueSparkGroups?: number[][];
  pinkSparkGroups?: number[][];
  greenSparkGroups?: number[][];
  whiteSparkGroups?: number[][];

  // Main Parent Factors
  mainParentBlueSparks?: number[];
  mainParentPinkSparks?: number[];
  mainParentGreenSparks?: number[];
  mainParentWhiteSparks?: number[];
  
  // Optional White Factors (for scoring/sorting, no level required)
  optionalWhiteSparks?: number[];
  optionalMainWhiteSparks?: number[];
  
  minMainBlueFactors?: number;
  minMainPinkFactors?: number;
  minMainGreenFactors?: number;
  minMainWhiteCount?: number;

  // V2 API minimum requirements
  minWinCount?: number;
  minWhiteCount?: number;
  maxFollowerNum?: number;

  // Support Card Filters
  supportCardId?: number;
  minLimitBreak?: number;

  // Pagination
  page?: number;
  pageSize?: number;

  // Legacy stat filters
  minSpeed?: number;
  maxSpeed?: number;
  minStamina?: number;
  maxStamina?: number;
  minPower?: number;
  maxPower?: number;
  minGuts?: number;
  maxGuts?: number;
  minWisdom?: number;
  maxWisdom?: number;
  minSkillCount?: number;
  aptitudeGrade?: AptitudeGrade;
  distance?: DistanceAptitude[];
  surface?: SurfaceAptitude[];
  runningStyle?: RunningStyleAptitude[];
  scenario?: Scenario[];
  verified?: boolean;
  verificationStatus?: string;
  minRating?: number;
  sortBy?: 'submitted_at' | 'upvotes' | 'downvotes' | 'trainer_id' | 'verified' | 'submittedAt' | 'createdAt' | 'rating' | 'votes' | 'views' | 'totalStats' | 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom' | 'win_count' | 'white_count' | 'score' | 'affinity_score';
  sortOrder?: 'asc' | 'desc';
}

export interface InheritanceSubmission {
  trainerId: string;
  mainCharacterId: number;  // Changed from number to ensure it matches
  parent1Id: number;        // Changed from number to ensure it matches  
  parent2Id: number;        // Changed from number to ensure it matches
  blueFactors: Array<{ type: string; level: number }>;
  pinkFactors: Array<{ type: string; level: number }>;
  uniqueSkills: Array<{ skillId: number; level: number }>;
  notes?: string;
}

export enum AptitudeGrade {
  G = 'G',
  F = 'F',
  E = 'E',
  D = 'D',
  C = 'C',
  B = 'B',
  A = 'A',
  S = 'S'
}

export enum DistanceAptitude {
  SHORT = 'Short',
  MILE = 'Mile',
  MIDDLE = 'Middle',
  LONG = 'Long'
}

export enum SurfaceAptitude {
  TURF = 'Turf',
  DIRT = 'Dirt'
}

export enum RunningStyleAptitude {
  RUNNER = 'Runner',
  LEADER = 'Leader',
  BETWEENER = 'Betweener',
  CHASER = 'Chaser'
}

export enum Scenario {
  URA = 'URA',
  AOHARU = 'Aoharu',
  CLIMAX = 'Climax',
  GRAND_MASTERS = 'Grand Masters',
  UAF = 'UAF'
}

export interface UmaMusumeCharacter {
  id: string;
  name: string;
  japaneseName: string;
  rarity: number;
  baseStats: {
    speed: number;
    stamina: number;
    power: number;
    guts: number;
    wisdom: number;
  };
  distanceAptitude: Record<DistanceAptitude, AptitudeGrade>;
  surfaceAptitude: Record<SurfaceAptitude, AptitudeGrade>;
  runningStyleAptitude: Record<RunningStyleAptitude, AptitudeGrade>;
  uniqueSkills: string[];
  imageUrl: string;
}
