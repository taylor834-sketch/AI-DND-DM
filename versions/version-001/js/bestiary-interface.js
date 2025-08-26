export default class BestiaryInterface {
    constructor(core) {
        this.core = core;
        this.monsterDatabase = null;
        this.worldDatabase = null;
        this.currentMonster = null;
        this.filterCriteria = {
            discoveryLevel: 'all',
            type: 'all',
            challengeRating: 'all',
            environment: 'all'
        };
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.monsterDatabase = this.core.getModule('monsterDatabase');
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.setupBestiaryInterface();
        });

        this.core.on('ui:screenShown', (event) => {
            if (event.detail.screen === 'worldBrowser') {
                this.addBestiaryTab();
            }
        });

        this.core.on('monster:knowledge:updated', () => {
            this.refreshBestiaryView();
        });
    }

    setupBestiaryInterface() {
        this.createBestiaryStyles();
    }

    createBestiaryStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Bestiary Interface Styles */
            .bestiary-container {
                display: flex;
                height: 600px;
                gap: var(--spacing-lg);
                margin-top: var(--spacing-md);
            }

            .bestiary-sidebar {
                width: 350px;
                background: var(--color-background-tertiary);
                border-radius: var(--border-radius-md);
                border: 1px solid var(--color-border);
                display: flex;
                flex-direction: column;
            }

            .bestiary-filters {
                padding: var(--spacing-md);
                border-bottom: 1px solid var(--color-border);
            }

            .bestiary-filters h4 {
                color: var(--color-accent);
                font-family: var(--font-title);
                margin-bottom: var(--spacing-sm);
            }

            .community-sharing {
                padding: var(--spacing-md);
                border-bottom: 1px solid var(--color-border);
            }

            .community-sharing h4 {
                color: var(--color-accent);
                font-family: var(--font-title);
                margin-bottom: var(--spacing-sm);
            }

            .sharing-buttons {
                display: flex;
                gap: var(--spacing-sm);
            }

            .sharing-buttons button {
                flex: 1;
                padding: var(--spacing-sm);
                border-radius: var(--border-radius);
                border: 1px solid var(--color-border);
                background: var(--color-background-primary);
                color: var(--color-text-primary);
                cursor: pointer;
                transition: background-color 0.2s ease;
            }

            .sharing-buttons button:hover {
                background: var(--color-accent);
                color: var(--color-text-dark);
            }

            .filter-row {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-xs);
                margin-bottom: var(--spacing-sm);
            }

            .filter-row label {
                color: var(--color-text-secondary);
                font-size: 0.9rem;
                font-weight: 600;
            }

            .filter-row select {
                padding: var(--spacing-xs);
                background: var(--color-background-secondary);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius-sm);
                color: var(--color-text-primary);
            }

            .bestiary-list {
                flex: 1;
                overflow-y: auto;
                padding: var(--spacing-sm);
            }

            .monster-entry {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                padding: var(--spacing-sm);
                margin-bottom: var(--spacing-xs);
                background: var(--color-background-secondary);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                transition: var(--transition-fast);
                border: 1px solid transparent;
            }

            .monster-entry:hover {
                background: var(--color-background);
                border-color: var(--color-border-accent);
            }

            .monster-entry.selected {
                background: var(--color-primary);
                color: var(--color-text-primary);
            }

            .monster-discovery-icon {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.8rem;
                color: white;
                flex-shrink: 0;
            }

            .discovery-unknown { background: #666; }
            .discovery-basic { background: #FFA500; }
            .discovery-detailed { background: #4169E1; }
            .discovery-complete { background: #32CD32; }

            .monster-info {
                flex: 1;
                min-width: 0;
            }

            .monster-name {
                color: var(--color-text-primary);
                font-weight: 600;
                font-size: 0.9rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .monster-meta {
                display: flex;
                gap: var(--spacing-sm);
                color: var(--color-text-secondary);
                font-size: 0.8rem;
            }

            .bestiary-main {
                flex: 1;
                background: var(--color-background-tertiary);
                border-radius: var(--border-radius-md);
                border: 1px solid var(--color-border);
                overflow-y: auto;
                position: relative;
            }

            .bestiary-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: var(--color-text-secondary);
                text-align: center;
                padding: var(--spacing-xl);
            }

            .bestiary-empty h3 {
                margin-bottom: var(--spacing-md);
                color: var(--color-text-primary);
            }

            /* D&D Monster Stat Block Styles */
            .monster-stat-block {
                padding: var(--spacing-lg);
                max-width: 600px;
                margin: 0 auto;
                font-family: var(--font-body);
            }

            .stat-block-header {
                text-align: center;
                margin-bottom: var(--spacing-lg);
                padding-bottom: var(--spacing-md);
                border-bottom: 2px solid var(--color-accent);
            }

            .monster-title {
                font-family: var(--font-title);
                font-size: 1.8rem;
                color: var(--color-text-primary);
                margin-bottom: var(--spacing-xs);
            }

            .monster-subtitle {
                color: var(--color-text-secondary);
                font-style: italic;
                font-size: 0.9rem;
            }

            .stat-block-section {
                margin-bottom: var(--spacing-lg);
                padding-bottom: var(--spacing-md);
                border-bottom: 1px solid var(--color-border);
            }

            .stat-block-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }

            .stat-row {
                display: flex;
                align-items: baseline;
                margin-bottom: var(--spacing-xs);
            }

            .stat-label {
                font-weight: 600;
                color: var(--color-text-primary);
                min-width: 120px;
                margin-right: var(--spacing-sm);
            }

            .stat-value {
                color: var(--color-text-secondary);
                flex: 1;
            }

            .ability-scores {
                display: grid;
                grid-template-columns: repeat(6, 1fr);
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-lg);
            }

            .ability-score {
                text-align: center;
                background: var(--color-background-secondary);
                padding: var(--spacing-sm);
                border-radius: var(--border-radius-sm);
                border: 1px solid var(--color-border);
            }

            .ability-name {
                font-size: 0.8rem;
                font-weight: 600;
                color: var(--color-text-secondary);
                margin-bottom: var(--spacing-xs);
            }

            .ability-value {
                font-size: 1.1rem;
                font-weight: bold;
                color: var(--color-text-primary);
                margin-bottom: var(--spacing-xs);
            }

            .ability-modifier {
                font-size: 0.9rem;
                color: var(--color-text-secondary);
            }

            .actions-section {
                margin-top: var(--spacing-lg);
            }

            .section-title {
                font-family: var(--font-title);
                font-size: 1.2rem;
                color: var(--color-accent);
                margin-bottom: var(--spacing-md);
                padding-bottom: var(--spacing-xs);
                border-bottom: 1px solid var(--color-accent);
            }

            .action-entry,
            .trait-entry {
                margin-bottom: var(--spacing-md);
                padding: var(--spacing-sm);
                background: var(--color-background-secondary);
                border-radius: var(--border-radius-sm);
                border-left: 4px solid var(--color-accent);
            }

            .action-name,
            .trait-name {
                font-weight: 600;
                color: var(--color-text-primary);
                margin-bottom: var(--spacing-xs);
            }

            .action-description,
            .trait-description {
                color: var(--color-text-secondary);
                line-height: 1.5;
            }

            .damage-type {
                background: var(--color-primary);
                color: var(--color-text-primary);
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 0.8rem;
                margin: 0 2px;
            }

            .knowledge-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: var(--color-text-primary);
                text-align: center;
                padding: var(--spacing-xl);
            }

            .knowledge-level {
                font-size: 1.2rem;
                font-weight: 600;
                margin-bottom: var(--spacing-md);
            }

            .knowledge-description {
                max-width: 400px;
                line-height: 1.6;
            }

            .discovery-progress {
                margin-top: var(--spacing-lg);
                text-align: center;
            }

            .progress-bar {
                width: 200px;
                height: 8px;
                background: var(--color-background-secondary);
                border-radius: 4px;
                overflow: hidden;
                margin: var(--spacing-sm) auto;
            }

            .progress-fill {
                height: 100%;
                transition: width 0.3s ease;
            }

            .progress-fill.unknown { width: 0%; background: #666; }
            .progress-fill.basic { width: 25%; background: #FFA500; }
            .progress-fill.detailed { width: 66%; background: #4169E1; }
            .progress-fill.complete { width: 100%; background: #32CD32; }

            .encounter-history {
                margin-top: var(--spacing-lg);
                padding: var(--spacing-md);
                background: var(--color-background-secondary);
                border-radius: var(--border-radius-md);
                border: 1px solid var(--color-border);
            }

            .encounter-entry {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-sm);
                margin-bottom: var(--spacing-xs);
                background: var(--color-background);
                border-radius: var(--border-radius-sm);
            }

            .encounter-details {
                flex: 1;
            }

            .encounter-location {
                font-weight: 600;
                color: var(--color-text-primary);
            }

            .encounter-outcome {
                font-size: 0.8rem;
                color: var(--color-text-secondary);
            }

            .encounter-date {
                color: var(--color-text-secondary);
                font-size: 0.8rem;
            }

            .hidden-info {
                opacity: 0.3;
                filter: blur(2px);
                pointer-events: none;
            }

            /* Responsive Design */
            @media (max-width: 768px) {
                .bestiary-container {
                    flex-direction: column;
                    height: auto;
                }

                .bestiary-sidebar {
                    width: 100%;
                }

                .ability-scores {
                    grid-template-columns: repeat(3, 1fr);
                }

                .monster-stat-block {
                    padding: var(--spacing-md);
                }
            }
        `;
        document.head.appendChild(style);
    }

    addBestiaryTab() {
        const worldBrowserTabs = document.querySelector('.world-browser-tabs');
        if (!worldBrowserTabs || document.querySelector('[data-tab="bestiary"]')) return;

        // Add bestiary tab
        const bestiaryTab = document.createElement('button');
        bestiaryTab.className = 'world-tab-button';
        bestiaryTab.dataset.tab = 'bestiary';
        bestiaryTab.textContent = 'Bestiary';
        worldBrowserTabs.appendChild(bestiaryTab);

        // Add bestiary tab content
        const worldTabContent = document.querySelector('.world-tab-content');
        const bestiaryPanel = document.createElement('div');
        bestiaryPanel.id = 'bestiary-world-tab';
        bestiaryPanel.className = 'world-tab-panel';
        bestiaryPanel.innerHTML = this.createBestiaryHTML();
        worldTabContent.appendChild(bestiaryPanel);

        // Bind events
        bestiaryTab.addEventListener('click', () => {
            this.showBestiaryTab();
        });

        this.bindBestiaryEvents();
    }

    createBestiaryHTML() {
        return `
            <div class="bestiary-container">
                <div class="bestiary-sidebar">
                    <div class="bestiary-filters">
                        <h4>Filter Creatures</h4>
                        <div class="filter-row">
                            <label>Discovery Level:</label>
                            <select id="discovery-filter">
                                <option value="all">All Known</option>
                                <option value="unknown">Unknown</option>
                                <option value="basic">Basic Knowledge</option>
                                <option value="detailed">Detailed Knowledge</option>
                                <option value="complete">Complete Knowledge</option>
                            </select>
                        </div>
                        <div class="filter-row">
                            <label>Creature Type:</label>
                            <select id="type-filter">
                                <option value="all">All Types</option>
                                <option value="humanoid">Humanoid</option>
                                <option value="beast">Beast</option>
                                <option value="dragon">Dragon</option>
                                <option value="fiend">Fiend</option>
                                <option value="undead">Undead</option>
                                <option value="fey">Fey</option>
                                <option value="elemental">Elemental</option>
                                <option value="aberration">Aberration</option>
                                <option value="celestial">Celestial</option>
                                <option value="construct">Construct</option>
                                <option value="giant">Giant</option>
                                <option value="monstrosity">Monstrosity</option>
                                <option value="ooze">Ooze</option>
                                <option value="plant">Plant</option>
                            </select>
                        </div>
                        <div class="filter-row">
                            <label>Challenge Rating:</label>
                            <select id="cr-filter">
                                <option value="all">All Levels</option>
                                <option value="0-1">0 - 1</option>
                                <option value="2-4">2 - 4</option>
                                <option value="5-10">5 - 10</option>
                                <option value="11-15">11 - 15</option>
                                <option value="16-20">16 - 20</option>
                                <option value="21+">21+</option>
                            </select>
                        </div>
                    </div>
                    <div class="community-sharing">
                        <h4>Community Sharing</h4>
                        <div class="sharing-buttons">
                            <button class="btn btn-secondary" id="import-monsters">
                                📥 Import Monsters
                            </button>
                            <button class="btn btn-secondary" id="export-monsters">
                                📤 Export Monsters
                            </button>
                        </div>
                    </div>
                    <div class="bestiary-list" id="bestiary-list">
                        <!-- Populated by JavaScript -->
                    </div>
                </div>
                <div class="bestiary-main" id="bestiary-main">
                    <div class="bestiary-empty">
                        <h3>📚 Bestiary</h3>
                        <p>Select a creature from the list to view its information.</p>
                        <p><em>Knowledge about creatures is revealed as you encounter and learn about them in your adventures.</em></p>
                    </div>
                </div>
            </div>
        `;
    }

    bindBestiaryEvents() {
        // Filter events
        document.getElementById('discovery-filter')?.addEventListener('change', (e) => {
            this.filterCriteria.discoveryLevel = e.target.value;
            this.refreshBestiaryList();
        });

        document.getElementById('type-filter')?.addEventListener('change', (e) => {
            this.filterCriteria.type = e.target.value;
            this.refreshBestiaryList();
        });

        document.getElementById('cr-filter')?.addEventListener('change', (e) => {
            this.filterCriteria.challengeRating = e.target.value;
            this.refreshBestiaryList();
        });

        // Community sharing events
        document.getElementById('import-monsters')?.addEventListener('click', () => {
            this.showImportDialog();
        });

        document.getElementById('export-monsters')?.addEventListener('click', () => {
            this.showExportDialog();
        });

        // Initial population
        this.refreshBestiaryList();
    }

    showBestiaryTab() {
        // Switch to bestiary tab
        document.querySelectorAll('.world-tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.world-tab-panel').forEach(panel => panel.classList.remove('active'));
        
        document.querySelector('[data-tab="bestiary"]').classList.add('active');
        document.getElementById('bestiary-world-tab').classList.add('active');
        
        this.refreshBestiaryList();
    }

    refreshBestiaryList() {
        if (!this.monsterDatabase) return;

        const bestiaryList = document.getElementById('bestiary-list');
        if (!bestiaryList) return;

        // Get encountered monsters with player knowledge
        const encounteredMonsters = this.monsterDatabase.getEncounteredMonsters();
        
        // Apply filters
        let filteredMonsters = encounteredMonsters.filter(monster => {
            const knowledge = monster.playerKnowledge;
            const discoveryLevel = this.getDiscoveryLevelName(knowledge.discoveryLevel);
            
            // Discovery level filter
            if (this.filterCriteria.discoveryLevel !== 'all' && 
                discoveryLevel !== this.filterCriteria.discoveryLevel) {
                return false;
            }

            // Type filter
            if (this.filterCriteria.type !== 'all' && monster.type !== this.filterCriteria.type) {
                return false;
            }

            // Challenge rating filter
            if (this.filterCriteria.challengeRating !== 'all') {
                const cr = monster.challengeRating;
                switch (this.filterCriteria.challengeRating) {
                    case '0-1': return cr <= 1;
                    case '2-4': return cr >= 2 && cr <= 4;
                    case '5-10': return cr >= 5 && cr <= 10;
                    case '11-15': return cr >= 11 && cr <= 15;
                    case '16-20': return cr >= 16 && cr <= 20;
                    case '21+': return cr >= 21;
                }
            }

            return true;
        });

        if (filteredMonsters.length === 0) {
            bestiaryList.innerHTML = `
                <div class="bestiary-empty">
                    <p>No creatures match your current filters.</p>
                    <p><em>Explore the world to discover more creatures!</em></p>
                </div>
            `;
            return;
        }

        // Render monster list
        bestiaryList.innerHTML = filteredMonsters.map(monster => {
            const knowledge = monster.playerKnowledge;
            const discoveryLevel = this.getDiscoveryLevelName(knowledge.discoveryLevel);
            
            return `
                <div class="monster-entry" data-monster-id="${monster.id}">
                    <div class="monster-discovery-icon discovery-${discoveryLevel}">
                        ${this.getDiscoveryIcon(knowledge.discoveryLevel)}
                    </div>
                    <div class="monster-info">
                        <div class="monster-name">${monster.name}</div>
                        <div class="monster-meta">
                            <span>CR ${monster.challengeRating}</span>
                            <span>${monster.type}</span>
                            <span>${knowledge.encounterCount} encounter${knowledge.encounterCount !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events
        bestiaryList.querySelectorAll('.monster-entry').forEach(entry => {
            entry.addEventListener('click', () => {
                const monsterId = entry.dataset.monsterId;
                this.showMonsterDetails(monsterId);
                
                // Update selection
                bestiaryList.querySelectorAll('.monster-entry').forEach(e => e.classList.remove('selected'));
                entry.classList.add('selected');
            });
        });
    }

    showMonsterDetails(monsterId) {
        const monster = this.monsterDatabase.getMonster(monsterId);
        const knowledge = this.monsterDatabase.getPlayerKnowledge(monsterId);
        
        if (!monster) return;

        this.currentMonster = monster;
        const bestiaryMain = document.getElementById('bestiary-main');
        
        bestiaryMain.innerHTML = this.renderMonsterStatBlock(monster, knowledge);
    }

    renderMonsterStatBlock(monster, knowledge) {
        const discoveryLevel = knowledge.discoveryLevel;
        const showFullStats = discoveryLevel >= 2; // Detailed or complete
        const showBasicInfo = discoveryLevel >= 1; // Basic or higher
        
        let html = `
            <div class="monster-stat-block">
                <div class="stat-block-header">
                    <h1 class="monster-title">${monster.name}</h1>
                    <div class="monster-subtitle">${monster.size} ${monster.type}${monster.subtype ? ` (${monster.subtype})` : ''}, ${monster.alignment}</div>
                </div>
        `;

        // Core stats (always visible if basic knowledge)
        if (showBasicInfo) {
            html += `
                <div class="stat-block-section">
                    <div class="stat-row">
                        <span class="stat-label">Armor Class</span>
                        <span class="stat-value">${monster.armorClass.value} ${monster.armorClass.source ? `(${monster.armorClass.source})` : ''}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Hit Points</span>
                        <span class="stat-value">${monster.hitPoints} (${monster.hitDice})</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Speed</span>
                        <span class="stat-value">${this.formatSpeed(monster.speed)}</span>
                    </div>
                </div>
            `;
        }

        // Ability scores (detailed knowledge required)
        if (showFullStats) {
            html += `
                <div class="ability-scores">
                    ${['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(ability => {
                        const score = monster.abilityScores[ability.toLowerCase()];
                        const modifier = Math.floor((score - 10) / 2);
                        return `
                            <div class="ability-score">
                                <div class="ability-name">${ability}</div>
                                <div class="ability-value">${score}</div>
                                <div class="ability-modifier">${modifier >= 0 ? '+' : ''}${modifier}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Defenses and senses (if known)
        if (showBasicInfo) {
            html += `<div class="stat-block-section">`;
            
            if (knowledge.knownResistances.length > 0 || (showFullStats && monster.damageResistances.length > 0)) {
                const resistances = showFullStats ? monster.damageResistances : knowledge.knownResistances;
                html += `
                    <div class="stat-row">
                        <span class="stat-label">Damage Resistances</span>
                        <span class="stat-value">${resistances.join(', ')}</span>
                    </div>
                `;
            }

            if (knowledge.knownVulnerabilities.length > 0 || (showFullStats && monster.damageVulnerabilities.length > 0)) {
                const vulnerabilities = showFullStats ? monster.damageVulnerabilities : knowledge.knownVulnerabilities;
                html += `
                    <div class="stat-row">
                        <span class="stat-label">Damage Vulnerabilities</span>
                        <span class="stat-value">${vulnerabilities.join(', ')}</span>
                    </div>
                `;
            }

            if (showFullStats) {
                html += `
                    <div class="stat-row">
                        <span class="stat-label">Senses</span>
                        <span class="stat-value">${this.formatSenses(monster.senses)}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Languages</span>
                        <span class="stat-value">${monster.languages.length > 0 ? monster.languages.join(', ') : '—'}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Challenge Rating</span>
                        <span class="stat-value">${monster.challengeRating} (${monster.experiencePoints} XP)</span>
                    </div>
                `;
            }
            
            html += `</div>`;
        }

        // Traits (known abilities)
        if (knowledge.knownAbilities.length > 0 || (showFullStats && monster.traits.length > 0)) {
            const traits = showFullStats ? monster.traits : 
                          monster.traits.filter(trait => knowledge.knownAbilities.includes(trait.name));
            
            if (traits.length > 0) {
                html += `
                    <div class="actions-section">
                        <h3 class="section-title">Special Abilities</h3>
                        ${traits.map(trait => `
                            <div class="trait-entry">
                                <div class="trait-name">${trait.name}</div>
                                <div class="trait-description">${trait.description}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }

        // Actions (partial or full based on knowledge)
        if (knowledge.knownTactics.length > 0 || showFullStats) {
            const actions = showFullStats ? monster.actions : 
                          monster.actions.filter(action => knowledge.knownTactics.includes(action.name));
            
            if (actions.length > 0) {
                html += `
                    <div class="actions-section">
                        <h3 class="section-title">Actions</h3>
                        ${actions.map(action => this.renderAction(action)).join('')}
                    </div>
                `;
            }
        }

        // Discovery progress and encounter history
        html += this.renderDiscoveryInfo(knowledge);
        
        html += `</div>`;

        // Add knowledge overlay for unknown/limited information
        if (discoveryLevel < 1) {
            html += `
                <div class="knowledge-overlay">
                    <div class="knowledge-level">Unknown Creature</div>
                    <div class="knowledge-description">
                        You haven't learned enough about this creature yet. 
                        Encounter it in combat or observe its behavior to gain knowledge.
                    </div>
                </div>
            `;
        } else if (discoveryLevel < 2) {
            html += `
                <div class="knowledge-overlay" style="background: rgba(0,0,0,0.3);">
                    <div class="knowledge-level">Limited Knowledge</div>
                    <div class="knowledge-description">
                        Some information is still hidden. 
                        Observe more of this creature's abilities to learn more.
                    </div>
                </div>
            `;
        }

        return html;
    }

    renderAction(action) {
        let description = '';
        
        if (action.type === 'weapon') {
            description += `<em>${action.attack}</em>`;
            if (action.reach) description += `, reach ${action.reach}`;
            if (action.range) description += `, range ${action.range}`;
            description += `, one target. `;
            
            if (action.damage) {
                action.damage.forEach(dmg => {
                    description += `<em>Hit:</em> ${dmg.dice} <span class="damage-type">${dmg.type}</span> damage. `;
                });
            }
        } else if (action.description) {
            description = action.description;
        }

        return `
            <div class="action-entry">
                <div class="action-name">${action.name}</div>
                <div class="action-description">${description}</div>
            </div>
        `;
    }

    renderDiscoveryInfo(knowledge) {
        const discoveryLevel = knowledge.discoveryLevel;
        const discoveryName = this.getDiscoveryLevelName(discoveryLevel);
        const encounters = this.monsterDatabase.getEncounterHistory(knowledge.monsterId);
        
        let html = `
            <div class="discovery-progress">
                <h4>Discovery Progress</h4>
                <div class="knowledge-level">${this.getDiscoveryLevelDisplay(discoveryLevel)}</div>
                <div class="progress-bar">
                    <div class="progress-fill ${discoveryName}"></div>
                </div>
                <p>Total Knowledge: ${this.getTotalKnowledge(knowledge)} items discovered</p>
            </div>
        `;

        if (encounters.length > 0) {
            html += `
                <div class="encounter-history">
                    <h4>Encounter History</h4>
                    ${encounters.slice(0, 5).map(encounter => `
                        <div class="encounter-entry">
                            <div class="encounter-details">
                                <div class="encounter-location">${encounter.location || 'Unknown Location'}</div>
                                <div class="encounter-outcome">${encounter.outcome} - ${encounter.encounterType}</div>
                            </div>
                            <div class="encounter-date">${new Date(encounter.timestamp).toLocaleDateString()}</div>
                        </div>
                    `).join('')}
                    ${encounters.length > 5 ? `<p><em>... and ${encounters.length - 5} more encounters</em></p>` : ''}
                </div>
            `;
        }

        return html;
    }

    formatSpeed(speed) {
        if (typeof speed === 'object') {
            return Object.entries(speed)
                .map(([type, value]) => type === 'walk' ? `${value} ft.` : `${type} ${value} ft.`)
                .join(', ');
        }
        return `${speed} ft.`;
    }

    formatSenses(senses) {
        const senseArray = [];
        
        if (senses.darkvision) senseArray.push(`darkvision ${senses.darkvision} ft.`);
        if (senses.blindsight) senseArray.push(`blindsight ${senses.blindsight} ft.`);
        if (senses.tremorsense) senseArray.push(`tremorsense ${senses.tremorsense} ft.`);
        if (senses.truesight) senseArray.push(`truesight ${senses.truesight} ft.`);
        
        senseArray.push(`passive Perception ${senses.passivePerception}`);
        
        return senseArray.join(', ');
    }

    getDiscoveryLevelName(level) {
        switch (level) {
            case 0: return 'unknown';
            case 1: return 'basic';
            case 2: return 'detailed';
            case 3: return 'complete';
            default: return 'unknown';
        }
    }

    getDiscoveryLevelDisplay(level) {
        switch (level) {
            case 0: return 'Unknown';
            case 1: return 'Basic Knowledge';
            case 2: return 'Detailed Knowledge';
            case 3: return 'Complete Knowledge';
            default: return 'Unknown';
        }
    }

    getDiscoveryIcon(level) {
        switch (level) {
            case 0: return '?';
            case 1: return '!';
            case 2: return '★';
            case 3: return '✓';
            default: return '?';
        }
    }

    getTotalKnowledge(knowledge) {
        return knowledge.knownAbilities.length + 
               knowledge.knownResistances.length + 
               knowledge.knownVulnerabilities.length + 
               knowledge.knownBehaviors.length + 
               knowledge.knownWeaknesses.length + 
               knowledge.knownTactics.length;
    }

    refreshBestiaryView() {
        if (this.currentMonster && document.getElementById('bestiary-world-tab')?.classList.contains('active')) {
            this.showMonsterDetails(this.currentMonster.id);
        }
    }

    // ===== COMMUNITY SHARING METHODS =====

    showImportDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';
        dialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📥 Import Monster Pack</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="import-options">
                        <h4>Import Options</h4>
                        <label class="checkbox-label">
                            <input type="checkbox" id="overwrite-existing" />
                            Overwrite existing monsters with same name
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" id="add-author-prefix" checked />
                            Add author prefix to monster names
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" id="validate-stats" checked />
                            Validate monster stats for balance
                        </label>
                    </div>
                    
                    <div class="file-input-area">
                        <h4>Select Monster Pack File</h4>
                        <input type="file" id="monster-import-file" accept=".json" />
                        <p class="help-text">Choose a JSON file exported from D&D Voice Adventure or a compatible monster pack.</p>
                    </div>

                    <div id="import-preview" class="import-preview" style="display: none;">
                        <h4>Import Preview</h4>
                        <div id="preview-content"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
                    <button class="btn btn-primary" id="confirm-import" disabled>Import Monsters</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // File input handling
        const fileInput = dialog.querySelector('#monster-import-file');
        const importPreview = dialog.querySelector('#import-preview');
        const previewContent = dialog.querySelector('#preview-content');
        const confirmButton = dialog.querySelector('#confirm-import');

        let importData = null;

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        importData = JSON.parse(event.target.result);
                        this.showImportPreview(importData, previewContent);
                        importPreview.style.display = 'block';
                        confirmButton.disabled = false;
                    } catch (error) {
                        previewContent.innerHTML = `<div class="error">Invalid JSON file: ${error.message}</div>`;
                        importPreview.style.display = 'block';
                        confirmButton.disabled = true;
                    }
                };
                reader.readAsText(file);
            }
        });

        // Import confirmation
        confirmButton.addEventListener('click', () => {
            if (importData) {
                const options = {
                    overwriteExisting: dialog.querySelector('#overwrite-existing').checked,
                    addAuthorPrefix: dialog.querySelector('#add-author-prefix').checked,
                    validateStats: dialog.querySelector('#validate-stats').checked
                };

                const results = this.monsterDatabase.importMonstersFromCommunity(importData, options);
                this.showImportResults(results);
                this.refreshBestiaryList();
                dialog.remove();
            }
        });
    }

    showImportPreview(importData, container) {
        if (!importData.monsters || !Array.isArray(importData.monsters)) {
            container.innerHTML = '<div class="error">Invalid monster pack format</div>';
            return;
        }

        const summary = {
            total: importData.monsters.length,
            types: {},
            crRange: { min: Infinity, max: -Infinity }
        };

        importData.monsters.forEach(monster => {
            const type = monster.type || 'unknown';
            summary.types[type] = (summary.types[type] || 0) + 1;
            
            const cr = monster.challengeRating || 0;
            summary.crRange.min = Math.min(summary.crRange.min, cr);
            summary.crRange.max = Math.max(summary.crRange.max, cr);
        });

        container.innerHTML = `
            <div class="import-summary">
                <div class="summary-row">
                    <strong>Total Monsters:</strong> ${summary.total}
                </div>
                <div class="summary-row">
                    <strong>Author:</strong> ${importData.exportedBy || 'Unknown'}
                </div>
                <div class="summary-row">
                    <strong>Created:</strong> ${importData.exportedAt ? new Date(importData.exportedAt).toLocaleDateString() : 'Unknown'}
                </div>
                <div class="summary-row">
                    <strong>CR Range:</strong> ${summary.crRange.min} - ${summary.crRange.max}
                </div>
                <div class="summary-row">
                    <strong>Types:</strong> ${Object.entries(summary.types).map(([type, count]) => `${type} (${count})`).join(', ')}
                </div>
            </div>
            
            <div class="monster-list-preview">
                <strong>Monsters to Import:</strong>
                <ul>
                    ${importData.monsters.slice(0, 10).map(monster => 
                        `<li>${monster.name} (CR ${monster.challengeRating}, ${monster.type})</li>`
                    ).join('')}
                    ${importData.monsters.length > 10 ? `<li><em>... and ${importData.monsters.length - 10} more</em></li>` : ''}
                </ul>
            </div>
        `;
    }

    showImportResults(results) {
        const successMessage = `
            <div class="import-results">
                <h3>Import Complete!</h3>
                <div class="result-summary">
                    <div class="result-stat success">
                        <strong>${results.imported.length}</strong> monsters imported
                    </div>
                    <div class="result-stat warning">
                        <strong>${results.skipped.length}</strong> monsters skipped
                    </div>
                    <div class="result-stat error">
                        <strong>${results.errors.length}</strong> errors encountered
                    </div>
                </div>
                ${results.errors.length > 0 ? `
                    <div class="error-details">
                        <h4>Errors:</h4>
                        <ul>
                            ${results.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;

        this.core.getModule('ui').showNotification(successMessage, 'success', 5000);
    }

    showExportDialog() {
        const encounteredMonsters = this.monsterDatabase.getEncounteredMonsters();
        const allMonsters = Array.from(this.monsterDatabase.monsterData.monsters.values());
        
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';
        dialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📤 Export Monster Pack</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="export-options">
                        <h4>What to Export</h4>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="export-type" value="encountered" checked />
                                Encountered monsters only (${encounteredMonsters.length})
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="export-type" value="all" />
                                All monsters (${allMonsters.length})
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="export-type" value="custom" />
                                Custom selection
                            </label>
                        </div>
                    </div>

                    <div id="custom-selection" class="custom-selection" style="display: none;">
                        <h4>Select Monsters to Export</h4>
                        <div class="monster-checkbox-list">
                            ${allMonsters.map(monster => `
                                <label class="checkbox-label">
                                    <input type="checkbox" value="${monster.id}" />
                                    ${monster.name} (CR ${monster.challengeRating})
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div class="pack-metadata">
                        <h4>Monster Pack Information</h4>
                        <input type="text" id="pack-name" placeholder="Pack Name" value="My Monster Pack" />
                        <textarea id="pack-description" placeholder="Pack Description" rows="3">A collection of custom D&D monsters</textarea>
                        <input type="text" id="pack-tags" placeholder="Tags (comma-separated)" value="custom, homebrew" />
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
                    <button class="btn btn-primary" id="export-download">Download Pack</button>
                    <button class="btn btn-primary" id="export-github" disabled>Share on GitHub</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Export type handling
        const exportTypeInputs = dialog.querySelectorAll('input[name="export-type"]');
        const customSelection = dialog.querySelector('#custom-selection');
        
        exportTypeInputs.forEach(input => {
            input.addEventListener('change', () => {
                customSelection.style.display = input.value === 'custom' ? 'block' : 'none';
            });
        });

        // Export handlers
        dialog.querySelector('#export-download').addEventListener('click', () => {
            this.downloadMonsterPack(dialog);
        });

        dialog.querySelector('#export-github').addEventListener('click', () => {
            this.shareToGitHub(dialog);
        });
    }

    downloadMonsterPack(dialog) {
        const exportType = dialog.querySelector('input[name="export-type"]:checked').value;
        let monsterIds = [];

        switch (exportType) {
            case 'encountered':
                monsterIds = this.monsterDatabase.getEncounteredMonsters().map(m => m.id);
                break;
            case 'all':
                monsterIds = Array.from(this.monsterDatabase.monsterData.monsters.keys());
                break;
            case 'custom':
                monsterIds = Array.from(dialog.querySelectorAll('.monster-checkbox-list input:checked'))
                    .map(checkbox => checkbox.value);
                break;
        }

        if (monsterIds.length === 0) {
            alert('No monsters selected for export');
            return;
        }

        const packInfo = {
            name: dialog.querySelector('#pack-name').value || 'Monster Pack',
            description: dialog.querySelector('#pack-description').value || 'Custom monster pack',
            tags: dialog.querySelector('#pack-tags').value.split(',').map(s => s.trim()).filter(Boolean)
        };

        const monsterPack = this.monsterDatabase.createMonsterPack(monsterIds, packInfo);
        
        // Download as JSON
        const blob = new Blob([JSON.stringify(monsterPack, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${packInfo.name.toLowerCase().replace(/\s+/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        dialog.remove();
        this.core.getModule('ui').showNotification(`Monster pack "${packInfo.name}" downloaded successfully!`, 'success');
    }

    shareToGitHub(dialog) {
        // This would integrate with GitHub API or guide user to manual sharing
        const packName = dialog.querySelector('#pack-name').value || 'Monster Pack';
        const shareURL = this.monsterDatabase.getCommunityShareURL(packName.toLowerCase().replace(/\s+/g, '-'));
        
        const shareDialog = document.createElement('div');
        shareDialog.className = 'modal-overlay';
        shareDialog.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🐙 Share on GitHub</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>To share your monster pack with the community:</p>
                    <ol>
                        <li>First, download your monster pack using the "Download Pack" button</li>
                        <li>Fork the <a href="https://github.com/dnd-voice-adventure/community-monsters" target="_blank">Community Monsters Repository</a></li>
                        <li>Add your JSON file to the <code>/packs</code> folder</li>
                        <li>Create a pull request with your monster pack</li>
                    </ol>
                    <p><strong>Suggested filename:</strong> <code>${packName.toLowerCase().replace(/\s+/g, '-')}.json</code></p>
                    <div class="github-links">
                        <a href="https://github.com/dnd-voice-adventure/community-monsters/fork" target="_blank" class="btn btn-primary">Fork Repository</a>
                        <a href="https://github.com/dnd-voice-adventure/community-monsters/pulls" target="_blank" class="btn btn-secondary">View Pull Requests</a>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                </div>
            </div>
        `;

        dialog.remove();
        document.body.appendChild(shareDialog);
    }
}