export default class InventorySystem {
    constructor(core) {
        this.core = core;
        this.itemDatabase = this.initializeItemDatabase();
        this.partyTreasury = {
            cp: 0, sp: 0, ep: 0, gp: 0, pp: 0,
            sharedItems: []
        };
        this.draggedItem = null;
        this.touchStartPos = null;
        this.touchMoved = false;
        this.init();
    }

    init() {
        this.core.on('inventory:shareItem', (event) => this.shareItem(event.detail));
        this.core.on('inventory:updateWeight', (event) => this.calculateEncumbrance(event.detail.characterId));
        this.core.on('inventory:consumeItem', (event) => this.consumeItem(event.detail));
        this.core.on('ui:screenShown', (event) => this.handleScreenChange(event.detail.screen));
        
        console.log('🎒 Enhanced Inventory System initialized');
    }

    initializeItemDatabase() {
        return {
            // Weapons
            'longsword': {
                id: 'longsword',
                name: 'Longsword',
                category: 'weapons',
                type: 'weapon',
                weight: 3,
                value: { gp: 15 },
                damage: '1d8',
                damageType: 'slashing',
                properties: ['versatile'],
                rarity: 'common',
                description: 'A versatile martial weapon favored by many warriors.'
            },
            'shortbow': {
                id: 'shortbow',
                name: 'Shortbow',
                category: 'weapons',
                type: 'weapon',
                weight: 2,
                value: { gp: 25 },
                damage: '1d6',
                damageType: 'piercing',
                properties: ['ammunition', 'range', 'two-handed'],
                range: '80/320',
                rarity: 'common',
                description: 'A simple ranged weapon requiring arrows.'
            },
            
            // Armor
            'chain_mail': {
                id: 'chain_mail',
                name: 'Chain Mail',
                category: 'armor',
                type: 'armor',
                weight: 55,
                value: { gp: 75 },
                armorClass: 16,
                armorType: 'heavy',
                stealthDisadvantage: true,
                rarity: 'common',
                description: 'Heavy armor made of interlocking metal rings.'
            },
            'leather_armor': {
                id: 'leather_armor',
                name: 'Leather Armor',
                category: 'armor',
                type: 'armor',
                weight: 10,
                value: { gp: 10 },
                armorClass: '11 + Dex',
                armorType: 'light',
                rarity: 'common',
                description: 'Light, flexible protection made from boiled leather.'
            },
            
            // Consumables
            'health_potion': {
                id: 'health_potion',
                name: 'Potion of Healing',
                category: 'consumables',
                type: 'consumable',
                weight: 0.5,
                value: { gp: 50 },
                uses: 1,
                maxUses: 1,
                effect: 'Heal 2d4+2 hit points',
                rarity: 'common',
                description: 'A magical red liquid that heals wounds when consumed.'
            },
            'rations': {
                id: 'rations',
                name: 'Rations (1 day)',
                category: 'consumables',
                type: 'consumable',
                weight: 2,
                value: { sp: 2 },
                uses: 1,
                maxUses: 1,
                effect: 'Sustains one person for one day',
                stackable: true,
                rarity: 'common',
                description: 'Dried food suitable for extended travel.'
            },
            'torch': {
                id: 'torch',
                name: 'Torch',
                category: 'consumables',
                type: 'consumable',
                weight: 1,
                value: { cp: 2 },
                uses: 60, // minutes of light
                maxUses: 60,
                effect: 'Provides bright light in 20ft radius, dim light for 20ft more',
                stackable: true,
                rarity: 'common',
                description: 'A wooden stick with cloth wrapped around one end, dipped in oil.'
            },
            'arrows': {
                id: 'arrows',
                name: 'Arrows (20)',
                category: 'consumables',
                type: 'ammunition',
                weight: 1,
                value: { gp: 1 },
                uses: 20,
                maxUses: 20,
                stackable: true,
                rarity: 'common',
                description: 'A quiver of arrows for use with bows.'
            },
            
            // Tools
            'thieves_tools': {
                id: 'thieves_tools',
                name: "Thieves' Tools",
                category: 'tools',
                type: 'tool',
                weight: 1,
                value: { gp: 25 },
                proficiencyRequired: 'thieves_tools',
                rarity: 'common',
                description: 'Small tools for picking locks and disarming traps.',
                environmentalUses: ['lockpicking', 'trap_disarmament']
            },
            'rope_hemp': {
                id: 'rope_hemp',
                name: 'Rope, Hemp (50 feet)',
                category: 'tools',
                type: 'tool',
                weight: 10,
                value: { gp: 2 },
                rarity: 'common',
                description: 'Strong rope suitable for climbing and securing objects.',
                environmentalUses: ['climbing', 'binding', 'rappelling']
            },
            'grappling_hook': {
                id: 'grappling_hook',
                name: 'Grappling Hook',
                category: 'tools',
                type: 'tool',
                weight: 4,
                value: { gp: 2 },
                rarity: 'common',
                description: 'A multi-pronged hook for climbing and retrieval.',
                environmentalUses: ['climbing', 'retrieval']
            },
            
            // Treasure
            'gem_ruby': {
                id: 'gem_ruby',
                name: 'Ruby',
                category: 'treasure',
                type: 'gem',
                weight: 0,
                value: { gp: 500 },
                rarity: 'rare',
                description: 'A precious red gemstone that glimmers in the light.'
            },
            'art_silver_chalice': {
                id: 'art_silver_chalice',
                name: 'Silver Chalice',
                category: 'treasure',
                type: 'art',
                weight: 2,
                value: { gp: 100 },
                rarity: 'uncommon',
                description: 'An ornate silver drinking cup with religious engravings.'
            },
            
            // Faction Items
            'harpers_pin': {
                id: 'harpers_pin',
                name: "Harper's Pin",
                category: 'treasure',
                type: 'faction_item',
                weight: 0,
                value: { gp: 5 },
                faction: 'harpers',
                rarity: 'uncommon',
                description: 'A small silver pin bearing the Harper insignia.',
                storyUnlocks: ['harper_safe_house', 'harper_contacts', 'harper_lore']
            },
            'lords_seal': {
                id: 'lords_seal',
                name: "Lord's Alliance Seal",
                category: 'treasure',
                type: 'faction_item',
                weight: 0.5,
                value: { gp: 50 },
                faction: 'lords_alliance',
                rarity: 'rare',
                description: 'Official seal granting authority in Alliance territories.',
                storyUnlocks: ['alliance_resources', 'noble_audiences', 'official_documents']
            }
        };
    }

