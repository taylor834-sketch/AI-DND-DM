export default class TacticalBattleMap {
    constructor(core) {
        this.core = core;
        this.combatSystem = null;
        this.worldDatabase = null;
        
        // Battle map state
        this.gridSize = 30; // 30px per 5-foot square
        this.gridWidth = 20;
        this.gridHeight = 20;
        this.battleMap = null;
        this.mapContainer = null;
        
        // Tactical state
        this.selectedCombatant = null;
        this.movementMode = false;
        this.attackMode = false;
        this.movementPath = [];
        this.validMoves = new Set();
        this.attackRange = new Set();
        this.lineOfSight = new Map();
        
        // Terrain and environment
        this.terrain = new Map(); // Grid position -> terrain type
        this.obstacles = new Set(); // Blocking positions
        this.coverPositions = new Map(); // Position -> cover type
        this.elevationMap = new Map(); // Position -> elevation level
        
        // Visual elements
        self.overlays = {
            movement: null,
            attack: null,
            threat: null,
            aoe: null
        };
        
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.combatSystem = this.core.getModule('combatSystem');
            this.worldDatabase = this.core.getModule('worldDatabase');
            
            this.createTacticalBattleMap();
            this.bindTacticalEvents();
            
            console.log('🗺️ Tactical Battle Map initialized');
        });

        // Listen for combat events
        this.core.on('combat:started', (event) => {
            this.activateTacticalMode(event.detail);
        });

        this.core.on('combat:ended', () => {
            this.deactivateTacticalMode();
        });

        this.core.on('combat:turnChanged', (event) => {
            this.updateTacticalDisplay(event.detail);
        });
    }

    // ===== BATTLE MAP CREATION =====

    /**
     * Create the tactical battle map interface
     */
    createTacticalBattleMap() {
        // Create main container
        this.mapContainer = document.createElement('div');
        this.mapContainer.id = 'tactical-battle-map';
        this.mapContainer.className = 'tactical-battle-map hidden';
        
        this.mapContainer.innerHTML = `
            <div class="battle-map-header">
                <div class="map-title">
                    <h3>⚔️ Tactical Battle Map</h3>
                    <div class="map-controls">
                        <button class="btn btn-secondary" id="zoom-in">🔍+</button>
                        <button class="btn btn-secondary" id="zoom-out">🔍-</button>
                        <button class="btn btn-secondary" id="center-map">🎯</button>
                        <button class="btn btn-secondary" id="toggle-grid">⊞</button>
                    </div>
                </div>
                <div class="tactical-info" id="tactical-info">
                    <div class="range-indicator">Range: <span id="range-display">-</span></div>
                    <div class="movement-indicator">Movement: <span id="movement-display">-</span></div>
                    <div class="threat-indicator">Threats: <span id="threat-display">-</span></div>
                </div>
            </div>
            <div class="battle-map-viewport" id="map-viewport">
                <div class="battle-grid" id="battle-grid">
                    <!-- Grid will be generated here -->
                </div>
                <div class="map-overlays">
                    <canvas class="movement-overlay" id="movement-overlay"></canvas>
                    <canvas class="attack-overlay" id="attack-overlay"></canvas>
                    <canvas class="threat-overlay" id="threat-overlay"></canvas>
                    <canvas class="aoe-overlay" id="aoe-overlay"></canvas>
                </div>
            </div>
            <div class="tactical-sidebar">
                <div class="selected-combatant" id="selected-combatant">
                    <h4>Select a combatant</h4>
                    <p>Click on a character or enemy to see their options</p>
                </div>
                <div class="tactical-actions" id="tactical-actions">
                    <!-- Tactical action buttons will appear here -->
                </div>
                <div class="battlefield-info">
                    <h4>Battlefield</h4>
                    <div class="terrain-legend" id="terrain-legend">
                        <!-- Terrain types will be listed here -->
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles
        const styles = `
            <style>
                .tactical-battle-map {
                    position: fixed;
                    top: 60px; /* Below combat banner */
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: var(--color-background-primary);
                    z-index: 500;
                    display: flex;
                    flex-direction: column;
                }

                .tactical-battle-map.hidden {
                    display: none;
                }

                .battle-map-header {
                    background: var(--color-background-secondary);
                    padding: var(--spacing-md);
                    border-bottom: 2px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .map-title {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-lg);
                }

                .map-title h3 {
                    margin: 0;
                    color: var(--color-accent);
                    font-family: var(--font-title);
                }

                .map-controls {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .tactical-info {
                    display: flex;
                    gap: var(--spacing-lg);
                    font-size: 0.9rem;
                }

                .tactical-info > div {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-xs) var(--spacing-sm);
                    background: var(--color-background-primary);
                    border-radius: var(--border-radius);
                }

                .battle-map-viewport {
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                    position: relative;
                }

                .battle-grid {
                    flex: 1;
                    display: grid;
                    grid-template-columns: repeat(20, 30px);
                    grid-template-rows: repeat(20, 30px);
                    gap: 1px;
                    background: var(--color-border);
                    padding: var(--spacing-md);
                    overflow: auto;
                    position: relative;
                }

                .grid-cell {
                    background: var(--color-background-secondary);
                    border: 1px solid var(--color-border);
                    position: relative;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .grid-cell:hover {
                    background: var(--color-background-primary);
                }

                .grid-cell.valid-move {
                    background: rgba(76, 175, 80, 0.3);
                    border-color: #4CAF50;
                }

                .grid-cell.attack-range {
                    background: rgba(255, 152, 0, 0.3);
                    border-color: #FF9800;
                }

                .grid-cell.threat-zone {
                    background: rgba(244, 67, 54, 0.2);
                    border-color: #F44336;
                }

                .grid-cell.selected-path {
                    background: rgba(33, 150, 243, 0.5);
                    border-color: #2196F3;
                }

                .grid-cell.obstacle {
                    background: #424242;
                    border-color: #212121;
                }

                .grid-cell.cover {
                    background: var(--color-warning);
                    opacity: 0.7;
                }

                .grid-cell.difficult-terrain {
                    background: repeating-linear-gradient(
                        45deg,
                        var(--color-background-secondary),
                        var(--color-background-secondary) 2px,
                        #8BC34A 2px,
                        #8BC34A 4px
                    );
                }

                .map-overlays {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: none;
                }

                .map-overlays canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }

                .tactical-sidebar {
                    width: 300px;
                    background: var(--color-background-secondary);
                    border-left: 2px solid var(--color-border);
                    padding: var(--spacing-md);
                    overflow-y: auto;
                }

                .selected-combatant {
                    background: var(--color-background-primary);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing-lg);
                }

                .selected-combatant h4 {
                    margin: 0 0 var(--spacing-sm) 0;
                    color: var(--color-accent);
                }

                .combatant-stats {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-md);
                }

                .stat-item {
                    text-align: center;
                    padding: var(--spacing-xs);
                    background: var(--color-background-secondary);
                    border-radius: var(--border-radius);
                }

                .stat-label {
                    font-size: 0.7rem;
                    color: var(--color-text-secondary);
                    text-transform: uppercase;
                }

                .stat-value {
                    font-size: 1.1rem;
                    font-weight: bold;
                    color: var(--color-text-primary);
                }

                .tactical-actions {
                    margin-bottom: var(--spacing-lg);
                }

                .tactical-action-btn {
                    width: 100%;
                    margin-bottom: var(--spacing-sm);
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-sm);
                    padding: var(--spacing-sm);
                    text-align: left;
                    border-radius: var(--border-radius);
                    transition: all 0.2s ease;
                }

                .tactical-action-btn:hover:not(:disabled) {
                    transform: translateX(4px);
                }

                .tactical-action-btn:disabled {
                    opacity: 0.5;
                }

                .action-icon {
                    font-size: 1.2rem;
                    width: 24px;
                    text-align: center;
                }

                .action-details {
                    flex: 1;
                }

                .action-name {
                    font-weight: 600;
                    margin-bottom: 2px;
                }

                .action-desc {
                    font-size: 0.8rem;
                    color: var(--color-text-secondary);
                }

                .terrain-legend {
                    font-size: 0.85rem;
                }

                .terrain-item {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    margin-bottom: var(--spacing-xs);
                }

                .terrain-icon {
                    width: 16px;
                    height: 16px;
                    border: 1px solid var(--color-border);
                    border-radius: 2px;
                }

                .terrain-icon.obstacle {
                    background: #424242;
                }

                .terrain-icon.cover {
                    background: var(--color-warning);
                }

                .terrain-icon.difficult {
                    background: repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 1px,
                        #8BC34A 1px,
                        #8BC34A 2px
                    );
                }

                /* Combatant pieces on tactical map */
                .tactical-combatant-piece {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    border: 2px solid;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 0.7rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: absolute;
                    z-index: 10;
                    user-select: none;
                }

                .tactical-combatant-piece.player {
                    background: linear-gradient(135deg, #4CAF50, #66BB6A);
                    border-color: #2E7D32;
                    color: white;
                    box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
                }

                .tactical-combatant-piece.enemy {
                    background: linear-gradient(135deg, #F44336, #EF5350);
                    border-color: #C62828;
                    color: white;
                    box-shadow: 0 2px 4px rgba(244, 67, 54, 0.3);
                }

                .tactical-combatant-piece.selected {
                    transform: scale(1.2);
                    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
                    border-color: gold;
                    z-index: 15;
                }

                .tactical-combatant-piece.active-turn {
                    animation: glow 2s infinite alternate;
                }

                .tactical-combatant-piece.unconscious {
                    opacity: 0.5;
                    filter: grayscale(100%);
                    transform: rotate(90deg);
                }

                .tactical-combatant-piece.moving {
                    z-index: 20;
                    transform: scale(1.1);
                    transition: all 0.1s ease;
                }

                @keyframes glow {
                    0% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
                    100% { box-shadow: 0 0 25px rgba(255, 215, 0, 1); }
                }

                /* Movement path visualization */
                .movement-path-line {
                    stroke: #2196F3;
                    stroke-width: 3;
                    stroke-dasharray: 5,5;
                    fill: none;
                    animation: dash 1s linear infinite;
                }

                @keyframes dash {
                    to { stroke-dashoffset: -10; }
                }

                /* Attack range visualization */
                .attack-range-circle {
                    fill: rgba(255, 152, 0, 0.2);
                    stroke: #FF9800;
                    stroke-width: 2;
                    stroke-dasharray: 3,3;
                }

                /* Threat zone visualization */
                .threat-zone-area {
                    fill: rgba(244, 67, 54, 0.15);
                    stroke: #F44336;
                    stroke-width: 1;
                    stroke-dasharray: 2,2;
                }

                /* Line of sight visualization */
                .los-line {
                    stroke: rgba(255, 255, 255, 0.8);
                    stroke-width: 2;
                    stroke-dasharray: 2,2;
                    fill: none;
                }

                .los-blocked {
                    stroke: rgba(244, 67, 54, 0.8);
                    stroke-dasharray: 1,3;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.appendChild(this.mapContainer);
        
        // Initialize grid
        this.generateBattleGrid();
        this.setupOverlayCanvases();
    }

    /**
     * Generate the tactical battle grid
     */
    generateBattleGrid() {
        const grid = document.getElementById('battle-grid');
        if (!grid) return;

        grid.innerHTML = '';
        
        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.id = `cell-${row}-${col}`;
                
                // Add terrain if it exists
                const position = `${row},${col}`;
                if (this.terrain.has(position)) {
                    cell.classList.add(this.terrain.get(position));
                }
                
                // Add click handler
                cell.addEventListener('click', (e) => {
                    this.handleGridCellClick(row, col, e);
                });
                
                // Add hover handler
                cell.addEventListener('mouseenter', () => {
                    this.handleGridCellHover(row, col);
                });
                
                grid.appendChild(cell);
            }
        }
    }

    /**
     * Setup overlay canvases for drawing tactical elements
     */
    setupOverlayCanvases() {
        const viewport = document.getElementById('map-viewport');
        if (!viewport) return;

        ['movement', 'attack', 'threat', 'aoe'].forEach(type => {
            const canvas = document.getElementById(`${type}-overlay`);
            if (canvas) {
                const rect = viewport.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
                this.overlays[type] = canvas.getContext('2d');
            }
        });
    }

    // ===== TACTICAL MODE ACTIVATION =====

    /**
     * Activate tactical combat mode
     */
    activateTacticalMode(combatData) {
        console.log('🗺️ Activating tactical battle map');
        
        this.mapContainer.classList.remove('hidden');
        
        // Place all combatants on the map
        this.placeCombatantsOnMap(combatData.participants);
        
        // Generate appropriate terrain
        this.generateBattlefieldTerrain(combatData);
        
        // Calculate initial threat zones
        this.calculateThreatZones();
        
        // Show terrain legend
        this.updateTerrainLegend();
    }

    /**
     * Deactivate tactical mode
     */
    deactivateTacticalMode() {
        console.log('🗺️ Deactivating tactical battle map');
        
        this.mapContainer.classList.add('hidden');
        this.clearAllOverlays();
        this.selectedCombatant = null;
        this.movementMode = false;
        this.attackMode = false;
        this.movementPath = [];
    }

    /**
     * Place all combatants on the battle map
     */
    placeCombatantsOnMap(participants) {
        // Clear existing pieces
        document.querySelectorAll('.tactical-combatant-piece').forEach(piece => {
            piece.remove();
        });

        participants.forEach(combatant => {
            this.placeCombatantPiece(combatant);
        });
    }

    /**
     * Place individual combatant piece on map
     */
    placeCombatantPiece(combatant) {
        const piece = document.createElement('div');
        piece.className = `tactical-combatant-piece ${combatant.isPlayerCharacter ? 'player' : 'enemy'}`;
        piece.id = `tactical-piece-${combatant.id}`;
        piece.textContent = combatant.name.charAt(0).toUpperCase();
        piece.title = `${combatant.name} (${combatant.hitPoints}/${combatant.maxHitPoints} HP)`;
        
        // Position the piece
        const position = combatant.position || this.getDefaultPosition(combatant);
        this.movePieceToPosition(piece, position.x, position.y);
        
        // Add click handler
        piece.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectCombatant(combatant.id);
        });
        
        // Add drag functionality for player characters
        if (combatant.isPlayerCharacter) {
            this.makePieceDraggable(piece, combatant);
        }
        
        // Add status effects
        if (combatant.hitPoints <= 0) {
            piece.classList.add('unconscious');
        }
        
        document.getElementById('battle-grid').appendChild(piece);
    }

    /**
     * Get default position for combatant
     */
    getDefaultPosition(combatant) {
        if (combatant.isPlayerCharacter) {
            // Place players on left side
            return { x: Math.floor(Math.random() * 3) + 1, y: Math.floor(Math.random() * 5) + 8 };
        } else {
            // Place enemies on right side
            return { x: Math.floor(Math.random() * 3) + 16, y: Math.floor(Math.random() * 5) + 8 };
        }
    }

    /**
     * Move piece to grid position
     */
    movePieceToPosition(piece, row, col) {
        const gridRect = document.getElementById('battle-grid').getBoundingClientRect();
        const cellSize = this.gridSize + 1; // Account for border
        
        piece.style.left = `${col * cellSize + 1}px`;
        piece.style.top = `${row * cellSize + 1}px`;
        
        // Update combatant position data
        const combatantId = piece.id.replace('tactical-piece-', '');
        const combatant = this.combatSystem.currentCombat?.participants.get(combatantId);
        if (combatant) {
            combatant.position = { x: row, y: col };
        }
    }

    // ===== TACTICAL INTERACTIONS =====

    /**
     * Handle grid cell click
     */
    handleGridCellClick(row, col, event) {
        console.log(`🎯 Grid cell clicked: ${row}, ${col}`);
        
        if (this.movementMode && this.selectedCombatant) {
            this.attemptMoveToPosition(row, col);
        } else if (this.attackMode && this.selectedCombatant) {
            this.attemptAttackPosition(row, col);
        } else {
            // Select combatant at this position
            const piece = this.getCombatantAtPosition(row, col);
            if (piece) {
                const combatantId = piece.id.replace('tactical-piece-', '');
                this.selectCombatant(combatantId);
            } else {
                this.clearSelection();
            }
        }
    }

    /**
     * Handle grid cell hover
     */
    handleGridCellHover(row, col) {
        if (this.movementMode && this.selectedCombatant) {
            this.updateMovementPath(row, col);
        } else if (this.attackMode && this.selectedCombatant) {
            this.showAttackPreview(row, col);
        }
        
        // Update tactical info
        this.updateTacticalInfo(row, col);
    }

    /**
     * Select a combatant for tactical operations
     */
    selectCombatant(combatantId) {
        const combatant = this.combatSystem.currentCombat?.participants.get(combatantId);
        if (!combatant) return;
        
        console.log(`🎯 Selected combatant: ${combatant.name}`);
        
        // Clear previous selection
        this.clearSelection();
        
        // Set new selection
        this.selectedCombatant = combatant;
        
        // Highlight selected piece
        const piece = document.getElementById(`tactical-piece-${combatantId}`);
        if (piece) {
            piece.classList.add('selected');
        }
        
        // Update sidebar
        this.updateSelectedCombatantDisplay(combatant);
        
        // Show available options
        this.showTacticalOptions(combatant);
        
        // Highlight valid moves and attacks
        this.highlightCombatantOptions(combatant);
    }

    /**
     * Clear current selection
     */
    clearSelection() {
        document.querySelectorAll('.tactical-combatant-piece.selected').forEach(piece => {
            piece.classList.remove('selected');
        });
        
        this.selectedCombatant = null;
        this.movementMode = false;
        this.attackMode = false;
        this.clearAllHighlights();
        this.clearAllOverlays();
    }

    /**
     * Update selected combatant display in sidebar
     */
    updateSelectedCombatantDisplay(combatant) {
        const container = document.getElementById('selected-combatant');
        if (!container) return;

        const healthPercent = (combatant.hitPoints / combatant.maxHitPoints) * 100;
        const healthColor = healthPercent > 75 ? '#4CAF50' : healthPercent > 25 ? '#FF9800' : '#F44336';
        
        container.innerHTML = `
            <h4>${combatant.name}</h4>
            <div class="combatant-stats">
                <div class="stat-item">
                    <div class="stat-label">HP</div>
                    <div class="stat-value" style="color: ${healthColor}">
                        ${combatant.hitPoints}/${combatant.maxHitPoints}
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">AC</div>
                    <div class="stat-value">${combatant.armorClass}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Speed</div>
                    <div class="stat-value">${combatant.stats.speed || 30} ft</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Initiative</div>
                    <div class="stat-value">${combatant.initiative}</div>
                </div>
            </div>
            <div class="status-effects">
                ${combatant.statusEffects.map(effect => 
                    `<span class="status-effect">${effect.name}</span>`
                ).join('')}
            </div>
        `;
    }

    /**
     * Show tactical options for selected combatant
     */
    showTacticalOptions(combatant) {
        const container = document.getElementById('tactical-actions');
        if (!container) return;

        const isPlayerCharacter = combatant.isPlayerCharacter;
        const isCurrentTurn = this.combatSystem.currentCombat?.turnOrder[this.combatSystem.currentTurnIndex] === combatant.id;
        
        if (!isPlayerCharacter || !isCurrentTurn) {
            container.innerHTML = '<p>Not your turn or not your character</p>';
            return;
        }

        const actions = [
            {
                id: 'tactical-move',
                icon: '👟',
                name: 'Move',
                desc: `${combatant.actions.movement} ft remaining`,
                enabled: combatant.actions.movement > 0,
                handler: () => this.enterMovementMode()
            },
            {
                id: 'tactical-attack',
                icon: '⚔️',
                name: 'Attack',
                desc: 'Melee or ranged attack',
                enabled: combatant.actions.action,
                handler: () => this.enterAttackMode()
            },
            {
                id: 'tactical-cast',
                icon: '✨',
                name: 'Cast Spell',
                desc: 'Cast a spell or cantrip',
                enabled: combatant.actions.action,
                handler: () => this.showSpellMenu()
            },
            {
                id: 'tactical-item',
                icon: '🧪',
                name: 'Use Item',
                desc: 'Use consumable item',
                enabled: combatant.actions.action,
                handler: () => this.showItemMenu()
            },
            {
                id: 'tactical-dodge',
                icon: '🛡️',
                name: 'Dodge',
                desc: 'Gain advantage on Dex saves',
                enabled: combatant.actions.action,
                handler: () => this.performDodge()
            },
            {
                id: 'tactical-help',
                icon: '🤝',
                name: 'Help',
                desc: 'Give ally advantage',
                enabled: combatant.actions.action,
                handler: () => this.performHelp()
            }
        ];

        container.innerHTML = actions.map(action => `
            <button class="tactical-action-btn btn ${action.enabled ? 'btn-primary' : 'btn-secondary'}" 
                    id="${action.id}" ${!action.enabled ? 'disabled' : ''}>
                <div class="action-icon">${action.icon}</div>
                <div class="action-details">
                    <div class="action-name">${action.name}</div>
                    <div class="action-desc">${action.desc}</div>
                </div>
            </button>
        `).join('');

        // Bind action handlers
        actions.forEach(action => {
            const button = document.getElementById(action.id);
            if (button && action.enabled) {
                button.addEventListener('click', action.handler);
            }
        });
    }

    // ===== MOVEMENT SYSTEM =====

    /**
     * Enter movement mode
     */
    enterMovementMode() {
        if (!this.selectedCombatant) return;
        
        console.log('🏃 Entering movement mode');
        this.movementMode = true;
        this.attackMode = false;
        
        // Calculate valid movement positions
        this.calculateValidMovement(this.selectedCombatant);
        
        // Highlight valid moves
        this.highlightValidMoves();
        
        // Update UI feedback
        this.updateTacticalInfo(null, null, 'Click a highlighted square to move there');
    }

    /**
     * Calculate valid movement positions
     */
    calculateValidMovement(combatant) {
        this.validMoves.clear();
        const startPos = combatant.position;
        const maxDistance = Math.floor(combatant.actions.movement / 5); // Convert feet to squares
        
        // Use breadth-first search to find reachable positions
        const queue = [{pos: startPos, distance: 0, path: [startPos]}];
        const visited = new Set();
        
        while (queue.length > 0) {
            const {pos, distance, path} = queue.shift();
            const posKey = `${pos.x},${pos.y}`;
            
            if (visited.has(posKey)) continue;
            visited.add(posKey);
            
            if (distance <= maxDistance) {
                this.validMoves.add(posKey);
            }
            
            if (distance < maxDistance) {
                // Add adjacent positions
                const adjacent = [
                    {x: pos.x - 1, y: pos.y}, {x: pos.x + 1, y: pos.y},
                    {x: pos.x, y: pos.y - 1}, {x: pos.x, y: pos.y + 1},
                    // Diagonal movement
                    {x: pos.x - 1, y: pos.y - 1}, {x: pos.x + 1, y: pos.y - 1},
                    {x: pos.x - 1, y: pos.y + 1}, {x: pos.x + 1, y: pos.y + 1}
                ];
                
                adjacent.forEach(nextPos => {
                    if (this.isValidPosition(nextPos) && !this.isObstructed(nextPos)) {
                        const moveCost = this.getMovementCost(pos, nextPos);
                        if (distance + moveCost <= maxDistance) {
                            queue.push({
                                pos: nextPos,
                                distance: distance + moveCost,
                                path: [...path, nextPos]
                            });
                        }
                    }
                });
            }
        }
    }

    /**
     * Highlight valid movement positions
     */
    highlightValidMoves() {
        this.clearGridHighlights();
        
        this.validMoves.forEach(posKey => {
            const [row, col] = posKey.split(',').map(Number);
            const cell = document.getElementById(`cell-${row}-${col}`);
            if (cell) {
                cell.classList.add('valid-move');
            }
        });
    }

    /**
     * Attempt to move to position
     */
    attemptMoveToPosition(row, col) {
        const targetPos = `${row},${col}`;
        
        if (!this.validMoves.has(targetPos)) {
            console.log('❌ Invalid move position');
            return;
        }
        
        if (this.getCombatantAtPosition(row, col)) {
            console.log('❌ Position occupied');
            return;
        }
        
        // Calculate movement cost
        const startPos = this.selectedCombatant.position;
        const distance = this.calculateDistance(startPos, {x: row, y: col});
        const movementCost = distance * 5; // 5 feet per square
        
        if (movementCost > this.selectedCombatant.actions.movement) {
            console.log('❌ Not enough movement');
            return;
        }
        
        // Perform the move
        this.executeCombatantMove(this.selectedCombatant.id, row, col, movementCost);
    }

    /**
     * Execute combatant movement
     */
    executeCombatantMove(combatantId, row, col, movementCost) {
        const combatant = this.combatSystem.currentCombat?.participants.get(combatantId);
        const piece = document.getElementById(`tactical-piece-${combatantId}`);
        
        if (!combatant || !piece) return;
        
        console.log(`🏃 ${combatant.name} moves to ${row}, ${col} (${movementCost} ft)`);
        
        // Animate movement
        piece.classList.add('moving');
        this.movePieceToPosition(piece, row, col);
        
        // Update combatant data
        combatant.actions.movement -= movementCost;
        combatant.position = {x: row, y: col};
        
        // Update display
        setTimeout(() => {
            piece.classList.remove('moving');
            this.updateSelectedCombatantDisplay(combatant);
            this.exitMovementMode();
            
            // Recalculate threat zones
            this.calculateThreatZones();
        }, 300);
        
        // Record movement
        if (this.core.getModule('interactionHistory')) {
            this.core.getModule('interactionHistory').logPlayerAction({
                type: 'tactical_movement',
                description: `${combatant.name} moved to position (${row}, ${col})`,
                result: 'success',
                tags: ['combat', 'movement', 'tactical'],
                combatContext: {
                    combatantId: combatantId,
                    fromPosition: `${combatant.position.x},${combatant.position.y}`,
                    toPosition: `${row},${col}`,
                    movementCost: movementCost
                }
            });
        }
    }

    /**
     * Exit movement mode
     */
    exitMovementMode() {
        this.movementMode = false;
        this.clearGridHighlights();
        this.clearOverlay('movement');
        this.validMoves.clear();
        this.movementPath = [];
    }

    // ===== ATTACK SYSTEM =====

    /**
     * Enter attack mode
     */
    enterAttackMode() {
        if (!this.selectedCombatant) return;
        
        console.log('⚔️ Entering attack mode');
        this.attackMode = true;
        this.movementMode = false;
        
        // Calculate attack range
        this.calculateAttackRange(this.selectedCombatant);
        
        // Highlight attack targets
        this.highlightAttackRange();
        
        // Update UI feedback
        this.updateTacticalInfo(null, null, 'Click an enemy to attack');
    }

    /**
     * Calculate attack range positions
     */
    calculateAttackRange(combatant) {
        this.attackRange.clear();
        const pos = combatant.position;
        
        // Melee range (adjacent squares)
        const meleeRange = [
            {x: pos.x - 1, y: pos.y - 1}, {x: pos.x, y: pos.y - 1}, {x: pos.x + 1, y: pos.y - 1},
            {x: pos.x - 1, y: pos.y},                              {x: pos.x + 1, y: pos.y},
            {x: pos.x - 1, y: pos.y + 1}, {x: pos.x, y: pos.y + 1}, {x: pos.x + 1, y: pos.y + 1}
        ];
        
        meleeRange.forEach(attackPos => {
            if (this.isValidPosition(attackPos)) {
                this.attackRange.add(`${attackPos.x},${attackPos.y}`);
            }
        });
        
        // Ranged attacks (simplified - 60ft range)
        const rangedRange = 12; // 60 feet = 12 squares
        for (let dx = -rangedRange; dx <= rangedRange; dx++) {
            for (let dy = -rangedRange; dy <= rangedRange; dy++) {
                const attackPos = {x: pos.x + dx, y: pos.y + dy};
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= rangedRange && this.isValidPosition(attackPos)) {
                    // Check line of sight for ranged attacks
                    if (this.hasLineOfSight(pos, attackPos)) {
                        this.attackRange.add(`${attackPos.x},${attackPos.y}`);
                    }
                }
            }
        }
    }

    /**
     * Highlight attack range
     */
    highlightAttackRange() {
        this.clearGridHighlights();
        
        this.attackRange.forEach(posKey => {
            const [row, col] = posKey.split(',').map(Number);
            const cell = document.getElementById(`cell-${row}-${col}`);
            
            // Only highlight if there's an enemy there
            const piece = this.getCombatantAtPosition(row, col);
            if (cell && piece && !piece.classList.contains('player')) {
                cell.classList.add('attack-range');
            }
        });
    }

    /**
     * Attempt attack at position
     */
    attemptAttackPosition(row, col) {
        const target = this.getCombatantAtPosition(row, col);
        if (!target) {
            console.log('❌ No target at position');
            return;
        }
        
        const targetId = target.id.replace('tactical-piece-', '');
        const targetCombatant = this.combatSystem.currentCombat?.participants.get(targetId);
        
        if (!targetCombatant || targetCombatant.isPlayerCharacter) {
            console.log('❌ Invalid attack target');
            return;
        }
        
        const attackPos = `${row},${col}`;
        if (!this.attackRange.has(attackPos)) {
            console.log('❌ Target out of range');
            return;
        }
        
        // Execute attack
        this.executeAttack(this.selectedCombatant, targetCombatant);
    }

    /**
     * Execute attack between combatants
     */
    async executeAttack(attacker, target) {
        console.log(`⚔️ ${attacker.name} attacks ${target.name}`);
        
        // Roll attack
        const attackRoll = Math.floor(Math.random() * 20) + 1;
        const attackBonus = this.combatSystem.getAttackBonus(attacker);
        const totalAttack = attackRoll + attackBonus;
        
        // Check for hit
        const hit = totalAttack >= target.armorClass;
        
        if (hit) {
            // Roll damage
            const damageRoll = Math.floor(Math.random() * 8) + 1;
            const damageBonus = this.combatSystem.getAbilityModifier(attacker.stats.str || 12);
            const totalDamage = damageRoll + damageBonus;
            
            // Apply damage
            await this.combatSystem.dealDamage(target.id, totalDamage, 'physical');
            
            // Visual feedback
            this.showDamageAnimation(target.id, totalDamage);
            
            console.log(`💥 Hit! ${totalDamage} damage`);
        } else {
            console.log(`❌ Miss! ${totalAttack} vs AC ${target.armorClass}`);
            this.showMissAnimation(target.id);
        }
        
        // Use action
        attacker.actions.action = false;
        
        // Update displays
        this.updateSelectedCombatantDisplay(attacker);
        this.updateCombatantPiece(target.id);
        
        // Exit attack mode
        this.exitAttackMode();
        
        // Auto-end turn if no actions left
        if (!attacker.actions.action && !attacker.actions.bonus && attacker.actions.movement <= 0) {
            setTimeout(() => {
                this.combatSystem.endTurn();
            }, 1000);
        }
    }

    /**
     * Exit attack mode
     */
    exitAttackMode() {
        this.attackMode = false;
        this.clearGridHighlights();
        this.clearOverlay('attack');
        this.attackRange.clear();
    }

    // ===== UTILITY FUNCTIONS =====

    /**
     * Check if position is valid on the grid
     */
    isValidPosition(pos) {
        return pos.x >= 0 && pos.x < this.gridHeight && pos.y >= 0 && pos.y < this.gridWidth;
    }

    /**
     * Check if position is obstructed
     */
    isObstructed(pos) {
        const posKey = `${pos.x},${pos.y}`;
        return this.obstacles.has(posKey) || this.getCombatantAtPosition(pos.x, pos.y) !== null;
    }

    /**
     * Get movement cost between adjacent positions
     */
    getMovementCost(fromPos, toPos) {
        const posKey = `${toPos.x},${toPos.y}`;
        
        // Diagonal movement costs 1.5x
        const isDiagonal = fromPos.x !== toPos.x && fromPos.y !== toPos.y;
        let baseCost = isDiagonal ? 1.5 : 1;
        
        // Difficult terrain doubles cost
        if (this.terrain.get(posKey) === 'difficult-terrain') {
            baseCost *= 2;
        }
        
        return baseCost;
    }

    /**
     * Calculate distance between positions
     */
    calculateDistance(pos1, pos2) {
        const dx = Math.abs(pos1.x - pos2.x);
        const dy = Math.abs(pos1.y - pos2.y);
        return Math.max(dx, dy); // D&D uses diagonal distance
    }

    /**
     * Check line of sight between positions
     */
    hasLineOfSight(fromPos, toPos) {
        // Simplified line of sight - check for obstacles along the path
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        if (steps === 0) return true;
        
        const stepX = dx / steps;
        const stepY = dy / steps;
        
        for (let i = 1; i < steps; i++) {
            const checkPos = {
                x: Math.round(fromPos.x + stepX * i),
                y: Math.round(fromPos.y + stepY * i)
            };
            
            const posKey = `${checkPos.x},${checkPos.y}`;
            if (this.obstacles.has(posKey)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Get combatant piece at position
     */
    getCombatantAtPosition(row, col) {
        const pieces = document.querySelectorAll('.tactical-combatant-piece');
        for (const piece of pieces) {
            const pieceRect = piece.getBoundingClientRect();
            const gridRect = document.getElementById('battle-grid').getBoundingClientRect();
            const cellSize = this.gridSize + 1;
            
            const pieceRow = Math.floor((piece.offsetTop - 1) / cellSize);
            const pieceCol = Math.floor((piece.offsetLeft - 1) / cellSize);
            
            if (pieceRow === row && pieceCol === col) {
                return piece;
            }
        }
        return null;
    }

    /**
     * Update combatant piece visual state
     */
    updateCombatantPiece(combatantId) {
        const piece = document.getElementById(`tactical-piece-${combatantId}`);
        const combatant = this.combatSystem.currentCombat?.participants.get(combatantId);
        
        if (piece && combatant) {
            piece.title = `${combatant.name} (${combatant.hitPoints}/${combatant.maxHitPoints} HP)`;
            
            if (combatant.hitPoints <= 0) {
                piece.classList.add('unconscious');
            } else {
                piece.classList.remove('unconscious');
            }
        }
    }

    /**
     * Show damage animation
     */
    showDamageAnimation(combatantId, damage) {
        const piece = document.getElementById(`tactical-piece-${combatantId}`);
        if (piece) {
            const damageText = document.createElement('div');
            damageText.textContent = `-${damage}`;
            damageText.style.cssText = `
                position: absolute;
                color: #F44336;
                font-weight: bold;
                font-size: 1.2rem;
                pointer-events: none;
                z-index: 100;
                animation: damage-float 1.5s ease-out forwards;
            `;
            
            piece.appendChild(damageText);
            
            setTimeout(() => {
                damageText.remove();
            }, 1500);
        }
    }

    /**
     * Show miss animation
     */
    showMissAnimation(combatantId) {
        const piece = document.getElementById(`tactical-piece-${combatantId}`);
        if (piece) {
            const missText = document.createElement('div');
            missText.textContent = 'MISS';
            missText.style.cssText = `
                position: absolute;
                color: #757575;
                font-weight: bold;
                font-size: 0.8rem;
                pointer-events: none;
                z-index: 100;
                animation: miss-float 1s ease-out forwards;
            `;
            
            piece.appendChild(missText);
            
            setTimeout(() => {
                missText.remove();
            }, 1000);
        }
    }

    /**
     * Generate battlefield terrain
     */
    generateBattlefieldTerrain(combatData) {
        // Simple terrain generation based on location type
        const location = combatData.location;
        
        // Add some random obstacles
        const numObstacles = Math.floor(Math.random() * 8) + 4;
        for (let i = 0; i < numObstacles; i++) {
            const row = Math.floor(Math.random() * this.gridHeight);
            const col = Math.floor(Math.random() * this.gridWidth);
            const posKey = `${row},${col}`;
            
            if (!this.getCombatantAtPosition(row, col)) {
                this.terrain.set(posKey, 'obstacle');
                this.obstacles.add(posKey);
                
                const cell = document.getElementById(`cell-${row}-${col}`);
                if (cell) {
                    cell.classList.add('obstacle');
                }
            }
        }
        
        // Add some difficult terrain
        const numDifficult = Math.floor(Math.random() * 6) + 2;
        for (let i = 0; i < numDifficult; i++) {
            const row = Math.floor(Math.random() * this.gridHeight);
            const col = Math.floor(Math.random() * this.gridWidth);
            const posKey = `${row},${col}`;
            
            if (!this.obstacles.has(posKey) && !this.getCombatantAtPosition(row, col)) {
                this.terrain.set(posKey, 'difficult-terrain');
                
                const cell = document.getElementById(`cell-${row}-${col}`);
                if (cell) {
                    cell.classList.add('difficult-terrain');
                }
            }
        }
    }

    /**
     * Calculate threat zones for all enemies
     */
    calculateThreatZones() {
        // Clear existing threat zones
        document.querySelectorAll('.threat-zone').forEach(cell => {
            cell.classList.remove('threat-zone');
        });
        
        if (!this.combatSystem.currentCombat) return;
        
        // Calculate threat zones for each enemy
        this.combatSystem.currentCombat.participants.forEach(combatant => {
            if (!combatant.isPlayerCharacter && combatant.hitPoints > 0) {
                this.calculateCombatantThreatZone(combatant);
            }
        });
    }

    /**
     * Calculate threat zone for individual combatant
     */
    calculateCombatantThreatZone(combatant) {
        const pos = combatant.position;
        const reach = 1; // Most enemies have 5-foot reach (1 square)
        
        for (let dx = -reach; dx <= reach; dx++) {
            for (let dy = -reach; dy <= reach; dy++) {
                if (dx === 0 && dy === 0) continue; // Skip combatant's own position
                
                const threatPos = {x: pos.x + dx, y: pos.y + dy};
                if (this.isValidPosition(threatPos)) {
                    const cell = document.getElementById(`cell-${threatPos.x}-${threatPos.y}`);
                    if (cell) {
                        cell.classList.add('threat-zone');
                    }
                }
            }
        }
    }

    /**
     * Update terrain legend
     */
    updateTerrainLegend() {
        const legend = document.getElementById('terrain-legend');
        if (!legend) return;
        
        legend.innerHTML = `
            <div class="terrain-item">
                <div class="terrain-icon obstacle"></div>
                <span>Obstacle (Blocks movement)</span>
            </div>
            <div class="terrain-item">
                <div class="terrain-icon difficult"></div>
                <span>Difficult Terrain (2x movement)</span>
            </div>
            <div class="terrain-item">
                <div class="terrain-icon cover"></div>
                <span>Cover (+2 AC vs ranged)</span>
            </div>
        `;
    }

    /**
     * Clear all grid highlights
     */
    clearGridHighlights() {
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.classList.remove('valid-move', 'attack-range', 'selected-path');
        });
    }

    /**
     * Clear all overlay canvases
     */
    clearAllOverlays() {
        Object.values(this.overlays).forEach(ctx => {
            if (ctx) {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        });
    }

    /**
     * Clear specific overlay
     */
    clearOverlay(type) {
        if (this.overlays[type]) {
            this.overlays[type].clearRect(0, 0, this.overlays[type].canvas.width, this.overlays[type].canvas.height);
        }
    }

    /**
     * Update tactical information display
     */
    updateTacticalInfo(row = null, col = null, message = null) {
        const rangeDisplay = document.getElementById('range-display');
        const movementDisplay = document.getElementById('movement-display');
        const threatDisplay = document.getElementById('threat-display');
        
        if (message) {
            if (rangeDisplay) rangeDisplay.textContent = message;
            return;
        }
        
        if (this.selectedCombatant) {
            if (movementDisplay) {
                movementDisplay.textContent = `${this.selectedCombatant.actions.movement} ft`;
            }
            
            if (row !== null && col !== null) {
                const distance = this.calculateDistance(this.selectedCombatant.position, {x: row, y: col}) * 5;
                if (rangeDisplay) rangeDisplay.textContent = `${distance} ft`;
                
                // Check for threats at this position
                const cell = document.getElementById(`cell-${row}-${col}`);
                const inThreatZone = cell?.classList.contains('threat-zone');
                if (threatDisplay) {
                    threatDisplay.textContent = inThreatZone ? 'In threat zone!' : 'Safe';
                }
            }
        }
    }

    /**
     * Bind tactical event handlers
     */
    bindTacticalEvents() {
        // Zoom controls
        document.getElementById('zoom-in')?.addEventListener('click', () => {
            this.adjustZoom(1.2);
        });
        
        document.getElementById('zoom-out')?.addEventListener('click', () => {
            this.adjustZoom(0.8);
        });
        
        document.getElementById('center-map')?.addEventListener('click', () => {
            this.centerOnActiveCombatant();
        });
        
        document.getElementById('toggle-grid')?.addEventListener('click', () => {
            this.toggleGridLines();
        });
    }

    /**
     * Update tactical display when turn changes
     */
    updateTacticalDisplay(combatantData) {
        // Remove active turn indicator from all pieces
        document.querySelectorAll('.tactical-combatant-piece').forEach(piece => {
            piece.classList.remove('active-turn');
        });
        
        // Add active turn indicator to current combatant
        const activePiece = document.getElementById(`tactical-piece-${combatantData.combatantId}`);
        if (activePiece) {
            activePiece.classList.add('active-turn');
        }
        
        // Recalculate threat zones
        this.calculateThreatZones();
        
        // If it's a player character's turn, auto-select them
        const combatant = this.combatSystem.currentCombat?.participants.get(combatantData.combatantId);
        if (combatant?.isPlayerCharacter) {
            this.selectCombatant(combatantData.combatantId);
        }
    }

    // ===== PUBLIC API =====

    /**
     * Check if tactical map is active
     */
    isTacticalModeActive() {
        return !this.mapContainer.classList.contains('hidden');
    }

    /**
     * Force show tactical map (for testing)
     */
    showTacticalMap() {
        this.mapContainer.classList.remove('hidden');
    }

    /**
     * Force hide tactical map
     */
    hideTacticalMap() {
        this.mapContainer.classList.add('hidden');
    }

    /**
     * Get tactical battle map element
     */
    getBattleMapElement() {
        return this.mapContainer;
    }
}