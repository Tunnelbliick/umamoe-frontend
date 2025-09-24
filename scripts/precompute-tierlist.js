#!/usr/bin/env node

/**
 * Precompute Tierlist Build Script
 * 
 * This script runs during build time to precompute all tierlist calculations
 * and generate JSON files for the frontend to consume, eliminating runtime calculations.
 */

const fs = require('fs');
const path = require('path');

// Import the calculation engine
const { TierlistCalculationEngine } = require('./tierlist-calculation-engine');

const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'data');
const PRECOMPUTED_FILE = path.join(OUTPUT_DIR, 'precomputed-tierlist.json');

// Default URA weights for calculations
const DEFAULT_URA_WEIGHTS = {
    type: -1,
    stats: [1.7, 1.4, 1.65, 1.2, 1.2, 0.75, 1.5],
    cap: 1200,
    unbondedTrainingGain: [
        [11, 0, 6, 0, 0, 4, 5],
        [0, 10, 0, 6, 0, 4, 5],
        [0, 6, 9, 0, 0, 4, 5],
        [5, 0, 5, 8, 0, 4, 5],
        [2, 0, 0, 0, 10, 5, 5]
    ],
    bondedTrainingGain: [
        [18, 0, 8, 0, 0, 5, 6],
        [0, 16, 0, 8, 0, 5, 6],
        [0, 8, 15, 0, 0, 5, 6],
        [8, 0, 8, 13, 0, 5, 6],
        [3, 0, 0, 0, 16, 6, 6]
    ],
    summerTrainingGain: [
        [22, 0, 10, 0, 0, 6, 7],
        [0, 20, 0, 10, 0, 6, 7],
        [0, 10, 18, 0, 0, 6, 7],
        [10, 0, 10, 16, 0, 6, 7],
        [4, 0, 0, 0, 20, 7, 7]
    ],
    bondPerDay: 4.0,
    races: [2, 1, 1],
    umaBonus: [1.06, 1.06, 1.06, 1.06, 1.06, 1.0],
    bonusSpec: 0,
    minimum: 50,
    motivation: 0.2,
    multi: 1.25,
    fanBonus: 0.1,
    scenarioLink: [],
    scenarioBonus: 0,
    prioritize: false,
    onlySummer: false
};

const TIER_PERCENTILES = {
    'S+': { min: 99, max: 100 },
    'S': { min: 95, max: 98.99 },
    'A': { min: 80, max: 94.99 },
    'B': { min: 60, max: 79.99 },
    'C': { min: 30, max: 59.99 },
    'D': { min: 0, max: 29.99 }
};

