export default class SessionEncounter {
    constructor(core) {
        this.core = core;
        this.worldDatabase = null;
        
        // Current session encounter data (not persisted)
        this.currentEncounter = {
            id: null,
            startTime: null,
            location: null,
            participants: new Map(), // id -> participant data
            genericCounters: new Map() // Track numbering for generic names (e.g. "Goblin Warrior" -> 3 means next is 4)
        };
        
        this.init();
    }
    
    init() {
        this.core.on('core:initialized', () => {
            this.worldDatabase = this.core.getModule('worldDatabase');
            console.log('⚔️ Session Encounter system initialized');
        });
        
        // Listen for encounter events
        this.core.on('encounter:start', (event) => this.startEncounter(event.detail));
        this.core.on('encounter:end', () => this.endEncounter());
        this.core.on('encounter:addParticipant', (event) => this.addParticipant(event.detail));
        this.core.on('encounter:removeParticipant', (event) => this.removeParticipant(event.detail.id));
        
        // Listen for name reveals
        this.core.on('world:nameRevealed', (event) => this.handleNameRevealed(event.detail));
    }
    
    startEncounter(data = {}) {
        this.currentEncounter = {
            id: this.generateEncounterId(),
            startTime: new Date().toISOString(),
            location: data.location || 'Unknown Location',
            participants: new Map(),
            genericCounters: new Map()
        };
        
        console.log(`🎯 Started new encounter: ${this.currentEncounter.id}`);
        this.core.emit('session:encounterStarted', { encounter: this.currentEncounter });
    }
    
    endEncounter() {
        if (!this.currentEncounter.id) return;
        
        // Save any named NPCs to world database before clearing
        for (const [id, participant] of this.currentEncounter.participants) {
            if (participant.hasRealName && !participant.isGeneric && !participant.isPlayer) {
                // This is a named NPC that should persist
                this.promoteToWorldNPC(participant);
            }
        }
        
        console.log(`✅ Ended encounter: ${this.currentEncounter.id}`);
        
        // Clear session data
        this.currentEncounter = {
            id: null,
            startTime: null,
            location: null,
            participants: new Map(),
            genericCounters: new Map()
        };
        
        this.core.emit('session:encounterEnded');
    }
    
    addParticipant(data) {
        if (!this.currentEncounter.id) {
            this.startEncounter();
        }
        
        const participant = this.createParticipant(data);
        this.currentEncounter.participants.set(participant.id, participant);
        
        console.log(`➕ Added participant: ${participant.displayName} (${participant.id})`);
        this.core.emit('session:participantAdded', { participant });
        
        return participant;
    }
    
    createParticipant(data) {
        // Determine if this is a generic enemy or named character
        const isGeneric = this.isGenericEnemy(data);
        const hasRealName = !isGeneric && data.name && !this.isGenericName(data.name);
        
        let displayName = data.name || 'Unknown';
        let realName = data.name;
        let genericName = null;
        
        if (isGeneric || !hasRealName) {
            // Generate a numbered generic name
            genericName = this.generateGenericName(data);
            displayName = genericName;
        } else if (data.npcId) {
            // This is an existing NPC from world database
            const npc = this.worldDatabase?.worldData.npcs[data.npcId];
            if (npc) {
                realName = npc.name;
                genericName = npc.genericName;
                displayName = this.worldDatabase.getDisplayName(data.npcId);
            }
        }
        
        return {
            id: data.id || this.generateParticipantId(),
            npcId: data.npcId || null, // Link to world database if exists
            
            // Names
            realName: realName,
            genericName: genericName,
            displayName: displayName,
            partyKnowsName: data.partyKnowsName || hasRealName,
            
            // Type flags
            isPlayer: data.isPlayer || false,
            isGeneric: isGeneric, // Generic enemies that don't persist
            hasRealName: hasRealName,
            
            // Combat data
            race: data.race || '',
            class: data.class || '',
            hitPoints: data.hitPoints || 10,
            maxHitPoints: data.maxHitPoints || 10,
            armorClass: data.armorClass || 10,
            initiative: data.initiative || 0,
            
            // Position on battle map
            position: data.position || null,
            
            // Status
            status: 'active', // active, unconscious, dead, fled
            conditions: [] // poisoned, stunned, etc.
        };
    }
    
