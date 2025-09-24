/**
 * Tierlist Calculation Engine for Node.js
 * 
 * This is a Node.js-compatible version of the tierlist calculation logic
 * extracted from the Angular service for use in build-time precomputation.
 */

const fs = require('fs');
const path = require('path');

class TierlistCalculationEngine {
    constructor() {
        this.cardData = new Map();
        this.cardEvents = {};
        this.supportCards = [];
        
        // Global release configuration (matches support-card.service.ts)
        this.globalReleaseDate = new Date('2025-06-26'); // Global game launch
        this.jpLaunchDate = new Date('2021-02-24'); // JP game launch
        this.catchupRate = 1 / 1.6; // Global is catching up at 1.6x speed
        this.gracePeriodDays = 2; // Grace period for upcoming releases
    }

    async initialize() {
        console.log('📚 Loading card data...');
        
        // Load all required data files
        await this.loadCardData();
        await this.loadCardEvents();
        await this.loadSupportCards();
        
        console.log(`   Loaded ${this.cardData.size} card entries`);
        console.log(`   Loaded ${Object.keys(this.cardEvents).length} card events`);
        console.log(`   Loaded ${this.supportCards.length} support cards`);
    }

    async loadCardData() {
        const dataPath = path.join(__dirname, '..', 'src', 'data');
        
        // Load reduced cards data
        const reducedCardsPath = path.join(dataPath, 'reduced_cards.json');
        if (fs.existsSync(reducedCardsPath)) {
            const reducedCardsData = JSON.parse(fs.readFileSync(reducedCardsPath, 'utf8'));
            const reducedCards = reducedCardsData.cards || reducedCardsData; // Handle both structures
            
            if (Array.isArray(reducedCards)) {
                reducedCards.forEach(card => {
                    const key = `${card.id}_${card.limit_break}`;
                    this.cardData.set(key, card);
                });
            }
        }

        // Load full cards data as fallback
        const cardsPath = path.join(dataPath, 'cards.json');
        if (fs.existsSync(cardsPath)) {
            const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
            const cards = cardsData.cards || cardsData; // Handle both structures
            
            if (Array.isArray(cards)) {
                cards.forEach(card => {
                        const key = `${card.id}_${card.limit_break}`;
                        if (!this.cardData.has(key)) {
                            this.cardData.set(key, { ...card, limit_break: card.limit_break });
                        }
                });
            }
        }
    }

    async loadCardEvents() {
        const eventsPath = path.join(__dirname, '..', 'src', 'data', 'card-events.json');
        if (fs.existsSync(eventsPath)) {
            this.cardEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
        }
    }

    async loadSupportCards() {
        const dataPath = path.join(__dirname, '..', 'src', 'data');
        
        // Load support cards with proper type information
        const supportCardsPath = path.join(dataPath, 'support-cards-db.json');
        if (fs.existsSync(supportCardsPath)) {
            const supportCardsData = JSON.parse(fs.readFileSync(supportCardsPath, 'utf8'));
            
            // Convert string types to numbers (matches Angular enum)
            const typeMap = {
                'speed': 0,
                'stamina': 1, 
                'power': 2,
                'guts': 3,
                'intelligence': 4,
                'friend': 5
            };
            
            this.supportCards = supportCardsData.map(card => ({
                ...card,
                type: typeMap[card.type] !== undefined ? typeMap[card.type] : card.type
            }));
            
            console.log(`   Found ${this.supportCards.length} support cards with release dates`);
            
            // Count types for debugging
            const typeCounts = {};
            this.supportCards.forEach(card => {
                const type = card.type;
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            });
            console.log(`   Type distribution:`, typeCounts);
            
        } else {
            console.warn(`   Support cards file not found: ${supportCardsPath}`);
        }
    }

    /**
     * Get globally released card IDs based on release dates from supports.json
     */
    getGloballyReleasedCardIds(cutoffDate = new Date()) {
        const releasedIds = new Set();
        const effectiveCutoffDate = new Date(cutoffDate);
        effectiveCutoffDate.setDate(effectiveCutoffDate.getDate() + this.gracePeriodDays);

        for (const supportCard of this.supportCards) {
            if (this.isCardReleasedGlobally(supportCard, cutoffDate)) {
                releasedIds.add(supportCard.id.toString());
            }
        }

        console.log(`   Found ${releasedIds.size} globally released card IDs`);
        return releasedIds;
    }