    enhanceInventoryTab() {
        // Find the inventory tab panel
        const inventoryTab = document.getElementById('inventory-tab');
        if (!inventoryTab) return;

        // Replace the existing inventory content
        inventoryTab.innerHTML = this.generateEnhancedInventoryHTML();
        
        // Setup drag and drop functionality
        this.setupDragAndDrop();
        
        // Setup mobile touch handlers
        this.setupMobileHandlers();
        
        // Setup party treasury
        this.setupPartyTreasury();
    }

    generateEnhancedInventoryHTML() {
        return `
            <div class="enhanced-inventory">
                <!-- Inventory Header with Weight Tracking -->
                <div class="inventory-header">
                    <div class="character-encumbrance">
                        <h3>Carrying Capacity</h3>
                        <div class="weight-bar">
                            <div class="weight-progress" id="weight-progress"></div>
                        </div>
                        <div class="weight-info">
                            <span id="current-weight">0</span> / <span id="max-weight">150</span> lbs
                            <span id="encumbrance-status" class="encumbrance-normal">Normal</span>
                        </div>
                    </div>
                    
                    <div class="inventory-actions">
                        <button id="sort-inventory-btn" class="secondary-button">
                            <span class="button-icon">📊</span>
                            Sort
                        </button>
                        <button id="add-item-btn" class="secondary-button">
                            <span class="button-icon">➕</span>
                            Add Item
                        </button>
                        <button id="party-treasury-btn" class="secondary-button">
                            <span class="button-icon">🏛️</span>
                            Party Treasury
                        </button>
                    </div>
                </div>

                <!-- Inventory Categories -->
                <div class="inventory-categories">
                    <div class="inventory-category" data-category="weapons">
                        <div class="category-header">
                            <h4>⚔️ Weapons</h4>
                            <span class="category-count" id="weapons-count">0</span>
                        </div>
                        <div class="category-items" id="weapons-container" data-category="weapons">
                            <div class="drop-zone">Drop weapons here</div>
                        </div>
                    </div>

                    <div class="inventory-category" data-category="armor">
                        <div class="category-header">
                            <h4>🛡️ Armor</h4>
                            <span class="category-count" id="armor-count">0</span>
                        </div>
                        <div class="category-items" id="armor-container" data-category="armor">
                            <div class="drop-zone">Drop armor here</div>
                        </div>
                    </div>

                    <div class="inventory-category" data-category="consumables">
                        <div class="category-header">
                            <h4>🧪 Consumables</h4>
                            <span class="category-count" id="consumables-count">0</span>
                        </div>
                        <div class="category-items" id="consumables-container" data-category="consumables">
                            <div class="drop-zone">Drop consumables here</div>
                        </div>
                    </div>

                    <div class="inventory-category" data-category="tools">
                        <div class="category-header">
                            <h4>🔧 Tools & Equipment</h4>
                            <span class="category-count" id="tools-count">0</span>
                        </div>
                        <div class="category-items" id="tools-container" data-category="tools">
                            <div class="drop-zone">Drop tools here</div>
                        </div>
                    </div>

                    <div class="inventory-category" data-category="treasure">
                        <div class="category-header">
                            <h4>💎 Treasure & Valuables</h4>
                            <span class="category-count" id="treasure-count">0</span>
                        </div>
                        <div class="category-items" id="treasure-container" data-category="treasure">
                            <div class="drop-zone">Drop treasure here</div>
                        </div>
                    </div>
                </div>

                <!-- Currency Section -->
                <div class="currency-section">
                    <h3>Currency</h3>
                    <div class="currency-grid">
                        <div class="coin">
                            <span class="coin-type">CP</span>
                            <input type="number" id="cp-amount" min="0" value="0">
                        </div>
                        <div class="coin">
                            <span class="coin-type">SP</span>
                            <input type="number" id="sp-amount" min="0" value="0">
                        </div>
                        <div class="coin">
                            <span class="coin-type">EP</span>
                            <input type="number" id="ep-amount" min="0" value="0">
                        </div>
                        <div class="coin">
                            <span class="coin-type">GP</span>
                            <input type="number" id="gp-amount" min="0" value="0">
                        </div>
                        <div class="coin">
                            <span class="coin-type">PP</span>
                            <input type="number" id="pp-amount" min="0" value="0">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Item Details Modal -->
            <div id="item-details-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="item-modal-name">Item Name</h3>
                        <button class="modal-close" onclick="this.closest('.modal').style.display='none'">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="item-details">
                            <div class="item-info-grid">
                                <div class="item-info-row">
                                    <label>Category:</label>
                                    <span id="item-modal-category"></span>
                                </div>
                                <div class="item-info-row">
                                    <label>Weight:</label>
                                    <span id="item-modal-weight"></span>
                                </div>
                                <div class="item-info-row">
                                    <label>Value:</label>
                                    <span id="item-modal-value"></span>
                                </div>
                                <div class="item-info-row">
                                    <label>Rarity:</label>
                                    <span id="item-modal-rarity"></span>
                                </div>
                            </div>
                            <div class="item-description">
                                <h4>Description</h4>
                                <p id="item-modal-description"></p>
                            </div>
                            <div class="item-properties" id="item-modal-properties" style="display: none;">
                                <h4>Properties</h4>
                                <div id="item-modal-properties-list"></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="consume-item-btn" class="primary-button" style="display: none;">Use/Consume</button>
                        <button id="share-item-btn" class="secondary-button">Share with Party</button>
                        <button class="tertiary-button" onclick="this.closest('.modal').style.display='none'">Close</button>
                    </div>
                </div>
            </div>

            <!-- Add Item Modal -->
            <div id="add-item-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Add Item to Inventory</h3>
                        <button class="modal-close" onclick="this.closest('.modal').style.display='none'">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="item-search">
                            <input type="text" id="item-search-input" placeholder="Search items...">
                            <div class="item-search-results" id="item-search-results"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Party Treasury Modal -->
            <div id="party-treasury-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Party Treasury</h3>
                        <button class="modal-close" onclick="this.closest('.modal').style.display='none'">✕</button>
                    </div>
                    <div class="modal-body">
                        <div class="treasury-content">
                            <div class="shared-currency">
                                <h4>Shared Currency</h4>
                                <div class="currency-grid">
                                    <div class="coin">
                                        <span class="coin-type">CP</span>
                                        <input type="number" id="treasury-cp" min="0" value="0">
                                    </div>
                                    <div class="coin">
                                        <span class="coin-type">SP</span>
                                        <input type="number" id="treasury-sp" min="0" value="0">
                                    </div>
                                    <div class="coin">
                                        <span class="coin-type">EP</span>
                                        <input type="number" id="treasury-ep" min="0" value="0">
                                    </div>
                                    <div class="coin">
                                        <span class="coin-type">GP</span>
                                        <input type="number" id="treasury-gp" min="0" value="0">
                                    </div>
                                    <div class="coin">
                                        <span class="coin-type">PP</span>
                                        <input type="number" id="treasury-pp" min="0" value="0">
                                    </div>
                                </div>
                            </div>
                            <div class="shared-items">
                                <h4>Shared Items</h4>
                                <div id="shared-items-list" class="shared-items-list">
                                    <!-- Populated by JavaScript -->
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="save-treasury-btn" class="primary-button">Save Changes</button>
                        <button class="secondary-button" onclick="this.closest('.modal').style.display='none'">Close</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderInventoryItem(item, quantity = 1) {
        const rarityColors = {
            'common': '#9CA3AF',
            'uncommon': '#10B981',
            'rare': '#3B82F6',
            'very_rare': '#8B5CF6',
            'legendary': '#F59E0B',
            'artifact': '#EF4444'
        };

        const rarityColor = rarityColors[item.rarity] || rarityColors.common;
        const totalWeight = (item.weight || 0) * quantity;
        
        return `
            <div class="inventory-item" 
                 draggable="true" 
                 data-item-id="${item.id}"
                 data-category="${item.category}"
                 style="border-left: 4px solid ${rarityColor}">
                <div class="item-content">
                    <div class="item-header">
                        <span class="item-name">${item.name}</span>
                        ${quantity > 1 ? `<span class="item-quantity">×${quantity}</span>` : ''}
                    </div>
                    <div class="item-details">
                        <span class="item-weight">${totalWeight}lb</span>
                        ${item.value ? `<span class="item-value">${this.formatCurrency(item.value)}</span>` : ''}
                    </div>
                    ${item.uses !== undefined ? `
                        <div class="item-uses">
                            <div class="uses-bar">
                                <div class="uses-progress" style="width: ${(item.uses / item.maxUses) * 100}%"></div>
                            </div>
                            <span class="uses-text">${item.uses}/${item.maxUses}</span>
                        </div>
                    ` : ''}
                    ${item.storyUnlocks ? `<span class="story-item">📜</span>` : ''}
                </div>
                <div class="item-actions">
                    <button class="item-action-btn" onclick="DNDCore.getModule('inventorySystem').showItemDetails('${item.id}')">
                        📋
                    </button>
                    ${item.category === 'consumables' ? `
                        <button class="item-action-btn consume-btn" onclick="DNDCore.getModule('inventorySystem').quickConsume('${item.id}')">
                            🍽️
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    formatCurrency(value) {
        const parts = [];
        if (value.pp) parts.push(`${value.pp}pp`);
        if (value.gp) parts.push(`${value.gp}gp`);
        if (value.ep) parts.push(`${value.ep}ep`);
        if (value.sp) parts.push(`${value.sp}sp`);
        if (value.cp) parts.push(`${value.cp}cp`);
        return parts.join(', ') || '0cp';
    }

    setupDragAndDrop() {
        const containers = document.querySelectorAll('.category-items');
        const items = document.querySelectorAll('.inventory-item');

        // Setup drag events for items
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedItem = {
                    id: item.dataset.itemId,
                    category: item.dataset.category,
                    element: item
                };
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.draggedItem = null;
            });
        });

        // Setup drop events for containers
        containers.forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                container.classList.add('drag-over');
            });

            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over');
                
                if (this.draggedItem) {
                    const targetCategory = container.dataset.category;
                    this.moveItemToCategory(this.draggedItem.id, targetCategory);
                }
            });
        });
    }

    setupMobileHandlers() {
        const items = document.querySelectorAll('.inventory-item');

        items.forEach(item => {
            // Touch start
            item.addEventListener('touchstart', (e) => {
                this.touchStartPos = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
                this.touchMoved = false;
                
                // Visual feedback for touch
                item.classList.add('touch-active');
            }, { passive: true });

            // Touch move
            item.addEventListener('touchmove', (e) => {
                if (!this.touchStartPos) return;
                
                const currentPos = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
                
                const distance = Math.sqrt(
                    Math.pow(currentPos.x - this.touchStartPos.x, 2) +
                    Math.pow(currentPos.y - this.touchStartPos.y, 2)
                );
                
                if (distance > 10) {
                    this.touchMoved = true;
                    item.classList.add('dragging-mobile');
                }
            }, { passive: true });

            // Touch end
            item.addEventListener('touchend', (e) => {
                item.classList.remove('touch-active', 'dragging-mobile');
                
                if (!this.touchMoved && this.touchStartPos) {
                    // Show item actions menu for tap
                    this.showMobileItemMenu(item);
                }
                
                this.touchStartPos = null;
                this.touchMoved = false;
            });
        });
    }

    showMobileItemMenu(itemElement) {
        // Remove existing mobile menus
        document.querySelectorAll('.mobile-item-menu').forEach(menu => menu.remove());
        
        const itemId = itemElement.dataset.itemId;
        const item = this.itemDatabase[itemId];
        
        const menu = document.createElement('div');
        menu.className = 'mobile-item-menu';
        menu.innerHTML = `
            <div class="mobile-menu-content">
                <h4>${item.name}</h4>
                <div class="mobile-menu-actions">
                    <button onclick="DNDCore.getModule('inventorySystem').showItemDetails('${itemId}')">
                        Details
                    </button>
                    ${item.category === 'consumables' ? `
                        <button onclick="DNDCore.getModule('inventorySystem').quickConsume('${itemId}')">
                            Use
                        </button>
                    ` : ''}
                    <button onclick="DNDCore.getModule('inventorySystem').showMoveOptions('${itemId}')">
                        Move
                    </button>
                    <button onclick="this.closest('.mobile-item-menu').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Position menu
        const rect = itemElement.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 10}px`;
        menu.style.left = `${Math.max(10, rect.left)}px`;
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            if (menu.parentNode) menu.remove();
        }, 10000);
    }

    calculateEncumbrance(characterId) {
        const characterSheet = this.core.getModule('characterSheet');
        const character = characterSheet?.party.find(char => char.id === characterId);
        
        if (!character) return;

        // Calculate total weight
        let totalWeight = 0;
        
        // Add equipment weight
        if (character.equipment) {
            Object.values(character.equipment).forEach(category => {
                if (Array.isArray(category)) {
                    category.forEach(item => {
                        const itemData = this.itemDatabase[item.id] || item;
                        totalWeight += (itemData.weight || 0) * (item.quantity || 1);
                    });
                }
            });
        }

        // Calculate carrying capacity (STR * 15)
        const strength = character.abilityScores?.strength || 10;
        const maxWeight = strength * 15;
        
        // Calculate encumbrance levels
        let encumbranceStatus = 'normal';
        let speedReduction = 0;
        
        if (totalWeight > maxWeight) {
            encumbranceStatus = 'over-encumbered';
            speedReduction = character.speed; // Can't move
        } else if (totalWeight > maxWeight * 0.75) {
            encumbranceStatus = 'heavily-encumbered';
            speedReduction = 20;
        } else if (totalWeight > maxWeight * 0.5) {
            encumbranceStatus = 'encumbered';
            speedReduction = 10;
        }

        // Update UI if character sheet is active
        this.updateEncumbranceUI(totalWeight, maxWeight, encumbranceStatus);
        
        return {
            totalWeight,
            maxWeight,
            encumbranceStatus,
            speedReduction
        };
    }

    updateEncumbranceUI(currentWeight, maxWeight, status) {
        const currentWeightElement = document.getElementById('current-weight');
        const maxWeightElement = document.getElementById('max-weight');
        const progressElement = document.getElementById('weight-progress');
        const statusElement = document.getElementById('encumbrance-status');
        
        if (currentWeightElement) currentWeightElement.textContent = Math.round(currentWeight);
        if (maxWeightElement) maxWeightElement.textContent = maxWeight;
        if (statusElement) {
            statusElement.textContent = status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
            statusElement.className = `encumbrance-${status}`;
        }
        
        if (progressElement) {
            const percentage = Math.min((currentWeight / maxWeight) * 100, 100);
            progressElement.style.width = `${percentage}%`;
            
            // Color coding
            if (percentage > 100) {
                progressElement.style.backgroundColor = '#EF4444'; // Red
            } else if (percentage > 75) {
                progressElement.style.backgroundColor = '#F59E0B'; // Yellow
            } else if (percentage > 50) {
                progressElement.style.backgroundColor = '#10B981'; // Green
            } else {
                progressElement.style.backgroundColor = '#3B82F6'; // Blue
            }
        }
    }

    handleScreenChange(screenName) {
        if (screenName === 'characterSheet') {
            // Enhance the inventory tab when character sheet is shown
            setTimeout(() => {
                this.enhanceInventoryTab();
                this.loadCharacterInventory();
            }, 100);
        }
    }

    loadCharacterInventory() {
        const characterSheet = this.core.getModule('characterSheet');
        const character = characterSheet?.currentCharacter;
        
        if (!character) return;

        // Clear existing items
        document.querySelectorAll('.category-items').forEach(container => {
            container.innerHTML = '<div class="drop-zone">Drop items here</div>';
        });

        // Load items from character
        if (character.equipment) {
            Object.entries(character.equipment).forEach(([category, items]) => {
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        this.addItemToInventory(item.id || item.name, item.quantity || 1);
                    });
                }
            });
        }

        // Update currency
        if (character.equipment?.currency) {
            Object.entries(character.equipment.currency).forEach(([type, amount]) => {
                const input = document.getElementById(`${type}-amount`);
                if (input) input.value = amount;
            });
        }

        // Calculate encumbrance
        this.calculateEncumbrance(character.id);
    }

    addItemToInventory(itemId, quantity = 1) {
        const item = this.itemDatabase[itemId];
        if (!item) return;

        const container = document.getElementById(`${item.category}-container`);
        const dropZone = container?.querySelector('.drop-zone');
        
        if (container) {
            // Remove drop zone if this is the first item
            if (dropZone && container.children.length === 1) {
                dropZone.remove();
            }
            
            container.insertAdjacentHTML('beforeend', this.renderInventoryItem(item, quantity));
            this.updateCategoryCount(item.category);
            
            // Re-setup drag and drop for new item
            const newItem = container.lastElementChild;
            this.setupItemDragAndDrop(newItem);
        }
    }

    setupItemDragAndDrop(itemElement) {
        itemElement.addEventListener('dragstart', (e) => {
            this.draggedItem = {
                id: itemElement.dataset.itemId,
                category: itemElement.dataset.category,
                element: itemElement
            };
            itemElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        itemElement.addEventListener('dragend', () => {
            itemElement.classList.remove('dragging');
            this.draggedItem = null;
        });

        // Setup mobile handlers for new item
        this.setupMobileHandlersForItem(itemElement);
    }

    setupMobileHandlersForItem(itemElement) {
        itemElement.addEventListener('touchstart', (e) => {
            this.touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            this.touchMoved = false;
            itemElement.classList.add('touch-active');
        }, { passive: true });

        itemElement.addEventListener('touchend', (e) => {
            itemElement.classList.remove('touch-active');
            
            if (!this.touchMoved && this.touchStartPos) {
                this.showMobileItemMenu(itemElement);
            }
            
            this.touchStartPos = null;
            this.touchMoved = false;
        });
    }

    updateCategoryCount(category) {
        const countElement = document.getElementById(`${category}-count`);
        const container = document.getElementById(`${category}-container`);
        
        if (countElement && container) {
            const itemCount = container.querySelectorAll('.inventory-item').length;
            countElement.textContent = itemCount;
        }
    }

    showItemDetails(itemId) {
        const item = this.itemDatabase[itemId];
        if (!item) return;

        // Populate modal
        document.getElementById('item-modal-name').textContent = item.name;
        document.getElementById('item-modal-category').textContent = item.category;
        document.getElementById('item-modal-weight').textContent = `${item.weight || 0} lb`;
        document.getElementById('item-modal-value').textContent = this.formatCurrency(item.value || {});
        document.getElementById('item-modal-rarity').textContent = item.rarity || 'common';
        document.getElementById('item-modal-description').textContent = item.description || '';

        // Show/hide consumable button
        const consumeBtn = document.getElementById('consume-item-btn');
        if (item.category === 'consumables' && consumeBtn) {
            consumeBtn.style.display = 'block';
            consumeBtn.onclick = () => {
                this.consumeItem({ itemId, characterId: this.core.getModule('characterSheet')?.currentCharacter?.id });
                document.getElementById('item-details-modal').style.display = 'none';
            };
        } else if (consumeBtn) {
            consumeBtn.style.display = 'none';
        }

        // Setup share button
        const shareBtn = document.getElementById('share-item-btn');
        if (shareBtn) {
            shareBtn.onclick = () => {
                this.shareWithParty(itemId);
                document.getElementById('item-details-modal').style.display = 'none';
            };
        }

        // Show modal
        document.getElementById('item-details-modal').style.display = 'flex';
    }

    quickConsume(itemId) {
        const characterSheet = this.core.getModule('characterSheet');
        const character = characterSheet?.currentCharacter;
        
        if (!character) return;
        
        this.consumeItem({ itemId, characterId: character.id });
    }

    consumeItem({ itemId, characterId }) {
        const item = this.itemDatabase[itemId];
        const characterSheet = this.core.getModule('characterSheet');
        const character = characterSheet?.party.find(char => char.id === characterId);
        
        if (!item || !character) return;

        // Apply item effect
        this.applyItemEffect(item, character);
        
        // Reduce uses or remove item
        if (item.uses !== undefined) {
            item.uses = Math.max(0, item.uses - 1);
            
            if (item.uses === 0 && !item.stackable) {
                // Remove item from inventory
                this.removeItemFromInventory(itemId);
            }
        }

        // Show effect notification
        const ui = this.core.getModule('ui');
        ui?.showNotification(`${character.name} used ${item.name}: ${item.effect}`, 'info');
        
        // Refresh inventory display
        this.loadCharacterInventory();
    }

    applyItemEffect(item, character) {
        switch (item.id) {
            case 'health_potion':
                const healing = this.rollDice('2d4+2');
                character.hitPoints.current = Math.min(
                    character.hitPoints.current + healing,
                    character.hitPoints.maximum
                );
                break;
                
            case 'rations':
                // Could track hunger/rest mechanics here
                break;
                
            case 'torch':
                // Could track light sources and duration
                break;
        }
    }

    rollDice(diceString) {
        // Simple dice roller for effects
        const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/);
        if (!match) return 0;
        
        const [, numDice, dieSize, modifier] = match;
        let total = parseInt(modifier) || 0;
        
        for (let i = 0; i < parseInt(numDice); i++) {
            total += Math.floor(Math.random() * parseInt(dieSize)) + 1;
        }
        
        return total;
    }

    shareWithParty(itemId) {
        const characterSheet = this.core.getModule('characterSheet');
        const currentCharacter = characterSheet?.currentCharacter;
        const party = characterSheet?.party || [];
        
        if (!currentCharacter || party.length <= 1) {
            const ui = this.core.getModule('ui');
            ui?.showNotification('No party members to share with', 'info');
            return;
        }

        // Create party selection modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Share Item with Party Member</h3>
                    <button class="modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <p>Choose a party member to share ${this.itemDatabase[itemId]?.name} with:</p>
                    <div class="party-selection">
                        ${party.filter(char => char.id !== currentCharacter.id).map(char => `
                            <button class="party-member-btn" data-character-id="${char.id}">
                                <strong>${char.name}</strong>
                                <span>${char.class} ${char.level}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="secondary-button modal-close">Cancel</button>
                </div>
            </div>
        `;

        // Setup event handlers
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        modal.querySelectorAll('.party-member-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetCharacterId = btn.dataset.characterId;
                this.transferItem(itemId, currentCharacter.id, targetCharacterId);
                modal.remove();
            });
        });

        document.body.appendChild(modal);
    }

    transferItem(itemId, fromCharacterId, toCharacterId) {
        const characterSheet = this.core.getModule('characterSheet');
        const fromCharacter = characterSheet?.party.find(char => char.id === fromCharacterId);
        const toCharacter = characterSheet?.party.find(char => char.id === toCharacterId);
        
        if (!fromCharacter || !toCharacter) return;

        // Find and remove item from source character
        let itemRemoved = false;
        Object.keys(fromCharacter.equipment || {}).forEach(category => {
            if (Array.isArray(fromCharacter.equipment[category])) {
                const itemIndex = fromCharacter.equipment[category].findIndex(item => 
                    (item.id || item.name) === itemId
                );
                
                if (itemIndex !== -1) {
                    const item = fromCharacter.equipment[category][itemIndex];
                    
                    // Remove from source
                    fromCharacter.equipment[category].splice(itemIndex, 1);
                    
                    // Add to target
                    const itemData = this.itemDatabase[itemId];
                    if (itemData) {
                        const targetCategory = itemData.category + 's'; // weapons, armor, etc.
                        if (!toCharacter.equipment) toCharacter.equipment = {};
                        if (!toCharacter.equipment[targetCategory]) toCharacter.equipment[targetCategory] = [];
                        
                        toCharacter.equipment[targetCategory].push(item);
                        itemRemoved = true;
                    }
                }
            }
        });

        if (itemRemoved) {
            const ui = this.core.getModule('ui');
            ui?.showNotification(`${this.itemDatabase[itemId]?.name} shared with ${toCharacter.name}`, 'success');
            
            // Refresh inventory if current character is involved
            if (characterSheet.currentCharacter?.id === fromCharacterId) {
                this.loadCharacterInventory();
            }
            
            // Save changes
            characterSheet.saveCurrentCharacter();
        }
    }

    moveItemToCategory(itemId, targetCategory) {
        const item = this.itemDatabase[itemId];
        if (!item) return;

        // Don't move if already in correct category
        if (item.category === targetCategory) return;

        // Update item category (this is mainly for UI feedback)
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemElement) {
            const currentContainer = itemElement.parentElement;
            const targetContainer = document.getElementById(`${targetCategory}-container`);
            
            if (targetContainer && currentContainer !== targetContainer) {
                // Remove drop zone if target container is empty
                const dropZone = targetContainer.querySelector('.drop-zone');
                if (dropZone && targetContainer.children.length === 1) {
                    dropZone.remove();
                }
                
                // Move the element
                targetContainer.appendChild(itemElement);
                itemElement.dataset.category = targetCategory;
                
                // Update category counts
                this.updateCategoryCount(item.category);
                this.updateCategoryCount(targetCategory);
                
                // Add drop zone back to source if empty
                if (currentContainer.children.length === 0) {
                    currentContainer.innerHTML = '<div class="drop-zone">Drop items here</div>';
                }

                const ui = this.core.getModule('ui');
                ui?.showNotification(`${item.name} moved to ${targetCategory}`, 'info');
            }
        }
    }

    showMoveOptions(itemId) {
        const item = this.itemDatabase[itemId];
        if (!item) return;

        const categories = ['weapons', 'armor', 'consumables', 'tools', 'treasure'];
        const otherCategories = categories.filter(cat => cat !== item.category);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Move ${item.name}</h3>
                    <button class="modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <p>Move this item to a different category:</p>
                    <div class="category-selection">
                        ${otherCategories.map(category => `
                            <button class="category-move-btn" data-category="${category}">
                                ${category.charAt(0).toUpperCase() + category.slice(1)}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="secondary-button modal-close">Cancel</button>
                </div>
            </div>
        `;

        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        modal.querySelectorAll('.category-move-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.moveItemToCategory(itemId, btn.dataset.category);
                modal.remove();
            });
        });

        document.body.appendChild(modal);
    }

    removeItemFromInventory(itemId) {
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemElement) {
            const container = itemElement.parentElement;
            const category = itemElement.dataset.category;
            
            itemElement.remove();
            
            // Add drop zone back if container is empty
            if (container.children.length === 0) {
                container.innerHTML = '<div class="drop-zone">Drop items here</div>';
            }
            
            this.updateCategoryCount(category);
        }
    }

    setupPartyTreasury() {
        const partyTreasuryBtn = document.getElementById('party-treasury-btn');
        const addItemBtn = document.getElementById('add-item-btn');
        const sortBtn = document.getElementById('sort-inventory-btn');

        if (partyTreasuryBtn) {
            partyTreasuryBtn.addEventListener('click', () => {
                document.getElementById('party-treasury-modal').style.display = 'flex';
                this.loadPartyTreasury();
            });
        }

        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => {
                document.getElementById('add-item-modal').style.display = 'flex';
                this.setupItemSearch();
            });
        }

        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                this.sortInventory();
            });
        }
    }

    setupItemSearch() {
        const searchInput = document.getElementById('item-search-input');
        const resultsContainer = document.getElementById('item-search-results');

        if (!searchInput || !resultsContainer) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            
            if (query.length < 2) {
                resultsContainer.innerHTML = '';
                return;
            }

            const matches = Object.values(this.itemDatabase).filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query)
            );

            resultsContainer.innerHTML = matches.slice(0, 10).map(item => `
                <div class="search-result-item" data-item-id="${item.id}">
                    <div class="result-name">${item.name}</div>
                    <div class="result-category">${item.category}</div>
                    <div class="result-description">${item.description.substring(0, 60)}...</div>
                </div>
            `).join('');

            // Setup click handlers for results
            resultsContainer.querySelectorAll('.search-result-item').forEach(resultItem => {
                resultItem.addEventListener('click', () => {
                    this.addItemToInventory(resultItem.dataset.itemId, 1);
                    document.getElementById('add-item-modal').style.display = 'none';
                    searchInput.value = '';
                    resultsContainer.innerHTML = '';
                });
            });
        });
    }

    loadPartyTreasury() {
        // Load treasury data from storage or campaign
        const treasuryData = JSON.parse(localStorage.getItem('dnd_voice_party_treasury') || '{}');
        
        // Update currency inputs
        Object.keys(this.partyTreasury).forEach(coinType => {
            const input = document.getElementById(`treasury-${coinType}`);
            if (input) {
                input.value = treasuryData[coinType] || 0;
            }
        });

        // Load shared items
        const sharedItemsList = document.getElementById('shared-items-list');
        if (sharedItemsList) {
            if (treasuryData.sharedItems && treasuryData.sharedItems.length > 0) {
                sharedItemsList.innerHTML = treasuryData.sharedItems.map(item => 
                    this.renderInventoryItem(this.itemDatabase[item.id], item.quantity)
                ).join('');
            } else {
                sharedItemsList.innerHTML = '<p>No shared items</p>';
            }
        }
    }

    sortInventory() {
        const categories = ['weapons', 'armor', 'consumables', 'tools', 'treasure'];
        
        categories.forEach(category => {
            const container = document.getElementById(`${category}-container`);
            if (!container) return;

            const items = Array.from(container.querySelectorAll('.inventory-item'));
            const dropZone = container.querySelector('.drop-zone');
            
            if (dropZone) dropZone.remove();

            // Sort items by name
            items.sort((a, b) => {
                const nameA = a.querySelector('.item-name').textContent;
                const nameB = b.querySelector('.item-name').textContent;
                return nameA.localeCompare(nameB);
            });

            // Clear container and re-add sorted items
            container.innerHTML = '';
            items.forEach(item => container.appendChild(item));
            
            // Add drop zone if no items
            if (items.length === 0) {
                container.innerHTML = '<div class="drop-zone">Drop items here</div>';
            }
        });

        const ui = this.core.getModule('ui');
        ui?.showNotification('Inventory sorted alphabetically', 'info');
    }

    // Create sample items and characters for testing
    createSampleData() {
        const characterSheet = this.core.getModule('characterSheet');
        
        // Create sample characters with items
        const sampleCharacters = [
            {
                name: 'Aria Nightwhisper',
                class: 'Rogue',
                level: 5,
                race: 'Half-Elf',
                background: 'Criminal',
                abilityScores: { strength: 12, dexterity: 18, constitution: 14, intelligence: 13, wisdom: 14, charisma: 16 },
                equipment: {
                    weapons: [
                        { id: 'shortbow', quantity: 1 },
                        { id: 'longsword', quantity: 1 }
                    ],
                    armor: [
                        { id: 'leather_armor', quantity: 1 }
                    ],
                    consumables: [
                        { id: 'health_potion', quantity: 3 },
                        { id: 'arrows', quantity: 2 },
                        { id: 'rations', quantity: 10 }
                    ],
                    tools: [
                        { id: 'thieves_tools', quantity: 1 },
                        { id: 'rope_hemp', quantity: 1 }
                    ],
                    treasure: [
                        { id: 'harpers_pin', quantity: 1 },
                        { id: 'gem_ruby', quantity: 1 }
                    ],
                    currency: { cp: 50, sp: 30, ep: 0, gp: 125, pp: 2 }
                }
            },
            {
                name: 'Thorek Ironforge',
                class: 'Fighter',
                level: 4,
                race: 'Dwarf',
                background: 'Soldier',
                abilityScores: { strength: 16, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 13, charisma: 8 },
                equipment: {
                    weapons: [
                        { id: 'longsword', quantity: 1 }
                    ],
                    armor: [
                        { id: 'chain_mail', quantity: 1 }
                    ],
                    consumables: [
                        { id: 'health_potion', quantity: 2 },
                        { id: 'rations', quantity: 7 },
                        { id: 'torch', quantity: 5 }
                    ],
                    tools: [
                        { id: 'rope_hemp', quantity: 1 },
                        { id: 'grappling_hook', quantity: 1 }
                    ],
                    treasure: [
                        { id: 'lords_seal', quantity: 1 },
                        { id: 'art_silver_chalice', quantity: 1 }
                    ],
                    currency: { cp: 25, sp: 15, ep: 5, gp: 89, pp: 0 }
                }
            }
        ];

        return sampleCharacters;
    }

    // Test function to load sample data
    loadSampleData() {
        const sampleCharacters = this.createSampleData();
        const characterSheet = this.core.getModule('characterSheet');
        
        // Add characters to party
        sampleCharacters.forEach((charData, index) => {
            const character = characterSheet?.parser.initializeCharacterData();
            Object.assign(character, charData);
            character.id = `sample_${Date.now()}_${index}`;
            character.isMainCharacter = index === 0;
            
            // Calculate derived stats
            characterSheet?.parser.calculateDerivedStats(character);
            
            characterSheet?.addCharacterToParty(character);
        });

        const ui = this.core.getModule('ui');
        ui?.showNotification('Sample characters loaded with inventory!', 'success');
        
        return sampleCharacters;
    }
}