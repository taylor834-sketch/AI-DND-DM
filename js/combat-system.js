export default class CombatSystem {
    constructor(core) {
        this.core = core;
        this.aiDMIntegration = null;
        this.monsterDatabase = null;
        this.characterSheet = null;
        this.interactionHistory = null;
        this.worldDatabase = null;
        this.voiceIntegration = null;
        
        // Combat state
        this.combatActive = false;
        this.currentCombat = null;
        this.combatants = new Map();
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        this.round = 1;
        
        // Monster AI and scaling
        this.monsterAI = new Map();
        this.combatMemory = new Map();
        this.tacticEffectiveness = new Map();
        this.scalingFactors = {
            partyLevel: 1,
            partySize: 4,
            averageDamage: 10,
            defenseRating: 15,
            tacticalScore: 0.5
        };
        
        // Combat detection patterns
        this.combatTriggerPatterns = [
            // Direct combat language
            /\b(?:I |we |party )?(?:attack|strike|hit|swing at|charge|rush)\b/i,
            /\b(?:I |we )?(?:draw|unsheathe|ready) (?:my |our )?(?:sword|weapon|bow|staff)\b/i,
            /\b(?:I |we )?(?:cast|use) .* (?:at|on|against)\b/i,
            /\b(?:initiative|roll for initiative|enter combat|start fighting)\b/i,
            /\b(?:I |we )?(?:defend|block|dodge|parry)\b/i,
            
            // Aggressive actions
            /\b(?:I |we )?(?:shoot|fire|throw) .* at\b/i,
            /\b(?:I |we )?(?:stab|slash|cleave|smash)\b/i,
            /\b(?:I |we )?(?:tackle|grapple|grab)\b/i,
            
            // Spell combat
            /\b(?:I |we )?cast (?:fireball|magic missile|lightning bolt|healing word)\b/i,
            /\b(?:I |we )?(?:channel|invoke|summon)\b/i,
            
            // Defensive actions
            /\b(?:I |we )?(?:take cover|hide|retreat|fall back)\b/i,
            /\b(?:I |we )?(?:raise|hold up) (?:my |our )?(?:shield|guard)\b/i
        ];
        
        // Combat tags from AI DM
        this.combatTags = [
            'START_COMBAT',
            'INITIATIVE',
            'ENEMY_ENCOUNTER',
            'HOSTILE_ACTION',
            'COMBAT_ROUND',
            'END_COMBAT'
        ];
        
        // Combat UI elements
        this.combatBanner = null;
        this.initiativeTracker = null;
        this.actionPanel = null;
        this.battleMap = null;
        
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.aiDMIntegration = this.core.getModule('aiDMIntegration');
            this.monsterDatabase = this.core.getModule('monsterDatabase');
            this.characterSheet = this.core.getModule('characterSheet');
            this.interactionHistory = this.core.getModule('interactionHistory');
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.voiceIntegration = this.core.getModule('voiceIntegration');
            
            this.createCombatUI();
            this.bindCombatEvents();
            
            console.log('⚔️ Combat System initialized');
        });

        // Listen for AI DM responses to detect combat
        this.core.on('ai:response', (event) => {
            this.processAIResponse(event.detail);
        });

        // Listen for player input to detect combat triggers
        this.core.on('player:input', (event) => {
            this.detectCombatTriggers(event.detail);
        });

        // Listen for voice input
        this.core.on('voice:input', (event) => {
            this.detectCombatTriggers({ text: event.detail.transcript });
        });
    }

    // ===== COMBAT DETECTION =====

    /**
     * Process AI DM response for combat tags and triggers
     */
    async processAIResponse(responseData) {
        const { originalResponse, processedResponse } = responseData;
        
        // Check for combat tags
        const combatTagMatch = this.detectCombatTags(originalResponse);
        if (combatTagMatch) {
            await this.handleCombatTag(combatTagMatch);
            return;
        }

        // Check for natural language combat indicators
        const combatIndicators = this.detectNaturalCombatTriggers(processedResponse);
        if (combatIndicators.length > 0) {
            await this.handleNaturalCombatTrigger(combatIndicators, processedResponse);
        }
    }

    /**
     * Detect combat tags in AI response
     */
    detectCombatTags(response) {
        // Look for structured combat tags
        const tagPatterns = [
            /\[START_COMBAT:\s*([^\]]+)\]/i,
            /\[INITIATIVE:\s*([^\]]+)\]/i,
            /\[ENEMY_ENCOUNTER:\s*([^\]]+)\]/i,
            /\[HOSTILE_ACTION:\s*([^\]]+)\]/i,
            /\[COMBAT_ROUND:\s*([^\]]+)\]/i,
            /\[END_COMBAT:\s*([^\]]+)\]/i
        ];

        for (const pattern of tagPatterns) {
            const match = response.match(pattern);
            if (match) {
                return {
                    type: match[0].substring(1).split(':')[0],
                    parameter: match[1],
                    fullMatch: match[0]
                };
            }
        }

        return null;
    }

    /**
     * Detect natural language combat triggers
     */
    detectNaturalCombatTriggers(text) {
        const indicators = [];
        const lowerText = text.toLowerCase();

        // Check for hostile creature mentions with combat context
        if (lowerText.includes('attack') || lowerText.includes('hostile') || lowerText.includes('combat')) {
            // Extract potential enemy mentions
            const enemyPatterns = [
                /(\w+(?:\s+\w+)*)\s+(?:attack|charge|strike|lunge)/gi,
                /(?:the|a|an)\s+(\w+(?:\s+\w+)*)\s+(?:draws|raises|brandishes)/gi,
                /(\w+(?:\s+\w+)*)\s+(?:snarls|roars|hisses|growls)/gi
            ];

            enemyPatterns.forEach(pattern => {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => {
                    indicators.push({
                        type: 'enemy_action',
                        creature: match[1].trim(),
                        context: match[0]
                    });
                });
            });
        }

        // Check for initiative/turn-based language
        if (/\b(?:initiative|turn order|your turn|roll for)\b/i.test(text)) {
            indicators.push({
                type: 'initiative_call',
                context: 'Initiative or turn-based combat indicated'
            });
        }

        // Check for damage or health mentions
        if (/\b(?:damage|hit points|health|wounded|bloodied)\b/i.test(text)) {
            indicators.push({
                type: 'damage_dealt',
                context: 'Combat damage or health changes mentioned'
            });
        }

        return indicators;
    }

    /**
     * Detect combat triggers from player input
     */
    async detectCombatTriggers(inputData) {
        const text = inputData.text || inputData.message || '';
        
        for (const pattern of this.combatTriggerPatterns) {
            if (pattern.test(text)) {
                console.log(`⚔️ Combat trigger detected: "${text}"`);
                
                // If not already in combat, initiate it
                if (!this.combatActive) {
                    await this.initiateCombatFromPlayerAction(text, inputData);
                }
                return true;
            }
        }
        
        return false;
    }

    // ===== COMBAT INITIATION =====

    /**
     * Handle combat tag from AI DM
     */
    async handleCombatTag(tagMatch) {
        console.log(`⚔️ Combat tag detected: ${tagMatch.type}`);
        
        switch (tagMatch.type) {
            case 'START_COMBAT':
                await this.startCombat(tagMatch.parameter);
                break;
            case 'ENEMY_ENCOUNTER':
                await this.addEnemyEncounter(tagMatch.parameter);
                break;
            case 'INITIATIVE':
                await this.rollInitiative();
                break;
            case 'COMBAT_ROUND':
                await this.advanceRound();
                break;
            case 'END_COMBAT':
                await this.endCombat(tagMatch.parameter);
                break;
        }
    }

    /**
     * Handle natural combat trigger
     */
    async handleNaturalCombatTrigger(indicators, context) {
        console.log(`⚔️ Natural combat trigger detected:`, indicators);
        
        if (!this.combatActive) {
            // Extract enemy information from indicators
            const enemies = indicators
                .filter(i => i.type === 'enemy_action')
                .map(i => i.creature);
            
            await this.startCombat('Natural combat trigger', enemies, context);
        }
    }

    /**
     * Initiate combat from player action
     */
    async initiateCombatFromPlayerAction(triggerText, inputData) {
        console.log(`⚔️ Initiating combat from player action: "${triggerText}"`);
        
        // Analyze the trigger to determine likely enemies
        const potentialEnemies = await this.analyzeCombatContext(triggerText);
        
        // Start combat with inferred enemies
        await this.startCombat('Player initiated combat', potentialEnemies, triggerText);
        
        // Notify AI DM of combat initiation
        if (this.aiDMIntegration) {
            this.core.emit('combat:initiated', {
                trigger: triggerText,
                initiator: inputData.speaker || 'player',
                potentialEnemies: potentialEnemies
            });
        }
    }

    /**
     * Analyze context to determine likely combat participants
     */
    async analyzeCombatContext(triggerText) {
        const enemies = [];
        const currentLocation = this.getCurrentLocation();
        
        if (currentLocation && currentLocation.monsters) {
            // Add monsters from current location
            for (const monsterId of currentLocation.monsters) {
                const monster = await this.monsterDatabase?.getMonster(monsterId);
                if (monster) {
                    enemies.push({
                        type: 'monster',
                        id: monsterId,
                        name: monster.name,
                        data: monster
                    });
                }
            }
        }
        
        // If no specific enemies found, suggest generic enemies
        if (enemies.length === 0) {
            enemies.push({
                type: 'unknown',
                name: 'Unknown Enemy',
                data: null
            });
        }
        
        return enemies;
    }

    // ===== COMBAT MANAGEMENT =====

    /**
     * Start a new combat encounter
     */
    async startCombat(reason = 'Combat initiated', enemies = [], context = '') {
        console.log(`⚔️ Starting combat: ${reason}`);
        
        this.combatActive = true;
        this.round = 1;
        this.currentTurnIndex = 0;
        
        // Create combat instance
        this.currentCombat = {
            id: `combat_${Date.now()}`,
            reason: reason,
            context: context,
            startTime: new Date().toISOString(),
            location: this.getCurrentLocation()?.id || 'unknown',
            participants: new Map(),
            turnOrder: [],
            round: 1,
            status: 'active'
        };
        
        // Add player characters
        await this.addPlayerCombatants();
        
        // Add enemies
        for (const enemy of enemies) {
            await this.addEnemyCombatant(enemy);
        }
        
        // Show combat UI
        this.showCombatUI();
        
        // Switch battle map to combat mode
        await this.switchBattleMapToCombat();
        
        // Roll initiative
        await this.rollInitiative();
        
        // Record combat start
        if (this.interactionHistory) {
            this.interactionHistory.logPlayerAction({
                type: 'combat_start',
                description: `Combat started: ${reason}`,
                location: this.currentCombat.location,
                result: 'combat_active',
                tags: ['combat', 'initiative'],
                combatContext: {
                    combatId: this.currentCombat.id,
                    participants: Array.from(this.currentCombat.participants.keys()),
                    reason: reason
                }
            });
        }
        
        // Notify other systems
        this.core.emit('combat:started', {
            combatId: this.currentCombat.id,
            reason: reason,
            participants: Array.from(this.currentCombat.participants.values())
        });

        // Voice feedback
        if (this.voiceIntegration) {
            await this.voiceIntegration.speak('Combat has begun! Rolling for initiative.');
        }
    }

    /**
     * Add player characters to combat
     */
    async addPlayerCombatants() {
        const character = this.characterSheet?.getCharacterData();
        if (character) {
            const combatant = {
                id: character.id,
                name: character.name,
                type: 'player',
                initiative: 0,
                hitPoints: character.currentHP || character.maxHP || 10,
                maxHitPoints: character.maxHP || 10,
                armorClass: character.armorClass || 10,
                statusEffects: [],
                position: { x: 0, y: 0 }, // Default position
                actions: {
                    action: true,
                    bonus: true,
                    movement: character.speed || 30,
                    reaction: true
                },
                stats: character,
                isPlayerCharacter: true
            };
            
            this.currentCombat.participants.set(character.id, combatant);
            console.log(`Added player combatant: ${character.name}`);
        }
    }

    /**
     * Add enemy to combat
     */
    async addEnemyCombatant(enemyData) {
        let enemy;
        let enemyStats;
        
        if (enemyData.type === 'monster' && enemyData.data) {
            // Get party context for scaling
            const partyContext = await this.getPartyContext();
            
            // Use intelligent monster loading with scaling and AI
            enemyStats = await this.loadMonsterWithAI(enemyData.data, partyContext);
            
            enemy = {
                id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: enemyData.name,
                type: 'enemy',
                initiative: 0,
                hitPoints: enemyStats.hitPoints,
                maxHitPoints: enemyStats.hitPoints,
                armorClass: enemyStats.armorClass,
                statusEffects: [],
                position: { x: 10, y: 10 }, // Default enemy position
                actions: {
                    action: true,
                    bonus: true,
                    movement: enemyStats.speed || 30,
                    reaction: true
                },
                stats: enemyStats,
                monsterData: enemyData.data,
                isPlayerCharacter: false
            };
        } else {
            // Create generic enemy
            enemy = {
                id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: enemyData.name || 'Unknown Enemy',
                type: 'enemy',
                initiative: 0,
                hitPoints: 10,
                maxHitPoints: 10,
                armorClass: 12,
                statusEffects: [],
                position: { x: 10, y: 10 },
                actions: {
                    action: true,
                    bonus: true,
                    movement: 30,
                    reaction: true
                },
                stats: {
                    str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10,
                    proficiencyBonus: 2
                },
                isPlayerCharacter: false
            };
        }
        
        this.currentCombat.participants.set(enemy.id, enemy);
        console.log(`Added enemy combatant: ${enemy.name}`);
        
        return enemy;
    }

    /**
     * Roll initiative for all combatants
     */
    async rollInitiative() {
        console.log('🎲 Rolling initiative...');
        
        const initiatives = [];
        
        for (const [id, combatant] of this.currentCombat.participants) {
            // Roll d20 + Dex modifier
            const dexMod = this.getAbilityModifier(combatant.stats.dex || 10);
            const roll = Math.floor(Math.random() * 20) + 1;
            const initiative = roll + dexMod;
            
            combatant.initiative = initiative;
            initiatives.push({
                id: id,
                name: combatant.name,
                initiative: initiative,
                roll: roll,
                modifier: dexMod
            });
            
            console.log(`${combatant.name} rolled ${roll} + ${dexMod} = ${initiative} for initiative`);
        }
        
        // Sort by initiative (highest first)
        initiatives.sort((a, b) => b.initiative - a.initiative);
        
        // Create turn order
        this.currentCombat.turnOrder = initiatives.map(i => i.id);
        this.currentTurnIndex = 0;
        
        // Update UI
        this.updateInitiativeTracker();
        
        // Voice feedback
        if (this.voiceIntegration) {
            const firstCombatant = this.currentCombat.participants.get(this.currentCombat.turnOrder[0]);
            await this.voiceIntegration.speak(`Initiative rolled! ${firstCombatant.name} goes first.`);
        }
        
        // Start first turn
        await this.startTurn();
    }

    /**
     * Start current combatant's turn
     */
    async startTurn() {
        const currentCombatantId = this.currentCombat.turnOrder[this.currentTurnIndex];
        const currentCombatant = this.currentCombat.participants.get(currentCombatantId);
        
        if (!currentCombatant) {
            console.error('Current combatant not found!');
            return;
        }
        
        console.log(`🎯 ${currentCombatant.name}'s turn (Round ${this.round})`);
        
        // Reset actions for the turn
        currentCombatant.actions = {
            action: true,
            bonus: true,
            movement: currentCombatant.stats.speed || 30,
            reaction: true
        };
        
        // Update UI
        this.updateTurnIndicator(currentCombatant);
        
        // If it's a player character, show action options
        if (currentCombatant.isPlayerCharacter) {
            this.showPlayerActionPanel(currentCombatant);
        } else {
            // AI handles enemy turns
            await this.handleEnemyTurn(currentCombatant);
        }
        
        // Voice feedback
        if (this.voiceIntegration && currentCombatant.isPlayerCharacter) {
            await this.voiceIntegration.speak(`${currentCombatant.name}, it's your turn!`);
        }
    }

    /**
     * Handle enemy AI turn
     */
    async handleEnemyTurn(enemyCombatant) {
        console.log(`🤖 Processing AI turn for ${enemyCombatant.name}`);
        
        // Simple AI: attack the nearest player character
        const playerCharacters = Array.from(this.currentCombat.participants.values())
            .filter(c => c.isPlayerCharacter);
        
        if (playerCharacters.length > 0) {
            const target = playerCharacters[0]; // Simple targeting
            
            // Simulate attack
            const attackRoll = Math.floor(Math.random() * 20) + 1;
            const attackBonus = this.getAttackBonus(enemyCombatant);
            const totalAttack = attackRoll + attackBonus;
            
            console.log(`${enemyCombatant.name} attacks ${target.name}: ${attackRoll} + ${attackBonus} = ${totalAttack} vs AC ${target.armorClass}`);
            
            if (totalAttack >= target.armorClass) {
                // Hit! Roll damage
                const damageRoll = Math.floor(Math.random() * 6) + 1; // d6 base damage
                const damageBonus = this.getAbilityModifier(enemyCombatant.stats.str || 12);
                const totalDamage = damageRoll + damageBonus;
                
                await this.dealDamage(target.id, totalDamage, 'physical');
                
                if (this.voiceIntegration) {
                    await this.voiceIntegration.speak(`${enemyCombatant.name} hits ${target.name} for ${totalDamage} damage!`);
                }
            } else {
                console.log(`${enemyCombatant.name} misses ${target.name}`);
                
                if (this.voiceIntegration) {
                    await this.voiceIntegration.speak(`${enemyCombatant.name} misses ${target.name}.`);
                }
            }
        }
        
        // End enemy turn after a delay
        setTimeout(() => {
            this.endTurn();
        }, 2000);
    }

    /**
     * End current turn and advance to next
     */
    async endTurn() {
        const currentCombatantId = this.currentCombat.turnOrder[this.currentTurnIndex];
        const currentCombatant = this.currentCombat.participants.get(currentCombatantId);
        
        console.log(`⏭️ Ending ${currentCombatant.name}'s turn`);
        
        // Check for combat end conditions
        if (await this.checkCombatEndConditions()) {
            return;
        }
        
        // Advance turn
        this.currentTurnIndex++;
        
        // Check if round is complete
        if (this.currentTurnIndex >= this.currentCombat.turnOrder.length) {
            this.currentTurnIndex = 0;
            this.round++;
            console.log(`🔄 Starting Round ${this.round}`);
            
            // Process start-of-round effects
            await this.processRoundStart();
        }
        
        // Start next turn
        await this.startTurn();
    }

    /**
     * Deal damage to a combatant
     */
    async dealDamage(combatantId, damage, damageType = 'physical') {
        const combatant = this.currentCombat.participants.get(combatantId);
        if (!combatant) return;
        
        // Apply resistances/immunities (simplified)
        let finalDamage = damage;
        
        // Reduce hit points
        combatant.hitPoints = Math.max(0, combatant.hitPoints - finalDamage);
        
        console.log(`💥 ${combatant.name} takes ${finalDamage} ${damageType} damage (${combatant.hitPoints}/${combatant.maxHitPoints} HP remaining)`);
        
        // Update UI
        this.updateCombatantHealth(combatantId);
        
        // Check for unconscious/death
        if (combatant.hitPoints <= 0) {
            await this.handleCombatantDown(combatant);
        }
        
        return finalDamage;
    }

    /**
     * Handle combatant being reduced to 0 HP
     */
    async handleCombatantDown(combatant) {
        console.log(`💀 ${combatant.name} has been reduced to 0 hit points`);
        
        if (combatant.isPlayerCharacter) {
            // Player characters go unconscious and start death saves
            combatant.statusEffects.push({
                name: 'Unconscious',
                description: 'Making death saving throws',
                duration: 'until_stabilized'
            });
            
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`${combatant.name} is unconscious and dying!`);
            }
        } else {
            // Enemies die immediately
            combatant.statusEffects.push({
                name: 'Dead',
                description: 'Defeated in combat',
                duration: 'permanent'
            });
            
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`${combatant.name} has been defeated!`);
            }
        }
        
        this.updateCombatantStatus(combatant.id);
    }

    /**
     * Check if combat should end
     */
    async checkCombatEndConditions() {
        const alivePlayers = Array.from(this.currentCombat.participants.values())
            .filter(c => c.isPlayerCharacter && c.hitPoints > 0);
        
        const aliveEnemies = Array.from(this.currentCombat.participants.values())
            .filter(c => !c.isPlayerCharacter && c.hitPoints > 0);
        
        if (alivePlayers.length === 0) {
            await this.endCombat('Player defeat - all player characters unconscious');
            return true;
        }
        
        if (aliveEnemies.length === 0) {
            await this.endCombat('Victory - all enemies defeated');
            return true;
        }
        
        return false;
    }

    /**
     * End combat encounter
     */
    async endCombat(reason = 'Combat ended') {
        console.log(`🏁 Ending combat: ${reason}`);
        
        this.combatActive = false;
        
        if (this.currentCombat) {
            this.currentCombat.status = 'completed';
            this.currentCombat.endTime = new Date().toISOString();
            this.currentCombat.endReason = reason;
            
            // Calculate combat results
            const results = this.calculateCombatResults();
            
            // Hide combat UI
            this.hideCombatUI();
            
            // Switch battle map back to exploration mode
            await this.switchBattleMapToExploration();
            
            // Record combat end
            if (this.interactionHistory) {
                this.interactionHistory.logPlayerAction({
                    type: 'combat_end',
                    description: `Combat ended: ${reason}`,
                    location: this.currentCombat.location,
                    result: results.outcome,
                    tags: ['combat', 'resolution'],
                    combatContext: {
                        combatId: this.currentCombat.id,
                        duration: new Date(this.currentCombat.endTime) - new Date(this.currentCombat.startTime),
                        rounds: this.round,
                        results: results
                    }
                });
            }
            
            // Notify other systems
            this.core.emit('combat:ended', {
                combatId: this.currentCombat.id,
                reason: reason,
                results: results
            });
            
            // Voice feedback
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`Combat has ended. ${reason}`);
            }
            
            // Reset combat state
            this.currentCombat = null;
            this.round = 1;
            this.currentTurnIndex = 0;
        }
    }

    /**
     * Calculate combat results for XP, loot, etc.
     */
    calculateCombatResults() {
        const playerSurvivors = Array.from(this.currentCombat.participants.values())
            .filter(c => c.isPlayerCharacter && c.hitPoints > 0);
        
        const defeatedEnemies = Array.from(this.currentCombat.participants.values())
            .filter(c => !c.isPlayerCharacter && c.hitPoints <= 0);
        
        let totalXP = 0;
        defeatedEnemies.forEach(enemy => {
            if (enemy.monsterData && enemy.monsterData.challengeRating) {
                totalXP += this.getXPForCR(enemy.monsterData.challengeRating);
            }
        });
        
        return {
            outcome: playerSurvivors.length > 0 ? 'victory' : 'defeat',
            survivingPlayers: playerSurvivors.length,
            defeatedEnemies: defeatedEnemies.length,
            totalXP: totalXP,
            rounds: this.round,
            duration: this.currentCombat.endTime ? 
                new Date(this.currentCombat.endTime) - new Date(this.currentCombat.startTime) : 0
        };
    }

    // ===== COMBAT UI =====

    /**
     * Create combat UI elements
     */
    createCombatUI() {
        // Combat banner (top of screen)
        this.combatBanner = document.createElement('div');
        this.combatBanner.id = 'combat-banner';
        this.combatBanner.className = 'combat-banner hidden';
        this.combatBanner.innerHTML = `
            <div class="combat-info">
                <div class="combat-title">⚔️ Combat Active</div>
                <div class="combat-round">Round <span id="current-round">1</span></div>
            </div>
            <div class="initiative-tracker" id="initiative-tracker">
                <!-- Initiative order will be populated here -->
            </div>
            <div class="combat-controls">
                <button class="btn btn-secondary" id="end-turn-btn" disabled>End Turn</button>
                <button class="btn btn-danger" id="flee-combat-btn">Flee</button>
            </div>
        `;

        // Action panel (appears during player turns)
        this.actionPanel = document.createElement('div');
        this.actionPanel.id = 'action-panel';
        this.actionPanel.className = 'action-panel hidden';
        this.actionPanel.innerHTML = `
            <div class="action-header">
                <h3 id="active-character">Your Turn</h3>
                <div class="action-resources" id="action-resources">
                    <div class="resource-item">
                        <span class="resource-icon">⚡</span>
                        <span class="resource-label">Action</span>
                        <span class="resource-status available" id="action-status">Available</span>
                    </div>
                    <div class="resource-item">
                        <span class="resource-icon">🏃</span>
                        <span class="resource-label">Movement</span>
                        <span class="resource-status" id="movement-status">30 ft</span>
                    </div>
                    <div class="resource-item">
                        <span class="resource-icon">⚡</span>
                        <span class="resource-label">Bonus</span>
                        <span class="resource-status available" id="bonus-status">Available</span>
                    </div>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-primary action-btn" id="attack-btn">
                    <span class="action-icon">⚔️</span>
                    <span class="action-name">Attack</span>
                </button>
                <button class="btn btn-primary action-btn" id="cast-spell-btn">
                    <span class="action-icon">✨</span>
                    <span class="action-name">Cast Spell</span>
                </button>
                <button class="btn btn-primary action-btn" id="use-item-btn">
                    <span class="action-icon">🧪</span>
                    <span class="action-name">Use Item</span>
                </button>
                <button class="btn btn-secondary action-btn" id="move-btn">
                    <span class="action-icon">👟</span>
                    <span class="action-name">Move</span>
                </button>
                <button class="btn btn-secondary action-btn" id="dodge-btn">
                    <span class="action-icon">🛡️</span>
                    <span class="action-name">Dodge</span>
                </button>
                <button class="btn btn-secondary action-btn" id="help-action-btn">
                    <span class="action-icon">🤝</span>
                    <span class="action-name">Help</span>
                </button>
            </div>
        `;

        // Add CSS styles
        const styles = `
            <style>
                .combat-banner {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, var(--color-error), #8B0000);
                    color: white;
                    padding: var(--spacing-sm) var(--spacing-md);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 1000;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                    transform: translateY(-100%);
                    transition: transform 0.3s ease;
                }

                .combat-banner.visible {
                    transform: translateY(0);
                }

                .combat-info {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-md);
                }

                .combat-title {
                    font-weight: bold;
                    font-size: 1.1rem;
                }

                .combat-round {
                    background: rgba(255, 255, 255, 0.2);
                    padding: var(--spacing-xs) var(--spacing-sm);
                    border-radius: var(--border-radius);
                }

                .initiative-tracker {
                    display: flex;
                    gap: var(--spacing-xs);
                    align-items: center;
                }

                .initiative-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: var(--spacing-xs);
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: var(--border-radius);
                    min-width: 60px;
                    transition: all 0.3s ease;
                }

                .initiative-item.active {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.1);
                }

                .initiative-item.player {
                    border: 2px solid #4CAF50;
                }

                .initiative-item.enemy {
                    border: 2px solid #F44336;
                }

                .initiative-portrait {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: var(--color-accent);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 0.8rem;
                    margin-bottom: var(--spacing-xs);
                }

                .initiative-name {
                    font-size: 0.7rem;
                    text-align: center;
                    font-weight: 600;
                }

                .initiative-value {
                    font-size: 0.6rem;
                    opacity: 0.8;
                }

                .combat-controls {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .action-panel {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--color-background-primary);
                    border: 2px solid var(--color-accent);
                    border-radius: var(--border-radius);
                    padding: var(--spacing-md);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    z-index: 999;
                    min-width: 600px;
                    opacity: 0;
                    transform: translateX(-50%) translateY(100%);
                    transition: all 0.3s ease;
                }

                .action-panel.visible {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }

                .action-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-md);
                    padding-bottom: var(--spacing-sm);
                    border-bottom: 1px solid var(--color-border);
                }

                .action-header h3 {
                    margin: 0;
                    color: var(--color-accent);
                }

                .action-resources {
                    display: flex;
                    gap: var(--spacing-md);
                }

                .resource-item {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    font-size: 0.85rem;
                }

                .resource-icon {
                    font-size: 1rem;
                }

                .resource-status.available {
                    color: var(--color-success);
                    font-weight: 600;
                }

                .resource-status.used {
                    color: var(--color-text-secondary);
                    text-decoration: line-through;
                }

                .action-buttons {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: var(--spacing-sm);
                }

                .action-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                    transition: all 0.2s ease;
                }

                .action-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .action-icon {
                    font-size: 1.5rem;
                }

                .action-name {
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .hidden {
                    display: none;
                }

                /* Health bars in initiative tracker */
                .health-bar {
                    width: 40px;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 2px;
                    margin-top: 2px;
                    overflow: hidden;
                }

                .health-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4CAF50, #8BC34A);
                    transition: width 0.3s ease;
                }

                .health-fill.wounded {
                    background: linear-gradient(90deg, #FF9800, #FFC107);
                }

                .health-fill.critical {
                    background: linear-gradient(90deg, #F44336, #E57373);
                }

                /* Battle map integration styles */
                .battle-map.combat-mode {
                    border: 3px solid var(--color-error);
                    box-shadow: 0 0 20px rgba(255, 0, 0, 0.3);
                }

                .battle-map .grid-cell.combat-highlight {
                    background: rgba(255, 0, 0, 0.1);
                }

                .combatant-piece {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: 2px solid;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 0.7rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .combatant-piece.player {
                    background: #4CAF50;
                    border-color: #2E7D32;
                    color: white;
                }

                .combatant-piece.enemy {
                    background: #F44336;
                    border-color: #C62828;
                    color: white;
                }

                .combatant-piece.active {
                    animation: pulse 1s infinite;
                    box-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
                }

                .combatant-piece.unconscious {
                    opacity: 0.5;
                    filter: grayscale(100%);
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.appendChild(this.combatBanner);
        document.body.appendChild(this.actionPanel);
    }

    /**
     * Show combat UI elements
     */
    showCombatUI() {
        this.combatBanner.classList.remove('hidden');
        this.combatBanner.classList.add('visible');
        
        // Adjust page layout for combat banner
        document.body.style.paddingTop = '60px';
    }

    /**
     * Hide combat UI elements
     */
    hideCombatUI() {
        this.combatBanner.classList.remove('visible');
        this.combatBanner.classList.add('hidden');
        
        this.actionPanel.classList.remove('visible');
        this.actionPanel.classList.add('hidden');
        
        // Reset page layout
        document.body.style.paddingTop = '0';
    }

    /**
     * Update initiative tracker display
     */
    updateInitiativeTracker() {
        const tracker = document.getElementById('initiative-tracker');
        if (!tracker || !this.currentCombat) return;

        tracker.innerHTML = this.currentCombat.turnOrder.map((combatantId, index) => {
            const combatant = this.currentCombat.participants.get(combatantId);
            const isActive = index === this.currentTurnIndex;
            const healthPercent = (combatant.hitPoints / combatant.maxHitPoints) * 100;
            
            let healthClass = '';
            if (healthPercent <= 25) healthClass = 'critical';
            else if (healthPercent <= 50) healthClass = 'wounded';

            return `
                <div class="initiative-item ${isActive ? 'active' : ''} ${combatant.isPlayerCharacter ? 'player' : 'enemy'}">
                    <div class="initiative-portrait">
                        ${combatant.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="initiative-name">${combatant.name}</div>
                    <div class="initiative-value">${combatant.initiative}</div>
                    <div class="health-bar">
                        <div class="health-fill ${healthClass}" style="width: ${healthPercent}%"></div>
                    </div>
                </div>
            `;
        }).join('');

        // Update round counter
        const roundElement = document.getElementById('current-round');
        if (roundElement) {
            roundElement.textContent = this.round.toString();
        }
    }

    /**
     * Show player action panel
     */
    showPlayerActionPanel(combatant) {
        const panel = document.getElementById('action-panel');
        const characterName = document.getElementById('active-character');
        
        if (characterName) {
            characterName.textContent = `${combatant.name}'s Turn`;
        }
        
        // Update resource status
        this.updateResourceStatus(combatant);
        
        // Show panel
        panel.classList.remove('hidden');
        panel.classList.add('visible');
        
        // Enable end turn button
        const endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) {
            endTurnBtn.disabled = false;
        }
    }

    /**
     * Update turn indicator
     */
    updateTurnIndicator(combatant) {
        // Update initiative tracker
        this.updateInitiativeTracker();
        
        // Update battle map if in combat mode
        this.updateBattleMapTurnIndicator(combatant);
    }

    // ===== BATTLE MAP INTEGRATION =====

    /**
     * Switch battle map to combat mode
     */
    async switchBattleMapToCombat() {
        // This would integrate with your existing battle map
        const battleMap = document.querySelector('.battle-map');
        if (battleMap) {
            battleMap.classList.add('combat-mode');
            
            // Add combatant pieces to the map
            this.addCombatantsToMap();
        }
    }

    /**
     * Switch battle map back to exploration mode
     */
    async switchBattleMapToExploration() {
        const battleMap = document.querySelector('.battle-map');
        if (battleMap) {
            battleMap.classList.remove('combat-mode');
            
            // Remove combatant pieces
            this.removeCombatantsFromMap();
        }
    }

    /**
     * Add combatant pieces to battle map
     */
    addCombatantsToMap() {
        if (!this.currentCombat) return;
        
        for (const [id, combatant] of this.currentCombat.participants) {
            const piece = this.createCombatantPiece(combatant);
            this.placeCombatantPiece(piece, combatant.position);
        }
    }

    /**
     * Create visual piece for combatant
     */
    createCombatantPiece(combatant) {
        const piece = document.createElement('div');
        piece.className = `combatant-piece ${combatant.isPlayerCharacter ? 'player' : 'enemy'}`;
        piece.id = `piece-${combatant.id}`;
        piece.textContent = combatant.name.charAt(0).toUpperCase();
        piece.title = `${combatant.name} (${combatant.hitPoints}/${combatant.maxHitPoints} HP)`;
        
        // Add click handler for selecting combatant
        piece.addEventListener('click', () => {
            this.selectCombatant(combatant.id);
        });
        
        return piece;
    }

    /**
     * Place combatant piece on battle map
     */
    placeCombatantPiece(piece, position) {
        // This would integrate with your grid system
        const battleMap = document.querySelector('.battle-map');
        if (battleMap) {
            piece.style.position = 'absolute';
            piece.style.left = `${position.x * 30}px`; // Assuming 30px grid
            piece.style.top = `${position.y * 30}px`;
            battleMap.appendChild(piece);
        }
    }

    /**
     * Update battle map turn indicator
     */
    updateBattleMapTurnIndicator(activeCombatant) {
        // Remove active class from all pieces
        document.querySelectorAll('.combatant-piece').forEach(piece => {
            piece.classList.remove('active');
        });
        
        // Add active class to current combatant
        const activePiece = document.getElementById(`piece-${activeCombatant.id}`);
        if (activePiece) {
            activePiece.classList.add('active');
        }
    }

    /**
     * Remove combatant pieces from battle map
     */
    removeCombatantsFromMap() {
        document.querySelectorAll('.combatant-piece').forEach(piece => {
            piece.remove();
        });
    }

    // ===== EVENT HANDLERS =====

    bindCombatEvents() {
        // End turn button
        document.getElementById('end-turn-btn')?.addEventListener('click', () => {
            this.endTurn();
        });

        // Flee button
        document.getElementById('flee-combat-btn')?.addEventListener('click', () => {
            this.attemptFlee();
        });

        // Action buttons
        document.getElementById('attack-btn')?.addEventListener('click', () => {
            this.performAttack();
        });

        document.getElementById('cast-spell-btn')?.addEventListener('click', () => {
            this.showSpellMenu();
        });

        document.getElementById('use-item-btn')?.addEventListener('click', () => {
            this.showItemMenu();
        });

        document.getElementById('move-btn')?.addEventListener('click', () => {
            this.enterMovementMode();
        });

        document.getElementById('dodge-btn')?.addEventListener('click', () => {
            this.performDodge();
        });

        document.getElementById('help-action-btn')?.addEventListener('click', () => {
            this.performHelp();
        });
    }

    // ===== COMBAT ACTIONS =====

    /**
     * Perform attack action
     */
    async performAttack() {
        const currentCombatantId = this.currentCombat.turnOrder[this.currentTurnIndex];
        const attacker = this.currentCombat.participants.get(currentCombatantId);
        
        if (!attacker.actions.action) {
            alert('You have already used your action this turn.');
            return;
        }

        // Show target selection
        const targets = Array.from(this.currentCombat.participants.values())
            .filter(c => !c.isPlayerCharacter && c.hitPoints > 0);
        
        if (targets.length === 0) {
            alert('No valid targets for attack.');
            return;
        }

        // Simple target selection (first enemy)
        const target = targets[0];
        
        // Roll attack
        const attackRoll = Math.floor(Math.random() * 20) + 1;
        const attackBonus = this.getAttackBonus(attacker);
        const totalAttack = attackRoll + attackBonus;
        
        console.log(`${attacker.name} attacks ${target.name}: ${attackRoll} + ${attackBonus} = ${totalAttack} vs AC ${target.armorClass}`);
        
        if (totalAttack >= target.armorClass) {
            // Hit! Roll damage
            const damageRoll = Math.floor(Math.random() * 8) + 1; // d8 weapon
            const damageBonus = this.getAbilityModifier(attacker.stats.str || 12);
            const totalDamage = damageRoll + damageBonus;
            
            await this.dealDamage(target.id, totalDamage, 'physical');
            
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`${attacker.name} hits ${target.name} for ${totalDamage} damage!`);
            }
        } else {
            console.log(`${attacker.name} misses ${target.name}`);
            
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`${attacker.name} misses ${target.name}.`);
            }
        }
        
        // Use action
        attacker.actions.action = false;
        this.updateResourceStatus(attacker);
        
        // Auto-end turn if no actions left
        if (!attacker.actions.action && !attacker.actions.bonus && attacker.actions.movement <= 0) {
            setTimeout(() => {
                this.endTurn();
            }, 1000);
        }
    }

    /**
     * Attempt to flee from combat
     */
    async attemptFlee() {
        if (confirm('Are you sure you want to flee from combat? This may have consequences.')) {
            await this.endCombat('Party fled from combat');
        }
    }

    // ===== UTILITY FUNCTIONS =====

    /**
     * Get ability modifier
     */
    getAbilityModifier(abilityScore) {
        return Math.floor((abilityScore - 10) / 2);
    }

    /**
     * Get attack bonus for combatant
     */
    getAttackBonus(combatant) {
        const strMod = this.getAbilityModifier(combatant.stats.str || 12);
        const profBonus = combatant.stats.proficiencyBonus || 2;
        return strMod + profBonus;
    }

    /**
     * Get XP value for challenge rating
     */
    getXPForCR(challengeRating) {
        const xpTable = {
            0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
            1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
            6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900
        };
        return xpTable[challengeRating] || 0;
    }

    /**
     * Update resource status display
     */
    updateResourceStatus(combatant) {
        const actionStatus = document.getElementById('action-status');
        const movementStatus = document.getElementById('movement-status');
        const bonusStatus = document.getElementById('bonus-status');
        
        if (actionStatus) {
            actionStatus.textContent = combatant.actions.action ? 'Available' : 'Used';
            actionStatus.className = combatant.actions.action ? 'resource-status available' : 'resource-status used';
        }
        
        if (movementStatus) {
            movementStatus.textContent = `${combatant.actions.movement} ft`;
        }
        
        if (bonusStatus) {
            bonusStatus.textContent = combatant.actions.bonus ? 'Available' : 'Used';
            bonusStatus.className = combatant.actions.bonus ? 'resource-status available' : 'resource-status used';
        }
    }

    /**
     * Update combatant health display
     */
    updateCombatantHealth(combatantId) {
        this.updateInitiativeTracker();
        
        // Update battle map piece tooltip
        const piece = document.getElementById(`piece-${combatantId}`);
        const combatant = this.currentCombat.participants.get(combatantId);
        if (piece && combatant) {
            piece.title = `${combatant.name} (${combatant.hitPoints}/${combatant.maxHitPoints} HP)`;
            
            if (combatant.hitPoints <= 0) {
                piece.classList.add('unconscious');
            }
        }
    }

    /**
     * Update combatant status effects
     */
    updateCombatantStatus(combatantId) {
        this.updateCombatantHealth(combatantId);
        // Additional status effect UI updates would go here
    }

    /**
     * Get current location
     */
    getCurrentLocation() {
        return this.core.getModule('campaignManager')?.getCurrentLocation();
    }

    /**
     * Process start of round effects
     */
    async processRoundStart() {
        // Process status effects, regeneration, etc.
        for (const [id, combatant] of this.currentCombat.participants) {
            // Example: Process ongoing effects
            combatant.statusEffects = combatant.statusEffects.filter(effect => {
                if (effect.duration === 'start_of_turn') {
                    console.log(`${combatant.name} loses ${effect.name} effect`);
                    return false;
                }
                return true;
            });
        }
    }

    // ===== PUBLIC API =====

    /**
     * Check if currently in combat
     */
    isInCombat() {
        return this.combatActive;
    }

    /**
     * Get current combat state
     */
    getCombatState() {
        return this.currentCombat;
    }

    /**
     * Force start combat (for testing)
     */
    async forceStartCombat(enemies = []) {
        await this.startCombat('Manual combat initiation', enemies, 'Forced start for testing');
    }

    /**
     * Force end combat
     */
    async forceEndCombat(reason = 'Manual end') {
        await this.endCombat(reason);
    }

    /**
     * Add combatant to existing combat
     */
    async addCombatantToCombat(combatantData) {
        if (!this.combatActive) return null;
        
        const combatant = await this.addEnemyCombatant(combatantData);
        
        // Add to initiative order at appropriate position
        const initiative = Math.floor(Math.random() * 20) + 1 + 
            this.getAbilityModifier(combatant.stats.dex || 10);
        combatant.initiative = initiative;
        
        // Insert into turn order
        let insertIndex = this.currentCombat.turnOrder.length;
        for (let i = 0; i < this.currentCombat.turnOrder.length; i++) {
            const otherCombatant = this.currentCombat.participants.get(this.currentCombat.turnOrder[i]);
            if (otherCombatant.initiative < initiative) {
                insertIndex = i;
                break;
            }
        }
        
        this.currentCombat.turnOrder.splice(insertIndex, 0, combatant.id);
        
        // Adjust current turn index if necessary
        if (insertIndex <= this.currentTurnIndex) {
            this.currentTurnIndex++;
        }
        
        this.updateInitiativeTracker();
        
        return combatant;
    }

    // ===== MONSTER AI AND SCALING SYSTEM =====

    /**
     * Load monster with intelligent scaling and AI
     */
    async loadMonsterWithAI(monsterData, partyContext) {
        const monster = await this.monsterDatabase.createStatBlock(monsterData);
        
        // Apply dynamic scaling
        const scaledMonster = await this.scaleMonsterToParty(monster, partyContext);
        
        // Initialize AI behavior
        const aiProfile = this.createMonsterAI(scaledMonster);
        this.monsterAI.set(scaledMonster.id, aiProfile);
        
        // Load combat memory for this monster type
        await this.loadCombatMemory(scaledMonster);
        
        return scaledMonster;
    }

    /**
     * Scale monster stats based on party capabilities
     */
    async scaleMonsterToParty(monster, partyContext) {
        const scaledMonster = { ...monster };
        
        // Calculate party power level
        const partyPower = this.calculatePartyPower(partyContext);
        
        // Determine scaling factor
        const baseChallenge = this.calculateBaseChallenge(monster);
        const targetChallenge = partyPower * 0.8; // Slightly easier for fair combat
        const scalingFactor = Math.max(0.5, Math.min(2.0, targetChallenge / baseChallenge));
        
        console.log(`Scaling monster ${monster.name} by ${scalingFactor.toFixed(2)}x`);
        
        // Scale health
        scaledMonster.hitPoints = Math.floor(monster.hitPoints * scalingFactor);
        scaledMonster.maxHitPoints = scaledMonster.hitPoints;
        
        // Scale damage output
        if (scaledMonster.attacks) {
            scaledMonster.attacks.forEach(attack => {
                if (attack.damageRoll) {
                    const baseDamage = this.calculateAverageDamage(attack.damageRoll);
                    const scaledDamage = Math.floor(baseDamage * scalingFactor);
                    attack.scaledDamage = scaledDamage;
                }
            });
        }
        
        // Adjust AC slightly
        const acAdjustment = Math.floor((scalingFactor - 1) * 2);
        scaledMonster.armorClass = Math.max(8, Math.min(22, monster.armorClass + acAdjustment));
        
        // Scale saving throws
        if (scaledMonster.savingThrows) {
            Object.keys(scaledMonster.savingThrows).forEach(ability => {
                const adjustment = Math.floor((scalingFactor - 1) * 3);
                scaledMonster.savingThrows[ability] += adjustment;
            });
        }
        
        // Record scaling for analysis
        scaledMonster.scalingApplied = {
            factor: scalingFactor,
            originalHP: monster.hitPoints,
            originalAC: monster.armorClass,
            partyPower: partyPower,
            timestamp: new Date().toISOString()
        };
        
        return scaledMonster;
    }

    /**
     * Calculate party power level
     */
    calculatePartyPower(partyContext) {
        let totalPower = 0;
        
        partyContext.members.forEach(character => {
            const level = character.level || 1;
            const hp = character.maxHP || 10;
            const ac = character.armorClass || 10;
            const attackBonus = this.getAttackBonus(character);
            
            // Power formula considering level, survivability, and damage output
            const characterPower = (level * 2) + (hp * 0.2) + (ac * 0.5) + (attackBonus * 1.5);
            totalPower += characterPower;
        });
        
        // Adjust for party size
        const sizeMultiplier = Math.max(0.7, Math.min(1.5, partyContext.members.length / 4));
        
        return totalPower * sizeMultiplier;
    }

    /**
     * Calculate base challenge of monster
     */
    calculateBaseChallenge(monster) {
        const hp = monster.hitPoints || 1;
        const ac = monster.armorClass || 10;
        const attackBonus = monster.proficiencyBonus || 2;
        
        // Estimate average damage per round
        let avgDamage = 5; // Default
        if (monster.attacks && monster.attacks.length > 0) {
            avgDamage = monster.attacks.reduce((sum, attack) => {
                return sum + this.calculateAverageDamage(attack.damageRoll || '1d6');
            }, 0);
        }
        
        return (hp * 0.3) + (ac * 1.2) + (avgDamage * 2) + (attackBonus * 1.5);
    }

    /**
     * Calculate average damage from dice notation
     */
    calculateAverageDamage(damageRoll) {
        // Parse dice notation like "2d6+3"
        const match = damageRoll.match(/(\d+)?d(\d+)(?:\+(\d+))?/i);
        if (!match) return 5; // Default
        
        const numDice = parseInt(match[1] || '1');
        const dieSize = parseInt(match[2]);
        const bonus = parseInt(match[3] || '0');
        
        return (numDice * (dieSize + 1) / 2) + bonus;
    }

    /**
     * Create AI behavior profile for monster
     */
    createMonsterAI(monster) {
        const intelligence = monster.stats?.int || 10;
        const wisdom = monster.stats?.wis || 10;
        const alignment = monster.alignment || 'neutral';
        
        return {
            id: monster.id,
            name: monster.name,
            intelligence: intelligence,
            wisdom: wisdom,
            alignment: alignment,
            
            // Behavioral traits based on intelligence
            tacticalLevel: this.getTacticalLevel(intelligence),
            selfPreservation: this.getSelfPreservationLevel(wisdom, alignment),
            aggressionLevel: this.getAggressionLevel(alignment, monster.type),
            
            // Combat preferences
            preferredRange: this.getPreferredRange(monster),
            groupTactics: intelligence >= 10,
            fleeThreshold: this.getFleeThreshold(wisdom, alignment),
            
            // Learning system
            encounteredTactics: new Set(),
            effectiveness: new Map(),
            adaptationLevel: Math.max(0, (intelligence - 10) / 2)
        };
    }

    /**
     * Get tactical intelligence level
     */
    getTacticalLevel(intelligence) {
        if (intelligence >= 16) return 'genius';      // Dragons, masterminds
        if (intelligence >= 14) return 'high';        // Skilled warriors
        if (intelligence >= 12) return 'moderate';    // Average soldiers
        if (intelligence >= 8) return 'basic';        // Simple tactics
        return 'instinctive';                         // Pure instinct
    }

    /**
     * Get self-preservation level
     */
    getSelfPreservationLevel(wisdom, alignment) {
        const wisdomMod = this.getAbilityModifier(wisdom);
        const alignmentMod = alignment.includes('evil') ? -1 : alignment.includes('good') ? 1 : 0;
        
        const score = wisdomMod + alignmentMod;
        
        if (score >= 3) return 'high';
        if (score >= 1) return 'moderate';
        if (score >= -1) return 'low';
        return 'reckless';
    }

    /**
     * Get aggression level
     */
    getAggressionLevel(alignment, type) {
        let aggression = 0.5; // Base neutral
        
        if (alignment.includes('evil')) aggression += 0.3;
        if (alignment.includes('chaotic')) aggression += 0.2;
        if (alignment.includes('lawful')) aggression -= 0.1;
        
        // Type-based modifiers
        if (type === 'fiend' || type === 'undead') aggression += 0.3;
        if (type === 'beast') aggression += 0.1;
        if (type === 'celestial') aggression -= 0.4;
        
        return Math.max(0.1, Math.min(1.0, aggression));
    }

    /**
     * Get preferred combat range
     */
    getPreferredRange(monster) {
        if (monster.attacks) {
            const rangedAttacks = monster.attacks.filter(a => 
                a.range && (a.range > 10 || a.type === 'ranged'));
            const meleeAttacks = monster.attacks.filter(a => 
                !a.range || a.range <= 10);
            
            if (rangedAttacks.length > meleeAttacks.length) return 'ranged';
            if (meleeAttacks.length > 0) return 'melee';
        }
        
        return 'mixed';
    }

    /**
     * Get flee threshold based on wisdom and alignment
     */
    getFleeThreshold(wisdom, alignment) {
        let threshold = 0.25; // Base 25% health
        
        const wisdomMod = this.getAbilityModifier(wisdom);
        threshold += wisdomMod * 0.05;
        
        if (alignment.includes('evil')) threshold += 0.1; // More self-serving
        if (alignment.includes('good')) threshold -= 0.05; // More dedicated
        if (alignment.includes('lawful')) threshold -= 0.05; // More dutiful
        
        return Math.max(0.1, Math.min(0.5, threshold));
    }

    /**
     * Execute monster AI turn
     */
    async executeMonsterTurn(monsterId) {
        const monster = this.currentCombat.participants.get(monsterId);
        const aiProfile = this.monsterAI.get(monsterId);
        
        if (!monster || !aiProfile) return;
        
        console.log(`Executing AI turn for ${monster.name} (Intelligence: ${aiProfile.tacticalLevel})`);
        
        // Check flee condition
        const healthPercent = monster.hitPoints / monster.maxHitPoints;
        if (healthPercent <= aiProfile.fleeThreshold && aiProfile.selfPreservation !== 'reckless') {
            const fleeChance = this.calculateFleeChance(aiProfile, healthPercent);
            if (Math.random() < fleeChance) {
                await this.executeMonsterFlee(monster);
                return;
            }
        }
        
        // Analyze battlefield
        const battlefield = this.analyzeBattlefield(monster);
        
        // Choose action based on AI profile
        const action = this.chooseMonsterAction(monster, aiProfile, battlefield);
        
        // Execute chosen action
        await this.executeMonsterAction(monster, action, battlefield);
        
        // Record tactic for learning
        this.recordTacticUsage(monster, action, battlefield);
    }

    /**
     * Analyze current battlefield state
     */
    analyzeBattlefield(monster) {
        const allies = Array.from(this.currentCombat.participants.values())
            .filter(c => !c.isPlayerCharacter && c.hitPoints > 0 && c.id !== monster.id);
        
        const enemies = Array.from(this.currentCombat.participants.values())
            .filter(c => c.isPlayerCharacter && c.hitPoints > 0);
        
        const woundedAllies = allies.filter(c => c.hitPoints < c.maxHitPoints * 0.5);
        const nearDeathEnemies = enemies.filter(c => c.hitPoints < c.maxHitPoints * 0.25);
        
        return {
            allies: allies,
            enemies: enemies,
            woundedAllies: woundedAllies,
            nearDeathEnemies: nearDeathEnemies,
            allyCount: allies.length,
            enemyCount: enemies.length,
            advantageRatio: allies.length / Math.max(enemies.length, 1)
        };
    }

    /**
     * Choose best action for monster based on AI
     */
    chooseMonsterAction(monster, aiProfile, battlefield) {
        const actions = [
            { type: 'attack', priority: 1.0 },
            { type: 'move', priority: 0.3 },
            { type: 'special', priority: 0.7 },
            { type: 'defend', priority: 0.2 }
        ];
        
        // Modify priorities based on AI profile
        if (aiProfile.tacticalLevel === 'genius') {
            this.adjustGeniusPriorities(actions, battlefield, monster);
        } else if (aiProfile.tacticalLevel === 'high') {
            this.adjustHighIntelligencePriorities(actions, battlefield, monster);
        } else if (aiProfile.tacticalLevel === 'basic') {
            this.adjustBasicPriorities(actions, battlefield, monster);
        }
        
        // Apply aggression modifier
        const attackAction = actions.find(a => a.type === 'attack');
        if (attackAction) {
            attackAction.priority *= (0.5 + aiProfile.aggressionLevel);
        }
        
        // Choose action with highest priority (with some randomness)
        actions.sort((a, b) => b.priority - a.priority);
        
        // Add randomness based on intelligence (lower int = more random)
        const randomnessFactor = Math.max(0.1, (15 - aiProfile.intelligence) / 20);
        if (Math.random() < randomnessFactor) {
            return actions[Math.floor(Math.random() * Math.min(3, actions.length))];
        }
        
        return actions[0];
    }

    /**
     * Adjust priorities for genius-level monsters
     */
    adjustGeniusPriorities(actions, battlefield, monster) {
        const attackAction = actions.find(a => a.type === 'attack');
        const defendAction = actions.find(a => a.type === 'defend');
        
        // Focus on finishing wounded enemies
        if (battlefield.nearDeathEnemies.length > 0) {
            attackAction.priority *= 1.5;
        }
        
        // Use defensive tactics when outnumbered
        if (battlefield.advantageRatio < 0.7) {
            defendAction.priority *= 2.0;
        }
        
        // Prioritize special abilities strategically
        const specialAction = actions.find(a => a.type === 'special');
        if (monster.stats && monster.stats.specialAbilities) {
            specialAction.priority *= 1.3;
        }
    }

    /**
     * Adjust priorities for high intelligence monsters
     */
    adjustHighIntelligencePriorities(actions, battlefield, monster) {
        const attackAction = actions.find(a => a.type === 'attack');
        
        // Focus fire on weakest enemy
        if (battlefield.nearDeathEnemies.length > 0) {
            attackAction.priority *= 1.2;
        }
        
        // Coordinate with allies
        if (battlefield.allyCount > 1) {
            const moveAction = actions.find(a => a.type === 'move');
            moveAction.priority *= 1.1; // Better positioning
        }
    }

    /**
     * Adjust priorities for basic intelligence monsters
     */
    adjustBasicPriorities(actions, battlefield, monster) {
        // Simple: attack if healthy, defend if wounded
        const healthPercent = monster.hitPoints / monster.maxHitPoints;
        
        if (healthPercent < 0.5) {
            const defendAction = actions.find(a => a.type === 'defend');
            defendAction.priority *= 1.5;
        }
    }

    /**
     * Execute chosen monster action
     */
    async executeMonsterAction(monster, action, battlefield) {
        switch (action.type) {
            case 'attack':
                await this.executeMonsterAttack(monster, battlefield);
                break;
            case 'move':
                await this.executeMonsterMove(monster, battlefield);
                break;
            case 'special':
                await this.executeMonsterSpecial(monster, battlefield);
                break;
            case 'defend':
                await this.executeMonsterDefend(monster);
                break;
        }
    }

    /**
     * Execute monster attack with target selection
     */
    async executeMonsterAttack(monster, battlefield) {
        let target = null;
        const aiProfile = this.monsterAI.get(monster.id);
        
        // Intelligent target selection
        if (aiProfile.tacticalLevel === 'genius' || aiProfile.tacticalLevel === 'high') {
            // Prioritize wounded enemies or spellcasters
            target = battlefield.nearDeathEnemies[0] || 
                    battlefield.enemies.find(e => e.stats?.class === 'wizard') ||
                    battlefield.enemies.find(e => e.stats?.class === 'sorcerer') ||
                    battlefield.enemies[0];
        } else {
            // Attack nearest or random enemy
            target = battlefield.enemies[Math.floor(Math.random() * battlefield.enemies.length)];
        }
        
        if (!target) return;
        
        // Execute attack similar to player attack
        const attackRoll = Math.floor(Math.random() * 20) + 1;
        const attackBonus = this.getAttackBonus(monster);
        const totalAttack = attackRoll + attackBonus;
        
        console.log(`${monster.name} attacks ${target.name}: ${attackRoll} + ${attackBonus} = ${totalAttack} vs AC ${target.armorClass}`);
        
        if (totalAttack >= target.armorClass) {
            let damage = Math.floor(Math.random() * 8) + 1; // Base damage
            
            // Apply scaling if available
            if (monster.scalingApplied && monster.attacks && monster.attacks[0]) {
                damage = monster.attacks[0].scaledDamage || damage;
            }
            
            await this.dealDamage(target.id, damage, 'physical');
            
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`${monster.name} hits ${target.name} for ${damage} damage!`);
            }
        } else {
            console.log(`${monster.name} misses ${target.name}`);
            
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`${monster.name} misses ${target.name}.`);
            }
        }
        
        monster.actions.action = false;
    }

    /**
     * Execute monster movement
     */
    async executeMonsterMove(monster, battlefield) {
        const aiProfile = this.monsterAI.get(monster.id);
        
        // Movement logic based on preferred range and tactics
        if (aiProfile.preferredRange === 'ranged' && battlefield.enemies.length > 0) {
            // Try to maintain distance
            console.log(`${monster.name} moves to maintain distance`);
        } else if (aiProfile.preferredRange === 'melee') {
            // Move closer to enemies
            console.log(`${monster.name} moves closer to engage in melee`);
        }
        
        monster.actions.movement = 0;
    }

    /**
     * Execute monster special ability
     */
    async executeMonsterSpecial(monster, battlefield) {
        console.log(`${monster.name} uses a special ability`);
        // Implementation would depend on specific monster abilities
        monster.actions.action = false;
    }

    /**
     * Execute monster defend action
     */
    async executeMonsterDefend(monster) {
        console.log(`${monster.name} takes a defensive stance`);
        // Add defensive bonuses, status effects, etc.
        monster.statusEffects.push({
            name: 'Defending',
            type: 'defense_bonus',
            duration: 'end_of_turn',
            bonus: 2
        });
        monster.actions.action = false;
    }

    /**
     * Execute monster flee attempt
     */
    async executeMonsterFlee(monster) {
        console.log(`${monster.name} attempts to flee from combat!`);
        
        // Simple flee mechanic
        const fleeRoll = Math.floor(Math.random() * 20) + 1;
        const fleeSuccess = fleeRoll >= 10; // Base DC 10
        
        if (fleeSuccess) {
            console.log(`${monster.name} successfully flees!`);
            monster.hitPoints = 0; // Remove from combat
            monster.statusEffects.push({
                name: 'Fled',
                type: 'combat_end',
                duration: 'permanent'
            });
            
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`${monster.name} flees from combat!`);
            }
        } else {
            console.log(`${monster.name} fails to flee and remains in combat.`);
            
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`${monster.name} tries to flee but cannot escape!`);
            }
        }
        
        monster.actions.action = false;
        monster.actions.movement = 0;
    }

    /**
     * Calculate flee chance based on AI profile and health
     */
    calculateFleeChance(aiProfile, healthPercent) {
        let fleeChance = 0.1; // Base 10% chance
        
        // Health modifier
        fleeChance += (1 - healthPercent) * 0.5;
        
        // Self-preservation modifier
        switch (aiProfile.selfPreservation) {
            case 'high':
                fleeChance += 0.3;
                break;
            case 'moderate':
                fleeChance += 0.1;
                break;
            case 'low':
                fleeChance -= 0.1;
                break;
            case 'reckless':
                fleeChance -= 0.3;
                break;
        }
        
        // Intelligence modifier (smarter creatures flee more tactically)
        if (aiProfile.tacticalLevel === 'genius') {
            fleeChance += 0.2;
        } else if (aiProfile.tacticalLevel === 'instinctive') {
            fleeChance -= 0.1;
        }
        
        return Math.max(0, Math.min(0.8, fleeChance));
    }

    /**
     * Record tactic usage for learning
     */
    recordTacticUsage(monster, action, battlefield) {
        const tacticKey = `${action.type}_${battlefield.enemyCount}_${battlefield.advantageRatio.toFixed(1)}`;
        
        if (!this.tacticEffectiveness.has(monster.name)) {
            this.tacticEffectiveness.set(monster.name, new Map());
        }
        
        const monsterTactics = this.tacticEffectiveness.get(monster.name);
        
        if (!monsterTactics.has(tacticKey)) {
            monsterTactics.set(tacticKey, {
                uses: 0,
                successes: 0,
                effectiveness: 0.5
            });
        }
        
        const tactic = monsterTactics.get(tacticKey);
        tactic.uses++;
        
        // Success will be determined later based on combat outcome
    }

    /**
     * Load combat memory for monster type
     */
    async loadCombatMemory(monster) {
        const memoryKey = monster.name.toLowerCase();
        
        if (!this.combatMemory.has(memoryKey)) {
            this.combatMemory.set(memoryKey, {
                encounters: 0,
                defeats: 0,
                playerTactics: new Map(),
                effectiveCounters: new Map(),
                lastEncounter: null
            });
        }
        
        const memory = this.combatMemory.get(memoryKey);
        memory.encounters++;
        memory.lastEncounter = new Date().toISOString();
        
        console.log(`${monster.name} remembers ${memory.encounters} previous encounters`);
    }

    /**
     * Record combat outcome for learning
     */
    async recordCombatOutcome(outcome) {
        // Update tactic effectiveness
        for (const [monsterId, monster] of this.currentCombat.participants) {
            if (monster.isPlayerCharacter) continue;
            
            const memoryKey = monster.name.toLowerCase();
            const memory = this.combatMemory.get(memoryKey);
            
            if (memory) {
                if (outcome.outcome === 'defeat') {
                    memory.defeats++;
                }
                
                // Analyze what player tactics were effective
                this.analyzePlayerTactics(outcome, memory);
            }
        }
        
        // Save combat data to database
        await this.saveCombatToDatabase(outcome);
    }

    /**
     * Analyze effective player tactics
     */
    analyzePlayerTactics(outcome, memory) {
        // This would analyze the combat log to identify patterns
        // For now, record basic effectiveness
        
        if (outcome.outcome === 'victory') {
            // Player tactics were effective
            const tacticUsed = 'standard_attack'; // Simplified
            
            if (!memory.playerTactics.has(tacticUsed)) {
                memory.playerTactics.set(tacticUsed, { encounters: 0, successes: 0 });
            }
            
            const tactic = memory.playerTactics.get(tacticUsed);
            tactic.encounters++;
            tactic.successes++;
        }
    }

    /**
     * Save combat data to database
     */
    async saveCombatToDatabase(outcome) {
        if (!this.worldDatabase) return;
        
        const combatRecord = {
            id: `combat_${Date.now()}`,
            timestamp: new Date().toISOString(),
            location: this.getCurrentLocation(),
            participants: Array.from(this.currentCombat.participants.values()).map(c => ({
                name: c.name,
                type: c.isPlayerCharacter ? 'player' : 'enemy',
                level: c.stats?.level || 1,
                finalHP: c.hitPoints,
                maxHP: c.maxHitPoints
            })),
            outcome: outcome.outcome,
            rounds: outcome.rounds,
            duration: outcome.duration,
            xpAwarded: outcome.totalXP,
            tacticsUsed: Array.from(this.tacticEffectiveness.entries()),
            scalingApplied: this.currentCombat.scalingFactors
        };
        
        await this.worldDatabase.addCombatRecord(combatRecord);
        console.log('Combat outcome recorded to database');
    }

    /**
     * Get combat statistics for balancing
     */
    getCombatStatistics() {
        const stats = {
            totalCombats: this.combatMemory.size,
            averageRounds: 0,
            playerWinRate: 0,
            mostEffectiveTactics: [],
            scaling: this.scalingFactors
        };
        
        // Calculate statistics from combat memory
        let totalDefeats = 0;
        let totalEncounters = 0;
        
        for (const [monsterType, memory] of this.combatMemory) {
            totalDefeats += memory.defeats;
            totalEncounters += memory.encounters;
        }
        
        stats.playerWinRate = totalEncounters > 0 ? (totalDefeats / totalEncounters) : 0.5;
        
        return stats;
    }

    /**
     * Adjust scaling factors based on performance
     */
    async adjustScalingFactors() {
        const stats = this.getCombatStatistics();
        
        // Auto-adjust based on win rate
        if (stats.playerWinRate > 0.8) {
            // Too easy, make monsters stronger
            this.scalingFactors.tacticalScore = Math.min(1.0, this.scalingFactors.tacticalScore + 0.1);
            console.log('Combat too easy - increasing monster difficulty');
        } else if (stats.playerWinRate < 0.3) {
            // Too hard, make monsters weaker
            this.scalingFactors.tacticalScore = Math.max(0.3, this.scalingFactors.tacticalScore - 0.1);
            console.log('Combat too difficult - reducing monster difficulty');
        }
    }

    /**
     * Get party context for monster scaling
     */
    async getPartyContext() {
        const characterSheet = this.core.getModule('characterSheet');
        const campaignManager = this.core.getModule('campaignManager');
        
        // Get party members (for now, assume single character)
        const currentCharacter = characterSheet?.getCurrentCharacter();
        const members = currentCharacter ? [currentCharacter] : [];
        
        // Add any additional party members from campaign
        if (campaignManager) {
            const campaign = campaignManager.getCurrentCampaign();
            if (campaign && campaign.partyMembers) {
                members.push(...campaign.partyMembers);
            }
        }
        
        return {
            members: members,
            averageLevel: members.length > 0 ? 
                members.reduce((sum, m) => sum + (m.level || 1), 0) / members.length : 1,
            size: members.length || 1
        };
    }
}