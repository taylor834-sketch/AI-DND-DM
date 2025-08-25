export default class AIDMInterface {
    constructor(core) {
        this.core = core;
        this.aiDMIntegration = null;
        this.interactionHistory = null;
        this.ui = null;
        
        // Interface state
        this.isProcessing = false;
        this.currentContext = null;
        this.lastResponse = null;
        
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.aiDMIntegration = this.core.getModule('aiDMIntegration');
            this.interactionHistory = this.core.getModule('interactionHistory');
            this.ui = this.core.getModule('ui');
            
            this.createAIDMInterface();
            console.log('🤖 AI DM Interface initialized');
        });
    }

    createAIDMInterface() {
        const aiDMPanel = document.createElement('div');
        aiDMPanel.id = 'ai-dm-panel';
        aiDMPanel.className = 'game-panel';
        aiDMPanel.innerHTML = `
            <div class="ai-dm-header">
                <h2>🎲 AI Dungeon Master</h2>
                <div class="ai-dm-status" id="ai-status">Ready</div>
            </div>
            
            <div class="ai-dm-content">
                <div class="context-display" id="context-display">
                    <h3>Current Context</h3>
                    <div class="context-summary" id="context-summary">
                        <p><em>Click "Generate Context" to build AI context from current world state.</em></p>
                    </div>
                    <div class="context-actions">
                        <button class="btn btn-secondary" id="generate-context">Generate Context</button>
                        <button class="btn btn-secondary" id="show-full-context">View Full Context</button>
                        <select id="situation-type" class="situation-select">
                            <option value="general">General</option>
                            <option value="combat">Combat</option>
                            <option value="social">Social</option>
                            <option value="exploration">Exploration</option>
                        </select>
                    </div>
                </div>
                
                <div class="ai-input-section">
                    <h3>AI DM Input</h3>
                    <textarea 
                        id="ai-input" 
                        placeholder="Enter AI DM response here. Use tags like [NEW_CHARACTER: Name | Role | Description] to create entities, [UPDATE_RELATIONSHIP: NPC | Change | Reason] to update relationships, etc."
                        rows="6"
                    ></textarea>
                    <div class="input-actions">
                        <button class="btn btn-primary" id="process-response">Process Response</button>
                        <button class="btn btn-secondary" id="simulate-response">Simulate AI Response</button>
                        <button class="btn btn-secondary" id="clear-input">Clear</button>
                    </div>
                </div>
                
                <div class="response-display" id="response-display">
                    <h3>Processed Response</h3>
                    <div class="processed-content" id="processed-content">
                        <p><em>Processed AI response will appear here.</em></p>
                    </div>
                    <div class="processing-results" id="processing-results">
                        <!-- Processing results will be populated here -->
                    </div>
                </div>
                
                <div class="ai-dm-tools">
                    <h3>DM Tools</h3>
                    <div class="tool-buttons">
                        <button class="btn btn-secondary" id="view-history">View Interaction History</button>
                        <button class="btn btn-secondary" id="context-settings">Context Settings</button>
                        <button class="btn btn-secondary" id="safety-settings">Safety Settings</button>
                        <button class="btn btn-secondary" id="export-session">Export Session</button>
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles
        const styles = `
            <style>
                .ai-dm-panel {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: var(--spacing-lg);
                    background: var(--color-background-primary);
                    border-radius: var(--border-radius);
                }

                .ai-dm-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-lg);
                    padding-bottom: var(--spacing-md);
                    border-bottom: 2px solid var(--color-border);
                }

                .ai-dm-header h2 {
                    margin: 0;
                    color: var(--color-accent);
                    font-family: var(--font-title);
                }

                .ai-dm-status {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    background: var(--color-background-secondary);
                    border-radius: var(--border-radius);
                    font-weight: 600;
                    color: var(--color-text-primary);
                }

                .ai-dm-status.processing {
                    background: var(--color-warning);
                    color: var(--color-text-dark);
                }

                .ai-dm-status.ready {
                    background: var(--color-success);
                    color: var(--color-text-dark);
                }

                .ai-dm-status.error {
                    background: var(--color-error);
                    color: var(--color-text-light);
                }

                .ai-dm-content > div {
                    margin-bottom: var(--spacing-xl);
                    padding: var(--spacing-md);
                    background: var(--color-background-secondary);
                    border-radius: var(--border-radius);
                }

                .context-summary {
                    background: var(--color-background-primary);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                    border-left: 4px solid var(--color-accent);
                    margin-bottom: var(--spacing-md);
                    max-height: 300px;
                    overflow-y: auto;
                }

                .context-actions, .input-actions, .tool-buttons {
                    display: flex;
                    gap: var(--spacing-sm);
                    flex-wrap: wrap;
                }

                .situation-select {
                    padding: var(--spacing-xs);
                    background: var(--color-background-primary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--border-radius);
                    color: var(--color-text-primary);
                }

                #ai-input {
                    width: 100%;
                    padding: var(--spacing-sm);
                    background: var(--color-background-primary);
                    border: 1px solid var(--color-border);
                    border-radius: var(--border-radius);
                    color: var(--color-text-primary);
                    font-family: monospace;
                    resize: vertical;
                }

                .processed-content {
                    background: var(--color-background-primary);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                    border-left: 4px solid var(--color-success);
                    margin-bottom: var(--spacing-md);
                    white-space: pre-wrap;
                    font-family: var(--font-body);
                }

                .processing-results {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: var(--spacing-md);
                }

                .result-section {
                    background: var(--color-background-primary);
                    padding: var(--spacing-sm);
                    border-radius: var(--border-radius);
                    border-left: 4px solid var(--color-info);
                }

                .result-section h4 {
                    margin: 0 0 var(--spacing-xs) 0;
                    color: var(--color-accent);
                    font-size: 0.9rem;
                }

                .result-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .result-list li {
                    padding: var(--spacing-xs) 0;
                    border-bottom: 1px solid var(--color-border);
                    font-size: 0.85rem;
                }

                .result-list li:last-child {
                    border-bottom: none;
                }

                .success { color: var(--color-success); }
                .warning { color: var(--color-warning); }
                .error { color: var(--color-error); }

                .token-usage {
                    display: flex;
                    justify-content: space-between;
                    padding: var(--spacing-xs) var(--spacing-sm);
                    background: var(--color-background-primary);
                    border-radius: var(--border-radius);
                    font-size: 0.8rem;
                    color: var(--color-text-secondary);
                }

                .context-priority {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 0.7rem;
                    font-weight: bold;
                    text-transform: uppercase;
                }

                .priority-critical { background: var(--color-error); color: white; }
                .priority-important { background: var(--color-warning); color: var(--color-text-dark); }
                .priority-supplementary { background: var(--color-info); color: white; }
            </style>
        `;

        // Add to document
        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.appendChild(aiDMPanel);

        this.bindEvents();
    }

    bindEvents() {
        // Generate context button
        document.getElementById('generate-context')?.addEventListener('click', async () => {
            await this.generateContext();
        });

        // Show full context button
        document.getElementById('show-full-context')?.addEventListener('click', () => {
            this.showFullContextModal();
        });

        // Process response button
        document.getElementById('process-response')?.addEventListener('click', async () => {
            await this.processAIResponse();
        });

        // Simulate response button
        document.getElementById('simulate-response')?.addEventListener('click', () => {
            this.simulateAIResponse();
        });

        // Clear input button
        document.getElementById('clear-input')?.addEventListener('click', () => {
            document.getElementById('ai-input').value = '';
            this.clearResults();
        });

        // Tool buttons
        document.getElementById('view-history')?.addEventListener('click', () => {
            this.showHistoryModal();
        });

        document.getElementById('context-settings')?.addEventListener('click', () => {
            this.showContextSettings();
        });

        document.getElementById('safety-settings')?.addEventListener('click', () => {
            this.showSafetySettings();
        });

        document.getElementById('export-session')?.addEventListener('click', () => {
            this.exportSession();
        });
    }

    // ===== MAIN FUNCTIONALITY =====

    async generateContext() {
        if (!this.aiDMIntegration) return;

        this.setStatus('processing', 'Generating context...');
        
        try {
            const situationType = document.getElementById('situation-type').value;
            const context = await this.aiDMIntegration.getAIDMContext(situationType, {
                includeHistory: true,
                maxHistoryItems: 15,
                prioritizeRecent: true
            });

            this.currentContext = context;
            this.displayContextSummary(context);
            this.setStatus('ready', 'Context generated');

        } catch (error) {
            console.error('Context generation failed:', error);
            this.setStatus('error', 'Context generation failed');
        }
    }

    async processAIResponse() {
        const aiInput = document.getElementById('ai-input').value.trim();
        if (!aiInput) {
            alert('Please enter an AI response to process');
            return;
        }

        if (!this.aiDMIntegration) return;

        this.setStatus('processing', 'Processing response...');
        
        try {
            const results = await this.aiDMIntegration.processResponse(aiInput);
            
            this.lastResponse = results;
            this.displayProcessedResponse(results);
            this.displayProcessingResults(results);
            
            // Record the AI response in interaction history
            if (this.interactionHistory) {
                this.interactionHistory.recordAIResponse({
                    originalResponse: aiInput,
                    processedResponse: results.processedResponse,
                    entitiesCreated: results.entitiesCreated,
                    relationshipsUpdated: results.relationshipsUpdated,
                    questsUpdated: results.questsUpdated,
                    errors: results.errorsEncountered,
                    warnings: results.warnings,
                    contextType: document.getElementById('situation-type').value,
                    contextTokens: this.currentContext ? 
                        this.aiDMIntegration.getTokenEstimate(this.currentContext) : 0
                });
            }

            this.setStatus('ready', 'Response processed');

        } catch (error) {
            console.error('Response processing failed:', error);
            this.setStatus('error', 'Response processing failed');
        }
    }

    simulateAIResponse() {
        const situationType = document.getElementById('situation-type').value;
        const templates = {
            general: `The party finds themselves at a crossroads. To the north, ancient ruins peek through the morning mist. To the east, smoke rises from what appears to be a small settlement.