    convertTypeStringToNumber(typeStr) {
        const typeMap = {
            'speed': 0,
            'stamina': 1,
            'power': 2,
            'guts': 3,
            'intelligence': 4,
            'friend': 6
        };
        return typeMap[typeStr] !== undefined ? typeMap[typeStr] : 0;
    }

    async calculateTierlistByType(type, weights) {
        console.log(`  Filtering cards for type ${type}...`);
        
        // Debug: show what types are available
        const typeCounts = {};
        this.supportCards.forEach(card => {
            typeCounts[card.type] = (typeCounts[card.type] || 0) + 1;
        });
        console.log(`  Available types in support cards:`, typeCounts);
        
        // Get globally released card IDs from supports.json
        const currentDate = new Date();
        const releasedCardIds = this.getGloballyReleasedCardIds(currentDate);
        
        // Get the "Each Meta" deck (index 0) for preprocessing context
        const metaDeck = DEFAULT_META_DECKS[0];
        const selectedCards = metaDeck.cardIds.map(cardId => this.getFullCardDataByID(cardId, 4))
            .filter(card => card !== null);
        
        // Preprocess selected cards for proper context calculation
        const processedSelectedCards = this.preprocessSelectedCards(selectedCards, weights);
        
        // Find cards of the specified type and all LB levels that are globally released
        const processedCards = [];
        
        for (const [key, card] of this.cardData.entries()) {
            if (card.type === type && 
                card.rarity >= 1 && 
                releasedCardIds.has(card.id.toString())) {
                
                // Filter selected cards to exclude cards of the same type as the current card
                const filteredSelectedCards = processedSelectedCards.filter(selectedCard => selectedCard.type !== type);
                
                const processedCard = this.processCardWithContext(card, weights, filteredSelectedCards);
                if (processedCard) {
                    processedCards.push(processedCard);
                }
            }
        }        
        // Sort by score descending
        processedCards.sort((a, b) => b.score - a.score);

        console.log(`  Processed ${processedCards.length} globally released cards for type ${type}`);
        return processedCards;
    }

    async calculateCardPowerProgression(cardId, weights) {
        // Check if this card ID is globally released
        const currentDate = new Date();
        const releasedCardIds = this.getGloballyReleasedCardIds(currentDate);
        
        if (!releasedCardIds.has(cardId.toString())) {
            return null; // Card not globally released
        }

        // Get the card type to filter selected cards properly
        const cardType = this.getCardType(cardId);
        if (cardType === null) {
            return null;
        }

        // Get the "Each Meta" deck for context and filter out cards of the same type
        const metaDeck = DEFAULT_META_DECKS[0];
        const selectedCards = metaDeck.cardIds.map(id => this.getFullCardDataByID(id, 4))
            .filter(card => card !== null && card.type !== cardType);
        const processedSelectedCards = this.preprocessSelectedCards(selectedCards, weights);

        const limitBreakProgression = [];
        const scores = [];

        // Calculate for each LB level
        for (let lb = 0; lb <= 4; lb++) {
            const fullCard = this.getFullCardData({ id: cardId }, lb);
            if (!fullCard) {
                limitBreakProgression.push({
                    limitBreak: lb,
                    score: 0,
                    available: false,
                    card: null
                });
                scores.push(0);
                continue;
            }

            const processedCard = this.processCardWithContext(fullCard, weights, processedSelectedCards);
            if (processedCard) {
                limitBreakProgression.push({
                    limitBreak: lb,
                    score: processedCard.score,
                    available: true,
                    card: processedCard
                });
                scores.push(processedCard.score);
            } else {
                limitBreakProgression.push({
                    limitBreak: lb,
                    score: 0,
                    available: false,
                    card: null
                });
                scores.push(0);
            }
        }

        // Calculate power spikes
        const powerSpikes = [];
        const significantSpikes = [];

        for (let i = 1; i < scores.length; i++) {
            if (scores[i] > 0 && scores[i - 1] > 0) {
                const increase = scores[i] - scores[i - 1];
                const percentIncrease = (increase / scores[i - 1]) * 100;
                const isSignificant = percentIncrease > 15;

                const spike = {
                    fromLB: i - 1,
                    toLB: i,
                    scoreIncrease: increase,
                    percentIncrease,
                    isSignificant
                };

                powerSpikes.push(spike);
                if (isSignificant) {
                    significantSpikes.push(spike);
                }
            }
        }

        // Calculate total progression
        const lb0Score = scores[0] > 0 ? scores[0] : scores.find(s => s > 0) || 0;
        const lb4Score = scores[4];
        const totalIncrease = lb4Score - lb0Score;
        const totalPercentIncrease = lb0Score > 0 ? (totalIncrease / lb0Score) * 100 : 0;

        // Calculate recommended minimum LB
        const recommendedMinLB = this.calculateRecommendedMinLB(powerSpikes, scores);

        return {
            limitBreakProgression,
            powerSpikes,
            totalProgression: {
                lb0Score,
                lb4Score,
                totalIncrease,
                totalPercentIncrease
            },
            significantSpikes,
            recommendedMinLB,
            tierProgression: null // Will be calculated later if needed
        };
    }

