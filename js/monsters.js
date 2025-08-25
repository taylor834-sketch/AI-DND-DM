export default class MonsterManager {
    constructor(core) {
        this.core = core;
        this.monsters = new Map();
        this.encounters = new Map();
        this.loadDefaultMonsters();
        this.init();
    }

    init() {
        this.core.on('monsters:getMonster', (event) => this.getMonster(event.detail.monsterId));
        this.core.on('monsters:createEncounter', (event) => this.createEncounter(event.detail));
        this.core.on('monsters:spawnMonster', (event) => this.spawnMonster(event.detail));
        this.core.on('monsters:searchMonsters', (event) => this.searchMonsters(event.detail));
    }

    loadDefaultMonsters() {
        const defaultMonsters = [
            {
                id: 'goblin',
                name: 'Goblin',
                size: 'Small',
                type: 'humanoid',
                alignment: 'Neutral Evil',
                armorClass: 15,
                hitPoints: 7,
                speed: '30 ft',
                abilities: {
                    strength: 8,
                    dexterity: 14,
                    constitution: 10,
                    intelligence: 10,
                    wisdom: 8,
                    charisma: 8
                },
                savingThrows: {},
                skills: { stealth: 6 },
                senses: 'darkvision 60 ft., passive Perception 9',
                languages: 'Common, Goblin',
                challengeRating: '1/4',
                experiencePoints: 50,
                actions: [
                    {
                        name: 'Scimitar',
                        type: 'Melee Weapon Attack',
                        attackBonus: 4,
                        reach: '5 ft',
                        targets: 'one target',
                        damage: '1d6 + 2',
                        damageType: 'slashing'
                    },
                    {
                        name: 'Shortbow',
                        type: 'Ranged Weapon Attack',
                        attackBonus: 4,
                        range: '80/320 ft',
                        targets: 'one target',
                        damage: '1d6 + 2',
                        damageType: 'piercing'
                    }
                ],
                specialAbilities: [
                    {
                        name: 'Nimble Escape',
                        description: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.'
                    }
                ]
            },
            {
                id: 'orc',
                name: 'Orc',
                size: 'Medium',
                type: 'humanoid',
                alignment: 'Chaotic Evil',
                armorClass: 13,
                hitPoints: 15,
                speed: '30 ft',
                abilities: {
                    strength: 16,
                    dexterity: 12,
                    constitution: 16,
                    intelligence: 7,
                    wisdom: 11,
                    charisma: 10
                },
                skills: { intimidation: 2 },
                senses: 'darkvision 60 ft., passive Perception 10',
                languages: 'Common, Orc',
                challengeRating: '1/2',
                experiencePoints: 100,
                actions: [
                    {
                        name: 'Greataxe',
                        type: 'Melee Weapon Attack',
                        attackBonus: 5,
                        reach: '5 ft',
                        targets: 'one target',
                        damage: '1d12 + 3',
                        damageType: 'slashing'
                    },
                    {
                        name: 'Javelin',
                        type: 'Melee or Ranged Weapon Attack',
                        attackBonus: 5,
                        range: '30/120 ft',
                        targets: 'one target',
                        damage: '1d6 + 3',
                        damageType: 'piercing'
                    }
                ],
                specialAbilities: [
                    {
                        name: 'Aggressive',
                        description: 'As a bonus action, the orc can move up to its speed toward a hostile creature that it can see.'
                    }
                ]
            },
            {
                id: 'dragon_wyrmling_red',
                name: 'Red Dragon Wyrmling',
                size: 'Medium',
                type: 'dragon',
                alignment: 'Chaotic Evil',
                armorClass: 17,
                hitPoints: 75,
                speed: '30 ft., climb 30 ft., fly 60 ft.',
                abilities: {
                    strength: 19,
                    dexterity: 10,
                    constitution: 17,
                    intelligence: 12,
                    wisdom: 11,
                    charisma: 15
                },
                savingThrows: {
                    dexterity: 2,
                    constitution: 5,
                    wisdom: 2,
                    charisma: 4
                },
                skills: { perception: 4, stealth: 2 },
                damageImmunities: ['fire'],
                senses: 'blindsight 10 ft., darkvision 60 ft., passive Perception 14',
                languages: 'Draconic',
                challengeRating: '4',
                experiencePoints: 1100,
                actions: [
                    {
                        name: 'Bite',
                        type: 'Melee Weapon Attack',
                        attackBonus: 6,
                        reach: '5 ft',
                        targets: 'one target',
                        damage: '1d10 + 4',
                        damageType: 'piercing',
                        additional: 'plus 1d6 fire damage'
                    },
                    {
                        name: 'Fire Breath',
                        type: 'Special',
                        recharge: '5-6',
                        description: '15-foot cone. Each creature must make a DC 13 Dexterity saving throw, taking 24 (7d6) fire damage on failure, or half as much on success.',
                        damage: '7d6',
                        damageType: 'fire'
                    }
                ]
            }
        ];

        defaultMonsters.forEach(monster => {
            this.monsters.set(monster.id, monster);
        });

        console.log(`🐉 Loaded ${defaultMonsters.length} default monsters`);
    }

    getMonster(monsterId) {
        const monster = this.monsters.get(monsterId);
        if (monster) {
            this.core.emit('monsters:retrieved', { monster, success: true });
            return monster;
        } else {
            const error = new Error(`Monster '${monsterId}' not found`);
            this.core.emit('monsters:retrieved', { success: false, error });
            return null;
        }
    }

    searchMonsters(criteria) {
        const { name, type, challengeRating, minCR, maxCR } = criteria;
        const results = [];

        this.monsters.forEach(monster => {
            let matches = true;

            if (name && !monster.name.toLowerCase().includes(name.toLowerCase())) {
                matches = false;
            }

            if (type && monster.type !== type) {
                matches = false;
            }

            if (challengeRating && monster.challengeRating !== challengeRating) {
                matches = false;
            }

            if (minCR || maxCR) {
                const cr = this.challengeRatingToNumber(monster.challengeRating);
                if (minCR && cr < this.challengeRatingToNumber(minCR)) matches = false;
                if (maxCR && cr > this.challengeRatingToNumber(maxCR)) matches = false;
            }

            if (matches) {
                results.push(monster);
            }
        });

        this.core.emit('monsters:searchResults', { results, criteria, success: true });
        return results;
    }

    spawnMonster(spawnData) {
        const { monsterId, customizations, quantity = 1 } = spawnData;
        const baseMonster = this.monsters.get(monsterId);
        
        if (!baseMonster) {
            const error = new Error(`Cannot spawn unknown monster: ${monsterId}`);
            this.core.emit('monsters:spawned', { success: false, error });
            return null;
        }

        const spawnedMonsters = [];
        
        for (let i = 0; i < quantity; i++) {
            const monster = this.createMonsterInstance(baseMonster, customizations, i);
            spawnedMonsters.push(monster);
        }

        this.core.emit('monsters:spawned', { 
            monsters: spawnedMonsters, 
            baseMonster: baseMonster.name,
            success: true 
        });

        console.log(`👹 Spawned ${quantity}x ${baseMonster.name}`);
        return spawnedMonsters;
    }

    createMonsterInstance(baseMonster, customizations = {}, index = 0) {
        const instance = {
            ...JSON.parse(JSON.stringify(baseMonster)),
            instanceId: `${baseMonster.id}_${Date.now()}_${index}`,
            currentHitPoints: baseMonster.hitPoints,
            maxHitPoints: baseMonster.hitPoints,
            conditions: [],
            initiative: 0,
            faction: customizations.faction || 'hostile',
            location: customizations.location || 'unknown',
            spawnedAt: new Date().toISOString()
        };

        if (customizations.name) {
            instance.name = customizations.name;
        } else if (quantity > 1) {
            instance.name = `${baseMonster.name} ${index + 1}`;
        }

        if (customizations.hitPointVariation) {
            const variation = Math.floor(Math.random() * customizations.hitPointVariation * 2) - customizations.hitPointVariation;
            instance.hitPoints = Math.max(1, baseMonster.hitPoints + variation);
            instance.currentHitPoints = instance.hitPoints;
            instance.maxHitPoints = instance.hitPoints;
        }

        if (customizations.abilityModifications) {
            Object.entries(customizations.abilityModifications).forEach(([ability, modifier]) => {
                instance.abilities[ability] = Math.max(1, instance.abilities[ability] + modifier);
            });
        }

        return instance;
    }

    createEncounter(encounterData) {
        try {
            const encounter = {
                id: this.generateEncounterId(),
                name: encounterData.name || 'Random Encounter',
                description: encounterData.description || '',
                environment: encounterData.environment || 'generic',
                difficulty: encounterData.difficulty || 'medium',
                monsters: encounterData.monsters || [],
                objectives: encounterData.objectives || ['Defeat all enemies'],
                rewards: encounterData.rewards || {},
                conditions: encounterData.conditions || {},
                created: new Date().toISOString()
            };

            encounter.totalXP = this.calculateEncounterXP(encounter.monsters);
            encounter.adjustedXP = this.calculateAdjustedXP(encounter.totalXP, encounter.monsters.length);

            this.encounters.set(encounter.id, encounter);
            
            this.core.emit('monsters:encounterCreated', { encounter, success: true });
            console.log(`⚔️ Created encounter: ${encounter.name} (${encounter.adjustedXP} XP)`);
            
            return encounter;
        } catch (error) {
            console.error('❌ Failed to create encounter:', error);
            this.core.emit('monsters:encounterCreated', { success: false, error });
            return null;
        }
    }

    calculateEncounterXP(monsters) {
        return monsters.reduce((total, monster) => {
            const monsterData = this.monsters.get(monster.id);
            return total + (monsterData?.experiencePoints || 0) * (monster.quantity || 1);
        }, 0);
    }

    calculateAdjustedXP(baseXP, monsterCount) {
        const multipliers = {
            1: 1,
            2: 1.5,
            3: 2,
            4: 2,
            5: 2.5,
            6: 2.5,
            7: 3,
            8: 3
        };

        const multiplier = multipliers[Math.min(monsterCount, 8)] || 4;
        return Math.floor(baseXP * multiplier);
    }

    challengeRatingToNumber(cr) {
        const crMap = {
            '0': 0,
            '1/8': 0.125,
            '1/4': 0.25,
            '1/2': 0.5
        };
        
        return crMap[cr] !== undefined ? crMap[cr] : parseInt(cr) || 0;
    }

    addCustomMonster(monsterData) {
        try {
            const monster = {
                id: monsterData.id || this.generateMonsterId(),
                ...monsterData,
                custom: true,
                created: new Date().toISOString()
            };

            this.monsters.set(monster.id, monster);
            
            this.core.emit('monsters:customAdded', { monster, success: true });
            console.log(`🎨 Added custom monster: ${monster.name}`);
            
            return monster;
        } catch (error) {
            console.error('❌ Failed to add custom monster:', error);
            this.core.emit('monsters:customAdded', { success: false, error });
            return null;
        }
    }

    generateMonsterId() {
        return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateEncounterId() {
        return `encounter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getAllMonsters() {
        return Array.from(this.monsters.values());
    }

    getMonstersByType(type) {
        return Array.from(this.monsters.values()).filter(monster => monster.type === type);
    }

    getMonstersByChallengeRating(cr) {
        return Array.from(this.monsters.values()).filter(monster => monster.challengeRating === cr);
    }
}