[NEW_LOCATION: Misty Ruins | Ancient Ruins | Crumbling stone structures covered in mystical fog]

What would you like to do?`,

            social: `Elara the merchant approaches with a concerned expression. "Travelers! I'm glad to see friendly faces. Bandits have been threatening merchant caravans on the main road."

[NEW_CHARACTER: Elara | Merchant | A weathered trader concerned about bandit attacks]
[UPDATE_RELATIONSHIP: Elara | +5 | First meeting, seeking help]

She offers information about safe passage in exchange for protection.`,

            combat: `A growling sound echoes from the shadows as three dire wolves emerge, their eyes glowing with unnatural hunger. They've caught your scent and are preparing to attack!

[NEW_MONSTER: Dire Wolf Pack | 2 | Three aggressive dire wolves hunting as a pack]

Roll for initiative! The wolves are 30 feet away and moving closer.`,

            exploration: `Your investigation of the old library reveals a hidden compartment behind a false wall. Inside, you discover an ancient journal written in an unfamiliar script, along with a small crystalline orb that pulses with faint magical energy.

[NEW_LOCATION: Hidden Library Chamber | Secret Room | A concealed chamber containing ancient knowledge]

The journal appears to contain information about the local area from centuries past.`
        };

        const template = templates[situationType] || templates.general;
        document.getElementById('ai-input').value = template;
    }

    // ===== DISPLAY FUNCTIONS =====

    displayContextSummary(context) {
        const summaryDiv = document.getElementById('context-summary');
        
        let html = `
            <div class="token-usage">
                <span>Estimated Tokens: <strong>${context.tokenUsage.critical + context.tokenUsage.important + context.tokenUsage.supplementary}</strong></span>
                <span>Budget: <strong>${context.metadata.tokenBudget}</strong></span>
            </div>
            
            <h4><span class="context-priority priority-critical">Critical</span> Context</h4>
            <ul class="result-list">
                ${context.critical.currentLocation ? `<li><strong>Location:</strong> ${context.critical.currentLocation.name} (${context.critical.currentLocation.type})</li>` : '<li>No current location set</li>'}
                <li><strong>Party Level:</strong> ${context.critical.partyStatus.level}</li>
                <li><strong>Health:</strong> ${context.critical.partyStatus.health}</li>
                <li><strong>Active Quests:</strong> ${context.critical.activeQuests.length}</li>
            </ul>
        `;

        if (context.important) {
            html += `
                <h4><span class="context-priority priority-important">Important</span> Context</h4>
                <ul class="result-list">
                    ${context.important.relationships ? `<li><strong>Key Relationships:</strong> ${context.important.relationships.length || 0} NPCs</li>` : ''}
                    ${context.important.recentEvents ? `<li><strong>Recent Events:</strong> ${context.important.recentEvents.recent?.length || 0} events</li>` : ''}
                    ${context.important.relevantNPCs ? `<li><strong>Nearby NPCs:</strong> ${context.important.relevantNPCs.length || 0}</li>` : ''}
                </ul>
            `;
        }

        if (context.supplementary) {
            html += `
                <h4><span class="context-priority priority-supplementary">Supplementary</span> Context</h4>
                <ul class="result-list">
                    ${context.supplementary.worldHistory ? `<li><strong>World History:</strong> ${context.supplementary.worldHistory.majorEvents?.length || 0} major events</li>` : ''}
                    ${context.supplementary.factionStatus ? `<li><strong>Factions:</strong> ${context.supplementary.factionStatus.factions?.length || 0} known</li>` : ''}
                    ${context.supplementary.discoveredMonsters ? `<li><strong>Known Monsters:</strong> ${context.supplementary.discoveredMonsters.totalDiscovered || 0}</li>` : ''}
                </ul>
            `;
        }

        summaryDiv.innerHTML = html;
    }

    displayProcessedResponse(results) {
        const contentDiv = document.getElementById('processed-content');
        contentDiv.textContent = results.processedResponse || 'No processed response';
    }

    displayProcessingResults(results) {
        const resultsDiv = document.getElementById('processing-results');
        
        let html = '';

        // Entities created
        if (results.entitiesCreated.length > 0) {
            html += `
                <div class="result-section">
                    <h4>🎭 Entities Created</h4>
                    <ul class="result-list">
                        ${results.entitiesCreated.map(entity => 
                            `<li class="success">${entity.entityType}: ${entity.message}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }

        // Relationships updated
        if (results.relationshipsUpdated.length > 0) {
            html += `
                <div class="result-section">
                    <h4>💫 Relationships Updated</h4>
                    <ul class="result-list">
                        ${results.relationshipsUpdated.map(rel => 
                            `<li class="success">${rel.message}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }

        // Quests updated
        if (results.questsUpdated.length > 0) {
            html += `
                <div class="result-section">
                    <h4>📜 Quests Updated</h4>
                    <ul class="result-list">
                        ${results.questsUpdated.map(quest => 
                            `<li class="success">${quest.message}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }

        // Warnings
        if (results.warnings.length > 0) {
            html += `
                <div class="result-section">
                    <h4>⚠️ Warnings</h4>
                    <ul class="result-list">
                        ${results.warnings.map(warning => 
                            `<li class="warning">${warning}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }

        // Errors
        if (results.errorsEncountered.length > 0) {
            html += `
                <div class="result-section">
                    <h4>❌ Errors</h4>
                    <ul class="result-list">
                        ${results.errorsEncountered.map(error => 
                            `<li class="error">${error}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }

        if (html === '') {
            html = '<div class="result-section"><p><em>No database changes were made.</em></p></div>';
        }

        resultsDiv.innerHTML = html;
    }

    clearResults() {
        document.getElementById('processed-content').innerHTML = '<p><em>Processed AI response will appear here.</em></p>';
        document.getElementById('processing-results').innerHTML = '';
    }

    setStatus(type, message) {
        const statusDiv = document.getElementById('ai-status');
        statusDiv.className = `ai-dm-status ${type}`;
        statusDiv.textContent = message;
    }

    // ===== MODAL FUNCTIONS =====

    showFullContextModal() {
        if (!this.currentContext) {
            alert('No context generated yet. Click "Generate Context" first.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>🧠 Full AI Context</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <pre style="background: var(--color-background-secondary); padding: var(--spacing-md); border-radius: var(--border-radius); white-space: pre-wrap; font-size: 0.85rem;">${JSON.stringify(this.currentContext, null, 2)}</pre>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                    <button class="btn btn-primary" onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(this.currentContext)}, null, 2)); alert('Context copied to clipboard!')">Copy to Clipboard</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    showHistoryModal() {
        if (!this.interactionHistory) return;

        const recentHistory = this.interactionHistory.getAIRelevantHistory({
            maxItems: 20,
            timeWindow: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3>📜 Interaction History</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="history-list">
                        ${recentHistory.length > 0 ? 
                            recentHistory.map(event => `
                                <div class="history-entry" style="margin-bottom: var(--spacing-md); padding: var(--spacing-sm); background: var(--color-background-secondary); border-radius: var(--border-radius);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-xs);">
                                        <span class="event-type" style="font-weight: bold; color: var(--color-accent);">${event.type.toUpperCase()}</span>
                                        <span class="event-time" style="font-size: 0.8rem; color: var(--color-text-secondary);">${new Date(event.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div class="event-summary">${event.summary}</div>
                                    ${event.location ? `<div class="event-location" style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: var(--spacing-xs);">📍 ${event.location}</div>` : ''}
                                </div>
                            `).join('') :
                            '<p><em>No interaction history available.</em></p>'
                        }
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    showContextSettings() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚙️ Context Settings</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Context settings help control what information the AI DM receives:</p>
                    <div class="setting-group">
                        <label>
                            <input type="number" id="max-history-items" value="15" min="5" max="50" />
                            Maximum history items to include
                        </label>
                    </div>
                    <div class="setting-group">
                        <label>
                            <input type="checkbox" id="prioritize-recent" checked />
                            Prioritize recent events
                        </label>
                    </div>
                    <div class="setting-group">
                        <label>
                            <input type="number" id="token-budget" value="4000" min="1000" max="8000" />
                            Token budget for context
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="this.saveContextSettings(); this.parentElement.parentElement.parentElement.remove()">Save Settings</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    showSafetySettings() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🛡️ Safety Settings</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Safety settings prevent the AI from making excessive changes:</p>
                    <div class="setting-group">
                        <label>
                            <input type="number" id="max-entities" value="5" min="1" max="10" />
                            Maximum entities created per response
                        </label>
                    </div>
                    <div class="setting-group">
                        <label>
                            <input type="number" id="max-relationship-changes" value="10" min="1" max="20" />
                            Maximum relationship changes per response
                        </label>
                    </div>
                    <div class="setting-group">
                        <label>
                            <input type="checkbox" id="validate-entities" checked />
                            Validate entity creation
                        </label>
                    </div>
                    <div class="setting-group">
                        <label>
                            <input type="checkbox" id="require-confirmation" />
                            Require confirmation for major changes
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="this.saveSafetySettings(); this.parentElement.parentElement.parentElement.remove()">Save Settings</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    exportSession() {
        if (!this.interactionHistory) return;

        const sessionData = this.interactionHistory.endSession({
            sessionId: `session_${Date.now()}`,
            startTime: new Date(Date.now() - (3 * 60 * 60 * 1000)).toISOString() // 3 hours ago
        });

        // Create download
        const blob = new Blob([JSON.stringify({
            sessionSummary: sessionData,
            currentContext: this.currentContext,
            lastResponse: this.lastResponse
        }, null, 2)], { type: 'application/json' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-dm-session-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('Session exported successfully!');
    }

    saveContextSettings() {
        // These would be saved to user preferences
        console.log('Context settings saved');
    }

    saveSafetySettings() {
        if (this.aiDMIntegration) {
            const safetyConfig = {
                maxEntitiesPerRequest: parseInt(document.getElementById('max-entities').value),
                maxRelationshipChanges: parseInt(document.getElementById('max-relationship-changes').value),
                validateEntityCreation: document.getElementById('validate-entities').checked,
                requireConfirmation: document.getElementById('require-confirmation').checked
            };

            this.aiDMIntegration.configureSafety(safetyConfig);
            console.log('Safety settings saved');
        }
    }

    // ===== PUBLIC API =====

    showAIDMPanel() {
        const panel = document.getElementById('ai-dm-panel');
        if (panel) {
            panel.style.display = 'block';
            panel.scrollIntoView({ behavior: 'smooth' });
        }
    }

    hideAIDMPanel() {
        const panel = document.getElementById('ai-dm-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
}