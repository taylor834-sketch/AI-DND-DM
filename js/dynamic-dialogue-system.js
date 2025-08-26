export default class DynamicDialogueSystem {
    constructor(core) {
        this.core = core;
        this.choiceTrackingSystem = null;
        this.relationshipSystem = null;
        this.worldDatabase = null;
        this.characterSheet = null;
        this.aiDMIntegration = null;
        this.voiceIntegration = null;
        this.dynamicQuestSystem = null;
        
        // Dialogue state
        this.activeDialogue = null;
        this.dialogueHistory = new Map(); // NPC -> conversation history
        this.conversationContext = new Map(); // Current conversation context
        this.skillChecks = new Map(); // Active skill check results
        
        // Dialogue patterns and templates
        this.contextPatterns = {
            choice_reference: [
                "I remember when you {choice_action} back in {location}...",
                "Given what you did with {choice_subject}, I think...",
                "After your decision about {choice_topic}, I've been wondering..."
            ],
            relationship_based: [
                "As a trusted friend, I can tell you...",
                "I'm not sure I can trust you with this, but...",
                "You've proven yourself unreliable, so..."
            ],
            quest_aware: [
                "I've heard about your work with {quest_topic}...",
                "That business with {quest_npc} is connected to...",
                "Your quest to {quest_objective} reminds me..."
            ],
            world_state: [
                "Since {world_event} happened, things have changed...",
                "The situation with {faction} affects...",
                "Now that {location} is {state}, we must..."
            ]
        };
        
        // Skill-based dialogue options
        this.skillDialogueTypes = {
            persuasion: {
                keywords: ['convince', 'persuade', 'negotiate', 'reason'],
                baseDC: 15,
                successPhrases: ['successfully convince', 'persuade effectively', 'negotiate favorably'],
                failurePhrases: ['fail to convince', 'argument falls flat', 'negotiation stalls']
            },
            intimidation: {
                keywords: ['threaten', 'intimidate', 'coerce', 'menace'],
                baseDC: 13,
                successPhrases: ['intimidate successfully', 'threaten effectively', 'coerce compliance'],
                failurePhrases: ['intimidation backfires', 'threat seems hollow', 'coercion fails']
            },
            deception: {
                keywords: ['lie', 'deceive', 'mislead', 'bluff'],
                baseDC: 16,
                successPhrases: ['deceive convincingly', 'lie believably', 'mislead effectively'],
                failurePhrases: ['lie is detected', 'deception fails', 'bluff called']
            },
            insight: {
                keywords: ['read', 'sense', 'judge', 'understand'],
                baseDC: 14,
                successPhrases: ['read their intentions', 'sense their true feelings', 'understand their motives'],
                failurePhrases: ['misread the situation', 'fail to sense deception', 'misunderstand intentions']
            },
            investigation: {
                keywords: ['investigate', 'examine', 'probe', 'question'],
                baseDC: 15,
                successPhrases: ['uncover important information', 'discover hidden details', 'piece together clues'],
                failurePhrases: ['miss important details', 'investigation leads nowhere', 'fail to connect dots']
            }
        };
        
        // Companion dialogue behavior
        this.companionBehaviors = {
            supportive: {
                interjectionChance: 0.3,
                types: ['agreement', 'encouragement', 'information'],
                triggers: ['skill_check', 'moral_choice', 'combat_reference']
            },
            cautious: {
                interjectionChance: 0.4,
                types: ['warning', 'concern', 'alternative'],
                triggers: ['risky_choice', 'deception', 'intimidation']
            },
            analytical: {
                interjectionChance: 0.2,
                types: ['observation', 'clarification', 'logic'],
                triggers: ['information_gathering', 'mystery', 'investigation']
            },
            impulsive: {
                interjectionChance: 0.5,
                types: ['interruption', 'emotion', 'action'],
                triggers: ['tension', 'conflict', 'opportunity']
            }
        };
        
        // Dialogue layers and implications
        this.conversationLayers = {
            surface: {
                depth: 1,
                revealed: 'immediate',
                implications: 'obvious'
            },
            subtext: {
                depth: 2,
                revealed: 'insight_check',
                implications: 'hidden_meaning'
            },
            deeper_truth: {
                depth: 3,
                revealed: 'relationship_trust',
                implications: 'major_revelation'
            },
            secret: {
                depth: 4,
                revealed: 'special_conditions',
                implications: 'story_changing'
            }
        };
        
        // NPC memory system
        this.npcMemory = {
            shortTerm: new Map(), // Recent conversation details
            longTerm: new Map(),  // Important past interactions
            emotional: new Map(), // Emotional reactions to player
            factual: new Map()    // Facts learned about player
        };
        
        this.init();
    }

    async init() {
        // Get required modules
        this.choiceTrackingSystem = this.core.getModule('choiceTrackingSystem');
        this.relationshipSystem = this.core.getModule('relationshipSystem');
        this.worldDatabase = this.core.getModule('worldDatabase');
        this.characterSheet = this.core.getModule('characterSheet');
        this.aiDMIntegration = this.core.getModule('aiDMIntegration');
        this.voiceIntegration = this.core.getModule('voiceIntegration');
        this.dynamicQuestSystem = this.core.getModule('dynamicQuestSystem');
        
        // Load dialogue history
        await this.loadDialogueHistory();
        
        // Create dialogue interface
        this.createDialogueInterface();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('💬 Dynamic Dialogue System initialized');
    }

    /**
     * Load dialogue history from storage
     */
    async loadDialogueHistory() {
        console.log('🔧 CACHE TEST: DynamicDialogueSystem loadDialogueHistory method loaded correctly!');
        try {
            if (this.worldDatabase) {
                const dialogueHistory = this.worldDatabase.load('dialogueHistory');
                this.dialogueHistory = dialogueHistory || [];
                console.log(`💬 Loaded ${this.dialogueHistory.length} dialogue records`);
            } else {
                console.warn('💬 World database not available, starting with empty dialogue history');
                this.dialogueHistory = [];
            }
        } catch (error) {
            console.error('💬 Failed to load dialogue history:', error);
            this.dialogueHistory = [];
        }
    }

    /**
     * Save dialogue history to storage
     */
    async saveDialogueHistory() {
        try {
            if (this.worldDatabase) {
                this.worldDatabase.save('dialogueHistory', this.dialogueHistory);
                console.log('💬 Dialogue history saved');
            }
        } catch (error) {
            console.error('💬 Failed to save dialogue history:', error);
        }
    }

    /**
     * Start a dialogue with an NPC
     */
    async startDialogue(npcId, context = {}) {
        console.log(`💬 Starting dialogue with ${npcId}`);
        
        // Load NPC data and relationship
        const npcData = await this.worldDatabase?.getNPCData(npcId);
        const relationship = this.relationshipSystem?.getRelationship(npcId);
        
        // Build conversation context
        const conversationContext = await this.buildConversationContext(npcId, npcData, relationship, context);
        
        // Generate dynamic dialogue options
        const dialogueOptions = await this.generateDialogueOptions(npcId, conversationContext);
        
        // Create dialogue session
        this.activeDialogue = {
            npcId: npcId,
            npcData: npcData,
            relationship: relationship,
            context: conversationContext,
            startTime: new Date().toISOString(),
            exchangeCount: 0,
            topicsDiscussed: new Set(),
            skillChecksAttempted: [],
            companionInterjections: [],
            layersRevealed: new Set(['surface']),
            currentOptions: dialogueOptions
        };
        
        // Show dialogue interface
        this.showDialogueInterface();
        
        // Generate opening greeting
        const greeting = await this.generateContextualGreeting(npcId, conversationContext);
        await this.deliverNPCDialogue(greeting);
        
        // Notify other systems
        this.core.emit('dialogue:started', { npcId, context: conversationContext });
        
        return this.activeDialogue;
    }

    /**
     * Build comprehensive conversation context
     */
    async buildConversationContext(npcId, npcData, relationship, context) {
        const conversationContext = {
            // Basic context
            npc: {
                id: npcId,
                name: npcData?.name || npcId,
                personality: npcData?.personality || 'neutral',
                occupation: npcData?.occupation,
                faction: npcData?.faction
            },
            
            // Relationship context
            relationship: {
                level: relationship?.level || 0,
                trust: relationship?.trust || 0,
                history: relationship?.interactions || [],
                lastInteraction: relationship?.lastInteraction
            },
            
            // Choice context
            relevantChoices: [],
            
            // Quest context
            sharedQuests: [],
            questInvolvement: [],
            
            // World context
            location: context.location || this.getCurrentLocation(),
            timeOfDay: context.timeOfDay || this.getTimeOfDay(),
            worldEvents: [],
            
            // Player context
            playerReputation: await this.getPlayerReputation(),
            companionsPresent: context.companions || [],
            
            // Conversation context
            dialogueHistory: this.dialogueHistory.get(npcId) || [],
            previousTopics: new Set(),
            conversationMood: 'neutral',
            
            // Hidden context (for layered conversations)
            secrets: npcData?.secrets || [],
            hiddenAgenda: npcData?.agenda,
            informationToReveal: npcData?.information || []
        };
        
        // Populate choice context
        if (this.choiceTrackingSystem) {
            conversationContext.relevantChoices = await this.findRelevantChoices(npcId);
        }
        
        // Populate quest context
        if (this.dynamicQuestSystem) {
            conversationContext.sharedQuests = await this.findSharedQuests(npcId);
        }
        
        // Populate world event context
        if (this.worldDatabase) {
            conversationContext.worldEvents = await this.getRelevantWorldEvents(npcId);
        }
        
        // Load NPC memory
        conversationContext.npcMemory = await this.loadNPCMemory(npcId);
        
        return conversationContext;
    }

    /**
     * Generate dynamic dialogue options based on context
     */
    async generateDialogueOptions(npcId, context) {
        const options = [];
        
        // Basic conversation starters
        options.push({
            id: 'greeting',
            text: this.generateGreetingOption(context),
            type: 'social',
            requirements: [],
            consequences: [],
            layer: 'surface'
        });
        
        // Choice-based options
        const choiceOptions = this.generateChoiceBasedOptions(context);
        options.push(...choiceOptions);
        
        // Relationship-based options
        const relationshipOptions = this.generateRelationshipBasedOptions(context);
        options.push(...relationshipOptions);
        
        // Quest-related options
        const questOptions = this.generateQuestBasedOptions(context);
        options.push(...questOptions);
        
        // Skill-based options
        const skillOptions = this.generateSkillBasedOptions(context);
        options.push(...skillOptions);
        
        // Information-seeking options
        const infoOptions = this.generateInformationOptions(context);
        options.push(...infoOptions);
        
        // Context-sensitive special options
        const specialOptions = await this.generateSpecialOptions(context);
        options.push(...specialOptions);
        
        // Layer-based options (revealed based on conversation depth)
        const layeredOptions = this.generateLayeredOptions(context);
        options.push(...layeredOptions);
        
        // Sort by relevance and filter by accessibility
        return this.filterAndSortOptions(options, context);
    }

    /**
     * Generate choice-based dialogue options
     */
    generateChoiceBasedOptions(context) {
        const options = [];
        
        for (const choice of context.relevantChoices) {
            // Reference past choice
            options.push({
                id: `choice_ref_${choice.id}`,
                text: `About what happened with ${choice.selectedOption}...`,
                type: 'choice_reference',
                requirements: [],
                consequences: [
                    {
                        type: 'relationship',
                        modifier: choice.moralWeight > 0 ? 1 : -1
                    }
                ],
                layer: 'surface',
                choiceData: choice
            });
            
            // Apologize for negative choices
            if (choice.moralWeight < 0 && context.relationship.level < 0) {
                options.push({
                    id: `apologize_${choice.id}`,
                    text: `I want to apologize for my actions regarding ${choice.description}`,
                    type: 'apology',
                    requirements: [],
                    consequences: [
                        {
                            type: 'relationship',
                            modifier: 2
                        }
                    ],
                    layer: 'surface',
                    choiceData: choice
                });
            }
            
            // Justify controversial choices
            if (Math.abs(choice.moralWeight) >= 2) {
                options.push({
                    id: `justify_${choice.id}`,
                    text: `Let me explain why I ${choice.selectedOption}`,
                    type: 'justification',
                    requirements: [
                        {
                            skill: 'persuasion',
                            dc: 15 + Math.abs(choice.moralWeight)
                        }
                    ],
                    consequences: [
                        {
                            type: 'relationship',
                            modifier: 'skill_dependent'
                        }
                    ],
                    layer: 'subtext',
                    choiceData: choice
                });
            }
        }
        
        return options;
    }

    /**
     * Generate skill-based dialogue options
     */
    generateSkillBasedOptions(context) {
        const options = [];
        
        if (!this.characterSheet) return options;
        
        const character = this.characterSheet.getCurrentCharacter();
        const skills = character.skills || {};
        
        // Persuasion options
        if (skills.persuasion >= 0) {
            options.push({
                id: 'persuade_favor',
                text: '[Persuasion] I need your help with something important',
                type: 'skill_check',
                skill: 'persuasion',
                dc: this.calculateSkillDC('persuasion', context),
                requirements: [],
                consequences: [
                    {
                        type: 'skill_success',
                        effect: 'favor_granted'
                    },
                    {
                        type: 'skill_failure',
                        effect: 'trust_reduced'
                    }
                ],
                layer: 'surface'
            });
        }
        
        // Intimidation options (if character has negative relationship or aggressive history)
        if (skills.intimidation >= 0 && (context.relationship.level < -1 || this.hasAggressiveHistory())) {
            options.push({
                id: 'intimidate_compliance',
                text: '[Intimidation] You will tell me what I want to know',
                type: 'skill_check',
                skill: 'intimidation',
                dc: this.calculateSkillDC('intimidation', context),
                requirements: [],
                consequences: [
                    {
                        type: 'skill_success',
                        effect: 'information_forced'
                    },
                    {
                        type: 'skill_failure',
                        effect: 'relationship_damaged'
                    }
                ],
                layer: 'surface',
                riskLevel: 'high'
            });
        }
        
        // Deception options
        if (skills.deception >= 0) {
            options.push({
                id: 'deceive_motive',
                text: '[Deception] I\'m just a curious traveler passing through',
                type: 'skill_check',
                skill: 'deception',
                dc: this.calculateSkillDC('deception', context),
                requirements: [],
                consequences: [
                    {
                        type: 'skill_success',
                        effect: 'suspicion_avoided'
                    },
                    {
                        type: 'skill_failure',
                        effect: 'caught_lying'
                    }
                ],
                layer: 'subtext'
            });
        }
        
        // Insight options
        if (skills.insight >= 0) {
            options.push({
                id: 'insight_read',
                text: '[Insight] Try to read their true intentions',
                type: 'skill_check',
                skill: 'insight',
                dc: this.calculateSkillDC('insight', context),
                requirements: [],
                consequences: [
                    {
                        type: 'skill_success',
                        effect: 'reveal_deeper_layer'
                    },
                    {
                        type: 'skill_failure',
                        effect: 'misunderstand_situation'
                    }
                ],
                layer: 'subtext'
            });
        }
        
        // Investigation options (for information gathering)
        if (skills.investigation >= 0 && context.npc.occupation === 'merchant') {
            options.push({
                id: 'investigate_sources',
                text: '[Investigation] Ask about their sources and connections',
                type: 'skill_check',
                skill: 'investigation',
                dc: this.calculateSkillDC('investigation', context),
                requirements: [],
                consequences: [
                    {
                        type: 'skill_success',
                        effect: 'network_information'
                    },
                    {
                        type: 'skill_failure',
                        effect: 'suspicious_questioning'
                    }
                ],
                layer: 'subtext'
            });
        }
        
        return options;
    }

    /**
     * Execute skill check dialogue option
     */
    async executeSkillCheck(option) {
        if (!this.characterSheet) return { success: false, roll: 0 };
        
        const character = this.characterSheet.getCurrentCharacter();
        const skillBonus = character.skills?.[option.skill] || 0;
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + skillBonus;
        
        const success = total >= option.dc;
        
        // Record skill check
        const skillCheckResult = {
            skill: option.skill,
            dc: option.dc,
            roll: roll,
            bonus: skillBonus,
            total: total,
            success: success,
            timestamp: new Date().toISOString()
        };
        
        this.activeDialogue.skillChecksAttempted.push(skillCheckResult);
        
        // Apply consequences
        await this.applySkillCheckConsequences(option, success);
        
        // Generate result dialogue
        const resultDialogue = await this.generateSkillCheckResult(option, skillCheckResult);
        await this.deliverNPCDialogue(resultDialogue);
        
        // Update conversation layers based on success
        if (success && option.layer !== 'surface') {
            this.activeDialogue.layersRevealed.add(option.layer);
        }
        
        // Voice feedback
        if (this.voiceIntegration) {
            const skillType = this.skillDialogueTypes[option.skill];
            const phrase = success ? 
                skillType.successPhrases[Math.floor(Math.random() * skillType.successPhrases.length)] :
                skillType.failurePhrases[Math.floor(Math.random() * skillType.failurePhrases.length)];
            
            await this.voiceIntegration.speak(`${option.skill} check: ${roll} + ${skillBonus} = ${total}. You ${phrase}.`);
        }
        
        // Trigger companion reactions
        await this.triggerCompanionReactions('skill_check', { option, result: skillCheckResult });
        
        return skillCheckResult;
    }

    /**
     * Generate companion interjections
     */
    async generateCompanionInterjection(trigger, context) {
        const companions = context.companionsPresent || [];
        const interjections = [];
        
        for (const companion of companions) {
            const behavior = this.companionBehaviors[companion.personality] || this.companionBehaviors.supportive;
            
            if (Math.random() < behavior.interjectionChance) {
                const interjection = await this.createCompanionInterjection(companion, trigger, behavior, context);
                if (interjection) {
                    interjections.push(interjection);
                }
            }
        }
        
        return interjections;
    }

    /**
     * Create specific companion interjection
     */
    async createCompanionInterjection(companion, trigger, behavior, context) {
        const interjectionTypes = {
            agreement: [
                `"${companion.name} nods in agreement."`,
                `"Exactly what I was thinking," ${companion.name} adds.`,
                `"${companion.name} supports your position."`
            ],
            warning: [
                `"Wait," ${companion.name} interjects, "this could be risky."`,
                `"${companion.name} looks concerned about this approach."`,
                `"Be careful," ${companion.name} warns quietly.`
            ],
            information: [
                `"I might have some relevant information," ${companion.name} offers.`,
                `"${companion.name} seems to know something about this."`,
                `"This reminds me of something," ${companion.name} says.`
            ],
            emotion: [
                `"${companion.name} shows clear emotional investment in this."`,
                `"You can see ${companion.name} reacting strongly."`,
                `"${companion.name}'s feelings about this are obvious."`
            ]
        };
        
        // Select appropriate interjection type
        let selectedType = 'agreement';
        if (behavior.types.includes('warning') && context.riskLevel === 'high') {
            selectedType = 'warning';
        } else if (behavior.types.includes('information') && trigger === 'investigation') {
            selectedType = 'information';
        } else if (behavior.types.includes('emotion') && trigger === 'tension') {
            selectedType = 'emotion';
        }
        
        const templates = interjectionTypes[selectedType];
        const text = templates[Math.floor(Math.random() * templates.length)];
        
        return {
            companionId: companion.id,
            companionName: companion.name,
            type: selectedType,
            text: text,
            trigger: trigger,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate contextual greeting based on history and relationship
     */
    async generateContextualGreeting(npcId, context) {
        const relationship = context.relationship;
        const history = context.dialogueHistory;
        const recentChoices = context.relevantChoices.slice(0, 3);
        
        let greeting = '';
        
        // First time meeting
        if (history.length === 0) {
            greeting = `Hello there, traveler. I don't believe we've met. I'm ${context.npc.name}.`;
        }
        // Positive relationship
        else if (relationship.level > 2) {
            if (recentChoices.length > 0 && recentChoices[0].moralWeight > 0) {
                greeting = `Good to see you again, friend! I've heard about your recent good deeds.`;
            } else {
                greeting = `Always a pleasure to see you! How can I help?`;
            }
        }
        // Negative relationship
        else if (relationship.level < -2) {
            if (recentChoices.length > 0 && recentChoices[0].moralWeight < 0) {
                greeting = `I see you're still causing trouble. What do you want this time?`;
            } else {
                greeting = `*looks at you suspiciously* What brings you here?`;
            }
        }
        // Neutral with specific context
        else {
            if (context.sharedQuests.length > 0) {
                greeting = `Ah, you're working on ${context.sharedQuests[0].title}. Any progress?`;
            } else if (history.length > 0) {
                greeting = `Back again, I see. What's on your mind?`;
            } else {
                greeting = `Hello. Can I help you with something?`;
            }
        }
        
        return {
            text: greeting,
            speaker: context.npc.name,
            mood: this.determineNPCMood(context),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Handle multi-layered conversation revelation
     */
    async revealConversationLayer(layer, context) {
        const layerData = this.conversationLayers[layer];
        let revealConditionMet = false;
        
        switch (layerData.revealed) {
            case 'immediate':
                revealConditionMet = true;
                break;
            case 'insight_check':
                // Requires successful insight check
                revealConditionMet = this.activeDialogue.skillChecksAttempted.some(
                    check => check.skill === 'insight' && check.success
                );
                break;
            case 'relationship_trust':
                // Requires high trust relationship
                revealConditionMet = context.relationship.trust >= 75;
                break;
            case 'special_conditions':
                // Requires specific story conditions
                revealConditionMet = await this.checkSpecialConditions(context);
                break;
        }
        
        if (revealConditionMet) {
            this.activeDialogue.layersRevealed.add(layer);
            
            // Generate revelation dialogue
            const revelation = await this.generateLayerRevelation(layer, context);
            await this.deliverNPCDialogue(revelation);
            
            // Update available options
            await this.updateDialogueOptions();
            
            return true;
        }
        
        return false;
    }

    /**
     * Store dialogue exchange in history
     */
    async storeDialogueExchange(npcId, playerLine, npcResponse, context) {
        const exchange = {
            id: `exchange_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            playerLine: playerLine,
            npcResponse: npcResponse,
            context: {
                location: context.location,
                relationship_level: context.relationship.level,
                topics_discussed: Array.from(this.activeDialogue.topicsDiscussed),
                skill_checks: this.activeDialogue.skillChecksAttempted.length,
                layers_revealed: Array.from(this.activeDialogue.layersRevealed)
            },
            consequences: []
        };
        
        // Store in dialogue history
        if (!this.dialogueHistory.has(npcId)) {
            this.dialogueHistory.set(npcId, []);
        }
        this.dialogueHistory.get(npcId).push(exchange);
        
        // Update NPC memory
        await this.updateNPCMemory(npcId, exchange);
        
        // Store in world database
        if (this.worldDatabase) {
            await this.worldDatabase.storeDialogueExchange(npcId, exchange);
        }
        
        return exchange;
    }

    /**
     * Update NPC memory based on conversation
     */
    async updateNPCMemory(npcId, exchange) {
        // Short-term memory (recent conversation details)
        if (!this.npcMemory.shortTerm.has(npcId)) {
            this.npcMemory.shortTerm.set(npcId, []);
        }
        this.npcMemory.shortTerm.get(npcId).push({
            exchange: exchange.id,
            topic: exchange.playerLine.topic,
            playerMood: exchange.playerLine.mood,
            outcome: exchange.consequences
        });
        
        // Long-term memory (important interactions)
        if (exchange.context.skill_checks > 0 || exchange.playerLine.importance > 7) {
            if (!this.npcMemory.longTerm.has(npcId)) {
                this.npcMemory.longTerm.set(npcId, []);
            }
            this.npcMemory.longTerm.get(npcId).push({
                exchange: exchange.id,
                significance: exchange.playerLine.importance,
                emotional_impact: exchange.npcResponse.emotionalWeight,
                key_topics: Array.from(this.activeDialogue.topicsDiscussed)
            });
        }
        
        // Emotional memory
        if (exchange.npcResponse.emotionalWeight !== 0) {
            if (!this.npcMemory.emotional.has(npcId)) {
                this.npcMemory.emotional.set(npcId, { total: 0, experiences: [] });
            }
            const emotional = this.npcMemory.emotional.get(npcId);
            emotional.total += exchange.npcResponse.emotionalWeight;
            emotional.experiences.push({
                exchange: exchange.id,
                weight: exchange.npcResponse.emotionalWeight,
                context: exchange.context.location
            });
        }
        
        // Factual memory (player information learned)
        if (exchange.playerLine.revealsInformation) {
            if (!this.npcMemory.factual.has(npcId)) {
                this.npcMemory.factual.set(npcId, []);
            }
            this.npcMemory.factual.get(npcId).push({
                fact: exchange.playerLine.information,
                reliability: exchange.playerLine.reliability || 1.0,
                source: 'direct_conversation'
            });
        }
    }

    /**
     * Generate dialogue that references past conversations
     */
    async generateHistoryReferencingDialogue(npcId, context) {
        const history = this.dialogueHistory.get(npcId) || [];
        const recentExchanges = history.slice(-5); // Last 5 exchanges
        
        if (recentExchanges.length === 0) return null;
        
        // Find interesting past topics
        const pastTopics = new Set();
        const significantExchanges = [];
        
        for (const exchange of recentExchanges) {
            if (exchange.context.skill_checks > 0 || exchange.playerLine.importance > 6) {
                significantExchanges.push(exchange);
            }
            pastTopics.add(exchange.playerLine.topic);
        }
        
        // Generate reference based on relationship and past interactions
        let reference = '';
        
        if (significantExchanges.length > 0) {
            const lastSignificant = significantExchanges[significantExchanges.length - 1];
            reference = `I've been thinking about what you said regarding ${lastSignificant.playerLine.topic}...`;
        } else if (pastTopics.size > 0) {
            const topics = Array.from(pastTopics);
            const randomTopic = topics[Math.floor(Math.random() * topics.length)];
            reference = `About our conversation concerning ${randomTopic}...`;
        }
        
        return reference;
    }

    /**
     * Create dialogue interface
     */
    createDialogueInterface() {
        const dialogueInterface = document.createElement('div');
        dialogueInterface.id = 'dialogue-interface';
        dialogueInterface.className = 'dialogue-interface hidden';
        dialogueInterface.innerHTML = `
            <div class="dialogue-header">
                <div class="npc-info">
                    <span id="npc-name" class="npc-name">NPC Name</span>
                    <div class="relationship-indicator">
                        <span id="relationship-level" class="relationship-level">Neutral</span>
                        <div id="relationship-bar" class="relationship-bar">
                            <div id="relationship-fill" class="relationship-fill"></div>
                        </div>
                    </div>
                </div>
                <button id="end-conversation" class="btn btn-secondary">End Conversation</button>
            </div>
            
            <div class="dialogue-content">
                <div class="conversation-history" id="conversation-history">
                    <!-- Conversation messages will appear here -->
                </div>
                
                <div class="dialogue-options" id="dialogue-options">
                    <h4>Dialogue Options</h4>
                    <div id="option-list" class="option-list">
                        <!-- Dialogue options will be populated here -->
                    </div>
                </div>
                
                <div class="conversation-context" id="conversation-context">
                    <div class="context-section">
                        <h5>🧠 What you know:</h5>
                        <div id="known-information" class="context-info">
                            <!-- Known information about NPC -->
                        </div>
                    </div>
                    
                    <div class="context-section">
                        <h5>📚 Past interactions:</h5>
                        <div id="past-interactions" class="context-info">
                            <!-- Previous conversation topics -->
                        </div>
                    </div>
                    
                    <div class="context-section" id="companion-reactions">
                        <h5>👥 Companions:</h5>
                        <div id="companion-status" class="context-info">
                            <!-- Companion reactions and input -->
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="dialogue-footer">
                <div class="conversation-stats">
                    <span>Exchanges: <span id="exchange-count">0</span></span>
                    <span>Topics: <span id="topic-count">0</span></span>
                    <span>Skill Checks: <span id="skill-check-count">0</span></span>
                </div>
                
                <div class="dialogue-controls">
                    <button id="ask-companion-input" class="btn btn-secondary">Ask Companion</button>
                    <button id="voice-dialogue" class="btn btn-accent">🎤 Voice</button>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .dialogue-interface {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 800px;
                max-width: 90vw;
                height: 600px;
                max-height: 90vh;
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                z-index: 1000;
                display: flex;
                flex-direction: column;
            }

            .dialogue-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-md);
                background: var(--color-bg-secondary);
                border-bottom: 1px solid var(--color-border);
            }

            .npc-info {
                display: flex;
                align-items: center;
                gap: var(--spacing-md);
            }

            .npc-name {
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--color-accent);
            }

            .relationship-indicator {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
            }

            .relationship-level {
                font-size: 0.9rem;
                padding: 2px 8px;
                border-radius: 12px;
            }

            .relationship-level.friendly {
                background: rgba(76, 175, 80, 0.2);
                color: #4CAF50;
            }

            .relationship-level.neutral {
                background: rgba(158, 158, 158, 0.2);
                color: #9E9E9E;
            }

            .relationship-level.hostile {
                background: rgba(244, 67, 54, 0.2);
                color: #F44336;
            }

            .relationship-bar {
                width: 80px;
                height: 6px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
                overflow: hidden;
            }

            .relationship-fill {
                height: 100%;
                background: var(--color-accent);
                transition: width 0.3s ease;
            }

            .dialogue-content {
                flex: 1;
                display: flex;
                overflow: hidden;
            }

            .conversation-history {
                flex: 2;
                padding: var(--spacing-md);
                overflow-y: auto;
                border-right: 1px solid var(--color-border);
            }

            .conversation-message {
                margin-bottom: var(--spacing-md);
                padding: var(--spacing-sm);
                border-radius: var(--border-radius);
            }

            .message-player {
                background: rgba(var(--color-accent-rgb), 0.1);
                border-left: 3px solid var(--color-accent);
                margin-left: var(--spacing-md);
            }

            .message-npc {
                background: rgba(255, 255, 255, 0.05);
                border-left: 3px solid var(--color-secondary);
            }

            .message-companion {
                background: rgba(255, 193, 7, 0.1);
                border-left: 3px solid #FFC107;
                font-style: italic;
            }

            .message-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--spacing-xs);
            }

            .speaker-name {
                font-weight: 600;
                color: var(--color-accent);
            }

            .message-timestamp {
                font-size: 0.8rem;
                color: var(--color-text-secondary);
            }

            .message-text {
                line-height: 1.4;
            }

            .skill-check-result {
                font-size: 0.9rem;
                color: var(--color-text-secondary);
                margin-top: var(--spacing-xs);
            }

            .skill-check-success {
                color: var(--color-success);
            }

            .skill-check-failure {
                color: var(--color-error);
            }

            .dialogue-options {
                flex: 2;
                padding: var(--spacing-md);
                overflow-y: auto;
            }

            .dialogue-options h4 {
                margin: 0 0 var(--spacing-md) 0;
                color: var(--color-accent);
            }

            .dialogue-option {
                padding: var(--spacing-md);
                margin-bottom: var(--spacing-sm);
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .dialogue-option:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: var(--color-accent);
            }

            .option-text {
                margin-bottom: var(--spacing-xs);
            }

            .option-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.8rem;
                color: var(--color-text-secondary);
            }

            .option-type {
                padding: 2px 6px;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.1);
            }

            .option-type.skill_check {
                background: rgba(33, 150, 243, 0.3);
                color: #2196F3;
            }

            .option-type.choice_reference {
                background: rgba(156, 39, 176, 0.3);
                color: #9C27B0;
            }

            .skill-requirements {
                font-size: 0.8rem;
                color: var(--color-warning);
            }

            .success-chance {
                font-size: 0.8rem;
                color: var(--color-success);
            }

            .conversation-context {
                flex: 1;
                padding: var(--spacing-md);
                background: var(--color-bg-secondary);
                overflow-y: auto;
            }

            .context-section {
                margin-bottom: var(--spacing-md);
            }

            .context-section h5 {
                margin: 0 0 var(--spacing-sm) 0;
                color: var(--color-accent);
                font-size: 0.9rem;
            }

            .context-info {
                font-size: 0.8rem;
                color: var(--color-text-secondary);
                line-height: 1.3;
            }

            .context-info p {
                margin: var(--spacing-xs) 0;
            }

            .dialogue-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-md);
                background: var(--color-bg-secondary);
                border-top: 1px solid var(--color-border);
            }

            .conversation-stats {
                display: flex;
                gap: var(--spacing-md);
                font-size: 0.8rem;
                color: var(--color-text-secondary);
            }

            .dialogue-controls {
                display: flex;
                gap: var(--spacing-sm);
            }

            .hidden {
                display: none;
            }
        `;

        document.head.appendChild(styles);
        document.body.appendChild(dialogueInterface);
    }

    // ===== HELPER METHODS =====

    async findRelevantChoices(npcId) {
        if (!this.choiceTrackingSystem) return [];
        
        const allChoices = this.choiceTrackingSystem.getChoiceHistory();
        return allChoices.filter(choice => 
            choice.context.characters?.includes(npcId) ||
            choice.context.location === this.getCurrentLocation() ||
            Math.abs(choice.moralWeight) >= 2
        ).slice(-10); // Last 10 relevant choices
    }

    async findSharedQuests(npcId) {
        if (!this.dynamicQuestSystem) return [];
        
        const activeQuests = this.dynamicQuestSystem.getActiveQuests();
        return activeQuests.filter(quest => 
            quest.context.npcs?.includes(npcId)
        );
    }

    calculateSkillDC(skill, context) {
        const baseSkillData = this.skillDialogueTypes[skill];
        let dc = baseSkillData.baseDC;
        
        // Relationship modifiers
        if (context.relationship.level > 2) {
            dc -= 2; // Easier with friends
        } else if (context.relationship.level < -2) {
            dc += 3; // Harder with enemies
        }
        
        // NPC personality modifiers
        if (context.npc.personality === 'suspicious') {
            dc += 2;
        } else if (context.npc.personality === 'trusting') {
            dc -= 1;
        }
        
        return Math.max(5, Math.min(25, dc));
    }

    getCurrentLocation() {
        return this.core.getModule('campaignManager')?.getCurrentLocation() || 'Unknown Location';
    }

    getTimeOfDay() {
        // Simplified time of day
        const hour = new Date().getHours();
        if (hour < 6) return 'night';
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    }

    setupEventListeners() {
        // End conversation
        document.getElementById('end-conversation')?.addEventListener('click', () => {
            this.endDialogue();
        });

        // Voice dialogue
        document.getElementById('voice-dialogue')?.addEventListener('click', () => {
            this.enableVoiceDialogue();
        });

        // Ask companion input
        document.getElementById('ask-companion-input')?.addEventListener('click', () => {
            this.requestCompanionInput();
        });

        // Listen for choice events that might affect ongoing dialogue
        this.core.on('choice:recorded', (event) => {
            if (this.activeDialogue) {
                this.updateDialogueAfterChoice(event.detail.choice);
            }
        });
    }

    // ===== PUBLIC API =====

    /**
     * Start dialogue (external API)
     */
    async startConversation(npcId, context = {}) {
        return await this.startDialogue(npcId, context);
    }

    /**
     * Get dialogue history (external API)
     */
    getDialogueHistory(npcId) {
        return this.dialogueHistory.get(npcId) || [];
    }

    /**
     * Check if currently in dialogue
     */
    isInDialogue() {
        return this.activeDialogue !== null;
    }

    /**
     * Export dialogue data for saves
     */
    exportDialogueData() {
        return {
            dialogueHistory: Object.fromEntries(this.dialogueHistory),
            npcMemory: {
                shortTerm: Object.fromEntries(this.npcMemory.shortTerm),
                longTerm: Object.fromEntries(this.npcMemory.longTerm),
                emotional: Object.fromEntries(this.npcMemory.emotional),
                factual: Object.fromEntries(this.npcMemory.factual)
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import dialogue data from saves
     */
    async importDialogueData(data) {
        if (data.dialogueHistory) {
            this.dialogueHistory = new Map(Object.entries(data.dialogueHistory));
        }
        if (data.npcMemory) {
            this.npcMemory.shortTerm = new Map(Object.entries(data.npcMemory.shortTerm || {}));
            this.npcMemory.longTerm = new Map(Object.entries(data.npcMemory.longTerm || {}));
            this.npcMemory.emotional = new Map(Object.entries(data.npcMemory.emotional || {}));
            this.npcMemory.factual = new Map(Object.entries(data.npcMemory.factual || {}));
        }
        
        console.log('💬 Imported dialogue system data from save');
    }
}