export default class ChoiceTrackingSystem {
    constructor(core) {
        this.core = core;
        this.worldDatabase = null;
        this.relationshipSystem = null;
        this.aiDMIntegration = null;
        this.interactionHistory = null;
        
        // Choice tracking data
        this.choiceHistory = new Map();
        this.consequenceChains = new Map();
        this.characterArcs = new Map();
        this.butterflyEffects = new Map();
        this.moralityTracker = new Map();
        
        // Decision context tracking
        this.decisionContexts = new Map();
        this.futureImplications = new Map();
        this.lockedPaths = new Set();
        this.unlockedOpportunities = new Set();
        
        // Choice categories for analysis
        this.choiceCategories = {
            moral: ['help', 'harm', 'mercy', 'justice', 'sacrifice'],
            social: ['persuade', 'intimidate', 'deceive', 'ally', 'enemy'],
            tactical: ['stealth', 'combat', 'diplomacy', 'investigation'],
            resource: ['spend', 'save', 'share', 'hoard', 'trade'],
            narrative: ['explore', 'skip', 'lore', 'character_development'],
            consequence: ['immediate', 'short_term', 'long_term', 'permanent']
        };
        
        // Personality trait tracking
        this.personalityTraits = {
            compassionate: 0,
            ruthless: 0,
            honest: 0,
            deceptive: 0,
            brave: 0,
            cautious: 0,
            generous: 0,
            selfish: 0,
            diplomatic: 0,
            aggressive: 0,
            curious: 0,
            focused: 0
        };
        
        this.init();
    }

    async init() {
        // Get required modules
        this.worldDatabase = this.core.getModule('worldDatabase');
        this.relationshipSystem = this.core.getModule('relationshipSystem');
        this.aiDMIntegration = this.core.getModule('aiDMIntegration');
        this.interactionHistory = this.core.getModule('interactionHistory');
        
        // Load existing choice data
        await this.loadChoiceHistory();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('🎯 Choice Tracking System initialized');
    }

