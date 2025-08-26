export default class SessionContinuation {
    constructor(core) {
        this.core = core;
        this.campaignManager = null;
        this.voiceIntegration = null;
        this.aiDMIntegration = null;
        
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.campaignManager = this.core.getModule('campaignManager');
            this.voiceIntegration = this.core.getModule('voiceIntegration');
            this.aiDMIntegration = this.core.getModule('aiDMIntegration');
            
            console.log('🔄 Session Continuation system initialized');
        });

        // Listen for campaign load events
        this.core.on('campaign:loaded', (event) => {
            this.handleCampaignLoaded(event.detail);
        });

        // Listen for game start events
        this.core.on('game:start', () => {
            this.startSessionWithContinuation();
        });
    }

    /**
     * Handle when a campaign is loaded
     */
    async handleCampaignLoaded(campaignData) {
        console.log('📖 Campaign loaded, preparing session continuation...');
        
        // Check if there's a previous session to continue from
        const lastRecap = this.campaignManager?.getLastSessionRecap();
        
        if (lastRecap) {
            console.log('📜 Found previous session recap:', lastRecap.summary);
            
            // Prepare the session opening
            const openingMessage = this.generateSessionOpening(lastRecap);
            
            // Store for when game actually starts
            this.pendingSessionOpening = openingMessage;
            
            return openingMessage;
        } else {
            console.log('🆕 No previous session found, will start fresh adventure');
            return null;
        }
    }

    /**
     * Start session with continuation
     */
    async startSessionWithContinuation() {
        if (!this.campaignManager) {
            console.warn('Campaign manager not available for session continuation');
            return;
        }

        try {
            const lastRecap = this.campaignManager.getLastSessionRecap();
            
            let openingMessage;
            
            if (lastRecap) {
                // Continuing session
                openingMessage = this.generateSessionOpening(lastRecap);
                console.log('🔄 Starting session continuation');
                
                // Restore context for AI DM
                await this.restoreSessionContext(lastRecap);
                
            } else {
                // New session
                openingMessage = this.generateNewSessionOpening();
                console.log('🆕 Starting new session');
                
                // Initialize fresh context
                await this.initializeFreshSession();
            }

            // Speak the opening
            if (this.voiceIntegration && openingMessage) {
                await this.speakSessionOpening(openingMessage);
            }

            // Emit session started event
            this.core.emit('session:started', {
                isNewSession: !lastRecap,
                openingMessage,
                sessionRecap: lastRecap
            });

            return openingMessage;
            
        } catch (error) {
            console.error('❌ Failed to start session continuation:', error);
            
            // Fallback to basic opening
            const fallbackMessage = "Welcome back, adventurers! Your story continues...";
            
            if (this.voiceIntegration) {
                await this.speakSessionOpening(fallbackMessage);
            }
            
            return fallbackMessage;
        }
    }

    /**
     * Generate session opening message
     */
    generateSessionOpening(recap) {
        if (!recap) {
            return this.generateNewSessionOpening();
        }

        let opening = "Welcome back, brave adventurers! ";
        
        // Add the recap summary
        opening += recap.summary;
        
        // Add key events if any
        if (recap.keyEvents && recap.keyEvents.length > 0) {
            const lastEvent = recap.keyEvents[recap.keyEvents.length - 1];
            opening += ` I particularly remember ${lastEvent.description.toLowerCase()}.`;
        }
        
        // Add NPC context if any
        if (recap.npcsInteracted && recap.npcsInteracted.length > 0) {
            const npcs = recap.npcsInteracted.slice(0, 2).join(' and ');
            opening += ` You had interactions with ${npcs}.`;
        }
        
        // Add quest context if any
        if (recap.questProgress && recap.questProgress.length > 0) {
            const lastQuest = recap.questProgress[recap.questProgress.length - 1];
            opening += ` Your quest progress included: ${lastQuest.description.toLowerCase()}.`;
        }
        
        // Add current status
        if (recap.partyStatus && recap.partyStatus.status) {
            opening += ` You are currently ${recap.partyStatus.status}.`;
        }
        
        opening += " The adventure continues from where we left off. What do you choose to do?";
        
        return opening;
    }

    /**
     * Generate new session opening
     */
    generateNewSessionOpening() {
        const currentLocation = this.campaignManager?.getCurrentLocation();
        const locationName = currentLocation?.name || 'a realm of adventure';
        
        return `Welcome, brave adventurers! Your story begins in ${locationName}. ` +
               `A new chapter of your adventure awaits. What would you like to do?`;
    }

    /**
     * Restore session context for AI systems
     */
    async restoreSessionContext(recap) {
        if (!recap) return;

        // Update campaign context
        if (this.campaignManager && recap.location) {
            this.campaignManager.setCurrentLocation(recap.location.id || recap.location);
        }

        // Restore NPCs context
        if (recap.npcsInteracted && recap.npcsInteracted.length > 0) {
            // Set nearby NPCs for context
            const gameState = this.campaignManager.activeCampaign.gameState || {};
            gameState.npcsNearby = recap.npcsInteracted;
            this.campaignManager.updateStoryContext({ npcsNearby: recap.npcsInteracted });
        }

        // Restore quest context
        if (recap.questProgress && recap.questProgress.length > 0) {
            // The quest progress should already be in the world database
            console.log('📋 Restored quest context from previous session');
        }

        // Invalidate AI context cache to force rebuild with new session data
        if (this.aiDMIntegration) {
            this.aiDMIntegration.invalidateContextCache(['currentLocation', 'worldState', 'relationships']);
        }

        console.log('🔄 Session context restored from recap');
    }

    /**
     * Initialize fresh session context
     */
    async initializeFreshSession() {
        // Set up starting location if not already set
        const currentLocation = this.campaignManager?.getCurrentLocation();
        if (!currentLocation && this.campaignManager) {
            // This will initialize a default location
            this.campaignManager.getCurrentLocation();
        }

        console.log('🆕 Fresh session context initialized');
    }

    /**
     * Speak the session opening using voice integration
     */
    async speakSessionOpening(message) {
        if (!this.voiceIntegration) return;

        try {
            // Use a slight delay to let any other audio finish
            setTimeout(async () => {
                await this.voiceIntegration.speakAsDM(message);
            }, 500);
            
        } catch (error) {
            console.error('🔊 Failed to speak session opening:', error);
        }
    }

    /**
     * Generate session recap for display
     */
    generateSessionRecapDisplay(recap) {
        if (!recap) return null;

        const recapDisplay = {
            title: 'Previous Session Recap',
            summary: recap.summary,
            details: []
        };

        if (recap.location) {
            recapDisplay.details.push({
                icon: '📍',
                text: `Location: ${recap.location.name}`,
                type: 'location'
            });
        }

        if (recap.keyEvents && recap.keyEvents.length > 0) {
            recapDisplay.details.push({
                icon: '⚔️',
                text: `Key Events: ${recap.keyEvents.length} significant actions`,
                type: 'events'
            });
        }

        if (recap.npcsInteracted && recap.npcsInteracted.length > 0) {
            recapDisplay.details.push({
                icon: '👥',
                text: `NPCs Met: ${recap.npcsInteracted.join(', ')}`,
                type: 'npcs'
            });
        }

        if (recap.questProgress && recap.questProgress.length > 0) {
            recapDisplay.details.push({
                icon: '📜',
                text: `Quest Progress: ${recap.questProgress.length} quest activities`,
                type: 'quests'
            });
        }

        if (recap.partyStatus) {
            recapDisplay.details.push({
                icon: '❤️',
                text: `Party Status: ${recap.partyStatus.status}`,
                type: 'status'
            });
        }

        return recapDisplay;
    }

    /**
     * Show session recap in UI
     */
    showSessionRecapUI(recap) {
        if (!recap) return;

        const recapDisplay = this.generateSessionRecapDisplay(recap);
        if (!recapDisplay) return;

        const recapHTML = `
            <div id="session-recap-modal" class="modal-overlay">
                <div class="modal-content session-recap-content">
                    <div class="modal-header">
                        <h3>${recapDisplay.title}</h3>
                        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="recap-summary">
                            <p><strong>Last Session:</strong></p>
                            <p>${recapDisplay.summary}</p>
                        </div>
                        <div class="recap-details">
                            ${recapDisplay.details.map(detail => `
                                <div class="recap-detail ${detail.type}">
                                    <span class="detail-icon">${detail.icon}</span>
                                    <span class="detail-text">${detail.text}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove()">Continue Adventure</button>
                    </div>
                </div>
            </div>
            
            <style>
                .session-recap-content {
                    max-width: 600px;
                    background: var(--color-background-primary);
                    border: 2px solid var(--color-accent);
                }
                
                .recap-summary {
                    background: var(--color-background-secondary);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing-md);
                    border-left: 4px solid var(--color-accent);
                }
                
                .recap-details {
                    display: grid;
                    gap: var(--spacing-sm);
                }
                
                .recap-detail {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm);
                    background: var(--color-background-secondary);
                    border-radius: var(--border-radius);
                }
                
                .detail-icon {
                    font-size: 1.2rem;
                    width: 24px;
                    text-align: center;
                }
                
                .detail-text {
                    color: var(--color-text-primary);
                    font-weight: 500;
                }
                
                .recap-detail.location { border-left: 3px solid var(--color-info); }
                .recap-detail.events { border-left: 3px solid var(--color-warning); }
                .recap-detail.npcs { border-left: 3px solid var(--color-success); }
                .recap-detail.quests { border-left: 3px solid var(--color-accent); }
                .recap-detail.status { border-left: 3px solid var(--color-error); }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', recapHTML);
    }

    // ===== PUBLIC API =====

    /**
     * Start a new session with continuation
     */
    async startSession() {
        return await this.startSessionWithContinuation();
    }

    /**
     * Get session opening message without starting
     */
    getSessionOpening() {
        const lastRecap = this.campaignManager?.getLastSessionRecap();
        return this.generateSessionOpening(lastRecap);
    }

    /**
     * Show recap UI for current session
     */
    showCurrentSessionRecap() {
        const lastRecap = this.campaignManager?.getLastSessionRecap();
        this.showSessionRecapUI(lastRecap);
    }
}