    processCardWithContext(card, weights, selectedCards = []) {
        // Filter by type if specified
        if (weights.type !== -1 && card.type !== weights.type) {
            return null;
        }

        // Calculate base values
        const presentTypes = new Array(7).fill(false);
        const cardsPerType = [[], [], [], [], [], [], []];
        let baseBondNeeded = 0;

        // Process selected cards (matching Angular service)
        selectedCards.forEach(selectedCard => {
            presentTypes[selectedCard.type] = true;
            cardsPerType[selectedCard.type].push(selectedCard);
            baseBondNeeded += selectedCard.type === 6 ? (55 - selectedCard.sb) : (75 - selectedCard.sb);
            // Subtract event bond if present
            if (this.cardEvents[selectedCard.id]) {
                baseBondNeeded -= this.cardEvents[selectedCard.id][7] || 0;
            }
        });

        // Add current card to calculations
        const extendedCard = {
            ...card,
            cardType: card.type,
            index: 6
        };

        const bondNeeded = 0 + (card.type === 6 ? (55 - card.sb) : (75 - card.sb));
        presentTypes[card.type] = true;
        const typeCount = presentTypes.filter(Boolean).length;

        // Calculate training days
        const totalDays = 65 - weights.races[0] - weights.races[1] - weights.races[2];
        const trainingDays = card.type === 6 ? totalDays - 5 : totalDays;
        const daysToBond = Math.ceil(bondNeeded / weights.bondPerDay);
        const rainbowDays = trainingDays - daysToBond;

        // Calculate specialty rates
        const specialty = (100 + card.specialty_rate + weights.bonusSpec) *
            card.unique_specialty * card.fs_specialty;
        const specialtyPercent = specialty / (450 + specialty);
        const otherPercent = 100 / (450 + specialty);

        extendedCard.rainbowSpecialty = specialtyPercent;
        extendedCard.offSpecialty = otherPercent;

        // Calculate preferred rainbow chances for other types
        const preferredRainbowChances = this.calculatePreferredRainbowChances(
            cardsPerType,
            weights,
            card.type
        );

        // Calculate rainbow override (matching Angular service)
        let rainbowOverride = 1;
        if (card.type < 6) {
            const chanceOfPreferredRainbow = 1 - preferredRainbowChances.reduce(
                (current, chance) => current * (1 - chance), 1
            );

            const cardsOfThisType = [...cardsPerType[card.type], extendedCard];
            let chanceOfSingleRainbow = 0;

            cardsOfThisType.forEach(c => {
                chanceOfSingleRainbow += this.calculateCombinationChance(
                    [c],
                    cardsOfThisType,
                    card.type
                );
            });

            rainbowOverride = 1 - (chanceOfPreferredRainbow * chanceOfSingleRainbow);
        }

        // Calculate appearance rates (matching Angular service)
        const daysPerTraining = new Array(5).fill(0);
        const bondedDaysPerTraining = new Array(5).fill(0);
        let rainbowTraining = 0;

        for (let stat = 0; stat < 5; stat++) {
            if (stat === card.type) {
                rainbowTraining = specialtyPercent * rainbowDays * rainbowOverride;
                daysPerTraining[stat] = specialtyPercent * daysToBond;
            } else {
                daysPerTraining[stat] = otherPercent / card.offstat_appearance_denominator * daysToBond;
                bondedDaysPerTraining[stat] = otherPercent / card.offstat_appearance_denominator * rainbowDays;
            }
        }

        if (weights.onlySummer) {
            rainbowTraining = 8 * specialtyPercent * rainbowOverride;
        }

        // Calculate event stats
        const eventStats = this.getEventStats(card.id);

        // Calculate all gains
        const { statGains, energyGain, nonRainbowGains, rainbowGains } = 
            this.calculateAllGains(
                extendedCard,
                weights,
                selectedCards,
                daysPerTraining,
                bondedDaysPerTraining,
                rainbowTraining,
                typeCount
            );

        // Add event stats (matching Angular service)
        const totalStatGains = [...statGains];
        for (let i = 0; i < 6; i++) {
            if (eventStats[i]) {
                totalStatGains[i] += eventStats[i] * card.effect_size_up;
            }
        }

        // Add event energy
        let totalEnergyGain = energyGain;
        if (eventStats[6]) {
            totalEnergyGain += eventStats[6] * card.energy_up;
        }

        // Calculate race bonus
        const raceBonusGains = this.calculateRaceBonus(card, weights);
        for (let i = 0; i < 6; i++) {
            totalStatGains[i] += raceBonusGains;
        }

        // Calculate final score
        let score = card.sb;
        score += this.gainsToScore(totalStatGains, weights);
        score += totalEnergyGain * weights.stats[6];

        // Add bond from event if present
        if (eventStats[7]) {
            score += eventStats[7];
        }

        // Add scenario bonus
        if (weights.scenarioLink.includes(card.char_name)) {
            score += weights.scenarioBonus;
        }

        // Build card info
        const info = {
            starting_stats: [...card.starting_stats],
            event_stats: [...eventStats],
            non_rainbow_gains: [...nonRainbowGains],
            rainbow_gains: [...rainbowGains],
            race_bonus_gains: raceBonusGains,
            skills_score: 0,
            linked_training_gains: totalStatGains,
            debug: {
                originalCard: {
                    id: card.id,
                    char_name: card.char_name,
                    type: card.type,
                    rarity: card.rarity,
                    limit_break: card.limit_break,
                    starting_stats: [...card.starting_stats],
                    tb: card.tb,
                    mb: card.mb,
                    fs_bonus: card.fs_bonus,
                    unique_fs_bonus: card.unique_fs_bonus,
                    unique_specialty: card.unique_specialty,
                    sb: card.sb,
                    stat_bonus: [...card.stat_bonus],
                    race_bonus: card.race_bonus,
                    specialty_rate: card.specialty_rate,
                    fs_specialty: card.fs_specialty
                },
                calculations: {
                    baseBondNeeded: bondNeeded,
                    daysToBond,
                    rainbowDays,
                    trainingDays,
                    specialtyPercent: specialtyPercent * 100,
                    typeCount,
                    rainbowTraining,
                    daysPerTraining,
                    bondedDaysPerTraining
                },
                scoreBreakdown: {
                    startingBond: card.sb,
                    startingStatsScore: card.starting_stats.reduce((sum, stat, i) => sum + (stat * weights.stats[i] || 0), 0),
                    eventStatsScore: eventStats.reduce((sum, stat, i) => sum + (stat * weights.stats[i] || 0), 0),
                    nonRainbowTrainingScore: this.gainsToScore(nonRainbowGains, weights),
                    rainbowTrainingScore: this.gainsToScore(rainbowGains, weights),
                    raceBonusScore: raceBonusGains,
                    energyScore: totalEnergyGain * weights.stats[6],
                    skillsScore: 0,
                    startingStatsBonus: 0,
                    uniqueEffectsBonus: 0,
                    scenarioBonus: weights.scenarioLink.includes(card.char_name) ? weights.scenarioBonus : 0,
                    totalScore: score
                }
            }
        };

        return {
            id: card.id,
            lb: card.limit_break,
            score: score,
            info,
            char_name: card.char_name
        };
    }