    /**
     * Record a significant choice made by the player
     */
    async recordChoice(choiceData) {
        const choice = {
            id: `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            description: choiceData.description,
            options: choiceData.options || [],
            selectedOption: choiceData.selectedOption,
            context: {
                location: choiceData.context?.location || this.getCurrentLocation(),
                characters: choiceData.context?.characters || [],
                situation: choiceData.context?.situation,
                stakes: choiceData.context?.stakes || 'low',
                timeframe: choiceData.context?.timeframe || 'immediate'
            },
            categories: this.categorizeChoice(choiceData),
            immediateConsequences: [],
            longTermImplications: [],
            butterflyEffectSeeds: [],
            moralWeight: this.calculateMoralWeight(choiceData),
            narrativeImpact: this.calculateNarrativeImpact(choiceData),
            characterArcInfluence: this.analyzeCharacterArcInfluence(choiceData)
        };

        // Store the choice
        this.choiceHistory.set(choice.id, choice);
        
        // Update personality traits
        this.updatePersonalityTraits(choice);
        
        // Generate immediate consequences
        await this.generateImmediateConsequences(choice);
        
        // Plant butterfly effect seeds
        this.plantButterflyEffectSeeds(choice);
        
        // Update character arcs
        this.updateCharacterArcs(choice);
        
        // Notify other systems
        this.core.emit('choice:recorded', { choice });
        
        console.log(`📝 Recorded choice: ${choice.description}`);
        return choice;
    }

    /**
     * Categorize a choice for analysis
     */
    categorizeChoice(choiceData) {
        const categories = [];
        const text = (choiceData.description + ' ' + choiceData.selectedOption).toLowerCase();
        
        // Check each category
        for (const [categoryName, keywords] of Object.entries(this.choiceCategories)) {
            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    categories.push(categoryName);
                    break;
                }
            }
        }
        
        // Add context-based categories
        if (choiceData.context?.stakes === 'high') {
            categories.push('high_stakes');
        }
        
        if (choiceData.context?.characters?.length > 0) {
            categories.push('involves_npcs');
        }
        
        return categories;
    }

    /**
     * Calculate moral weight of a choice
     */
    calculateMoralWeight(choiceData) {
        let weight = 0;
        const text = choiceData.selectedOption?.toLowerCase() || '';
        
        // Positive moral weight
        if (text.includes('help') || text.includes('save') || text.includes('protect')) weight += 2;
        if (text.includes('mercy') || text.includes('forgive') || text.includes('heal')) weight += 1;
        if (text.includes('share') || text.includes('give') || text.includes('donate')) weight += 1;
        
        // Negative moral weight
        if (text.includes('kill') || text.includes('murder') || text.includes('destroy')) weight -= 3;
        if (text.includes('steal') || text.includes('cheat') || text.includes('betray')) weight -= 2;
        if (text.includes('lie') || text.includes('deceive') || text.includes('trick')) weight -= 1;
        
        // Context modifiers
        if (choiceData.context?.stakes === 'high') {
            weight *= 1.5;
        }
        
        return Math.max(-5, Math.min(5, weight));
    }

    /**
     * Calculate narrative impact of a choice
     */
    calculateNarrativeImpact(choiceData) {
        let impact = 1; // Base impact
        
        // Stakes modifier
        switch (choiceData.context?.stakes) {
            case 'high': impact *= 3; break;
            case 'medium': impact *= 2; break;
            case 'low': impact *= 1; break;
        }
        
        // Character involvement modifier
        const characterCount = choiceData.context?.characters?.length || 0;
        impact += characterCount * 0.5;
        
        // Choice uniqueness (choices that deviate from player's typical pattern)
        const playerPattern = this.getPlayerPersonalityPattern();
        const choiceAlignment = this.calculateChoiceAlignment(choiceData, playerPattern);
        if (choiceAlignment < 0.5) {
            impact *= 1.5; // Unusual choices have higher impact
        }
        
        return Math.max(1, Math.min(10, impact));
    }

    /**
     * Analyze how choice influences character arcs
     */
    analyzeCharacterArcInfluence(choiceData) {
        const influences = [];
        const characters = choiceData.context?.characters || [];
        
        for (const character of characters) {
            const relationship = this.relationshipSystem?.getRelationship(character);
            if (!relationship) continue;
            
            const influence = {
                characterId: character,
                arcType: this.determineArcInfluence(choiceData, relationship),
                magnitude: this.calculateArcInfluenceMagnitude(choiceData, relationship),
                direction: this.getArcDirection(choiceData, relationship)
            };
            
            influences.push(influence);
        }
        
        return influences;
    }

    /**
     * Update personality traits based on choice
     */
    updatePersonalityTraits(choice) {
        const selectedText = choice.selectedOption?.toLowerCase() || '';
        const intensity = choice.moralWeight !== 0 ? Math.abs(choice.moralWeight) : 1;
        
        // Compassionate vs Ruthless
        if (selectedText.includes('help') || selectedText.includes('mercy') || selectedText.includes('heal')) {
            this.personalityTraits.compassionate += intensity;
        } else if (selectedText.includes('kill') || selectedText.includes('destroy') || selectedText.includes('ruthless')) {
            this.personalityTraits.ruthless += intensity;
        }
        
        // Honest vs Deceptive
        if (selectedText.includes('truth') || selectedText.includes('honest') || selectedText.includes('admit')) {
            this.personalityTraits.honest += intensity;
        } else if (selectedText.includes('lie') || selectedText.includes('deceive') || selectedText.includes('trick')) {
            this.personalityTraits.deceptive += intensity;
        }
        
        // Brave vs Cautious
        if (selectedText.includes('charge') || selectedText.includes('confront') || selectedText.includes('bold')) {
            this.personalityTraits.brave += intensity;
        } else if (selectedText.includes('careful') || selectedText.includes('wait') || selectedText.includes('avoid')) {
            this.personalityTraits.cautious += intensity;
        }
        
        // Generous vs Selfish
        if (selectedText.includes('give') || selectedText.includes('share') || selectedText.includes('donate')) {
            this.personalityTraits.generous += intensity;
        } else if (selectedText.includes('keep') || selectedText.includes('hoard') || selectedText.includes('mine')) {
            this.personalityTraits.selfish += intensity;
        }
        
        // Diplomatic vs Aggressive
        if (selectedText.includes('negotiate') || selectedText.includes('peaceful') || selectedText.includes('discuss')) {
            this.personalityTraits.diplomatic += intensity;
        } else if (selectedText.includes('attack') || selectedText.includes('threaten') || selectedText.includes('force')) {
            this.personalityTraits.aggressive += intensity;
        }
        
        // Curious vs Focused
        if (selectedText.includes('explore') || selectedText.includes('investigate') || selectedText.includes('learn')) {
            this.personalityTraits.curious += intensity;
        } else if (selectedText.includes('focus') || selectedText.includes('direct') || selectedText.includes('ignore')) {
            this.personalityTraits.focused += intensity;
        }
        
        console.log(`Updated personality traits:`, this.personalityTraits);
    }

    /**
     * Generate immediate consequences for a choice
     */
    async generateImmediateConsequences(choice) {
        const consequences = [];
        
        // Relationship consequences
        for (const character of choice.context.characters) {
            const relationshipChange = this.calculateRelationshipImpact(choice, character);
            if (relationshipChange !== 0) {
                consequences.push({
                    type: 'relationship',
                    target: character,
                    change: relationshipChange,
                    description: `${character} ${relationshipChange > 0 ? 'approves' : 'disapproves'} of your choice`
                });
                
                // Apply the change
                if (this.relationshipSystem) {
                    await this.relationshipSystem.modifyRelationship(character, relationshipChange, choice.description);
                }
            }
        }
        
        // World state consequences
        const worldStateChanges = this.calculateWorldStateChanges(choice);
        for (const change of worldStateChanges) {
            consequences.push(change);
            
            // Apply world state changes
            if (this.worldDatabase) {
                await this.worldDatabase.updateWorldState(change.key, change.value);
            }
        }
        
        // Resource consequences
        const resourceChanges = this.calculateResourceImpact(choice);
        for (const change of resourceChanges) {
            consequences.push(change);
        }
        
        choice.immediateConsequences = consequences;
        
        // Store consequences for future reference
        this.storeConsequences(choice.id, consequences);
        
        return consequences;
    }

    /**
     * Plant butterfly effect seeds for future consequences
     */
    plantButterflyEffectSeeds(choice) {
        const seeds = [];
        
        // Analyze choice for potential long-term impacts
        if (choice.categories.includes('moral') && choice.moralWeight !== 0) {
            seeds.push({
                type: 'reputation',
                trigger: 'time_passage',
                condition: `moral_weight_threshold_${choice.moralWeight > 0 ? 'good' : 'evil'}`,
                consequence: `reputation_shift_${choice.moralWeight > 0 ? 'positive' : 'negative'}`,
                magnitude: Math.abs(choice.moralWeight),
                plantedAt: choice.timestamp
            });
        }
        
        if (choice.categories.includes('social') && choice.context.characters.length > 0) {
            for (const character of choice.context.characters) {
                seeds.push({
                    type: 'character_memory',
                    trigger: 'character_encounter',
                    condition: `meet_${character}_again`,
                    consequence: 'modified_dialogue_options',
                    choiceReference: choice.id,
                    plantedAt: choice.timestamp
                });
            }
        }
        
        if (choice.categories.includes('tactical') && choice.context.stakes === 'high') {
            seeds.push({
                type: 'skill_development',
                trigger: 'similar_situation',
                condition: 'tactical_choice_pattern',
                consequence: 'enhanced_options',
                skillArea: this.identifySkillArea(choice),
                plantedAt: choice.timestamp
            });
        }
        
        choice.butterflyEffectSeeds = seeds;
        
        // Store seeds for future activation
        for (const seed of seeds) {
            const seedId = `seed_${choice.id}_${seeds.indexOf(seed)}`;
            this.butterflyEffects.set(seedId, seed);
        }
        
        console.log(`🦋 Planted ${seeds.length} butterfly effect seeds for choice: ${choice.description}`);
    }

    /**
     * Update character arcs based on choice patterns
     */
    updateCharacterArcs(choice) {
        // Player character arc
        const playerArc = this.characterArcs.get('player') || {
            themes: [],
            progression: 0,
            keyMoments: [],
            personalityShift: {},
            narrativeDirection: 'undefined'
        };
        
        // Identify themes from choice
        const themes = this.identifyChoiceThemes(choice);
        for (const theme of themes) {
            if (!playerArc.themes.includes(theme)) {
                playerArc.themes.push(theme);
            }
        }
        
        // Track key moments (high-impact choices)
        if (choice.narrativeImpact >= 5) {
            playerArc.keyMoments.push({
                choiceId: choice.id,
                description: choice.description,
                impact: choice.narrativeImpact,
                timestamp: choice.timestamp
            });
        }
        
        // Update personality shift tracking
        for (const [trait, value] of Object.entries(this.personalityTraits)) {
            playerArc.personalityShift[trait] = value;
        }
        
        // Determine narrative direction
        playerArc.narrativeDirection = this.determineNarrativeDirection(playerArc);
        
        this.characterArcs.set('player', playerArc);
        
        // NPC character arcs (influenced by player choices)
        for (const influence of choice.characterArcInfluence) {
            this.updateNPCCharacterArc(influence.characterId, influence, choice);
        }
    }

    /**
     * Check for butterfly effect triggers
     */
    async checkButterflyEffectTriggers(eventType, eventData) {
        const triggeredEffects = [];
        
        for (const [seedId, seed] of this.butterflyEffects) {
            if (this.shouldTriggerButterflyEffect(seed, eventType, eventData)) {
                const effect = await this.activateButterflyEffect(seed, eventData);
                if (effect) {
                    triggeredEffects.push(effect);
                    
                    // Remove triggered seed
                    this.butterflyEffects.delete(seedId);
                }
            }
        }
        
        if (triggeredEffects.length > 0) {
            console.log(`🦋 Triggered ${triggeredEffects.length} butterfly effects from event: ${eventType}`);
            this.core.emit('butterfly:effects_triggered', { effects: triggeredEffects, event: eventData });
        }
        
        return triggeredEffects;
    }

    /**
     * Get consequence chains for a specific choice
     */
    getConsequenceChain(choiceId) {
        return this.consequenceChains.get(choiceId) || [];
    }

    /**
     * Get player's personality profile
     */
    getPersonalityProfile() {
        const total = Object.values(this.personalityTraits).reduce((sum, val) => sum + val, 0);
        const profile = {};
        
        for (const [trait, value] of Object.entries(this.personalityTraits)) {
            profile[trait] = total > 0 ? (value / total) * 100 : 0;
        }
        
        return {
            traits: profile,
            dominantTraits: this.getDominantTraits(),
            moralAlignment: this.calculateMoralAlignment(),
            narrativePersonality: this.calculateNarrativePersonality()
        };
    }

    /**
     * Get dominant personality traits
     */
    getDominantTraits(count = 3) {
        const sorted = Object.entries(this.personalityTraits)
            .sort(([,a], [,b]) => b - a)
            .slice(0, count);
        
        return sorted.map(([trait, value]) => ({ trait, value }));
    }

    /**
     * Calculate moral alignment based on choices
     */
    calculateMoralAlignment() {
        const moralChoices = Array.from(this.choiceHistory.values())
            .filter(choice => choice.categories.includes('moral'));
        
        if (moralChoices.length === 0) return 'neutral';
        
        const averageMorality = moralChoices.reduce((sum, choice) => sum + choice.moralWeight, 0) / moralChoices.length;
        
        if (averageMorality >= 2) return 'paragon';
        if (averageMorality >= 1) return 'good';
        if (averageMorality <= -2) return 'renegade';
        if (averageMorality <= -1) return 'evil';
        return 'neutral';
    }

    /**
     * Get choice statistics and analysis
     */
    getChoiceAnalysis() {
        const choices = Array.from(this.choiceHistory.values());
        
        return {
            totalChoices: choices.length,
            categoryBreakdown: this.getCategoryBreakdown(choices),
            moralProfile: this.getMoralProfile(choices),
            narrativeImpact: this.getNarrativeImpactAnalysis(choices),
            consequencePatterns: this.getConsequencePatterns(choices),
            personalityEvolution: this.getPersonalityEvolution(),
            keyDecisions: this.getKeyDecisions(),
            butterflyEffectsActive: this.butterflyEffects.size,
            characterArcProgress: this.getCharacterArcProgress()
        };
    }

    /**
     * Generate decision tree visualization data
     */
    generateDecisionTree() {
        const choices = Array.from(this.choiceHistory.values())
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        const tree = {
            nodes: [],
            edges: [],
            branches: [],
            consequencePaths: []
        };
        
        for (const choice of choices) {
            const node = {
                id: choice.id,
                label: choice.description,
                timestamp: choice.timestamp,
                categories: choice.categories,
                moralWeight: choice.moralWeight,
                narrativeImpact: choice.narrativeImpact,
                consequences: choice.immediateConsequences.length,
                butterflySeeds: choice.butterflyEffectSeeds.length
            };
            
            tree.nodes.push(node);
            
            // Create edges to related choices
            const relatedChoices = this.findRelatedChoices(choice);
            for (const related of relatedChoices) {
                tree.edges.push({
                    from: choice.id,
                    to: related.id,
                    type: 'consequence',
                    strength: this.calculateRelationStrength(choice, related)
                });
            }
        }
        
        return tree;
    }

    /**
     * Check if a choice creates meaningful consequences
     */
    evaluateChoiceMeaningfulness(choice) {
        let meaningfulness = 0;
        
        // Immediate impact
        meaningfulness += choice.immediateConsequences.length * 10;
        
        // Moral weight
        meaningfulness += Math.abs(choice.moralWeight) * 15;
        
        // Narrative impact
        meaningfulness += choice.narrativeImpact * 5;
        
        // Character involvement
        meaningfulness += choice.context.characters.length * 8;
        
        // Butterfly effect potential
        meaningfulness += choice.butterflyEffectSeeds.length * 12;
        
        // Stakes modifier
        switch (choice.context.stakes) {
            case 'high': meaningfulness *= 1.5; break;
            case 'medium': meaningfulness *= 1.2; break;
        }
        
        return {
            score: meaningfulness,
            level: this.getMeaningfulnessLevel(meaningfulness),
            reasons: this.getMeaningfulnessReasons(choice, meaningfulness)
        };
    }

    // ===== HELPER METHODS =====

    getCurrentLocation() {
        return this.core.getModule('campaignManager')?.getCurrentLocation() || 'Unknown';
    }

    calculateRelationshipImpact(choice, character) {
        // Simplified relationship impact calculation
        let impact = 0;
        const selectedText = choice.selectedOption?.toLowerCase() || '';
        
        if (selectedText.includes('help') || selectedText.includes('protect')) impact += 2;
        if (selectedText.includes('agree') || selectedText.includes('support')) impact += 1;
        if (selectedText.includes('insult') || selectedText.includes('threaten')) impact -= 2;
        if (selectedText.includes('disagree') || selectedText.includes('refuse')) impact -= 1;
        
        return impact;
    }

    calculateWorldStateChanges(choice) {
        const changes = [];
        const selectedText = choice.selectedOption?.toLowerCase() || '';
        
        if (selectedText.includes('destroy') || selectedText.includes('burn')) {
            changes.push({
                type: 'world_state',
                key: `location_${choice.context.location}_destroyed`,
                value: true,
                description: `${choice.context.location} has been damaged or destroyed`
            });
        }
        
        if (selectedText.includes('save') || selectedText.includes('protect')) {
            changes.push({
                type: 'world_state',
                key: `location_${choice.context.location}_protected`,
                value: true,
                description: `${choice.context.location} has been protected or saved`
            });
        }
        
        return changes;
    }

    calculateResourceImpact(choice) {
        const impacts = [];
        const selectedText = choice.selectedOption?.toLowerCase() || '';
        
        if (selectedText.includes('spend') || selectedText.includes('buy') || selectedText.includes('pay')) {
            impacts.push({
                type: 'resource',
                resource: 'gold',
                change: -50, // Simplified
                description: 'Spent gold on choice'
            });
        }
        
        if (selectedText.includes('gain') || selectedText.includes('reward') || selectedText.includes('find')) {
            impacts.push({
                type: 'resource',
                resource: 'items',
                change: 1,
                description: 'Gained items from choice'
            });
        }
        
        return impacts;
    }

    storeConsequences(choiceId, consequences) {
        this.consequenceChains.set(choiceId, consequences);
    }

    identifySkillArea(choice) {
        const text = choice.selectedOption?.toLowerCase() || '';
        
        if (text.includes('sneak') || text.includes('hide')) return 'stealth';
        if (text.includes('persuade') || text.includes('convince')) return 'persuasion';
        if (text.includes('intimidate') || text.includes('threaten')) return 'intimidation';
        if (text.includes('investigate') || text.includes('search')) return 'investigation';
        if (text.includes('deceive') || text.includes('lie')) return 'deception';
        
        return 'general';
    }

    identifyChoiceThemes(choice) {
        const themes = [];
        const text = (choice.description + ' ' + choice.selectedOption).toLowerCase();
        
        if (text.includes('sacrifice') || text.includes('give up')) themes.push('sacrifice');
        if (text.includes('revenge') || text.includes('vengeance')) themes.push('revenge');
        if (text.includes('redemption') || text.includes('forgive')) themes.push('redemption');
        if (text.includes('power') || text.includes('control')) themes.push('power');
        if (text.includes('freedom') || text.includes('liberty')) themes.push('freedom');
        if (text.includes('love') || text.includes('romance')) themes.push('love');
        if (text.includes('duty') || text.includes('responsibility')) themes.push('duty');
        if (text.includes('knowledge') || text.includes('truth')) themes.push('knowledge');
        
        return themes;
    }

    determineNarrativeDirection(playerArc) {
        const dominantThemes = playerArc.themes.slice(0, 3);
        const moralAlignment = this.calculateMoralAlignment();
        
        if (dominantThemes.includes('redemption') && moralAlignment === 'good') {
            return 'redemption_arc';
        } else if (dominantThemes.includes('power') && moralAlignment === 'evil') {
            return 'corruption_arc';
        } else if (dominantThemes.includes('sacrifice')) {
            return 'heroic_sacrifice_arc';
        } else if (dominantThemes.includes('love')) {
            return 'romance_arc';
        }
        
        return 'discovery_arc';
    }

    updateNPCCharacterArc(characterId, influence, choice) {
        const arc = this.characterArcs.get(characterId) || {
            relationship: 'neutral',
            trust: 0,
            influenced_by: [],
            character_development: 0
        };
        
        arc.influenced_by.push({
            choiceId: choice.id,
            influence: influence,
            timestamp: choice.timestamp
        });
        
        arc.character_development += influence.magnitude;
        
        this.characterArcs.set(characterId, arc);
    }

    shouldTriggerButterflyEffect(seed, eventType, eventData) {
        switch (seed.trigger) {
            case 'time_passage':
                return eventType === 'time_passage' && 
                       this.evaluateTimePassageCondition(seed, eventData);
            case 'character_encounter':
                return eventType === 'npc_interaction' && 
                       this.evaluateCharacterEncounterCondition(seed, eventData);
            case 'similar_situation':
                return eventType === 'choice_opportunity' && 
                       this.evaluateSimilarSituationCondition(seed, eventData);
            default:
                return false;
        }
    }

    async activateButterflyEffect(seed, eventData) {
        console.log(`🦋 Activating butterfly effect: ${seed.type}`);
        
        switch (seed.type) {
            case 'reputation':
                return this.activateReputationEffect(seed, eventData);
            case 'character_memory':
                return this.activateCharacterMemoryEffect(seed, eventData);
            case 'skill_development':
                return this.activateSkillDevelopmentEffect(seed, eventData);
            default:
                return null;
        }
    }

    async loadChoiceHistory() {
        if (this.worldDatabase) {
            const savedChoices = await this.worldDatabase.getPlayerChoices();
            for (const choice of savedChoices) {
                this.choiceHistory.set(choice.id, choice);
            }
            console.log(`📊 Loaded ${this.choiceHistory.size} previous choices`);
        }
    }

    setupEventListeners() {
        // Listen for AI DM responses to detect choice opportunities
        this.core.on('ai_dm:response', (event) => {
            this.analyzeForChoiceOpportunities(event.detail);
        });
        
        // Listen for player interactions
        this.core.on('player:action', (event) => {
            this.analyzePlayerAction(event.detail);
        });
        
        // Listen for time passage events
        this.core.on('world:time_passage', (event) => {
            this.checkButterflyEffectTriggers('time_passage', event.detail);
        });
        
        // Listen for NPC interactions
        this.core.on('npc:interaction', (event) => {
            this.checkButterflyEffectTriggers('npc_interaction', event.detail);
        });
    }

    async analyzeForChoiceOpportunities(aiResponse) {
        // Analyze AI DM response for choice opportunities
        // This would integrate with the AI DM to identify when meaningful choices are presented
        // For now, this is a placeholder for the integration
    }

    async analyzePlayerAction(actionData) {
        // Analyze player actions for automatic choice recording
        if (actionData.type === 'dialogue' && actionData.options && actionData.selected) {
            await this.recordChoice({
                description: actionData.context || 'Dialogue choice',
                options: actionData.options,
                selectedOption: actionData.selected,
                context: {
                    situation: 'dialogue',
                    characters: actionData.characters || [],
                    stakes: actionData.stakes || 'low'
                }
            });
        }
    }

    // Additional helper methods for analysis...
    
    getCategoryBreakdown(choices) {
        const breakdown = {};
        for (const category of Object.keys(this.choiceCategories)) {
            breakdown[category] = choices.filter(choice => choice.categories.includes(category)).length;
        }
        return breakdown;
    }

    getMoralProfile(choices) {
        const moralChoices = choices.filter(choice => choice.moralWeight !== 0);
        const totalMorality = moralChoices.reduce((sum, choice) => sum + choice.moralWeight, 0);
        
        return {
            totalMoralChoices: moralChoices.length,
            averageMorality: moralChoices.length > 0 ? totalMorality / moralChoices.length : 0,
            alignment: this.calculateMoralAlignment(),
            goodChoices: moralChoices.filter(choice => choice.moralWeight > 0).length,
            evilChoices: moralChoices.filter(choice => choice.moralWeight < 0).length
        };
    }

    getNarrativeImpactAnalysis(choices) {
        const totalImpact = choices.reduce((sum, choice) => sum + choice.narrativeImpact, 0);
        const highImpactChoices = choices.filter(choice => choice.narrativeImpact >= 5);
        
        return {
            totalImpact: totalImpact,
            averageImpact: choices.length > 0 ? totalImpact / choices.length : 0,
            highImpactCount: highImpactChoices.length,
            keyMoments: highImpactChoices.map(choice => ({
                id: choice.id,
                description: choice.description,
                impact: choice.narrativeImpact
            }))
        };
    }

    getConsequencePatterns(choices) {
        return {
            totalConsequences: choices.reduce((sum, choice) => sum + choice.immediateConsequences.length, 0),
            consequenceTypes: this.getConsequenceTypeBreakdown(choices),
            butterflySeedsPlanted: choices.reduce((sum, choice) => sum + choice.butterflyEffectSeeds.length, 0)
        };
    }

    getPersonalityEvolution() {
        // This would track how personality traits have changed over time
        // For now, return current state
        return this.personalityTraits;
    }

    getKeyDecisions() {
        return Array.from(this.choiceHistory.values())
            .filter(choice => choice.narrativeImpact >= 5)
            .sort((a, b) => b.narrativeImpact - a.narrativeImpact)
            .slice(0, 10);
    }

    getCharacterArcProgress() {
        const playerArc = this.characterArcs.get('player');
        if (!playerArc) return null;
        
        return {
            themes: playerArc.themes,
            keyMoments: playerArc.keyMoments.length,
            narrativeDirection: playerArc.narrativeDirection,
            progression: playerArc.progression
        };
    }

    // ===== PUBLIC API =====

    /**
     * Record a choice from external systems
     */
    async recordPlayerChoice(description, options, selectedOption, context = {}) {
        return await this.recordChoice({
            description,
            options,
            selectedOption,
            context
        });
    }

    /**
     * Get choice history for external systems
     */
    getChoiceHistory() {
        return Array.from(this.choiceHistory.values());
    }

    /**
     * Get butterfly effects status
     */
    getButterflyEffectsStatus() {
        return {
            activeSeeds: this.butterflyEffects.size,
            seeds: Array.from(this.butterflyEffects.values())
        };
    }

    /**
     * Force trigger butterfly effect (for testing)
     */
    async forceTriggerButterflyEffect(seedId, eventData = {}) {
        const seed = this.butterflyEffects.get(seedId);
        if (seed) {
            return await this.activateButterflyEffect(seed, eventData);
        }
        return null;
    }

    /**
     * Export choice data for GitHub saves
     */
    exportChoiceData() {
        return {
            choices: Object.fromEntries(this.choiceHistory),
            personalityTraits: this.personalityTraits,
            characterArcs: Object.fromEntries(this.characterArcs),
            butterflyEffects: Object.fromEntries(this.butterflyEffects),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import choice data from GitHub saves
     */
    async importChoiceData(data) {
        if (data.choices) {
            this.choiceHistory = new Map(Object.entries(data.choices));
        }
        if (data.personalityTraits) {
            this.personalityTraits = { ...this.personalityTraits, ...data.personalityTraits };
        }
        if (data.characterArcs) {
            this.characterArcs = new Map(Object.entries(data.characterArcs));
        }
        if (data.butterflyEffects) {
            this.butterflyEffects = new Map(Object.entries(data.butterflyEffects));
        }
        
        console.log('📊 Imported choice tracking data from save');
    }
}