export interface TrainerProfile {
  account_id: string;
  name: string;
  follower_num: number | null;
  best_team_class: number | null;
  team_class: number | null;
  team_evaluation_point: number | null;
  leader_chara_dress_id: number | null;
  rank_score: number | null;
  release_num_info: any | null;
  trophy_num_info: any | null;
  team_stadium_user: any | null;
  own_follow_num: number | null;
  enable_circle_scout: number | null;
  comment: string | null;
}

export interface CircleInfo {
  circle_id: number;
  name: string;
  member_count: number;
  monthly_rank: number | null;
  monthly_point: number | null;
  last_month_rank: number | null;
  last_month_point: number | null;
  live_points: number | null;
  live_rank: number | null;
}

export interface CircleHistoryEntry {
  year: number;
  month: number;
  circle_id: number;
  circle_name: string;
  circle_rank: number | null;
  circle_points: number | null;
}

export interface FanHistoryMonthly {
  viewer_id: number;
  trainer_name: string;
  year: number;
  month: number;
  total_fans: number;
  monthly_gain: number;
  active_days: number;
  avg_daily: number;
  avg_3d: number;
  avg_7d: number | null;
  avg_monthly: number;
  rank: number;
  circle_id: number;
  circle_name: string;
  next_month_start: number | null;
}

export interface FanHistoryRolling {
  viewer_id: number;
  trainer_name: string;
  gain_3d: number;
  gain_7d: number;
  gain_30d: number;
  rank_3d: number;
  rank_7d: number;
  rank_30d: number;
  circle_id: number;
  circle_name: string;
}

export interface FanHistoryAlltime {
  viewer_id: number;
  trainer_name: string;
  total_fans: number;
  total_gain: number;
  active_days: number;
  avg_day: number;
  avg_week: number;
  avg_month: number;
  rank: number;
  rank_total_fans: number;
  rank_total_gain: number;
  rank_avg_day: number;
  rank_avg_week: number;
  rank_avg_month: number;
  circle_id: number;
  circle_name: string;
}

export interface ProfileInheritance {
  inheritance_id: number;
  account_id: string;
  main_parent_id: number;
  parent_left_id: number;
  parent_right_id: number;
  parent_rank: number;
  parent_rarity: number;
  blue_sparks: number[];
  pink_sparks: number[];
  green_sparks: number[];
  white_sparks: number[];
  win_count: number;
  white_count: number;
  main_blue_factors: number;
  main_pink_factors: number;
  main_green_factors: number;
  main_white_factors: number[];
  main_white_count: number;
  left_blue_factors: number;
  left_pink_factors: number;
  left_green_factors: number;
  left_white_factors: number[];
  left_white_count: number;
  right_blue_factors: number;
  right_pink_factors: number;
  right_green_factors: number;
  right_white_factors: number[];
  right_white_count: number;
  main_win_saddles: number[];
  left_win_saddles: number[];
  right_win_saddles: number[];
  race_results: number[];
  blue_stars_sum: number;
  pink_stars_sum: number;
  green_stars_sum: number;
  white_stars_sum: number;
  affinity_score: number | null;
}

export interface ProfileSupportCard {
  account_id: string;
  support_card_id: number;
  limit_break_count: number;
  experience: number;
}

export interface TeamStadiumMember {
  id: number;
  trainer_id: string;
  distance_type: number | null;
  member_id: number | null;
  trained_chara_id: number | null;
  running_style: number | null;
  card_id: number | null;
  speed: number | null;
  power: number | null;
  stamina: number | null;
  wiz: number | null;
  guts: number | null;
  fans: number | null;
  rank_score: number | null;
  skills: number[] | null;
  creation_time: string | null;
  scenario_id: number | null;
  factors: number[] | null;
  support_cards: number[] | null;
  proper_ground_turf: number | null;
  proper_ground_dirt: number | null;
  proper_running_style_nige: number | null;
  proper_running_style_senko: number | null;
  proper_running_style_sashi: number | null;
  proper_running_style_oikomi: number | null;
  proper_distance_short: number | null;
  proper_distance_mile: number | null;
  proper_distance_middle: number | null;
  proper_distance_long: number | null;
  rarity: number | null;
  talent_level: number | null;
  team_rating: number | null;
}

export interface ProfileVisibility {
  profile_hidden: boolean;
  hidden_sections: string[];
}

export interface VeteranInheritance {
  blue_sparks: number[];
  pink_sparks: number[];
  green_sparks: number[];
  white_sparks: number[];
  blue_stars_sum: number;
  pink_stars_sum: number;
  green_stars_sum: number;
  white_stars_sum: number;
  [key: string]: any;
}

export interface FactorInfoEntry {
  factor_id: number;
  level: number;
}

export interface SuccessionChara {
  position_id: number;
  card_id: number;
  rank: number;
  rarity: number | null;
  talent_level: number | null;
  factor_id_array: number[];
  factor_info_array?: FactorInfoEntry[];
  win_saddle_id_array?: number[];
  owner_viewer_id?: number;
}

export interface VeteranMember {
  id?: number;
  trainer_id?: string;
  distance_type: number | null;
  member_id: number | null;
  trained_chara_id: number | null;
  running_style: number | null;
  card_id: number | null;
  speed: number | null;
  power: number | null;
  stamina: number | null;
  wiz: number | null;
  guts: number | null;
  fans: number | null;
  rank_score: number | null;
  skills: number[] | null;
  skill_array?: { skill_id: number; level: number }[] | null;
  factors: number[] | null;
  support_cards: number[] | null;
  scenario_id: number | null;
  proper_ground_turf: number | null;
  proper_ground_dirt: number | null;
  proper_running_style_nige: number | null;
  proper_running_style_senko: number | null;
  proper_running_style_sashi: number | null;
  proper_running_style_oikomi: number | null;
  proper_distance_short: number | null;
  proper_distance_mile: number | null;
  proper_distance_middle: number | null;
  proper_distance_long: number | null;
  rarity: number | null;
  talent_level: number | null;
  team_rating: number | null;
  creation_time?: string | null;
  retired_at?: string | null;
  race_results?: number[] | null;
  win_saddle_id_array?: number[] | null;
  inheritance?: VeteranInheritance | null;
  factor_info_array?: FactorInfoEntry[] | null;
  succession_chara_array?: SuccessionChara[] | null;
}

export type CmData = Record<string, any>;
export type Achievement = Record<string, any>;

export interface UserProfileResponse {
  trainer: TrainerProfile;
  circle: CircleInfo | null;
  circle_history: CircleHistoryEntry[];
  fan_history: {
    monthly: FanHistoryMonthly[];
    rolling: FanHistoryRolling | null;
    alltime: FanHistoryAlltime | null;
  };
  inheritance: ProfileInheritance | null;
  support_card: ProfileSupportCard | null;
  team_stadium: TeamStadiumMember[];
  veterans?: VeteranMember[];
}