    /**
     * Calculate race bonus (fixed to match Angular service)
     */
    calculateRaceBonus(card, weights) {
        let totalBonus = 0;

        weights.races.forEach((raceCount, raceType) => {
            if (raceCount > 0 && raceType < 4) {
                // Fixed race bonus calculation to match Angular service
                const raceRewards = [
                    [2, 2, 2, 2, 2, 35],      // Race type 0
                    [1.6, 1.6, 1.6, 1.6, 1.6, 25], // Race type 1
                    [1, 1, 1, 1, 1, 20],      // Race type 2
                    [13.5, 13.5, 13.5, 13.5, 13.5, 50] // Race type 3
                ];

                const rewards = raceRewards[raceType];
                if (rewards) {
                    // Calculate weighted stat bonus from races
                    for (let i = 0; i < 5; i++) {
                        totalBonus += rewards[i] * weights.stats[i] * raceCount;
                    }
                    // Add skill points with reduced weight
                    totalBonus += rewards[5] * raceCount * 0.1;
                }
            }
        });

        return totalBonus * (1 + card.race_bonus / 100);
    }

    /**
     * Convert gains to score (with cap)
     */
    gainsToScore(gains, weights) {
        let score = 0;
        for (let stat = 0; stat < 6; stat++) {
            score += Math.min(gains[stat], weights.cap) * (weights.stats[stat] || 0);
        }
        return score;
    }

