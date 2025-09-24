// Support card master data
// This file contains all support card information bundled with the application
// Data is imported at build time, so it doesn't appear in network requests

import supportCardsData from '../../data/support-cards-db.json';
import { SupportCardShort, SupportCardType } from '../models/support-card.model';

// Raw card data interface to match JSON structure
interface RawSupportCardData {
    id: string;
    name: string;
    rarity: number;
    type: string;
    release_date: string;
}

// Helper function to map string type to enum
function mapStringTypeToEnum(type: string): SupportCardType {
    switch (type.toLowerCase()) {
        case 'speed': return SupportCardType.SPEED;
        case 'stamina': return SupportCardType.STAMINA;
        case 'power': return SupportCardType.POWER;
        case 'guts': return SupportCardType.GUTS;
        case 'intelligence': return SupportCardType.WISDOM;
        case 'friend': return SupportCardType.FRIEND;
        default: return SupportCardType.SPEED;
    }
}

// Transform raw JSON data to SupportCardShort format
export const SUPPORT_CARDS: SupportCardShort[] = (supportCardsData as RawSupportCardData[]).map(card => ({
    id: card.id,
    name: card.name,
    type: mapStringTypeToEnum(card.type),
    rarity: card.rarity,
    release_date: card.release_date,
    limitBreak: 0, // Default limit break
    imageUrl: `/assets/images/support_card/half/support_card_s_${card.id}.png`,
}));

// Export individual getters for convenience
export function getAllSupportCards(): SupportCardShort[] {
    return SUPPORT_CARDS;
}

export function getSupportCardById(id: string): SupportCardShort | undefined {
    return SUPPORT_CARDS.find(card => card.id === id);
}

export function getSupportCardsByIds(ids: string[]): Map<string, SupportCardShort> {
    return new Map(SUPPORT_CARDS.filter(card => ids.includes(card.id)).map(card => [card.id, card]));
}

export function getSupportCardsByType(type: SupportCardType): SupportCardShort[] {
    return SUPPORT_CARDS.filter(card => card.type === type);
}

export function searchSupportCards(query: string): SupportCardShort[] {
    const lowercaseQuery = query.toLowerCase();
    return SUPPORT_CARDS.filter(card =>
        card.name.toLowerCase().includes(lowercaseQuery) ||
        card.id.toString().includes(query)
    );
}
