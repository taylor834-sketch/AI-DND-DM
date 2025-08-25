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
}