export default class DecisionTreeVisualizer {
    constructor(core) {
        this.core = core;
        this.choiceTrackingSystem = null;
        this.canvas = null;
        this.ctx = null;
        this.treeData = null;
        
        // Visualization settings
        this.settings = {
            nodeRadius: 25,
            nodeSpacing: 80,
            levelHeight: 120,
            canvasWidth: 1200,
            canvasHeight: 800,
            colors: {
                moral: { good: '#4CAF50', neutral: '#FFC107', evil: '#F44336' },
                impact: { low: '#90A4AE', medium: '#FF9800', high: '#E91E63' },
                category: {
                    moral: '#9C27B0',
                    social: '#2196F3',
                    tactical: '#FF5722',
                    resource: '#795548',
                    narrative: '#607D8B'
                },
                background: '#1a1a1a',
                text: '#ffffff',
                edge: '#666666',
                highlight: '#FFD700'
            },
            animation: {
                duration: 500,
                easing: 'ease-in-out'
            }
        };
        
        // Interaction state
        this.selectedNode = null;
        this.hoveredNode = null;
        this.viewportOffset = { x: 0, y: 0 };
        this.zoomLevel = 1.0;
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        
        // Layout data
        this.nodePositions = new Map();
        this.edgeData = [];
        
        this.init();
    }

    async init() {
        this.choiceTrackingSystem = this.core.getModule('choiceTrackingSystem');
        
        // Create visualization UI
        this.createVisualizationUI();
        
        // Set up canvas
        this.setupCanvas();
        
        // Bind events
        this.bindEvents();
        
        console.log('📊 Decision Tree Visualizer initialized');
    }

