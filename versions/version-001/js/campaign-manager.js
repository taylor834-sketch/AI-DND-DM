export default class CampaignManager {
    constructor(core) {
        this.core = core;
        this.storagePrefix = 'dnd_voice_';
        this.activeCampaign = null;
        this.init();
    }

    init() {
        this.core.on('campaign:create', (event) => this.createCampaign(event.detail));
        this.core.on('campaign:load', (event) => this.loadCampaign(event.detail.id));
        this.core.on('campaign:save', (event) => this.saveCampaign(event.detail));
        this.core.on('campaign:delete', (event) => this.deleteCampaign(event.detail.id));
        this.core.on('campaign:list', () => this.listCampaigns());
        
        this.setupCampaignCreationForm();
        console.log('📋 Campaign Manager initialized');
    }

    setupCampaignCreationForm() {
        // Use a timeout to ensure elements are available after screen changes
        this.core.on('ui:screenShown', (event) => {
            if (event.detail.screen === 'campaignCreation') {
                setTimeout(() => {
                    this.bindFormEvents();
                }, 100);
            }
        });
        
        // Also bind when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.bindFormEvents(), 500);
            });
        } else {
            setTimeout(() => this.bindFormEvents(), 500);
        }
    }

    bindFormEvents() {
        // Scenario selection
        const scenarioOptions = document.querySelectorAll('.scenario-option');
        const selectedScenarioInput = document.getElementById('selected-scenario');
        
        if (scenarioOptions.length > 0) {
            scenarioOptions.forEach(option => {
                option.addEventListener('click', () => {
                    // Remove selected class from all options
                    scenarioOptions.forEach(opt => opt.classList.remove('selected'));
                    // Add selected class to clicked option
                    option.classList.add('selected');
                    // Update hidden input
                    if (selectedScenarioInput) {
                        selectedScenarioInput.value = option.getAttribute('data-scenario');
                    }
                });
            });
            
            // Set default selection
            scenarioOptions[0].classList.add('selected');
        }

        // Custom region toggle
        const startingRegionSelect = document.getElementById('starting-region');
        const customRegionGroup = document.getElementById('custom-region-group');
        
        if (startingRegionSelect && customRegionGroup) {
            startingRegionSelect.addEventListener('change', () => {
                if (startingRegionSelect.value === 'custom') {
                    customRegionGroup.style.display = 'block';
                } else {
                    customRegionGroup.style.display = 'none';
                }
            });
        }

        // Form submission
        const campaignForm = document.getElementById('campaign-creation-form');
        if (campaignForm) {
            campaignForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmission();
            });
        }
    }

    handleFormSubmission() {
        const formData = new FormData(document.getElementById('campaign-creation-form'));
        const campaignData = this.buildCampaignFromForm(formData);
        
        if (this.validateCampaignData(campaignData)) {
            this.createCampaign(campaignData);
        }
    }

    buildCampaignFromForm(formData) {
        const campaignId = this.generateCampaignId();
        const now = new Date().toISOString();
        
        // Handle custom region
        let startingRegion = formData.get('startingRegion');
        if (startingRegion === 'custom') {
            const customRegionName = formData.get('customRegionName');
            startingRegion = customRegionName || 'Custom Region';
        }

        // Generate world seed if not provided
        let worldSeed = formData.get('worldSeed');
        if (!worldSeed || worldSeed.trim() === '') {
            worldSeed = this.generateWorldSeed();
        }

        const campaignData = {
            meta: {
                id: campaignId,
                name: formData.get('campaignName'),
                version: this.core.config.version,
                created: now,
                lastModified: now,
                syncStatus: 'local'
            },
            settings: {
                worldSeed: worldSeed,
                moralComplexity: formData.get('moralComplexity'),
                startingRegion: startingRegion,
                startingScenario: formData.get('startingScenario')
            },
            gameState: {
                currentSession: 1,
                activeQuests: [],
                completedQuests: [],
                worldEvents: [],
                timeline: [
                    {
                        timestamp: now,
                        event: 'Campaign Created',
                        description: `Campaign "${formData.get('campaignName')}" was created with starting scenario: ${this.getScenarioName(formData.get('startingScenario'))}`
                    }
                ]
            },
            party: {
                characters: {},
                relationships: {},
                reputation: {}
            },
            world: {
                locations: this.generateStartingLocations(startingRegion, formData.get('startingScenario')),
                npcs: this.generateStartingNPCs(formData.get('startingScenario')),
                factions: this.generateStartingFactions(startingRegion)
            }
        };

        return campaignData;
    }

    validateCampaignData(campaignData) {
        const ui = this.core.getModule('ui');
        
        if (!campaignData.meta.name || campaignData.meta.name.trim() === '') {
            ui?.showNotification('Please enter a campaign name', 'error');
            return false;
        }

        if (campaignData.meta.name.length > 50) {
            ui?.showNotification('Campaign name must be 50 characters or less', 'error');
            return false;
        }

        if (!campaignData.settings.moralComplexity) {
            ui?.showNotification('Please select a moral complexity level', 'error');
            return false;
        }

        if (!campaignData.settings.startingRegion) {
            ui?.showNotification('Please select a starting region', 'error');
            return false;
        }

        return true;
    }

    createCampaign(campaignData) {
        try {
            const campaignId = this.saveCampaignToStorage(campaignData);
            
            if (campaignId) {
                this.activeCampaign = campaignData;
                this.core.updateState({ campaign: campaignData });
                
                const ui = this.core.getModule('ui');
                ui?.showNotification(`Campaign "${campaignData.meta.name}" created successfully!`, 'success');
                
                // Navigate to character setup
                setTimeout(() => {
                    ui?.showScreen('characterSetup');
                }, 1500);
                
                this.core.emit('campaign:created', { campaignId, campaign: campaignData });
                return campaignId;
            }
        } catch (error) {
            console.error('Failed to create campaign:', error);
            const ui = this.core.getModule('ui');
            ui?.showNotification('Failed to create campaign. Please try again.', 'error');
        }
    }

    saveCampaignToStorage(campaignData) {
        try {
            const database = this.core.getModule('database');
            if (database && database.saveCampaign) {
                return database.saveCampaign(campaignData);
            } else {
                // Fallback to direct localStorage
                const campaignId = campaignData.meta.id;
                localStorage.setItem(
                    `${this.storagePrefix}campaign_${campaignId}`,
                    JSON.stringify(campaignData)
                );
                this.updateCampaignList(campaignId, campaignData.meta.name);
                return campaignId;
            }
        } catch (error) {
            console.error('Failed to save campaign:', error);
            return null;
        }
    }

    updateCampaignList(campaignId, campaignName) {
        try {
            const existingList = localStorage.getItem(`${this.storagePrefix}campaigns`);
            const campaigns = existingList ? JSON.parse(existingList) : {};
            
            campaigns[campaignId] = {
                name: campaignName,
                lastModified: new Date().toISOString()
            };
            
            localStorage.setItem(`${this.storagePrefix}campaigns`, JSON.stringify(campaigns));
        } catch (error) {
            console.error('Failed to update campaign list:', error);
        }
    }

    generateCampaignId() {
        return `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateWorldSeed() {
        const adjectives = ['mystical', 'ancient', 'forgotten', 'shadowed', 'golden', 'crystal', 'wild', 'cursed', 'blessed', 'hidden'];
        const nouns = ['forests', 'mountains', 'valleys', 'seas', 'realms', 'kingdoms', 'ruins', 'temples', 'caverns', 'islands'];
        const numbers = Math.floor(Math.random() * 99999) + 10000;
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}_${noun}_${numbers}`;
    }

    getScenarioName(scenarioId) {
        const scenarioNames = {
            'mysterious_caravan': 'The Mysterious Caravan',
            'goblin_raids': 'Goblin Raids',
            'ancient_ruins': 'The Ancient Ruins',
            'political_intrigue': 'Court of Shadows'
        };
        return scenarioNames[scenarioId] || 'Unknown Scenario';
    }

    generateStartingLocations(region, scenario) {
        const locations = {};
        
        // Base location based on region
        const baseLocation = this.getRegionBaseLocation(region);
        locations[baseLocation.id] = baseLocation;
        
        // Scenario-specific locations
        const scenarioLocations = this.getScenarioLocations(scenario);
        Object.assign(locations, scenarioLocations);
        
        return locations;
    }

    generateStartingNPCs(scenario) {
        const npcs = {};
        const scenarioNPCs = this.getScenarioNPCs(scenario);
        Object.assign(npcs, scenarioNPCs);
        return npcs;
    }

    generateStartingFactions(region) {
        return this.getRegionFactions(region);
    }

    getRegionBaseLocation(region) {
        const regionLocations = {
            'sword_coast': {
                id: 'loc_phandalin',
                name: 'Phandalin',
                type: 'town',
                description: 'A small frontier town that serves as a hub for adventurers.',
                connections: []
            },
            'underdark': {
                id: 'loc_deep_cavern',
                name: 'Deep Cavern Outpost',
                type: 'outpost',
                description: 'A dimly lit outpost in the vast underground realm.',
                connections: []
            },
            'feywild': {
                id: 'loc_twilight_grove',
                name: 'Twilight Grove',
                type: 'grove',
                description: 'A magical grove where reality bends to emotion and dream.',
                connections: []
            },
            'shadowfell': {
                id: 'loc_shadow_crossing',
                name: 'Shadow Crossing',
                type: 'waypoint',
                description: 'A gloomy waypoint between the realms of shadow.',
                connections: []
            },
            'elemental_planes': {
                id: 'loc_elemental_nexus',
                name: 'Elemental Nexus',
                type: 'nexus',
                description: 'A convergence point of elemental forces.',
                connections: []
            }
        };

        return regionLocations[region] || {
            id: 'loc_custom_start',
            name: 'Starting Location',
            type: 'location',
            description: 'Your adventure begins here.',
            connections: []
        };
    }

    getScenarioLocations(scenario) {
        const scenarioLocations = {
            'mysterious_caravan': {
                'loc_trade_route': {
                    id: 'loc_trade_route',
                    name: 'Triboar Trail',
                    type: 'road',
                    description: 'A well-traveled trade route where the caravan was last seen.',
                    connections: []
                }
            },
            'goblin_raids': {
                'loc_goblin_hideout': {
                    id: 'loc_goblin_hideout',
                    name: 'Cragmaw Hideout',
                    type: 'cave',
                    description: 'A hidden cave complex used by goblin raiders.',
                    connections: []
                }
            },
            'ancient_ruins': {
                'loc_ruins': {
                    id: 'loc_ruins',
                    name: 'Forgotten Temple',
                    type: 'ruins',
                    description: 'Ancient ruins filled with mysteries and dangers.',
                    connections: []
                }
            },
            'political_intrigue': {
                'loc_noble_court': {
                    id: 'loc_noble_court',
                    name: 'Royal Court',
                    type: 'court',
                    description: 'The seat of political power, where nobles scheme and plot.',
                    connections: []
                }
            }
        };

        return scenarioLocations[scenario] || {};
    }

    getScenarioNPCs(scenario) {
        const scenarioNPCs = {
            'mysterious_caravan': {
                'npc_merchant': {
                    id: 'npc_merchant',
                    name: 'Gundren Rockseeker',
                    role: 'Missing Merchant',
                    description: 'A dwarf merchant whose caravan has gone missing.',
                    disposition: 'friendly',
                    location: 'unknown'
                }
            },
            'goblin_raids': {
                'npc_village_elder': {
                    id: 'npc_village_elder',
                    name: 'Elder Toblen',
                    role: 'Village Elder',
                    description: 'The worried leader of the threatened village.',
                    disposition: 'concerned',
                    location: 'village'
                }
            },
            'ancient_ruins': {
                'npc_scholar': {
                    id: 'npc_scholar',
                    name: 'Sage Iarno',
                    role: 'Ruins Scholar',
                    description: 'A scholar researching the ancient ruins.',
                    disposition: 'curious',
                    location: 'nearby'
                }
            },
            'political_intrigue': {
                'npc_noble': {
                    id: 'npc_noble',
                    name: 'Lord Neverember',
                    role: 'Noble Patron',
                    description: 'A powerful noble with mysterious motives.',
                    disposition: 'calculating',
                    location: 'court'
                }
            }
        };

        return scenarioNPCs[scenario] || {};
    }

    getRegionFactions(region) {
        const regionFactions = {
            'sword_coast': {
                'lords_alliance': {
                    id: 'lords_alliance',
                    name: "Lords' Alliance",
                    description: 'A coalition of cities and towns for mutual protection.',
                    reputation: 0,
                    influence: 'moderate'
                }
            },
            'underdark': {
                'dark_elves': {
                    id: 'dark_elves',
                    name: 'Drow Houses',
                    description: 'The complex political structure of dark elf nobility.',
                    reputation: -10,
                    influence: 'high'
                }
            },
            'feywild': {
                'seelie_court': {
                    id: 'seelie_court',
                    name: 'Seelie Court',
                    description: 'The court of benevolent fey creatures.',
                    reputation: 0,
                    influence: 'high'
                }
            }
        };

        return regionFactions[region] || {};
    }

    listCampaigns() {
        try {
            const campaignsData = localStorage.getItem(`${this.storagePrefix}campaigns`);
            const campaigns = campaignsData ? JSON.parse(campaignsData) : {};
            
            this.core.emit('campaigns:listed', { campaigns });
            return campaigns;
        } catch (error) {
            console.error('Failed to list campaigns:', error);
            return {};
        }
    }

    loadCampaign(campaignId) {
        try {
            const campaignData = localStorage.getItem(`${this.storagePrefix}campaign_${campaignId}`);
            
            if (!campaignData) {
                throw new Error(`Campaign ${campaignId} not found`);
            }

            const campaign = JSON.parse(campaignData);
            this.activeCampaign = campaign;
            this.core.updateState({ campaign });
            
            this.core.emit('campaign:loaded', { campaignId, campaign });
            return campaign;
        } catch (error) {
            console.error('Failed to load campaign:', error);
            const ui = this.core.getModule('ui');
            ui?.showNotification(`Failed to load campaign: ${error.message}`, 'error');
            return null;
        }
    }

    deleteCampaign(campaignId) {
        try {
            localStorage.removeItem(`${this.storagePrefix}campaign_${campaignId}`);
            
            // Remove from campaign list
            const campaignsData = localStorage.getItem(`${this.storagePrefix}campaigns`);
            if (campaignsData) {
                const campaigns = JSON.parse(campaignsData);
                delete campaigns[campaignId];
                localStorage.setItem(`${this.storagePrefix}campaigns`, JSON.stringify(campaigns));
            }
            
            this.core.emit('campaign:deleted', { campaignId });
            return true;
        } catch (error) {
            console.error('Failed to delete campaign:', error);
            return false;
        }
    }

    // ===== LOCATION TRACKING =====

    /**
     * Get current campaign
     */
    getCurrentCampaign() {
        return this.activeCampaign;
    }

    /**
     * Get current location from active campaign
     */
    getCurrentLocation() {
        if (!this.activeCampaign) {
            return null;
        }

        // Check if there's a stored current location in gameState
        if (this.activeCampaign.gameState?.currentLocation) {
            const locationId = this.activeCampaign.gameState.currentLocation;
            
            // If it's just a string, convert it to a proper location object
            if (typeof locationId === 'string') {
                return this.getLocationByName(locationId) || this.createBasicLocationObject(locationId);
            }
            
            // If it's already a location object, return it
            if (typeof locationId === 'object' && locationId.id) {
                return locationId;
            }
        }

        // Check if there's a dmState current location (from the old index.html system)
        if (this.activeCampaign.gameState?.dmState?.currentLocation) {
            const locationName = this.activeCampaign.gameState.dmState.currentLocation;
            return this.getLocationByName(locationName) || this.createBasicLocationObject(locationName);
        }

        // Fallback to starting location based on region
        const region = this.activeCampaign.startingRegion;
        return this.getRegionBaseLocation(region);
    }

    /**
     * Set current location and persist to campaign
     */
    setCurrentLocation(locationId) {
        if (!this.activeCampaign) {
            console.warn('No active campaign to set location for');
            return false;
        }

        // Initialize gameState if it doesn't exist
        if (!this.activeCampaign.gameState) {
            this.activeCampaign.gameState = {};
        }

        // Store the location ID
        this.activeCampaign.gameState.currentLocation = locationId;

        // Save the campaign with updated location
        this.saveCampaign(this.activeCampaign);

        // Emit event for other systems to react
        this.core.emit('location:changed', { 
            newLocation: locationId,
            campaign: this.activeCampaign 
        });

        console.log(`📍 Current location set to: ${typeof locationId === 'string' ? locationId : locationId.name || locationId.id}`);
        return true;
    }

    /**
     * Find location by name in campaign world
     */
    getLocationByName(locationName) {
        if (!this.activeCampaign || !this.activeCampaign.world?.locations) {
            return null;
        }

        // Search through campaign locations
        for (const [locationId, location] of Object.entries(this.activeCampaign.world.locations)) {
            if (location.name?.toLowerCase() === locationName.toLowerCase() ||
                locationId.toLowerCase() === locationName.toLowerCase()) {
                return {
                    id: locationId,
                    ...location
                };
            }
        }

        return null;
    }

    /**
     * Create a basic location object for unknown locations
     */
    createBasicLocationObject(locationName) {
        return {
            id: `loc_${locationName.toLowerCase().replace(/\s+/g, '_')}`,
            name: locationName,
            type: 'unknown',
            description: `You find yourself in ${locationName}.`,
            connections: [],
            npcs: [],
            monsters: [],
            factions: []
        };
    }

    /**
     * Add or update location in campaign world
     */
    addLocation(locationData) {
        if (!this.activeCampaign) {
            console.warn('No active campaign to add location to');
            return false;
        }

        // Initialize world structure if needed
        if (!this.activeCampaign.world) {
            this.activeCampaign.world = { locations: {}, npcs: {}, factions: {} };
        }
        if (!this.activeCampaign.world.locations) {
            this.activeCampaign.world.locations = {};
        }

        // Ensure location has required properties
        const location = {
            type: 'location',
            description: '',
            connections: [],
            npcs: [],
            monsters: [],
            factions: [],
            ...locationData
        };

        // Add to campaign
        this.activeCampaign.world.locations[location.id] = location;

        // Save campaign
        this.saveCampaign(this.activeCampaign);

        console.log(`🏛️ Added location: ${location.name} (${location.id})`);
        return location.id;
    }

    /**
     * Get current objective or quest
     */
    getCurrentObjective() {
        if (!this.activeCampaign) {
            return null;
        }

        // Check for active quest
        const activeQuests = this.activeCampaign.gameState?.activeQuests;
        if (activeQuests && activeQuests.length > 0) {
            return activeQuests[0]; // Return first active quest
        }

        // Check for story progress indicator
        if (this.activeCampaign.gameState?.storyProgress !== undefined) {
            return `Story Progress: ${this.activeCampaign.gameState.storyProgress}%`;
        }

        return null;
    }

    /**
     * Update story context with location information
     */
    updateStoryContext(contextData) {
        if (!this.activeCampaign) {
            return false;
        }

        if (!this.activeCampaign.gameState) {
            this.activeCampaign.gameState = {};
        }

        // Update various story context fields
        if (contextData.location) {
            this.setCurrentLocation(contextData.location);
        }

        if (contextData.scene) {
            this.activeCampaign.gameState.currentScene = contextData.scene;
        }

        if (contextData.npcsNearby) {
            this.activeCampaign.gameState.npcsNearby = contextData.npcsNearby;
        }

        if (contextData.lastPlayerAction) {
            this.activeCampaign.gameState.lastPlayerAction = contextData.lastPlayerAction;
        }

        // Save updated campaign
        this.saveCampaign(this.activeCampaign);

        return true;
    }

    // ===== SESSION RECAP SYSTEM =====

    /**
     * Generate a session recap based on recent activity
     */
    async generateSessionRecap() {
        if (!this.activeCampaign) {
            return null;
        }

        const interactionHistory = this.core.getModule('interactionHistory');
        const worldDatabase = this.core.getModule('worldDatabase');
        
        if (!interactionHistory) {
            return this.generateBasicRecap();
        }

        // Get recent session activity (last 3 hours)
        const sessionTimeWindow = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
        const recentActions = interactionHistory.getRecentActions({
            timeRange: sessionTimeWindow,
            limit: 20
        });

        const recentAIHistory = interactionHistory.getAIRelevantHistory({
            timeWindow: sessionTimeWindow,
            maxItems: 15
        });

        // Build recap
        const currentLocation = this.getCurrentLocation();
        const recap = {
            sessionId: `session_${Date.now()}`,
            timestamp: new Date().toISOString(),
            location: currentLocation,
            summary: await this.buildRecapSummary(recentActions, recentAIHistory),
            keyEvents: this.extractKeyEvents(recentActions),
            npcsInteracted: this.extractNPCInteractions(recentActions),
            questProgress: this.extractQuestProgress(recentActions),
            partyStatus: this.getPartyStatusSnapshot()
        };

        // Save recap to campaign
        if (!this.activeCampaign.sessionRecaps) {
            this.activeCampaign.sessionRecaps = [];
        }

        this.activeCampaign.sessionRecaps.push(recap);
        
        // Keep only last 5 recaps to avoid bloat
        if (this.activeCampaign.sessionRecaps.length > 5) {
            this.activeCampaign.sessionRecaps = this.activeCampaign.sessionRecaps.slice(-5);
        }

        this.saveCampaign(this.activeCampaign);
        
        console.log('📜 Generated session recap:', recap.summary);
        return recap;
    }

    /**
     * Build a narrative summary of the session
     */
    async buildRecapSummary(actions, aiHistory) {
        const currentLocation = this.getCurrentLocation();
        const locationName = currentLocation?.name || 'an unknown location';
        
        if (actions.length === 0) {
            return `Last session, you were in ${locationName}. The adventure continues from where you left off.`;
        }

        // Categorize actions
        const combatActions = actions.filter(a => a.category === 'combat').length;
        const dialogueActions = actions.filter(a => a.category === 'dialogue' || a.category === 'social').length;
        const explorationActions = actions.filter(a => a.category === 'exploration').length;
        const questActions = actions.filter(a => a.category === 'quest').length;

        let summary = `Last session in ${locationName}, `;
        
        const summaryParts = [];
        
        if (questActions > 0) {
            summaryParts.push('you made progress on your quests');
        }
        
        if (combatActions > 0) {
            summaryParts.push(`you engaged in ${combatActions > 1 ? 'several battles' : 'combat'}`);
        }
        
        if (dialogueActions > 0) {
            summaryParts.push('you had important conversations with NPCs');
        }
        
        if (explorationActions > 0) {
            summaryParts.push('you explored new areas');
        }
        
        if (summaryParts.length === 0) {
            summaryParts.push('you spent time in the area');
        }

        // Get the most recent significant action
        const significantActions = actions.filter(a => a.importance >= 6);
        if (significantActions.length > 0) {
            const lastAction = significantActions[significantActions.length - 1];
            summaryParts.push(`Your last notable action was: ${lastAction.description}`);
        }

        summary += summaryParts.join(', ') + '.';
        
        return summary;
    }

    /**
     * Extract key events from actions
     */
    extractKeyEvents(actions) {
        return actions
            .filter(action => action.importance >= 7)
            .map(action => ({
                type: action.category,
                description: action.description,
                timestamp: action.timestamp,
                importance: action.importance
            }))
            .slice(-5); // Last 5 key events
    }

    /**
     * Extract NPC interactions
     */
    extractNPCInteractions(actions) {
        const npcActions = actions.filter(action => 
            action.category === 'dialogue' || action.category === 'social' ||
            (action.target && action.target.includes('npc'))
        );

        const npcs = new Set();
        npcActions.forEach(action => {
            if (action.target) {
                // Extract NPC names from target field
                const npcMatch = action.target.match(/npc[_:]([^,\s]+)/i);
                if (npcMatch) {
                    npcs.add(npcMatch[1]);
                }
            }
        });

        return Array.from(npcs);
    }

    /**
     * Extract quest progress
     */
    extractQuestProgress(actions) {
        return actions
            .filter(action => action.category === 'quest')
            .map(action => ({
                description: action.description,
                result: action.result,
                timestamp: action.timestamp
            }))
            .slice(-3); // Last 3 quest actions
    }

    /**
     * Get current party status snapshot
     */
    getPartyStatusSnapshot() {
        const characterSheet = this.core.getModule('characterSheet');
        if (!characterSheet) {
            return { status: 'unknown' };
        }

        const character = characterSheet.getCharacterData();
        return {
            level: character?.level || 1,
            hp: character?.currentHP || 0,
            maxHP: character?.maxHP || 0,
            status: character?.currentHP >= character?.maxHP * 0.75 ? 'healthy' : 
                   character?.currentHP >= character?.maxHP * 0.5 ? 'wounded' : 'badly hurt'
        };
    }

    /**
     * Generate basic recap when no interaction history is available
     */
    generateBasicRecap() {
        const currentLocation = this.getCurrentLocation();
        const locationName = currentLocation?.name || 'an unknown location';
        
        return {
            sessionId: `basic_session_${Date.now()}`,
            timestamp: new Date().toISOString(),
            location: currentLocation,
            summary: `Welcome back! Your adventure continues in ${locationName}. What would you like to do?`,
            keyEvents: [],
            npcsInteracted: [],
            questProgress: [],
            partyStatus: { status: 'ready for adventure' }
        };
    }

    /**
     * Get the most recent session recap
     */
    getLastSessionRecap() {
        if (!this.activeCampaign?.sessionRecaps || this.activeCampaign.sessionRecaps.length === 0) {
            return null;
        }

        return this.activeCampaign.sessionRecaps[this.activeCampaign.sessionRecaps.length - 1];
    }

    /**
     * Generate DM opening based on last session
     */
    generateSessionOpening() {
        const lastRecap = this.getLastSessionRecap();
        
        if (!lastRecap) {
            const currentLocation = this.getCurrentLocation();
            return `Welcome, adventurers! Your story begins in ${currentLocation?.name || 'a realm of adventure'}. What would you like to do?`;
        }

        let opening = `Welcome back, brave adventurers! `;
        opening += lastRecap.summary;
        
        if (lastRecap.keyEvents.length > 0) {
            const lastEvent = lastRecap.keyEvents[lastRecap.keyEvents.length - 1];
            opening += ` Remember that ${lastEvent.description.toLowerCase()}.`;
        }
        
        opening += ` The adventure continues. What do you choose to do?`;
        
        return opening;
    }

    /**
     * Save session and generate recap (called during saves)
     */
    async saveSessionWithRecap() {
        // Generate recap before saving
        const recap = await this.generateSessionRecap();
        
        // Save the campaign (which now includes the recap)
        this.saveCampaign(this.activeCampaign);
        
        // Create session summary for interaction history
        const interactionHistory = this.core.getModule('interactionHistory');
        if (interactionHistory) {
            interactionHistory.endSession({
                sessionId: recap?.sessionId || `session_${Date.now()}`,
                startTime: new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString() // 3 hours ago
            });
        }
        
        console.log('💾 Session saved with recap generated');
        return recap;
    }
}