export default class InteractionHistory {
    constructor(core) {
        this.core = core;
        this.worldDatabase = null;
        
        // Interaction tracking
        this.interactionData = {
            conversations: new Map(),  // Conversation threads with NPCs
            gameActions: new Map(),    // Player actions and their outcomes
            aiDMHistory: new Map(),    // AI DM responses and context
            sessionSummaries: new Map() // Session summaries for long-term memory
        };
        
        // Interaction categories for organization
        this.categories = {
            dialogue: 'conversation',
            combat: 'action',
            exploration: 'discovery',
            social: 'relationship',
            quest: 'progression',
            trade: 'commerce',
            magic: 'spellcasting'
        };

        // Memory importance scoring
        this.importanceWeights = {
            questProgression: 10,
            significantCombat: 9,
            majorRelationshipChange: 8,
            newEntityDiscovery: 7,
            importantDialogue: 6,
            factionEvent: 6,
            skillCheck: 3,
            routine: 1
        };

        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.loadInteractionHistory();
            console.log('📜 Interaction History system initialized');
        });

        // Listen for various interaction events
        this.core.on('player:action', (event) => {
            this.recordPlayerAction(event.detail);
        });

        this.core.on('npc:conversation', (event) => {
            this.recordConversation(event.detail);
        });

        this.core.on('ai:response', (event) => {
            this.recordAIResponse(event.detail);
        });

        this.core.on('session:ended', (event) => {
            this.createSessionSummary(event.detail);
        });
    }

    // ===== INTERACTION RECORDING =====

    /**
     * Record a player action with context and outcomes
     */
    recordPlayerAction(actionData) {
        const actionId = this.generateId('action');
        const timestamp = new Date().toISOString();
        
        const action = {
            id: actionId,
            timestamp,
            type: actionData.type || 'unknown',
            category: this.categorizeAction(actionData),
            player: actionData.playerId || 'player',
            location: actionData.location || this.getCurrentLocation()?.id,
            
            // Action details
            description: actionData.description,
            target: actionData.target,
            result: actionData.result,
            consequences: actionData.consequences || [],
            
            // Context
            partyStatus: this.getPartySnapshot(),
            questContext: this.getQuestContext(),
            relationshipChanges: actionData.relationshipChanges || [],
            
            // Importance scoring
            importance: this.calculateActionImportance(actionData),
            tags: actionData.tags || []
        };

        this.interactionData.gameActions.set(actionId, action);
        
        // Trigger related updates
        this.updateRelatedConversations(action);
        
        console.log(`📝 Recorded ${action.category} action: ${action.description}`);
        this.saveInteractionHistory();
    }

    /**
     * Record conversation with an NPC
     */
    recordConversation(conversationData) {
        const npcId = conversationData.npcId;
        const conversationId = conversationData.conversationId || `conv_${npcId}_${Date.now()}`;
        
        // Get or create conversation thread
        let conversation = this.interactionData.conversations.get(conversationId) || {
            id: conversationId,
            npcId: npcId,
            npcName: conversationData.npcName,
            startTime: new Date().toISOString(),
            location: conversationData.location || this.getCurrentLocation()?.id,
            exchanges: [],
            topics: new Set(),
            mood: conversationData.initialMood || 'neutral',
            outcome: 'ongoing',
            relationshipImpact: 0
        };

        // Add new exchange
        const exchange = {
            timestamp: new Date().toISOString(),
            playerInput: conversationData.playerInput,
            npcResponse: conversationData.npcResponse,
            context: conversationData.context,
            mood: conversationData.mood || conversation.mood,
            importance: this.calculateDialogueImportance(conversationData),
            relationshipChange: conversationData.relationshipChange || 0
        };

        conversation.exchanges.push(exchange);
        
        // Update conversation metadata
        if (conversationData.topics) {
            conversationData.topics.forEach(topic => conversation.topics.add(topic));
        }
        
        conversation.lastUpdate = exchange.timestamp;
        conversation.relationshipImpact += exchange.relationshipChange;
        
        if (conversationData.outcome) {
            conversation.outcome = conversationData.outcome;
        }

        this.interactionData.conversations.set(conversationId, conversation);
        
        console.log(`💬 Recorded conversation exchange with ${conversation.npcName}`);
        this.saveInteractionHistory();

        return conversationId;
    }

    /**
     * Record AI DM response and its context
     */
    recordAIResponse(responseData) {
        const responseId = this.generateId('ai_response');
        
        const aiResponse = {
            id: responseId,
            timestamp: new Date().toISOString(),
            
            // AI context used
            contextType: responseData.contextType || 'general',
            contextTokens: responseData.contextTokens || 0,
            worldState: responseData.worldState,
            
            // Response details
            originalResponse: responseData.originalResponse,
            processedResponse: responseData.processedResponse,
            
            // Changes made
            entitiesCreated: responseData.entitiesCreated || [],
            relationshipsUpdated: responseData.relationshipsUpdated || [],
            questsUpdated: responseData.questsUpdated || [],
            
            // Meta information
            responseTime: responseData.responseTime,
            errors: responseData.errors || [],
            warnings: responseData.warnings || []
        };

        this.interactionData.aiDMHistory.set(responseId, aiResponse);
        
        // Update related conversations if this was dialogue
        if (responseData.conversationId) {
            this.linkAIResponseToConversation(responseId, responseData.conversationId);
        }

        this.saveInteractionHistory();
        return responseId;
    }

    // ===== HISTORY QUERYING =====

    /**
     * Get conversation history with specific NPC
     */
    getConversationHistory(npcId, options = {}) {
        const { 
            limit = 10,
            includeContext = true,
            minImportance = 0,
            timeRange = null
        } = options;

        const conversations = Array.from(this.interactionData.conversations.values())
            .filter(conv => conv.npcId === npcId)
            .sort((a, b) => new Date(b.lastUpdate || b.startTime) - new Date(a.lastUpdate || a.startTime));

        let allExchanges = [];
        conversations.forEach(conv => {
            const exchanges = conv.exchanges
                .filter(ex => ex.importance >= minImportance)
                .map(ex => ({
                    ...ex,
                    conversationId: conv.id,
                    npcName: conv.npcName,
                    location: conv.location
                }));
            allExchanges.push(...exchanges);
        });

        // Apply time filtering
        if (timeRange) {
            const cutoffTime = new Date(Date.now() - timeRange);
            allExchanges = allExchanges.filter(ex => 
                new Date(ex.timestamp) > cutoffTime
            );
        }

        // Sort and limit
        allExchanges.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return allExchanges.slice(0, limit);
    }

    /**
     * Get action history for specific location or globally
     */
    getActionHistory(options = {}) {
        const {
            location = null,
            category = null,
            limit = 20,
            minImportance = 0,
            timeRange = null
        } = options;

        let actions = Array.from(this.interactionData.gameActions.values());

        // Apply filters
        if (location) {
            actions = actions.filter(action => action.location === location);
        }
        
        if (category) {
            actions = actions.filter(action => action.category === category);
        }
        
        if (minImportance > 0) {
            actions = actions.filter(action => action.importance >= minImportance);
        }
        
        if (timeRange) {
            const cutoffTime = new Date(Date.now() - timeRange);
            actions = actions.filter(action => 
                new Date(action.timestamp) > cutoffTime
            );
        }

        // Sort by timestamp and importance
        actions.sort((a, b) => {
            const timeSort = new Date(b.timestamp) - new Date(a.timestamp);
            const importanceSort = (b.importance || 0) - (a.importance || 0);
            return timeSort + (importanceSort * 1000);
        });

        return actions.slice(0, limit);
    }

    /**
     * Get relevant history for AI DM context
     */
    getRelevantHistoryForAI(contextOptions = {}) {
        const {
            situationType = 'general',
            currentLocation = null,
            involvedNPCs = [],
            timeWindow = 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
            maxItems = 15
        } = contextOptions;

        const relevantHistory = [];
        const cutoffTime = new Date(Date.now() - timeWindow);

        // Get recent high-importance actions
        const recentActions = this.getActionHistory({
            location: currentLocation,
            minImportance: 5,
            timeRange: timeWindow,
            limit: 8
        });

        relevantHistory.push(...recentActions.map(action => ({
            type: 'action',
            timestamp: action.timestamp,
            summary: `${action.category}: ${action.description}`,
            importance: action.importance,
            location: action.location,
            consequences: action.consequences
        })));

        // Get relevant conversations
        for (const npcName of involvedNPCs) {
            const npc = this.findNPCByName(npcName);
            if (npc) {
                const conversations = this.getConversationHistory(npc.id, {
                    limit: 3,
                    minImportance: 4,
                    timeRange: timeWindow
                });

                relevantHistory.push(...conversations.map(exchange => ({
                    type: 'dialogue',
                    timestamp: exchange.timestamp,
                    summary: `${exchange.npcName}: ${exchange.npcResponse.substring(0, 100)}...`,
                    importance: exchange.importance,
                    location: exchange.location,
                    npc: exchange.npcName
                })));
            }
        }

        // Sort by importance and recency
        relevantHistory.sort((a, b) => {
            const importanceSort = (b.importance || 0) - (a.importance || 0);
            const timeSort = new Date(b.timestamp) - new Date(a.timestamp);
            return importanceSort * 10 + timeSort;
        });

        return relevantHistory.slice(0, maxItems);
    }

    // ===== SESSION MANAGEMENT =====

    /**
     * Create session summary for long-term memory
     */
    createSessionSummary(sessionData) {
        const sessionId = sessionData.sessionId || this.generateId('session');
        const sessionStart = sessionData.startTime || new Date(Date.now() - (3 * 60 * 60 * 1000)); // 3 hours ago default
        const sessionEnd = new Date().toISOString();

        // Gather session data
        const sessionActions = this.getActionHistory({
            timeRange: Date.now() - new Date(sessionStart).getTime(),
            limit: 50
        });

        const sessionConversations = this.getConversationsInTimeRange(sessionStart, sessionEnd);
        const sessionAIResponses = this.getAIResponsesInTimeRange(sessionStart, sessionEnd);

        // Calculate session metrics
        const summary = {
            id: sessionId,
            startTime: sessionStart,
            endTime: sessionEnd,
            duration: new Date(sessionEnd) - new Date(sessionStart),
            
            // Activity summary
            totalActions: sessionActions.length,
            totalConversations: sessionConversations.length,
            totalAIResponses: sessionAIResponses.length,
            
            // Key events
            majorEvents: sessionActions.filter(a => a.importance >= 8),
            significantConversations: sessionConversations.filter(c => 
                c.relationshipImpact !== 0 || c.outcome !== 'routine'
            ),
            
            // World changes
            entitiesCreated: this.getSessionEntityChanges(sessionAIResponses, 'created'),
            relationshipsChanged: this.getSessionRelationshipChanges(sessionActions),
            questProgression: this.getSessionQuestChanges(sessionActions),
            
            // Locations visited
            locationsVisited: [...new Set(sessionActions.map(a => a.location).filter(Boolean))],
            
            // Overall assessment
            sessionType: this.categorizeSession(sessionActions),
            overallTone: this.assessSessionTone(sessionActions, sessionConversations),
            playerEngagement: this.assessPlayerEngagement(sessionActions, sessionConversations)
        };

        this.interactionData.sessionSummaries.set(sessionId, summary);
        
        // Clean up old detailed data if needed
        this.performMemoryMaintenance();
        
        console.log(`📚 Created session summary: ${summary.sessionType} session with ${summary.totalActions} actions`);
        this.saveInteractionHistory();

        return sessionId;
    }

    // ===== UTILITY FUNCTIONS =====

    /**
     * Calculate importance score for an action
     */
    calculateActionImportance(actionData) {
        let importance = 0;

        // Base importance by type
        const typeImportance = {
            'quest_progression': 10,
            'combat_victory': 8,
            'combat_defeat': 9,
            'relationship_change': 6,
            'discovery': 7,
            'trade': 3,
            'exploration': 4,
            'dialogue': 5,
            'skill_check': 2
        };

        importance += typeImportance[actionData.type] || 1;

        // Increase importance for consequences
        if (actionData.consequences && actionData.consequences.length > 0) {
            importance += actionData.consequences.length * 2;
        }

        // Increase importance for relationship changes
        if (actionData.relationshipChanges && actionData.relationshipChanges.length > 0) {
            importance += actionData.relationshipChanges.reduce((sum, change) => 
                sum + Math.abs(change.amount), 0) / 5;
        }

        // Increase importance for quest-related actions
        if (actionData.questId || actionData.tags?.includes('quest')) {
            importance += 3;
        }

        return Math.min(10, Math.max(1, Math.round(importance)));
    }

    /**
     * Calculate importance score for dialogue
     */
    calculateDialogueImportance(conversationData) {
        let importance = 3; // Base dialogue importance

        // Increase for relationship changes
        if (Math.abs(conversationData.relationshipChange || 0) > 5) {
            importance += 3;
        }

        // Increase for quest information
        if (conversationData.topics?.includes('quest') || 
            conversationData.playerInput?.toLowerCase().includes('quest')) {
            importance += 2;
        }

        // Increase for lore or secrets
        if (conversationData.topics?.includes('lore') || 
            conversationData.topics?.includes('secret')) {
            importance += 2;
        }

        // Increase for emotional conversations
        if (conversationData.mood === 'angry' || conversationData.mood === 'grateful' ||
            conversationData.mood === 'fearful') {
            importance += 1;
        }

        return Math.min(10, Math.max(1, Math.round(importance)));
    }

    /**
     * Categorize action type
     */
    categorizeAction(actionData) {
        if (actionData.type?.includes('combat')) return 'combat';
        if (actionData.type?.includes('quest')) return 'quest';
        if (actionData.type?.includes('dialogue') || actionData.type?.includes('conversation')) return 'dialogue';
        if (actionData.type?.includes('trade') || actionData.type?.includes('merchant')) return 'trade';
        if (actionData.type?.includes('explore') || actionData.type?.includes('discover')) return 'exploration';
        if (actionData.type?.includes('spell') || actionData.type?.includes('magic')) return 'magic';
        if (actionData.target && actionData.target.includes('npc')) return 'social';
        
        return 'action'; // Default category
    }

    /**
     * Generate unique ID
     */
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get current location
     */
    getCurrentLocation() {
        return this.core.getModule('campaignManager')?.getCurrentLocation();
    }

    /**
     * Get current party snapshot
     */
    getPartySnapshot() {
        const characterSheet = this.core.getModule('characterSheet');
        if (!characterSheet) return null;

        const character = characterSheet.getCharacterData();
        return {
            level: character?.level,
            hp: character?.currentHP,
            maxHP: character?.maxHP,
            resources: character?.resources || {}
        };
    }

    /**
     * Get current quest context
     */
    getQuestContext() {
        const worldDatabase = this.core.getModule('worldDatabase');
        if (!worldDatabase) return [];

        return worldDatabase.getEntitiesByType('quests')
            .filter(quest => quest.status === 'active')
            .map(quest => ({
                id: quest.id,
                title: quest.title,
                status: quest.status
            }));
    }

    /**
     * Load interaction history from database
     */
    async loadInteractionHistory() {
        if (!this.worldDatabase) return;

        try {
            const historyData = await this.worldDatabase.getData('interaction_history');
            if (historyData) {
                // Convert plain objects back to Maps
                this.interactionData.conversations = new Map(historyData.conversations || []);
                this.interactionData.gameActions = new Map(historyData.gameActions || []);
                this.interactionData.aiDMHistory = new Map(historyData.aiDMHistory || []);
                this.interactionData.sessionSummaries = new Map(historyData.sessionSummaries || []);
                
                console.log('📜 Loaded interaction history from database');
            }
        } catch (error) {
            console.warn('Failed to load interaction history:', error);
        }
    }

    /**
     * Save interaction history to database
     */
    async saveInteractionHistory() {
        if (!this.worldDatabase) return;

        try {
            // Convert Maps to arrays for storage
            const historyData = {
                conversations: Array.from(this.interactionData.conversations.entries()),
                gameActions: Array.from(this.interactionData.gameActions.entries()),
                aiDMHistory: Array.from(this.interactionData.aiDMHistory.entries()),
                sessionSummaries: Array.from(this.interactionData.sessionSummaries.entries())
            };

            await this.worldDatabase.saveData('interaction_history', historyData);
        } catch (error) {
            console.warn('Failed to save interaction history:', error);
        }
    }

    /**
     * Perform memory maintenance (clean up old data)
     */
    performMemoryMaintenance() {
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        const cutoffTime = new Date(Date.now() - maxAge);

        // Clean up old low-importance actions
        for (const [actionId, action] of this.interactionData.gameActions) {
            if (new Date(action.timestamp) < cutoffTime && action.importance < 5) {
                this.interactionData.gameActions.delete(actionId);
            }
        }

        // Clean up old routine conversations
        for (const [convId, conversation] of this.interactionData.conversations) {
            const lastUpdate = new Date(conversation.lastUpdate || conversation.startTime);
            if (lastUpdate < cutoffTime && 
                Math.abs(conversation.relationshipImpact) < 10 &&
                conversation.outcome === 'routine') {
                this.interactionData.conversations.delete(convId);
            }
        }

        console.log('🧹 Performed interaction history maintenance');
    }

    // ===== HELPER FUNCTIONS FOR SESSION SUMMARIES =====

    getConversationsInTimeRange(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        return Array.from(this.interactionData.conversations.values())
            .filter(conv => {
                const convTime = new Date(conv.lastUpdate || conv.startTime);
                return convTime >= start && convTime <= end;
            });
    }

    getAIResponsesInTimeRange(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        
        return Array.from(this.interactionData.aiDMHistory.values())
            .filter(response => {
                const responseTime = new Date(response.timestamp);
                return responseTime >= start && responseTime <= end;
            });
    }

    getSessionEntityChanges(aiResponses, changeType) {
        return aiResponses.reduce((entities, response) => {
            if (response.entitiesCreated) {
                entities.push(...response.entitiesCreated);
            }
            return entities;
        }, []);
    }

    getSessionRelationshipChanges(actions) {
        return actions.reduce((changes, action) => {
            if (action.relationshipChanges) {
                changes.push(...action.relationshipChanges);
            }
            return changes;
        }, []);
    }

    getSessionQuestChanges(actions) {
        return actions.filter(action => 
            action.category === 'quest' || action.tags?.includes('quest')
        );
    }

    categorizeSession(actions) {
        const categories = actions.map(a => a.category);
        const combatCount = categories.filter(c => c === 'combat').length;
        const socialCount = categories.filter(c => c === 'social' || c === 'dialogue').length;
        const explorationCount = categories.filter(c => c === 'exploration').length;
        
        if (combatCount > actions.length * 0.4) return 'combat-heavy';
        if (socialCount > actions.length * 0.4) return 'social';
        if (explorationCount > actions.length * 0.4) return 'exploration';
        return 'mixed';
    }

    assessSessionTone(actions, conversations) {
        let positiveEvents = 0;
        let negativeEvents = 0;
        
        actions.forEach(action => {
            if (action.result === 'success' || action.result === 'victory') positiveEvents++;
            if (action.result === 'failure' || action.result === 'defeat') negativeEvents++;
        });
        
        conversations.forEach(conv => {
            if (conv.relationshipImpact > 0) positiveEvents++;
            if (conv.relationshipImpact < 0) negativeEvents++;
        });
        
        if (positiveEvents > negativeEvents * 2) return 'positive';
        if (negativeEvents > positiveEvents * 2) return 'challenging';
        return 'neutral';
    }

    assessPlayerEngagement(actions, conversations) {
        const totalInteractions = actions.length + conversations.length;
        const averageImportance = actions.reduce((sum, a) => sum + (a.importance || 0), 0) / actions.length;
        
        if (totalInteractions > 20 && averageImportance > 5) return 'high';
        if (totalInteractions > 10 && averageImportance > 3) return 'moderate';
        return 'low';
    }

    findNPCByName(npcName) {
        // This would integrate with the world database to find NPCs
        return this.worldDatabase?.findEntityByName('npcs', npcName);
    }

    // ===== PUBLIC API =====

    /**
     * Record a new player action
     */
    logPlayerAction(actionData) {
        return this.recordPlayerAction(actionData);
    }

    /**
     * Record a conversation exchange
     */
    logConversation(conversationData) {
        return this.recordConversation(conversationData);
    }

    /**
     * Get history relevant for AI context
     */
    getAIRelevantHistory(options = {}) {
        return this.getRelevantHistoryForAI(options);
    }

    /**
     * Get conversation history with an NPC
     */
    getNPCConversationHistory(npcId, options = {}) {
        return this.getConversationHistory(npcId, options);
    }

    /**
     * Get recent actions
     */
    getRecentActions(options = {}) {
        return this.getActionHistory(options);
    }

    /**
     * End current session and create summary
     */
    endSession(sessionData = {}) {
        return this.createSessionSummary(sessionData);
    }
}