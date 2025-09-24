export interface Skill {
  id: string | null;
  skill_id: number;
  card_id: string | null;
  rarity: number;
  name: string;
  description: string;
  activation: string;
  base_cost: number;
  base_duration: string;
  effect: string;
  conditions: string;
  other_versions: string[];
  support_card_ids?: number[];
  character_id: number | undefined; // ID of the character this skill belongs to
  icon: string;
  unique?: string; // "true" for unique skills
}
