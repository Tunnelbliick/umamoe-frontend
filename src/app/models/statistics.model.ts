export interface StatisticsMetadata {
  generated_at: string;
  total_entries: number;
  total_trainers: number;
  total_unique_umas?: number;
  total_characters?: number;
  total_trained_umas?: number;  // New: Total count for percentage calculations
  distance?: string;
  character_id?: string;
  character_name?: string;
  character_color?: string;
}

export interface StatDistribution {
  mean: number;
  std: number;
  min: number;
  max: number;
  median: number;
  percentiles: {
    '25': number;
    '50': number;
    '75': number;
    '95': number;
  };
  count: number;
  histogram: { [key: string]: number };
}

export interface ItemWithLevels {
  total: number;
  percentage?: number;  // Made optional since it's calculated on frontend
  by_level: { [level: string]: number };
  avg_level: number;
  icon?: string;  // New: For skills
  id?: string;    // New: For items
  type?: string;  // New: For support cards
}

export interface SupportCardCombination {
  count: number;
  percentage: number;
  composition: { [cardType: string]: number };
}

export interface CharacterDistribution {
  count: number;
  percentage: number;
  character_id: string;
  character_color?: string;
}

export interface TeamClassDistribution {
  count: number;
  percentage: number;
  trained_umas?: number;  // New: Number of trained Uma Musume for this class
  trained_umas_percentage?: number;  // New: Percentage of trained Uma Musume for this class
  total_trainers?: number;  // New: Available at the top level
  total_trained_umas?: number;  // New: Total trained Uma Musume (top level only)
  character_id?: string;  // For character-specific data
  character_color?: string;  // For character-specific data
}

export interface StatFactorData {
  name: string;
  stat_type: string;
  count: number;
  percentage: number;
  by_level: { [level: string]: { count: number; percentage: number } };
}

export interface ThreeDigitFactorData {
  name: string;
  category: string;
  count: number;
  percentage: number;
  by_level: { [level: string]: { count: number; percentage: number } };
}

export interface RandomnessAnalysis {
  level_uniformity: {
    average_deviation: number;
    max_deviation: number;
    uniformity_score: number;
  };
  expected_vs_actual: { [level: string]: ExpectedVsActual };
  chi_square_test: {
    chi_square_statistic: number;
    degrees_of_freedom: number;
    critical_value_95_percent: number;
    is_random_95_percent: boolean;
    p_value_interpretation: string;
  };
  conclusion: string;
}

export interface ExpectedVsActual {
  expected_count: number;
  actual_count: number;
  expected_percentage: number;
  actual_percentage: number;
  deviation: number;
}

export interface CategoryData {
  count: number;
  percentage: number;
  by_level: { [level: string]: { count: number; percentage: number } };
}

export interface CombinationData {
  factors?: string[];
  categories?: string[];
  count: number;
  percentage: number;
}

export interface GlobalStatistics {
  metadata: StatisticsMetadata;
  team_class_distribution: { 
    total_trainers?: number;
    [teamClass: string]: TeamClassDistribution | number | undefined;
  };
  uma_distribution: { 
    by_team_class?: { [teamClass: string]: { [characterName: string]: CharacterDistribution } };
  } & { [characterName: string]: CharacterDistribution };
  stat_averages: {
    overall: { [stat: string]: StatDistribution };
    by_team_class: { [teamClass: string]: { [stat: string]: StatDistribution } };
  };
  support_cards: {
    overall?: { [cardName: string]: ItemWithLevels };
    total_support_cards?: number;
    by_team_class: { [teamClass: string]: { [cardName: string]: ItemWithLevels } };
    [key: string]: any; // For dynamic team class totals like total_support_cards_6
  };
  support_card_combinations: {
    overall?: { [combination: string]: SupportCardCombination };
    total_combinations?: number;
    by_team_class: { [teamClass: string]: { [combination: string]: SupportCardCombination } };
    [key: string]: any; // For dynamic team class totals
  };
  support_card_type_distribution: {
    overall?: { [cardType: string]: any };
    by_team_class: { [teamClass: string]: { [cardType: string]: any } };
  };
  skills: {
    overall?: { [skillName: string]: ItemWithLevels };
    total_skills?: number;
    by_team_class: { [teamClass: string]: { [skillName: string]: ItemWithLevels } };
    [key: string]: any; // For dynamic team class totals
  };
}

export interface DistanceStatistics {
  metadata: StatisticsMetadata;
  by_team_class: {
    [teamClass: string]: {
      total_entries: number;
      total_trained_umas: number;
      uma_distribution: { [characterName: string]: CharacterDistribution };
      stat_averages: { [stat: string]: StatDistribution };
      support_cards: { [cardName: string]: ItemWithLevels };
      total_support_cards: number;
      support_card_combinations: { [combination: string]: SupportCardCombination };
      total_combinations: number;
      support_card_type_distribution: { [cardType: string]: any };
      skills: { [skillName: string]: ItemWithLevels };
      total_skills: number;
    };
  };
}

export interface CharacterStatistics {
  metadata: StatisticsMetadata;
  global: {
    distance_distribution: { 
      total_entries?: number;
      [distance: string]: CharacterDistribution | number | undefined;
    };
    running_style_distribution: { 
      total_entries?: number;
      [style: string]: CharacterDistribution | number | undefined;
    };
    team_class_distribution: { 
      total_trainers?: number;
      [teamClass: string]: TeamClassDistribution | number | undefined;
    };
  };
  by_distance: {
    [distance: string]: {
      by_team_class: {
        [teamClass: string]: {
          total_entries: number;
          total_trained_umas: number;
          stat_averages: { [stat: string]: StatDistribution | Partial<StatDistribution> };
          common_support_cards: { [cardName: string]: ItemWithLevels };
          total_support_cards: number;
          support_card_combinations: { [combination: string]: SupportCardCombination };
          total_combinations: number;
          support_card_type_distribution: { [cardType: string]: any };
          common_skills: { [skillName: string]: ItemWithLevels };
          total_skills: number;
        };
      };
    };
  };
}

export interface StatisticsIndex {
  generated_at: string;
  total_entries: number;
  total_trainers: number;
  total_characters: number;
  distances: string[];
  character_ids: string[];
  version?: string;
  name?: string;
}

export interface StatisticsDataset {
  id: string;
  name: string;
  date: string;
  basePath: string;
  index: StatisticsIndex;
}
