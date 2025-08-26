export default class BattleMapRepository {
    constructor(core) {
        this.core = core;
        this.database = null;
        
        // Battle map templates and saved maps
        this.savedMaps = new Map();
        this.terrainSprites = new Map();
        this.buildingTemplates = new Map();
        
        // Map generation settings
        this.gridSize = 30;
        this.mapWidth = 20;
        this.mapHeight = 20;
        
        this.init();
    }
    
    init() {
        this.core.on('core:initialized', () => {
            this.database = this.core.getModule('database');
            this.loadSavedMaps();
            this.initializeTerrainSprites();
            this.initializeBuildingTemplates();
            
            console.log('🗺️ Battle Map Repository initialized');
        });
        
        // Listen for map save requests
        this.core.on('battleMap:save', (event) => this.saveMap(event.detail));
        this.core.on('battleMap:load', (event) => this.loadMap(event.detail));
        this.core.on('battleMap:generate', (event) => this.generateMap(event.detail));
    }
    
    initializeTerrainSprites() {
        // Terrain definitions with ASCII/Unicode representations and CSS styling
        this.terrainSprites.set('grass', {
            symbol: '🌱',
            cssClass: 'terrain-grass',
            name: 'Grass',
            movement: 1,
            cover: 0,
            style: `
                background: linear-gradient(45deg, #4a7c59 0%, #68a085 50%, #4a7c59 100%);
                position: relative;
            `,
            overlay: '🌿'
        });
        
        this.terrainSprites.set('tree', {
            symbol: '🌳',
            cssClass: 'terrain-tree',
            name: 'Tree',
            movement: 0, // Blocking
            cover: 0.75, // Three-quarters cover
            style: `
                background: radial-gradient(circle at 50% 80%, #2d5016 0%, #4a7c59 30%, #68a085 100%);
                border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
                position: relative;
            `,
            overlay: '🌳',
            tooltip: 'Large Tree - Blocks movement, provides cover'
        });
        
        this.terrainSprites.set('rock', {
            symbol: '🗿',
            cssClass: 'terrain-rock',
            name: 'Boulder',
            movement: 0,
            cover: 0.5,
            style: `
                background: linear-gradient(145deg, #8d8d8d, #5a5a5a);
                border-radius: 30% 70% 70% 30%;
                box-shadow: inset -3px -3px 6px rgba(0,0,0,0.3);
            `,
            overlay: '⛰️',
            tooltip: 'Boulder - Blocks movement, provides half cover'
        });
        
        this.terrainSprites.set('water', {
            symbol: '💧',
            cssClass: 'terrain-water',
            name: 'River',
            movement: 2, // Difficult terrain
            cover: 0,
            style: `
                background: linear-gradient(90deg, #4fc3f7, #29b6f6, #0288d1);
                animation: waterFlow 3s infinite ease-in-out;
                position: relative;
            `,
            overlay: '🌊',
            tooltip: 'River - Difficult terrain (costs 2 movement)'
        });
        
        this.terrainSprites.set('dirt_road', {
            symbol: '🛤️',
            cssClass: 'terrain-road',
            name: 'Dirt Road',
            movement: 0.5, // Fast terrain
            cover: 0,
            style: `
                background: linear-gradient(90deg, #8d6e63, #a1887f, #8d6e63);
                position: relative;
            `,
            overlay: '',
            tooltip: 'Dirt Road - Fast movement'
        });
        
        this.terrainSprites.set('building_wall', {
            symbol: '🧱',
            cssClass: 'terrain-wall',
            name: 'Wall',
            movement: 0,
            cover: 1, // Total cover
            style: `
                background: linear-gradient(145deg, #795548, #5d4037);
                border: 2px solid #3e2723;
                box-shadow: inset 2px 2px 4px rgba(255,255,255,0.1);
            `,
            overlay: '🧱',
            tooltip: 'Wall - Blocks movement and sight'
        });
    }
    
    initializeBuildingTemplates() {
        // Building templates with names and layouts
        this.buildingTemplates.set('tavern', {
            name: 'The Prancing Pony',
            width: 4,
            height: 3,
            layout: [
                ['wall', 'wall', 'door', 'wall'],
                ['wall', 'floor', 'floor', 'wall'],
                ['wall', 'wall', 'wall', 'wall']
            ],
            color: '#8d6e63',
            namePosition: { x: 2, y: 1 }
        });
        
        this.buildingTemplates.set('blacksmith', {
            name: 'Iron & Anvil',
            width: 3,
            height: 3,
            layout: [
                ['wall', 'door', 'wall'],
                ['wall', 'floor', 'wall'],
                ['wall', 'wall', 'wall']
            ],
            color: '#424242',
            namePosition: { x: 1, y: 1 }
        });
        
        this.buildingTemplates.set('shop', {
            name: 'General Store',
            width: 3,
            height: 2,
            layout: [
                ['wall', 'door', 'wall'],
                ['wall', 'wall', 'wall']
            ],
            color: '#6d4c41',
            namePosition: { x: 1, y: 0 }
        });
        
        this.buildingTemplates.set('house', {
            name: 'Cottage',
            width: 2,
            height: 2,
            layout: [
                ['wall', 'wall'],
                ['door', 'wall']
            ],
            color: '#795548',
            namePosition: { x: 1, y: 0 }
        });
        
        this.buildingTemplates.set('guard_tower', {
            name: 'Watch Tower',
            width: 2,
            height: 2,
            layout: [
                ['wall', 'wall'],
                ['wall', 'door']
            ],
            color: '#455a64',
            namePosition: { x: 0, y: -1 }
        });
        
        this.buildingTemplates.set('temple', {
            name: 'Temple of Light',
            width: 5,
            height: 4,
            layout: [
                ['wall', 'wall', 'door', 'wall', 'wall'],
                ['wall', 'floor', 'floor', 'floor', 'wall'],
                ['wall', 'floor', 'altar', 'floor', 'wall'],
                ['wall', 'wall', 'wall', 'wall', 'wall']
            ],
            color: '#90a4ae',
            namePosition: { x: 2, y: 2 }
        });
    }
    
    generateMap(options = {}) {
        const {
            locationType = 'village',
            locationName = 'Unknown Location',
            size = { width: 20, height: 20 },
            theme = 'medieval',
            features = []
        } = options;
        
        const mapData = {
            id: this.generateMapId(locationName),
            name: locationName,
            type: locationType,
            size: size,
            theme: theme,
            createdAt: new Date().toISOString(),
            grid: this.generateEmptyGrid(size.width, size.height),
            buildings: [],
            roads: [],
            terrain: [],
            features: features
        };
        
        // Generate terrain based on location type
        switch (locationType) {
            case 'village':
                this.generateVillageMap(mapData);
                break;
            case 'forest':
                this.generateForestMap(mapData);
                break;
            case 'dungeon':
                this.generateDungeonMap(mapData);
                break;
            case 'wilderness':
                this.generateWildernessMap(mapData);
                break;
            default:
                this.generateGenericMap(mapData);
        }
        
        // Save the generated map
        this.saveMap(mapData);
        
        return mapData;
    }
    
    generateVillageMap(mapData) {
        const { width, height } = mapData.size;
        
        // Add main dirt road through the middle
        const roadY = Math.floor(height / 2);
        for (let x = 0; x < width; x++) {
            mapData.grid[roadY][x] = 'dirt_road';
            mapData.roads.push({ x, y: roadY, type: 'main' });
        }
        
        // Add cross road
        const roadX = Math.floor(width / 2);
        for (let y = 0; y < height; y++) {
            if (y !== roadY) { // Don't override main road
                mapData.grid[y][roadX] = 'dirt_road';
                mapData.roads.push({ x: roadX, y, type: 'cross' });
            }
        }
        
        // Place buildings around roads
        this.placeBuildingNearRoad(mapData, 'tavern', 'The Prancing Pony');
        this.placeBuildingNearRoad(mapData, 'blacksmith', 'Iron & Anvil');
        this.placeBuildingNearRoad(mapData, 'shop', 'Village Store');
        this.placeBuildingNearRoad(mapData, 'temple', 'Village Shrine');
        
        // Add some houses
        for (let i = 0; i < 3; i++) {
            this.placeBuildingNearRoad(mapData, 'house', `Cottage ${i + 1}`);
        }
        
        // Add natural features
        this.addRandomTerrain(mapData, 'tree', 5, 8);
        this.addRandomTerrain(mapData, 'rock', 2, 4);
        
        // Fill empty spaces with grass
        this.fillEmptyWithTerrain(mapData, 'grass');
    }
    
    generateForestMap(mapData) {
        const { width, height } = mapData.size;
        
        // Fill with trees
        this.addRandomTerrain(mapData, 'tree', 40, 60);
        
        // Add a small stream
        this.addStream(mapData);
        
        // Add rocks and clearings
        this.addRandomTerrain(mapData, 'rock', 5, 10);
        
        // Create a few clearings
        this.createClearings(mapData, 3);
        
        // Fill remaining with grass
        this.fillEmptyWithTerrain(mapData, 'grass');
    }
    
    generateWildernessMap(mapData) {
        const { width, height } = mapData.size;
        
        // Add varied terrain
        this.addRandomTerrain(mapData, 'tree', 15, 25);
        this.addRandomTerrain(mapData, 'rock', 8, 12);
        
        // Maybe add a stream
        if (Math.random() < 0.6) {
            this.addStream(mapData);
        }
        
        // Add a dirt path
        this.addRandomPath(mapData);
        
        // Fill with grass
        this.fillEmptyWithTerrain(mapData, 'grass');
    }
    
    placeBuildingNearRoad(mapData, buildingType, customName = null) {
        const template = this.buildingTemplates.get(buildingType);
        if (!template) return;
        
        const roads = mapData.roads;
        if (roads.length === 0) return;
        
        // Find a suitable spot near a road
        for (let attempts = 0; attempts < 20; attempts++) {
            const road = roads[Math.floor(Math.random() * roads.length)];
            const offsetX = Math.random() < 0.5 ? -1 : 1;
            const offsetY = Math.random() < 0.5 ? -1 : 1;
            
            const startX = road.x + offsetX * 2;
            const startY = road.y + offsetY * 2;
            
            if (this.canPlaceBuilding(mapData, startX, startY, template.width, template.height)) {
                this.placeBuilding(mapData, startX, startY, template, customName || template.name);
                return true;
            }
        }
        return false;
    }
    
    canPlaceBuilding(mapData, x, y, width, height) {
        if (x < 0 || y < 0 || x + width >= mapData.size.width || y + height >= mapData.size.height) {
            return false;
        }
        
        // Check if area is empty
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (mapData.grid[y + dy][x + dx] !== null) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    placeBuilding(mapData, x, y, template, name) {
        const building = {
            id: this.generateId(),
            name: name,
            type: template.name,
            x: x,
            y: y,
            width: template.width,
            height: template.height,
            color: template.color
        };
        
        // Place building tiles
        for (let dy = 0; dy < template.height; dy++) {
            for (let dx = 0; dx < template.width; dx++) {
                const tileType = template.layout[dy][dx];
                mapData.grid[y + dy][x + dx] = tileType === 'door' ? 'door' : 'building_wall';
            }
        }
        
        mapData.buildings.push(building);
    }
    
    addRandomTerrain(mapData, terrainType, minCount, maxCount) {
        const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
        const { width, height } = mapData.size;
        
        for (let i = 0; i < count; i++) {
            for (let attempts = 0; attempts < 50; attempts++) {
                const x = Math.floor(Math.random() * width);
                const y = Math.floor(Math.random() * height);
                
                if (mapData.grid[y][x] === null) {
                    mapData.grid[y][x] = terrainType;
                    mapData.terrain.push({ x, y, type: terrainType });
                    break;
                }
            }
        }
    }
    
    addStream(mapData) {
        const { width, height } = mapData.size;
        const startY = Math.floor(Math.random() * height);
        let currentY = startY;
        
        for (let x = 0; x < width; x++) {
            if (mapData.grid[currentY][x] === null) {
                mapData.grid[currentY][x] = 'water';
                mapData.terrain.push({ x, y: currentY, type: 'water' });
            }
            
            // Random meandering
            if (Math.random() < 0.3) {
                currentY += Math.random() < 0.5 ? -1 : 1;
                currentY = Math.max(0, Math.min(height - 1, currentY));
            }
        }
    }
    
    addRandomPath(mapData) {
        const { width, height } = mapData.size;
        const startX = 0;
        const startY = Math.floor(Math.random() * height);
        const endX = width - 1;
        const endY = Math.floor(Math.random() * height);
        
        // Simple path generation
        let currentX = startX;
        let currentY = startY;
        
        while (currentX < endX || currentY !== endY) {
            if (mapData.grid[currentY][currentX] === null) {
                mapData.grid[currentY][currentX] = 'dirt_road';
                mapData.roads.push({ x: currentX, y: currentY, type: 'path' });
            }
            
            if (currentX < endX && (Math.random() < 0.7 || currentY === endY)) {
                currentX++;
            } else if (currentY < endY) {
                currentY++;
            } else if (currentY > endY) {
                currentY--;
            }
        }
    }
    
    createClearings(mapData, count) {
        const { width, height } = mapData.size;
        
        for (let i = 0; i < count; i++) {
            const centerX = Math.floor(Math.random() * width);
            const centerY = Math.floor(Math.random() * height);
            const radius = 1 + Math.floor(Math.random() * 2);
            
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        if (dx * dx + dy * dy <= radius * radius) {
                            mapData.grid[y][x] = null; // Will be filled with grass later
                        }
                    }
                }
            }
        }
    }
    
    fillEmptyWithTerrain(mapData, terrainType) {
        const { width, height } = mapData.size;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (mapData.grid[y][x] === null) {
                    mapData.grid[y][x] = terrainType;
                    mapData.terrain.push({ x, y, type: terrainType });
                }
            }
        }
    }
    
    generateEmptyGrid(width, height) {
        return Array(height).fill(null).map(() => Array(width).fill(null));
    }
    
    saveMap(mapData) {
        if (!mapData.id) {
            mapData.id = this.generateUniqueMapId();
        }
        
        // Add metadata for database storage
        mapData.savedAt = new Date().toISOString();
        mapData.version = '1.0';
        
        // Store in memory cache
        this.savedMaps.set(mapData.id, mapData);
        
        // Save individual map to database with unique key
        if (this.database) {
            // Save the individual map
            this.database.save(`battle_map_${mapData.id}`, mapData);
            
            // Update the master index of all battle maps
            const mapIndex = this.database.load('battle_maps_index') || [];
            const existingIndex = mapIndex.findIndex(entry => entry.id === mapData.id);
            
            const mapEntry = {
                id: mapData.id,
                name: mapData.name,
                type: mapData.type,
                locationName: mapData.name,
                createdAt: mapData.createdAt,
                savedAt: mapData.savedAt,
                sessionIds: mapData.sessionIds || []
            };
            
            if (existingIndex >= 0) {
                mapIndex[existingIndex] = mapEntry;
            } else {
                mapIndex.push(mapEntry);
            }
            
            this.database.save('battle_maps_index', mapIndex);
            
            console.log(`💾 Battle map saved to database: ${mapData.name} (ID: ${mapData.id})`);
        }
        
        this.core.emit('battleMap:saved', { mapData });
    }
    
    loadMap(locationName) {
        // First try to find by location name in memory
        for (const [id, mapData] of this.savedMaps) {
            if (mapData.name.toLowerCase() === locationName.toLowerCase()) {
                console.log(`🗺️ Loading cached battle map: ${mapData.name}`);
                this.core.emit('battleMap:loaded', { mapData });
                return mapData;
            }
        }
        
        // If not in memory, search database
        if (this.database) {
            const mapIndex = this.database.load('battle_maps_index') || [];
            const mapEntry = mapIndex.find(entry => 
                entry.locationName.toLowerCase() === locationName.toLowerCase()
            );
            
            if (mapEntry) {
                const mapData = this.database.load(`battle_map_${mapEntry.id}`);
                if (mapData) {
                    this.savedMaps.set(mapData.id, mapData); // Cache it
                    console.log(`💾 Loaded battle map from database: ${mapData.name}`);
                    this.core.emit('battleMap:loaded', { mapData });
                    return mapData;
                }
            }
        }
        
        return null;
    }
    
    loadMapById(mapId) {
        // Try memory first
        const cachedMap = this.savedMaps.get(mapId);
        if (cachedMap) {
            return cachedMap;
        }
        
        // Load from database
        if (this.database) {
            const mapData = this.database.load(`battle_map_${mapId}`);
            if (mapData) {
                this.savedMaps.set(mapId, mapData); // Cache it
                return mapData;
            }
        }
        
        return null;
    }
    
    loadSavedMaps() {
        if (!this.database) return;
        
        // Load the master index
        const mapIndex = this.database.load('battle_maps_index') || [];
        
        if (mapIndex.length > 0) {
            console.log(`🗺️ Found ${mapIndex.length} battle maps in database`);
            
            // Optionally load frequently used maps into memory
            mapIndex.slice(0, 10).forEach(mapEntry => {
                const mapData = this.database.load(`battle_map_${mapEntry.id}`);
                if (mapData) {
                    this.savedMaps.set(mapData.id, mapData);
                }
            });
            
            console.log(`🗺️ Loaded ${this.savedMaps.size} battle maps into memory`);
        }
    }
    
    getTerrainSprite(terrainType) {
        return this.terrainSprites.get(terrainType);
    }
    
    getBuildingTemplate(buildingType) {
        return this.buildingTemplates.get(buildingType);
    }
    
    getAllSavedMaps() {
        return Array.from(this.savedMaps.values());
    }
    
    deleteMap(mapId) {
        // Remove from memory
        const deleted = this.savedMaps.delete(mapId);
        
        if (this.database) {
            // Remove from database
            this.database.delete(`battle_map_${mapId}`);
            
            // Update index
            const mapIndex = this.database.load('battle_maps_index') || [];
            const updatedIndex = mapIndex.filter(entry => entry.id !== mapId);
            this.database.save('battle_maps_index', updatedIndex);
        }
        
        if (deleted) {
            console.log(`🗑️ Deleted battle map: ${mapId}`);
        }
        
        return deleted;
    }
    
    linkMapToSession(mapId, sessionId) {
        const mapData = this.loadMapById(mapId);
        if (mapData) {
            if (!mapData.sessionIds) {
                mapData.sessionIds = [];
            }
            
            if (!mapData.sessionIds.includes(sessionId)) {
                mapData.sessionIds.push(sessionId);
                this.saveMap(mapData); // This will update the database
                console.log(`🔗 Linked battle map ${mapId} to session ${sessionId}`);
            }
        }
    }
    
    getMapsForSession(sessionId) {
        const mapIndex = this.database?.load('battle_maps_index') || [];
        return mapIndex.filter(entry => entry.sessionIds && entry.sessionIds.includes(sessionId));
    }
    
    getAllMapIds() {
        const mapIndex = this.database?.load('battle_maps_index') || [];
        return mapIndex.map(entry => entry.id);
    }
    
    generateMapId(locationName) {
        return locationName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_battle_map';
    }
    
    generateId() {
        return 'map_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateUniqueMapId() {
        return 'bmap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
    }
}