    /**
     * Create the visualization UI
     */
    createVisualizationUI() {
        const visualizerPanel = document.createElement('div');
        visualizerPanel.id = 'decision-tree-visualizer';
        visualizerPanel.className = 'decision-visualizer hidden';
        visualizerPanel.innerHTML = `
            <div class="visualizer-header">
                <h3>🌳 Decision Tree</h3>
                <div class="visualizer-controls">
                    <button id="refresh-tree" class="btn btn-secondary">Refresh</button>
                    <button id="export-tree" class="btn btn-secondary">Export</button>
                    <button id="fit-to-view" class="btn btn-secondary">Fit to View</button>
                    <button id="close-visualizer" class="btn btn-secondary">✕</button>
                </div>
            </div>
            
            <div class="visualizer-toolbar">
                <div class="filter-group">
                    <label>Filter by:</label>
                    <select id="category-filter">
                        <option value="all">All Choices</option>
                        <option value="moral">Moral Choices</option>
                        <option value="social">Social Choices</option>
                        <option value="tactical">Tactical Choices</option>
                        <option value="high_impact">High Impact Only</option>
                    </select>
                </div>
                
                <div class="view-group">
                    <label>View:</label>
                    <button id="chronological-view" class="btn btn-sm btn-secondary active">Chronological</button>
                    <button id="impact-view" class="btn btn-sm btn-secondary">By Impact</button>
                    <button id="theme-view" class="btn btn-sm btn-secondary">By Theme</button>
                </div>
                
                <div class="legend">
                    <div class="legend-item">
                        <span class="legend-color good"></span>
                        <span>Good Choice</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color neutral"></span>
                        <span>Neutral Choice</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color evil"></span>
                        <span>Evil Choice</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color high-impact"></span>
                        <span>High Impact</span>
                    </div>
                </div>
            </div>
            
            <div class="canvas-container">
                <canvas id="decision-tree-canvas" width="1200" height="800"></canvas>
                <div class="canvas-overlay">
                    <div id="node-tooltip" class="node-tooltip hidden">
                        <div class="tooltip-content"></div>
                    </div>
                </div>
            </div>
            
            <div class="visualizer-sidebar">
                <div id="choice-details" class="choice-details">
                    <h4>Choice Details</h4>
                    <p>Click on a node to see detailed information about that choice.</p>
                </div>
                
                <div id="consequence-chain" class="consequence-chain">
                    <h4>Consequence Chain</h4>
                    <div class="chain-content">
                        <p>Select a choice to see its consequences and butterfly effects.</p>
                    </div>
                </div>
                
                <div id="personality-impact" class="personality-impact">
                    <h4>Personality Impact</h4>
                    <div class="trait-bars">
                        <!-- Personality trait bars will be populated here -->
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            .decision-visualizer {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.95);
                z-index: 1000;
                display: flex;
                flex-direction: column;
            }

            .visualizer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-md);
                background: var(--color-bg);
                border-bottom: 1px solid var(--color-border);
            }

            .visualizer-header h3 {
                margin: 0;
                color: var(--color-accent);
            }

            .visualizer-controls {
                display: flex;
                gap: var(--spacing-sm);
            }

            .visualizer-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-sm) var(--spacing-md);
                background: var(--color-bg-secondary);
                border-bottom: 1px solid var(--color-border);
                flex-wrap: wrap;
                gap: var(--spacing-md);
            }

            .filter-group, .view-group {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
            }

            .view-group .btn.active {
                background: var(--color-accent);
                color: var(--color-bg);
            }

            .legend {
                display: flex;
                gap: var(--spacing-md);
                flex-wrap: wrap;
            }

            .legend-item {
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
                font-size: 0.8rem;
            }

            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            .legend-color.good { background: #4CAF50; }
            .legend-color.neutral { background: #FFC107; }
            .legend-color.evil { background: #F44336; }
            .legend-color.high-impact { background: #E91E63; }

            .canvas-container {
                flex: 1;
                position: relative;
                overflow: hidden;
                background: #1a1a1a;
            }

            #decision-tree-canvas {
                display: block;
                cursor: grab;
            }

            #decision-tree-canvas:active {
                cursor: grabbing;
            }

            .canvas-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }

            .node-tooltip {
                position: absolute;
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-sm);
                max-width: 300px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                z-index: 10;
                pointer-events: none;
            }

            .tooltip-content h5 {
                margin: 0 0 var(--spacing-xs) 0;
                color: var(--color-accent);
            }

            .tooltip-content p {
                margin: 0;
                font-size: 0.8rem;
                color: var(--color-text-secondary);
            }

            .visualizer-sidebar {
                width: 300px;
                background: var(--color-bg-secondary);
                border-left: 1px solid var(--color-border);
                padding: var(--spacing-md);
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: var(--spacing-md);
            }

            .choice-details, .consequence-chain, .personality-impact {
                background: var(--color-bg);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius);
                padding: var(--spacing-md);
            }

            .choice-details h4, .consequence-chain h4, .personality-impact h4 {
                margin: 0 0 var(--spacing-sm) 0;
                color: var(--color-accent);
            }

            .trait-bars {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-xs);
            }

            .trait-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--spacing-xs);
            }

            .trait-bar-fill {
                flex: 1;
                height: 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                margin: 0 var(--spacing-sm);
                position: relative;
                overflow: hidden;
            }

            .trait-bar-progress {
                height: 100%;
                background: var(--color-accent);
                border-radius: 3px;
                transition: width 0.3s ease;
            }

            .consequence-item {
                padding: var(--spacing-xs);
                margin: var(--spacing-xs) 0;
                background: rgba(255, 255, 255, 0.05);
                border-radius: var(--border-radius);
                border-left: 3px solid var(--color-accent);
            }

            .consequence-item h6 {
                margin: 0 0 var(--spacing-xs) 0;
                color: var(--color-accent);
                font-size: 0.8rem;
            }

            .consequence-item p {
                margin: 0;
                font-size: 0.7rem;
                color: var(--color-text-secondary);
            }

            .hidden {
                display: none;
            }

            /* Responsive design */
            @media (max-width: 1024px) {
                .decision-visualizer {
                    flex-direction: column;
                }
                
                .visualizer-sidebar {
                    width: 100%;
                    max-height: 300px;
                    border-left: none;
                    border-top: 1px solid var(--color-border);
                }
                
                .canvas-container {
                    min-height: 400px;
                }
            }
        `;

        document.head.appendChild(styles);
        document.body.appendChild(visualizerPanel);
    }

