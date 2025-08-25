export default class AIDMIntegration {
    constructor(core) {
        this.core = core;
        this.worldDatabase = null;
        this.relationshipSystem = null;
        this.monsterDatabase = null;
        this.characterSheet = null;
        this.campaignManager = null;
        
        // AI DM state and safety mechanisms
        this.contextCache = new Map();
        this.safetyLocks = {
            maxEntitiesPerRequest: 5,
            maxRelationshipChanges: 10,
            validateEntityCreation: true,
            requireConfirmation: false
        };
        
        // Context management
        this.contextPriorities = {
            critical: ['currentLocation', 'partyStatus', 'activeQuests'],
            important: ['recentEvents', 'relationships', 'knownNPCs'],
            supplementary: ['worldHistory', 'factionStatus', 'discoveredMonsters']
        };
        
        this.tokenLimits = {
            totalContext: 4000,
            worldState: 1200,
            relationships: 800,
            history: 600,
            quests: 400,
            emergency: 200 // Reserved for critical updates
        };

        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.relationshipSystem = this.core.getModule('relationshipSystem');
            this.monsterDatabase = this.core.getModule('monsterDatabase');
            this.characterSheet = this.core.getModule('characterSheet');
            this.campaignManager = this.core.getModule('campaignManager');
            
            console.log('🤖 AI DM Integration initialized');
        });

        // Listen for events that should update AI context
        this.core.on('relationship:changed', (event) => {
            this.invalidateContextCache(['relationships', 'worldState']);
        });

        this.core.on('quest:updated', (event) => {
            this.invalidateContextCache(['quests', 'worldState']);
        });

        this.core.on('location:changed', (event) => {
            this.invalidateContextCache(['currentLocation', 'worldState']);
        });

        this.core.on('monster:encountered', (event) => {
            this.invalidateContextCache(['recentEvents']);
        });
    }

    // ===== CONTEXT BUILDING SYSTEM =====

    /**
     * Build comprehensive context for AI DM with token management
     * @param {string} situationType - Type of situation (combat, social, exploration, etc.)
     * @param {Object} options - Context building options
     * @returns {Object} Structured context for AI DM
     */
    async buildAIDMContext(situationType = 'general', options = {}) {
        const {
            includeHistory = true,
            maxHistoryItems = 10,
            prioritizeRecent = true,
            location = null,
            specificNPCs = []
        } = options;

        // Start with critical context that's always included
        const context = {
            metadata: {
                situationType,
                timestamp: new Date().toISOString(),
                tokenBudget: this.tokenLimits.totalContext,
                safetyEnabled: true
            },
            critical: await this.buildCriticalContext(),
            tokenUsage: { critical: 0, important: 0, supplementary: 0 }
        };

        // Calculate tokens used by critical context
        context.tokenUsage.critical = this.estimateTokens(JSON.stringify(context.critical));

        // Build important context if we have token budget
        const remainingTokens = this.tokenLimits.totalContext - context.tokenUsage.critical;
        if (remainingTokens > this.tokenLimits.emergency) {
            context.important = await this.buildImportantContext(remainingTokens / 2, {
                situationType,
                location,
                specificNPCs,
                includeHistory,
                maxHistoryItems
            });
            context.tokenUsage.important = this.estimateTokens(JSON.stringify(context.important));
        }

        // Build supplementary context if budget allows
        const finalRemaining = remainingTokens - context.tokenUsage.important;
        if (finalRemaining > this.tokenLimits.emergency) {
            context.supplementary = await this.buildSupplementaryContext(finalRemaining, {
                situationType,
                prioritizeRecent
            });
            context.tokenUsage.supplementary = this.estimateTokens(JSON.stringify(context.supplementary));
        }

        // Add AI instruction context
        context.instructions = this.buildAIInstructions(situationType);
        
        console.log(`🧠 Built AI context: ${context.tokenUsage.critical + context.tokenUsage.important + context.tokenUsage.supplementary} estimated tokens`);
        
        return context;
    }

    /**
     * Build critical context that must always be included
     */
    async buildCriticalContext() {
        const currentLocation = this.getCurrentLocation();
        const partyStatus = this.getPartyStatus();
        const activeQuests = this.getActiveQuests();

        return {
            currentLocation: currentLocation ? {
                id: currentLocation.id,
                name: currentLocation.name,
                type: currentLocation.type,
                description: currentLocation.description?.substring(0, 200) + '...',
                connections: currentLocation.connections || [],
                npcs: currentLocation.npcs || [],
                monsters: currentLocation.monsters || [],
                factions: currentLocation.factions || []
            } : null,
            
            partyStatus: {
                size: partyStatus.size,
                level: partyStatus.averageLevel,
                health: partyStatus.healthStatus,
                resources: partyStatus.resources,
                activeEffects: partyStatus.activeEffects || [],
                currentObjective: partyStatus.currentObjective || null
            },
            
            activeQuests: activeQuests.map(quest => ({
                id: quest.id,
                title: quest.title,
                status: quest.status,
                priority: quest.priority || 'normal',
                currentStep: quest.currentStep,
                location: quest.location,
                summary: quest.description?.substring(0, 150) + '...'
            }))
        };
    }

    /**
     * Build important context with token budgeting
     */
    async buildImportantContext(tokenBudget, options) {
        const { situationType, location, specificNPCs, includeHistory, maxHistoryItems } = options;
        
        const context = {
            relationships: null,
            recentEvents: null,
            relevantNPCs: null,
            locationDetails: null
        };

        let usedTokens = 0;
        const quarterBudget = Math.floor(tokenBudget / 4);

        // Relationships (highest priority for social situations)
        if (usedTokens < tokenBudget) {
            const relationships = await this.getRelevantRelationships(situationType, location, specificNPCs);
            const relationshipContext = this.summarizeRelationships(relationships, quarterBudget);
            context.relationships = relationshipContext;
            usedTokens += this.estimateTokens(JSON.stringify(relationshipContext));
        }

        // Recent events
        if (usedTokens < tokenBudget && includeHistory) {
            const events = await this.getRecentEvents(maxHistoryItems, location);
            const eventContext = this.summarizeEvents(events, quarterBudget);
            context.recentEvents = eventContext;
            usedTokens += this.estimateTokens(JSON.stringify(eventContext));
        }

        // Relevant NPCs
        if (usedTokens < tokenBudget) {
            const npcs = await this.getRelevantNPCs(location, specificNPCs);
            const npcContext = this.summarizeNPCs(npcs, quarterBudget);
            context.relevantNPCs = npcContext;
            usedTokens += this.estimateTokens(JSON.stringify(npcContext));
        }

        // Enhanced location details
        if (usedTokens < tokenBudget && location) {
            const locationDetails = await this.getEnhancedLocationContext(location);
            context.locationDetails = locationDetails;
        }

        return context;
    }

    /**
     * Build supplementary context
     */
    async buildSupplementaryContext(tokenBudget, options) {
        const { situationType, prioritizeRecent } = options;
        
        return {
            worldHistory: await this.getWorldHistorySummary(tokenBudget / 3),
            factionStatus: await this.getFactionStatusSummary(tokenBudget / 3),
            discoveredMonsters: await this.getRelevantMonsterKnowledge(tokenBudget / 3),
            weatherAndTime: this.getEnvironmentalContext()
        };
    }

    // ===== ENTITY CREATION SYSTEM =====

    /**
     * Process AI DM response and extract entity creation commands
     * @param {string} aiResponse - Raw AI DM response
     * @returns {Object} Processed response with entity changes
     */
    async processAIDMResponse(aiResponse) {
        const results = {
            processedResponse: aiResponse,
            entitiesCreated: [],
            relationshipsUpdated: [],
            questsUpdated: [],
            errorsEncountered: [],
            warnings: []
        };

        try {
            // Extract and process entity creation tags
            const entityMatches = aiResponse.match(/\[NEW_(\w+):\s*([^\]]+)\]/g) || [];
            
            for (const match of entityMatches) {
                try {
                    const entityResult = await this.processEntityCreation(match);
                    if (entityResult.success) {
                        results.entitiesCreated.push(entityResult);
                        // Remove the tag from the response
                        results.processedResponse = results.processedResponse.replace(match, entityResult.replacementText || '');
                    } else {
                        results.errorsEncountered.push(`Entity creation failed: ${entityResult.error}`);
                    }
                } catch (error) {
                    results.errorsEncountered.push(`Entity processing error: ${error.message}`);
                }
            }

            // Extract and process relationship updates
            const relationshipMatches = aiResponse.match(/\[UPDATE_RELATIONSHIP:\s*([^\]]+)\]/g) || [];
            
            for (const match of relationshipMatches) {
                try {
                    const relationshipResult = await this.processRelationshipUpdate(match);
                    if (relationshipResult.success) {
                        results.relationshipsUpdated.push(relationshipResult);
                        // Remove the tag from the response
                        results.processedResponse = results.processedResponse.replace(match, '');
                    } else {
                        results.warnings.push(`Relationship update issue: ${relationshipResult.warning}`);
                    }
                } catch (error) {
                    results.warnings.push(`Relationship processing error: ${error.message}`);
                }
            }

            // Extract and process quest updates
            const questMatches = aiResponse.match(/\[UPDATE_QUEST:\s*([^\]]+)\]/g) || [];
            
            for (const match of questMatches) {
                try {
                    const questResult = await this.processQuestUpdate(match);
                    if (questResult.success) {
                        results.questsUpdated.push(questResult);
                        results.processedResponse = results.processedResponse.replace(match, '');
                    } else {
                        results.warnings.push(`Quest update issue: ${questResult.warning}`);
                    }
                } catch (error) {
                    results.warnings.push(`Quest processing error: ${error.message}`);
                }
            }

            // Validate consistency
            await this.validateResponseConsistency(results);

        } catch (error) {
            results.errorsEncountered.push(`Response processing failed: ${error.message}`);
        }

        // Log results for debugging
        this.logProcessingResults(results);

        return results;
    }

    /**
     * Process individual entity creation command
     */
    async processEntityCreation(tagMatch) {
        const tagRegex = /\[NEW_(\w+):\s*([^|]+)(?:\|\s*([^|]+))?(?:\|\s*([^\]]+))?\]/;
        const matches = tagMatch.match(tagRegex);
        
        if (!matches) {
            return { success: false, error: 'Invalid entity tag format' };
        }

        const [, entityType, name, role, description] = matches;
        
        try {
            switch (entityType.toUpperCase()) {
                case 'CHARACTER':
                case 'NPC':
                    return await this.createNPC(name.trim(), role?.trim(), description?.trim());
                    
                case 'LOCATION':
                    return await this.createLocation(name.trim(), role?.trim(), description?.trim());
                    
                case 'MONSTER':
                    return await this.createMonster(name.trim(), role?.trim(), description?.trim());
                    
                case 'FACTION':
                    return await this.createFaction(name.trim(), role?.trim(), description?.trim());
                    
                case 'QUEST':
                    return await this.createQuest(name.trim(), role?.trim(), description?.trim());
                    
                default:
                    return { success: false, error: `Unknown entity type: ${entityType}` };
            }
        } catch (error) {
            return { success: false, error: `Entity creation failed: ${error.message}` };
        }
    }

    /**
     * Create new NPC with validation
     */
    async createNPC(name, role = 'Unknown', description = '') {
        if (!this.worldDatabase) {
            return { success: false, error: 'World database not available' };
        }

        // Validation
        if (name.length < 2 || name.length > 50) {
            return { success: false, error: 'NPC name must be 2-50 characters' };
        }

        // Check if NPC already exists
        const existingNPC = await this.worldDatabase.findEntityByName('npcs', name);
        if (existingNPC) {
            return { 
                success: true, 
                entityId: existingNPC.id,
                replacementText: name,
                message: `Referenced existing NPC: ${name}`,
                wasExisting: true
            };
        }

        // Create new NPC
        const npcData = {
            name,
            role,
            description: description || `A ${role.toLowerCase()} encountered during the adventure.`,
            createdBy: 'AI_DM',
            createdAt: new Date().toISOString(),
            location: this.getCurrentLocation()?.id || null,
            relationships: [],
            questConnections: [],
            personalityTraits: this.generateBasicPersonality(role),
            status: 'active'
        };

        const npcId = await this.worldDatabase.addEntity('npcs', npcData);
        
        // Initialize relationship entry
        if (this.relationshipSystem) {
            await this.relationshipSystem.initializeNPCRelationship(npcId, {
                trustLevel: 50, // Neutral starting point
                firstMeeting: new Date().toISOString(),
                location: npcData.location
            });
        }

        return {
            success: true,
            entityId: npcId,
            entityType: 'npc',
            replacementText: name,
            message: `Created new NPC: ${name} (${role})`,
            wasExisting: false
        };
    }

    /**
     * Create new location with validation
     */
    async createLocation(name, type = 'Unknown', description = '') {
        if (!this.worldDatabase) {
            return { success: false, error: 'World database not available' };
        }

        // Check if location already exists
        const existingLocation = await this.worldDatabase.findEntityByName('locations', name);
        if (existingLocation) {
            return { 
                success: true, 
                entityId: existingLocation.id,
                replacementText: name,
                message: `Referenced existing location: ${name}`,
                wasExisting: true
            };
        }

        // Create new location
        const locationData = {
            name,
            type: type || 'area',
            description: description || `A ${type.toLowerCase()} discovered during the adventure.`,
            createdBy: 'AI_DM',
            createdAt: new Date().toISOString(),
            connections: [],
            npcs: [],
            monsters: [],
            factions: [],
            quests: [],
            discoveredBy: this.core.appState.character?.id || 'party',
            explorationLevel: 'basic'
        };

        const locationId = await this.worldDatabase.addEntity('locations', locationData);

        return {
            success: true,
            entityId: locationId,
            entityType: 'location',
            replacementText: name,
            message: `Created new location: ${name} (${type})`,
            wasExisting: false
        };
    }

    /**
     * Create new monster encounter
     */
    async createMonster(name, challengeLevel = '1', description = '') {
        if (!this.monsterDatabase) {
            return { success: false, error: 'Monster database not available' };
        }

        // Check if monster type already exists
        const existingMonster = this.monsterDatabase.findMonsterByName(name);
        if (existingMonster) {
            // Create encounter with existing monster
            const encounterId = await this.monsterDatabase.recordEncounter({
                monsterId: existingMonster,
                location: this.getCurrentLocation()?.id || 'unknown',
                encounterType: 'story_encounter',
                outcome: 'ongoing',
                partyLevel: this.getPartyStatus().averageLevel
            });

            return {
                success: true,
                entityId: encounterId,
                entityType: 'encounter',
                replacementText: name,
                message: `Created encounter with existing monster: ${name}`,
                wasExisting: true
            };
        }

        // Create new monster type
        const cr = this.parseChallengeRating(challengeLevel);
        const monsterData = {
            name,
            challengeRating: cr,
            description,
            createdBy: 'AI_DM',
            type: 'humanoid', // Default, AI should specify if needed
            size: 'Medium', // Default
            // Basic stats will be generated by monster database
            str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
        };

        const monsterId = await this.monsterDatabase.createMonster(monsterData);
        
        // Create immediate encounter
        const encounterId = await this.monsterDatabase.recordEncounter({
            monsterId: monsterId,
            location: this.getCurrentLocation()?.id || 'unknown',
            encounterType: 'story_encounter',
            outcome: 'ongoing',
            partyLevel: this.getPartyStatus().averageLevel
        });

        return {
            success: true,
            entityId: encounterId,
            entityType: 'encounter',
            replacementText: name,
            message: `Created new monster encounter: ${name} (CR ${cr})`,
            wasExisting: false
        };
    }

    // ===== RELATIONSHIP PROCESSING =====

    /**
     * Process relationship update commands
     */
    async processRelationshipUpdate(tagMatch) {
        const tagRegex = /\[UPDATE_RELATIONSHIP:\s*([^|]+)(?:\|\s*([^|]+))?(?:\|\s*([^\]]+))?\]/;
        const matches = tagMatch.match(tagRegex);
        
        if (!matches) {
            return { success: false, warning: 'Invalid relationship update format' };
        }

        const [, target, change, reason] = matches;
        
        if (!this.relationshipSystem) {
            return { success: false, warning: 'Relationship system not available' };
        }

        try {
            const changeValue = parseInt(change) || 0;
            if (Math.abs(changeValue) > 50) {
                return { success: false, warning: 'Relationship change too large (max ±50)' };
            }

            // Find target NPC
            const npc = await this.worldDatabase.findEntityByName('npcs', target.trim());
            if (!npc) {
                return { success: false, warning: `NPC "${target}" not found for relationship update` };
            }

            // Apply relationship change
            const result = await this.relationshipSystem.updateIndividualRelationship(
                npc.id,
                changeValue,
                reason?.trim() || 'Story progression',
                this.getCurrentLocation()?.id
            );

            return {
                success: true,
                target: npc.name,
                change: changeValue,
                reason: reason?.trim(),
                newLevel: result.newTrustLevel,
                message: `${npc.name} relationship ${changeValue > 0 ? 'improved' : 'decreased'} by ${Math.abs(changeValue)}`
            };

        } catch (error) {
            return { success: false, warning: `Relationship update error: ${error.message}` };
        }
    }

    // ===== CONTEXT HELPERS =====

    /**
     * Get current location from campaign state
     */
    getCurrentLocation() {
        return this.campaignManager?.getCurrentLocation() || null;
    }

    /**
     * Get party status summary
     */
    getPartyStatus() {
        const character = this.characterSheet?.getCharacterData();
        return {
            size: 1, // Single character for now
            averageLevel: character?.level || 1,
            healthStatus: character?.currentHP ? 'healthy' : 'unknown',
            resources: {
                hp: character?.currentHP || 0,
                maxHP: character?.maxHP || 0,
                spellSlots: character?.spellSlots || {},
                gold: character?.gold || 0
            },
            activeEffects: character?.activeEffects || [],
            currentObjective: this.campaignManager?.getCurrentObjective() || null
        };
    }

    /**
     * Get active quests summary
     */
    getActiveQuests() {
        if (!this.worldDatabase) return [];
        
        return this.worldDatabase.getEntitiesByType('quests')
            .filter(quest => quest.status === 'active' || quest.status === 'in_progress')
            .sort((a, b) => {
                const priorityOrder = { 'critical': 0, 'high': 1, 'normal': 2, 'low': 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
    }

    /**
     * Get relevant relationships for current context
     */
    async getRelevantRelationships(situationType, location, specificNPCs = []) {
        if (!this.relationshipSystem) return [];

        let relationships = [];

        // Always include specific NPCs if mentioned
        for (const npcName of specificNPCs) {
            const npc = await this.worldDatabase.findEntityByName('npcs', npcName);
            if (npc) {
                const relationship = this.relationshipSystem.getIndividualRelationship(npc.id);
                if (relationship) {
                    relationships.push({ npc, relationship });
                }
            }
        }

        // Add location-based relationships
        if (location) {
            const locationData = await this.worldDatabase.getEntity('locations', location);
            if (locationData?.npcs) {
                for (const npcId of locationData.npcs) {
                    const relationship = this.relationshipSystem.getIndividualRelationship(npcId);
                    const npc = await this.worldDatabase.getEntity('npcs', npcId);
                    if (relationship && npc) {
                        relationships.push({ npc, relationship });
                    }
                }
            }
        }

        // Add significant relationships (very high or very low trust)
        const allRelationships = this.relationshipSystem.getAllIndividualRelationships();
        for (const [npcId, relationship] of allRelationships) {
            if (Math.abs(relationship.trustLevel - 50) > 30) { // Significant deviation from neutral
                const npc = await this.worldDatabase.getEntity('npcs', npcId);
                if (npc && !relationships.some(r => r.npc.id === npcId)) {
                    relationships.push({ npc, relationship });
                }
            }
        }

        return relationships;
    }

    /**
     * Estimate token count for text (rough approximation)
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4); // Rough approximation: 4 characters per token
    }

    /**
     * Generate AI instructions based on situation type
     */
    buildAIInstructions(situationType) {
        const baseInstructions = `
        You are an AI Dungeon Master for a D&D 5e adventure. Use the provided context to make informed decisions.
        
        ENTITY CREATION: Use tags when creating new entities:
        - [NEW_CHARACTER: Name | Role | Description] - for NPCs
        - [NEW_LOCATION: Name | Type | Description] - for places
        - [NEW_MONSTER: Name | Challenge Level | Description] - for creatures
        
        RELATIONSHIP UPDATES: Use tags for relationship changes:
        - [UPDATE_RELATIONSHIP: NPC Name | Change (+/-) | Reason]
        
        QUEST UPDATES: Use tags for quest progression:
        - [UPDATE_QUEST: Quest Name | New Status | Details]
        
        SAFETY RULES:
        - Don't create more than 3 new entities per response
        - Keep relationship changes reasonable (-20 to +20)
        - Reference existing world information when possible
        - Maintain consistency with established lore
        `;

        const situationSpecific = {
            combat: "Focus on tactical descriptions and monster abilities. Reference known monster weaknesses.",
            social: "Prioritize relationship context and NPC motivations. Consider faction standings.",
            exploration: "Emphasize environmental details and potential discoveries.",
            general: "Balance all aspects while maintaining narrative flow."
        };

        return baseInstructions + "\n" + (situationSpecific[situationType] || situationSpecific.general);
    }

    /**
     * Invalidate context cache for specific categories
     */
    invalidateContextCache(categories) {
        categories.forEach(category => {
            this.contextCache.delete(category);
        });
        console.log(`🔄 Invalidated AI context cache: ${categories.join(', ')}`);
    }

    /**
     * Generate basic personality traits for new NPCs
     */
    generateBasicPersonality(role) {
        const personalities = {
            'guard': ['dutiful', 'vigilant', 'protective'],
            'merchant': ['shrewd', 'friendly', 'profit-minded'],
            'noble': ['proud', 'educated', 'influential'],
            'commoner': ['humble', 'hardworking', 'practical'],
            'scholar': ['curious', 'knowledgeable', 'methodical'],
            'default': ['cautious', 'observant', 'adaptive']
        };

        return personalities[role.toLowerCase()] || personalities.default;
    }

    /**
     * Parse challenge rating from string
     */
    parseChallengeRating(challengeLevel) {
        const cr = parseFloat(challengeLevel);
        if (isNaN(cr)) return 0.125;
        return Math.max(0, Math.min(30, cr)); // Clamp between 0 and 30
    }

    /**
     * Log processing results for debugging
     */
    logProcessingResults(results) {
        if (results.entitiesCreated.length > 0) {
            console.log(`🎭 AI DM created ${results.entitiesCreated.length} entities:`, 
                results.entitiesCreated.map(e => `${e.entityType}: ${e.message}`));
        }
        
        if (results.relationshipsUpdated.length > 0) {
            console.log(`💫 AI DM updated ${results.relationshipsUpdated.length} relationships:`,
                results.relationshipsUpdated.map(r => r.message));
        }
        
        if (results.errorsEncountered.length > 0) {
            console.warn(`⚠️ AI DM processing errors:`, results.errorsEncountered);
        }
    }

    // ===== ENHANCED CONTEXT BUILDERS =====

    /**
     * Get recent events relevant to current situation
     */
    async getRecentEvents(maxItems = 10, locationFilter = null) {
        if (!this.worldDatabase) return [];

        // Get interaction history, quest updates, relationship changes
        const events = [];

        // Recent relationship changes
        if (this.relationshipSystem) {
            const relationshipHistory = this.relationshipSystem.getRelationshipHistory()
                .slice(-maxItems)
                .map(event => ({
                    type: 'relationship',
                    timestamp: event.timestamp,
                    description: `${event.npcName}: ${event.reason} (${event.change > 0 ? '+' : ''}${event.change})`,
                    location: event.location,
                    importance: Math.abs(event.change)
                }));
            events.push(...relationshipHistory);
        }

        // Recent monster encounters
        if (this.monsterDatabase) {
            const encounters = this.monsterDatabase.getAllEncounters()
                .slice(-maxItems)
                .map(encounter => ({
                    type: 'encounter',
                    timestamp: encounter.timestamp,
                    description: `Encountered ${encounter.monsterName} at ${encounter.location} - ${encounter.outcome}`,
                    location: encounter.location,
                    importance: encounter.outcome === 'victory' ? 8 : 5
                }));
            events.push(...encounters);
        }

        // Recent quest updates
        const quests = this.getActiveQuests();
        const questEvents = quests
            .filter(quest => quest.lastUpdated)
            .map(quest => ({
                type: 'quest',
                timestamp: quest.lastUpdated,
                description: `Quest "${quest.title}": ${quest.status} - ${quest.currentStep || 'In progress'}`,
                location: quest.location,
                importance: quest.priority === 'critical' ? 10 : quest.priority === 'high' ? 8 : 5
            }));
        events.push(...questEvents);

        // Sort by timestamp and importance
        return events
            .filter(event => !locationFilter || event.location === locationFilter)
            .sort((a, b) => {
                const timeSort = new Date(b.timestamp) - new Date(a.timestamp);
                const importanceSort = (b.importance || 0) - (a.importance || 0);
                return timeSort + (importanceSort * 100); // Importance weighted higher than recency
            })
            .slice(0, maxItems);
    }

    /**
     * Get relevant NPCs for current context
     */
    async getRelevantNPCs(locationId = null, specificNPCs = []) {
        if (!this.worldDatabase) return [];

        const npcs = [];
        const currentLocation = locationId || this.getCurrentLocation()?.id;

        // Add NPCs at current location
        if (currentLocation) {
            const location = await this.worldDatabase.getEntity('locations', currentLocation);
            if (location?.npcs) {
                for (const npcId of location.npcs) {
                    const npc = await this.worldDatabase.getEntity('npcs', npcId);
                    if (npc) npcs.push(npc);
                }
            }
        }

        // Add specifically mentioned NPCs
        for (const npcName of specificNPCs) {
            const npc = await this.worldDatabase.findEntityByName('npcs', npcName);
            if (npc && !npcs.some(n => n.id === npc.id)) {
                npcs.push(npc);
            }
        }

        // Add NPCs with significant relationships
        if (this.relationshipSystem) {
            const significantRelationships = this.relationshipSystem.queryForAIDM('all', { threshold: 30 });
            for (const rel of significantRelationships) {
                const npc = await this.worldDatabase.getEntity('npcs', rel.npcId);
                if (npc && !npcs.some(n => n.id === npc.id)) {
                    npcs.push(npc);
                }
            }
        }

        return npcs;
    }

    /**
     * Get enhanced location context
     */
    async getEnhancedLocationContext(locationId) {
        if (!this.worldDatabase) return null;

        const location = await this.worldDatabase.getEntity('locations', locationId);
        if (!location) return null;

        // Get connected locations
        const connections = [];
        if (location.connections) {
            for (const connectionId of location.connections) {
                const connectedLocation = await this.worldDatabase.getEntity('locations', connectionId);
                if (connectedLocation) {
                    connections.push({
                        id: connectedLocation.id,
                        name: connectedLocation.name,
                        type: connectedLocation.type,
                        distance: 'nearby' // Could be enhanced with actual distance data
                    });
                }
            }
        }

        // Get faction presence
        const factionPresence = [];
        if (location.factions && this.relationshipSystem) {
            for (const factionId of location.factions) {
                const factionRep = this.relationshipSystem.getFactionReputation(factionId);
                if (factionRep) {
                    factionPresence.push({
                        name: factionRep.name,
                        reputation: factionRep.reputation,
                        influence: factionRep.influence || 'moderate'
                    });
                }
            }
        }

        // Get recent activity
        const recentActivity = await this.getRecentEvents(5, locationId);

        return {
            ...location,
            connections,
            factionPresence,
            recentActivity,
            dangerLevel: this.assessLocationDanger(location),
            explorationOpportunities: this.getExplorationOpportunities(location)
        };
    }

    /**
     * Get world history summary
     */
    async getWorldHistorySummary(tokenBudget) {
        if (!this.worldDatabase) return null;

        const campaigns = this.worldDatabase.getEntitiesByType('campaigns') || [];
        const majorEvents = [];

        for (const campaign of campaigns) {
            if (campaign.majorEvents) {
                majorEvents.push(...campaign.majorEvents.map(event => ({
                    ...event,
                    campaign: campaign.name
                })));
            }
        }

        // Sort by importance and recency
        const importantEvents = majorEvents
            .sort((a, b) => {
                const importanceScore = (b.importance || 0) - (a.importance || 0);
                const recencyScore = new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
                return importanceScore + (recencyScore / 1000000); // Weight importance higher
            })
            .slice(0, 5); // Limit to most important events

        return {
            totalCampaigns: campaigns.length,
            majorEvents: importantEvents,
            worldState: campaigns.find(c => c.isActive)?.worldState || 'stable'
        };
    }

    /**
     * Get faction status summary
     */
    async getFactionStatusSummary(tokenBudget) {
        if (!this.relationshipSystem) return null;

        const factionData = this.relationshipSystem.getAllFactionReputations();
        const factionSummary = [];

        for (const [factionId, reputation] of factionData) {
            const faction = await this.worldDatabase.getEntity('factions', factionId);
            if (faction) {
                factionSummary.push({
                    name: faction.name,
                    reputation: reputation.reputation,
                    relationship: this.getReputationLevel(reputation.reputation),
                    influence: faction.influence || 'moderate',
                    territory: faction.territory || [],
                    goals: faction.goals || []
                });
            }
        }

        return {
            factions: factionSummary.slice(0, 8), // Limit for token budget
            conflicts: this.getActiveFactionConflicts(factionSummary),
            opportunities: this.getFactionOpportunities(factionSummary)
        };
    }

    /**
     * Get relevant monster knowledge
     */
    async getRelevantMonsterKnowledge(tokenBudget) {
        if (!this.monsterDatabase) return null;

        const knownMonsters = this.monsterDatabase.getEncounteredMonsters();
        const locationMonsters = this.getLocationMonsters();

        return {
            encountered: knownMonsters.slice(0, 5).map(monster => ({
                name: monster.name,
                challengeRating: monster.challengeRating,
                knowledgeLevel: monster.playerKnowledge.discoveryLevel,
                lastSeen: monster.playerKnowledge.lastEncounter,
                knownWeaknesses: monster.playerKnowledge.knownWeaknesses || []
            })),
            nearbyThreats: locationMonsters,
            totalDiscovered: knownMonsters.length
        };
    }

    /**
     * Get environmental context (time, weather, etc.)
     */
    getEnvironmentalContext() {
        const campaign = this.campaignManager?.getCurrentCampaign();
        return {
            timeOfDay: campaign?.timeOfDay || 'day',
            weather: campaign?.weather || 'clear',
            season: campaign?.season || 'spring',
            mood: campaign?.overallMood || 'neutral'
        };
    }

    // ===== HELPER FUNCTIONS =====

    /**
     * Summarize relationships for AI context
     */
    summarizeRelationships(relationships, tokenBudget) {
        const summary = relationships.map(({ npc, relationship }) => {
            const trustLevel = relationship.trustLevel;
            const relationshipType = this.getRelationshipType(trustLevel);
            
            return {
                name: npc.name,
                role: npc.role,
                trust: trustLevel,
                relationship: relationshipType,
                lastInteraction: relationship.lastInteraction,
                keyTraits: relationship.knownTraits || [],
                location: npc.location
            };
        });

        // Sort by importance (extreme relationships first)
        return summary
            .sort((a, b) => Math.abs(b.trust - 50) - Math.abs(a.trust - 50))
            .slice(0, Math.floor(tokenBudget / 100)); // Estimate ~100 tokens per relationship
    }

    /**
     * Summarize events for AI context
     */
    summarizeEvents(events, tokenBudget) {
        return {
            recent: events.slice(0, Math.floor(tokenBudget / 80)), // ~80 tokens per event
            patterns: this.identifyEventPatterns(events),
            significance: events.filter(e => (e.importance || 0) > 7).length
        };
    }

    /**
     * Summarize NPCs for AI context
     */
    summarizeNPCs(npcs, tokenBudget) {
        return npcs
            .slice(0, Math.floor(tokenBudget / 120)) // ~120 tokens per NPC
            .map(npc => ({
                name: npc.name,
                role: npc.role,
                location: npc.location,
                status: npc.status,
                keyTraits: npc.personalityTraits || [],
                questConnections: (npc.questConnections || []).length,
                relationship: this.relationshipSystem?.getIndividualRelationship(npc.id)?.trustLevel || 50
            }));
    }

    /**
     * Process quest update commands
     */
    async processQuestUpdate(tagMatch) {
        const tagRegex = /\[UPDATE_QUEST:\s*([^|]+)(?:\|\s*([^|]+))?(?:\|\s*([^\]]+))?\]/;
        const matches = tagMatch.match(tagRegex);
        
        if (!matches) {
            return { success: false, warning: 'Invalid quest update format' };
        }

        const [, questName, newStatus, details] = matches;
        
        if (!this.worldDatabase) {
            return { success: false, warning: 'World database not available' };
        }

        try {
            // Find quest by name
            const quest = await this.worldDatabase.findEntityByName('quests', questName.trim());
            if (!quest) {
                return { success: false, warning: `Quest "${questName}" not found` };
            }

            // Update quest
            const updateData = {
                lastUpdated: new Date().toISOString()
            };

            if (newStatus) {
                updateData.status = newStatus.trim();
            }

            if (details) {
                updateData.currentStep = details.trim();
                updateData.history = quest.history || [];
                updateData.history.push({
                    timestamp: new Date().toISOString(),
                    action: 'ai_update',
                    details: details.trim(),
                    status: newStatus?.trim() || quest.status
                });
            }

            await this.worldDatabase.updateEntity('quests', quest.id, updateData);

            return {
                success: true,
                questName: quest.title,
                oldStatus: quest.status,
                newStatus: newStatus?.trim() || quest.status,
                details: details?.trim(),
                message: `Updated quest "${quest.title}" to ${newStatus || quest.status}`
            };

        } catch (error) {
            return { success: false, warning: `Quest update error: ${error.message}` };
        }
    }

    /**
     * Validate response consistency
     */
    async validateResponseConsistency(results) {
        // Check for contradictory relationship changes
        const relationshipChanges = results.relationshipsUpdated;
        for (let i = 0; i < relationshipChanges.length; i++) {
            for (let j = i + 1; j < relationshipChanges.length; j++) {
                if (relationshipChanges[i].target === relationshipChanges[j].target) {
                    const totalChange = relationshipChanges[i].change + relationshipChanges[j].change;
                    if (Math.abs(totalChange) > 50) {
                        results.warnings.push(`Large total relationship change for ${relationshipChanges[i].target}: ${totalChange}`);
                    }
                }
            }
        }

        // Check entity creation limits
        if (results.entitiesCreated.length > this.safetyLocks.maxEntitiesPerRequest) {
            results.warnings.push(`Created ${results.entitiesCreated.length} entities (limit: ${this.safetyLocks.maxEntitiesPerRequest})`);
        }
    }

    /**
     * Assess location danger level
     */
    assessLocationDanger(location) {
        let dangerScore = 0;

        // Check for hostile factions
        if (location.factions && this.relationshipSystem) {
            for (const factionId of location.factions) {
                const rep = this.relationshipSystem.getFactionReputation(factionId);
                if (rep && rep.reputation < -25) dangerScore += 2;
            }
        }

        // Check for dangerous monsters
        if (location.monsters) {
            dangerScore += location.monsters.length;
        }

        // Check recent hostile encounters
        const recentEvents = this.getRecentEvents(5, location.id);
        const hostileEvents = recentEvents.filter(e => 
            e.type === 'encounter' && e.description.includes('combat')
        );
        dangerScore += hostileEvents.length;

        if (dangerScore >= 5) return 'high';
        if (dangerScore >= 2) return 'moderate';
        return 'low';
    }

    /**
     * Get exploration opportunities for location
     */
    getExplorationOpportunities(location) {
        const opportunities = [];

        if (location.type === 'dungeon') {
            opportunities.push('Hidden chambers', 'Ancient treasures');
        }
        if (location.type === 'city') {
            opportunities.push('Guild contacts', 'Information networks');
        }
        if (location.type === 'wilderness') {
            opportunities.push('Resource gathering', 'Monster tracking');
        }

        return opportunities;
    }

    /**
     * Get relationship type from trust level
     */
    getRelationshipType(trustLevel) {
        if (trustLevel >= 90) return 'devoted';
        if (trustLevel >= 70) return 'ally';
        if (trustLevel >= 40) return 'friendly';
        if (trustLevel >= 30) return 'neutral';
        if (trustLevel >= 10) return 'unfriendly';
        return 'hostile';
    }

    /**
     * Get reputation level description
     */
    getReputationLevel(reputation) {
        if (reputation >= 75) return 'revered';
        if (reputation >= 50) return 'honored';
        if (reputation >= 25) return 'friendly';
        if (reputation >= -24) return 'neutral';
        if (reputation >= -49) return 'unfriendly';
        return 'hostile';
    }

    /**
     * Get monsters in current location
     */
    getLocationMonsters() {
        const currentLocation = this.getCurrentLocation();
        if (!currentLocation?.monsters || !this.monsterDatabase) return [];

        return currentLocation.monsters.map(monsterId => {
            const monster = this.monsterDatabase.getMonster(monsterId);
            return monster ? {
                name: monster.name,
                challengeRating: monster.challengeRating,
                threat: monster.challengeRating > this.getPartyStatus().averageLevel ? 'high' : 'manageable'
            } : null;
        }).filter(Boolean);
    }

    /**
     * Identify patterns in events
     */
    identifyEventPatterns(events) {
        const patterns = [];
        const eventsByType = {};

        events.forEach(event => {
            if (!eventsByType[event.type]) eventsByType[event.type] = [];
            eventsByType[event.type].push(event);
        });

        // Look for repeated relationship improvements/degradations
        if (eventsByType.relationship) {
            const positiveChanges = eventsByType.relationship.filter(e => e.description.includes('+')).length;
            const negativeChanges = eventsByType.relationship.filter(e => e.description.includes('-')).length;
            
            if (positiveChanges > negativeChanges * 2) {
                patterns.push('Building positive relationships');
            } else if (negativeChanges > positiveChanges * 2) {
                patterns.push('Relationship tensions rising');
            }
        }

        // Look for combat frequency
        if (eventsByType.encounter) {
            const combatEvents = eventsByType.encounter.filter(e => e.description.includes('combat')).length;
            if (combatEvents > events.length * 0.3) {
                patterns.push('High combat activity');
            }
        }

        return patterns;
    }

    /**
     * Get active faction conflicts
     */
    getActiveFactionConflicts(factionSummary) {
        const conflicts = [];
        
        for (let i = 0; i < factionSummary.length; i++) {
            for (let j = i + 1; j < factionSummary.length; j++) {
                const faction1 = factionSummary[i];
                const faction2 = factionSummary[j];
                
                // Look for opposing reputations or conflicting goals
                if ((faction1.reputation > 25 && faction2.reputation < -25) ||
                    (faction1.reputation < -25 && faction2.reputation > 25)) {
                    conflicts.push(`${faction1.name} vs ${faction2.name}`);
                }
            }
        }

        return conflicts.slice(0, 3); // Limit for context
    }

    /**
     * Get faction opportunities
     */
    getFactionOpportunities(factionSummary) {
        return factionSummary
            .filter(faction => faction.reputation > 50)
            .map(faction => `${faction.name} offers enhanced cooperation`)
            .slice(0, 3);
    }

    // ===== PUBLIC API =====

    /**
     * Get comprehensive context for AI DM
     * @param {string} situationType - Current situation type
     * @param {Object} options - Context options
     * @returns {Promise<Object>} AI DM context
     */
    async getAIDMContext(situationType = 'general', options = {}) {
        return await this.buildAIDMContext(situationType, options);
    }

    /**
     * Process AI DM response and apply changes
     * @param {string} response - AI DM response text
     * @returns {Promise<Object>} Processing results
     */
    async processResponse(response) {
        return await this.processAIDMResponse(response);
    }

    /**
     * Get token usage estimate for context
     * @param {Object} context - AI DM context object
     * @returns {number} Estimated tokens
     */
    getTokenEstimate(context) {
        return this.estimateTokens(JSON.stringify(context));
    }

    /**
     * Set safety parameters for AI DM operations
     * @param {Object} safetyConfig - Safety configuration
     */
    configureSafety(safetyConfig) {
        this.safetyLocks = { ...this.safetyLocks, ...safetyConfig };
        console.log('🛡️ AI DM safety configured:', this.safetyLocks);
    }
}