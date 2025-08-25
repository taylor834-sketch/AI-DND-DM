export default class DynamicQuestSystem {
    constructor(core) {
        this.core = core;
        this.worldDatabase = null;
        this.choiceTrackingSystem = null;
        this.relationshipSystem = null;
        this.aiDMIntegration = null;
        
        // Quest state management
        this.activeQuests = new Map();
        this.completedQuests = new Map();
        this.failedQuests = new Map();
        this.retiredQuests = new Map();
        this.emergentQuests = new Map();
        
        // Quest interconnections
        this.questConnections = new Map();
        this.questSequences = new Map();
        this.mutuallyExclusiveQuests = new Set();
        
        // Dynamic quest evolution
        this.questEvolutionRules = new Map();
        this.questStateTransitions = new Map();
        this.alternativeSolutions = new Map();
        
        // Quest generation seeds
        this.questSeeds = new Map();
        this.emergentOpportunities = new Map();
        this.playerInterestTracker = new Map();
        
        // Quest types and templates
        this.questTypes = {
            main: { priority: 10, flexibility: 0.3 },
            side: { priority: 5, flexibility: 0.7 },
            personal: { priority: 7, flexibility: 0.5 },
            emergent: { priority: 6, flexibility: 0.9 },
            faction: { priority: 8, flexibility: 0.4 },
            discovery: { priority: 4, flexibility: 0.8 }
        };
        
        // Solution archetypes
        this.solutionArchetypes = {
            diplomatic: ['negotiation', 'persuasion', 'compromise'],
            combat: ['direct_assault', 'tactical_strike', 'elimination'],
            stealth: ['infiltration', 'sabotage', 'theft'],
            investigation: ['research', 'interrogation', 'surveillance'],
            social: ['alliance_building', 'reputation', 'manipulation'],
            magical: ['spellcasting', 'ritual', 'artifact_use'],
            resource: ['trade', 'bribery', 'economic_pressure']
        };
        
        this.init();
    }

    async init() {
        // Get required modules
        this.worldDatabase = this.core.getModule('worldDatabase');
        this.choiceTrackingSystem = this.core.getModule('choiceTrackingSystem');
        this.relationshipSystem = this.core.getModule('relationshipSystem');
        this.aiDMIntegration = this.core.getModule('aiDMIntegration');
        
        // Load existing quest data
        await this.loadQuestData();
        
        // Initialize quest evolution rules
        this.initializeEvolutionRules();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('🗞️ Dynamic Quest System initialized');
    }

    /**
     * Create a new dynamic quest
     */
    async createQuest(questData) {
        const quest = {
            id: questData.id || `quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: questData.title,
            description: questData.description,
            type: questData.type || 'side',
            
            // Quest state
            status: 'active',
            progress: 0,
            currentObjective: questData.objectives ? questData.objectives[0] : null,
            
            // Core quest data
            objectives: questData.objectives || [],
            rewards: questData.rewards || [],
            consequences: questData.consequences || [],
            
            // Dynamic elements
            flexibility: this.questTypes[questData.type]?.flexibility || 0.5,
            adaptability: questData.adaptability || 0.7,
            emergentPotential: questData.emergentPotential || 0.5,
            
            // Context and triggers
            context: {
                location: questData.context?.location,
                npcs: questData.context?.npcs || [],
                factions: questData.context?.factions || [],
                themes: questData.context?.themes || [],
                stakes: questData.context?.stakes || 'medium'
            },
            
            // Solution paths
            solutionPaths: this.generateSolutionPaths(questData),
            alternativeSolutions: [],
            failureConsequences: questData.failureConsequences || [],
            
            // Evolution tracking
            evolutionHistory: [],
            choiceInfluences: [],
            adaptations: [],
            
            // Metadata
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            createdBy: questData.createdBy || 'system',
            tags: questData.tags || []
        };
        
        // Generate alternative approaches
        quest.alternativeSolutions = this.generateAlternativeSolutions(quest);
        
        // Set up evolution triggers
        this.setupQuestEvolutionTriggers(quest);
        
        // Store the quest
        this.activeQuests.set(quest.id, quest);
        
        // Create quest connections
        await this.establishQuestConnections(quest);
        
        // Notify systems
        this.core.emit('quest:created', { quest });
        
        console.log(`📜 Created dynamic quest: ${quest.title}`);
        return quest;
    }

    /**
     * Generate multiple solution paths for a quest
     */
    generateSolutionPaths(questData) {
        const paths = [];
        const questThemes = questData.context?.themes || [];
        const involvedNPCs = questData.context?.npcs || [];
        
        // Generate paths based on quest themes and context
        for (const [archetype, methods] of Object.entries(this.solutionArchetypes)) {
            if (this.isArchetypeViable(archetype, questData)) {
                const path = {
                    archetype: archetype,
                    methods: methods.filter(method => this.isMethodApplicable(method, questData)),
                    requirements: this.getArchetypeRequirements(archetype, questData),
                    consequences: this.predictArchetypeConsequences(archetype, questData),
                    viability: this.calculatePathViability(archetype, questData),
                    unlocked: this.isPathUnlocked(archetype, questData)
                };
                
                if (path.methods.length > 0) {
                    paths.push(path);
                }
            }
        }
        
        return paths.sort((a, b) => b.viability - a.viability);
    }

    /**
     * Generate alternative solutions based on player history and choices
     */
    generateAlternativeSolutions(quest) {
        const alternatives = [];
        
        if (!this.choiceTrackingSystem) return alternatives;
        
        // Analyze player's preferred approach patterns
        const playerProfile = this.choiceTrackingSystem.getPersonalityProfile();
        const dominantTraits = playerProfile.dominantTraits;
        
        // Generate alternatives that align with player preferences
        for (const trait of dominantTraits) {
            const alternative = this.generateTraitBasedSolution(quest, trait.trait);
            if (alternative) {
                alternatives.push(alternative);
            }
        }
        
        // Generate creative solutions based on available resources
        const creativeSolutions = this.generateCreativeSolutions(quest);
        alternatives.push(...creativeSolutions);
        
        return alternatives;
    }

    /**
     * Evolve a quest based on player choices and world state
     */
    async evolveQuest(questId, trigger) {
        const quest = this.activeQuests.get(questId);
        if (!quest) return null;
        
        console.log(`🔄 Evolving quest "${quest.title}" due to: ${trigger.type}`);
        
        // Record the evolution trigger
        quest.evolutionHistory.push({
            timestamp: new Date().toISOString(),
            trigger: trigger,
            previousState: this.cloneQuestState(quest)
        });
        
        // Apply evolution based on trigger type
        let evolved = false;
        
        switch (trigger.type) {
            case 'player_choice':
                evolved = await this.evolveFromChoice(quest, trigger.choice);
                break;
            case 'relationship_change':
                evolved = await this.evolveFromRelationship(quest, trigger.relationship);
                break;
            case 'world_event':
                evolved = await this.evolveFromWorldEvent(quest, trigger.event);
                break;
            case 'quest_failure':
                evolved = await this.evolveFromFailure(quest, trigger.failedQuest);
                break;
            case 'time_passage':
                evolved = await this.evolveFromTime(quest, trigger.timeData);
                break;
            case 'faction_change':
                evolved = await this.evolveFromFaction(quest, trigger.factionData);
                break;
        }
        
        if (evolved) {
            quest.lastModified = new Date().toISOString();
            quest.adaptations.push({
                timestamp: new Date().toISOString(),
                type: trigger.type,
                description: this.describeEvolution(quest, trigger)
            });
            
            // Notify other systems
            this.core.emit('quest:evolved', { quest, trigger });
            
            // Check for emergent quest opportunities
            await this.checkEmergentOpportunities(quest, trigger);
        }
        
        return evolved ? quest : null;
    }

    /**
     * Evolve quest from player choice
     */
    async evolveFromChoice(quest, choice) {
        let evolved = false;
        
        // Check if choice affects quest NPCs
        if (choice.context?.characters) {
            for (const npc of choice.context.characters) {
                if (quest.context.npcs.includes(npc)) {
                    // Modify quest based on relationship change
                    const relationshipChange = choice.immediateConsequences
                        .find(c => c.type === 'relationship' && c.target === npc);
                    
                    if (relationshipChange) {
                        evolved = this.adaptQuestToRelationship(quest, npc, relationshipChange.change) || evolved;
                    }
                }
            }
        }
        
        // Check if choice aligns with or contradicts quest themes
        const questThemes = quest.context.themes;
        const choiceCategories = choice.categories;
        
        for (const theme of questThemes) {
            if (this.isChoiceRelevantToTheme(choice, theme)) {
                evolved = this.adaptQuestToTheme(quest, theme, choice) || evolved;
            }
        }
        
        // Moral weight implications
        if (Math.abs(choice.moralWeight) >= 2) {
            evolved = this.adaptQuestToMorality(quest, choice.moralWeight) || evolved;
        }
        
        return evolved;
    }

    /**
     * Handle quest failure and create new opportunities
     */
    async handleQuestFailure(questId, failureReason) {
        const quest = this.activeQuests.get(questId);
        if (!quest) return null;
        
        // Move to failed quests
        this.activeQuests.delete(questId);
        quest.status = 'failed';
        quest.failureReason = failureReason;
        quest.failedAt = new Date().toISOString();
        this.failedQuests.set(questId, quest);
        
        // Apply failure consequences
        await this.applyFailureConsequences(quest);
        
        // Generate new opportunities from failure
        const newOpportunities = await this.generateFailureOpportunities(quest);
        
        // Create emergent quests
        for (const opportunity of newOpportunities) {
            const emergentQuest = await this.createEmergentQuest(opportunity, quest);
            this.emergentQuests.set(emergentQuest.id, emergentQuest);
        }
        
        console.log(`❌ Quest "${quest.title}" failed - ${newOpportunities.length} new opportunities created`);
        
        // Notify systems
        this.core.emit('quest:failed', { quest, opportunities: newOpportunities });
        
        return newOpportunities;
    }

    /**
     * Complete a quest and handle consequences
     */
    async completeQuest(questId, completionData) {
        const quest = this.activeQuests.get(questId);
        if (!quest) return null;
        
        // Move to completed quests
        this.activeQuests.delete(questId);
        quest.status = 'completed';
        quest.completionMethod = completionData.method;
        quest.completedAt = new Date().toISOString();
        quest.finalChoice = completionData.finalChoice;
        this.completedQuests.set(questId, quest);
        
        // Apply rewards and consequences
        await this.applyQuestRewards(quest, completionData);
        await this.applyQuestConsequences(quest, completionData);
        
        // Check for quest retirement and unlocks
        await this.checkQuestRetirement(quest);
        
        // Update connected quests
        await this.updateConnectedQuests(quest, 'completed');
        
        console.log(`✅ Quest "${quest.title}" completed via ${completionData.method}`);
        
        // Notify systems
        this.core.emit('quest:completed', { quest, completionData });
        
        return quest;
    }

    /**
     * Retire a quest and unlock new content
     */
    async retireQuest(questId, retirementReason) {
        const quest = this.completedQuests.get(questId) || this.failedQuests.get(questId);
        if (!quest) return null;
        
        // Move to retired quests
        if (this.completedQuests.has(questId)) this.completedQuests.delete(questId);
        if (this.failedQuests.has(questId)) this.failedQuests.delete(questId);
        
        quest.status = 'retired';
        quest.retirementReason = retirementReason;
        quest.retiredAt = new Date().toISOString();
        this.retiredQuests.set(questId, quest);
        
        // Unlock new content based on retirement
        const unlockedContent = await this.unlockRetirementContent(quest);
        
        console.log(`🏛️ Quest "${quest.title}" retired - unlocked ${unlockedContent.length} new content`);
        
        // Notify systems
        this.core.emit('quest:retired', { quest, unlockedContent });
        
        return unlockedContent;
    }

    /**
     * Create emergent quest from opportunities
     */
    async createEmergentQuest(opportunity, sourceQuest = null) {
        const emergentQuest = {
            id: `emergent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: opportunity.title,
            description: opportunity.description,
            type: 'emergent',
            
            // Emergent characteristics
            emergentSource: sourceQuest?.id || 'world_event',
            spontaneity: opportunity.spontaneity || 0.8,
            timeframe: opportunity.timeframe || 'immediate',
            
            // Standard quest data
            objectives: opportunity.objectives || [],
            rewards: opportunity.rewards || [],
            context: opportunity.context || {},
            
            // High flexibility for emergent quests
            flexibility: 0.9,
            adaptability: 0.9,
            emergentPotential: 0.8,
            
            // Generated solution paths
            solutionPaths: this.generateSolutionPaths(opportunity),
            alternativeSolutions: [],
            
            // Metadata
            createdAt: new Date().toISOString(),
            createdBy: 'emergent_system',
            tags: ['emergent', ...(opportunity.tags || [])]
        };
        
        // Generate alternatives for emergent quest
        emergentQuest.alternativeSolutions = this.generateAlternativeSolutions(emergentQuest);
        
        // Add to active quests if it should be immediate
        if (opportunity.timeframe === 'immediate') {
            this.activeQuests.set(emergentQuest.id, emergentQuest);
        } else {
            // Store as potential future quest
            this.emergentOpportunities.set(emergentQuest.id, emergentQuest);
        }
        
        return emergentQuest;
    }

    /**
     * Check for quest interconnections and dependencies
     */
    async establishQuestConnections(quest) {
        const connections = [];
        
        // Check for NPC connections
        for (const npc of quest.context.npcs) {
            for (const [otherQuestId, otherQuest] of this.activeQuests) {
                if (otherQuest.id === quest.id) continue;
                
                if (otherQuest.context.npcs.includes(npc)) {
                    connections.push({
                        questId: otherQuestId,
                        type: 'npc_shared',
                        strength: 0.7,
                        npc: npc
                    });
                }
            }
        }
        
        // Check for faction connections
        for (const faction of quest.context.factions) {
            for (const [otherQuestId, otherQuest] of this.activeQuests) {
                if (otherQuest.id === quest.id) continue;
                
                if (otherQuest.context.factions.includes(faction)) {
                    connections.push({
                        questId: otherQuestId,
                        type: 'faction_shared',
                        strength: 0.6,
                        faction: faction
                    });
                }
            }
        }
        
        // Check for thematic connections
        for (const theme of quest.context.themes) {
            for (const [otherQuestId, otherQuest] of this.activeQuests) {
                if (otherQuest.id === quest.id) continue;
                
                const sharedThemes = otherQuest.context.themes.filter(t => 
                    theme.includes(t) || t.includes(theme));
                
                if (sharedThemes.length > 0) {
                    connections.push({
                        questId: otherQuestId,
                        type: 'thematic',
                        strength: 0.4,
                        themes: sharedThemes
                    });
                }
            }
        }
        
        // Store connections
        if (connections.length > 0) {
            this.questConnections.set(quest.id, connections);
        }
        
        return connections;
    }

    /**
     * Update connected quests when one changes status
     */
    async updateConnectedQuests(changedQuest, changeType) {
        const connections = this.questConnections.get(changedQuest.id) || [];
        
        for (const connection of connections) {
            const connectedQuest = this.activeQuests.get(connection.questId);
            if (!connectedQuest) continue;
            
            // Apply connection effects based on type and change
            let evolved = false;
            
            switch (connection.type) {
                case 'npc_shared':
                    evolved = await this.updateQuestForSharedNPC(connectedQuest, connection.npc, changedQuest, changeType);
                    break;
                case 'faction_shared':
                    evolved = await this.updateQuestForSharedFaction(connectedQuest, connection.faction, changedQuest, changeType);
                    break;
                case 'thematic':
                    evolved = await this.updateQuestForTheme(connectedQuest, connection.themes, changedQuest, changeType);
                    break;
            }
            
            if (evolved) {
                console.log(`🔗 Connected quest "${connectedQuest.title}" evolved due to "${changedQuest.title}" ${changeType}`);
            }
        }
    }

    /**
     * Generate quest analysis and recommendations
     */
    getQuestAnalysis() {
        const analysis = {
            active: this.activeQuests.size,
            completed: this.completedQuests.size,
            failed: this.failedQuests.size,
            retired: this.retiredQuests.size,
            emergent: this.emergentQuests.size,
            
            // Quest type breakdown
            typeBreakdown: this.getQuestTypeBreakdown(),
            
            // Solution path analysis
            solutionPreferences: this.analyzeSolutionPreferences(),
            
            // Connection analysis
            connectionDensity: this.calculateConnectionDensity(),
            
            // Evolution metrics
            evolutionRate: this.calculateEvolutionRate(),
            adaptationSuccess: this.calculateAdaptationSuccess(),
            
            // Player engagement metrics
            playerEngagement: this.calculatePlayerEngagement(),
            
            // Recommendations
            recommendations: this.generateQuestRecommendations()
        };
        
        return analysis;
    }

    /**
     * Get player's quest preferences and patterns
     */
    getPlayerQuestPreferences() {
        if (!this.choiceTrackingSystem) return null;
        
        const profile = this.choiceTrackingSystem.getPersonalityProfile();
        const preferences = {
            preferredSolutionTypes: [],
            moralAlignment: profile.moralAlignment,
            riskTolerance: this.calculateRiskTolerance(profile),
            collaborationPreference: this.calculateCollaborationPreference(profile),
            explorationDrive: this.calculateExplorationDrive(profile),
            questTypeAffinities: this.calculateQuestTypeAffinities(profile)
        };
        
        // Analyze completed quests for solution preferences
        for (const quest of this.completedQuests.values()) {
            if (quest.completionMethod) {
                preferences.preferredSolutionTypes.push(quest.completionMethod);
            }
        }
        
        return preferences;
    }

    // ===== HELPER METHODS =====

    isArchetypeViable(archetype, questData) {
        const context = questData.context || {};
        
        // Combat requires enemies or conflict
        if (archetype === 'combat') {
            return context.stakes === 'high' || context.themes?.includes('conflict');
        }
        
        // Diplomatic requires NPCs
        if (archetype === 'diplomatic') {
            return context.npcs?.length > 0;
        }
        
        // Stealth requires infiltration opportunities
        if (archetype === 'stealth') {
            return context.themes?.includes('infiltration') || context.themes?.includes('secrecy');
        }
        
        // Investigation requires mysteries or information
        if (archetype === 'investigation') {
            return context.themes?.includes('mystery') || context.themes?.includes('information');
        }
        
        return true; // Most archetypes are generally viable
    }

    isMethodApplicable(method, questData) {
        // This would contain logic to determine if a specific method applies to the quest
        // For now, simplified logic
        return true;
    }

    getArchetypeRequirements(archetype, questData) {
        const requirements = [];
        
        switch (archetype) {
            case 'combat':
                requirements.push('combat_skills', 'weapons', 'tactics');
                break;
            case 'diplomatic':
                requirements.push('persuasion_skill', 'reputation', 'communication');
                break;
            case 'stealth':
                requirements.push('stealth_skill', 'infiltration_tools', 'timing');
                break;
            case 'investigation':
                requirements.push('investigation_skill', 'information_sources', 'time');
                break;
            case 'magical':
                requirements.push('spellcasting_ability', 'magical_components', 'knowledge');
                break;
        }
        
        return requirements;
    }

    predictArchetypeConsequences(archetype, questData) {
        const consequences = [];
        
        switch (archetype) {
            case 'combat':
                consequences.push({ type: 'reputation', change: 'aggressive' });
                consequences.push({ type: 'relationships', change: 'fear_or_respect' });
                break;
            case 'diplomatic':
                consequences.push({ type: 'reputation', change: 'peaceful' });
                consequences.push({ type: 'relationships', change: 'trust' });
                break;
            case 'stealth':
                consequences.push({ type: 'reputation', change: 'mysterious' });
                consequences.push({ type: 'information', change: 'secrets_gained' });
                break;
        }
        
        return consequences;
    }

    calculatePathViability(archetype, questData) {
        // Complex viability calculation based on context, player stats, etc.
        // Simplified for now
        let viability = 0.5;
        
        const context = questData.context || {};
        
        if (archetype === 'combat' && context.stakes === 'high') viability += 0.3;
        if (archetype === 'diplomatic' && context.npcs?.length > 0) viability += 0.4;
        if (archetype === 'stealth' && context.themes?.includes('secrecy')) viability += 0.3;
        
        return Math.min(1.0, viability);
    }

    isPathUnlocked(archetype, questData) {
        // Check if player has unlocked this solution path
        // Based on previous choices, skills, relationships, etc.
        return true; // Simplified - all paths unlocked initially
    }

    generateTraitBasedSolution(quest, trait) {
        // Generate solutions based on personality traits
        const traitSolutions = {
            compassionate: {
                method: 'peaceful_resolution',
                description: 'Find a solution that helps everyone involved',
                requirements: ['high_empathy', 'good_relationships'],
                archetype: 'diplomatic'
            },
            ruthless: {
                method: 'direct_elimination',
                description: 'Remove obstacles through decisive action',
                requirements: ['combat_ability', 'willingness_to_harm'],
                archetype: 'combat'
            },
            curious: {
                method: 'investigation_approach',
                description: 'Uncover the truth through careful investigation',
                requirements: ['investigation_skills', 'time', 'patience'],
                archetype: 'investigation'
            }
        };
        
        return traitSolutions[trait] || null;
    }

    generateCreativeSolutions(quest) {
        // Generate creative, out-of-the-box solutions
        const creative = [];
        
        // Resource-based solutions
        creative.push({
            method: 'resource_exchange',
            description: 'Solve the problem through trade or resource sharing',
            requirements: ['valuable_resources', 'negotiation_skills'],
            archetype: 'resource',
            creativity: 0.8
        });
        
        // Social engineering solutions
        creative.push({
            method: 'social_manipulation',
            description: 'Use social connections and influence to achieve goals',
            requirements: ['social_connections', 'manipulation_skills'],
            archetype: 'social',
            creativity: 0.7
        });
        
        return creative;
    }

    cloneQuestState(quest) {
        return {
            objectives: [...quest.objectives],
            progress: quest.progress,
            currentObjective: quest.currentObjective,
            solutionPaths: [...quest.solutionPaths],
            context: { ...quest.context }
        };
    }

    describeEvolution(quest, trigger) {
        switch (trigger.type) {
            case 'player_choice':
                return `Quest adapted to player's ${trigger.choice.categories.join(', ')} choice`;
            case 'relationship_change':
                return `Quest modified due to changing relationship with ${trigger.relationship.npc}`;
            case 'world_event':
                return `Quest evolved in response to world event: ${trigger.event.type}`;
            default:
                return `Quest evolved due to ${trigger.type}`;
        }
    }

    adaptQuestToRelationship(quest, npc, relationshipChange) {
        // Modify quest based on relationship changes
        let adapted = false;
        
        if (relationshipChange > 0) {
            // Positive relationship change - add cooperative solutions
            const cooperativeSolution = {
                archetype: 'diplomatic',
                methods: ['cooperative_approach'],
                requirements: [`good_relationship_${npc}`],
                viability: 0.8,
                unlocked: true
            };
            
            if (!quest.solutionPaths.some(p => p.archetype === 'diplomatic')) {
                quest.solutionPaths.push(cooperativeSolution);
                adapted = true;
            }
        } else {
            // Negative relationship change - remove cooperative solutions, add confrontational
            quest.solutionPaths = quest.solutionPaths.filter(p => 
                !(p.archetype === 'diplomatic' && p.requirements.includes(`good_relationship_${npc}`)));
            
            const confrontationalSolution = {
                archetype: 'combat',
                methods: ['intimidation', 'force'],
                requirements: [`hostile_relationship_${npc}`],
                viability: 0.6,
                unlocked: true
            };
            
            quest.solutionPaths.push(confrontationalSolution);
            adapted = true;
        }
        
        return adapted;
    }

    adaptQuestToTheme(quest, theme, choice) {
        // Adapt quest based on thematic choices
        // This would contain logic to modify quest objectives, solutions, or context
        // based on how player choices align with or contradict quest themes
        return false; // Simplified for now
    }

    adaptQuestToMorality(quest, moralWeight) {
        // Adapt quest based on strong moral choices
        let adapted = false;
        
        if (moralWeight >= 2) {
            // Player made very good choice - unlock paragon solutions
            const paragonSolution = {
                archetype: 'diplomatic',
                methods: ['heroic_sacrifice', 'pure_good'],
                requirements: ['high_morality', 'reputation_good'],
                viability: 0.9,
                unlocked: true
            };
            
            quest.solutionPaths.push(paragonSolution);
            adapted = true;
        } else if (moralWeight <= -2) {
            // Player made very evil choice - unlock renegade solutions
            const renegadeSolution = {
                archetype: 'combat',
                methods: ['ruthless_efficiency', 'ends_justify_means'],
                requirements: ['low_morality', 'reputation_evil'],
                viability: 0.9,
                unlocked: true
            };
            
            quest.solutionPaths.push(renegadeSolution);
            adapted = true;
        }
        
        return adapted;
    }

    async applyFailureConsequences(quest) {
        // Apply consequences of quest failure
        for (const consequence of quest.failureConsequences) {
            switch (consequence.type) {
                case 'relationship':
                    if (this.relationshipSystem) {
                        await this.relationshipSystem.modifyRelationship(
                            consequence.target, 
                            consequence.change, 
                            `Quest "${quest.title}" failed`
                        );
                    }
                    break;
                case 'world_state':
                    if (this.worldDatabase) {
                        await this.worldDatabase.updateWorldState(
                            consequence.key, 
                            consequence.value
                        );
                    }
                    break;
                case 'reputation':
                    // Update player reputation
                    break;
            }
        }
    }

    async generateFailureOpportunities(failedQuest) {
        const opportunities = [];
        
        // Redemption opportunity
        opportunities.push({
            title: `Redemption: ${failedQuest.title}`,
            description: `A chance to make amends for the failure of "${failedQuest.title}"`,
            type: 'emergent',
            spontaneity: 0.7,
            timeframe: 'short_term',
            objectives: [`Make amends for failing ${failedQuest.title}`],
            context: {
                ...failedQuest.context,
                themes: ['redemption', 'second_chance', ...failedQuest.context.themes]
            }
        });
        
        // Consequence mitigation
        if (failedQuest.failureConsequences.length > 0) {
            opportunities.push({
                title: `Damage Control`,
                description: `Deal with the consequences of failing "${failedQuest.title}"`,
                type: 'emergent',
                spontaneity: 0.9,
                timeframe: 'immediate',
                objectives: ['Mitigate failure consequences'],
                context: {
                    location: failedQuest.context.location,
                    npcs: failedQuest.context.npcs,
                    themes: ['consequences', 'damage_control']
                }
            });
        }
        
        return opportunities;
    }

    async checkQuestRetirement(completedQuest) {
        // Check if quest should be retired based on completion method and impact
        const retirementCriteria = [
            completedQuest.type === 'main',
            completedQuest.context.stakes === 'high',
            completedQuest.evolutionHistory.length >= 3,
            completedQuest.adaptations.length >= 2
        ];
        
        const shouldRetire = retirementCriteria.filter(Boolean).length >= 2;
        
        if (shouldRetire) {
            setTimeout(() => {
                this.retireQuest(completedQuest.id, 'automatic_retirement');
            }, 300000); // Retire after 5 minutes
        }
    }

    async unlockRetirementContent(retiredQuest) {
        const unlockedContent = [];
        
        // Unlock new quest lines based on retired quest
        if (retiredQuest.type === 'main') {
            unlockedContent.push({
                type: 'quest_line',
                title: `Legacy of ${retiredQuest.title}`,
                description: `New opportunities arising from the completion of "${retiredQuest.title}"`
            });
        }
        
        // Unlock new locations
        if (retiredQuest.context.location) {
            unlockedContent.push({
                type: 'location',
                location: `${retiredQuest.context.location}_extended`,
                description: `New areas of ${retiredQuest.context.location} become accessible`
            });
        }
        
        // Unlock new NPCs or dialogue options
        for (const npc of retiredQuest.context.npcs) {
            unlockedContent.push({
                type: 'dialogue_options',
                npc: npc,
                description: `New conversation topics with ${npc} based on shared history`
            });
        }
        
        return unlockedContent;
    }

    // Additional helper methods for analysis and calculations...
    
    getQuestTypeBreakdown() {
        const breakdown = {};
        
        for (const type of Object.keys(this.questTypes)) {
            breakdown[type] = {
                active: Array.from(this.activeQuests.values()).filter(q => q.type === type).length,
                completed: Array.from(this.completedQuests.values()).filter(q => q.type === type).length,
                failed: Array.from(this.failedQuests.values()).filter(q => q.type === type).length
            };
        }
        
        return breakdown;
    }

    analyzeSolutionPreferences() {
        const preferences = {};
        
        for (const quest of this.completedQuests.values()) {
            if (quest.completionMethod) {
                preferences[quest.completionMethod] = (preferences[quest.completionMethod] || 0) + 1;
            }
        }
        
        return preferences;
    }

    calculateConnectionDensity() {
        const totalQuests = this.activeQuests.size + this.completedQuests.size;
        const totalConnections = Array.from(this.questConnections.values())
            .reduce((sum, connections) => sum + connections.length, 0);
        
        return totalQuests > 0 ? totalConnections / totalQuests : 0;
    }

    calculateEvolutionRate() {
        const questsWithEvolution = Array.from(this.activeQuests.values())
            .filter(q => q.evolutionHistory.length > 0).length;
        
        return this.activeQuests.size > 0 ? questsWithEvolution / this.activeQuests.size : 0;
    }

    calculateAdaptationSuccess() {
        const adapatedQuests = Array.from(this.completedQuests.values())
            .filter(q => q.adaptations.length > 0);
        
        const totalCompleted = this.completedQuests.size;
        
        return totalCompleted > 0 ? adapatedQuests.length / totalCompleted : 0;
    }

    calculatePlayerEngagement() {
        // Calculate based on quest completion rate, evolution triggers, etc.
        const completionRate = this.completedQuests.size / 
            (this.completedQuests.size + this.failedQuests.size + this.activeQuests.size);
        
        return Math.max(0, Math.min(1, completionRate));
    }

    generateQuestRecommendations() {
        const recommendations = [];
        
        if (this.activeQuests.size > 10) {
            recommendations.push({
                type: 'too_many_active',
                suggestion: 'Consider focusing on fewer active quests for better narrative coherence'
            });
        }
        
        if (this.calculateConnectionDensity() < 0.3) {
            recommendations.push({
                type: 'low_connections',
                suggestion: 'Create more interconnected quests to enhance narrative depth'
            });
        }
        
        return recommendations;
    }

    async loadQuestData() {
        // Load quest data from world database
        if (this.worldDatabase) {
            const savedQuests = await this.worldDatabase.getPlayerQuests();
            // Process and load saved quest data
        }
    }

    initializeEvolutionRules() {
        // Initialize rules for how quests should evolve
        // This would contain the complex rule system for quest evolution
    }

    setupEventListeners() {
        // Listen for choice tracking events
        this.core.on('choice:recorded', (event) => {
            this.handleChoiceEvent(event.detail.choice);
        });
        
        // Listen for relationship changes
        this.core.on('relationship:changed', (event) => {
            this.handleRelationshipEvent(event.detail);
        });
        
        // Listen for world events
        this.core.on('world:event', (event) => {
            this.handleWorldEvent(event.detail);
        });
    }

    async handleChoiceEvent(choice) {
        // Check all active quests for potential evolution
        for (const quest of this.activeQuests.values()) {
            await this.evolveQuest(quest.id, { type: 'player_choice', choice });
        }
    }

    async handleRelationshipEvent(relationshipData) {
        // Check quests involving the affected NPC
        for (const quest of this.activeQuests.values()) {
            if (quest.context.npcs.includes(relationshipData.npc)) {
                await this.evolveQuest(quest.id, { type: 'relationship_change', relationship: relationshipData });
            }
        }
    }

    async handleWorldEvent(eventData) {
        // Check all active quests for world event impacts
        for (const quest of this.activeQuests.values()) {
            if (this.isQuestAffectedByWorldEvent(quest, eventData)) {
                await this.evolveQuest(quest.id, { type: 'world_event', event: eventData });
            }
        }
    }

    isQuestAffectedByWorldEvent(quest, eventData) {
        // Determine if a world event should affect a specific quest
        return quest.context.location === eventData.location ||
               quest.context.factions.some(f => eventData.affectedFactions?.includes(f));
    }

    setupQuestEvolutionTriggers(quest) {
        // Set up specific triggers for this quest's evolution
        // This would establish the conditions under which the quest should evolve
    }

    async checkEmergentOpportunities(changedQuest, trigger) {
        // Look for opportunities to create new emergent quests
        // based on the evolution of existing quests
    }

    async updateQuestForSharedNPC(quest, npc, changedQuest, changeType) {
        // Update quest when a shared NPC is affected by another quest's change
        return false; // Placeholder
    }

    async updateQuestForSharedFaction(quest, faction, changedQuest, changeType) {
        // Update quest when a shared faction is affected
        return false; // Placeholder
    }

    async updateQuestForTheme(quest, themes, changedQuest, changeType) {
        // Update quest when shared themes are affected
        return false; // Placeholder
    }

    // ===== PUBLIC API =====

    /**
     * Get all active quests
     */
    getActiveQuests() {
        return Array.from(this.activeQuests.values());
    }

    /**
     * Get quest by ID
     */
    getQuest(questId) {
        return this.activeQuests.get(questId) || 
               this.completedQuests.get(questId) || 
               this.failedQuests.get(questId) ||
               this.retiredQuests.get(questId);
    }

    /**
     * Force evolve quest (for testing)
     */
    async forceEvolveQuest(questId, triggerType, triggerData) {
        return await this.evolveQuest(questId, { type: triggerType, ...triggerData });
    }

    /**
     * Export quest data for GitHub saves
     */
    exportQuestData() {
        return {
            activeQuests: Object.fromEntries(this.activeQuests),
            completedQuests: Object.fromEntries(this.completedQuests),
            failedQuests: Object.fromEntries(this.failedQuests),
            retiredQuests: Object.fromEntries(this.retiredQuests),
            emergentQuests: Object.fromEntries(this.emergentQuests),
            questConnections: Object.fromEntries(this.questConnections),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Import quest data from GitHub saves
     */
    async importQuestData(data) {
        if (data.activeQuests) {
            this.activeQuests = new Map(Object.entries(data.activeQuests));
        }
        if (data.completedQuests) {
            this.completedQuests = new Map(Object.entries(data.completedQuests));
        }
        if (data.failedQuests) {
            this.failedQuests = new Map(Object.entries(data.failedQuests));
        }
        if (data.retiredQuests) {
            this.retiredQuests = new Map(Object.entries(data.retiredQuests));
        }
        if (data.emergentQuests) {
            this.emergentQuests = new Map(Object.entries(data.emergentQuests));
        }
        if (data.questConnections) {
            this.questConnections = new Map(Object.entries(data.questConnections));
        }
        
        console.log('🗞️ Imported dynamic quest system data from save');
    }
}