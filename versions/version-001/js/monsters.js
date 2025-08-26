export default class MonsterDatabase {
    constructor(core) {
        this.core = core;
        this.worldDatabase = null;
        this.relationshipSystem = null;
        
        this.monsterData = {
            monsters: new Map(),           // Monster definitions
            encounters: new Map(),         // Encounter history
            playerKnowledge: new Map(),    // What players know about monsters
            variants: new Map(),           // Monster variants and scaling
            ecosystems: new Map()          // Monster-location relationships
        };

        this.crScaling = {
            // Challenge Rating scaling multipliers
            0: { hp: 1, damage: 1, ac: 10, prof: 2 },
            0.125: { hp: 1.2, damage: 1.1, ac: 11, prof: 2 },
            0.25: { hp: 1.4, damage: 1.2, ac: 11, prof: 2 },
            0.5: { hp: 1.6, damage: 1.3, ac: 12, prof: 2 },
            1: { hp: 2, damage: 1.5, ac: 13, prof: 2 },
            2: { hp: 2.5, damage: 1.8, ac: 13, prof: 2 },
            3: { hp: 3, damage: 2, ac: 14, prof: 2 },
            4: { hp: 3.5, damage: 2.2, ac: 14, prof: 2 },
            5: { hp: 4, damage: 2.5, ac: 15, prof: 3 },
            8: { hp: 5.5, damage: 3, ac: 16, prof: 3 },
            10: { hp: 7, damage: 3.5, ac: 17, prof: 4 },
            15: { hp: 10, damage: 5, ac: 18, prof: 5 },
            20: { hp: 15, damage: 7, ac: 19, prof: 6 }
        };

        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.relationshipSystem = this.core.getModule('relationshipSystem');
            this.loadMonsterDatabase();
            this.createDefaultMonsters();
        });

        this.core.on('monster:encountered', (event) => {
            this.recordEncounter(event.detail);
        });

        this.core.on('monster:defeated', (event) => {
            this.updatePlayerKnowledge(event.detail);
        });
    }

    loadMonsterDatabase() {
        // Initialize monster database in world data if it doesn't exist
        const worldData = this.worldDatabase?.getData();
        if (!worldData || !worldData.monsters) {
            if (worldData) {
                worldData.monsters = {
                    definitions: {},
                    encounters: [],
                    playerKnowledge: {},
                    variants: {},
                    ecosystems: {}
                };
                this.worldDatabase.updateData(worldData);
            }
        }

        // Load existing data into memory
        if (worldData?.monsters) {
            this.monsterData = {
                monsters: new Map(Object.entries(worldData.monsters.definitions || {})),
                encounters: new Map(worldData.monsters.encounters?.map(e => [e.id, e]) || []),
                playerKnowledge: new Map(Object.entries(worldData.monsters.playerKnowledge || {})),
                variants: new Map(Object.entries(worldData.monsters.variants || {})),
                ecosystems: new Map(Object.entries(worldData.monsters.ecosystems || {}))
            };
        }
    }

    // ===== MONSTER CREATION AND MANAGEMENT =====

    /**
     * Create a new monster with full D&D 5e stat block
     * @param {Object} monsterData - Monster data object
     * @returns {Object} Created monster
     */
    createMonster(monsterData) {
        const monster = {
            id: monsterData.id || this.generateMonsterId(monsterData.name),
            ...this.createStatBlock(monsterData),
            
            // World Integration
            factions: monsterData.factions || [],
            locations: monsterData.locations || [],
            relationships: monsterData.relationships || [],
            
            // Behavioral Data
            behavior: {
                alignment: monsterData.alignment || 'neutral',
                personality: monsterData.personality || 'territorial',
                tactics: monsterData.tactics || 'aggressive',
                socialStructure: monsterData.socialStructure || 'solitary',
                intelligence: monsterData.intelligence || 'animal',
                motivations: monsterData.motivations || ['survival'],
                fears: monsterData.fears || [],
                allies: monsterData.allies || [],
                enemies: monsterData.enemies || []
            },

            // Encounter Data
            preferredTerrain: monsterData.preferredTerrain || ['any'],
            timeOfDay: monsterData.timeOfDay || ['any'],
            seasonality: monsterData.seasonality || ['any'],
            groupSize: monsterData.groupSize || { min: 1, max: 1 },
            
            // Lore and Discovery
            lore: {
                description: monsterData.description || '',
                habitat: monsterData.habitat || '',
                diet: monsterData.diet || '',
                lifecycle: monsterData.lifecycle || '',
                culturalSignificance: monsterData.culturalSignificance || '',
                weaknesses: monsterData.weaknesses || [],
                secrets: monsterData.secrets || []
            },

            // Meta Information
            source: monsterData.source || 'custom',
            tags: monsterData.tags || [],
            createdBy: monsterData.createdBy || 'AI DM',
            dateCreated: new Date(),
            lastModified: new Date(),
            encounterCount: 0,
            version: '1.0'
        };

        this.monsterData.monsters.set(monster.id, monster);
        this.saveMonsterDatabase();
        
        this.core.emit('monster:created', { monster });
        console.log(`🐉 Created monster: ${monster.name} (CR ${monster.challengeRating})`);
        
        return monster;
    }

    /**
     * Create complete D&D 5e stat block
     * @param {Object} data - Raw monster data
     * @returns {Object} Complete stat block
     */
    createStatBlock(data) {
        const abilities = this.calculateAbilities(data);
        const hp = this.calculateHP(data.hitDice || '1d8', abilities.conMod || 0);
        const ac = this.calculateAC(data);
        const profBonus = this.getProficiencyBonus(data.challengeRating || 0.125);

        return {
            // Basic Info
            name: data.name,
            size: data.size || 'Medium',
            type: data.type || 'humanoid',
            subtype: data.subtype || null,
            alignment: data.alignment || 'neutral',
            
            // Core Stats
            armorClass: ac,
            hitPoints: hp.average,
            hitDice: data.hitDice || '1d8',
            speed: this.parseSpeed(data.speed || '30 ft'),
            
            // Abilities
            abilities: abilities,
            abilityScores: {
                str: abilities.str,
                dex: abilities.dex,
                con: abilities.con,
                int: abilities.int,
                wis: abilities.wis,
                cha: abilities.cha
            },
            
            // Proficiencies
            proficiencyBonus: profBonus,
            savingThrows: this.calculateSavingThrows(abilities, data.saveProfs || [], profBonus),
            skills: this.calculateSkills(abilities, data.skillProfs || [], profBonus),
            
            // Defenses
            damageVulnerabilities: data.vulnerabilities || [],
            damageResistances: data.resistances || [],
            damageImmunities: data.immunities || [],
            conditionImmunities: data.conditionImmunities || [],
            
            // Senses
            senses: this.parseSenses(data.senses || 'passive Perception 10'),
            languages: data.languages || [],
            telepathy: data.telepathy || null,
            
            // Challenge
            challengeRating: data.challengeRating || 0.125,
            experiencePoints: this.getXPByCR(data.challengeRating || 0.125),
            
            // Special Abilities
            traits: data.traits || [],
            actions: data.actions || [],
            reactions: data.reactions || [],
            legendaryActions: data.legendaryActions || [],
            lairActions: data.lairActions || [],
            
            // Spellcasting
            spellcasting: data.spellcasting || null
        };
    }

    /**
     * Calculate ability scores with modifiers
     * @param {Object} data - Raw ability data
     * @returns {Object} Ability scores and modifiers
     */
    calculateAbilities(data) {
        const abilities = {
            str: data.str || 10,
            dex: data.dex || 10,
            con: data.con || 10,
            int: data.int || 10,
            wis: data.wis || 10,
            cha: data.cha || 10
        };

        // Add modifiers
        Object.keys(abilities).forEach(ability => {
            abilities[`${ability}Mod`] = Math.floor((abilities[ability] - 10) / 2);
        });

        return abilities;
    }

    /**
     * Calculate HP from hit dice and constitution
     * @param {string} hitDice - Hit dice string (e.g., "2d8+2")
     * @param {number} conMod - Constitution modifier
     * @returns {Object} HP data
     */
    calculateHP(hitDice, conMod) {
        const match = hitDice.match(/(\d+)d(\d+)(?:\+(\d+))?/);
        if (!match) return { average: 4, max: 8 };

        const numDice = parseInt(match[1]);
        const dieSize = parseInt(match[2]);
        const bonus = parseInt(match[3] || 0);
        
        const average = Math.floor((numDice * (dieSize + 1) / 2)) + bonus + (conMod * numDice);
        const max = (numDice * dieSize) + bonus + (conMod * numDice);

        return { average, max, dice: hitDice };
    }

    /**
     * Calculate Armor Class
     * @param {Object} data - Monster data
     * @returns {Object} AC data
     */
    calculateAC(data) {
        if (data.armorClass) {
            return typeof data.armorClass === 'number' 
                ? { value: data.armorClass, source: 'natural armor' }
                : data.armorClass;
        }

        // Default AC calculation
        const dexMod = Math.floor(((data.dex || 10) - 10) / 2);
        return {
            value: 10 + dexMod,
            source: 'natural armor'
        };
    }

    /**
     * Get proficiency bonus by CR
     * @param {number} cr - Challenge rating
     * @returns {number} Proficiency bonus
     */
    getProficiencyBonus(cr) {
        if (cr <= 4) return 2;
        if (cr <= 8) return 3;
        if (cr <= 12) return 4;
        if (cr <= 16) return 5;
        if (cr <= 20) return 6;
        return 7;
    }

    /**
     * Calculate saving throws
     * @param {Object} abilities - Ability scores
     * @param {Array} saveProfs - Proficient saves
     * @param {number} profBonus - Proficiency bonus
     * @returns {Object} Saving throws
     */
    calculateSavingThrows(abilities, saveProfs, profBonus) {
        const saves = {};
        const abilityNames = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        
        abilityNames.forEach(ability => {
            const mod = abilities[`${ability}Mod`] || 0;
            const isProficient = saveProfs.includes(ability);
            saves[ability] = mod + (isProficient ? profBonus : 0);
        });

        return saves;
    }

    /**
     * Calculate skills
     * @param {Object} abilities - Ability scores
     * @param {Array} skillProfs - Skill proficiencies
     * @param {number} profBonus - Proficiency bonus
     * @returns {Object} Skills
     */
    calculateSkills(abilities, skillProfs, profBonus) {
        const skillToAbility = {
            acrobatics: 'dex', animalHandling: 'wis', arcana: 'int', athletics: 'str',
            deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
            investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
            performance: 'cha', persuasion: 'cha', religion: 'int', sleightOfHand: 'dex',
            stealth: 'dex', survival: 'wis'
        };

        const skills = {};
        skillProfs.forEach(skill => {
            const ability = skillToAbility[skill];
            if (ability) {
                skills[skill] = (abilities[`${ability}Mod`] || 0) + profBonus;
            }
        });

        return skills;
    }

    /**
     * Parse speed string into object
     * @param {string} speedStr - Speed string
     * @returns {Object} Speed data
     */
    parseSpeed(speedStr) {
        const speeds = { walk: 30 };
        
        if (typeof speedStr === 'string') {
            const matches = speedStr.match(/(\w+)\s+(\d+)\s*ft/g);
            if (matches) {
                matches.forEach(match => {
                    const [, type, value] = match.match(/(\w+)\s+(\d+)\s*ft/);
                    speeds[type] = parseInt(value);
                });
            } else {
                const walkSpeed = parseInt(speedStr.replace(/\D/g, '')) || 30;
                speeds.walk = walkSpeed;
            }
        }

        return speeds;
    }

    /**
     * Parse senses string
     * @param {string} senses - Senses string
     * @returns {Object} Senses data
     */
    parseSenses(senses) {
        const result = {};
        
        if (senses.includes('darkvision')) {
            const match = senses.match(/darkvision (\d+) ft/);
            result.darkvision = match ? parseInt(match[1]) : 60;
        }
        
        if (senses.includes('blindsight')) {
            const match = senses.match(/blindsight (\d+) ft/);
            result.blindsight = match ? parseInt(match[1]) : 10;
        }
        
        if (senses.includes('tremorsense')) {
            const match = senses.match(/tremorsense (\d+) ft/);
            result.tremorsense = match ? parseInt(match[1]) : 60;
        }
        
        if (senses.includes('truesight')) {
            const match = senses.match(/truesight (\d+) ft/);
            result.truesight = match ? parseInt(match[1]) : 120;
        }

        const passiveMatch = senses.match(/passive Perception (\d+)/);
        result.passivePerception = passiveMatch ? parseInt(passiveMatch[1]) : 10;

        return result;
    }

    /**
     * Get XP by Challenge Rating
     * @param {number} cr - Challenge rating
     * @returns {number} Experience points
     */
    getXPByCR(cr) {
        const xpTable = {
            0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
            1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
            6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
            11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
            16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
            21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
            26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
        };

        return xpTable[cr] || 10;
    }

    // ===== ENCOUNTER TRACKING =====

    /**
     * Record a monster encounter
     * @param {Object} encounterData - Encounter information
     * @returns {Object} Encounter record
     */
    recordEncounter(encounterData) {
        const encounter = {
            id: encounterData.id || this.generateEncounterId(),
            monsterId: encounterData.monsterId,
            monsterName: encounterData.monsterName,
            location: encounterData.location,
            locationId: encounterData.locationId,
            partyLevel: encounterData.partyLevel || 1,
            partySize: encounterData.partySize || 4,
            encounterType: encounterData.type || 'combat', // combat, social, stealth, etc.
            difficulty: encounterData.difficulty || 'medium',
            outcome: encounterData.outcome || 'ongoing', // victory, defeat, fled, negotiated
            duration: encounterData.duration || 0,
            casualties: encounterData.casualties || 0,
            experience: encounterData.experience || 0,
            loot: encounterData.loot || [],
            notes: encounterData.notes || '',
            timestamp: new Date(),
            
            // Combat specifics
            rounds: encounterData.rounds || 0,
            damageDealt: encounterData.damageDealt || 0,
            damageTaken: encounterData.damageTaken || 0,
            tacticsUsed: encounterData.tacticsUsed || [],
            spellsUsed: encounterData.spellsUsed || [],
            
            // Knowledge gained
            weaknessesDiscovered: encounterData.weaknessesDiscovered || [],
            resistancesDiscovered: encounterData.resistancesDiscovered || [],
            abilitiesWitnessed: encounterData.abilitiesWitnessed || [],
            behaviorsObserved: encounterData.behaviorsObserved || []
        };

        this.monsterData.encounters.set(encounter.id, encounter);
        
        // Update monster encounter count
        const monster = this.monsterData.monsters.get(encounterData.monsterId);
        if (monster) {
            monster.encounterCount = (monster.encounterCount || 0) + 1;
            monster.lastEncountered = new Date();
        }

        // Update location-monster relationship
        if (encounterData.locationId) {
            this.updateEcosystem(encounterData.locationId, encounterData.monsterId);
        }

        this.saveMonsterDatabase();
        this.core.emit('encounter:recorded', { encounter });

        return encounter;
    }

    /**
     * Update player knowledge about a monster
     * @param {Object} knowledgeData - Knowledge update data
     */
    updatePlayerKnowledge(knowledgeData) {
        const { monsterId, knowledgeType, information } = knowledgeData;
        
        let knowledge = this.monsterData.playerKnowledge.get(monsterId) || {
            monsterId,
            discoveryLevel: 0, // 0: unknown, 1: basic, 2: detailed, 3: complete
            knownAbilities: [],
            knownResistances: [],
            knownVulnerabilities: [],
            knownBehaviors: [],
            knownWeaknesses: [],
            knownTactics: [],
            firstEncounter: null,
            encounterCount: 0,
            notes: []
        };

        // Update encounter count
        knowledge.encounterCount += 1;
        if (!knowledge.firstEncounter) {
            knowledge.firstEncounter = new Date();
        }

        // Add new information based on type
        switch (knowledgeType) {
            case 'ability_witnessed':
                if (!knowledge.knownAbilities.includes(information)) {
                    knowledge.knownAbilities.push(information);
                }
                break;
                
            case 'resistance_discovered':
                if (!knowledge.knownResistances.includes(information)) {
                    knowledge.knownResistances.push(information);
                }
                break;
                
            case 'vulnerability_discovered':
                if (!knowledge.knownVulnerabilities.includes(information)) {
                    knowledge.knownVulnerabilities.push(information);
                }
                break;
                
            case 'behavior_observed':
                if (!knowledge.knownBehaviors.includes(information)) {
                    knowledge.knownBehaviors.push(information);
                }
                break;
                
            case 'weakness_learned':
                if (!knowledge.knownWeaknesses.includes(information)) {
                    knowledge.knownWeaknesses.push(information);
                }
                break;
                
            case 'tactic_witnessed':
                if (!knowledge.knownTactics.includes(information)) {
                    knowledge.knownTactics.push(information);
                }
                break;
        }

        // Calculate discovery level based on known information
        knowledge.discoveryLevel = this.calculateDiscoveryLevel(knowledge);

        this.monsterData.playerKnowledge.set(monsterId, knowledge);
        this.saveMonsterDatabase();
        
        this.core.emit('monster:knowledge:updated', { monsterId, knowledge });
    }

    /**
     * Calculate discovery level based on known information
     * @param {Object} knowledge - Knowledge object
     * @returns {number} Discovery level 0-3
     */
    calculateDiscoveryLevel(knowledge) {
        const totalKnown = knowledge.knownAbilities.length + 
                          knowledge.knownResistances.length + 
                          knowledge.knownVulnerabilities.length + 
                          knowledge.knownBehaviors.length + 
                          knowledge.knownWeaknesses.length + 
                          knowledge.knownTactics.length;

        if (totalKnown >= 15) return 3; // Complete knowledge
        if (totalKnown >= 8) return 2;  // Detailed knowledge
        if (totalKnown >= 3) return 1;  // Basic knowledge
        return 0; // Unknown
    }

    // ===== ECOSYSTEM AND LOCATION INTEGRATION =====

    /**
     * Update ecosystem data for monster-location relationships
     * @param {string} locationId - Location identifier
     * @param {string} monsterId - Monster identifier
     */
    updateEcosystem(locationId, monsterId) {
        if (!locationId || !monsterId) return;

        let ecosystem = this.monsterData.ecosystems.get(locationId) || {
            locationId,
            inhabitants: new Map(),
            dominantSpecies: [],
            predatorPrey: [],
            territorialConflicts: [],
            seasonalVariations: {},
            lastUpdated: new Date()
        };

        // Update inhabitant data
        let inhabitant = ecosystem.inhabitants.get(monsterId) || {
            monsterId,
            population: 0,
            encounterFrequency: 0,
            aggressiveness: 'neutral',
            territorialClaims: [],
            lastSeen: null
        };

        inhabitant.population += 1;
        inhabitant.encounterFrequency += 1;
        inhabitant.lastSeen = new Date();

        ecosystem.inhabitants.set(monsterId, inhabitant);
        ecosystem.lastUpdated = new Date();

        this.monsterData.ecosystems.set(locationId, ecosystem);
    }

    /**
     * Get monsters by location
     * @param {string} locationId - Location identifier
     * @returns {Array} Monsters in location
     */
    getMonstersByLocation(locationId) {
        const ecosystem = this.monsterData.ecosystems.get(locationId);
        if (!ecosystem) return [];

        return Array.from(ecosystem.inhabitants.keys()).map(monsterId => {
            const monster = this.monsterData.monsters.get(monsterId);
            const inhabitantData = ecosystem.inhabitants.get(monsterId);
            
            return monster ? {
                ...monster,
                ecosystemData: inhabitantData
            } : null;
        }).filter(Boolean);
    }

    // ===== FACTION INTEGRATION =====

    /**
     * Link monster to faction
     * @param {string} monsterId - Monster identifier
     * @param {string} factionId - Faction identifier
     * @param {string} relationship - Relationship type
     */
    linkMonsterToFaction(monsterId, factionId, relationship = 'member') {
        const monster = this.monsterData.monsters.get(monsterId);
        if (!monster) return;

        if (!monster.factions.find(f => f.id === factionId)) {
            monster.factions.push({
                id: factionId,
                relationship,
                rank: 'member',
                loyalty: 50,
                dateJoined: new Date()
            });
        }

        // Update faction in world database to include this monster
        if (this.worldDatabase) {
            const faction = this.worldDatabase.getFaction(factionId);
            if (faction && !faction.monsters?.includes(monsterId)) {
                faction.monsters = faction.monsters || [];
                faction.monsters.push(monsterId);
                this.worldDatabase.updateFaction(factionId, faction);
            }
        }

        this.saveMonsterDatabase();
    }

    /**
     * Get monsters by faction
     * @param {string} factionId - Faction identifier
     * @returns {Array} Monsters in faction
     */
    getMonstersByFaction(factionId) {
        return Array.from(this.monsterData.monsters.values())
            .filter(monster => monster.factions.some(f => f.id === factionId));
    }

    // ===== UTILITY METHODS =====

    /**
     * Generate unique monster ID
     * @param {string} name - Monster name
     * @returns {string} Unique ID
     */
    generateMonsterId(name) {
        const base = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const timestamp = Date.now().toString(36);
        return `${base}-${timestamp}`;
    }

    /**
     * Generate unique encounter ID
     * @returns {string} Unique encounter ID
     */
    generateEncounterId() {
        return `encounter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Save monster database to world storage
     */
    saveMonsterDatabase() {
        if (!this.worldDatabase) return;
        
        const worldData = this.worldDatabase.getData();
        worldData.monsters = {
            definitions: Object.fromEntries(this.monsterData.monsters),
            encounters: Array.from(this.monsterData.encounters.values()),
            playerKnowledge: Object.fromEntries(this.monsterData.playerKnowledge),
            variants: Object.fromEntries(this.monsterData.variants),
            ecosystems: Object.fromEntries(this.monsterData.ecosystems)
        };
        this.worldDatabase.updateData(worldData);
    }

    // ===== QUERY METHODS =====

    /**
     * Get monster by ID
     * @param {string} monsterId - Monster identifier
     * @returns {Object} Monster data
     */
    getMonster(monsterId) {
        return this.monsterData.monsters.get(monsterId) || 
               this.monsterData.variants.get(monsterId);
    }

    /**
     * Search monsters by criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array} Matching monsters
     */
    searchMonsters(criteria = {}) {
        let monsters = Array.from(this.monsterData.monsters.values());

        if (criteria.name) {
            monsters = monsters.filter(m => 
                m.name.toLowerCase().includes(criteria.name.toLowerCase())
            );
        }

        if (criteria.type) {
            monsters = monsters.filter(m => m.type === criteria.type);
        }

        if (criteria.cr !== undefined) {
            if (criteria.crRange) {
                monsters = monsters.filter(m => 
                    m.challengeRating >= criteria.cr - criteria.crRange &&
                    m.challengeRating <= criteria.cr + criteria.crRange
                );
            } else {
                monsters = monsters.filter(m => m.challengeRating === criteria.cr);
            }
        }

        if (criteria.size) {
            monsters = monsters.filter(m => m.size === criteria.size);
        }

        if (criteria.environment) {
            monsters = monsters.filter(m => 
                m.preferredTerrain.includes(criteria.environment) ||
                m.preferredTerrain.includes('any')
            );
        }

        if (criteria.factionId) {
            monsters = monsters.filter(m => 
                m.factions.some(f => f.id === criteria.factionId)
            );
        }

        return monsters;
    }

    /**
     * Get player knowledge about a monster
     * @param {string} monsterId - Monster identifier
     * @returns {Object} Player knowledge
     */
    getPlayerKnowledge(monsterId) {
        return this.monsterData.playerKnowledge.get(monsterId) || {
            monsterId,
            discoveryLevel: 0,
            knownAbilities: [],
            knownResistances: [],
            knownVulnerabilities: [],
            knownBehaviors: [],
            knownWeaknesses: [],
            knownTactics: [],
            firstEncounter: null,
            encounterCount: 0,
            notes: []
        };
    }

    /**
     * Get encounter history for a monster
     * @param {string} monsterId - Monster identifier
     * @returns {Array} Encounter history
     */
    getEncounterHistory(monsterId) {
        return Array.from(this.monsterData.encounters.values())
            .filter(encounter => encounter.monsterId === monsterId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Get all monsters the party has encountered
     * @returns {Array} Encountered monsters with knowledge levels
     */
    getEncounteredMonsters() {
        const encountered = [];
        
        this.monsterData.playerKnowledge.forEach((knowledge, monsterId) => {
            const monster = this.getMonster(monsterId);
            if (monster) {
                encountered.push({
                    ...monster,
                    playerKnowledge: knowledge
                });
            }
        });

        return encountered.sort((a, b) => 
            new Date(b.playerKnowledge.firstEncounter) - 
            new Date(a.playerKnowledge.firstEncounter)
        );
    }

    // ===== DEFAULT MONSTERS =====

    createDefaultMonsters() {
        // Only create if no monsters exist
        if (this.monsterData.monsters.size > 0) return;

        const defaultMonsters = [
            {
                name: 'Goblin',
                size: 'Small',
                type: 'humanoid',
                subtype: 'goblinoid',
                alignment: 'neutral evil',
                str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8,
                hitDice: '2d6',
                speed: '30 ft',
                challengeRating: 0.25,
                skillProfs: ['stealth'],
                senses: 'darkvision 60 ft, passive Perception 9',
                languages: ['Common', 'Goblin'],
                actions: [
                    {
                        name: 'Scimitar',
                        type: 'weapon',
                        attack: '+4 to hit',
                        reach: '5 ft',
                        damage: [{ dice: '1d6+2', type: 'slashing' }]
                    },
                    {
                        name: 'Shortbow',
                        type: 'weapon',
                        attack: '+4 to hit',
                        range: '80/320 ft',
                        damage: [{ dice: '1d6+2', type: 'piercing' }]
                    }
                ],
                traits: [
                    {
                        name: 'Nimble Escape',
                        description: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.'
                    }
                ],
                preferredTerrain: ['forest', 'hills', 'ruins'],
                groupSize: { min: 2, max: 8 },
                behavior: {
                    tactics: 'hit_and_run',
                    socialStructure: 'tribal',
                    intelligence: 'cunning',
                    motivations: ['treasure', 'mischief'],
                    fears: ['fire', 'larger_creatures']
                }
            },
            {
                name: 'Orc',
                size: 'Medium',
                type: 'humanoid',
                subtype: 'orc',
                alignment: 'chaotic evil',
                str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10,
                hitDice: '2d8+6',
                speed: '30 ft',
                challengeRating: 0.5,
                skillProfs: ['intimidation'],
                senses: 'darkvision 60 ft, passive Perception 10',
                languages: ['Common', 'Orc'],
                actions: [
                    {
                        name: 'Greataxe',
                        type: 'weapon',
                        attack: '+5 to hit',
                        reach: '5 ft',
                        damage: [{ dice: '1d12+3', type: 'slashing' }]
                    },
                    {
                        name: 'Javelin',
                        type: 'weapon',
                        attack: '+5 to hit',
                        range: '30/120 ft',
                        damage: [{ dice: '1d6+3', type: 'piercing' }]
                    }
                ],
                traits: [
                    {
                        name: 'Aggressive',
                        description: 'As a bonus action, the orc can move up to its speed toward a hostile creature that it can see.'
                    }
                ],
                preferredTerrain: ['mountains', 'ruins', 'badlands'],
                groupSize: { min: 1, max: 4 },
                behavior: {
                    tactics: 'aggressive_charge',
                    socialStructure: 'warband',
                    intelligence: 'brutal',
                    motivations: ['conquest', 'glory'],
                    fears: ['cowardice', 'weakness']
                }
            }
        ];

        defaultMonsters.forEach(monsterData => {
            this.createMonster(monsterData);
        });

        console.log(`🐉 Created ${defaultMonsters.length} default monsters`);
    }

    // ===== GITHUB INTEGRATION FOR COMMUNITY SHARING =====

    /**
     * Export monsters to a shareable format
     * @param {Array} monsterIds - Monster IDs to export (empty for all)
     * @returns {Object} Exportable monster data
     */
    exportMonstersForSharing(monsterIds = []) {
        const monstersToExport = monsterIds.length > 0 
            ? monsterIds.map(id => this.getMonster(id)).filter(Boolean)
            : Array.from(this.monsterData.monsters.values());

        const exportData = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            exportedBy: this.core.appState.user?.username || 'Anonymous',
            monsters: monstersToExport.map(monster => ({
                ...monster,
                // Remove internal tracking data
                id: undefined,
                createdAt: monster.createdAt,
                // Include community metadata
                communityData: {
                    author: monster.author || this.core.appState.user?.username || 'Anonymous',
                    tags: monster.tags || [],
                    difficulty: monster.challengeRating,
                    tested: monster.encounters?.length > 0 || false
                }
            }))
        };

        return exportData;
    }

    /**
     * Import monsters from community share format
     * @param {Object} importData - Monster data to import
     * @param {Object} options - Import options
     * @returns {Object} Import results
     */
    importMonstersFromCommunity(importData, options = {}) {
        const {
            overwriteExisting = false,
            addAuthorPrefix = true,
            validateStats = true
        } = options;

        const results = {
            imported: [],
            skipped: [],
            errors: [],
            totalCount: 0
        };

        if (!importData.monsters || !Array.isArray(importData.monsters)) {
            results.errors.push('Invalid import data format');
            return results;
        }

        results.totalCount = importData.monsters.length;

        importData.monsters.forEach((monsterData, index) => {
            try {
                // Validate basic structure
                if (!monsterData.name || !monsterData.challengeRating) {
                    results.errors.push(`Monster ${index + 1}: Missing required fields (name, challengeRating)`);
                    return;
                }

                // Create unique ID for imported monster
                const originalName = monsterData.name;
                const authorPrefix = addAuthorPrefix && importData.exportedBy 
                    ? `[${importData.exportedBy}] ` 
                    : '';
                const uniqueName = `${authorPrefix}${originalName}`;

                // Check if monster already exists
                const existingId = this.findMonsterByName(uniqueName);
                if (existingId && !overwriteExisting) {
                    results.skipped.push({
                        name: uniqueName,
                        reason: 'Already exists'
                    });
                    return;
                }

                // Validate stats if requested
                if (validateStats && !this.validateMonsterStats(monsterData)) {
                    results.errors.push(`Monster ${originalName}: Invalid stat block`);
                    return;
                }

                // Prepare monster data for creation
                const importMonsterData = {
                    ...monsterData,
                    name: uniqueName,
                    author: importData.exportedBy || 'Community',
                    imported: true,
                    importedAt: new Date().toISOString(),
                    originalAuthor: monsterData.communityData?.author,
                    communityTags: monsterData.communityData?.tags || []
                };

                // Create or update monster
                const monsterId = this.createMonster(importMonsterData);
                results.imported.push({
                    id: monsterId,
                    name: uniqueName,
                    originalName: originalName
                });

            } catch (error) {
                results.errors.push(`Monster ${monsterData.name || index + 1}: ${error.message}`);
            }
        });

        // Save to database
        this.saveMonsterDatabase();

        console.log(`📥 Import Results: ${results.imported.length} imported, ${results.skipped.length} skipped, ${results.errors.length} errors`);
        return results;
    }

    /**
     * Find monster by name (case-insensitive)
     * @param {string} name - Monster name to search for
     * @returns {string|null} Monster ID or null if not found
     */
    findMonsterByName(name) {
        const lowerName = name.toLowerCase();
        for (const [id, monster] of this.monsterData.monsters) {
            if (monster.name.toLowerCase() === lowerName) {
                return id;
            }
        }
        return null;
    }

    /**
     * Validate monster stats for balance and completeness
     * @param {Object} monsterData - Monster data to validate
     * @returns {boolean} Whether the monster stats are valid
     */
    validateMonsterStats(monsterData) {
        try {
            // Check required fields
            const requiredFields = ['name', 'size', 'type', 'challengeRating'];
            for (const field of requiredFields) {
                if (!monsterData[field]) {
                    console.warn(`Validation failed: Missing ${field}`);
                    return false;
                }
            }

            // Check ability scores
            const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
            for (const ability of abilities) {
                const score = monsterData[ability];
                if (typeof score !== 'number' || score < 1 || score > 30) {
                    console.warn(`Validation failed: Invalid ${ability} score: ${score}`);
                    return false;
                }
            }

            // Check challenge rating
            const validCRs = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
            if (!validCRs.includes(monsterData.challengeRating)) {
                console.warn(`Validation failed: Invalid challenge rating: ${monsterData.challengeRating}`);
                return false;
            }

            return true;
        } catch (error) {
            console.warn('Validation failed:', error.message);
            return false;
        }
    }

    /**
     * Create a GitHub-compatible monster pack for sharing
     * @param {Array} monsterIds - Monster IDs to include in pack
     * @param {Object} packInfo - Pack metadata
     * @returns {Object} GitHub-ready monster pack
     */
    createMonsterPack(monsterIds, packInfo = {}) {
        const exportData = this.exportMonstersForSharing(monsterIds);
        
        const monsterPack = {
            name: packInfo.name || 'Custom Monster Pack',
            description: packInfo.description || 'A collection of custom D&D monsters',
            version: packInfo.version || '1.0.0',
            author: packInfo.author || this.core.appState.user?.username || 'Anonymous',
            tags: packInfo.tags || [],
            difficulty: packInfo.difficulty || 'mixed',
            createdAt: new Date().toISOString(),
            
            // Monster data
            monsters: exportData.monsters,
            
            // Pack statistics
            stats: {
                totalMonsters: exportData.monsters.length,
                crRange: this.getPackCRRange(exportData.monsters),
                types: this.getPackTypes(exportData.monsters)
            },
            
            // GitHub integration metadata
            github: {
                repository: 'dnd-community-monsters',
                branch: 'main',
                path: `packs/${packInfo.name?.toLowerCase().replace(/\s+/g, '-') || 'custom-pack'}.json`
            }
        };

        return monsterPack;
    }

    /**
     * Get challenge rating range for a monster pack
     * @param {Array} monsters - Monsters in the pack
     * @returns {Object} CR range information
     */
    getPackCRRange(monsters) {
        const crs = monsters.map(m => m.challengeRating).sort((a, b) => a - b);
        return {
            min: crs[0],
            max: crs[crs.length - 1],
            average: crs.reduce((sum, cr) => sum + cr, 0) / crs.length
        };
    }

    /**
     * Get creature types in a monster pack
     * @param {Array} monsters - Monsters in the pack
     * @returns {Object} Type distribution
     */
    getPackTypes(monsters) {
        const types = {};
        monsters.forEach(monster => {
            const type = monster.type || 'unknown';
            types[type] = (types[type] || 0) + 1;
        });
        return types;
    }

    /**
     * Get community monster sharing URL
     * @param {string} packId - Monster pack ID
     * @returns {string} Shareable URL
     */
    getCommunityShareURL(packId) {
        const baseURL = 'https://github.com/dnd-voice-adventure/community-monsters';
        return `${baseURL}/blob/main/packs/${packId}.json`;
    }

    /**
     * Generate README content for a monster pack
     * @param {Object} monsterPack - Monster pack data
     * @returns {string} README markdown content
     */
    generatePackReadme(monsterPack) {
        const { name, description, author, stats, monsters } = monsterPack;
        
        let readme = `# ${name}\n\n`;
        readme += `${description}\n\n`;
        readme += `**Author:** ${author}  \n`;
        readme += `**Monsters:** ${stats.totalMonsters}  \n`;
        readme += `**CR Range:** ${stats.crRange.min} - ${stats.crRange.max}  \n`;
        readme += `**Created:** ${new Date(monsterPack.createdAt).toLocaleDateString()}\n\n`;
        
        readme += `## Monster Types\n\n`;
        Object.entries(stats.types).forEach(([type, count]) => {
            readme += `- **${type.charAt(0).toUpperCase() + type.slice(1)}:** ${count}\n`;
        });
        
        readme += `\n## Monsters Included\n\n`;
        monsters.forEach(monster => {
            readme += `### ${monster.name}\n`;
            readme += `- **Type:** ${monster.type}\n`;
            readme += `- **Size:** ${monster.size}\n`;
            readme += `- **CR:** ${monster.challengeRating}\n`;
            if (monster.description) {
                readme += `- **Description:** ${monster.description}\n`;
            }
            readme += `\n`;
        });
        
        readme += `## Installation\n\n`;
        readme += `1. Download the monster pack JSON file\n`;
        readme += `2. In D&D Voice Adventure, go to World Browser > Bestiary\n`;
        readme += `3. Click "Import Monsters" and select the downloaded file\n`;
        readme += `4. Choose your import options and confirm\n\n`;
        
        readme += `## Usage\n\n`;
        readme += `These monsters will appear in your bestiary and can be used by the AI DM in encounters. `;
        readme += `The AI will automatically select appropriate monsters based on party level and location.\n\n`;
        
        readme += `---\n\n`;
        readme += `*Generated by [D&D Voice Adventure](https://github.com/dnd-voice-adventure) Monster Database*`;
        
        return readme;
    }
}