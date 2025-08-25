export default class RelationshipUI {
    constructor(core) {
        this.core = core;
        this.relationshipSystem = null;
        this.worldDatabase = null;
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.relationshipSystem = this.core.getModule('relationshipSystem');
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.setupUI();
        });

        this.core.on('ui:screenShown', (event) => {
            if (event.detail.screen === 'worldBrowser') {
                this.updateWorldBrowserIndicators();
            }
        });

        this.core.on('relationship:individual:updated', (event) => {
            this.updateNPCIndicators(event.detail.npcId);
        });

        this.core.on('relationship:faction:updated', (event) => {
            this.updateFactionIndicators(event.detail.factionId);
        });

        this.core.on('relationship:companion:updated', (event) => {
            this.updateCompanionIndicators(event.detail.companionId);
        });
    }

    setupUI() {
        this.createRelationshipIndicatorStyles();
        this.injectRelationshipIndicators();
        this.setupRelationshipTooltips();
    }

    createRelationshipIndicatorStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Relationship Indicators */
            .relationship-indicator {
                position: relative;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 0.8rem;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 12px;
                transition: all 0.2s ease;
                cursor: help;
            }

            .relationship-indicator-icon {
                font-size: 0.9rem;
                line-height: 1;
            }

            .relationship-indicator-value {
                font-size: 0.7rem;
                opacity: 0.9;
            }

            /* Trust Level Colors */
            .trust-enemy { background: rgba(220, 20, 60, 0.2); color: #DC143C; border: 1px solid #DC143C; }
            .trust-unfriendly { background: rgba(255, 140, 0, 0.2); color: #FF8C00; border: 1px solid #FF8C00; }
            .trust-neutral { background: rgba(128, 128, 128, 0.2); color: #808080; border: 1px solid #808080; }
            .trust-friendly { background: rgba(50, 205, 50, 0.2); color: #32CD32; border: 1px solid #32CD32; }
            .trust-ally { background: rgba(65, 105, 225, 0.2); color: #4169E1; border: 1px solid #4169E1; }
            .trust-devoted { background: rgba(255, 215, 0, 0.2); color: #FFD700; border: 1px solid #FFD700; }

            /* Romance Indicators */
            .romance-indicator {
                background: rgba(255, 105, 180, 0.2);
                color: #FF69B4;
                border: 1px solid #FF69B4;
                animation: pulse-romance 2s infinite;
            }

            @keyframes pulse-romance {
                0%, 100% { box-shadow: 0 0 0 0 rgba(255, 105, 180, 0.4); }
                50% { box-shadow: 0 0 0 4px rgba(255, 105, 180, 0); }
            }

            /* Faction Reputation Colors */
            .rep-hated { background: rgba(139, 0, 0, 0.2); color: #8B0000; border: 1px solid #8B0000; }
            .rep-hostile { background: rgba(220, 20, 60, 0.2); color: #DC143C; border: 1px solid #DC143C; }
            .rep-unfriendly { background: rgba(255, 99, 71, 0.2); color: #FF6347; border: 1px solid #FF6347; }
            .rep-neutral { background: rgba(128, 128, 128, 0.2); color: #808080; border: 1px solid #808080; }
            .rep-friendly { background: rgba(50, 205, 50, 0.2); color: #32CD32; border: 1px solid #32CD32; }
            .rep-honored { background: rgba(65, 105, 225, 0.2); color: #4169E1; border: 1px solid #4169E1; }
            .rep-revered { background: rgba(255, 215, 0, 0.2); color: #FFD700; border: 1px solid #FFD700; }

            /* Companion Approval Indicators */
            .approval-hatred { background: rgba(139, 0, 0, 0.2); color: #8B0000; border: 1px solid #8B0000; }
            .approval-dislike { background: rgba(255, 140, 0, 0.2); color: #FF8C00; border: 1px solid #FF8C00; }
            .approval-neutral { background: rgba(135, 206, 235, 0.2); color: #87CEEB; border: 1px solid #87CEEB; }
            .approval-like { background: rgba(50, 205, 50, 0.2); color: #32CD32; border: 1px solid #32CD32; }
            .approval-love { background: rgba(255, 105, 180, 0.2); color: #FF69B4; border: 1px solid #FF69B4; }
            .approval-devoted { background: rgba(255, 215, 0, 0.2); color: #FFD700; border: 1px solid #FFD700; }

            /* Relationship Tooltip */
            .relationship-tooltip {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: var(--color-background-tertiary);
                color: var(--color-text-primary);
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.8rem;
                white-space: nowrap;
                box-shadow: var(--shadow-md);
                border: 1px solid var(--color-border);
                z-index: 1000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
                margin-bottom: 4px;
            }

            .relationship-tooltip::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 4px solid transparent;
                border-top-color: var(--color-background-tertiary);
            }

            .relationship-indicator:hover .relationship-tooltip {
                opacity: 1;
            }

            /* Relationship Status Bar */
            .relationship-status-bar {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                align-items: center;
                margin: 8px 0;
                padding: 8px;
                background: var(--color-background-secondary);
                border-radius: var(--border-radius-sm);
                border: 1px solid var(--color-border);
            }

            .relationship-status-label {
                color: var(--color-text-secondary);
                font-size: 0.8rem;
                font-weight: 600;
                margin-right: 4px;
            }

            /* Trust Progress Bar */
            .trust-progress-bar {
                position: relative;
                width: 100px;
                height: 8px;
                background: var(--color-background-secondary);
                border-radius: 4px;
                overflow: hidden;
                margin: 0 8px;
            }

            .trust-progress-fill {
                height: 100%;
                transition: width 0.3s ease, background-color 0.3s ease;
                border-radius: 4px;
            }

            .trust-progress-fill.enemy { background: linear-gradient(90deg, #8B0000, #DC143C); }
            .trust-progress-fill.unfriendly { background: linear-gradient(90deg, #DC143C, #FF8C00); }
            .trust-progress-fill.neutral { background: linear-gradient(90deg, #FF8C00, #32CD32); }
            .trust-progress-fill.friendly { background: linear-gradient(90deg, #32CD32, #4169E1); }
            .trust-progress-fill.ally { background: linear-gradient(90deg, #4169E1, #FFD700); }
            .trust-progress-fill.devoted { background: linear-gradient(90deg, #FFD700, #FFFFFF); }

            /* Relationship Details Panel */
            .relationship-details-panel {
                background: var(--color-background-tertiary);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius-md);
                padding: var(--spacing-md);
                margin: var(--spacing-sm) 0;
            }

            .relationship-section {
                margin-bottom: var(--spacing-md);
            }

            .relationship-section:last-child {
                margin-bottom: 0;
            }

            .relationship-section-title {
                color: var(--color-accent);
                font-family: var(--font-title);
                font-size: 1rem;
                margin-bottom: var(--spacing-sm);
                border-bottom: 1px solid var(--color-border);
                padding-bottom: var(--spacing-xs);
            }

            .relationship-entry {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-xs) 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .relationship-entry:last-child {
                border-bottom: none;
            }

            .relationship-name {
                color: var(--color-text-primary);
                font-weight: 600;
            }

            .relationship-change {
                font-size: 0.8rem;
                font-weight: 600;
            }

            .relationship-change.positive {
                color: var(--color-success);
            }

            .relationship-change.negative {
                color: var(--color-error);
            }

            .relationship-change.neutral {
                color: var(--color-text-secondary);
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
                .relationship-status-bar {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                }
                
                .trust-progress-bar {
                    width: 100%;
                    margin: 4px 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    injectRelationshipIndicators() {
        // Add indicators to NPC cards in world browser
        this.addNPCCardIndicators();
        
        // Add indicators to faction cards
        this.addFactionCardIndicators();
        
        // Add companion approval indicators
        this.addCompanionIndicators();
    }

    addNPCCardIndicators() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const npcCards = node.querySelectorAll?.('.npc-card') || [];
                            npcCards.forEach(card => this.enhanceNPCCard(card));
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Process existing cards
        document.querySelectorAll('.npc-card').forEach(card => this.enhanceNPCCard(card));
    }

    enhanceNPCCard(card) {
        const npcId = card.dataset.id;
        if (!npcId || card.querySelector('.relationship-status-bar')) return;

        const indicator = this.createRelationshipIndicator(npcId, 'npc');
        const statusBar = this.createRelationshipStatusBar(npcId, 'npc');
        
        // Insert after card header
        const cardHeader = card.querySelector('.card-header');
        if (cardHeader) {
            cardHeader.appendChild(indicator);
            cardHeader.parentNode.insertBefore(statusBar, cardHeader.nextSibling);
        }
    }

    addFactionCardIndicators() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const factionCards = node.querySelectorAll?.('.faction-card') || [];
                            factionCards.forEach(card => this.enhanceFactionCard(card));
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Process existing cards
        document.querySelectorAll('.faction-card').forEach(card => this.enhanceFactionCard(card));
    }

    enhanceFactionCard(card) {
        const factionId = card.dataset.id;
        if (!factionId || card.querySelector('.relationship-status-bar')) return;

        const indicator = this.createRelationshipIndicator(factionId, 'faction');
        const statusBar = this.createRelationshipStatusBar(factionId, 'faction');
        
        // Insert after card header
        const cardHeader = card.querySelector('.card-header');
        if (cardHeader) {
            cardHeader.appendChild(indicator);
            cardHeader.parentNode.insertBefore(statusBar, cardHeader.nextSibling);
        }
    }

    addCompanionIndicators() {
        // Add to character sheet companion section if it exists
        const characterSwitcher = document.getElementById('character-switcher');
        if (characterSwitcher) {
            this.enhanceCharacterSwitcher(characterSwitcher);
        }
    }

    enhanceCharacterSwitcher(switcher) {
        const observer = new MutationObserver(() => {
            this.updateCharacterSwitcherIndicators();
        });

        observer.observe(switcher, {
            childList: true,
            subtree: true
        });

        this.updateCharacterSwitcherIndicators();
    }

    updateCharacterSwitcherIndicators() {
        const switcher = document.getElementById('character-switcher');
        if (!switcher) return;

        const options = switcher.querySelectorAll('option');
        options.forEach(option => {
            const characterId = option.value;
            if (!characterId || characterId === 'Select Character') return;

            const companion = this.relationshipSystem?.getCompanionApproval(characterId);
            if (companion && companion.isCompanion) {
                const level = this.relationshipSystem.getApprovalLevel(companion.approval);
                option.textContent = `${option.textContent.split(' - ')[0]} - ${level.name} (${companion.approval})`;
            }
        });
    }

    createRelationshipIndicator(entityId, entityType) {
        if (!this.relationshipSystem) return document.createElement('div');

        const indicatorData = this.relationshipSystem.getRelationshipIndicator(entityId, entityType);
        if (!indicatorData) return document.createElement('div');

        const indicator = document.createElement('div');
        indicator.className = `relationship-indicator ${this.getIndicatorClass(indicatorData)}`;
        
        indicator.innerHTML = `
            <span class="relationship-indicator-icon">${indicatorData.icon}</span>
            <span class="relationship-indicator-value">${indicatorData.value}</span>
            <div class="relationship-tooltip">${indicatorData.tooltip}</div>
        `;

        return indicator;
    }

    createRelationshipStatusBar(entityId, entityType) {
        if (!this.relationshipSystem) return document.createElement('div');

        const statusBar = document.createElement('div');
        statusBar.className = 'relationship-status-bar';

        if (entityType === 'npc') {
            const relationship = this.relationshipSystem.getIndividualRelationship(entityId);
            const companion = this.relationshipSystem.getCompanionApproval(entityId);

            statusBar.innerHTML = `
                <span class="relationship-status-label">Trust:</span>
                <div class="trust-progress-bar">
                    <div class="trust-progress-fill ${relationship.relationshipType}" 
                         style="width: ${relationship.trustLevel}%"></div>
                </div>
                <span class="relationship-indicator-value">${relationship.trustLevel}/100</span>
                ${companion.isCompanion ? `
                    <span class="relationship-status-label">Approval:</span>
                    <div class="trust-progress-bar">
                        <div class="trust-progress-fill ${this.relationshipSystem.getApprovalLevel(companion.approval).type}" 
                             style="width: ${companion.approval}%"></div>
                    </div>
                    <span class="relationship-indicator-value">${companion.approval}/100</span>
                ` : ''}
                ${relationship.romance.active ? `
                    <div class="romance-indicator">
                        <span class="relationship-indicator-icon">💕</span>
                        <span class="relationship-indicator-value">${relationship.romance.stage}</span>
                    </div>
                ` : ''}
            `;
        } else if (entityType === 'faction') {
            const reputation = this.relationshipSystem.getFactionReputation(entityId);
            
            statusBar.innerHTML = `
                <span class="relationship-status-label">Reputation:</span>
                <div class="trust-progress-bar">
                    <div class="trust-progress-fill ${reputation.level}" 
                         style="width: ${(reputation.reputation + 100) / 2}%"></div>
                </div>
                <span class="relationship-indicator-value">${reputation.reputation}/100</span>
                <span class="relationship-status-label">${reputation.level}</span>
            `;
        }

        return statusBar;
    }

    getIndicatorClass(indicatorData) {
        const type = indicatorData.type;
        const baseClass = indicatorData.level?.includes('Romance') || indicatorData.level?.includes('Love') 
                         ? 'romance-indicator' 
                         : '';

        if (indicatorData.value !== undefined) {
            if (type === 'enemy' || type === 'unfriendly' || type === 'neutral' || 
                type === 'friendly' || type === 'ally' || type === 'devoted') {
                return `trust-${type} ${baseClass}`;
            }
            
            if (type === 'hated' || type === 'hostile' || type === 'revered') {
                return `rep-${type} ${baseClass}`;
            }

            if (type === 'hatred' || type === 'dislike' || type === 'like' || type === 'love') {
                return `approval-${type} ${baseClass}`;
            }
        }

        return baseClass;
    }

    setupRelationshipTooltips() {
        // Enhanced tooltips are handled in CSS and the indicator creation
        // This method can be extended for more complex tooltip behavior
    }

    updateWorldBrowserIndicators() {
        // Refresh all relationship indicators when world browser is shown
        setTimeout(() => {
            document.querySelectorAll('.npc-card').forEach(card => {
                const existingBar = card.querySelector('.relationship-status-bar');
                if (existingBar) existingBar.remove();
                
                const existingIndicator = card.querySelector('.relationship-indicator');
                if (existingIndicator) existingIndicator.remove();
                
                this.enhanceNPCCard(card);
            });

            document.querySelectorAll('.faction-card').forEach(card => {
                const existingBar = card.querySelector('.relationship-status-bar');
                if (existingBar) existingBar.remove();
                
                const existingIndicator = card.querySelector('.relationship-indicator');
                if (existingIndicator) existingIndicator.remove();
                
                this.enhanceFactionCard(card);
            });
        }, 100);
    }

    updateNPCIndicators(npcId) {
        const npcCards = document.querySelectorAll(`[data-id="${npcId}"].npc-card`);
        npcCards.forEach(card => {
            const existingBar = card.querySelector('.relationship-status-bar');
            if (existingBar) existingBar.remove();
            
            const existingIndicator = card.querySelector('.relationship-indicator');
            if (existingIndicator) existingIndicator.remove();
            
            this.enhanceNPCCard(card);
        });
    }

    updateFactionIndicators(factionId) {
        const factionCards = document.querySelectorAll(`[data-id="${factionId}"].faction-card`);
        factionCards.forEach(card => {
            const existingBar = card.querySelector('.relationship-status-bar');
            if (existingBar) existingBar.remove();
            
            const existingIndicator = card.querySelector('.relationship-indicator');
            if (existingIndicator) existingIndicator.remove();
            
            this.enhanceFactionCard(card);
        });
    }

    updateCompanionIndicators(companionId) {
        this.updateCharacterSwitcherIndicators();
        this.updateNPCIndicators(companionId);
    }

    // ===== PUBLIC METHODS FOR MANUAL UPDATES =====

    /**
     * Show relationship change notification
     * @param {Object} change - Change data
     */
    showRelationshipChange(change) {
        const notification = document.createElement('div');
        notification.className = `relationship-change-notification ${change.type}`;
        
        const changeText = change.value > 0 ? `+${change.value}` : `${change.value}`;
        const changeClass = change.value > 0 ? 'positive' : change.value < 0 ? 'negative' : 'neutral';
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="entity-name">${change.entityName}</span>
                <span class="change-type">${change.changeType}</span>
                <span class="change-value ${changeClass}">${changeText}</span>
            </div>
        `;

        // Add to notification container
        const container = document.getElementById('notification-container') || document.body;
        container.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Create detailed relationship panel
     * @param {string} entityId - Entity ID
     * @param {string} entityType - Entity type
     * @returns {HTMLElement} Relationship panel
     */
    createRelationshipPanel(entityId, entityType) {
        const panel = document.createElement('div');
        panel.className = 'relationship-details-panel';

        if (entityType === 'npc') {
            const relationship = this.relationshipSystem.getIndividualRelationship(entityId);
            const companion = this.relationshipSystem.getCompanionApproval(entityId);
            const npc = this.worldDatabase.getNPC(entityId);

            panel.innerHTML = `
                <div class="relationship-section">
                    <div class="relationship-section-title">Individual Relationship</div>
                    <div class="relationship-entry">
                        <span class="relationship-name">Trust Level</span>
                        <span class="relationship-indicator-value">${relationship.trustLevel}/100 (${relationship.relationshipType})</span>
                    </div>
                    <div class="relationship-entry">
                        <span class="relationship-name">Interactions</span>
                        <span class="relationship-indicator-value">${relationship.interactions}</span>
                    </div>
                    ${relationship.romance.stage !== 'none' ? `
                        <div class="relationship-entry">
                            <span class="relationship-name">Romance</span>
                            <span class="relationship-indicator-value romance-indicator">${relationship.romance.stage}</span>
                        </div>
                    ` : ''}
                </div>
                ${companion.isCompanion ? `
                    <div class="relationship-section">
                        <div class="relationship-section-title">Companion Status</div>
                        <div class="relationship-entry">
                            <span class="relationship-name">Approval</span>
                            <span class="relationship-indicator-value">${companion.approval}/100 (${this.relationshipSystem.getApprovalLevel(companion.approval).name})</span>
                        </div>
                        ${companion.personalQuest.available ? `
                            <div class="relationship-entry">
                                <span class="relationship-name">Personal Quest</span>
                                <span class="relationship-indicator-value">${companion.personalQuest.completed ? 'Completed' : 'Available'}</span>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                ${relationship.notes.length > 0 ? `
                    <div class="relationship-section">
                        <div class="relationship-section-title">Recent Changes</div>
                        ${relationship.notes.slice(-5).map(note => `
                            <div class="relationship-entry">
                                <span class="relationship-name">${note.reason}</span>
                                <span class="relationship-change ${note.change > 0 ? 'positive' : note.change < 0 ? 'negative' : 'neutral'}">
                                    ${note.change > 0 ? '+' : ''}${note.change}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
        } else if (entityType === 'faction') {
            const reputation = this.relationshipSystem.getFactionReputation(entityId);
            const faction = this.worldDatabase.getFaction(entityId);

            panel.innerHTML = `
                <div class="relationship-section">
                    <div class="relationship-section-title">Faction Reputation</div>
                    <div class="relationship-entry">
                        <span class="relationship-name">Reputation</span>
                        <span class="relationship-indicator-value">${reputation.reputation}/100 (${reputation.level})</span>
                    </div>
                </div>
                ${reputation.history.length > 0 ? `
                    <div class="relationship-section">
                        <div class="relationship-section-title">Recent Changes</div>
                        ${reputation.history.slice(-5).map(entry => `
                            <div class="relationship-entry">
                                <span class="relationship-name">${entry.reason}</span>
                                <span class="relationship-change ${entry.change > 0 ? 'positive' : entry.change < 0 ? 'negative' : 'neutral'}">
                                    ${entry.change > 0 ? '+' : ''}${entry.change}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
        }

        return panel;
    }
}