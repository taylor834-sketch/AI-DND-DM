export default class TacticalBattleMap {
    constructor(core) {
        this.core = core;
        this.combatSystem = null;
        this.worldDatabase = null;
        this.sessionEncounter = null;
        this.battleMapRepository = null;
        
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
        
        // Current map data and terrain
        this.currentMapData = null;
        this.terrain = new Map(); // Grid position -> terrain type
        this.obstacles = new Set(); // Blocking positions
        this.coverPositions = new Map(); // Position -> cover type
        this.elevationMap = new Map(); // Position -> elevation level
        this.buildings = []; // Building data with names
        
        // Visual elements
        this.overlays = {
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
            this.sessionEncounter = this.core.getModule('sessionEncounter');
            this.battleMapRepository = this.core.getModule('battleMapRepository');
            
            this.createTacticalBattleMap();
            this.bindTacticalEvents();
            
            console.log('🗺️ Tactical Battle Map initialized with repository');
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
        
        // Listen for name reveal events
        this.core.on('session:nameRevealed', (event) => {
            this.updateTokenName(event.detail);
        });
        
        this.core.on('session:participantUpdated', (event) => {
            this.updateTokenForParticipant(event.detail.participant);
        });
        
        // Listen for token addition from scene parser
        this.core.on('battleMap:addToken', (event) => {
            this.addTokenFromParticipant(event.detail.participant, event.detail.autoPosition);
        });
        
        // Listen for map repository events
        this.core.on('battleMap:loaded', (event) => {
            this.loadMapData(event.detail.mapData);
        });
        
        this.core.on('battleMap:generateFor', (event) => {
            this.generateMapForLocation(event.detail);
        });
    }

    // ===== BATTLE MAP CREATION =====

    /**
     * Create the tactical battle map interface
     */
    createTacticalBattleMap() {
        // Check if we should embed in game UI or create overlay
        const embeddedContainer = document.getElementById('embedded-battle-map-container');
        const isEmbedded = !!embeddedContainer;
        
        if (isEmbedded) {
            // Embed into game UI
            this.mapContainer = embeddedContainer;
            this.mapContainer.className = 'tactical-battle-map embedded-battle-map';
            this.isEmbedded = true;
        } else {
            // Create overlay (fallback)
            this.mapContainer = document.createElement('div');
            this.mapContainer.id = 'tactical-battle-map';
            this.mapContainer.className = 'tactical-battle-map hidden';
            this.isEmbedded = false;
        }
        
        this.mapContainer.innerHTML = `
            <div class="battle-map-header">
                <div class="map-title">
                    <h3>⚔️ Tactical Battle Map</h3>
                    <div class="map-controls">
                        <button class="btn btn-secondary" id="zoom-in">🔍+</button>
                        <button class="btn btn-secondary" id="zoom-out">🔍-</button>
                        <button class="btn btn-secondary" id="center-map">🎯</button>
                        <button class="btn btn-secondary" id="toggle-grid">⊞</button>
${isEmbedded ? 
                            '<button class="btn btn-secondary" id="close-battle-map">🧹 Clear</button>' : 
                            '<button class="btn btn-danger" id="close-battle-map">✕ Close</button>'
                        }
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
                    background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
                    display: flex;
                    flex-direction: column;
                    border-radius: 8px;
                    border: 1px solid var(--color-border);
                }
                
                /* Overlay mode (fallback) */
                .tactical-battle-map:not(.embedded-battle-map) {
                    position: fixed;
                    top: 60px;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 500;
                }
                
                /* Embedded mode */
                .embedded-battle-map {
                    height: 100%;
                    width: 100%;
                    position: relative;
                    max-height: 600px;
                    min-height: 400px;
                }
                
                /* Water animation */
                @keyframes waterFlow {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                
                /* Terrain specific styles */
                .terrain-grass {
                    background: linear-gradient(45deg, #4a7c59 0%, #68a085 50%, #4a7c59 100%) !important;
                }
                
                .terrain-tree {
                    background: radial-gradient(circle at 50% 80%, #2d5016 0%, #4a7c59 30%, #68a085 100%) !important;
                    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40% !important;
                }
                
                .terrain-rock {
                    background: linear-gradient(145deg, #8d8d8d, #5a5a5a) !important;
                    border-radius: 30% 70% 70% 30% !important;
                    box-shadow: inset -3px -3px 6px rgba(0,0,0,0.3) !important;
                }
                
                .terrain-water {
                    background: linear-gradient(90deg, #4fc3f7, #29b6f6, #0288d1) !important;
                    background-size: 200% 200% !important;
                    animation: waterFlow 3s infinite ease-in-out !important;
                }
                
                .terrain-road {
                    background: linear-gradient(90deg, #8d6e63, #a1887f, #8d6e63) !important;
                    position: relative !important;
                }
                
                .terrain-road::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: repeating-linear-gradient(
                        90deg,
                        transparent,
                        transparent 8px,
                        rgba(139, 126, 102, 0.3) 8px,
                        rgba(139, 126, 102, 0.3) 10px
                    );
                }
                
                .terrain-wall {
                    background: linear-gradient(145deg, #795548, #5d4037) !important;
                    border: 2px solid #3e2723 !important;
                    box-shadow: inset 2px 2px 4px rgba(255,255,255,0.1) !important;
                }
                
                .terrain-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 16px;
                    pointer-events: none;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
                    z-index: 1;
                    user-select: none;
                }
                
                .building-name {
                    position: absolute;
                    background: rgba(0,0,0,0.9);
                    color: #f5f5f5;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                    white-space: nowrap;
                    z-index: 15;
                    pointer-events: none;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
                    border: 1px solid #8d6e63;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                }
                
                .terrain-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                    font-size: 11px;
                    color: var(--color-text-secondary);
                }
                
                .terrain-icon {
                    width: 16px;
                    text-align: center;
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
                
                /* Adjust header for embedded mode */
                .embedded-battle-map .battle-map-header {
                    padding: var(--spacing-sm);
                }
                
                .embedded-battle-map .map-title h3 {
                    font-size: 1.1rem;
                    margin: 0;
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
                    min-height: 300px;
                }
                
                /* Embedded viewport adjustments */
                .embedded-battle-map .battle-map-viewport {
                    min-height: 250px;
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
                
                /* Embedded sidebar adjustments */
                .embedded-battle-map .tactical-sidebar {
                    width: 250px;
                    padding: var(--spacing-sm);
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

        // Add styles if not already added
        if (!document.getElementById('tactical-battle-map-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'tactical-battle-map-styles';
            styleElement.textContent = styles.replace('<style>', '').replace('</style>', '');
            document.head.appendChild(styleElement);
        }
        
        // Add container to document if not embedded
        if (!isEmbedded) {
            document.body.appendChild(this.mapContainer);
        }
        
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
        // Get display name from session encounter or world database
        let displayName = combatant.name || 'Unknown';
        
        if (this.sessionEncounter) {
            const participant = this.sessionEncounter.getParticipant(combatant.id);
            if (participant) {
                displayName = participant.displayName;
            }
        } 
        
        // Fallback to world database if no session participant found
        if (displayName === combatant.name && this.worldDatabase && combatant.npcId) {
            displayName = this.worldDatabase.getDisplayName(combatant.npcId);
        }
        
        // Additional fallback - if still no good name, ensure we have something
        if (!displayName || displayName === 'Unknown') {
            displayName = combatant.name || 'Unknown Character';
        }
        
        const piece = document.createElement('div');
        piece.className = `tactical-combatant-piece ${combatant.isPlayerCharacter ? 'player' : 'enemy'}`;
        piece.id = `tactical-piece-${combatant.id}`;
        piece.textContent = displayName.charAt(0).toUpperCase();
        piece.title = `${displayName} (${combatant.hitPoints}/${combatant.maxHitPoints} HP)`;
        piece.setAttribute('data-display-name', displayName);
        
        // Position the piece
        const position = combatant.position || this.getDefaultPosition(combatant);
        this.movePieceToPosition(piece, position.x, position.y);
        
        // Add click handler
        piece.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectCombatant(combatant.id);
        });
        
        // Add context menu for name reveals (only for NPCs/enemies)
        if (!combatant.isPlayerCharacter) {
            piece.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showTokenContextMenu(combatant.id, e);
            });
        }
        
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
     * Update token name when revealed
     */
    updateTokenName(data) {
        const piece = document.getElementById(`tactical-piece-${data.participantId}`);
        if (piece) {
            piece.textContent = data.realName.charAt(0).toUpperCase();
            piece.title = piece.title.replace(data.previousName, data.realName);
            piece.setAttribute('data-display-name', data.realName);
            
            // Visual feedback for name reveal
            piece.style.animation = 'pulse 0.5s ease-in-out 2';
            setTimeout(() => {
                piece.style.animation = '';
            }, 1000);
            
            console.log(`🗺️ Updated token: ${data.previousName} → ${data.realName}`);
        }
    }
    
    /**
     * Update token for participant changes
     */
    updateTokenForParticipant(participant) {
        const piece = document.getElementById(`tactical-piece-${participant.id}`);
        if (piece) {
            const displayName = participant.displayName;
            piece.textContent = displayName.charAt(0).toUpperCase();
            piece.setAttribute('data-display-name', displayName);
            
            // Update title with HP info
            const hpText = `(${participant.hitPoints}/${participant.maxHitPoints} HP)`;
            piece.title = `${displayName} ${hpText}`;
            
            // Update status classes
            if (participant.status === 'unconscious' || participant.hitPoints <= 0) {
                piece.classList.add('unconscious');
            } else {
                piece.classList.remove('unconscious');
            }
        }
    }

    /**
     * Add token from session participant
     */
    addTokenFromParticipant(participant, autoPosition = true) {
        // Create a combatant-like object from participant data
        const combatant = {
            id: participant.id,
            name: participant.displayName,
            isPlayerCharacter: participant.isPlayer,
            hitPoints: participant.hitPoints,
            maxHitPoints: participant.maxHitPoints,
            position: participant.position,
            npcId: participant.npcId
        };
        
        // Place the token
        this.placeCombatantPiece(combatant);
        
        console.log(`🗺️ Added token from scene: ${participant.displayName}`);
    }

    /**
     * Show context menu for token
     */
    showTokenContextMenu(combatantId, event) {
        // Remove any existing context menus
        const existingMenu = document.querySelector('.token-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Get participant info
        const participant = this.sessionEncounter?.getParticipant(combatantId);
        const combatant = this.combatSystem?.currentCombat?.participants.get(combatantId);
        
        if (!participant && !combatant) return;
        
        const displayName = participant?.displayName || combatant?.name;
        const hasRealName = participant?.hasRealName || !participant?.isGeneric;
        const partyKnowsName = participant?.partyKnowsName;
        
        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'token-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: var(--color-background-card);
            border: 1px solid var(--color-border);
            border-radius: var(--border-radius);
            padding: var(--spacing-sm);
            min-width: 200px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        let menuHTML = `
            <div class="context-menu-header">
                <strong>${displayName}</strong>
                ${participant?.isGeneric ? '<span class="generic-tag">Generic</span>' : ''}
            </div>
            <div class="context-menu-divider"></div>
        `;
        
        // Add name reveal option if applicable
        if (!partyKnowsName && hasRealName) {
            menuHTML += `
                <button class="context-menu-item" onclick="window.core.getModule('tacticalBattleMap').revealName('${combatantId}')">
                    💬 Reveal Name
                </button>
            `;
        } else if (partyKnowsName) {
            menuHTML += `
                <div class="context-menu-info">
                    ✓ Name known to party
                </div>
            `;
        }
        
        // Add other options
        if (!participant?.isGeneric) {
            menuHTML += `
                <button class="context-menu-item" onclick="window.core.getModule('tacticalBattleMap').promptForName('${combatantId}')">
                    ✏️ Set Custom Name
                </button>
            `;
        }
        
        menuHTML += `
            <div class="context-menu-divider"></div>
            <button class="context-menu-item" onclick="window.core.getModule('tacticalBattleMap').removeToken('${combatantId}')">
                🗑️ Remove Token
            </button>
        `;
        
        menu.innerHTML = menuHTML;
        
        // Add CSS for menu items
        const style = document.createElement('style');
        style.textContent = `
            .token-context-menu .context-menu-header {
                font-size: 0.9rem;
                margin-bottom: var(--spacing-xs);
                color: var(--color-text-primary);
            }
            
            .token-context-menu .generic-tag {
                font-size: 0.7rem;
                color: var(--color-text-secondary);
                background: var(--color-background);
                padding: 2px 6px;
                border-radius: 3px;
                margin-left: var(--spacing-xs);
            }
            
            .token-context-menu .context-menu-divider {
                border-bottom: 1px solid var(--color-border);
                margin: var(--spacing-xs) 0;
            }
            
            .token-context-menu .context-menu-item {
                display: block;
                width: 100%;
                padding: var(--spacing-xs);
                background: transparent;
                border: none;
                text-align: left;
                color: var(--color-text-primary);
                cursor: pointer;
                border-radius: var(--border-radius);
                margin-bottom: 2px;
            }
            
            .token-context-menu .context-menu-item:hover {
                background: var(--color-background);
            }
            
            .token-context-menu .context-menu-info {
                padding: var(--spacing-xs);
                color: var(--color-text-secondary);
                font-size: 0.85rem;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(menu);
        
        // Close menu on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 100);
    }
    
    /**
     * Reveal the real name of a character
     */
    revealName(combatantId) {
        // Get participant from session encounter
        const participant = this.sessionEncounter?.getParticipant(combatantId);
        if (!participant) return;
        
        // If it doesn't have a real name, prompt for one
        if (!participant.realName || participant.isGeneric) {
            this.promptForName(combatantId, 'Reveal Name');
            return;
        }
        
        // Reveal the name
        this.sessionEncounter.revealParticipantName(combatantId, participant.realName);
        
        // Close context menu
        const menu = document.querySelector('.token-context-menu');
        if (menu) menu.remove();
    }
    
    /**
     * Prompt for character name
     */
    promptForName(combatantId, title = 'Set Name') {
        const participant = this.sessionEncounter?.getParticipant(combatantId);
        if (!participant) return;
        
        const currentName = participant.realName || participant.displayName;
        const newName = prompt(`${title}:`, currentName);
        
        if (newName && newName.trim() && newName !== currentName) {
            this.sessionEncounter.revealParticipantName(combatantId, newName.trim());
        }
        
        // Close context menu
        const menu = document.querySelector('.token-context-menu');
        if (menu) menu.remove();
    }
    
    /**
     * Test method - generate different map types
     */
    testMapGeneration() {
        if (!this.battleMapRepository) {
            console.log('⚠️ Battle Map Repository not available');
            return;
        }
        
        // Show battle map
        this.mapContainer.classList.remove('hidden');
        
        const testMaps = [
            { locationName: 'Greenwood Village', locationType: 'village' },
            { locationName: 'Darkwood Forest', locationType: 'forest' },
            { locationName: 'Ancient Tomb', locationType: 'dungeon' },
            { locationName: 'Rolling Plains', locationType: 'wilderness' }
        ];
        
        let currentMapIndex = 0;
        
        const showNextMap = () => {
            if (currentMapIndex < testMaps.length) {
                const mapConfig = testMaps[currentMapIndex];
                console.log(`🗺️ Generating ${mapConfig.locationType} map: ${mapConfig.locationName}`);
                
                this.generateMapForLocation({
                    locationName: mapConfig.locationName,
                    locationType: mapConfig.locationType,
                    size: { width: this.gridWidth, height: this.gridHeight }
                });
                
                currentMapIndex++;
                
                // Show next map after 5 seconds
                setTimeout(showNextMap, 5000);
            } else {
                console.log('🎬 Map generation demo complete!');
            }
        };
        
        showNextMap();
    }
    
    /**
     * Test method - generate village map
     */
    testVillageMap() {
        this.generateMapForLocation({
            locationName: 'Test Village',
            locationType: 'village',
            size: { width: this.gridWidth, height: this.gridHeight }
        });
    }
    
    /**
     * Test method - generate forest map  
     */
    testForestMap() {
        this.generateMapForLocation({
            locationName: 'Test Forest',
            locationType: 'forest',
            size: { width: this.gridWidth, height: this.gridHeight }
        });
    }

    /**
     * Manual test method - add sample NPCs for testing
     */
    addTestNPCs() {
        if (!this.sessionEncounter) {
            console.log('⚠️ Session encounter not available');
            return;
        }
        
        // Show battle map if hidden
        this.mapContainer.classList.remove('hidden');
        
        const testNPCs = [
            {
                name: 'Sir Aldrich',
                genericName: 'Knight',
                partyKnowsName: false,
                race: 'human',
                class: 'paladin',
                isGeneric: false
            },
            {
                name: null,
                race: 'goblin',
                class: 'warrior',
                isGeneric: true
            },
            {
                name: 'Grix',
                genericName: 'Goblin Scout',
                partyKnowsName: false,
                race: 'goblin',
                class: 'scout',
                isGeneric: false
            }
        ];
        
        testNPCs.forEach(npcData => {
            const participant = this.sessionEncounter.addParticipant(npcData);
            this.addTokenFromParticipant(participant);
        });
        
        console.log('🧪 Added test NPCs to battle map');
    }

    /**
     * Remove token from battle map
     */
    removeToken(combatantId) {
        const piece = document.getElementById(`tactical-piece-${combatantId}`);
        if (piece) {
            piece.remove();
        }
        
        // Remove from session encounter
        this.sessionEncounter?.removeParticipant(combatantId);
        
        // Remove from combat if active
        if (this.combatSystem?.currentCombat) {
            this.combatSystem.currentCombat.participants.delete(combatantId);
        }
        
        // Close context menu
        const menu = document.querySelector('.token-context-menu');
        if (menu) menu.remove();
        
        console.log(`🗑️ Removed token: ${combatantId}`);
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
        if (!this.battleMapRepository) {
            this.generateSimpleTerrain(combatData);
            return;
        }
        
        const location = combatData.location || 'Unknown Location';
        
        // Check if we have a saved map for this location
        let mapData = this.battleMapRepository.loadMap(location);
        
        if (!mapData) {
            // Generate new map based on location type
            const locationType = this.determineLocationType(location);
            mapData = this.battleMapRepository.generateMap({
                locationName: location,
                locationType: locationType,
                size: { width: this.gridWidth, height: this.gridHeight }
            });
            console.log(`🗺️ Generated new ${locationType} map for: ${location}`);
        } else {
            console.log(`🗺️ Using saved map for: ${location}`);
        }
        
        this.loadMapData(mapData);
        
        // Link this map to the current session if available
        this.linkMapToCurrentSession(mapData);
    }
    
    /**
     * Load map data onto the battle grid
     */
    loadMapData(mapData) {
        if (!mapData || !mapData.grid) return;
        
        this.currentMapData = mapData;
        this.terrain.clear();
        this.obstacles.clear();
        this.coverPositions.clear();
        this.buildings = mapData.buildings || [];
        
        // Apply terrain to grid
        for (let y = 0; y < mapData.size.height && y < this.gridHeight; y++) {
            for (let x = 0; x < mapData.size.width && x < this.gridWidth; x++) {
                const terrainType = mapData.grid[y][x];
                if (terrainType) {
                    this.applyTerrainToCell(x, y, terrainType);
                }
            }
        }
        
        // Add building names
        this.displayBuildingNames();
        
        // Update terrain legend
        this.updateTerrainLegend();
        
        console.log(`🗺️ Loaded map: ${mapData.name} (${mapData.type})`);
    }
    
    /**
     * Apply terrain sprite and properties to a grid cell
     */
    applyTerrainToCell(x, y, terrainType) {
        const posKey = `${y},${x}`;
        const cell = document.getElementById(`cell-${y}-${x}`);
        if (!cell) return;
        
        const terrainSprite = this.battleMapRepository.getTerrainSprite(terrainType);
        if (!terrainSprite) return;
        
        // Store terrain data
        this.terrain.set(posKey, terrainType);
        
        // Handle movement and cover properties
        if (terrainSprite.movement === 0) {
            this.obstacles.add(posKey);
        }
        if (terrainSprite.cover > 0) {
            this.coverPositions.set(posKey, terrainSprite.cover);
        }
        
        // Apply visual styling
        cell.className = `grid-cell ${terrainSprite.cssClass}`;
        cell.style.cssText = terrainSprite.style;
        
        // Add emoji overlay for terrain
        if (terrainSprite.overlay) {
            const overlay = document.createElement('div');
            overlay.className = 'terrain-overlay';
            overlay.textContent = terrainSprite.overlay;
            overlay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 16px;
                pointer-events: none;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
                z-index: 1;
            `;
            cell.appendChild(overlay);
        }
        
        // Add tooltip
        if (terrainSprite.tooltip) {
            cell.title = terrainSprite.tooltip;
        }
    }
    
    /**
     * Display building names on the map
     */
    displayBuildingNames() {
        if (!this.buildings) return;
        
        this.buildings.forEach(building => {
            const nameElement = document.createElement('div');
            nameElement.className = 'building-name';
            nameElement.textContent = building.name;
            nameElement.style.cssText = `
                position: absolute;
                left: ${(building.x * (this.gridSize + 1)) + (building.width * this.gridSize / 2)}px;
                top: ${(building.y * (this.gridSize + 1)) - 20}px;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                font-weight: bold;
                white-space: nowrap;
                z-index: 10;
                pointer-events: none;
                text-shadow: none;
                border: 1px solid ${building.color || '#8d6e63'};
            `;
            
            const battleGrid = document.getElementById('battle-grid');
            if (battleGrid) {
                battleGrid.appendChild(nameElement);
            }
        });
    }
    
    /**
     * Update terrain legend
     */
    updateTerrainLegend() {
        const legend = document.getElementById('terrain-legend');
        if (!legend || !this.battleMapRepository) return;
        
        const terrainTypes = new Set();
        this.terrain.forEach(type => terrainTypes.add(type));
        
        legend.innerHTML = '';
        
        terrainTypes.forEach(terrainType => {
            const sprite = this.battleMapRepository.getTerrainSprite(terrainType);
            if (sprite) {
                const legendItem = document.createElement('div');
                legendItem.className = 'terrain-legend-item';
                legendItem.innerHTML = `
                    <span class="terrain-icon">${sprite.overlay || sprite.symbol}</span>
                    <span class="terrain-name">${sprite.name}</span>
                `;
                legendItem.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                    font-size: 12px;
                `;
                legend.appendChild(legendItem);
            }
        });
    }
    
    /**
     * Generate map for specific location
     */
    generateMapForLocation(options) {
        if (!this.battleMapRepository) return;
        
        const mapData = this.battleMapRepository.generateMap(options);
        this.loadMapData(mapData);
        
        // Show the battle map
        this.mapContainer.classList.remove('hidden');
    }
    
    /**
     * Determine location type from name
     */
    determineLocationType(locationName) {
        const lower = locationName.toLowerCase();
        
        if (lower.includes('forest') || lower.includes('wood') || lower.includes('grove')) {
            return 'forest';
        } else if (lower.includes('village') || lower.includes('town') || lower.includes('city')) {
            return 'village';
        } else if (lower.includes('dungeon') || lower.includes('cave') || lower.includes('tomb')) {
            return 'dungeon';
        } else if (lower.includes('wilderness') || lower.includes('plains') || lower.includes('field')) {
            return 'wilderness';
        }
        
        return 'village'; // Default
    }
    
    /**
     * Link map to current session
     */
    linkMapToCurrentSession(mapData) {
        if (!mapData || !this.battleMapRepository) return;
        
        // Try to get current session ID from various sources
        let currentSessionId = null;
        
        // Check campaign manager for current session
        const campaignManager = this.core.getModule('campaignManager');
        if (campaignManager && campaignManager.currentCampaign) {
            currentSessionId = campaignManager.currentCampaign.currentSessionId;
        }
        
        // Check auto-save system for session ID
        if (!currentSessionId) {
            const autoSave = this.core.getModule('autoSaveSystem');
            if (autoSave && autoSave.currentSessionId) {
                currentSessionId = autoSave.currentSessionId;
            }
        }
        
        // Generate session ID if none exists
        if (!currentSessionId) {
            currentSessionId = 'session_' + Date.now();
            console.log(`📝 Generated new session ID for battle map: ${currentSessionId}`);
        }
        
        // Link the map to this session
        this.battleMapRepository.linkMapToSession(mapData.id, currentSessionId);
    }
    
    /**
     * Get current battle map ID for saving
     */
    getCurrentBattleMapId() {
        return this.currentMapData?.id || null;
    }
    
    /**
     * Get battle map data for session save
     */
    getBattleMapSaveData() {
        if (!this.currentMapData) return null;
        
        return {
            currentMapId: this.currentMapData.id,
            mapName: this.currentMapData.name,
            locationType: this.currentMapData.type,
            isMapActive: !this.mapContainer.classList.contains('hidden')
        };
    }
    
    /**
     * Restore battle map from save data
     */
    restoreBattleMapFromSave(saveData) {
        if (!saveData || !saveData.currentMapId || !this.battleMapRepository) return;
        
        const mapData = this.battleMapRepository.loadMapById(saveData.currentMapId);
        if (mapData) {
            this.loadMapData(mapData);
            
            if (saveData.isMapActive) {
                this.mapContainer.classList.remove('hidden');
            }
            
            console.log(`🗺️ Restored battle map from save: ${mapData.name}`);
        }
    }

    /**
     * Fallback simple terrain generation
     */
    generateSimpleTerrain(combatData) {
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
        
        document.getElementById('close-battle-map')?.addEventListener('click', () => {
            this.hideBattleMap();
        });
    }
    
    /**
     * Hide the battle map
     */
    hideBattleMap() {
        if (this.mapContainer) {
            if (this.isEmbedded) {
                // In embedded mode, just clear the map content but keep container visible
                this.clearBattleMap();
                console.log('🗺️ Battle map cleared (embedded mode)');
            } else {
                // In overlay mode, hide completely
                this.mapContainer.classList.add('hidden');
                console.log('🗺️ Battle map hidden');
            }
        }
    }
    
    /**
     * Clear battle map content
     */
    clearBattleMap() {
        // Clear combatant pieces
        const pieces = this.mapContainer.querySelectorAll('.tactical-combatant-piece');
        pieces.forEach(piece => piece.remove());
        
        // Clear terrain
        this.terrain.clear();
        
        // Clear overlays
        Object.values(this.overlays).forEach(ctx => {
            if (ctx && ctx.canvas) {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        });
        
        // Reset grid to basic state
        this.generateBattleGrid();
    }
    
    /**
     * Show the battle map
     */
    showBattleMap() {
        if (this.mapContainer) {
            this.mapContainer.classList.remove('hidden');
            console.log('🗺️ Battle map shown');
        }
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