async function main() {
    console.log('🚀 Starting tierlist precomputation...');
    
    try {
        // Ensure output directory exists
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        // Initialize calculation engine
        const engine = new TierlistCalculationEngine();
        await engine.initialize();

        // Calculate tierlists for each type
        const result = {
            metadata: {
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
                weights: DEFAULT_URA_WEIGHTS,
                globalReleaseFilterEnabled: true,
                globalLaunchDate: '2025-06-26T22:00:00Z',
                jpLaunchDate: '2021-02-24T22:00:00Z',
                catchupRate: 1 / 1.6,
                gracePeriodDays: 2
            },
            cards: {},
            typeData: {}
        };

        console.log('📊 Calculating tierlists for all types...');

        // Calculate for each stat type (0-4)
        for (let type = 0; type < 5; type++) {
            console.log(`  Computing type ${type}...`);
            
            const typeWeights = { ...DEFAULT_URA_WEIGHTS, type };
            const allCards = await engine.calculateTierlistByType(type, typeWeights);
            
            // Group cards by LB level
            const cardsByLB = {};
            for (let lb = 0; lb <= 4; lb++) {
                cardsByLB[lb] = allCards.filter(card => card.lb === lb);
            }
            
            // Calculate total cards for this type
            result.typeData[type] = {
                totalCards: allCards.length,
                tierDistribution: {} // Will be calculated after processing all LB levels
            };

            // Process each LB level separately
            for (let lb = 0; lb <= 4; lb++) {
                const lbCards = cardsByLB[lb];
                if (lbCards.length === 0) continue;

                // Calculate tiers for this specific LB level
                lbCards.forEach(card => {
                    const cardId = card.id;
                    
                    // Initialize card data if it doesn't exist
                    if (!result.cards[cardId]) {
                        result.cards[cardId] = {
                            id: cardId,
                            name: card.char_name,
                            type: card.info.debug?.originalCard?.type || type,
                            rarity: card.info.debug?.originalCard?.rarity || 3,
                            scores: new Array(5).fill(0),
                            tiers: new Array(5).fill('D'),
                            powerProgression: null
                        };
                    }

                    // Set score and tier for this specific LB level
                    result.cards[cardId].scores[lb] = Math.round(card.score);
                    result.cards[cardId].tiers[lb] = getTierForScore(card.score, lbCards); // Compare only within same LB level
                });
            }
            
            // Calculate tier distribution for LB4 (most relevant for tier display)
            const lb4Cards = cardsByLB[4] || [];
            result.typeData[type].tierDistribution = calculateTierDistribution(lb4Cards);
        }

        console.log('🔄 Computing power progression for all cards...');

        // Calculate power progression from the already-processed cards
        const uniqueCardIds = Object.keys(result.cards);
        for (const cardId of uniqueCardIds) {
            const cardData = result.cards[cardId];
            const scores = cardData.scores;
            
            // Calculate power spikes from scores
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
                        percentIncrease: percentIncrease
                    };

                    powerSpikes.push(spike);
                    if (isSignificant) {
                        significantSpikes.push(spike);
                    }
                }
            }

            // Calculate total progression
            const firstScore = scores.find(s => s > 0) || 0;
            const lastScore = scores[scores.length - 1];
            const totalGrowthPercent = Math.round(firstScore > 0 ? ((lastScore - firstScore) / firstScore) * 100 : 0);

            // Determine recommended minimum LB
            let recommendedMinLB = 0;
            const maxScore = Math.max(...scores);
            for (let i = 0; i < scores.length; i++) {
                if (scores[i] >= maxScore * 0.9) { // 90% of max score
                    recommendedMinLB = i;
                    break;
                }
            }

            // Set power progression data
            result.cards[cardId].powerProgression = {
                totalGrowthPercent: totalGrowthPercent,
                recommendedMinLB: recommendedMinLB,
                powerSpike: getPowerSpikeDescription(significantSpikes),
                tierProgression: null // Could be calculated if needed
            };
        }

        // Write the precomputed data (minified)
        console.log('💾 Writing precomputed data (minified)...');
        fs.writeFileSync(PRECOMPUTED_FILE, JSON.stringify(result));

        // Generate summary
        const totalCards = Object.keys(result.cards).length;
        const typeCounts = Object.values(result.typeData).map(t => t.totalCards);
        
        console.log('✅ Precomputation complete!');
        console.log(`   Total unique cards: ${totalCards}`);
        console.log(`   Type distribution: ${typeCounts.join(', ')}`);
        console.log(`   Output file: ${PRECOMPUTED_FILE}`);
        console.log(`   File size: ${(fs.statSync(PRECOMPUTED_FILE).size / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
        console.error('❌ Precomputation failed:', error);
        process.exit(1);
    }
}

function calculateTierDistribution(cards) {
    const distribution = {};
    
    cards.forEach(card => {
        const tier = getTierForScore(card.score, cards);
        distribution[tier] = (distribution[tier] || 0) + 1;
    });
    
    return distribution;
}

function getTierForScore(score, allCards) {
    const sortedCards = [...allCards].sort((a, b) => b.score - a.score);
    const totalCards = sortedCards.length;
    const cardIndex = sortedCards.findIndex(card => card.score <= score);
    const percentile = ((totalCards - cardIndex) / totalCards) * 100;

    for (const [tier, range] of Object.entries(TIER_PERCENTILES)) {
        if (percentile >= range.min && percentile <= range.max) {
            return tier;
        }
    }
    return 'D';
}

function getPowerSpikeDescription(significantSpikes) {
    if (!significantSpikes || significantSpikes.length === 0) {
        return 'Gradual';
    }
    
    if (significantSpikes.length === 1) {
        return `LB${significantSpikes[0].toLB}`;
    }
    
    return significantSpikes.map(spike => `LB${spike.toLB}`).join(', ');
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
