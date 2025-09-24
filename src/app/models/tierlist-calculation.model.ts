export interface SupportCard {
    id: string;
    name: string;
    char_name: string;
    char_id?: string;
    type: number; // 0=Speed, 1=Stamina, 2=Power, 3=Guts, 4=Intelligence, 6=Friend
    rarity: number;
    limit_break: number;

    // Training bonuses
    tb: number; // training bonus
    mb: number; // motivation bonus
    sb: number; // starting bond

    // Friendship system
    specialty_rate: number;
    unique_specialty: number;
    fs_specialty: number;
    fs_bonus: number;
    unique_fs_bonus: number;
    fs_motivation: number;
    fs_training: number;
    fs_stats: number[];
    fs_energy: number;
    fs_ramp: number[];

    // Stats
    starting_stats: number[];
    stat_bonus: number[];
    type_stats: number;

    // Energy and race
    energy_up: number;
    energy_discount: number;
    wisdom_recovery: number;
    race_bonus: number;

    // Additional bonuses
    crowd_bonus: number;
    fan_bonus: number;
    highlander_threshold: number;
    highlander_training: number;
    offstat_appearance_denominator: number;
    effect_size_up: number;
    group?: boolean;
    hint_rate?: number; // Hint rate for skills^
    fail_rate_down?: number; // Failure rate down for skills
}

export interface CardEvent {
    [cardId: string]: number[]; // [speed, stamina, power, guts, intelligence, skillPt, energy, bond]
}

export interface TierlistWeights {
    type: number; // Card type being evaluated (-1 for all types)
    stats: number[]; // Weight for each stat [speed, stamina, power, guts, intelligence, skillPt, energy]
    cap: number;
    unbondedTrainingGain: number[][];
    bondedTrainingGain: number[][];
    summerTrainingGain: number[][];
    bondPerDay: number;
    races: number[]; // Number of each race type
    umaBonus: number[];
    motivation: number; // Motivation multiplier
    bonusSpec: number;
    minimum: number;
    multi: number;
    fanBonus: number;
    scenarioLink: string[];
    scenarioBonus: number;
    prioritize: boolean;
    onlySummer: boolean;
}

export interface PowerProgression {
    limitBreakProgression: Array<{
        limitBreak: number;
        score: number;
        available: boolean;
        card: ProcessedCard | null;
        tier?: string; // Tier at this LB level compared to other cards at same LB
        tierPercentile?: number; // Percentile within this LB level
    }>;
    powerSpikes: Array<{
        fromLB: number;
        toLB: number;
        scoreIncrease: number;
        percentIncrease: number;
        isSignificant: boolean;
    }>;
    totalProgression: {
        lb0Score: number;
        lb4Score: number;
        totalIncrease: number;
        totalPercentIncrease: number;
    };
    significantSpikes: Array<{
        fromLB: number;
        toLB: number;
        scoreIncrease: number;
        percentIncrease: number;
        isSignificant: boolean;
    }>;
    recommendedMinLB: number;
    tierProgression?: {
        lbTiers: string[]; // Tier at each LB level [lb0, lb1, lb2, lb3, lb4]
        tierChanges: Array<{
            fromLB: number;
            toLB: number;
            fromTier: string;
            toTier: string;
            isImprovement: boolean;
        }>;
    };
}

export interface ProcessedCard {
    id: string;
    lb: number;
    score: number;
    info: CardInfo;
    char_name: string;
    powerProgression?: PowerProgression;
}

export interface CardInfo {
    starting_stats: number[];
    event_stats: number[];
    non_rainbow_gains: number[];
    rainbow_gains: number[];
    race_bonus_gains: number;
    skills_score: number; // Placeholder for skills evaluation
    linked_training_gains: number[]; // Gains from linked training sessions
    debug?: CardDebugInfo; // Detailed debug information
}

