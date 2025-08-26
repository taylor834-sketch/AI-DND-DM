export default class RelationshipManager {
    constructor(core) {
        this.core = core;
        this.npcs = new Map();
        this.factions = new Map();
        this.relationships = new Map();
        this.reputation = new Map();
        this.init();
    }

    init() {
        this.core.on('relationships:addNPC', (event) => this.addNPC(event.detail));
        this.core.on('relationships:updateRelationship', (event) => this.updateRelationship(event.detail));
        this.core.on('relationships:addFaction', (event) => this.addFaction(event.detail));
        this.core.on('relationships:updateReputation', (event) => this.updateReputation(event.detail));
        this.core.on('relationships:getRelationships', (event) => this.getRelationships(event.detail));
    }

    addNPC(npcData) {
        try {
            const npc = {
                id: npcData.id || this.generateNPCId(),
                name: npcData.name,
                race: npcData.race || 'Human',
                class: npcData.class || 'Commoner',
                location: npcData.location || 'Unknown',
                faction: npcData.faction || null,
                personality: npcData.personality || this.generatePersonality(),
                backstory: npcData.backstory || '',
                appearance: npcData.appearance || '',
                voice: npcData.voice || '',
                quests: npcData.quests || [],
                inventory: npcData.inventory || [],
                abilities: npcData.abilities || this.generateBasicAbilities(),
                status: npcData.status || 'alive',
                importance: npcData.importance || 'minor',
                firstMet: npcData.firstMet || new Date().toISOString(),
                lastSeen: new Date().toISOString()
            };

            this.npcs.set(npc.id, npc);
            this.initializeNPCRelationships(npc.id);
            
            this.core.emit('relationships:npcAdded', { npc, success: true });
            console.log(`👤 Added NPC: ${npc.name}`);
            
            return npc;
        } catch (error) {
            console.error('❌ Failed to add NPC:', error);
            this.core.emit('relationships:npcAdded', { success: false, error });
            return null;
        }
    }

    addFaction(factionData) {
        try {
            const faction = {
                id: factionData.id || this.generateFactionId(),
                name: factionData.name,
                description: factionData.description || '',
                alignment: factionData.alignment || 'Neutral',
                power: factionData.power || 'local',
                goals: factionData.goals || [],
                enemies: factionData.enemies || [],
                allies: factionData.allies || [],
                resources: factionData.resources || [],
                members: factionData.members || [],
                headquarters: factionData.headquarters || '',
                influence: factionData.influence || 0,
                secretive: factionData.secretive || false,
                created: new Date().toISOString()
            };

            this.factions.set(faction.id, faction);
            this.initializeFactionReputation(faction.id);
            
            this.core.emit('relationships:factionAdded', { faction, success: true });
            console.log(`🏛️ Added faction: ${faction.name}`);
            
            return faction;
        } catch (error) {
            console.error('❌ Failed to add faction:', error);
            this.core.emit('relationships:factionAdded', { success: false, error });
            return null;
        }
    }

    updateRelationship(relationshipData) {
        const { characterId, targetId, targetType, change, reason } = relationshipData;
        
        try {
            const relationshipKey = `${characterId}_${targetId}`;
            const currentRelationship = this.relationships.get(relationshipKey) || {
                characterId,
                targetId,
                targetType,
                value: 0,
                history: []
            };

            const oldValue = currentRelationship.value;
            currentRelationship.value = Math.max(-100, Math.min(100, currentRelationship.value + change));
            
            currentRelationship.history.push({
                date: new Date().toISOString(),
                change,
                oldValue,
                newValue: currentRelationship.value,
                reason: reason || 'Unknown interaction'
            });

            this.relationships.set(relationshipKey, currentRelationship);
            
            const relationshipLevel = this.getRelationshipLevel(currentRelationship.value);
            
            this.core.emit('relationships:updated', {
                relationship: currentRelationship,
                level: relationshipLevel,
                success: true
            });

            console.log(`💭 ${this.getTargetName(targetId, targetType)} relationship: ${oldValue} → ${currentRelationship.value} (${relationshipLevel})`);
            
            return currentRelationship;
        } catch (error) {
            console.error('❌ Failed to update relationship:', error);
            this.core.emit('relationships:updated', { success: false, error });
            return null;
        }
    }

    updateReputation(reputationData) {
        const { characterId, factionId, change, reason } = reputationData;
        
        try {
            const reputationKey = `${characterId}_${factionId}`;
            const currentReputation = this.reputation.get(reputationKey) || {
                characterId,
                factionId,
                value: 0,
                history: []
            };

            const oldValue = currentReputation.value;
            currentReputation.value = Math.max(-100, Math.min(100, currentReputation.value + change));
            
            currentReputation.history.push({
                date: new Date().toISOString(),
                change,
                oldValue,
                newValue: currentReputation.value,
                reason: reason || 'Unknown action'
            });

            this.reputation.set(reputationKey, currentReputation);
            
            const reputationLevel = this.getReputationLevel(currentReputation.value);
            const faction = this.factions.get(factionId);
            
            this.core.emit('relationships:reputationUpdated', {
                reputation: currentReputation,
                level: reputationLevel,
                faction: faction?.name,
                success: true
            });

            console.log(`🏛️ ${faction?.name || 'Unknown'} reputation: ${oldValue} → ${currentReputation.value} (${reputationLevel})`);
            
            return currentReputation;
        } catch (error) {
            console.error('❌ Failed to update reputation:', error);
            this.core.emit('relationships:reputationUpdated', { success: false, error });
            return null;
        }
    }

    getRelationships(query) {
        const { characterId, targetType } = query;
        
        const results = {
            npcs: [],
            factions: [],
            summary: {}
        };

        this.relationships.forEach((relationship) => {
            if (relationship.characterId === characterId) {
                const target = this.getTarget(relationship.targetId, relationship.targetType);
                if (target) {
                    const relationshipData = {
                        ...relationship,
                        target,
                        level: this.getRelationshipLevel(relationship.value)
                    };
                    
                    results[relationship.targetType === 'npc' ? 'npcs' : 'factions'].push(relationshipData);
                }
            }
        });

        this.reputation.forEach((reputation) => {
            if (reputation.characterId === characterId) {
                const faction = this.factions.get(reputation.factionId);
                if (faction) {
                    results.factions.push({
                        ...reputation,
                        faction,
                        level: this.getReputationLevel(reputation.value)
                    });
                }
            }
        });

        results.summary = this.generateRelationshipSummary(results);
        
        this.core.emit('relationships:retrieved', { results, success: true });
        return results;
    }

    initializeNPCRelationships(npcId) {
        const characterManager = this.core.getModule('character');
        if (characterManager?.currentCharacter) {
            const relationshipKey = `${characterManager.currentCharacter.id}_${npcId}`;
            if (!this.relationships.has(relationshipKey)) {
                this.relationships.set(relationshipKey, {
                    characterId: characterManager.currentCharacter.id,
                    targetId: npcId,
                    targetType: 'npc',
                    value: 0,
                    history: [{
                        date: new Date().toISOString(),
                        change: 0,
                        oldValue: 0,
                        newValue: 0,
                        reason: 'First meeting'
                    }]
                });
            }
        }
    }

    initializeFactionReputation(factionId) {
        const characterManager = this.core.getModule('character');
        if (characterManager?.currentCharacter) {
            const reputationKey = `${characterManager.currentCharacter.id}_${factionId}`;
            if (!this.reputation.has(reputationKey)) {
                this.reputation.set(reputationKey, {
                    characterId: characterManager.currentCharacter.id,
                    factionId: factionId,
                    value: 0,
                    history: [{
                        date: new Date().toISOString(),
                        change: 0,
                        oldValue: 0,
                        newValue: 0,
                        reason: 'First encounter'
                    }]
                });
            }
        }
    }

    getTarget(targetId, targetType) {
        return targetType === 'npc' ? this.npcs.get(targetId) : this.factions.get(targetId);
    }

    getTargetName(targetId, targetType) {
        const target = this.getTarget(targetId, targetType);
        return target?.name || 'Unknown';
    }

    getRelationshipLevel(value) {
        if (value >= 80) return 'Devoted';
        if (value >= 60) return 'Close Friend';
        if (value >= 40) return 'Friend';
        if (value >= 20) return 'Friendly';
        if (value >= 10) return 'Acquaintance';
        if (value > -10) return 'Neutral';
        if (value > -20) return 'Wary';
        if (value > -40) return 'Unfriendly';
        if (value > -60) return 'Hostile';
        if (value > -80) return 'Enemy';
        return 'Nemesis';
    }

    getReputationLevel(value) {
        if (value >= 80) return 'Legendary';
        if (value >= 60) return 'Renowned';
        if (value >= 40) return 'Well Known';
        if (value >= 20) return 'Recognized';
        if (value >= 10) return 'Known';
        if (value > -10) return 'Unknown';
        if (value > -20) return 'Watched';
        if (value > -40) return 'Mistrusted';
        if (value > -60) return 'Unwelcome';
        if (value > -80) return 'Hunted';
        return 'Wanted Dead';
    }

    generatePersonality() {
        const traits = ['brave', 'cowardly', 'kind', 'cruel', 'honest', 'deceitful', 'loyal', 'treacherous'];
        const mannerisms = ['stutters', 'laughs nervously', 'speaks loudly', 'whispers', 'gestures wildly'];
        
        return {
            trait: traits[Math.floor(Math.random() * traits.length)],
            mannerism: mannerisms[Math.floor(Math.random() * mannerisms.length)]
        };
    }

    generateBasicAbilities() {
        return {
            strength: 8 + Math.floor(Math.random() * 8),
            dexterity: 8 + Math.floor(Math.random() * 8),
            constitution: 8 + Math.floor(Math.random() * 8),
            intelligence: 8 + Math.floor(Math.random() * 8),
            wisdom: 8 + Math.floor(Math.random() * 8),
            charisma: 8 + Math.floor(Math.random() * 8)
        };
    }

    generateRelationshipSummary(results) {
        return {
            totalNPCs: results.npcs.length,
            totalFactions: results.factions.length,
            friends: results.npcs.filter(r => r.value >= 20).length,
            enemies: results.npcs.filter(r => r.value <= -20).length,
            goodReputation: results.factions.filter(r => r.value >= 20).length,
            badReputation: results.factions.filter(r => r.value <= -20).length
        };
    }

    generateNPCId() {
        return `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateFactionId() {
        return `faction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}