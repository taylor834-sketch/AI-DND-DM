export default class RelationshipSystem {
    constructor(core) {
        this.core = core;
        this.worldDatabase = null;
        
        // Relationship configurations
        this.trustConfig = {
            min: 0,
            max: 100,
            neutral: 50,
            decay: {
                rate: 1, // points per day without interaction
                threshold: 7, // days before decay starts
                multiplier: {
                    enemy: 2.0,    // enemies decay faster to neutral
                    neutral: 1.0,  // normal decay
                    friend: 0.5,   // friends decay slower
                    ally: 0.3,     // allies decay very slow
                    romantic: 0.1  // romance barely decays
                }
            }
        };

        this.approvalConfig = {
            thresholds: {
                hatred: 0,
                dislike: 20,
                neutral: 40,
                like: 60,
                love: 80,
                devoted: 95
            },
            romance: {
                minThreshold: 70,
                maxThreshold: 90,
                jealousyFactor: 0.7 // other romantic interests affected
            }
        };

        this.factionConfig = {
            reputationLevels: {
                hated: -100,
                hostile: -50,
                unfriendly: -25,
                neutral: 0,
                friendly: 25,
                honored: 50,
                revered: 100
            },
            cascadeStrength: {
                ally: 0.8,      // 80% of reputation change
                friendly: 0.5,   // 50% of reputation change
                neutral: 0.1,    // 10% of reputation change
                unfriendly: -0.3, // negative cascade
                enemy: -0.6      // strong negative cascade
            }
        };

        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.setupRelationshipTracking();
        });

        this.core.on('time:dayPassed', () => {
            this.processRelationshipDecay();
        });

        this.core.on('relationship:changed', (event) => {
            this.handleRelationshipChange(event.detail);
        });
    }

    setupRelationshipTracking() {
        // Initialize relationship tracking if not exists
        if (!this.worldDatabase) return;

        const existingData = this.worldDatabase.getData();
        if (!existingData.relationships) {
            this.worldDatabase.updateData({
                relationships: {
                    individual: new Map(), // npcId -> relationship data
                    faction: new Map(),    // factionId -> reputation data
                    companions: new Map(), // companionId -> approval data
                    history: []           // relationship change history
                }
            });
        }
    }

    // ===== INDIVIDUAL RELATIONSHIP METHODS =====

    /**
     * Set or update individual relationship with an NPC
     * @param {string} npcId - NPC identifier
     * @param {Object} relationshipData - Relationship data
     */
    setIndividualRelationship(npcId, relationshipData) {
        const data = this.worldDatabase.getData();
        const existing = data.relationships.individual.get(npcId) || {};

        const relationship = {
            ...existing,
            ...relationshipData,
            npcId,
            lastInteraction: new Date(),
            trustLevel: Math.max(0, Math.min(100, relationshipData.trustLevel || existing.trustLevel || 50)),
            relationshipType: relationshipData.relationshipType || existing.relationshipType || 'neutral',
            notes: relationshipData.notes || existing.notes || [],
            interactions: existing.interactions || 0,
            // Romance specific data
            romance: {
                available: relationshipData.romance?.available || existing.romance?.available || false,
                active: relationshipData.romance?.active || existing.romance?.active || false,
                stage: relationshipData.romance?.stage || existing.romance?.stage || 'none', // none, interested, courting, committed, married
                jealousy: existing.romance?.jealousy || 0
            }
        };

        data.relationships.individual.set(npcId, relationship);
        this.worldDatabase.updateData(data);

        this.logRelationshipChange({
            type: 'individual',
            targetId: npcId,
            change: relationshipData,
            timestamp: new Date()
        });

        this.core.emit('relationship:individual:updated', { npcId, relationship });
        return relationship;
    }

    /**
     * Modify trust level with an NPC
     * @param {string} npcId - NPC identifier
     * @param {number} change - Trust change (-100 to +100)
     * @param {string} reason - Reason for change
     * @param {boolean} propagateConsequences - Whether to affect allies/enemies
     */
    modifyTrust(npcId, change, reason = '', propagateConsequences = true) {
        const npc = this.worldDatabase.getNPC(npcId);
        if (!npc) return null;

        const currentRelationship = this.getIndividualRelationship(npcId);
        const oldTrust = currentRelationship.trustLevel;
        const newTrust = Math.max(0, Math.min(100, oldTrust + change));

        const updatedRelationship = this.setIndividualRelationship(npcId, {
            trustLevel: newTrust,
            notes: [...(currentRelationship.notes || []), {
                timestamp: new Date(),
                change: change,
                reason: reason,
                oldValue: oldTrust,
                newValue: newTrust
            }],
            interactions: currentRelationship.interactions + 1
        });

        // Propagate consequences to allies and enemies
        if (propagateConsequences && Math.abs(change) >= 5) {
            this.propagateRelationshipConsequences(npcId, change, reason);
        }

        // Check for relationship type changes
        this.updateRelationshipType(npcId, newTrust);

        return updatedRelationship;
    }

    /**
     * Get individual relationship data
     * @param {string} npcId - NPC identifier
     * @returns {Object} Relationship data
     */
    getIndividualRelationship(npcId) {
        const data = this.worldDatabase.getData();
        return data.relationships.individual.get(npcId) || {
            npcId,
            trustLevel: 50,
            relationshipType: 'neutral',
            lastInteraction: null,
            notes: [],
            interactions: 0,
            romance: {
                available: false,
                active: false,
                stage: 'none',
                jealousy: 0
            }
        };
    }

    /**
     * Update relationship type based on trust level
     * @param {string} npcId - NPC identifier
     * @param {number} trustLevel - Current trust level
     */
    updateRelationshipType(npcId, trustLevel) {
        let newType = 'neutral';
        
        if (trustLevel <= 10) newType = 'enemy';
        else if (trustLevel <= 30) newType = 'unfriendly';
        else if (trustLevel <= 40) newType = 'neutral';
        else if (trustLevel <= 70) newType = 'friendly';
        else if (trustLevel <= 90) newType = 'ally';
        else newType = 'devoted';

        const currentRelationship = this.getIndividualRelationship(npcId);
        if (currentRelationship.relationshipType !== newType) {
            this.setIndividualRelationship(npcId, {
                relationshipType: newType
            });

            this.core.emit('relationship:type:changed', {
                npcId,
                oldType: currentRelationship.relationshipType,
                newType,
                trustLevel
            });
        }
    }

    // ===== FACTION REPUTATION METHODS =====

    /**
     * Modify faction reputation
     * @param {string} factionId - Faction identifier
     * @param {number} change - Reputation change
     * @param {string} reason - Reason for change
     * @param {boolean} cascade - Whether to cascade to allied/enemy factions
     */
    modifyFactionReputation(factionId, change, reason = '', cascade = true) {
        const faction = this.worldDatabase.getFaction(factionId);
        if (!faction) return null;

        const data = this.worldDatabase.getData();
        const currentRep = data.relationships.faction.get(factionId) || {
            factionId,
            reputation: 0,
            level: 'neutral',
            history: []
        };

        const newReputation = Math.max(-100, Math.min(100, currentRep.reputation + change));
        const newLevel = this.getReputationLevel(newReputation);

        const updatedRep = {
            ...currentRep,
            reputation: newReputation,
            level: newLevel,
            lastChange: new Date(),
            history: [...currentRep.history, {
                timestamp: new Date(),
                change,
                reason,
                oldValue: currentRep.reputation,
                newValue: newReputation
            }]
        };

        data.relationships.faction.set(factionId, updatedRep);
        this.worldDatabase.updateData(data);

        this.logRelationshipChange({
            type: 'faction',
            targetId: factionId,
            change: { reputation: change, reason },
            timestamp: new Date()
        });

        // Cascade to related factions
        if (cascade && Math.abs(change) >= 5) {
            this.cascadeFactionReputation(factionId, change, reason);
        }

        // Update NPC relationships within faction
        this.updateFactionMemberRelationships(factionId, change);

        this.core.emit('relationship:faction:updated', { factionId, reputation: updatedRep });
        return updatedRep;
    }

    /**
     * Get faction reputation
     * @param {string} factionId - Faction identifier
     * @returns {Object} Reputation data
     */
    getFactionReputation(factionId) {
        const data = this.worldDatabase.getData();
        return data.relationships.faction.get(factionId) || {
            factionId,
            reputation: 0,
            level: 'neutral',
            history: [],
            lastChange: null
        };
    }

    /**
     * Cascade faction reputation changes to allied/enemy factions
     * @param {string} sourceFactionId - Source faction
     * @param {number} change - Original reputation change
     * @param {string} reason - Reason for change
     */
    cascadeFactionReputation(sourceFactionId, change, reason) {
        const sourceFaction = this.worldDatabase.getFaction(sourceFactionId);
        if (!sourceFaction || !sourceFaction.relationships) return;

        sourceFaction.relationships.forEach(rel => {
            const cascadeStrength = this.factionConfig.cascadeStrength[rel.type] || 0;
            const cascadeChange = Math.round(change * cascadeStrength);

            if (Math.abs(cascadeChange) >= 1) {
                this.modifyFactionReputation(
                    rel.target,
                    cascadeChange,
                    `Cascade effect from ${sourceFaction.name}: ${reason}`,
                    false // Prevent infinite cascades
                );
            }
        });
    }

    /**
     * Update individual NPC relationships based on faction changes
     * @param {string} factionId - Faction identifier
     * @param {number} reputationChange - Faction reputation change
     */
    updateFactionMemberRelationships(factionId, reputationChange) {
        const faction = this.worldDatabase.getFaction(factionId);
        if (!faction || !faction.members) return;

        const trustChange = Math.round(reputationChange * 0.3); // 30% of faction change

        faction.members.forEach(npcId => {
            if (Math.abs(trustChange) >= 1) {
                this.modifyTrust(
                    npcId,
                    trustChange,
                    `Faction reputation change: ${faction.name}`,
                    false // Already propagating from faction level
                );
            }
        });
    }

    /**
     * Get reputation level name from numeric value
     * @param {number} reputation - Numeric reputation (-100 to 100)
     * @returns {string} Reputation level name
     */
    getReputationLevel(reputation) {
        const levels = this.factionConfig.reputationLevels;
        
        if (reputation <= levels.hated) return 'hated';
        if (reputation <= levels.hostile) return 'hostile';
        if (reputation <= levels.unfriendly) return 'unfriendly';
        if (reputation < levels.friendly) return 'neutral';
        if (reputation < levels.honored) return 'friendly';
        if (reputation < levels.revered) return 'honored';
        return 'revered';
    }

    // ===== COMPANION APPROVAL METHODS =====

    /**
     * Set companion approval
     * @param {string} companionId - Companion NPC identifier
     * @param {number} approval - Approval value (0-100)
     * @param {Object} options - Additional options
     */
    setCompanionApproval(companionId, approval, options = {}) {
        const data = this.worldDatabase.getData();
        const existing = data.relationships.companions.get(companionId) || {};

        const companionData = {
            ...existing,
            companionId,
            approval: Math.max(0, Math.min(100, approval)),
            lastInteraction: new Date(),
            isCompanion: true,
            romance: {
                ...existing.romance,
                ...options.romance,
                available: options.romance?.available || existing.romance?.available || false,
                interested: approval >= this.approvalConfig.romance.minThreshold,
                stage: existing.romance?.stage || 'none'
            },
            personalQuest: {
                ...existing.personalQuest,
                ...options.personalQuest
            },
            history: existing.history || []
        };

        // Handle romance progression
        if (companionData.romance.available) {
            this.updateRomanceStage(companionId, companionData);
        }

        data.relationships.companions.set(companionId, companionData);
        this.worldDatabase.updateData(data);

        // Also update individual relationship
        this.setIndividualRelationship(companionId, {
            trustLevel: approval,
            relationshipType: this.getApprovalLevel(approval).type,
            romance: companionData.romance
        });

        this.core.emit('relationship:companion:updated', { companionId, companionData });
        return companionData;
    }

    /**
     * Modify companion approval
     * @param {string} companionId - Companion identifier
     * @param {number} change - Approval change
     * @param {string} reason - Reason for change
     * @param {Object} options - Additional options
     */
    modifyCompanionApproval(companionId, change, reason = '', options = {}) {
        const current = this.getCompanionApproval(companionId);
        const newApproval = Math.max(0, Math.min(100, current.approval + change));

        // Handle jealousy effects for romance
        if (options.romantic && current.romance.available) {
            this.handleRomanceJealousy(companionId, change);
        }

        const updated = this.setCompanionApproval(companionId, newApproval, {
            romance: current.romance,
            personalQuest: current.personalQuest
        });

        // Add to history
        updated.history.push({
            timestamp: new Date(),
            change,
            reason,
            oldValue: current.approval,
            newValue: newApproval,
            context: options.context || 'general'
        });

        this.logRelationshipChange({
            type: 'companion',
            targetId: companionId,
            change: { approval: change, reason },
            timestamp: new Date()
        });

        return updated;
    }

    /**
     * Get companion approval data
     * @param {string} companionId - Companion identifier
     * @returns {Object} Approval data
     */
    getCompanionApproval(companionId) {
        const data = this.worldDatabase.getData();
        return data.relationships.companions.get(companionId) || {
            companionId,
            approval: 50,
            lastInteraction: null,
            isCompanion: false,
            romance: {
                available: false,
                interested: false,
                stage: 'none'
            },
            personalQuest: {
                available: false,
                completed: false,
                stage: 0
            },
            history: []
        };
    }

    /**
     * Get approval level information
     * @param {number} approval - Approval value
     * @returns {Object} Level information
     */
    getApprovalLevel(approval) {
        const thresholds = this.approvalConfig.thresholds;
        
        if (approval >= thresholds.devoted) return { name: 'Devoted', type: 'devoted', color: '#FFD700' };
        if (approval >= thresholds.love) return { name: 'Love', type: 'romantic', color: '#FF69B4' };
        if (approval >= thresholds.like) return { name: 'Likes You', type: 'ally', color: '#32CD32' };
        if (approval >= thresholds.neutral) return { name: 'Neutral', type: 'friendly', color: '#87CEEB' };
        if (approval >= thresholds.dislike) return { name: 'Dislikes You', type: 'unfriendly', color: '#FFA500' };
        return { name: 'Hatred', type: 'enemy', color: '#DC143C' };
    }

    /**
     * Update romance stage based on approval
     * @param {string} companionId - Companion identifier
     * @param {Object} companionData - Companion data
     */
    updateRomanceStage(companionId, companionData) {
        const approval = companionData.approval;
        const current = companionData.romance.stage;

        let newStage = current;
        
        if (approval >= 90 && current === 'courting') {
            newStage = 'committed';
        } else if (approval >= 80 && current === 'interested') {
            newStage = 'courting';
        } else if (approval >= 70 && current === 'none') {
            newStage = 'interested';
        } else if (approval < 60 && (current === 'interested' || current === 'courting')) {
            newStage = 'none';
        }

        if (newStage !== current) {
            companionData.romance.stage = newStage;
            this.core.emit('relationship:romance:stage:changed', {
                companionId,
                oldStage: current,
                newStage,
                approval
            });
        }
    }

    /**
     * Handle jealousy effects when pursuing multiple romances
     * @param {string} companionId - Companion being romanced
     * @param {number} approvalChange - Approval change amount
     */
    handleRomanceJealousy(companionId, approvalChange) {
        const data = this.worldDatabase.getData();
        const companions = Array.from(data.relationships.companions.values());
        const jealousyFactor = this.approvalConfig.romance.jealousyFactor;

        companions.forEach(companion => {
            if (companion.companionId !== companionId && 
                companion.romance.available && 
                companion.romance.interested) {
                
                const jealousyPenalty = Math.round(approvalChange * jealousyFactor * -1);
                if (Math.abs(jealousyPenalty) >= 1) {
                    this.modifyCompanionApproval(
                        companion.companionId,
                        jealousyPenalty,
                        'Jealousy from romantic attention to another',
                        { context: 'jealousy' }
                    );
                }
            }
        });
    }

    // ===== CONSEQUENCE PROPAGATION =====

    /**
     * Propagate relationship consequences to allies and enemies
     * @param {string} npcId - Source NPC
     * @param {number} trustChange - Trust change amount
     * @param {string} reason - Reason for change
     */
    propagateRelationshipConsequences(npcId, trustChange, reason) {
        const npc = this.worldDatabase.getNPC(npcId);
        if (!npc || !npc.relationships) return;

        npc.relationships.forEach(rel => {
            let consequenceChange = 0;
            
            // Calculate cascade strength based on relationship type
            switch (rel.type.toLowerCase()) {
                case 'ally':
                case 'friend':
                    consequenceChange = Math.round(trustChange * 0.4);
                    break;
                case 'family':
                case 'lover':
                    consequenceChange = Math.round(trustChange * 0.6);
                    break;
                case 'enemy':
                case 'rival':
                    consequenceChange = Math.round(trustChange * -0.5);
                    break;
                case 'acquaintance':
                    consequenceChange = Math.round(trustChange * 0.1);
                    break;
            }

            if (Math.abs(consequenceChange) >= 1) {
                this.modifyTrust(
                    rel.target,
                    consequenceChange,
                    `Consequence of actions toward ${npc.name}: ${reason}`,
                    false // Prevent infinite cascades
                );
            }
        });
    }

    // ===== RELATIONSHIP DECAY =====

    /**
     * Process relationship decay over time
     */
    processRelationshipDecay() {
        const data = this.worldDatabase.getData();
        const now = new Date();
        const msPerDay = 24 * 60 * 60 * 1000;

        // Decay individual relationships
        data.relationships.individual.forEach((relationship, npcId) => {
            if (!relationship.lastInteraction) return;

            const daysSinceInteraction = (now - new Date(relationship.lastInteraction)) / msPerDay;
            
            if (daysSinceInteraction > this.trustConfig.decay.threshold) {
                const decayMultiplier = this.trustConfig.decay.multiplier[relationship.relationshipType] || 1.0;
                const decayAmount = Math.floor((daysSinceInteraction - this.trustConfig.decay.threshold) * 
                                               this.trustConfig.decay.rate * decayMultiplier);
                
                if (decayAmount > 0) {
                    let newTrust;
                    if (relationship.trustLevel > this.trustConfig.neutral) {
                        newTrust = Math.max(this.trustConfig.neutral, relationship.trustLevel - decayAmount);
                    } else {
                        newTrust = Math.min(this.trustConfig.neutral, relationship.trustLevel + decayAmount);
                    }

                    if (newTrust !== relationship.trustLevel) {
                        this.setIndividualRelationship(npcId, {
                            trustLevel: newTrust,
                            notes: [...relationship.notes, {
                                timestamp: now,
                                change: newTrust - relationship.trustLevel,
                                reason: 'Natural decay from lack of interaction',
                                oldValue: relationship.trustLevel,
                                newValue: newTrust,
                                type: 'decay'
                            }]
                        });
                    }
                }
            }
        });

        // Decay companion approval (slower rate)
        data.relationships.companions.forEach((companion, companionId) => {
            if (!companion.lastInteraction) return;

            const daysSinceInteraction = (now - new Date(companion.lastInteraction)) / msPerDay;
            
            if (daysSinceInteraction > (this.trustConfig.decay.threshold * 2)) { // Double threshold for companions
                const decayAmount = Math.floor((daysSinceInteraction - this.trustConfig.decay.threshold * 2) * 0.5);
                
                if (decayAmount > 0) {
                    const newApproval = companion.approval > 50 
                        ? Math.max(50, companion.approval - decayAmount)
                        : Math.min(50, companion.approval + decayAmount);

                    if (newApproval !== companion.approval) {
                        this.setCompanionApproval(companionId, newApproval);
                        companion.history.push({
                            timestamp: now,
                            change: newApproval - companion.approval,
                            reason: 'Natural decay from lack of interaction',
                            oldValue: companion.approval,
                            newValue: newApproval,
                            type: 'decay'
                        });
                    }
                }
            }
        });
    }

    // ===== AI DM INTEGRATION =====

    /**
     * Get AI DM context for relationships
     * @param {Object} options - Query options
     * @returns {Object} Relationship context for AI DM
     */
    getAIDMContext(options = {}) {
        const context = {
            timestamp: new Date(),
            individual: {},
            factions: {},
            companions: {},
            summary: {
                allies: [],
                enemies: [],
                romantic: [],
                neutral: []
            }
        };

        const data = this.worldDatabase.getData();

        // Individual relationships
        data.relationships.individual.forEach((relationship, npcId) => {
            const npc = this.worldDatabase.getNPC(npcId);
            if (!npc) return;

            const relationshipSummary = {
                name: npc.name,
                trustLevel: relationship.trustLevel,
                relationshipType: relationship.relationshipType,
                lastInteraction: relationship.lastInteraction,
                interactions: relationship.interactions,
                recentChanges: relationship.notes.slice(-3),
                romance: relationship.romance
            };

            context.individual[npcId] = relationshipSummary;

            // Categorize for summary
            if (relationship.trustLevel >= 70) context.summary.allies.push(relationshipSummary);
            else if (relationship.trustLevel <= 30) context.summary.enemies.push(relationshipSummary);
            else context.summary.neutral.push(relationshipSummary);

            if (relationship.romance.active) context.summary.romantic.push(relationshipSummary);
        });

        // Faction relationships
        data.relationships.faction.forEach((reputation, factionId) => {
            const faction = this.worldDatabase.getFaction(factionId);
            if (!faction) return;

            context.factions[factionId] = {
                name: faction.name,
                reputation: reputation.reputation,
                level: reputation.level,
                recentChanges: reputation.history.slice(-3)
            };
        });

        // Companion relationships
        data.relationships.companions.forEach((companion, companionId) => {
            const npc = this.worldDatabase.getNPC(companionId);
            if (!npc) return;

            context.companions[companionId] = {
                name: npc.name,
                approval: companion.approval,
                approvalLevel: this.getApprovalLevel(companion.approval),
                romance: companion.romance,
                personalQuest: companion.personalQuest,
                recentChanges: companion.history.slice(-3)
            };
        });

        return context;
    }

    /**
     * Query relationships for AI DM decision making
     * @param {string} query - Query type or NPC ID
     * @param {Object} options - Query options
     * @returns {Object} Query results
     */
    queryForAIDM(query, options = {}) {
        switch (query.toLowerCase()) {
            case 'allies':
                return this.getAIDMAllies(options.threshold || 70);
                
            case 'enemies':
                return this.getAIDMEnemies(options.threshold || 30);
                
            case 'romantic':
                return this.getAIDMRomanticInterests();
                
            case 'faction_conflicts':
                return this.getAIDMFactionConflicts();
                
            case 'approval_gates':
                return this.getAIDMApprovalGates(options.minApproval || 60);
                
            case 'relationship_consequences':
                return this.getAIDMRelationshipConsequences(options.npcId);
                
            default:
                // Specific NPC query
                return this.getAIDMNPCRelationship(query);
        }
    }

    /**
     * Get allies for AI DM
     * @param {number} threshold - Minimum trust level
     * @returns {Array} Ally data
     */
    getAIDMAllies(threshold = 70) {
        const data = this.worldDatabase.getData();
        const allies = [];

        data.relationships.individual.forEach((relationship, npcId) => {
            if (relationship.trustLevel >= threshold) {
                const npc = this.worldDatabase.getNPC(npcId);
                if (npc) {
                    allies.push({
                        id: npcId,
                        name: npc.name,
                        trustLevel: relationship.trustLevel,
                        relationshipType: relationship.relationshipType,
                        canProvide: this.determineNPCCapabilities(npc, relationship.trustLevel)
                    });
                }
            }
        });

        return allies.sort((a, b) => b.trustLevel - a.trustLevel);
    }

    /**
     * Get enemies for AI DM
     * @param {number} threshold - Maximum trust level
     * @returns {Array} Enemy data
     */
    getAIDMEnemies(threshold = 30) {
        const data = this.worldDatabase.getData();
        const enemies = [];

        data.relationships.individual.forEach((relationship, npcId) => {
            if (relationship.trustLevel <= threshold) {
                const npc = this.worldDatabase.getNPC(npcId);
                if (npc) {
                    enemies.push({
                        id: npcId,
                        name: npc.name,
                        trustLevel: relationship.trustLevel,
                        relationshipType: relationship.relationshipType,
                        threatLevel: this.determineNPCThreatLevel(npc, relationship.trustLevel)
                    });
                }
            }
        });

        return enemies.sort((a, b) => a.trustLevel - b.trustLevel);
    }

    /**
     * Get romantic interests for AI DM
     * @returns {Array} Romantic interest data
     */
    getAIDMRomanticInterests() {
        const data = this.worldDatabase.getData();
        const romantic = [];

        data.relationships.individual.forEach((relationship, npcId) => {
            if (relationship.romance.active || relationship.romance.stage !== 'none') {
                const npc = this.worldDatabase.getNPC(npcId);
                if (npc) {
                    romantic.push({
                        id: npcId,
                        name: npc.name,
                        trustLevel: relationship.trustLevel,
                        romanceStage: relationship.romance.stage,
                        jealousy: relationship.romance.jealousy
                    });
                }
            }
        });

        return romantic;
    }

    /**
     * Determine NPC capabilities based on relationship
     * @param {Object} npc - NPC data
     * @param {number} trustLevel - Current trust level
     * @returns {Array} Available capabilities
     */
    determineNPCCapabilities(npc, trustLevel) {
        const capabilities = [];

        if (trustLevel >= 90) {
            capabilities.push('secret_information', 'dangerous_favors', 'personal_sacrifice');
        }
        if (trustLevel >= 70) {
            capabilities.push('valuable_items', 'important_introductions', 'shelter');
        }
        if (trustLevel >= 50) {
            capabilities.push('basic_information', 'common_items', 'directions');
        }

        // Add NPC-specific capabilities based on occupation
        if (npc.occupation) {
            const occupation = npc.occupation.toLowerCase();
            if (occupation.includes('merchant')) capabilities.push('trade_discounts', 'rare_goods');
            if (occupation.includes('guard')) capabilities.push('legal_protection', 'weapon_training');
            if (occupation.includes('scholar')) capabilities.push('research', 'ancient_knowledge');
            if (occupation.includes('noble')) capabilities.push('political_influence', 'court_access');
        }

        return capabilities;
    }

    /**
     * Determine NPC threat level
     * @param {Object} npc - NPC data
     * @param {number} trustLevel - Current trust level
     * @returns {string} Threat level
     */
    determineNPCThreatLevel(npc, trustLevel) {
        if (trustLevel <= 10) return 'extreme';
        if (trustLevel <= 20) return 'high';
        if (trustLevel <= 30) return 'moderate';
        return 'low';
    }

    // ===== UTILITY METHODS =====

    /**
     * Log relationship change for history
     * @param {Object} changeData - Change data to log
     */
    logRelationshipChange(changeData) {
        const data = this.worldDatabase.getData();
        data.relationships.history.unshift(changeData);
        
        // Keep only last 1000 history entries
        if (data.relationships.history.length > 1000) {
            data.relationships.history = data.relationships.history.slice(0, 1000);
        }
        
        this.worldDatabase.updateData(data);
    }

    /**
     * Get relationship history
     * @param {Object} options - Query options
     * @returns {Array} History entries
     */
    getRelationshipHistory(options = {}) {
        const data = this.worldDatabase.getData();
        let history = data.relationships.history || [];

        if (options.targetId) {
            history = history.filter(entry => entry.targetId === options.targetId);
        }

        if (options.type) {
            history = history.filter(entry => entry.type === options.type);
        }

        if (options.limit) {
            history = history.slice(0, options.limit);
        }

        return history;
    }

    /**
     * Get visual relationship indicator data
     * @param {string} entityId - Entity ID
     * @param {string} entityType - Entity type (npc, faction)
     * @returns {Object} Visual indicator data
     */
    getRelationshipIndicator(entityId, entityType = 'npc') {
        if (entityType === 'npc') {
            const relationship = this.getIndividualRelationship(entityId);
            const approvalLevel = this.getApprovalLevel(relationship.trustLevel);
            
            return {
                level: approvalLevel.name,
                type: approvalLevel.type,
                color: approvalLevel.color,
                value: relationship.trustLevel,
                icon: this.getRelationshipIcon(relationship.relationshipType, relationship.romance),
                tooltip: this.generateRelationshipTooltip(relationship, entityId)
            };
        } else if (entityType === 'faction') {
            const reputation = this.getFactionReputation(entityId);
            
            return {
                level: reputation.level,
                type: reputation.level,
                color: this.getReputationColor(reputation.level),
                value: reputation.reputation,
                icon: this.getReputationIcon(reputation.level),
                tooltip: this.generateReputationTooltip(reputation, entityId)
            };
        }

        return null;
    }

    /**
     * Get relationship icon
     * @param {string} type - Relationship type
     * @param {Object} romance - Romance data
     * @returns {string} Icon emoji/symbol
     */
    getRelationshipIcon(type, romance) {
        if (romance.active || romance.stage !== 'none') return '💕';
        
        switch (type) {
            case 'enemy': return '⚔️';
            case 'unfriendly': return '😠';
            case 'neutral': return '😐';
            case 'friendly': return '😊';
            case 'ally': return '🤝';
            case 'devoted': return '🙏';
            default: return '❓';
        }
    }

    /**
     * Get reputation color
     * @param {string} level - Reputation level
     * @returns {string} Color code
     */
    getReputationColor(level) {
        const colors = {
            hated: '#8B0000',
            hostile: '#DC143C',
            unfriendly: '#FF6347',
            neutral: '#808080',
            friendly: '#32CD32',
            honored: '#4169E1',
            revered: '#FFD700'
        };
        return colors[level] || colors.neutral;
    }

    /**
     * Get reputation icon
     * @param {string} level - Reputation level
     * @returns {string} Icon emoji/symbol
     */
    getReputationIcon(level) {
        const icons = {
            hated: '💀',
            hostile: '⚔️',
            unfriendly: '😒',
            neutral: '😐',
            friendly: '😊',
            honored: '⭐',
            revered: '👑'
        };
        return icons[level] || icons.neutral;
    }

    /**
     * Generate relationship tooltip
     * @param {Object} relationship - Relationship data
     * @param {string} npcId - NPC ID
     * @returns {string} Tooltip text
     */
    generateRelationshipTooltip(relationship, npcId) {
        const npc = this.worldDatabase.getNPC(npcId);
        const npcName = npc ? npc.name : 'Unknown';
        
        let tooltip = `${npcName}: ${relationship.trustLevel}/100 Trust\n`;
        tooltip += `Relationship: ${relationship.relationshipType}\n`;
        tooltip += `Interactions: ${relationship.interactions}`;
        
        if (relationship.romance.stage !== 'none') {
            tooltip += `\nRomance: ${relationship.romance.stage}`;
        }
        
        return tooltip;
    }

    /**
     * Generate reputation tooltip
     * @param {Object} reputation - Reputation data
     * @param {string} factionId - Faction ID
     * @returns {string} Tooltip text
     */
    generateReputationTooltip(reputation, factionId) {
        const faction = this.worldDatabase.getFaction(factionId);
        const factionName = faction ? faction.name : 'Unknown';
        
        let tooltip = `${factionName}: ${reputation.reputation}/100 Reputation\n`;
        tooltip += `Standing: ${reputation.level}`;
        
        return tooltip;
    }
}