export interface CardDebugInfo {
    originalCard: {
        id: string;
        char_name: string;
        type: number;
        rarity: number;
        limit_break: number;
        starting_stats: number[];
        tb: number;
        mb: number;
        fs_bonus: number;
        unique_fs_bonus: number;
        unique_specialty: number;
        sb: number;
        stat_bonus: number[];
        race_bonus: number;
        specialty_rate: number;
        fs_specialty: number;
    };
    calculations: {
        baseBondNeeded: number;
        daysToBond: number;
        rainbowDays: number;
        trainingDays: number;
        specialtyPercent: number;
        typeCount: number;
        rainbowOverride?: number;
        rainbowTraining?: number;
        daysPerTraining?: number[];
        bondedDaysPerTraining?: number[];
        bondSchedule?: Array<{
            cardId: string;
            daysToReachBond: number;
            cardName: string;
        }>;
        totalBondNeeded?: number;
        averageBondPerDay?: number;
    };
    scoreBreakdown: {
        startingBond: number;
        startingStatsScore?: number;
        eventStatsScore?: number;
        eventStats?: number;
        nonRainbowTrainingScore?: number;
        nonRainbowTraining?: number;
        rainbowTrainingScore?: number;
        rainbowTraining?: number;
        raceBonusScore?: number;
        raceBonus?: number;
        energyScore?: number;
        energy?: number;
        skillsScore: number;
        startingStatsBonus: number;
        uniqueEffectsBonus: number;
        scenarioBonus: number;
        totalScore: number;
    };
    bonusDetails?: {
        startingStatsBonus: {
            perStat: number[];
            total: number;
        };
        uniqueEffectsBonus: {
            trainingBonus: number;
            uniqueSpecialty: number;
            uniqueFriendshipBonus: number;
            friendshipBonus: number;
            motivationBonus: number;
            total: number;
        };
    };
    trainingDetails?: {
        nonRainbowGains: number[];
        rainbowGains: number[];
        totalTrainingGains: number[];
        energyGains: number;
    };
}

export interface SkillEvaluation {
    hinted_skills_value: number;
    event_skills_value: number;
    total_skills_score: number;
}

export interface MetaDeck {
    name: string;
    description: string;
    cardIds: string[]; // Array of 6 card IDs
}

export interface UpcomingCard {
    id: string;
    name: string;
    char_name: string;
    type: number;
    rarity: number;
    estimatedReleaseDate: string;
    predictedScore: number;
    predictedTier: string;
    isGlobalRelease: boolean;
    bannerInfo?: {
        startDate: string;
        endDate: string;
        image?: string;
    };
}

export interface ChartDataPoint {
    x: number; // score
    y: number; // position for stacking
    cardId: string;
    cardName: string;
    imageUrl: string;
    tier: string;
    isUpcoming?: boolean;
}

export const TIER_NAMES = ['S+', 'S', 'A', 'B', 'C', 'D'];

export const TIER_PERCENTILES = {
    'S+': { min: 99, max: 100 },  // Top 1%
    'S': { min: 95, max: 98.99 }, // Top 5%
    'A': { min: 80, max: 94.99 }, // Top 20%
    'B': { min: 60, max: 79.99 }, // Top 40%
    'C': { min: 30, max: 59.99 }, // Top 70%
    'D': { min: 0, max: 29.99 }   // Bottom 30%
};

export const TYPE_NAMES = ["Speed", "Stamina", "Power", "Guts", "Intelligence", "", "Friend"];

export const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

export const RACE_REWARDS = [
    [2, 2, 2, 2, 2, 35],      // Race type 0
    [1.6, 1.6, 1.6, 1.6, 1.6, 25], // Race type 1
    [1, 1, 1, 1, 1, 20],      // Race type 2
    [13.5, 13.5, 13.5, 13.5, 13.5, 50] // Race type 3
];

export const DEFAULT_URA_WEIGHTS: TierlistWeights = {
    type: -1,
    stats: [1.8, 1.2, 1.65, 1.2, 1.2, 1, 3],
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
    onlySummer: false,
    // Linked training configuration
};

export const DEFAULT_META_DECKS: MetaDeck[] = [
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
