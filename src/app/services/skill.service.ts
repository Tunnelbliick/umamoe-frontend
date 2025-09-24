import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, filter, switchMap, take } from 'rxjs/operators';
import { Skill } from '../models/skill.model';
import { CharacterService } from './character.service';
import { SKILLS, getAllSkills, getUniqueSkills as getBundledUniqueSkills } from '../data/skills-data';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class SkillService {
    private skillsSubject = new BehaviorSubject<Skill[]>([]);
    public skills$ = this.skillsSubject.asObservable();

    constructor(private http: HttpClient, private characterService: CharacterService) {
        // Load skills from bundled data immediately
        this.skillsSubject.next(getAllSkills());
    }

    getSkills(): Observable<Skill[]> {
        return this.skills$;
    }

    getUniqueSkills(): Observable<Skill[]> {
        return of(getBundledUniqueSkills());
    }

    getSkillById(id: number): Observable<Skill | undefined> {
        return of(SKILLS.find(s => s.skill_id === id));
    }

    getSkillViaId(id: string): Observable<Skill | undefined> {
        return of(SKILLS.find(skill => skill.id === id));
    }

    // Get multiple skills by their IDs in a single operation
    getSkillsByIds(ids: string[]): Observable<Skill[]> {
        return this.skills$.pipe(
            filter(skills => skills.length > 0),
            map(skills => {
                return ids.map(id => skills.find(skill => skill.id === id))
                    .filter((skill): skill is Skill => skill !== undefined);
            }),
            take(1) // Complete after first emission
        );
    }

    // Get multiple skills by their numeric skill_id in a single operation
    getSkillsByNumericIds(ids: number[]): Observable<(Skill | undefined)[]> {
        return this.skills$.pipe(
            filter(skills => skills.length > 0),
            map(skills => {
                return ids.map(id => skills.find(skill => skill.skill_id === id));
            }),
            take(1) // Complete after first emission
        );
    }

    searchSkills(query: string): Observable<Skill[]> {
        return this.skills$.pipe(
            filter(skills => skills.length > 0),
            map(skills => skills.filter(skill =>
                skill.name.toLowerCase().includes(query.toLowerCase()) ||
                skill.skill_id.toString().includes(query)
            ))
        );
    }

    searchUniqueSkills(query: string): Observable<Skill[]> {
        return this.skills$.pipe(
            filter(skills => skills.length > 0),
            map(skills => skills.filter(skill =>
                skill.unique === 'true' &&
                (skill.name.toLowerCase().includes(query.toLowerCase()) ||
                    skill.skill_id.toString().includes(query))
            ))
        );
    }

    /**
     * Get unique skills from characters that have been released globally
     * This filters unique skills to only include those from released characters
     */
    getUniqueSkillsFromReleasedCharacters(cutoffDate?: Date): Observable<Skill[]> {
        return combineLatest([
            this.getUniqueSkills(),
            this.characterService.getReleasedCharacters(cutoffDate)
        ]).pipe(
            map(([uniqueSkills, releasedCharacters]) => {
                // Create a set of released character names for efficient lookup
                const releaseCharacterIds = new Set(
                    releasedCharacters.map(char => +char.id)
                );

                // Filter unique skills based on whether they belong to released characters
                return uniqueSkills.filter(skill => {
                    if (!environment.production) {
                        console.log('Checking skill:', skill.character_id, 'for character ID:', skill.character_id);
                    }
                    if (skill.character_id != undefined && releaseCharacterIds.has(skill.character_id)) {
                        return true;
                    }

                    return false;
                });
            })
        );
    }

    /**
     * Enhanced matching logic to determine if a skill belongs to a character
     * This can be expanded with more sophisticated matching rules
     */
    private isSkillFromCharacter(skillName: string, characterName: string): boolean {
        const skillLower = skillName.toLowerCase();
        const charLower = characterName.toLowerCase();

        // Direct name match
        if (skillLower.includes(charLower)) return true;

        // Handle common name variations and abbreviations
        const nameVariations = this.getCharacterNameVariations(characterName);
        return nameVariations.some(variation =>
            skillLower.includes(variation.toLowerCase())
        );
    }

    /**
     * Generate name variations for better character-skill matching
     */
    private getCharacterNameVariations(characterName: string): string[] {
        const variations = [characterName];

        // Add common abbreviations and variations
        // This can be expanded based on actual data patterns
        if (characterName.includes(' ')) {
            // Add first name only
            variations.push(characterName.split(' ')[0]);
            // Add last name only
            variations.push(characterName.split(' ').pop() || '');
        }

        // Handle specific character name patterns you might find in your data
        // For example: "TM Opera O" might have skills with "Opera" or "TM Opera"

        return variations.filter(v => v.length > 0);
    }
}
