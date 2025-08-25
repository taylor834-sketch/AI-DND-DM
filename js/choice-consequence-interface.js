export default class ChoiceConsequenceInterface {
    constructor(core) {
        this.core = core;
        this.choiceTrackingSystem = null;
        this.decisionTreeVisualizer = null;
        this.dynamicQuestSystem = null;
        this.aiDMIntegration = null;
        this.voiceIntegration = null;
        
        // UI state
        this.currentChoicePanel = null;
        this.activeChoiceContext = null;
        this.previewMode = false;
        
        this.init();
    }

    async init() {
        // Get required modules
        this.choiceTrackingSystem = this.core.getModule('choiceTrackingSystem');
        this.decisionTreeVisualizer = this.core.getModule('decisionTreeVisualizer');
        this.dynamicQuestSystem = this.core.getModule('dynamicQuestSystem');
        this.aiDMIntegration = this.core.getModule('aiDMIntegration');
        this.voiceIntegration = this.core.getModule('voiceIntegration');
        
        // Create interface
        this.createChoiceInterface();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('🎯 Choice & Consequence Interface initialized');
    }

    /**
     * Create the main choice and consequence interface
     */
    createChoiceInterface() {
        const interfacePanel = document.createElement('div');
        interfacePanel.id = 'choice-consequence-interface';
        interfacePanel.className = 'choice-interface hidden';
        interfacePanel.innerHTML = `
            <div class="interface-header">
                <h3>🎯 Choices & Consequences</h3>
                <div class="interface-controls">
                    <button id="show-decision-tree" class="btn btn-secondary">📊 Decision Tree</button>
                    <button id="show-choice-analysis" class="btn btn-secondary">📈 Analysis</button>
                    <button id="toggle-preview-mode" class="btn btn-secondary">👁️ Preview</button>
                    <button id="close-choice-interface" class="btn btn-secondary">✕</button>
                </div>
            </div>
            
            <div class="interface-content">
                <div class="choice-panel" id="active-choice-panel">
                    <div class="choice-context">
                        <h4 id="choice-title">No Active Choice</h4>
                        <p id="choice-description">Make decisions in your adventure to see their impact here.</p>
                        <div id="choice-stakes" class="stakes-indicator hidden">
                            <span class="stakes-label">Stakes:</span>
                            <span id="stakes-level" class="stakes-level">Medium</span>
                        </div>
                    </div>
                    
                    <div class="choice-options" id="choice-options">
                        <!-- Choice options will be populated here -->
                    </div>
                    
                    <div class="consequence-preview" id="consequence-preview">
                        <h5>🔮 Potential Consequences</h5>
                        <div id="preview-content" class="preview-content">
                            <p>Enable Preview Mode to see potential consequences of your choices.</p>
                        </div>
                    </div>
                </div>
                
                <div class="personality-tracker" id="personality-tracker">
                    <h4>🎭 Your Character Arc</h4>
                    <div class="personality-traits" id="personality-display">
                        <!-- Personality traits will be populated here -->
                    </div>
                    <div class="moral-compass" id="moral-compass">
                        <div class="compass-display">
                            <span class="alignment-label">Moral Alignment:</span>
                            <span id="current-alignment" class="current-alignment">Neutral</span>
                        </div>
                    </div>
                </div>
                
                <div class="quest-impact" id="quest-impact">
                    <h4>🗞️ Quest Evolution</h4>
                    <div id="quest-status" class="quest-status">
                        <p>Your choices shape how quests evolve and interconnect.</p>
                    </div>
                    <div id="active-quest-connections" class="quest-connections">
                        <!-- Quest connections will be displayed here -->
                    </div>
                </div>
                
                <div class="butterfly-effects" id="butterfly-effects">
                    <h4>🦋 Butterfly Effects</h4>
                    <div id="butterfly-seeds" class="butterfly-seeds">
                        <p>Long-term consequences of your choices that may surface later.</p>
                    </div>
                </div>
            </div>
            
            <div class="interface-footer">
                <div class="choice-summary">
                    <div class="summary-stat">
                        <span class="stat-label">Total Choices:</span>
                        <span id="total-choices-count">0</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-label">Narrative Impact:</span>
                        <span id="total-narrative-impact">0</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-label">Active Butterfly Effects:</span>
                        <span id="active-butterfly-count">0</span>
                    </div>
                </div>
                
                <div class="quick-actions">
                    <button id="make-choice-btn" class="btn btn-primary" disabled>Make Choice</button>
                    <button id="ask-consequences-btn" class="btn btn-secondary">Ask AI DM</button>
                    <button id="voice-choice-btn" class="btn btn-accent">🎤 Voice Choice</button>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .choice-interface {
                position: fixed;
                top: 50px;
                right: 20px;
                width: 450px;
                height: calc(100vh - 100px);
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                z-index: 900;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .interface-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-md);
                background: var(--color-bg-secondary);
                border-bottom: 1px solid var(--color-border);
            }

            .interface-header h3 {
                margin: 0;
                color: var(--color-accent);
            }

            .interface-controls {
                display: flex;
                gap: var(--spacing-xs);
            }

            .interface-content {
                flex: 1;
                overflow-y: auto;
                padding: var(--spacing-md);
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .choice-panel {
                background: var(--color-bg-secondary);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-md);
            }

            .choice-context h4 {
                margin: 0 0 var(--spacing-sm) 0;
                color: var(--color-accent);
            }

            .choice-context p {
                margin: 0 0 var(--spacing-sm) 0;
                color: var(--color-text-secondary);
            }

            .stakes-indicator {
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
                margin-top: var(--spacing-sm);
            }

            .stakes-level {
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 600;
            }

            .stakes-level.low {
                background: rgba(76, 175, 80, 0.2);
                color: #4CAF50;
            }

            .stakes-level.medium {
                background: rgba(255, 152, 0, 0.2);
                color: #FF9800;
            }

            .stakes-level.high {
                background: rgba(244, 67, 54, 0.2);
                color: #F44336;
            }

            .choice-options {
                margin: var(--spacing-md) 0;
            }

            .choice-option {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-md);
                margin-bottom: var(--spacing-sm);
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
            }

            .choice-option:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: var(--color-accent);
            }

            .choice-option.selected {
                background: rgba(var(--color-accent-rgb), 0.2);
                border-color: var(--color-accent);
            }

            .choice-option-text {
                margin-bottom: var(--spacing-xs);
            }

            .choice-option-tags {
                display: flex;
                flex-wrap: wrap;
                gap: var(--spacing-xs);
            }

            .choice-tag {
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.1);
                color: var(--color-text-secondary);
            }

            .choice-tag.moral {
                background: rgba(156, 39, 176, 0.3);
                color: #E1BEE7;
            }

            .choice-tag.social {
                background: rgba(33, 150, 243, 0.3);
                color: #BBDEFB;
            }

            .choice-tag.tactical {
                background: rgba(255, 87, 34, 0.3);
                color: #FFCCBC;
            }

            .consequence-preview {
                margin-top: var(--spacing-md);
                padding-top: var(--spacing-md);
                border-top: 1px solid var(--color-border);
            }

            .consequence-preview h5 {
                margin: 0 0 var(--spacing-sm) 0;
                color: var(--color-accent);
            }

            .preview-content {
                font-size: 0.9rem;
                color: var(--color-text-secondary);
            }

            .consequence-item {
                padding: var(--spacing-xs);
                margin: var(--spacing-xs) 0;
                background: rgba(255, 255, 255, 0.05);
                border-radius: var(--border-radius);
                border-left: 3px solid var(--color-accent);
            }

            .personality-tracker, .quest-impact, .butterfly-effects {
                background: var(--color-bg-secondary);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-md);
            }

            .personality-tracker h4, .quest-impact h4, .butterfly-effects h4 {
                margin: 0 0 var(--spacing-sm) 0;
                color: var(--color-accent);
            }

            .personality-traits {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-xs);
                margin-bottom: var(--spacing-md);
            }

            .trait-display {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.8rem;
            }

            .trait-bar {
                flex: 1;
                height: 4px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
                margin: 0 var(--spacing-sm);
                position: relative;
                overflow: hidden;
            }

            .trait-progress {
                height: 100%;
                background: var(--color-accent);
                border-radius: 2px;
                transition: width 0.3s ease;
            }

            .compass-display {
                text-align: center;
                padding: var(--spacing-sm);
                background: rgba(255, 255, 255, 0.05);
                border-radius: var(--border-radius);
            }

            .current-alignment {
                font-weight: 600;
                color: var(--color-accent);
            }

            .quest-connections {
                max-height: 150px;
                overflow-y: auto;
            }

            .quest-connection {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-xs);
                margin: var(--spacing-xs) 0;
                background: rgba(255, 255, 255, 0.05);
                border-radius: var(--border-radius);
                font-size: 0.8rem;
            }

            .connection-strength {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--color-accent);
            }

            .butterfly-seeds {
                max-height: 120px;
                overflow-y: auto;
            }

            .butterfly-seed {
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
                padding: var(--spacing-xs);
                margin: var(--spacing-xs) 0;
                background: rgba(255, 215, 0, 0.1);
                border-radius: var(--border-radius);
                font-size: 0.8rem;
            }

            .interface-footer {
                padding: var(--spacing-md);
                background: var(--color-bg-secondary);
                border-top: 1px solid var(--color-border);
            }

            .choice-summary {
                display: flex;
                justify-content: space-between;
                margin-bottom: var(--spacing-md);
                font-size: 0.8rem;
            }

            .summary-stat {
                text-align: center;
            }

            .stat-label {
                display: block;
                color: var(--color-text-secondary);
            }

            .quick-actions {
                display: flex;
                gap: var(--spacing-sm);
            }

            .quick-actions .btn {
                flex: 1;
            }

            .hidden {
                display: none;
            }

            /* Responsive design */
            @media (max-width: 768px) {
                .choice-interface {
                    right: 10px;
                    left: 10px;
                    width: auto;
                }
            }
        `;

        document.head.appendChild(styles);
        document.body.appendChild(interfacePanel);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Header controls
        document.getElementById('show-decision-tree')?.addEventListener('click', () => {
            this.showDecisionTree();
        });

        document.getElementById('show-choice-analysis')?.addEventListener('click', () => {
            this.showChoiceAnalysis();
        });

        document.getElementById('toggle-preview-mode')?.addEventListener('click', () => {
            this.togglePreviewMode();
        });

        document.getElementById('close-choice-interface')?.addEventListener('click', () => {
            this.hideInterface();
        });

        // Footer actions
        document.getElementById('make-choice-btn')?.addEventListener('click', () => {
            this.makeSelectedChoice();
        });

        document.getElementById('ask-consequences-btn')?.addEventListener('click', () => {
            this.askAIDMAboutConsequences();
        });

        document.getElementById('voice-choice-btn')?.addEventListener('click', () => {
            this.enableVoiceChoice();
        });

        // Listen for choice opportunities from AI DM
        this.core.on('ai_dm:choice_opportunity', (event) => {
            this.presentChoiceOpportunity(event.detail);
        });

        // Listen for choice recording
        this.core.on('choice:recorded', (event) => {
            this.updateInterfaceAfterChoice(event.detail.choice);
        });

        // Listen for quest evolution
        this.core.on('quest:evolved', (event) => {
            this.updateQuestImpactDisplay();
        });

        // Listen for butterfly effects
        this.core.on('butterfly:effects_triggered', (event) => {
            this.updateButterflyEffectsDisplay();
        });
    }

    /**
     * Present a choice opportunity to the player
     */
    async presentChoiceOpportunity(opportunityData) {
        this.activeChoiceContext = opportunityData;
        
        // Update choice panel
        document.getElementById('choice-title').textContent = opportunityData.title || 'Important Decision';
        document.getElementById('choice-description').textContent = opportunityData.description || 'A significant choice awaits.';
        
        // Update stakes indicator
        const stakesElement = document.getElementById('choice-stakes');
        const stakesLevel = document.getElementById('stakes-level');
        
        if (opportunityData.stakes) {
            stakesElement.classList.remove('hidden');
            stakesLevel.textContent = opportunityData.stakes.charAt(0).toUpperCase() + opportunityData.stakes.slice(1);
            stakesLevel.className = `stakes-level ${opportunityData.stakes}`;
        } else {
            stakesElement.classList.add('hidden');
        }
        
        // Populate choice options
        const optionsContainer = document.getElementById('choice-options');
        optionsContainer.innerHTML = '';
        
        if (opportunityData.options && opportunityData.options.length > 0) {
            for (const option of opportunityData.options) {
                const optionElement = this.createChoiceOptionElement(option);
                optionsContainer.appendChild(optionElement);
            }
        } else {
            optionsContainer.innerHTML = '<p>Waiting for available choices...</p>';
        }
        
        // Show interface if not visible
        this.showInterface();
        
        // Update preview if enabled
        if (this.previewMode) {
            this.updateConsequencePreview();
        }
    }

    /**
     * Create a choice option element
     */
    createChoiceOptionElement(option) {
        const optionElement = document.createElement('div');
        optionElement.className = 'choice-option';
        optionElement.dataset.optionId = option.id || option.text;
        
        const optionText = document.createElement('div');
        optionText.className = 'choice-option-text';
        optionText.textContent = option.text;
        optionElement.appendChild(optionText);
        
        // Add tags if available
        if (option.tags && option.tags.length > 0) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'choice-option-tags';
            
            for (const tag of option.tags) {
                const tagElement = document.createElement('span');
                tagElement.className = `choice-tag ${tag}`;
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
            }
            
            optionElement.appendChild(tagsContainer);
        }
        
        // Add click handler
        optionElement.addEventListener('click', () => {
            this.selectChoiceOption(optionElement);
        });
        
        return optionElement;
    }

    /**
     * Select a choice option
     */
    selectChoiceOption(optionElement) {
        // Remove selection from other options
        document.querySelectorAll('.choice-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Select this option
        optionElement.classList.add('selected');
        
        // Enable make choice button
        document.getElementById('make-choice-btn').disabled = false;
        
        // Update preview if enabled
        if (this.previewMode) {
            this.updateConsequencePreview(optionElement.dataset.optionId);
        }
    }

    /**
     * Make the selected choice
     */
    async makeSelectedChoice() {
        const selectedOption = document.querySelector('.choice-option.selected');
        if (!selectedOption || !this.activeChoiceContext) return;
        
        const choiceData = {
            description: this.activeChoiceContext.title,
            options: this.activeChoiceContext.options.map(o => o.text),
            selectedOption: selectedOption.querySelector('.choice-option-text').textContent,
            context: {
                location: this.activeChoiceContext.location,
                characters: this.activeChoiceContext.characters || [],
                situation: this.activeChoiceContext.description,
                stakes: this.activeChoiceContext.stakes || 'medium'
            }
        };
        
        // Record the choice
        if (this.choiceTrackingSystem) {
            const recordedChoice = await this.choiceTrackingSystem.recordChoice(choiceData);
            console.log('📝 Choice recorded:', recordedChoice);
            
            // Provide voice feedback if available
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(`You chose: ${choiceData.selectedOption}`);
            }
        }
        
        // Clear the active choice
        this.clearActiveChoice();
        
        // Notify other systems
        this.core.emit('choice:made', { choice: choiceData });
    }

    /**
     * Update interface after a choice is made
     */
    updateInterfaceAfterChoice(choice) {
        // Update personality display
        this.updatePersonalityDisplay();
        
        // Update quest impact
        this.updateQuestImpactDisplay();
        
        // Update butterfly effects
        this.updateButterflyEffectsDisplay();
        
        // Update summary stats
        this.updateSummaryStats();
    }

    /**
     * Update personality display
     */
    updatePersonalityDisplay() {
        if (!this.choiceTrackingSystem) return;
        
        const profile = this.choiceTrackingSystem.getPersonalityProfile();
        const traitsContainer = document.getElementById('personality-display');
        const alignmentElement = document.getElementById('current-alignment');
        
        // Update traits
        traitsContainer.innerHTML = '';
        const topTraits = profile.dominantTraits.slice(0, 5);
        
        for (const trait of topTraits) {
            const traitElement = document.createElement('div');
            traitElement.className = 'trait-display';
            traitElement.innerHTML = `
                <span>${trait.trait}</span>
                <div class="trait-bar">
                    <div class="trait-progress" style="width: ${(trait.value / Math.max(...profile.dominantTraits.map(t => t.value))) * 100}%"></div>
                </div>
                <span>${trait.value}</span>
            `;
            traitsContainer.appendChild(traitElement);
        }
        
        // Update alignment
        alignmentElement.textContent = profile.moralAlignment || 'Neutral';
        alignmentElement.className = `current-alignment ${profile.moralAlignment?.toLowerCase() || 'neutral'}`;
    }

    /**
     * Update quest impact display
     */
    updateQuestImpactDisplay() {
        if (!this.dynamicQuestSystem) return;
        
        const activeQuests = this.dynamicQuestSystem.getActiveQuests();
        const questStatus = document.getElementById('quest-status');
        const connectionsContainer = document.getElementById('active-quest-connections');
        
        // Update quest status
        questStatus.innerHTML = `
            <p>Active Quests: ${activeQuests.length}</p>
            <p>Your choices are shaping ${activeQuests.filter(q => q.adaptations && q.adaptations.length > 0).length} quests.</p>
        `;
        
        // Update connections
        connectionsContainer.innerHTML = '';
        
        for (const quest of activeQuests.slice(0, 5)) {
            if (quest.adaptations && quest.adaptations.length > 0) {
                const connectionElement = document.createElement('div');
                connectionElement.className = 'quest-connection';
                connectionElement.innerHTML = `
                    <span>${quest.title}</span>
                    <div class="connection-strength" title="${quest.adaptations.length} adaptations"></div>
                `;
                connectionsContainer.appendChild(connectionElement);
            }
        }
    }

    /**
     * Update butterfly effects display
     */
    updateButterflyEffectsDisplay() {
        if (!this.choiceTrackingSystem) return;
        
        const butterflyStatus = this.choiceTrackingSystem.getButterflyEffectsStatus();
        const butterflyContainer = document.getElementById('butterfly-seeds');
        
        butterflyContainer.innerHTML = '';
        
        if (butterflyStatus.activeSeeds > 0) {
            for (const seed of butterflyStatus.seeds.slice(0, 5)) {
                const seedElement = document.createElement('div');
                seedElement.className = 'butterfly-seed';
                seedElement.innerHTML = `
                    <span>🦋</span>
                    <span>${seed.type}: ${seed.consequence}</span>
                `;
                butterflyContainer.appendChild(seedElement);
            }
        } else {
            butterflyContainer.innerHTML = '<p>Make more meaningful choices to plant seeds of future consequences.</p>';
        }
    }

    /**
     * Update summary statistics
     */
    updateSummaryStats() {
        if (!this.choiceTrackingSystem) return;
        
        const analysis = this.choiceTrackingSystem.getChoiceAnalysis();
        
        document.getElementById('total-choices-count').textContent = analysis.totalChoices;
        document.getElementById('total-narrative-impact').textContent = Math.round(analysis.narrativeImpact.totalImpact);
        document.getElementById('active-butterfly-count').textContent = analysis.butterflyEffectsActive;
    }

    /**
     * Update consequence preview
     */
    async updateConsequencePreview(selectedOptionId = null) {
        const previewContent = document.getElementById('preview-content');
        
        if (!this.previewMode || !this.activeChoiceContext) {
            previewContent.innerHTML = '<p>Enable Preview Mode to see potential consequences.</p>';
            return;
        }
        
        if (!selectedOptionId) {
            previewContent.innerHTML = '<p>Select a choice option to preview its consequences.</p>';
            return;
        }
        
        // Generate consequence preview
        const preview = await this.generateConsequencePreview(selectedOptionId);
        
        previewContent.innerHTML = '';
        for (const consequence of preview) {
            const consequenceElement = document.createElement('div');
            consequenceElement.className = 'consequence-item';
            consequenceElement.innerHTML = `
                <strong>${consequence.type}:</strong> ${consequence.description}
                ${consequence.likelihood ? `<br><small>Likelihood: ${Math.round(consequence.likelihood * 100)}%</small>` : ''}
            `;
            previewContent.appendChild(consequenceElement);
        }
    }

    /**
     * Generate consequence preview for a choice option
     */
    async generateConsequencePreview(optionId) {
        if (!this.activeChoiceContext) return [];
        
        // Find the option
        const option = this.activeChoiceContext.options.find(o => 
            (o.id || o.text) === optionId);
        if (!option) return [];
        
        const preview = [];
        
        // Relationship consequences
        if (this.activeChoiceContext.characters) {
            for (const character of this.activeChoiceContext.characters) {
                const relationshipImpact = this.predictRelationshipImpact(option, character);
                if (relationshipImpact.change !== 0) {
                    preview.push({
                        type: 'Relationship',
                        description: `${character} will ${relationshipImpact.change > 0 ? 'approve' : 'disapprove'} of this choice`,
                        likelihood: relationshipImpact.confidence
                    });
                }
            }
        }
        
        // Quest impact
        if (this.dynamicQuestSystem) {
            const questImpacts = await this.predictQuestImpacts(option);
            preview.push(...questImpacts);
        }
        
        // Moral consequences
        const moralImpact = this.predictMoralImpact(option);
        if (moralImpact.weight !== 0) {
            preview.push({
                type: 'Moral Standing',
                description: `This choice reflects ${moralImpact.weight > 0 ? 'good' : 'questionable'} values`,
                likelihood: 0.9
            });
        }
        
        return preview;
    }

    /**
     * Clear active choice display
     */
    clearActiveChoice() {
        this.activeChoiceContext = null;
        
        document.getElementById('choice-title').textContent = 'No Active Choice';
        document.getElementById('choice-description').textContent = 'Make decisions in your adventure to see their impact here.';
        document.getElementById('choice-stakes').classList.add('hidden');
        document.getElementById('choice-options').innerHTML = '';
        document.getElementById('make-choice-btn').disabled = true;
        
        // Clear preview
        if (this.previewMode) {
            document.getElementById('preview-content').innerHTML = '<p>No active choice to preview.</p>';
        }
    }

    /**
     * Show decision tree visualization
     */
    async showDecisionTree() {
        if (this.decisionTreeVisualizer) {
            await this.decisionTreeVisualizer.show();
        }
    }

    /**
     * Show choice analysis
     */
    showChoiceAnalysis() {
        if (!this.choiceTrackingSystem) return;
        
        const analysis = this.choiceTrackingSystem.getChoiceAnalysis();
        
        // Create analysis modal
        const modal = document.createElement('div');
        modal.className = 'analysis-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📈 Choice Analysis</h3>
                    <button class="close-modal">✕</button>
                </div>
                <div class="modal-body">
                    <div class="analysis-section">
                        <h4>Overall Statistics</h4>
                        <p>Total Choices Made: ${analysis.totalChoices}</p>
                        <p>Average Narrative Impact: ${analysis.narrativeImpact.averageImpact.toFixed(1)}/10</p>
                        <p>Moral Alignment: ${analysis.moralProfile.alignment}</p>
                    </div>
                    
                    <div class="analysis-section">
                        <h4>Choice Categories</h4>
                        ${Object.entries(analysis.categoryBreakdown).map(([category, count]) => 
                            `<p>${category}: ${count}</p>`
                        ).join('')}
                    </div>
                    
                    <div class="analysis-section">
                        <h4>Key Decisions</h4>
                        ${analysis.keyDecisions.map(decision => 
                            `<p><strong>${decision.description}</strong> (Impact: ${decision.narrativeImpact})</p>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add close handler
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    /**
     * Toggle consequence preview mode
     */
    togglePreviewMode() {
        this.previewMode = !this.previewMode;
        const button = document.getElementById('toggle-preview-mode');
        
        if (this.previewMode) {
            button.textContent = '👁️ Preview ON';
            button.classList.add('active');
        } else {
            button.textContent = '👁️ Preview';
            button.classList.remove('active');
        }
        
        this.updateConsequencePreview();
    }

    /**
     * Ask AI DM about consequences
     */
    async askAIDMAboutConsequences() {
        if (!this.aiDMIntegration || !this.activeChoiceContext) return;
        
        const query = `What might be the consequences of the choices in this situation: ${this.activeChoiceContext.description}?`;
        
        try {
            const response = await this.aiDMIntegration.sendQuery(query, 'consequences');
            
            // Display AI DM response
            const previewContent = document.getElementById('preview-content');
            previewContent.innerHTML = `
                <div class="ai-dm-response">
                    <h6>🎭 AI DM Insight:</h6>
                    <p>${response}</p>
                </div>
            `;
            
            // Provide voice response if available
            if (this.voiceIntegration) {
                await this.voiceIntegration.speak(response);
            }
        } catch (error) {
            console.error('Failed to get AI DM response:', error);
        }
    }

    /**
     * Enable voice choice selection
     */
    async enableVoiceChoice() {
        if (!this.voiceIntegration || !this.activeChoiceContext) return;
        
        // Start voice recognition for choice selection
        const voicePrompt = `You can speak your choice. The options are: ${
            this.activeChoiceContext.options.map((o, i) => `${i + 1}: ${o.text}`).join(', ')
        }`;
        
        if (this.voiceIntegration) {
            await this.voiceIntegration.speak(voicePrompt);
            // Voice integration would handle the rest
        }
    }

    /**
     * Show the interface
     */
    showInterface() {
        document.getElementById('choice-consequence-interface').classList.remove('hidden');
        this.updatePersonalityDisplay();
        this.updateQuestImpactDisplay();
        this.updateButterflyEffectsDisplay();
        this.updateSummaryStats();
    }

    /**
     * Hide the interface
     */
    hideInterface() {
        document.getElementById('choice-consequence-interface').classList.add('hidden');
    }

    // ===== PREDICTION HELPER METHODS =====

    predictRelationshipImpact(option, character) {
        // Simplified relationship prediction
        const text = option.text.toLowerCase();
        let change = 0;
        let confidence = 0.5;
        
        if (text.includes('help') || text.includes('agree')) {
            change = 1;
            confidence = 0.7;
        } else if (text.includes('refuse') || text.includes('disagree')) {
            change = -1;
            confidence = 0.7;
        }
        
        return { change, confidence };
    }

    async predictQuestImpacts(option) {
        const impacts = [];
        
        if (this.dynamicQuestSystem) {
            const activeQuests = this.dynamicQuestSystem.getActiveQuests();
            
            for (const quest of activeQuests.slice(0, 3)) {
                if (this.isChoiceRelevantToQuest(option, quest)) {
                    impacts.push({
                        type: 'Quest Evolution',
                        description: `May affect the quest "${quest.title}"`,
                        likelihood: 0.6
                    });
                }
            }
        }
        
        return impacts;
    }

    predictMoralImpact(option) {
        const text = option.text.toLowerCase();
        let weight = 0;
        
        if (text.includes('help') || text.includes('save') || text.includes('protect')) {
            weight = 1;
        } else if (text.includes('kill') || text.includes('steal') || text.includes('betray')) {
            weight = -1;
        }
        
        return { weight };
    }

    isChoiceRelevantToQuest(option, quest) {
        const optionText = option.text.toLowerCase();
        const questNPCs = quest.context?.npcs || [];
        const questThemes = quest.context?.themes || [];
        
        // Check if choice mentions quest NPCs or themes
        for (const npc of questNPCs) {
            if (optionText.includes(npc.toLowerCase())) {
                return true;
            }
        }
        
        for (const theme of questThemes) {
            if (optionText.includes(theme.toLowerCase())) {
                return true;
            }
        }
        
        return false;
    }

    // ===== PUBLIC API =====

    /**
     * Present choice externally
     */
    async presentChoice(choiceData) {
        await this.presentChoiceOpportunity(choiceData);
    }

    /**
     * Show/hide interface externally
     */
    show() {
        this.showInterface();
    }

    hide() {
        this.hideInterface();
    }

    /**
     * Check if interface is currently showing a choice
     */
    hasActiveChoice() {
        return this.activeChoiceContext !== null;
    }
}