    /**
     * Get event stats for a card (fixed to match Angular service)
     */
    getEventStats(cardId) {
        const events = this.cardEvents[cardId];
        if (!events) {
            // Return dummy values based on rarity
            const card = this.cardData.get(cardId + "_4");
            if (card) {
                if (card.rarity === 2) {
                    // SR: 35 total stats
                    return [7, 7, 7, 7, 7, 0, 0, 5]; // 5 bond at index 7
                } else if (card.rarity === 3) {
                    // SSR: 45 total stats
                    return [9, 9, 9, 9, 9, 0, 0, 5]; // 5 bond at index 7
                }
            }
            return [0, 0, 0, 0, 0, 0, 0, 0];
        }
        return events.slice(0, 8);
    }

    /**
     * Get full card data by ID and limit break level
     */
    getFullCardDataByID(cardId, limitBreak = 4) {
        const key = `${cardId}_${limitBreak}`;
        return this.cardData.get(key) || null;
    }

    /**
     * Preprocess selected cards to calculate specialty rates
     */
    preprocessSelectedCards(selectedCards, weights) {
        return selectedCards.map((card, index) => {
            const cardSpecialty = (100 + card.specialty_rate + weights.bonusSpec) *
                card.unique_specialty * card.fs_specialty;
            const cardSpecialtyPercent = cardSpecialty / (450 + cardSpecialty);

            return {
                ...card,
                rainbowSpecialty: cardSpecialtyPercent,
                offSpecialty: 100 / (450 + cardSpecialty),
                cardType: card.type,
                index: index
            };
        });
    }

    /**
     * Calculate preferred rainbow chances for other types (matching Angular service)
     */
    calculatePreferredRainbowChances(cardsPerType, weights, currentType) {
        const chances = new Array(5).fill(0);

        for (let i = 0; i < 5; i++) {
            if (i !== currentType && cardsPerType[i].length > 0) {
                const minimum = weights.prioritize ? 2 : 1;
                const combos = this.getCombinations(cardsPerType[i], minimum);

                if (combos.length > 0) {
                    chances[i] = combos.reduce((current, combo) => {
                        return current + this.calculateCombinationChance(combo, undefined, i);
                    }, 0);
                }
            }
        }

        return chances;
    }

    /**
     * Calculate combination chance (matching Angular service)
     */
    calculateCombinationChance(combination, cards, trainingType) {
        let chance = combination.reduce((current, card) => {
            if (card.cardType === trainingType) {
                return current * (card.rainbowSpecialty || 0);
            } else {
                return current * (card.offSpecialty || 0);
            }
        }, 1);

        if (cards) {
            const otherCards = cards.filter(c =>
                combination.findIndex(d => c.index === d.index) === -1
            );

            chance = otherCards.reduce((current, card) => {
                if (card.cardType === trainingType) {
                    return current * (1 - (card.rainbowSpecialty || 0));
                } else {
                    return current * (1 - (card.offSpecialty || 0));
                }
            }, chance);
        }

        return chance;
    }

    /**
     * Get all combinations of cards (matching Angular service)
     */
    getCombinations(cards, minLength = 1) {
        const combinations = [];
        const count = Math.pow(2, cards.length);

        for (let i = 0; i < count; i++) {
            const temp = [];
            for (let j = 0; j < cards.length; j++) {
                if (i & Math.pow(2, j)) {
                    temp.push(cards[j]);
                }
            }
            if (temp.length >= minLength) {
                combinations.push(temp);
            }
        }

        return combinations;
    }

