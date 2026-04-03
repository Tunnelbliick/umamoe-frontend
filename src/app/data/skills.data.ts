// Skills master data
// This file contains all skill information bundled with the application
// Data is imported at build time, so it doesn't appear in network requests
import skillsData from '../../data/skills.json';
import { Skill } from '../models/skill.model';
// Export the skills data with proper typing
export const SKILLS: Skill[] = skillsData as Skill[];

// Pre-built lookup maps for O(1) access
const SKILL_BY_SKILL_ID = new Map<number, Skill>();
const SKILL_BY_ID = new Map<string, Skill>();
for (const skill of SKILLS) {
  SKILL_BY_SKILL_ID.set(skill.skill_id, skill);
  if (skill.id) SKILL_BY_ID.set(skill.id, skill);
}

// Export individual getters for convenience
export function getAllSkills(): Skill[] {
  return SKILLS;
}
export function getSkillById(id: string): Skill | undefined {
  return SKILL_BY_ID.get(id);
}
export function getSkillBySkillId(skillId: number): Skill | undefined {
  return SKILL_BY_SKILL_ID.get(skillId);
}
export function getSkillsByName(name: string): Skill[] {
  return SKILLS.filter(skill => 
    skill.name.toLowerCase().includes(name.toLowerCase())
  );
}
export function getSkillsByCharacter(characterId: number): Skill[] {
  return SKILLS.filter(skill => skill.character_id === characterId);
}
export function getUniqueSkills(): Skill[] {
  return SKILLS.filter(skill => skill.unique === "true");
}
