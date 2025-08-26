export default class WorldDatabase {
    constructor(core) {
        this.core = core;
        this.worldData = this.initializeWorldStructure();
        this.relationships = new Map(); // For fast relationship lookups
        this.eventTimeline = []; // Chronologically sorted events
        this.searchIndex = new Map(); // For fast searching
        this.init();
    }

    init() {
        this.core.on('world:addNPC', (event) => this.addNPC(event.detail));
        this.core.on('world:addLocation', (event) => this.addLocation(event.detail));
        this.core.on('world:addEvent', (event) => this.addEvent(event.detail));
        this.core.on('world:updateRelationship', (event) => this.updateRelationship(event.detail));
        this.core.on('world:addFaction', (event) => this.addFaction(event.detail));
        this.core.on('world:search', (event) => this.search(event.detail.query));
        
        console.log('🌍 World Database initialized');
    }

    initializeWorldStructure() {
        return {
            meta: {
                campaignId: null,
                lastUpdated: new Date().toISOString(),
                version: '1.0.0'
            },
            npcs: {
                // Structure: id -> NPC data
                // Optimized for AI DM: fast lookup by ID, location, or faction
            },
            locations: {
                // Structure: id -> Location data
                // Hierarchical: regions -> cities -> districts -> buildings
            },
            factions: {
                // Structure: id -> Faction data
                // Includes power dynamics and territorial control
            },
            events: {
                // Structure: id -> Event data
                // Timeline-based with cause/effect chains
            },
            relationships: {
                // Structure: Multi-dimensional relationship matrix
                // Fast lookup for any entity relationship
            }
        };
    }

    // =================================
    // NPC Management
    // =================================
    addNPC(npcData) {
        const npc = this.createNPCStructure(npcData);
        this.worldData.npcs[npc.id] = npc;
        
        // Update search index
        this.updateSearchIndex('npc', npc);
        
        // Auto-create location relationship if specified
        if (npc.currentLocation) {
            this.updateRelationship({
                entityA: npc.id,
                entityAType: 'npc',
                entityB: npc.currentLocation,
                entityBType: 'location',
                relationship: 'located_at',
                strength: 1.0,
                context: 'Current residence/workplace'
            });
        }

        this.saveToStorage();
        this.core.emit('world:npcAdded', { npc });
        return npc.id;
    }

    createNPCStructure(data) {
        const npcId = data.id || this.generateId('npc');
        
        return {
            id: npcId,
            name: data.name || 'Unknown',
            genericName: data.genericName || this.generateGenericName(data), // e.g. "Villager", "Guard", "Shopkeeper"
            partyKnowsName: data.partyKnowsName || false, // Fog of war for names
            
            // Basic Information
            race: data.race || '',
            gender: data.gender || '',
            age: data.age || '',
            occupation: data.occupation || '',
            
            // Personality & Behavior (AI DM reference)
            personality: {
                traits: data.personality?.traits || [],
                motivations: data.personality?.motivations || [],
                fears: data.personality?.fears || [],
                goals: data.personality?.goals || [],
                secrets: data.personality?.secrets || []
            },
            
            // Social Information
            socialClass: data.socialClass || 'commoner', // noble, merchant, commoner, outcast
            reputation: data.reputation || 'neutral', // renowned, respected, neutral, suspicious, notorious
            
            // Location & Movement
            currentLocation: data.currentLocation || null,
            birthplace: data.birthplace || null,
            frequentLocations: data.frequentLocations || [],
            
            // Faction Affiliations
            primaryFaction: data.primaryFaction || null,
            factionRank: data.factionRank || null,
            factionLoyalty: data.factionLoyalty || 0, // -100 to 100
            
            // Relationships & Interactions
            relationshipHistory: [], // Populated by relationship events
            lastInteraction: null,
            interactionCount: 0,
            
            // Abilities & Resources
            skills: data.skills || [],
            resources: {
                wealth: data.resources?.wealth || 'modest',
                influence: data.resources?.influence || 'none',
                connections: data.resources?.connections || []
            },
            
            // Combat/Danger Level (for AI DM)
            threatLevel: data.threatLevel || 'none', // none, low, moderate, high, deadly
            combatRole: data.combatRole || null, // warrior, mage, healer, scout, leader
            
            // Narrative Importance
            importance: data.importance || 'background', // background, minor, major, central
            plotHooks: data.plotHooks || [],
            questGiver: data.questGiver || false,
            
            // Dynamic Status
            status: data.status || 'alive', // alive, dead, missing, traveling
            currentMood: data.currentMood || 'neutral',
            availability: data.availability || 'normal', // busy, available, unavailable
            
            // Metadata
            firstMet: data.firstMet || null,
            createdBy: data.createdBy || 'system',
            tags: data.tags || [],
            notes: data.notes || '',
            
            // Timestamps
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
    }

    // =================================
    // Location Management
    // =================================
    addLocation(locationData) {
        const location = this.createLocationStructure(locationData);
        this.worldData.locations[location.id] = location;
        
        this.updateSearchIndex('location', location);
        
        // Create parent-child relationships
        if (location.parentLocation) {
            this.updateRelationship({
                entityA: location.id,
                entityAType: 'location',
                entityB: location.parentLocation,
                entityBType: 'location',
                relationship: 'located_within',
                strength: 1.0
            });
        }

        this.saveToStorage();
        this.core.emit('world:locationAdded', { location });
        return location.id;
    }

    createLocationStructure(data) {
        const locationId = data.id || this.generateId('loc');
        
        return {
            id: locationId,
            name: data.name || 'Unknown Location',
            
            // Hierarchy
            type: data.type || 'area', // continent, region, city, district, building, room
            parentLocation: data.parentLocation || null,
            childLocations: data.childLocations || [],
            
            // Physical Description
            description: data.description || '',
            geography: data.geography || '', // terrain, climate, notable features
            size: data.size || 'medium', // tiny, small, medium, large, huge, gargantuan
            
            // Political Situation (AI DM reference)
            government: {
                type: data.government?.type || 'none', // monarchy, republic, oligarchy, anarchy, etc.
                ruler: data.government?.ruler || null,
                stability: data.government?.stability || 'stable', // chaotic, unstable, stable, rigid
                corruption: data.government?.corruption || 'low' // none, low, moderate, high, rampant
            },
            
            // Economic Information
            economy: {
                prosperity: data.economy?.prosperity || 'modest', // destitute, poor, modest, wealthy, opulent
                primaryIndustries: data.economy?.primaryIndustries || [],
                tradeRoutes: data.economy?.tradeRoutes || [],
                currency: data.economy?.currency || 'standard'
            },
            
            // Population & Demographics
            population: {
                size: data.population?.size || 'small',
                demographics: data.population?.demographics || [], // [{ race: 'human', percentage: 80 }]
                density: data.population?.density || 'sparse'
            },
            
            // Faction Control
            controllingFaction: data.controllingFaction || null,
            factionInfluence: data.factionInfluence || {}, // { factionId: influenceLevel }
            
            // Points of Interest
            landmarks: data.landmarks || [],
            establishments: data.establishments || [], // shops, inns, temples, etc.
            services: data.services || [], // available services
            
            // Atmosphere & Mood
            atmosphere: data.atmosphere || 'neutral', // peaceful, tense, festive, grim, etc.
            dangerLevel: data.dangerLevel || 'safe', // safe, low, moderate, high, deadly
            
            // Historical Significance
            historicalEvents: [], // Populated from events
            founded: data.founded || null,
            notableHistory: data.notableHistory || '',
            
            // Current Situation
            currentEvents: [], // Active ongoing events
            rumors: data.rumors || [],
            problems: data.problems || [],
            opportunities: data.opportunities || [],
            
            // Access & Travel
            accessibility: data.accessibility || 'open', // open, restricted, forbidden, hidden
            travelTime: data.travelTime || {}, // { locationId: { time: 'X days', method: 'foot' } }
            
            // Metadata
            importance: data.importance || 'minor', // background, minor, major, central
            tags: data.tags || [],
            notes: data.notes || '',
            
            // Timestamps
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
    }

    // =================================
    // Faction Management
    // =================================
    addFaction(factionData) {
        const faction = this.createFactionStructure(factionData);
        this.worldData.factions[faction.id] = faction;
        
        this.updateSearchIndex('faction', faction);
        this.saveToStorage();
        this.core.emit('world:factionAdded', { faction });
        return faction.id;
    }

    createFactionStructure(data) {
        const factionId = data.id || this.generateId('faction');
        
        return {
            id: factionId,
            name: data.name || 'Unknown Faction',
            shortName: data.shortName || data.name || 'Unknown',
            
            // Basic Information
            type: data.type || 'organization', // guild, government, religion, criminal, military, etc.
            description: data.description || '',
            motto: data.motto || '',
            symbol: data.symbol || '',
            
            // Goals & Philosophy
            goals: {
                primary: data.goals?.primary || [],
                secondary: data.goals?.secondary || [],
                hidden: data.goals?.hidden || []
            },
            ideology: data.ideology || '', // core beliefs and values
            methods: data.methods || [], // how they operate
            
            // Power & Influence
            powerLevel: data.powerLevel || 'local', // local, regional, national, international
            influence: {
                political: data.influence?.political || 0, // 0-100
                economic: data.influence?.economic || 0,
                military: data.influence?.military || 0,
                social: data.influence?.social || 0
            },
            
            // Territory & Assets
            territories: data.territories || [], // controlled locations
            strongholds: data.strongholds || [], // key locations
            resources: {
                wealth: data.resources?.wealth || 'modest',
                members: data.resources?.members || 'few',
                equipment: data.resources?.equipment || 'basic',
                information: data.resources?.information || 'limited'
            },
            
            // Organization Structure
            leadership: {
                leader: data.leadership?.leader || null,
                structure: data.leadership?.structure || 'hierarchical',
                succession: data.leadership?.succession || 'unclear'
            },
            ranks: data.ranks || [], // organizational hierarchy
            
            // Relationships
            allies: data.allies || [],
            enemies: data.enemies || [],
            rivals: data.rivals || [],
            
            // Activities
            activities: data.activities || [], // what they do
            recentActions: [], // populated from events
            
            // Reputation & Public Perception
            reputation: {
                general: data.reputation?.general || 'unknown',
                amongNobles: data.reputation?.amongNobles || 'unknown',
                amongCommoners: data.reputation?.amongCommoners || 'unknown',
                amongOtherFactions: data.reputation?.amongOtherFactions || 'unknown'
            },
            
            // Operational Status
            status: data.status || 'active', // active, dormant, disbanded, secret
            secrecy: data.secrecy || 'open', // open, discreet, secret, hidden
            
            // Plot Relevance
            importance: data.importance || 'minor',
            plotHooks: data.plotHooks || [],
            
            // Metadata
            founded: data.founded || null,
            founder: data.founder || null,
            tags: data.tags || [],
            notes: data.notes || '',
            
            // Timestamps
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
    }

    // =================================
    // Event Management
    // =================================
    addEvent(eventData) {
        const event = this.createEventStructure(eventData);
        this.worldData.events[event.id] = event;
        
        // Insert into timeline (keep chronological order)
        this.insertIntoTimeline(event);
        
        // Process consequences
        this.processEventConsequences(event);
        
        this.updateSearchIndex('event', event);
        this.saveToStorage();
        this.core.emit('world:eventAdded', { event });
        return event.id;
    }

    createEventStructure(data) {
        const eventId = data.id || this.generateId('event');
        
        return {
            id: eventId,
            title: data.title || 'Untitled Event',
            description: data.description || '',
            
            // Timing
            timestamp: data.timestamp || new Date().toISOString(),
            duration: data.duration || null, // how long it lasted
            
            // Location
            location: data.location || null,
            locationType: data.locationType || 'location',
            
            // Participants
            participants: data.participants || [], // { id, type, role }
            witnesses: data.witnesses || [],
            
            // Event Classification
            type: data.type || 'general', // combat, social, political, economic, natural, magical, etc.
            category: data.category || 'minor', // minor, significant, major, historic
            scope: data.scope || 'local', // personal, local, regional, national, global
            
            // Relationships
            causedBy: data.causedBy || null, // what caused this event
            triggers: data.triggers || [], // what this event triggered
            relatedEvents: data.relatedEvents || [],
            
            // Consequences & Changes
            consequences: data.consequences || {
                // immediate: [], // immediate effects
                // shortTerm: [], // effects within days/weeks  
                // longTerm: [] // lasting changes
            },
            
            // World State Changes
            worldChanges: {
                npcChanges: data.worldChanges?.npcChanges || [],
                locationChanges: data.worldChanges?.locationChanges || [],
                factionChanges: data.worldChanges?.factionChanges || [],
                relationshipChanges: data.worldChanges?.relationshipChanges || []
            },
            
            // Player Involvement
            playerInitiated: data.playerInitiated || false,
            playerChoices: data.playerChoices || [],
            
            // Narrative Importance
            importance: data.importance || 'minor',
            plotRelevance: data.plotRelevance || 'background',
            
            // Visibility
            publicKnowledge: data.publicKnowledge || 'public', // secret, private, public, legendary
            rumors: data.rumors || [],
            
            // Metadata
            tags: data.tags || [],
            notes: data.notes || '',
            recordedBy: data.recordedBy || 'system',
            
            // Timestamps
            created: new Date().toISOString()
        };
    }

    // =================================
    // Relationship Management
    // =================================
    updateRelationship(relationshipData) {
        const key = this.getRelationshipKey(
            relationshipData.entityA, 
            relationshipData.entityAType,
            relationshipData.entityB, 
            relationshipData.entityBType
        );
        
        const relationship = {
            entityA: relationshipData.entityA,
            entityAType: relationshipData.entityAType,
            entityB: relationshipData.entityB,
            entityBType: relationshipData.entityBType,
            relationship: relationshipData.relationship,
            strength: relationshipData.strength || 0, // -100 to 100
            context: relationshipData.context || '',
            history: relationshipData.history || [],
            lastInteraction: new Date().toISOString(),
            created: relationshipData.created || new Date().toISOString()
        };
        
        this.relationships.set(key, relationship);
        
        // Also store in world data for persistence
        if (!this.worldData.relationships) {
            this.worldData.relationships = {};
        }
        this.worldData.relationships[key] = relationship;
        
        this.saveToStorage();
        this.core.emit('world:relationshipUpdated', { relationship });
    }

    // =================================
    // AI DM Helper Functions
    // =================================
    
    // Get all NPCs in a location (for encounters)
    getNPCsInLocation(locationId, includeChildren = true) {
        const npcs = [];
        
        for (const npc of Object.values(this.worldData.npcs)) {
            if (npc.currentLocation === locationId) {
                npcs.push(npc);
            }
        }
        
        if (includeChildren) {
            const location = this.worldData.locations[locationId];
            if (location?.childLocations) {
                for (const childId of location.childLocations) {
                    npcs.push(...this.getNPCsInLocation(childId, false));
                }
            }
        }
        
        return npcs;
    }
    
    // Get faction relationships (for political events)
    getFactionRelationships(factionId) {
        const relationships = [];
        
        for (const [key, relationship] of this.relationships.entries()) {
            if ((relationship.entityA === factionId && relationship.entityAType === 'faction') ||
                (relationship.entityB === factionId && relationship.entityBType === 'faction')) {
                relationships.push(relationship);
            }
        }
        
        return relationships;
    }
    
    // Get recent events in area (for context)
    getRecentEvents(locationId, daysPast = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysPast);
        
        return this.eventTimeline
            .filter(event => {
                const eventDate = new Date(event.timestamp);
                return eventDate >= cutoffDate && 
                       (event.location === locationId || this.isLocationChild(event.location, locationId));
            })
            .slice(-10); // Last 10 events
    }
    
    // Get character relationship with NPC (for dialogue)
    getCharacterNPCRelationship(characterId, npcId) {
        const key = this.getRelationshipKey(characterId, 'character', npcId, 'npc');
        return this.relationships.get(key) || this.createDefaultRelationship(characterId, 'character', npcId, 'npc');
    }

    // =================================
    // Name Management & Fog of War
    // =================================
    
    generateGenericName(data) {
        // Generate generic names based on occupation, race, or type
        if (data.occupation) {
            return data.occupation.charAt(0).toUpperCase() + data.occupation.slice(1);
        }
        if (data.race && data.class) {
            return `${data.race} ${data.class}`;
        }
        if (data.race) {
            return data.race.charAt(0).toUpperCase() + data.race.slice(1);
        }
        return 'Stranger';
    }
    
    revealNPCName(npcId) {
        const npc = this.worldData.npcs[npcId];
        if (npc && !npc.partyKnowsName) {
            npc.partyKnowsName = true;
            this.saveToStorage();
            this.core.emit('world:nameRevealed', { 
                id: npcId, 
                name: npc.name,
                previousName: npc.genericName 
            });
            console.log(`💬 Name revealed: ${npc.genericName} → ${npc.name}`);
        }
    }
    
    getDisplayName(npcId) {
        const npc = this.worldData.npcs[npcId];
        if (!npc) return 'Unknown';
        return npc.partyKnowsName ? npc.name : npc.genericName;
    }

    // =================================
    // Search & Utility Functions
    // =================================
    
    search(query) {
        const results = {
            npcs: [],
            locations: [],
            factions: [],
            events: []
        };
        
        const searchTerm = query.toLowerCase();
        
        // Search NPCs
        for (const npc of Object.values(this.worldData.npcs)) {
            if (this.matchesSearch(npc, searchTerm, ['name', 'occupation', 'notes'])) {
                results.npcs.push(npc);
            }
        }
        
        // Search Locations
        for (const location of Object.values(this.worldData.locations)) {
            if (this.matchesSearch(location, searchTerm, ['name', 'description', 'notes'])) {
                results.locations.push(location);
            }
        }
        
        // Search Factions
        for (const faction of Object.values(this.worldData.factions)) {
            if (this.matchesSearch(faction, searchTerm, ['name', 'description', 'notes'])) {
                results.factions.push(faction);
            }
        }
        
        // Search Events
        for (const event of Object.values(this.worldData.events)) {
            if (this.matchesSearch(event, searchTerm, ['title', 'description', 'notes'])) {
                results.events.push(event);
            }
        }
        
        this.core.emit('world:searchResults', { query, results });
        return results;
    }

    // =================================
    // Data Persistence
    // =================================
    
    saveToStorage() {
        try {
            // Save to campaign if available
            const campaign = this.core.appState.campaign;
            if (campaign) {
                campaign.world = this.worldData;
                campaign.meta.lastModified = new Date().toISOString();
                
                const campaignManager = this.core.getModule('campaignManager');
                campaignManager?.saveCampaignToStorage(campaign);
            }
            
            // Also save independently
            const worldKey = campaign ? `world_${campaign.meta.id}` : 'world_default';
            localStorage.setItem(`dnd_voice_${worldKey}`, JSON.stringify({
                worldData: this.worldData,
                relationships: Array.from(this.relationships.entries()),
                timeline: this.eventTimeline,
                lastSaved: new Date().toISOString()
            }));
            
        } catch (error) {
            console.error('Failed to save world database:', error);
        }
    }
    
    loadFromStorage(campaignId = null) {
        try {
            const worldKey = campaignId ? `world_${campaignId}` : 'world_default';
            const savedData = localStorage.getItem(`dnd_voice_${worldKey}`);
            
            if (savedData) {
                const parsed = JSON.parse(savedData);
                this.worldData = parsed.worldData || this.initializeWorldStructure();
                this.relationships = new Map(parsed.relationships || []);
                this.eventTimeline = parsed.timeline || [];
                
                this.rebuildSearchIndex();
                console.log(`🌍 World database loaded for campaign: ${campaignId || 'default'}`);
                return true;
            }
        } catch (error) {
            console.error('Failed to load world database:', error);
        }
        
        return false;
    }

    // =================================
    // Compatibility Methods for Module Integration
    // =================================

    // Generic data access method (used by multiple modules)
    getData(category = null) {
        console.log('🔧 CACHE TEST: WorldDatabase getData method loaded correctly!');
        if (category) {
            return this.worldData[category] || {};
        }
        return this.worldData;
    }

    // Player choices tracking (used by ChoiceTrackingSystem)
    getPlayerChoices() {
        if (!this.worldData.playerChoices) {
            this.worldData.playerChoices = [];
        }
        return this.worldData.playerChoices;
    }

    setPlayerChoices(choices) {
        this.worldData.playerChoices = choices;
        this.saveToStorage();
    }

    // Player quests tracking (used by DynamicQuestSystem)
    getPlayerQuests() {
        if (!this.worldData.playerQuests) {
            this.worldData.playerQuests = [];
        }
        return this.worldData.playerQuests;
    }

    setPlayerQuests(quests) {
        this.worldData.playerQuests = quests;
        this.saveToStorage();
    }

    // Rest state tracking (used by RestSystem)
    getRestState() {
        if (!this.worldData.restState) {
            this.worldData.restState = {
                lastRest: null,
                restType: null,
                location: null,
                benefits: []
            };
        }
        return this.worldData.restState;
    }

    setRestState(restState) {
        this.worldData.restState = restState;
        this.saveToStorage();
    }

    // NPC creation method (used by RelationshipTestScenarios)
    createNPC(npcData) {
        return this.addNPC(npcData);
    }

    // Generic save method (used by various systems)
    save(category, data) {
        if (category && data) {
            this.worldData[category] = data;
            this.saveToStorage();
            return true;
        }
        return false;
    }

    // Load method for specific categories
    load(category) {
        return this.worldData[category] || null;
    }

    // =================================
    // Helper Functions
    // =================================
    
    generateId(prefix = 'entity') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getRelationshipKey(entityA, typeA, entityB, typeB) {
        // Normalize order for consistent keys
        if (entityA < entityB) {
            return `${entityA}:${typeA}:${entityB}:${typeB}`;
        } else {
            return `${entityB}:${typeB}:${entityA}:${typeA}`;
        }
    }
    
    insertIntoTimeline(event) {
        const eventTime = new Date(event.timestamp);
        const insertIndex = this.eventTimeline.findIndex(e => new Date(e.timestamp) > eventTime);
        
        if (insertIndex === -1) {
            this.eventTimeline.push(event);
        } else {
            this.eventTimeline.splice(insertIndex, 0, event);
        }
    }
    
    processEventConsequences(event) {
        // Apply world changes from event
        if (event.worldChanges) {
            // Update NPCs
            for (const change of event.worldChanges.npcChanges || []) {
                const npc = this.worldData.npcs[change.npcId];
                if (npc) {
                    this.applyNPCChanges(npc, change.changes);
                }
            }
            
            // Update locations
            for (const change of event.worldChanges.locationChanges || []) {
                const location = this.worldData.locations[change.locationId];
                if (location) {
                    this.applyLocationChanges(location, change.changes);
                }
            }
            
            // Update relationships
            for (const change of event.worldChanges.relationshipChanges || []) {
                this.updateRelationship(change);
            }
        }
    }
    
    updateSearchIndex(type, entity) {
        // Update search index for fast lookups
        const searchTerms = this.extractSearchTerms(entity);
        
        for (const term of searchTerms) {
            if (!this.searchIndex.has(term)) {
                this.searchIndex.set(term, []);
            }
            
            this.searchIndex.get(term).push({ type, id: entity.id });
        }
    }
    
    extractSearchTerms(entity) {
        const terms = [];
        const searchableFields = ['name', 'title', 'description', 'occupation', 'notes'];
        
        for (const field of searchableFields) {
            if (entity[field] && typeof entity[field] === 'string') {
                const words = entity[field].toLowerCase().split(/\s+/);
                terms.push(...words.filter(word => word.length > 2));
            }
        }
        
        return [...new Set(terms)]; // Remove duplicates
    }
    
    matchesSearch(entity, searchTerm, fields) {
        for (const field of fields) {
            const value = entity[field];
            if (value && typeof value === 'string') {
                if (value.toLowerCase().includes(searchTerm)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    rebuildSearchIndex() {
        this.searchIndex.clear();
        
        for (const npc of Object.values(this.worldData.npcs)) {
            this.updateSearchIndex('npc', npc);
        }
        for (const location of Object.values(this.worldData.locations)) {
            this.updateSearchIndex('location', location);
        }
        for (const faction of Object.values(this.worldData.factions)) {
            this.updateSearchIndex('faction', faction);
        }
        for (const event of Object.values(this.worldData.events)) {
            this.updateSearchIndex('event', event);
        }
    }
    
    createDefaultRelationship(entityA, typeA, entityB, typeB) {
        return {
            entityA,
            entityAType: typeA,
            entityB,
            entityBType: typeB,
            relationship: 'neutral',
            strength: 0,
            context: 'No previous interaction',
            history: [],
            lastInteraction: null,
            created: new Date().toISOString()
        };
    }
    
    applyNPCChanges(npc, changes) {
        for (const [field, value] of Object.entries(changes)) {
            if (field in npc) {
                npc[field] = value;
                npc.lastUpdated = new Date().toISOString();
            }
        }
    }
    
    applyLocationChanges(location, changes) {
        for (const [field, value] of Object.entries(changes)) {
            if (field in location) {
                location[field] = value;
                location.lastUpdated = new Date().toISOString();
            }
        }
    }
    
    isLocationChild(childId, parentId) {
        const child = this.worldData.locations[childId];
        return child?.parentLocation === parentId;
    }

    // =================================
    // Sample Data Creation
    // =================================
    
    createSampleWorldData() {
        // Add sample NPCs
        this.addNPC({
            name: 'Toblen Stonehill',
            occupation: 'Innkeeper',
            race: 'Human',
            currentLocation: 'loc_phandalin',
            personality: {
                traits: ['Friendly', 'Gossip', 'Helpful'],
                motivations: ['Protect his business', 'Help travelers'],
                secrets: ['Knows about missing caravans']
            },
            importance: 'minor',
            questGiver: true
        });
        
        this.addNPC({
            name: 'Sister Garaele',
            occupation: 'Priest of Tymora',
            race: 'Half-Elf',
            currentLocation: 'loc_phandalin',
            primaryFaction: 'harpers',
            personality: {
                traits: ['Wise', 'Secretive', 'Kind'],
                motivations: ['Gather information', 'Help the innocent'],
                secrets: ['Harper agent']
            },
            importance: 'major',
            questGiver: true
        });
        
        // Add sample locations
        this.addLocation({
            id: 'loc_phandalin',
            name: 'Phandalin',
            type: 'town',
            description: 'A small frontier town that has grown around a trading post.',
            population: { size: 'small', demographics: [{ race: 'human', percentage: 70 }, { race: 'halfling', percentage: 20 }] },
            government: { type: 'council', stability: 'stable' },
            atmosphere: 'peaceful',
            establishments: ['Stonehill Inn', 'Barthen\'s Provisions', 'Shrine of Luck']
        });
        
        // Add sample faction
        this.addFaction({
            name: 'Harpers',
            type: 'secret organization',
            description: 'A network of spies and scouts who gather information and work against evil.',
            powerLevel: 'regional',
            goals: { primary: ['Gather intelligence', 'Oppose tyranny', 'Preserve knowledge'] },
            secrecy: 'secret'
        });
        
        // Add sample event
        this.addEvent({
            title: 'Gundren Rockseeker Goes Missing',
            description: 'The dwarf merchant Gundren Rockseeker disappeared while traveling to Phandalin.',
            location: 'loc_phandalin',
            type: 'disappearance',
            category: 'significant',
            participants: [{ id: 'npc_gundren', type: 'npc', role: 'victim' }],
            consequences: {
                immediate: ['Trade disruption', 'Increased guard patrols'],
                shortTerm: ['Investigation launched', 'Reward posted']
            }
        });
        
        console.log('🌍 Sample world data created');
    }
}