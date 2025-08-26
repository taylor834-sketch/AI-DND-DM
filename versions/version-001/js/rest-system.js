export default class RestSystem {
    constructor(core) {
        this.core = core;
        this.characterSheet = null;
        this.worldDatabase = null;
        this.dynamicQuestSystem = null;
        this.choiceTrackingSystem = null;
        this.combatSystem = null;
        this.voiceIntegration = null;
        this.aiDMIntegration = null;
        
        // Rest state tracking
        this.restState = {
            lastLongRest: null,
            lastShortRest: null,
            shortRestsToday: 0,
            exhaustionLevel: 0,
            restRestrictions: new Set(),
            campLocation: null,
            restingSafety: 'safe'
        };
        
        // Resource recovery rates
        this.recoveryRates = {
            shortRest: {
                hitDice: 'spend',  // Player spends hit dice
                abilities: {
                    warlock: ['spellSlots'],
                    fighter: ['secondWind', 'actionSurge'],
                    monk: ['kiPoints'],
                    bard: ['bardicInspiration'],
                    wizard: ['arcaneRecovery']
                },
                duration: 60000, // 1 minute in real time
                hitPointsBase: 0 // No automatic healing
            },
            longRest: {
                hitPoints: 'full',
                hitDice: 'half', // Recover half of total hit dice
                spellSlots: 'full',
                abilities: 'full',
                exhaustion: 1, // Remove 1 level
                duration: 480000, // 8 minutes in real time
                worldTimeAdvance: 8 * 60 * 60 * 1000 // 8 hours game time
            }
        };
        
        // Rest interruption chances
        this.interruptionRisks = {
            safe: 0.05,      // Cities, secure locations
            guarded: 0.15,   // Campsites with watch
            wilderness: 0.25, // Natural outdoor areas
            dangerous: 0.45,  // Dungeons, hostile territory
            cursed: 0.60     // Cursed or magical areas
        };
        
        // Environmental factors
        this.restEnvironments = {
            comfortable: {
                name: 'Comfortable',
                modifier: 1.2,  // Faster recovery
                description: 'Soft beds, warm rooms, good food'
            },
            normal: {
                name: 'Normal', 
                modifier: 1.0,
                description: 'Basic camping conditions'
            },
            rough: {
                name: 'Rough',
                modifier: 0.8,  // Slower recovery
                description: 'Cold, wet, or uncomfortable conditions'
            },
            harsh: {
                name: 'Harsh',
                modifier: 0.6,  // Much slower recovery
                description: 'Extreme weather or hostile environment'
            }
        };
        
        // Active rest session
        this.activeRestSession = null;
        
        this.init();
    }

    async init() {
        // Get required modules
        this.characterSheet = this.core.getModule('characterSheet');
        this.worldDatabase = this.core.getModule('worldDatabase');
        this.dynamicQuestSystem = this.core.getModule('dynamicQuestSystem');
        this.choiceTrackingSystem = this.core.getModule('choiceTrackingSystem');
        this.combatSystem = this.core.getModule('combatSystem');
        this.voiceIntegration = this.core.getModule('voiceIntegration');
        this.aiDMIntegration = this.core.getModule('aiDMIntegration');
        
        // Load rest state
        await this.loadRestState();
        
        // Create rest interface
        this.createRestInterface();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start rest availability monitoring
        this.startRestMonitoring();
        
        console.log('💤 Rest System initialized');
    }

    /**
     * Initiate a short rest
     */
    async initiateShortRest(options = {}) {
        if (!this.canTakeShortRest()) {
            throw new Error(this.getRestRestrictionReason());
        }

        const restData = {
            type: 'short',
            startTime: new Date().toISOString(),
            location: options.location || this.getCurrentLocation(),
            environment: this.determineRestEnvironment(options),
            duration: this.recoveryRates.shortRest.duration,
            interrupted: false,
            activities: options.activities || [],
            safety: this.calculateRestSafety(options.location)
        };

        console.log(`💤 Starting short rest at ${restData.location}`);
        
        // Check for safety and interruptions
        const interruptionRisk = this.interruptionRisks[restData.safety];
        
        // Start rest session
        this.activeRestSession = restData;
        this.showRestInterface(restData);
        
        // Notify other systems
        this.core.emit('rest:started', { rest: restData });
        
        // Voice feedback
        if (this.voiceIntegration) {
            await this.voiceIntegration.speak(`Beginning short rest. You have 1 hour to recover.`);
        }
        
        // Set up rest completion
        const restPromise = this.executeShortRest(restData, interruptionRisk);
        
        return restPromise;
    }

    /**
     * Initiate a long rest
     */
    async initiateLongRest(options = {}) {
        if (!this.canTakeLongRest()) {
            throw new Error(this.getRestRestrictionReason());
        }

        const restData = {
            type: 'long',
            startTime: new Date().toISOString(),
            location: options.location || this.getCurrentLocation(),
            environment: this.determineRestEnvironment(options),
            duration: this.recoveryRates.longRest.duration,
            interrupted: false,
            activities: options.activities || [],
            safety: this.calculateRestSafety(options.location),
            timeConsequences: await this.calculateTimeConsequences()
        };

        console.log(`💤 Starting long rest at ${restData.location}`);
        
        // Show time consequence preview
        if (restData.timeConsequences.length > 0) {
            const proceed = await this.confirmLongRestWithConsequences(restData.timeConsequences);
            if (!proceed) {
                return null;
            }
        }
        
        // Check for safety and interruptions
        const interruptionRisk = this.interruptionRisks[restData.safety];
        
        // Start rest session
        this.activeRestSession = restData;
        this.showRestInterface(restData);
        
        // Notify other systems
        this.core.emit('rest:started', { rest: restData });
        
        // Voice feedback
        if (this.voiceIntegration) {
            await this.voiceIntegration.speak(`Beginning long rest. You will sleep for 8 hours.`);
        }
        
        // Set up rest completion
        const restPromise = this.executeLongRest(restData, interruptionRisk);
        
        return restPromise;
    }

    /**
     * Execute short rest mechanics
     */
    async executeShortRest(restData, interruptionRisk) {
        return new Promise(async (resolve, reject) => {
            let timeElapsed = 0;
            const checkInterval = 10000; // Check every 10 seconds
            
            const restInterval = setInterval(async () => {
                timeElapsed += checkInterval;
                
                // Update progress
                const progress = Math.min(timeElapsed / restData.duration, 1.0);
                this.updateRestProgress(progress);
                
                // Check for interruption
                if (Math.random() < (interruptionRisk * checkInterval / restData.duration)) {
                    clearInterval(restInterval);
                    restData.interrupted = true;
                    restData.interruptionTime = timeElapsed;
                    
                    const interruption = await this.handleRestInterruption(restData);
                    if (interruption.resumeRest) {
                        // Resume rest after interruption
                        const remainingTime = restData.duration - timeElapsed;
                        restData.duration = remainingTime;
                        timeElapsed = 0;
                        this.executeShortRest({...restData, startTime: new Date().toISOString()}, interruptionRisk)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        // Rest ended due to interruption
                        resolve(await this.completeInterruptedRest(restData));
                    }
                    return;
                }
                
                // Rest completed successfully
                if (timeElapsed >= restData.duration) {
                    clearInterval(restInterval);
                    resolve(await this.completeShortRest(restData));
                }
            }, checkInterval);
        });
    }

    /**
     * Execute long rest mechanics
     */
    async executeLongRest(restData, interruptionRisk) {
        return new Promise(async (resolve, reject) => {
            let timeElapsed = 0;
            const checkInterval = 30000; // Check every 30 seconds for long rest
            
            const restInterval = setInterval(async () => {
                timeElapsed += checkInterval;
                
                // Update progress
                const progress = Math.min(timeElapsed / restData.duration, 1.0);
                this.updateRestProgress(progress);
                
                // Check for interruption (less frequent than short rest)
                if (Math.random() < (interruptionRisk * checkInterval / restData.duration)) {
                    clearInterval(restInterval);
                    restData.interrupted = true;
                    restData.interruptionTime = timeElapsed;
                    
                    const interruption = await this.handleRestInterruption(restData);
                    if (interruption.resumeRest) {
                        // Resume rest after interruption
                        const remainingTime = restData.duration - timeElapsed;
                        restData.duration = remainingTime;
                        timeElapsed = 0;
                        this.executeLongRest({...restData, startTime: new Date().toISOString()}, interruptionRisk)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        // Rest ended due to interruption
                        resolve(await this.completeInterruptedRest(restData));
                    }
                    return;
                }
                
                // Apply time consequences gradually
                if (restData.type === 'long' && timeElapsed % (restData.duration / 4) === 0) {
                    await this.applyProgressiveTimeConsequences(restData, timeElapsed / restData.duration);
                }
                
                // Rest completed successfully
                if (timeElapsed >= restData.duration) {
                    clearInterval(restInterval);
                    resolve(await this.completeLongRest(restData));
                }
            }, checkInterval);
        });
    }

    /**
     * Complete short rest and apply benefits
     */
    async completeShortRest(restData) {
        console.log('✅ Short rest completed');
        
        const benefits = {
            type: 'short',
            hitDiceHealing: 0,
            abilitiesRecovered: [],
            specialRecovery: []
        };
        
        if (this.characterSheet) {
            const character = this.characterSheet.getCurrentCharacter();
            
            // Hit dice healing (player chooses how many to spend)
            benefits.hitDiceAvailable = character.hitDice || Math.floor(character.level / 2) + 1;
            benefits.maxHealingPossible = benefits.hitDiceAvailable * (character.hitDie || 8);
            
            // Class-specific short rest recoveries
            benefits.abilitiesRecovered = this.recoverShortRestAbilities(character);
            
            // Apply environmental modifiers
            const envModifier = this.restEnvironments[restData.environment]?.modifier || 1.0;
            benefits.maxHealingPossible = Math.floor(benefits.maxHealingPossible * envModifier);
        }
        
        // Update rest state
        this.restState.lastShortRest = new Date().toISOString();
        this.restState.shortRestsToday++;
        
        // Complete the rest session
        this.activeRestSession = null;
        this.hideRestInterface();
        
        // Show benefits dialog
        this.showRestBenefitsDialog(benefits);
        
        // Notify systems
        this.core.emit('rest:completed', { rest: restData, benefits });
        
        // Voice feedback
        if (this.voiceIntegration) {
            await this.voiceIntegration.speak(`Short rest completed. You feel refreshed and ready to continue.`);
        }
        
        // Check for choice tracking
        if (this.choiceTrackingSystem) {
            await this.choiceTrackingSystem.recordChoice({
                description: `Took a short rest at ${restData.location}`,
                selectedOption: `Short rest (${Math.round(restData.duration / 60000)} minutes)`,
                context: {
                    location: restData.location,
                    situation: 'resource_management',
                    stakes: 'low'
                }
            });
        }
        
        await this.saveRestState();
        return benefits;
    }

    /**
     * Complete long rest and apply benefits
     */
    async completeLongRest(restData) {
        console.log('✅ Long rest completed');
        
        const benefits = {
            type: 'long',
            hitPointsRecovered: 'full',
            hitDiceRecovered: 'half',
            spellSlotsRecovered: 'all',
            abilitiesRecovered: 'all',
            exhaustionReduced: Math.min(this.restState.exhaustionLevel, 1),
            timeAdvanced: this.recoveryRates.longRest.worldTimeAdvance
        };
        
        if (this.characterSheet) {
            const character = this.characterSheet.getCurrentCharacter();
            
            // Full hit point recovery
            const healingAmount = character.maxHP - character.currentHP;
            if (healingAmount > 0) {
                await this.characterSheet.modifyHP(healingAmount);
                benefits.hitPointsHealed = healingAmount;
            }
            
            // Hit dice recovery (half of maximum)
            const hitDiceRecovered = Math.floor((character.hitDice || character.level) / 2);
            benefits.hitDiceRecovered = hitDiceRecovered;
            
            // Spell slot recovery
            benefits.spellSlotsRecovered = this.recoverSpellSlots(character);
            
            // Ability recovery
            benefits.abilitiesRecovered = this.recoverLongRestAbilities(character);
            
            // Apply environmental modifiers
            const envModifier = this.restEnvironments[restData.environment]?.modifier || 1.0;
            if (envModifier < 1.0) {
                benefits.hitPointsHealed = Math.floor(benefits.hitPointsHealed * envModifier);
                benefits.note = `Recovery reduced due to ${restData.environment} conditions`;
            }
        }
        
        // Reduce exhaustion
        if (this.restState.exhaustionLevel > 0) {
            this.restState.exhaustionLevel = Math.max(0, this.restState.exhaustionLevel - benefits.exhaustionReduced);
        }
        
        // Update rest state
        this.restState.lastLongRest = new Date().toISOString();
        this.restState.shortRestsToday = 0; // Reset short rest counter
        
        // Advance world time
        if (this.worldDatabase) {
            await this.worldDatabase.advanceTime(benefits.timeAdvanced);
        }
        
        // Apply time consequences
        if (restData.timeConsequences.length > 0) {
            await this.applyTimeConsequences(restData.timeConsequences);
        }
        
        // Complete the rest session
        this.activeRestSession = null;
        this.hideRestInterface();
        
        // Show benefits dialog
        this.showRestBenefitsDialog(benefits);
        
        // Notify systems
        this.core.emit('rest:completed', { rest: restData, benefits });
        
        // Voice feedback
        if (this.voiceIntegration) {
            await this.voiceIntegration.speak(`Long rest completed. You feel fully refreshed and ready for new adventures.`);
        }
        
        // Check for quest evolution due to time passage
        if (this.dynamicQuestSystem) {
            for (const quest of this.dynamicQuestSystem.getActiveQuests()) {
                await this.dynamicQuestSystem.evolveQuest(quest.id, { 
                    type: 'time_passage', 
                    timeData: { hoursAdvanced: 8, restLocation: restData.location } 
                });
            }
        }
        
        // Record choice
        if (this.choiceTrackingSystem) {
            await this.choiceTrackingSystem.recordChoice({
                description: `Took a long rest at ${restData.location}`,
                selectedOption: `Long rest (8 hours)`,
                context: {
                    location: restData.location,
                    situation: 'time_management',
                    stakes: restData.timeConsequences.length > 0 ? 'medium' : 'low'
                }
            });
        }
        
        await this.saveRestState();
        return benefits;
    }

    /**
     * Handle rest interruption
     */
    async handleRestInterruption(restData) {
        console.log('⚠️ Rest interrupted!');
        
        const interruptionTypes = [
            {
                type: 'combat',
                description: 'Enemies attack your resting party!',
                resumable: false,
                severity: 'high'
            },
            {
                type: 'environmental',
                description: 'A storm forces you to find better shelter.',
                resumable: true,
                severity: 'medium'
            },
            {
                type: 'social',
                description: 'Travelers approach your camp seeking help.',
                resumable: true,
                severity: 'low'
            },
            {
                type: 'supernatural',
                description: 'Strange magical energies disturb your rest.',
                resumable: false,
                severity: 'high'
            }
        ];
        
        // Select interruption type based on environment and location
        const interruption = this.selectInterruption(interruptionTypes, restData);
        
        // Notify systems
        this.core.emit('rest:interrupted', { rest: restData, interruption });
        
        // Voice notification
        if (this.voiceIntegration) {
            await this.voiceIntegration.speak(`Your rest is interrupted! ${interruption.description}`);
        }
        
        // Handle specific interruption types
        switch (interruption.type) {
            case 'combat':
                return await this.handleCombatInterruption(restData, interruption);
            case 'environmental':
                return await this.handleEnvironmentalInterruption(restData, interruption);
            case 'social':
                return await this.handleSocialInterruption(restData, interruption);
            case 'supernatural':
                return await this.handleSupernaturalInterruption(restData, interruption);
            default:
                return { resumeRest: false, partialBenefits: false };
        }
    }

    /**
     * Handle combat interruption during rest
     */
    async handleCombatInterruption(restData, interruption) {
        // Generate appropriate enemies based on location and party level
        const enemies = this.generateRestInterruptionEnemies(restData.location);
        
        if (this.combatSystem && enemies.length > 0) {
            // Start combat
            await this.combatSystem.startCombat(
                'Rest Interruption Combat',
                enemies,
                'rest_interruption',
                restData.location
            );
            
            // Combat prevents rest completion
            return { 
                resumeRest: false, 
                partialBenefits: this.calculatePartialRestBenefits(restData),
                combatStarted: true
            };
        }
        
        return { resumeRest: false, partialBenefits: false };
    }

    /**
     * Calculate potential time consequences of long rest
     */
    async calculateTimeConsequences() {
        const consequences = [];
        
        if (!this.dynamicQuestSystem) return consequences;
        
        // Check active quests for time-sensitive elements
        const activeQuests = this.dynamicQuestSystem.getActiveQuests();
        
        for (const quest of activeQuests) {
            if (quest.context?.timeframe === 'urgent' || quest.context?.stakes === 'high') {
                consequences.push({
                    type: 'quest_progression',
                    severity: 'medium',
                    description: `Quest "${quest.title}" may advance while you rest`,
                    questId: quest.id
                });
            }
        }
        
        // Check world events
        if (this.worldDatabase) {
            const pendingEvents = await this.worldDatabase.getPendingTimeEvents();
            for (const event of pendingEvents) {
                if (event.triggerTime <= Date.now() + this.recoveryRates.longRest.worldTimeAdvance) {
                    consequences.push({
                        type: 'world_event',
                        severity: event.severity || 'low',
                        description: event.description,
                        eventId: event.id
                    });
                }
            }
        }
        
        // Environmental consequences
        const location = this.getCurrentLocation();
        if (location.includes('dungeon') || location.includes('enemy')) {
            consequences.push({
                type: 'enemy_preparation',
                severity: 'high',
                description: 'Enemies may discover your presence and prepare defenses'
            });
        }
        
        return consequences;
    }

    /**
     * Apply time consequences after long rest
     */
    async applyTimeConsequences(consequences) {
        for (const consequence of consequences) {
            console.log(`⏰ Applying time consequence: ${consequence.description}`);
            
            switch (consequence.type) {
                case 'quest_progression':
                    await this.advanceQuestDueToTime(consequence.questId);
                    break;
                case 'world_event':
                    await this.triggerWorldEvent(consequence.eventId);
                    break;
                case 'enemy_preparation':
                    await this.strengthenEnemyDefenses();
                    break;
            }
        }
    }

    /**
     * Check if short rest is possible
     */
    canTakeShortRest() {
        // Check for active restrictions
        if (this.restRestrictions.has('no_short_rest')) return false;
        if (this.restRestrictions.has('no_rest')) return false;
        
        // Check if in combat
        if (this.combatSystem?.isInCombat()) return false;
        
        // Check if already resting
        if (this.activeRestSession) return false;
        
        // Check time since last short rest (minimum 1 hour)
        if (this.restState.lastShortRest) {
            const timeSinceRest = Date.now() - new Date(this.restState.lastShortRest).getTime();
            if (timeSinceRest < 3600000) return false; // 1 hour
        }
        
        return true;
    }

    /**
     * Check if long rest is possible
     */
    canTakeLongRest() {
        // Check for active restrictions
        if (this.restRestrictions.has('no_long_rest')) return false;
        if (this.restRestrictions.has('no_rest')) return false;
        
        // Check if in combat
        if (this.combatSystem?.isInCombat()) return false;
        
        // Check if already resting
        if (this.activeRestSession) return false;
        
        // Check time since last long rest (minimum 24 hours)
        if (this.restState.lastLongRest) {
            const timeSinceRest = Date.now() - new Date(this.restState.lastLongRest).getTime();
            if (timeSinceRest < 86400000) return false; // 24 hours
        }
        
        return true;
    }

    /**
     * Get reason why rest is restricted
     */
    getRestRestrictionReason() {
        if (this.restRestrictions.has('no_rest')) {
            return 'You cannot rest in this dangerous area';
        }
        if (this.combatSystem?.isInCombat()) {
            return 'You cannot rest while in combat';
        }
        if (this.activeRestSession) {
            return 'You are already resting';
        }
        
        const now = Date.now();
        if (this.restState.lastShortRest) {
            const timeSinceShort = now - new Date(this.restState.lastShortRest).getTime();
            if (timeSinceShort < 3600000) {
                return 'You must wait 1 hour between short rests';
            }
        }
        
        if (this.restState.lastLongRest) {
            const timeSinceLong = now - new Date(this.restState.lastLongRest).getTime();
            if (timeSinceLong < 86400000) {
                return 'You can only take one long rest per day';
            }
        }
        
        return 'Rest is not available';
    }

    /**
     * Add rest restriction
     */
    addRestRestriction(restriction, reason = '') {
        this.restRestrictions.add(restriction);
        console.log(`🚫 Rest restriction added: ${restriction} - ${reason}`);
        
        if (this.voiceIntegration && reason) {
            this.voiceIntegration.speak(reason);
        }
    }

    /**
     * Remove rest restriction
     */
    removeRestRestriction(restriction) {
        this.restRestrictions.delete(restriction);
        console.log(`✅ Rest restriction removed: ${restriction}`);
    }

    /**
     * Create rest interface
     */
    createRestInterface() {
        const restInterface = document.createElement('div');
        restInterface.id = 'rest-interface';
        restInterface.className = 'rest-interface hidden';
        restInterface.innerHTML = `
            <div class="rest-header">
                <h3 id="rest-title">💤 Rest</h3>
                <div class="rest-controls">
                    <button id="cancel-rest" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
            
            <div class="rest-content">
                <div class="rest-progress">
                    <div class="progress-bar">
                        <div id="rest-progress-fill" class="progress-fill"></div>
                    </div>
                    <div id="rest-time-remaining" class="time-remaining">Time remaining: --:--</div>
                </div>
                
                <div class="rest-activities" id="rest-activities">
                    <h4>Rest Activities</h4>
                    <div class="activity-options">
                        <label class="activity-option">
                            <input type="checkbox" name="activity" value="watch">
                            <span>Keep Watch (reduces interruption risk)</span>
                        </label>
                        <label class="activity-option">
                            <input type="checkbox" name="activity" value="study">
                            <span>Study Spellbook (wizard bonus)</span>
                        </label>
                        <label class="activity-option">
                            <input type="checkbox" name="activity" value="craft">
                            <span>Craft Items (if materials available)</span>
                        </label>
                        <label class="activity-option">
                            <input type="checkbox" name="activity" value="meditate">
                            <span>Meditate (minor stress relief)</span>
                        </label>
                    </div>
                </div>
                
                <div class="hit-dice-panel" id="hit-dice-panel">
                    <h4>Hit Dice Healing</h4>
                    <p>You can spend hit dice to regain hit points during a short rest.</p>
                    <div class="hit-dice-controls">
                        <button id="spend-hit-die" class="btn btn-primary">Spend Hit Die (d8+2)</button>
                        <span id="hit-dice-remaining">Hit Dice: 3/4</span>
                    </div>
                    <div id="healing-total" class="healing-total">Total Healing: 0 HP</div>
                </div>
                
                <div class="rest-environment" id="rest-environment">
                    <h4>Environment</h4>
                    <div class="env-info">
                        <span id="env-name">Normal</span>
                        <span id="env-description">Basic camping conditions</span>
                    </div>
                    <div class="safety-indicator">
                        <span>Safety Level:</span>
                        <span id="safety-level" class="safety-safe">Safe</span>
                    </div>
                </div>
            </div>
            
            <div class="rest-footer">
                <div class="rest-stats">
                    <div class="stat">
                        <label>Last Short Rest:</label>
                        <span id="last-short-rest">Never</span>
                    </div>
                    <div class="stat">
                        <label>Last Long Rest:</label>
                        <span id="last-long-rest">Never</span>
                    </div>
                    <div class="stat">
                        <label>Short Rests Today:</label>
                        <span id="short-rests-today">0</span>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .rest-interface {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 500px;
                max-height: 600px;
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                z-index: 1000;
                overflow-y: auto;
            }

            .rest-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-md);
                background: var(--color-bg-secondary);
                border-bottom: 1px solid var(--color-border);
            }

            .rest-header h3 {
                margin: 0;
                color: var(--color-accent);
            }

            .rest-content {
                padding: var(--spacing-md);
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .rest-progress {
                text-align: center;
            }

            .progress-bar {
                width: 100%;
                height: 12px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                overflow: hidden;
                margin-bottom: var(--spacing-sm);
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #8BC34A);
                width: 0%;
                transition: width 0.3s ease;
            }

            .time-remaining {
                font-size: 0.9rem;
                color: var(--color-text-secondary);
            }

            .rest-activities h4, .hit-dice-panel h4, .rest-environment h4 {
                margin: 0 0 var(--spacing-sm) 0;
                color: var(--color-accent);
            }

            .activity-options {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-xs);
            }

            .activity-option {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                padding: var(--spacing-xs);
                border-radius: var(--border-radius);
                cursor: pointer;
                transition: background-color 0.2s;
            }

            .activity-option:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .activity-option input {
                margin: 0;
            }

            .hit-dice-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: var(--spacing-sm) 0;
            }

            .healing-total {
                font-weight: 600;
                color: var(--color-success);
                text-align: center;
                padding: var(--spacing-sm);
                background: rgba(76, 175, 80, 0.1);
                border-radius: var(--border-radius);
            }

            .env-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: var(--spacing-sm);
            }

            .safety-indicator {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .safety-safe { color: var(--color-success); }
            .safety-guarded { color: var(--color-warning); }
            .safety-dangerous { color: var(--color-error); }

            .rest-footer {
                padding: var(--spacing-md);
                background: var(--color-bg-secondary);
                border-top: 1px solid var(--color-border);
            }

            .rest-stats {
                display: flex;
                justify-content: space-between;
                font-size: 0.8rem;
            }

            .stat {
                display: flex;
                flex-direction: column;
                text-align: center;
            }

            .stat label {
                color: var(--color-text-secondary);
                margin-bottom: 2px;
            }

            .hidden {
                display: none;
            }
        `;

        document.head.appendChild(styles);
        document.body.appendChild(restInterface);
    }

    /**
     * Show rest interface
     */
    showRestInterface(restData) {
        const restInterface = document.getElementById('rest-interface');
        
        // Update title
        document.getElementById('rest-title').textContent = 
            `💤 ${restData.type === 'short' ? 'Short Rest' : 'Long Rest'}`;
        
        // Update environment info
        const envData = this.restEnvironments[restData.environment];
        document.getElementById('env-name').textContent = envData.name;
        document.getElementById('env-description').textContent = envData.description;
        
        // Update safety level
        const safetyElement = document.getElementById('safety-level');
        safetyElement.textContent = restData.safety.charAt(0).toUpperCase() + restData.safety.slice(1);
        safetyElement.className = `safety-${restData.safety}`;
        
        // Show/hide hit dice panel
        const hitDicePanel = document.getElementById('hit-dice-panel');
        if (restData.type === 'short') {
            hitDicePanel.classList.remove('hidden');
            this.updateHitDicePanel();
        } else {
            hitDicePanel.classList.add('hidden');
        }
        
        // Update rest stats
        this.updateRestStats();
        
        restInterface.classList.remove('hidden');
    }

    /**
     * Hide rest interface
     */
    hideRestInterface() {
        document.getElementById('rest-interface').classList.add('hidden');
    }

    /**
     * Update rest progress
     */
    updateRestProgress(progress) {
        const progressFill = document.getElementById('rest-progress-fill');
        const timeRemaining = document.getElementById('rest-time-remaining');
        
        if (progressFill) {
            progressFill.style.width = `${progress * 100}%`;
        }
        
        if (timeRemaining && this.activeRestSession) {
            const totalDuration = this.activeRestSession.duration;
            const remaining = totalDuration * (1 - progress);
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            timeRemaining.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    // ===== HELPER METHODS =====

    getCurrentLocation() {
        return this.core.getModule('campaignManager')?.getCurrentLocation() || 'Unknown Location';
    }

    determineRestEnvironment(options) {
        if (options.environment) return options.environment;
        
        const location = options.location || this.getCurrentLocation();
        
        if (location.includes('inn') || location.includes('tavern') || location.includes('home')) {
            return 'comfortable';
        } else if (location.includes('dungeon') || location.includes('cave') || location.includes('ruins')) {
            return 'harsh';
        } else if (location.includes('wilderness') || location.includes('forest') || location.includes('mountain')) {
            return 'rough';
        }
        
        return 'normal';
    }

    calculateRestSafety(location) {
        if (!location) return 'safe';
        
        const loc = location.toLowerCase();
        
        if (loc.includes('city') || loc.includes('town') || loc.includes('inn')) {
            return 'safe';
        } else if (loc.includes('camp') || loc.includes('outpost')) {
            return 'guarded';
        } else if (loc.includes('dungeon') || loc.includes('enemy') || loc.includes('hostile')) {
            return 'dangerous';
        } else if (loc.includes('cursed') || loc.includes('haunted') || loc.includes('magical')) {
            return 'cursed';
        }
        
        return 'wilderness';
    }

    recoverShortRestAbilities(character) {
        const recovered = [];
        const classAbilities = this.recoveryRates.shortRest.abilities[character.class?.toLowerCase()] || [];
        
        for (const ability of classAbilities) {
            recovered.push({
                name: ability,
                description: `${ability} recovered through short rest`
            });
        }
        
        return recovered;
    }

    recoverLongRestAbilities(character) {
        // All abilities recover on long rest
        return [
            { name: 'All Abilities', description: 'All class features and abilities fully recovered' }
        ];
    }

    recoverSpellSlots(character) {
        // Simplified spell slot recovery
        if (character.spellSlots) {
            return Object.keys(character.spellSlots).map(level => ({
                level: level,
                slots: character.spellSlots[level]
            }));
        }
        return [];
    }

    setupEventListeners() {
        // Cancel rest button
        document.getElementById('cancel-rest')?.addEventListener('click', () => {
            this.cancelRest();
        });

        // Hit dice spending
        document.getElementById('spend-hit-die')?.addEventListener('click', () => {
            this.spendHitDie();
        });

        // Listen for combat start (interrupts rest)
        this.core.on('combat:started', () => {
            if (this.activeRestSession) {
                this.interruptRest('combat');
            }
        });
    }

    async cancelRest() {
        if (!this.activeRestSession) return;
        
        console.log('❌ Rest cancelled by player');
        
        const partialBenefits = this.calculatePartialRestBenefits(this.activeRestSession);
        
        this.activeRestSession = null;
        this.hideRestInterface();
        
        this.core.emit('rest:cancelled', { partialBenefits });
        
        if (this.voiceIntegration) {
            await this.voiceIntegration.speak('Rest cancelled. You feel only slightly refreshed.');
        }
    }

    calculatePartialRestBenefits(restData) {
        const progress = restData.interruptionTime ? 
            restData.interruptionTime / restData.duration : 0;
        
        if (progress < 0.25) {
            return { message: 'Rest was too brief to provide any benefits' };
        } else if (progress < 0.5) {
            return { 
                message: 'Brief rest provided minimal recovery',
                hitPointsRecovered: Math.floor(2 + Math.random() * 3)
            };
        } else {
            return {
                message: 'Partial rest provided some recovery',
                hitPointsRecovered: Math.floor(4 + Math.random() * 6),
                partialAbilityRecovery: true
            };
        }
    }

    async saveRestState() {
        if (this.worldDatabase) {
            await this.worldDatabase.saveRestState(this.restState);
        }
    }

    async loadRestState() {
        if (this.worldDatabase) {
            const saved = await this.worldDatabase.getRestState();
            if (saved) {
                this.restState = { ...this.restState, ...saved };
            }
        }
    }

    startRestMonitoring() {
        // Monitor for rest availability and suggest rests
        setInterval(() => {
            if (this.shouldSuggestRest()) {
                this.suggestRest();
            }
        }, 300000); // Check every 5 minutes
    }

    shouldSuggestRest() {
        if (this.activeRestSession) return false;
        if (this.combatSystem?.isInCombat()) return false;
        
        // Suggest rest if character is low on resources
        if (this.characterSheet) {
            const character = this.characterSheet.getCurrentCharacter();
            const healthPercent = character.currentHP / character.maxHP;
            
            if (healthPercent < 0.5 && this.canTakeShortRest()) {
                return true;
            }
            
            if (healthPercent < 0.75 && this.canTakeLongRest()) {
                return true;
            }
        }
        
        return false;
    }

    suggestRest() {
        // This could show a subtle notification suggesting rest
        console.log('💭 Consider taking a rest to recover your strength');
    }

    // ===== PUBLIC API =====

    /**
     * Take short rest (external API)
     */
    async takeShortRest(options = {}) {
        return await this.initiateShortRest(options);
    }

    /**
     * Take long rest (external API)
     */
    async takeLongRest(options = {}) {
        return await this.initiateLongRest(options);
    }

    /**
     * Get rest status
     */
    getRestStatus() {
        return {
            canShortRest: this.canTakeShortRest(),
            canLongRest: this.canTakeLongRest(),
            restrictions: Array.from(this.restRestrictions),
            lastShortRest: this.restState.lastShortRest,
            lastLongRest: this.restState.lastLongRest,
            shortRestsToday: this.restState.shortRestsToday,
            exhaustionLevel: this.restState.exhaustionLevel,
            isResting: this.activeRestSession !== null
        };
    }

    /**
     * Add/remove rest restrictions (external API)
     */
    setRestRestriction(restriction, active = true, reason = '') {
        if (active) {
            this.addRestRestriction(restriction, reason);
        } else {
            this.removeRestRestriction(restriction);
        }
    }
}