    /**
     * Set up canvas for drawing
     */
    setupCanvas() {
        this.canvas = document.getElementById('decision-tree-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set up high-DPI rendering
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Control buttons
        document.getElementById('refresh-tree')?.addEventListener('click', () => {
            this.refreshTree();
        });

        document.getElementById('export-tree')?.addEventListener('click', () => {
            this.exportTree();
        });

        document.getElementById('fit-to-view')?.addEventListener('click', () => {
            this.fitToView();
        });

        document.getElementById('close-visualizer')?.addEventListener('click', () => {
            this.hideVisualizer();
        });

        // View controls
        document.getElementById('chronological-view')?.addEventListener('click', (e) => {
            this.setActiveView(e.target, 'chronological');
        });

        document.getElementById('impact-view')?.addEventListener('click', (e) => {
            this.setActiveView(e.target, 'impact');
        });

        document.getElementById('theme-view')?.addEventListener('click', (e) => {
            this.setActiveView(e.target, 'theme');
        });

        // Filter dropdown
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            this.applyFilter(e.target.value);
        });

        // Canvas interactions
        this.canvas?.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });

        this.canvas?.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.canvas?.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });

        this.canvas?.addEventListener('wheel', (e) => {
            this.handleWheel(e);
        });

        this.canvas?.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.redraw();
        });
    }

    /**
     * Show the visualizer with current choice data
     */
    async showVisualizer() {
        if (!this.choiceTrackingSystem) return;
        
        // Load current tree data
        this.treeData = this.choiceTrackingSystem.generateDecisionTree();
        
        // Calculate layout
        this.calculateLayout();
        
        // Show the panel
        const panel = document.getElementById('decision-tree-visualizer');
        panel.classList.remove('hidden');
        
        // Initial draw
        this.redraw();
        
        // Update sidebar with summary
        this.updateSidebar();
        
        console.log('📊 Decision tree visualizer opened');
    }

    /**
     * Hide the visualizer
     */
    hideVisualizer() {
        const panel = document.getElementById('decision-tree-visualizer');
        panel.classList.add('hidden');
    }

    /**
     * Calculate layout for tree nodes
     */
    calculateLayout() {
        if (!this.treeData || !this.treeData.nodes.length) {
            this.nodePositions.clear();
            return;
        }

        const nodes = this.treeData.nodes;
        const viewMode = this.getActiveViewMode();
        
        switch (viewMode) {
            case 'chronological':
                this.calculateChronologicalLayout(nodes);
                break;
            case 'impact':
                this.calculateImpactLayout(nodes);
                break;
            case 'theme':
                this.calculateThemeLayout(nodes);
                break;
            default:
                this.calculateChronologicalLayout(nodes);
        }
        
        this.calculateEdgeData();
    }

    /**
     * Calculate chronological layout
     */
    calculateChronologicalLayout(nodes) {
        const sortedNodes = nodes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const nodesPerRow = Math.ceil(Math.sqrt(sortedNodes.length));
        
        sortedNodes.forEach((node, index) => {
            const row = Math.floor(index / nodesPerRow);
            const col = index % nodesPerRow;
            
            const x = 100 + (col * this.settings.nodeSpacing);
            const y = 100 + (row * this.settings.levelHeight);
            
            this.nodePositions.set(node.id, { x, y });
        });
    }

    /**
     * Calculate impact-based layout
     */
    calculateImpactLayout(nodes) {
        const impactGroups = {
            high: nodes.filter(n => n.narrativeImpact >= 7),
            medium: nodes.filter(n => n.narrativeImpact >= 3 && n.narrativeImpact < 7),
            low: nodes.filter(n => n.narrativeImpact < 3)
        };
        
        let yOffset = 100;
        
        ['high', 'medium', 'low'].forEach(impactLevel => {
            const groupNodes = impactGroups[impactLevel];
            const nodesPerRow = Math.ceil(Math.sqrt(groupNodes.length));
            
            groupNodes.forEach((node, index) => {
                const row = Math.floor(index / nodesPerRow);
                const col = index % nodesPerRow;
                
                const x = 100 + (col * this.settings.nodeSpacing);
                const y = yOffset + (row * this.settings.levelHeight);
                
                this.nodePositions.set(node.id, { x, y });
            });
            
            yOffset += Math.ceil(groupNodes.length / nodesPerRow) * this.settings.levelHeight + 50;
        });
    }

    /**
     * Calculate theme-based layout
     */
    calculateThemeLayout(nodes) {
        // Group by primary category
        const categoryGroups = {};
        
        nodes.forEach(node => {
            const primaryCategory = node.categories[0] || 'uncategorized';
            if (!categoryGroups[primaryCategory]) {
                categoryGroups[primaryCategory] = [];
            }
            categoryGroups[primaryCategory].push(node);
        });
        
        const categories = Object.keys(categoryGroups);
        const cols = Math.ceil(Math.sqrt(categories.length));
        
        categories.forEach((category, categoryIndex) => {
            const categoryRow = Math.floor(categoryIndex / cols);
            const categoryCol = categoryIndex % cols;
            
            const categoryNodes = categoryGroups[category];
            const nodesPerRow = Math.ceil(Math.sqrt(categoryNodes.length));
            
            const categoryBaseX = 100 + (categoryCol * 300);
            const categoryBaseY = 100 + (categoryRow * 300);
            
            categoryNodes.forEach((node, nodeIndex) => {
                const row = Math.floor(nodeIndex / nodesPerRow);
                const col = nodeIndex % nodesPerRow;
                
                const x = categoryBaseX + (col * this.settings.nodeSpacing * 0.7);
                const y = categoryBaseY + (row * this.settings.levelHeight * 0.7);
                
                this.nodePositions.set(node.id, { x, y });
            });
        });
    }

    /**
     * Calculate edge connection data
     */
    calculateEdgeData() {
        this.edgeData = [];
        
        if (!this.treeData || !this.treeData.edges) return;
        
        for (const edge of this.treeData.edges) {
            const fromPos = this.nodePositions.get(edge.from);
            const toPos = this.nodePositions.get(edge.to);
            
            if (fromPos && toPos) {
                this.edgeData.push({
                    from: fromPos,
                    to: toPos,
                    type: edge.type,
                    strength: edge.strength
                });
            }
        }
    }

    /**
     * Redraw the entire tree
     */
    redraw() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width / (window.devicePixelRatio || 1), 
                          this.canvas.height / (window.devicePixelRatio || 1));
        
        // Apply viewport transformation
        this.ctx.save();
        this.ctx.translate(this.viewportOffset.x, this.viewportOffset.y);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        
        // Draw edges first (behind nodes)
        this.drawEdges();
        
        // Draw nodes
        this.drawNodes();
        
        this.ctx.restore();
        
        // Draw UI overlays
        this.drawUIOverlays();
    }

    /**
     * Draw connection edges
     */
    drawEdges() {
        if (!this.edgeData.length) return;
        
        for (const edge of this.edgeData) {
            this.ctx.strokeStyle = this.settings.colors.edge;
            this.ctx.lineWidth = Math.max(1, edge.strength * 3);
            this.ctx.setLineDash([]);
            
            if (edge.type === 'consequence') {
                this.ctx.setLineDash([5, 3]);
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(edge.from.x, edge.from.y);
            this.ctx.lineTo(edge.to.x, edge.to.y);
            this.ctx.stroke();
        }
    }

    /**
     * Draw choice nodes
     */
    drawNodes() {
        if (!this.treeData || !this.treeData.nodes.length) {
            this.drawEmptyState();
            return;
        }
        
        for (const node of this.treeData.nodes) {
            const pos = this.nodePositions.get(node.id);
            if (!pos) continue;
            
            this.drawNode(node, pos.x, pos.y);
        }
    }

    /**
     * Draw individual node
     */
    drawNode(node, x, y) {
        const radius = this.settings.nodeRadius;
        const isSelected = this.selectedNode === node.id;
        const isHovered = this.hoveredNode === node.id;
        
        // Node background
        this.ctx.fillStyle = this.getNodeColor(node);
        this.ctx.strokeStyle = isSelected ? this.settings.colors.highlight : 
                              isHovered ? this.settings.colors.text : 'transparent';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Impact indicator (inner ring)
        if (node.narrativeImpact >= 5) {
            this.ctx.strokeStyle = this.settings.colors.impact.high;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Consequence indicators (small dots around node)
        if (node.consequences > 0) {
            this.drawConsequenceIndicators(x, y, radius, node.consequences);
        }
        
        // Butterfly effect indicators
        if (node.butterflySeeds > 0) {
            this.drawButterflyIndicators(x, y, radius, node.butterflySeeds);
        }
        
        // Node label (choice number or abbreviation)
        this.ctx.fillStyle = this.settings.colors.text;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const nodeIndex = this.treeData.nodes.indexOf(node) + 1;
        this.ctx.fillText(nodeIndex.toString(), x, y);
    }

    /**
     * Get color for node based on moral weight and categories
     */
    getNodeColor(node) {
        if (node.moralWeight > 1) return this.settings.colors.moral.good;
        if (node.moralWeight < -1) return this.settings.colors.moral.evil;
        
        // Use category color if no strong moral weight
        const primaryCategory = node.categories[0];
        if (primaryCategory && this.settings.colors.category[primaryCategory]) {
            return this.settings.colors.category[primaryCategory];
        }
        
        return this.settings.colors.moral.neutral;
    }

    /**
     * Draw consequence indicators around node
     */
    drawConsequenceIndicators(x, y, radius, count) {
        const indicatorRadius = 3;
        const orbitRadius = radius + 8;
        
        for (let i = 0; i < Math.min(count, 8); i++) {
            const angle = (i / 8) * Math.PI * 2;
            const indicatorX = x + Math.cos(angle) * orbitRadius;
            const indicatorY = y + Math.sin(angle) * orbitRadius;
            
            this.ctx.fillStyle = this.settings.colors.impact.medium;
            this.ctx.beginPath();
            this.ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    /**
     * Draw butterfly effect indicators
     */
    drawButterflyIndicators(x, y, radius, count) {
        this.ctx.save();
        this.ctx.translate(x + radius - 5, y - radius + 5);
        
        for (let i = 0; i < Math.min(count, 3); i++) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = '10px Arial';
            this.ctx.fillText('🦋', i * 8 - count * 4, 0);
        }
        
        this.ctx.restore();
    }

    /**
     * Draw empty state message
     */
    drawEmptyState() {
        this.ctx.fillStyle = this.settings.colors.text;
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const centerX = this.canvas.width / (2 * (window.devicePixelRatio || 1));
        const centerY = this.canvas.height / (2 * (window.devicePixelRatio || 1));
        
        this.ctx.fillText('No choices recorded yet', centerX, centerY);
        this.ctx.font = '16px Arial';
        this.ctx.fillText('Make some meaningful decisions to see your story unfold here', centerX, centerY + 40);
    }

    /**
     * Draw UI overlays (zoom indicator, etc.)
     */
    drawUIOverlays() {
        // Zoom indicator
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`Zoom: ${(this.zoomLevel * 100).toFixed(0)}%`, 10, 10);
        
        // Node count
        if (this.treeData && this.treeData.nodes.length > 0) {
            this.ctx.fillText(`Choices: ${this.treeData.nodes.length}`, 10, 30);
        }
    }

    // ===== EVENT HANDLERS =====

    handleMouseDown(e) {
        this.isDragging = true;
        this.lastMousePos = this.getMousePos(e);
    }

    handleMouseMove(e) {
        const mousePos = this.getMousePos(e);
        
        if (this.isDragging) {
            // Pan the view
            const dx = mousePos.x - this.lastMousePos.x;
            const dy = mousePos.y - this.lastMousePos.y;
            
            this.viewportOffset.x += dx;
            this.viewportOffset.y += dy;
            
            this.redraw();
        } else {
            // Check for node hover
            const hoveredNode = this.getNodeAtPosition(mousePos);
            if (hoveredNode !== this.hoveredNode) {
                this.hoveredNode = hoveredNode;
                this.updateTooltip(mousePos, hoveredNode);
                this.redraw();
            }
        }
        
        this.lastMousePos = mousePos;
    }

    handleMouseUp(e) {
        this.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const mousePos = this.getMousePos(e);
        
        // Zoom towards mouse position
        this.zoomLevel = Math.max(0.1, Math.min(3.0, this.zoomLevel * zoomFactor));
        
        this.redraw();
    }

    handleCanvasClick(e) {
        const mousePos = this.getMousePos(e);
        const clickedNode = this.getNodeAtPosition(mousePos);
        
        if (clickedNode) {
            this.selectNode(clickedNode);
        } else {
            this.selectNode(null);
        }
    }

    // ===== HELPER METHODS =====

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    getNodeAtPosition(mousePos) {
        if (!this.treeData) return null;
        
        // Convert mouse position to world coordinates
        const worldX = (mousePos.x - this.viewportOffset.x) / this.zoomLevel;
        const worldY = (mousePos.y - this.viewportOffset.y) / this.zoomLevel;
        
        for (const node of this.treeData.nodes) {
            const pos = this.nodePositions.get(node.id);
            if (!pos) continue;
            
            const dx = worldX - pos.x;
            const dy = worldY - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance <= this.settings.nodeRadius) {
                return node.id;
            }
        }
        
        return null;
    }

    selectNode(nodeId) {
        this.selectedNode = nodeId;
        this.updateChoiceDetails(nodeId);
        this.redraw();
    }

    updateTooltip(mousePos, nodeId) {
        const tooltip = document.getElementById('node-tooltip');
        
        if (nodeId && this.treeData) {
            const node = this.treeData.nodes.find(n => n.id === nodeId);
            if (node) {
                tooltip.innerHTML = `
                    <div class="tooltip-content">
                        <h5>${node.label}</h5>
                        <p>Impact: ${node.narrativeImpact}/10</p>
                        <p>Consequences: ${node.consequences}</p>
                        <p>Moral Weight: ${node.moralWeight}</p>
                    </div>
                `;
                
                tooltip.style.left = (mousePos.x + 10) + 'px';
                tooltip.style.top = (mousePos.y - 10) + 'px';
                tooltip.classList.remove('hidden');
            }
        } else {
            tooltip.classList.add('hidden');
        }
    }

    updateChoiceDetails(nodeId) {
        const detailsElement = document.getElementById('choice-details');
        
        if (nodeId && this.treeData && this.choiceTrackingSystem) {
            const node = this.treeData.nodes.find(n => n.id === nodeId);
            const choice = this.choiceTrackingSystem.choiceHistory.get(nodeId);
            
            if (node && choice) {
                detailsElement.innerHTML = `
                    <h4>Choice Details</h4>
                    <div class="choice-info">
                        <p><strong>Decision:</strong> ${choice.description}</p>
                        <p><strong>Selected:</strong> ${choice.selectedOption}</p>
                        <p><strong>Date:</strong> ${new Date(choice.timestamp).toLocaleDateString()}</p>
                        <p><strong>Location:</strong> ${choice.context.location}</p>
                        <p><strong>Stakes:</strong> ${choice.context.stakes}</p>
                        <p><strong>Categories:</strong> ${choice.categories.join(', ')}</p>
                        <p><strong>Moral Weight:</strong> ${choice.moralWeight}</p>
                        <p><strong>Narrative Impact:</strong> ${choice.narrativeImpact}</p>
                    </div>
                `;
                
                // Update consequences
                this.updateConsequenceChain(choice);
            }
        } else {
            detailsElement.innerHTML = `
                <h4>Choice Details</h4>
                <p>Click on a node to see detailed information about that choice.</p>
            `;
            
            // Clear consequences
            this.updateConsequenceChain(null);
        }
    }

    updateConsequenceChain(choice) {
        const chainElement = document.getElementById('consequence-chain');
        
        if (choice && choice.immediateConsequences.length > 0) {
            let consequenceHTML = '<h4>Consequence Chain</h4>';
            
            for (const consequence of choice.immediateConsequences) {
                consequenceHTML += `
                    <div class="consequence-item">
                        <h6>${consequence.type}</h6>
                        <p>${consequence.description}</p>
                    </div>
                `;
            }
            
            // Add butterfly effects if any
            if (choice.butterflyEffectSeeds.length > 0) {
                consequenceHTML += `
                    <div class="consequence-item">
                        <h6>Future Implications 🦋</h6>
                        <p>${choice.butterflyEffectSeeds.length} butterfly effects planted for future consequences</p>
                    </div>
                `;
            }
            
            chainElement.innerHTML = consequenceHTML;
        } else {
            chainElement.innerHTML = `
                <h4>Consequence Chain</h4>
                <div class="chain-content">
                    <p>Select a choice to see its consequences and butterfly effects.</p>
                </div>
            `;
        }
    }

    updateSidebar() {
        if (!this.choiceTrackingSystem) return;
        
        // Update personality impact bars
        const personalityElement = document.getElementById('personality-impact');
        const profile = this.choiceTrackingSystem.getPersonalityProfile();
        
        let personalityHTML = '<h4>Personality Impact</h4><div class="trait-bars">';
        
        for (const [trait, percentage] of Object.entries(profile.traits)) {
            personalityHTML += `
                <div class="trait-bar">
                    <span>${trait}</span>
                    <div class="trait-bar-fill">
                        <div class="trait-bar-progress" style="width: ${percentage}%"></div>
                    </div>
                    <span>${percentage.toFixed(0)}%</span>
                </div>
            `;
        }
        
        personalityHTML += '</div>';
        personalityElement.innerHTML = personalityHTML;
    }

    // ===== CONTROL METHODS =====

    refreshTree() {
        if (this.choiceTrackingSystem) {
            this.treeData = this.choiceTrackingSystem.generateDecisionTree();
            this.calculateLayout();
            this.redraw();
            this.updateSidebar();
        }
    }

    exportTree() {
        if (!this.treeData) return;
        
        const exportData = {
            tree: this.treeData,
            analysis: this.choiceTrackingSystem?.getChoiceAnalysis(),
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], 
                             { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `decision-tree-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📊 Decision tree exported');
    }

    fitToView() {
        if (!this.nodePositions.size) return;
        
        // Calculate bounding box of all nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        for (const pos of this.nodePositions.values()) {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x);
            maxY = Math.max(maxY, pos.y);
        }
        
        // Add padding
        const padding = 100;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // Calculate zoom and offset to fit
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        const scaleX = canvasWidth / contentWidth;
        const scaleY = canvasHeight / contentHeight;
        this.zoomLevel = Math.min(scaleX, scaleY, 1.0);
        
        // Center the content
        this.viewportOffset.x = (canvasWidth - contentWidth * this.zoomLevel) / 2 - minX * this.zoomLevel;
        this.viewportOffset.y = (canvasHeight - contentHeight * this.zoomLevel) / 2 - minY * this.zoomLevel;
        
        this.redraw();
    }

    setActiveView(button, viewMode) {
        // Update button states
        document.querySelectorAll('.view-group .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        // Recalculate layout and redraw
        this.calculateLayout();
        this.redraw();
    }

    getActiveViewMode() {
        const activeButton = document.querySelector('.view-group .btn.active');
        if (activeButton.id === 'impact-view') return 'impact';
        if (activeButton.id === 'theme-view') return 'theme';
        return 'chronological';
    }

    applyFilter(filterValue) {
        if (!this.treeData) return;
        
        // Filter nodes based on selection
        let filteredNodes = this.treeData.nodes;
        
        switch (filterValue) {
            case 'moral':
                filteredNodes = this.treeData.nodes.filter(n => n.categories.includes('moral'));
                break;
            case 'social':
                filteredNodes = this.treeData.nodes.filter(n => n.categories.includes('social'));
                break;
            case 'tactical':
                filteredNodes = this.treeData.nodes.filter(n => n.categories.includes('tactical'));
                break;
            case 'high_impact':
                filteredNodes = this.treeData.nodes.filter(n => n.narrativeImpact >= 5);
                break;
        }
        
        // Update tree data temporarily
        const originalNodes = this.treeData.nodes;
        this.treeData.nodes = filteredNodes;
        
        this.calculateLayout();
        this.redraw();
        
        // Restore original nodes for other operations
        this.treeData.nodes = originalNodes;
    }

    // ===== PUBLIC API =====

    /**
     * Show visualizer (called externally)
     */
    async show() {
        await this.showVisualizer();
    }

    /**
     * Hide visualizer (called externally)
     */
    hide() {
        this.hideVisualizer();
    }

    /**
     * Refresh with new data (called externally)
     */
    refresh() {
        this.refreshTree();
    }
}