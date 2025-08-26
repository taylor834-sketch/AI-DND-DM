export default class DMSceneParser {
    constructor(core) {
        this.core = core;
        this.sessionEncounter = null;
        this.worldDatabase = null;
        this.combatSystem = null;
        
        // Patterns for detecting characters in DM descriptions
        this.characterPatterns = {
            // Named characters: "Sir Aldrich draws his sword", "Grix the goblin scout"
            named: /\b([A-Z][a-z]+(?:\s+(?:the\s+)?[A-Z][a-z]+)*)\s+(?:draws?|attacks?|approaches?|speaks?|says?|shouts?|casts?|fires?|swings?|charges?|blocks?|dodges?|parries?|stands?|sits?|walks?|runs?)\b/gi,
            
            // Generic enemies: "three goblins", "a bandit", "two orcs"
            genericEnemies: /\b((?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+)?(?:(goblin|orc|bandit|skeleton|zombie|wolf|wolves|spider|rat|guard|soldier|warrior|scout|archer)s?)\b/gi,
            
            // NPCs by occupation: "the shopkeeper", "a villager", "the guard captain"
            npcOccupations: /\b(?:the\s+|a\s+|an\s+)?(shopkeeper|merchant|blacksmith|innkeeper|guard|captain|villager|farmer|noble|priest|wizard|traveler|stranger|bartender|maid|servant|scholar|sage)s?\b/gi,
            
            // Group patterns: "a group of", "a band of", "several"
            groups: /\b(?:a\s+)?(?:group|band|pack|horde|squad|team|party)\s+of\s+(\w+s?)\b/gi,
            
            // Boss/unique enemies: "the goblin king", "an ancient dragon"
            uniqueEnemies: /\b(?:the\s+|an?\s+)?(?:ancient|elder|dire|giant|mighty|fearsome|terrible)\s+(\w+)\b/gi
        };
        
        // Keywords that suggest combat is starting
        this.combatTriggers = [
            'attacks', 'charges', 'fires', 'casts', 'swings',
            'initiative', 'combat begins', 'battle starts', 'fight breaks out',
            'draws weapon', 'hostile', 'aggressive'
        ];
        
        this.init();
    }
    
    init() {
        this.core.on('core:initialized', () => {
            this.sessionEncounter = this.core.getModule('sessionEncounter');
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.combatSystem = this.core.getModule('combatSystem');
            
            console.log('📝 DM Scene Parser initialized');
        });
        
        // Listen for DM messages
        this.core.on('dm:message', (event) => this.parseDMMessage(event.detail));
        this.core.on('dm:response', (event) => this.parseDMMessage(event.detail));
        this.core.on('test:parseScene', (event) => this.parseDMMessage(event.detail));
    }
    
    /**
     * Parse a DM message for NPCs and enemies
     */
    parseDMMessage(data) {
        const message = data.message || data.text || '';
        if (!message) return;
        
        const detectedCharacters = this.detectCharacters(message);
        const shouldStartCombat = this.detectCombatStart(message);
        
        // Process detected characters
        for (const character of detectedCharacters) {
            this.processDetectedCharacter(character);
        }
        
        // Start combat if detected
        if (shouldStartCombat && detectedCharacters.length > 0) {
            this.initiateCombatFromScene(detectedCharacters);
        }
        
        // Emit event for other systems
        this.core.emit('scene:parsed', {
            characters: detectedCharacters,
            combatDetected: shouldStartCombat,
            originalMessage: message
        });
    }
    
    /**
     * Detect characters mentioned in the text
     */
    detectCharacters(text) {
        const characters = [];
        const processedNames = new Set(); // Avoid duplicates
        
        // Check for named characters
        let match;
        while ((match = this.characterPatterns.named.exec(text)) !== null) {
            const name = match[1].trim();
            if (!processedNames.has(name.toLowerCase()) && !this.isPlayerCharacter(name)) {
                characters.push({
                    type: 'named',
                    name: name,
                    genericName: null,
                    isGeneric: false,
                    context: match[0]
                });
                processedNames.add(name.toLowerCase());
            }
        }
        this.characterPatterns.named.lastIndex = 0; // Reset regex
        
        // Check for generic enemies
        while ((match = this.characterPatterns.genericEnemies.exec(text)) !== null) {
            const quantity = this.parseQuantity(match[1]) || 1;
            const enemyType = match[2];
            
            for (let i = 0; i < quantity; i++) {
                characters.push({
                    type: 'enemy',
                    name: null,
                    race: enemyType,
                    class: this.getClassFromRace(enemyType),
                    isGeneric: true,
                    context: match[0]
                });
            }
        }
        this.characterPatterns.genericEnemies.lastIndex = 0;
        
        // Check for NPCs by occupation
        while ((match = this.characterPatterns.npcOccupations.exec(text)) !== null) {
            const occupation = match[1];
            if (!this.isAlreadyDetected(occupation, characters)) {
                characters.push({
                    type: 'npc',
                    name: null,
                    occupation: occupation,
                    isGeneric: false,
                    genericName: occupation.charAt(0).toUpperCase() + occupation.slice(1),
                    context: match[0]
                });
            }
        }
        this.characterPatterns.npcOccupations.lastIndex = 0;
        
        // Check for groups
        while ((match = this.characterPatterns.groups.exec(text)) !== null) {
            const groupType = match[1];
            const quantity = Math.floor(Math.random() * 3) + 3; // 3-5 members
            
            for (let i = 0; i < quantity; i++) {
                characters.push({
                    type: 'enemy',
                    name: null,
                    race: groupType.replace(/s$/, ''),
                    class: this.getClassFromRace(groupType),
                    isGeneric: true,
                    context: match[0]
                });
            }
        }
        this.characterPatterns.groups.lastIndex = 0;
        
        // Check for unique/boss enemies
        while ((match = this.characterPatterns.uniqueEnemies.exec(text)) !== null) {
            const descriptor = match[0];
            const creatureType = match[1];
            
            characters.push({
                type: 'boss',
                name: descriptor, // Use full description as name initially
                race: creatureType,
                isGeneric: false,
                isBoss: true,
                context: match[0]
            });
        }
        this.characterPatterns.uniqueEnemies.lastIndex = 0;
        
        return characters;
    }
    
    /**
     * Process a detected character and add to encounter
     */
    processDetectedCharacter(character) {
        if (!this.sessionEncounter) return;
        
        // Check if this character might already exist in world database
        let existingNPC = null;
        if (character.name && !character.isGeneric) {
            existingNPC = this.findExistingNPC(character.name);
        }
        
        const participantData = {
            name: character.name || character.genericName,
            race: character.race || '',
            class: character.class || '',
            occupation: character.occupation || '',
            isGeneric: character.isGeneric,
            npcId: existingNPC?.id || null,
            partyKnowsName: !!(character.name && !character.isGeneric),
            
            // Default combat stats (can be overridden by specific monster data)
            hitPoints: this.getDefaultHP(character),
            maxHitPoints: this.getDefaultHP(character),
            armorClass: this.getDefaultAC(character),
            initiative: Math.floor(Math.random() * 20) + 1
        };
        
        // Add to session encounter
        const participant = this.sessionEncounter.addParticipant(participantData);
        
        // Emit event for battle map to add token
        this.core.emit('battleMap:addToken', {
            participant: participant,
            autoPosition: true
        });
        
        console.log(`🎭 Detected and added: ${participant.displayName}`);
    }
    
    /**
     * Check if combat should start based on keywords
     */
    detectCombatStart(text) {
        const lowerText = text.toLowerCase();
        return this.combatTriggers.some(trigger => lowerText.includes(trigger));
    }
    
    /**
     * Initialize combat from detected scene
     */
    initiateCombatFromScene(characters) {
        const enemies = characters.filter(c => c.type === 'enemy' || c.type === 'boss');
        
        if (enemies.length > 0 && !this.combatSystem?.currentCombat) {
            console.log('⚔️ Combat detected! Initiating battle...');
            this.core.emit('combat:initiate', {
                source: 'scene-parser',
                enemies: enemies
            });
        }
    }
    
    // === Helper Methods ===
    
    parseQuantity(quantityStr) {
        if (!quantityStr) return 1;
        
        const numberWords = {
            'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3,
            'four': 4, 'five': 5, 'six': 6, 'seven': 7,
            'eight': 8, 'nine': 9, 'ten': 10
        };
        
        const cleaned = quantityStr.trim().toLowerCase();
        if (numberWords[cleaned]) return numberWords[cleaned];
        
        const num = parseInt(cleaned);
        return isNaN(num) ? 1 : num;
    }
    
    getClassFromRace(race) {
        const raceToClass = {
            'goblin': 'warrior',
            'orc': 'warrior',
            'bandit': 'rogue',
            'skeleton': 'undead',
            'zombie': 'undead',
            'wolf': 'beast',
            'spider': 'beast',
            'rat': 'beast',
            'guard': 'fighter',
            'soldier': 'fighter',
            'warrior': 'fighter',
            'scout': 'ranger',
            'archer': 'ranger'
        };
        
        return raceToClass[race.toLowerCase()] || 'warrior';
    }
    
    getDefaultHP(character) {
        if (character.isBoss) return 50 + Math.floor(Math.random() * 50);
        if (character.type === 'enemy') return 10 + Math.floor(Math.random() * 15);
        return 20 + Math.floor(Math.random() * 10);
    }
    
    getDefaultAC(character) {
        if (character.isBoss) return 15 + Math.floor(Math.random() * 3);
        if (character.type === 'enemy') return 10 + Math.floor(Math.random() * 4);
        return 12 + Math.floor(Math.random() * 3);
    }
    
    isPlayerCharacter(name) {
        // Check if this is a known player character
        const campaign = this.core.getModule('campaignManager')?.currentCampaign;
        if (!campaign) return false;
        
        return campaign.characters?.some(char => 
            char.name.toLowerCase() === name.toLowerCase()
        ) || false;
    }
    
    isAlreadyDetected(text, characters) {
        const lower = text.toLowerCase();
        return characters.some(char => 
            char.name?.toLowerCase() === lower ||
            char.occupation?.toLowerCase() === lower ||
            char.genericName?.toLowerCase() === lower
        );
    }
    
    findExistingNPC(name) {
        if (!this.worldDatabase) return null;
        
        // Search world database for NPC with this name
        const searchResults = this.worldDatabase.search(name);
        if (searchResults.npcs && searchResults.npcs.length > 0) {
            // Return first matching NPC
            return searchResults.npcs[0];
        }
        
        return null;
    }
    
    /**
     * Test method to parse a sample scene
     */
    testSceneParsing() {
        const testScenes = [
            "Sir Aldrich draws his sword and approaches menacingly. Three goblins emerge from the bushes while a shopkeeper cowers behind the counter.",
            "The goblin scout Grix signals to his companions. A bandit captain and two bandits block your path.",
            "An ancient dragon lands with a thunderous roar. Several village guards run for their lives."
        ];
        
        console.log('🧪 Testing scene parsing...');
        
        testScenes.forEach((scene, index) => {
            console.log(`\n📝 Test Scene ${index + 1}: "${scene}"`);
            this.parseDMMessage({ message: scene });
        });
    }
}