    /**
     * Calculate all training gains (matching Angular service)
     */
    calculateAllGains(card, weights, selectedCards, daysPerTraining, bondedDaysPerTraining, rainbowTraining, typeCount) {
        const statGains = [...card.starting_stats, 0];
        let energyGain = 0;
        const nonRainbowGains = new Array(7).fill(0);
        const rainbowGains = new Array(7).fill(0);

        // Apply type_stats if present
        if (card.type_stats > 0) {
            statGains[card.type] += card.type_stats;
            selectedCards.forEach(selectedCard => {
                if (selectedCard.type < 6) {
                    statGains[selectedCard.type] += card.type_stats;
                } else {
                    // Distribute evenly for friend cards
                    for (let i = 0; i < 5; i++) {
                        statGains[i] += card.type_stats / 5;
                    }
                }
            });
        }

        // Apply fs_ramp if present
        if (card.fs_ramp && card.fs_ramp[0] > 0 && rainbowTraining > 0) {
            let current_bonus = 0;
            let total = 0;
            for (let j = rainbowTraining * 0.66; j > 0; j--) {
                total += current_bonus;
                current_bonus = Math.min(current_bonus + card.fs_ramp[0], card.fs_ramp[1]);
            }
            card.unique_fs_bonus = 1 + total / rainbowTraining / 100;
        }

        // Calculate non-rainbow cross-training
        for (let training = 0; training < 5; training++) {
            const unbondedGains = this.calculateCrossTrainingGain(
                weights.unbondedTrainingGain[training],
                weights,
                card,
                selectedCards,
                training,
                daysPerTraining[training],
                typeCount,
                false
            );

            const bondedGains = this.calculateCrossTrainingGain(
                weights.bondedTrainingGain[training],
                weights,
                card,
                selectedCards,
                training,
                bondedDaysPerTraining[training],
                typeCount,
                true
            );

            for (let stat = 0; stat < 6; stat++) {
                statGains[stat] += unbondedGains[stat] + bondedGains[stat];
                nonRainbowGains[stat] += unbondedGains[stat] + bondedGains[stat];
            }

            energyGain += daysPerTraining[training] * weights.unbondedTrainingGain[training][6] * card.energy_discount;
            energyGain += bondedDaysPerTraining[training] * weights.bondedTrainingGain[training][6] * card.energy_discount;
            energyGain += bondedDaysPerTraining[training] * weights.bondedTrainingGain[training][6] * card.fs_energy;

            if (training === 4 && card.group) {
                energyGain += bondedDaysPerTraining[training] * card.wisdom_recovery / 5;
            }
        }

        // Calculate rainbow training
        if (card.type < 6) {
            energyGain += rainbowTraining * card.wisdom_recovery;

            const specialtyGains = weights.onlySummer ?
                weights.summerTrainingGain[card.type] :
                weights.bondedTrainingGain[card.type];

            const trainingGains = this.calculateTrainingGain(
                specialtyGains,
                weights,
                card,
                selectedCards,
                card.type,
                rainbowTraining,
                true,
                typeCount
            );

            for (let stat = 0; stat < 6; stat++) {
                statGains[stat] += trainingGains[stat];
                rainbowGains[stat] = trainingGains[stat];
            }
        }

        return { statGains, energyGain, nonRainbowGains, rainbowGains };
    }