    generateGenericName(data) {
        let baseName = '';
        
        // Determine base name from race/class/occupation
        if (data.occupation) {
            baseName = data.occupation.charAt(0).toUpperCase() + data.occupation.slice(1);
        } else if (data.class) {
            baseName = `${data.race || ''} ${data.class}`.trim();
        } else if (data.race) {
            baseName = data.race.charAt(0).toUpperCase() + data.race.slice(1);
        } else {
            baseName = 'Enemy';
        }
        
        // Add numbering if there are multiple of the same type
        const counter = (this.currentEncounter.genericCounters.get(baseName) || 0) + 1;
        this.currentEncounter.genericCounters.set(baseName, counter);
        
        return counter > 1 ? `${baseName} ${counter}` : baseName;
    }
    
    isGenericEnemy(data) {
        // Determine if this is a generic enemy based on various factors
        if (data.isGeneric !== undefined) return data.isGeneric;
        if (data.isPlayer) return false;
        if (data.npcId) return false; // Has world database entry
        
        // Check if name suggests generic enemy
        if (!data.name || this.isGenericName(data.name)) {
            return true;
        }
        
        return false;
    }
    
    isGenericName(name) {
        if (!name) return true;
        
        // Common generic patterns
        const genericPatterns = [
            /^(goblin|orc|bandit|guard|soldier|warrior|scout|archer)\s*\d*$/i,
            /^(skeleton|zombie|ghoul|wight)\s*\d*$/i,
            /^(wolf|bear|spider|rat)\s*\d*$/i,
            /^\w+\s+\d+$/ // Any word followed by a number
        ];
        
        return genericPatterns.some(pattern => pattern.test(name));
    }
    
    removeParticipant(participantId) {
        const participant = this.currentEncounter.participants.get(participantId);
        if (participant) {
            this.currentEncounter.participants.delete(participantId);
            console.log(`➖ Removed participant: ${participant.displayName}`);
            this.core.emit('session:participantRemoved', { id: participantId });
        }
    }
    
    revealParticipantName(participantId, realName) {
        const participant = this.currentEncounter.participants.get(participantId);
        if (!participant) return;
        
        const previousName = participant.displayName;
        participant.realName = realName;
        participant.partyKnowsName = true;
        participant.hasRealName = true;
        participant.displayName = realName;
        
        console.log(`💬 Name revealed: ${previousName} → ${realName}`);
        
        // If this participant has an NPC ID, update world database
        if (participant.npcId) {
            this.worldDatabase?.revealNPCName(participant.npcId);
        } else if (!participant.isGeneric) {
            // This is now a named NPC - add to world database
            this.promoteToWorldNPC(participant);
        }
        
        this.core.emit('session:nameRevealed', { 
            participantId,
            previousName,
            realName 
        });
    }
    
    promoteToWorldNPC(participant) {
        if (!this.worldDatabase || participant.isGeneric || participant.isPlayer) return;
        
        // Create NPC in world database
        const npcData = {
            name: participant.realName,
            genericName: participant.genericName,
            partyKnowsName: participant.partyKnowsName,
            race: participant.race,
            class: participant.class,
            occupation: participant.class || 'Adventurer',
            currentLocation: this.currentEncounter.location,
            firstEncounteredIn: this.currentEncounter.id,
            firstEncounteredAt: this.currentEncounter.startTime
        };
        
        const npcId = this.worldDatabase.addNPC(npcData);
        participant.npcId = npcId;
        
        console.log(`📝 Promoted ${participant.realName} to world database`);
    }
    
    handleNameRevealed(data) {
        // Update any participants linked to this NPC
        for (const [id, participant] of this.currentEncounter.participants) {
            if (participant.npcId === data.id) {
                participant.displayName = data.name;
                participant.partyKnowsName = true;
                
                this.core.emit('session:participantUpdated', { participant });
            }
        }
    }
    
    getParticipant(participantId) {
        return this.currentEncounter.participants.get(participantId);
    }
    
    getAllParticipants() {
        return Array.from(this.currentEncounter.participants.values());
    }
    
    getDisplayName(participantId) {
        const participant = this.getParticipant(participantId);
        if (!participant) return 'Unknown';
        return participant.displayName;
    }
    
    updateParticipantStatus(participantId, status) {
        const participant = this.getParticipant(participantId);
        if (participant) {
            participant.status = status;
            this.core.emit('session:participantUpdated', { participant });
        }
    }
    
    generateEncounterId() {
        return `encounter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    generateParticipantId() {
        return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}