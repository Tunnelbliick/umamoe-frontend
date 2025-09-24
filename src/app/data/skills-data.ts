// Skills data
// This file contains all skill information bundled with the application
// Data is imported at build time, so it doesn't appear in network requests

import skillsData from '../../data/skills.json';
import { Skill } from '../models/skill.model';

// Raw skill data interface to match JSON structure
interface RawSkillData {
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
  icon: string;
  unique?: string; // Optional field for unique skills
  character_id?: number; // Character ID for unique skills
}

// Transform raw JSON data to Skill format (keeping existing model structure)
export const SKILLS: Skill[] = (skillsData as RawSkillData[]).map(skill => ({
  id: skill.id,
  skill_id: skill.skill_id,
  card_id: skill.card_id,
  rarity: skill.rarity,
  name: skill.name,
  description: skill.description,
  activation: skill.activation,
  base_cost: skill.base_cost,
  base_duration: skill.base_duration,
  effect: skill.effect,
  conditions: skill.conditions,
  other_versions: skill.other_versions,
  icon: skill.icon,
  character_id: skill.character_id, // Include character_id from source data
  unique: skill.unique, // Include unique field from source data
}));

// Export getters for convenience
export function getAllSkills(): Skill[] {
  return SKILLS;
}

export function getSkillById(skillId: number): Skill | undefined {
  return SKILLS.find(skill => skill.skill_id === skillId);
}

export function getSkillsByCardId(cardId: string): Skill[] {
  return SKILLS.filter(skill => skill.card_id === cardId);
}

export function searchSkills(query: string): Skill[] {
  const lowercaseQuery = query.toLowerCase();
  return SKILLS.filter(skill =>
    skill.name.toLowerCase().includes(lowercaseQuery) ||
    skill.description.toLowerCase().includes(lowercaseQuery) ||
    skill.effect.toLowerCase().includes(lowercaseQuery)
  );
}

export function getUniqueSkills(): Skill[] {
  return SKILLS.filter(skill => skill.unique == "true");
}

export function searchUniqueSkills(query: string): Skill[] {
  const lowercaseQuery = query.toLowerCase();
  return SKILLS.filter(skill =>
    skill.unique === "true" &&
    (skill.name.toLowerCase().includes(lowercaseQuery) ||
     skill.description.toLowerCase().includes(lowercaseQuery) ||
     skill.effect.toLowerCase().includes(lowercaseQuery))
  );
}