    /**
     * Calculate training gain for rainbow training (matching Angular service)
     */
    calculateTrainingGain(gains, weights, card, otherCards, trainingType, days, rainbow, typeCount) {
        const trainingGains = new Array(7).fill(0);

        let trainingBonus = card.tb + card.fan_bonus * weights.fanBonus;
        if (typeCount >= card.highlander_threshold) {
            trainingBonus += card.highlander_training;
        }

        let fsBonus = 1;
        let motivationBonus = 1 + card.mb / 100;

        if (rainbow) {
            fsBonus = card.fs_bonus * card.unique_fs_bonus;
            motivationBonus += card.fs_motivation;
            trainingBonus += card.fs_training;
        }

        // Calculate solo gain
        const soloGain = new Array(6).fill(0);
        for (let stat = 0; stat < 6; stat++) {
            if (gains[stat] === 0) continue;

            let base = gains[stat] + card.stat_bonus[stat];
            if (rainbow) {
                base += card.fs_stats[stat];
            }

            soloGain[stat] = (base * trainingBonus * (1 + weights.motivation * motivationBonus) *
                fsBonus * 1.05 * weights.umaBonus[stat] - gains[stat]);
        }

        if (this.gainsToScore(soloGain, weights) > weights.minimum) {
            for (let stat = 0; stat < 6; stat++) {
                trainingGains[stat] += soloGain[stat] * days *
                    this.calculateCombinationChance([], otherCards, trainingType) *
                    (rainbow ? weights.multi : 1);
            }
        }

        if (otherCards.length === 0) return trainingGains;

        // Calculate combinations
        const combinations = this.getCombinations(otherCards);

        combinations.forEach(combination => {
            const fullCombinationGains = new Array(6).fill(0);
            const fullTotalGains = new Array(6).fill(0);

            trainingBonus += (combination.length + 1) * card.crowd_bonus;

            const combinationTrainingBonus = combination.reduce((current, c) => {
                let training = current + (c.tb - 1) + (combination.length * c.crowd_bonus);
                if (typeCount >= c.highlander_threshold) {
                    training += c.highlander_training;
                }
                return training;
            }, 1);

            const combinationFriendshipBonus = combination.reduce((current, c) => {
                if (c.cardType === trainingType) {
                    return current * c.fs_bonus * c.unique_fs_bonus;
                }
                return current;
            }, 1);

            const combinationMotivationBonus = combination.reduce((current, c) => current + c.mb / 100, 0);

            for (let stat = 0; stat < 6; stat++) {
                if (gains[stat] === 0) continue;

                const combinationStatBonus = combination.reduce((current, c) => current + c.stat_bonus[stat], 0);
                let base = gains[stat] + combinationStatBonus;
                if (rainbow) {
                    base += card.fs_stats[stat];
                }

                const combinationGains = base * combinationTrainingBonus *
                    (1 + weights.motivation * combinationMotivationBonus) *
                    combinationFriendshipBonus * (1.05 * combination.length) * weights.umaBonus[stat];

                const totalGains = (base + card.stat_bonus[stat]) *
                    (combinationTrainingBonus + trainingBonus - 1) *
                    (1 + weights.motivation * (1 + motivationBonus + combinationMotivationBonus)) *
                    (combinationFriendshipBonus * fsBonus) *
                    (1.05 * (combination.length + 1)) * weights.umaBonus[stat];

                fullCombinationGains[stat] = combinationGains;
                fullTotalGains[stat] = totalGains;
            }

            trainingBonus -= (combination.length + 1) * card.crowd_bonus;

            if (this.gainsToScore(fullTotalGains, weights) > weights.minimum) {
                for (let stat = 0; stat < 6; stat++) {
                    trainingGains[stat] += (fullTotalGains[stat] - fullCombinationGains[stat]) *
                        days * this.calculateCombinationChance(combination, otherCards, trainingType) *
                        (rainbow ? weights.multi : 1);
                }
            }
        });

        return trainingGains;
    }

    /**
     * Calculate cross-training gain for non-rainbow training (matching Angular service)
     */
    calculateCrossTrainingGain(gains, weights, card, otherCards, trainingType, days, typeCount, bonded) {
        const trainingGains = new Array(7).fill(0);
        const statCards = otherCards.filter(c => c.cardType === trainingType);

        let trainingBonus = card.tb + card.fan_bonus * weights.fanBonus;
        if (typeCount >= card.highlander_threshold) {
            trainingBonus += card.highlander_training;
        }

        let fsBonus = 1;
        if (card.group && bonded) {
            fsBonus += (card.fs_bonus + card.unique_fs_bonus - 1) / 5;
        }

        const combinations = this.getCombinations(otherCards);

        combinations.forEach(combination => {
            const fullCombinationGains = new Array(6).fill(0);
            const fullTotalGains = new Array(6).fill(0);

            trainingBonus += (combination.length + 1) * card.crowd_bonus;

            const combinationTrainingBonus = combination.reduce((current, c) => {
                let training = current + (c.tb - 1) + (combination.length * c.crowd_bonus);
                if (typeCount >= c.highlander_threshold) {
                    training += c.highlander_training;
                }
                return training;
            }, 1);

            const combinationFriendshipBonus = combination.reduce((current, c) => {
                if (c.cardType === trainingType) {
                    return current * c.fs_bonus * c.unique_fs_bonus;
                }
                return current;
            }, 1);

            const combinationMotivationBonus = combination.reduce((current, c) => current + c.mb / 100, 0);

            for (let stat = 0; stat < 6; stat++) {
                if (gains[stat] === 0) continue;
                // Check if combination includes cards of the training type (matching Angular service)
                if (!combination.some(r => statCards.indexOf(r) > -1)) continue;

                const combinationStatBonus = combination.reduce((current, c) => current + c.stat_bonus[stat], 0);
                const base = gains[stat] + combinationStatBonus;

                const combinationGains = base * combinationTrainingBonus *
                    (1 + weights.motivation * combinationMotivationBonus) *
                    combinationFriendshipBonus * (1.05 * combination.length) * weights.umaBonus[stat];

                let totalGains = 0;
                if (bonded) {
                    totalGains = (base + card.stat_bonus[stat] + card.fs_stats[stat]) *
                        (combinationTrainingBonus + trainingBonus + card.fs_training - 1) *
                        (1 + weights.motivation * (1 + card.mb / 100 + card.fs_motivation / 100 + combinationMotivationBonus)) *
                        (combinationFriendshipBonus * fsBonus) *
                        (1.05 * (combination.length + 1)) * weights.umaBonus[stat];
                } else {
                    totalGains = (base + card.stat_bonus[stat]) *
                        (combinationTrainingBonus + trainingBonus - 1) *
                        (1 + weights.motivation * (1 + card.mb / 100 + combinationMotivationBonus)) *
                        (1.05 * (combination.length + 1)) * weights.umaBonus[stat];
                }

                fullCombinationGains[stat] = combinationGains;
                fullTotalGains[stat] = totalGains;
            }

            trainingBonus -= (combination.length + 1) * card.crowd_bonus;

            if (this.gainsToScore(fullTotalGains, weights) > weights.minimum) {
                for (let stat = 0; stat < 6; stat++) {
                    trainingGains[stat] += (fullTotalGains[stat] - fullCombinationGains[stat]) *
                        days * this.calculateCombinationChance(combination, otherCards, trainingType) *
                        weights.multi;
                }
            }
        });

        return trainingGains;
    }

