// Character master data
// This file contains all character information bundled with the application
// Data is imported at build time, so it doesn't appear in network requests
import characterData from '../../data/character.json';
import characterNamesData from '../../data/character_names.json';
import { Character } from '../models/character.model';
// Character name entries from character_names.json
interface CharacterNameEntry {
  name: string;
  skins: Record<string, string>;
}
const CHARACTER_NAMES: Record<string, CharacterNameEntry> = characterNamesData as any;
// Raw character data interface to match JSON structure
interface RawCharacterData {
  id: string;
  name: string;
  release_date: string;
  rarity: number;
  href: string;
  image: string;
  image_url: string;
  full_image: string;
  full_image_url: string;
  type_icon_url: string | null;
  type_icon_alt: string | null;
}
// Transform raw JSON data to Character format
// Names are resolved from character_names.json (source of truth)
export const CHARACTERS: Character[] = (characterData as RawCharacterData[]).map(char => {
  const charaId = Math.floor(parseInt(char.id, 10) / 100).toString();
  const nameEntry = CHARACTER_NAMES[charaId];
  return {
    id: parseInt(char.id),
    name: nameEntry?.name || char.name,
    release_date: char.release_date,
    rarity: char.rarity,
    href: char.href,
    image: char.image,
    image_url: char.image_url,
    full_image: char.full_image,
    full_image_url: char.full_image_url,
    type_icon_url: char.type_icon_url,
    type_icon_alt: char.type_icon_alt
  };
});
// Export individual getters for convenience
export function getAllCharacters(): Character[] {
  return CHARACTERS;
}
export function getCharacterById(id: number): Character | undefined {
  return CHARACTERS.find(character => character.id === id);
}
export function getCharactersByName(name: string): Character[] {
  return CHARACTERS.filter(character => 
    character.name.toLowerCase().includes(name.toLowerCase())
  );
}