    calculateRecommendedMinLB(powerSpikes, scores) {
        // Find the LB where the card becomes "competitive" (reaches 70% of max power)
        const maxScore = scores[scores.length - 1];
        const threshold = maxScore * 0.7;
        
        for (let i = 0; i < scores.length; i++) {
            if (scores[i] >= threshold) {
                return i;
            }
        }
        
        return 4; // Default to max LB if no threshold is met
    }

    /**
     * Calculate estimated global release date based on timeline service logic
     * This mirrors the calculation used in support-card.service.ts
     */
    calculateGlobalReleaseDate(jpDate, globalLaunchDate) {
        // Days since JP launch
        const daysSinceJpLaunch = Math.floor((jpDate.getTime() - this.jpLaunchDate.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate adjusted days for global (faster release schedule)
        const adjustedDays = Math.floor(daysSinceJpLaunch * this.catchupRate);

        // Global release date = Global launch + adjusted days
        const globalDate = new Date(globalLaunchDate);
        globalDate.setDate(globalDate.getDate() + adjustedDays);

        return globalDate;
    }

    /**
     * Check if a card is released globally by a specific date
     */
    isCardReleasedGlobally(card, cutoffDate = new Date()) {
        // Parse the card's JP release date
        const jpReleaseDate = new Date(card.release_date);
        if (isNaN(jpReleaseDate.getTime())) {
            console.log(`Invalid release date for card ${card.id}: ${card.release_date}`);
            return false;
        }

        // Add grace period to the cutoff date
        const effectiveCutoffDate = new Date(cutoffDate);
        effectiveCutoffDate.setDate(effectiveCutoffDate.getDate() + this.gracePeriodDays);

        // Calculate estimated global release date using timeline logic
        const estimatedGlobalDate = this.calculateGlobalReleaseDate(jpReleaseDate, this.globalReleaseDate);

        // Return true if the card should be released by the cutoff date (including grace period)
        return estimatedGlobalDate <= effectiveCutoffDate;
    }

    /**
     * Get card type for a given card ID
     */
    getCardType(cardId) {
        // Look through all cards to find the type
        for (const [key, card] of this.cardData.entries()) {
            if (card.id.toString() === cardId.toString()) {
                return card.type;
            }
        }
        return null;
    }
}

// Default meta decks for preprocessing context
const DEFAULT_META_DECKS = [
    {
        name: "Each Meta",
        description: "Optimal speed-focused deck",
        cardIds: ["30021", "30005", "30002", "30016", "30019", "30010"]
    },
    {
        name: "Speed Meta", 
        description: "Optimal speed-focused deck",
        cardIds: ["30001", "30002", "30021", "30031", "30041", "30051"]
    },
    {
        name: "Stamina Meta",
        description: "Optimal stamina-focused deck", 
        cardIds: ["30011", "30001", "30021", "30031", "30041", "30051"]
    },
    {
        name: "Power Meta",
        description: "Optimal power-focused deck",
        cardIds: ["30021", "30001", "30011", "30031", "30041", "30051"]
    },
    {
        name: "Balanced Meta",
        description: "Balanced optimal deck",
        cardIds: ["30001", "30011", "30021", "30031", "30041", "30051"]
    }
];

module.exports = { TierlistCalculationEngine, DEFAULT_META_DECKS };
