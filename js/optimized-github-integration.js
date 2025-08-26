export default class OptimizedGitHubIntegration {
    constructor(core) {
        this.core = core;
        this.githubToken = null;
        this.repository = null;
        this.username = null;
        this.baseApiUrl = 'https://api.github.com';
        
        // Optimization components
        this.cache = new GitHubCache();
        this.offlineManager = new OfflineManager(this);
        this.quotaMonitor = new QuotaMonitor();
        this.syncManager = new SyncManager(this);
        this.compressionManager = new CompressionManager();
        
        // Performance tracking
        this.performanceMetrics = {
            apiCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            dataTransferred: 0,
            avgResponseTime: 0,
            quotaUsed: 0,
            quotaRemaining: 5000 // Default GitHub limit
        };
        
        // Configuration
        this.config = {
            maxChunkSize: 950000, // ~950KB (GitHub has 1MB file limit)
            maxCommitSize: 50000000, // 50MB recommended max
            cacheExpiryTime: 300000, // 5 minutes
            backgroundSyncInterval: 30000, // 30 seconds
            batchSize: 10, // Files per batch operation
            compressionLevel: 6, // 1-9, balance speed vs size
            enableIncrementalSync: true,
            enableCompression: true,
            enableOfflineMode: true,
            enableSmartCaching: true
        };
        
        this.init();
    }

    async init() {
        // Initialize optimization components
        await this.cache.init();
        await this.offlineManager.init();
        await this.syncManager.init();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load stored credentials
        this.loadStoredCredentials();
        
        // Start background processes
        this.startBackgroundSync();
        this.startQuotaMonitoring();
        
        console.log('🚀 Optimized GitHub Integration initialized');
    }

    setupEventListeners() {
        // Core events
        this.core.on('github:authenticate', (event) => this.authenticate(event.detail));
        this.core.on('github:saveCampaign', (event) => this.saveCampaignOptimized(event.detail));
        this.core.on('github:loadCampaign', (event) => this.loadCampaignOptimized(event.detail));
        this.core.on('github:syncData', (event) => this.incrementalSync(event.detail));
        
        // Optimization events
        this.core.on('app:online', () => this.handleOnlineStatus(true));
        this.core.on('app:offline', () => this.handleOnlineStatus(false));
        this.core.on('data:changed', (event) => this.queueDataChange(event.detail));
        
        // Periodic saves from all systems
        this.setupPeriodicSaves();
    }

    /**
     * Set up periodic saves for all major systems
     */
    setupPeriodicSaves() {
        // Save world database changes every 5 minutes
        setInterval(async () => {
            if (this.core.getModule('worldDatabase')) {
                const changes = await this.core.getModule('worldDatabase').getChangesSince(
                    this.syncManager.getLastSyncTime('worldDatabase')
                );
                if (changes.length > 0) {
                    await this.saveIncrementalData('worldDatabase', changes);
                }
            }
        }, 300000);
        
        // Save choice tracking every 2 minutes
        setInterval(async () => {
            if (this.core.getModule('choiceTrackingSystem')) {
                const data = this.core.getModule('choiceTrackingSystem').exportChoiceData();
                await this.saveIncrementalData('choiceTracking', data);
            }
        }, 120000);
        
        // Save dialogue history every 3 minutes
        setInterval(async () => {
            if (this.core.getModule('dynamicDialogueSystem')) {
                const data = this.core.getModule('dynamicDialogueSystem').exportDialogueData();
                await this.saveIncrementalData('dialogue', data);
            }
        }, 180000);
    }

    /**
     * Save incremental data to prevent full syncs for small changes
     */
    async saveIncrementalData(dataType, data) {
        if (!data || !this.config.enableIncrementalSync) {
            return false;
        }

        try {
            console.log(`💾 Saving incremental ${dataType} data...`);
            
            // For now, just store locally - can be enhanced later for actual GitHub sync
            const database = this.core.getModule('database');
            if (database) {
                const success = database.save(`incremental_${dataType}`, {
                    data: data,
                    timestamp: new Date().toISOString(),
                    type: dataType
                });
                
                if (success) {
                    console.log(`✅ Incremental ${dataType} data saved locally`);
                }
                
                return success;
            }
            
            return false;
        } catch (error) {
            console.error(`❌ Failed to save incremental ${dataType} data:`, error);
            return false;
        }
    }

    /**
     * Optimized campaign saving with chunking and compression
     */
    async saveCampaignOptimized(campaignData) {
        if (!this.isAuthenticated() && !this.offlineManager.isEnabled()) {
            return this.handleUnauthenticatedSave(campaignData);
        }

        const startTime = performance.now();
        
        try {
            // Check quota before proceeding
            if (!await this.quotaMonitor.checkAvailableQuota(2)) {
                return await this.handleQuotaExceeded(campaignData);
            }

            // Analyze and optimize campaign data
            const optimizedData = await this.optimizeCampaignData(campaignData);
            
            // Split large data into chunks
            const chunks = await this.chunkCampaignData(optimizedData);
            
            // Save chunks incrementally
            const results = await this.saveDataChunks(chunks, 'campaign');
            
            // Update performance metrics
            const endTime = performance.now();
            this.updatePerformanceMetrics('save', endTime - startTime, optimizedData);
            
            // Emit success event
            this.core.emit('github:saved', {
                success: true,
                chunksCount: chunks.length,
                totalSize: this.calculateDataSize(optimizedData),
                compressionRatio: this.calculateCompressionRatio(campaignData, optimizedData)
            });
            
            console.log(`🚀 Campaign saved optimally: ${chunks.length} chunks, ${this.formatBytes(this.calculateDataSize(optimizedData))}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Optimized campaign save failed:', error);
            
            // Try fallback to offline save
            if (this.offlineManager.isEnabled()) {
                return await this.offlineManager.saveCampaign(campaignData);
            }
            
            this.core.emit('github:saved', { success: false, error: error.message });
            return false;
        }
    }

    /**
     * Optimize campaign data for efficient storage
     */
    async optimizeCampaignData(campaignData) {
        const optimized = { ...campaignData };
        
        // Remove redundant data
        optimized.metadata = {
            ...optimized.metadata,
            lastOptimized: new Date().toISOString(),
            optimizationVersion: '2.0'
        };
        
        // Compress large text fields
        if (this.config.enableCompression) {
            optimized.compressedFields = {};
            
            // Compress dialogue history
            if (optimized.dialogueHistory && this.calculateDataSize(optimized.dialogueHistory) > 10000) {
                optimized.compressedFields.dialogueHistory = await this.compressionManager.compress(
                    JSON.stringify(optimized.dialogueHistory)
                );
                delete optimized.dialogueHistory;
            }
            
            // Compress world database
            if (optimized.worldDatabase && this.calculateDataSize(optimized.worldDatabase) > 50000) {
                optimized.compressedFields.worldDatabase = await this.compressionManager.compress(
                    JSON.stringify(optimized.worldDatabase)
                );
                delete optimized.worldDatabase;
            }
            
            // Compress interaction history
            if (optimized.interactionHistory && this.calculateDataSize(optimized.interactionHistory) > 20000) {
                optimized.compressedFields.interactionHistory = await this.compressionManager.compress(
                    JSON.stringify(optimized.interactionHistory)
                );
                delete optimized.interactionHistory;
            }
        }
        
        // Create differential updates
        if (this.config.enableIncrementalSync) {
            const lastVersion = await this.cache.get(`campaign_${campaignData.id}_last`);
            if (lastVersion) {
                optimized.deltaFrom = lastVersion.version;
                optimized.changes = this.calculateDataDelta(lastVersion.data, campaignData);
            }
        }
        
        return optimized;
    }

    /**
     * Split large campaign data into manageable chunks
     */
    async chunkCampaignData(campaignData) {
        const chunks = [];
        const dataSize = this.calculateDataSize(campaignData);
        
        if (dataSize <= this.config.maxChunkSize) {
            // Small enough for single file
            chunks.push({
                id: 'main',
                type: 'complete',
                data: campaignData,
                path: `campaigns/${campaignData.id}/campaign.json`
            });
        } else {
            // Split into logical chunks
            const chunkMap = {
                metadata: `campaigns/${campaignData.id}/metadata.json`,
                worldDatabase: `campaigns/${campaignData.id}/world/database.json`,
                choiceTracking: `campaigns/${campaignData.id}/choices/tracking.json`,
                dialogueHistory: `campaigns/${campaignData.id}/dialogue/history.json`,
                questSystem: `campaigns/${campaignData.id}/quests/system.json`,
                relationships: `campaigns/${campaignData.id}/relationships/data.json`,
                combatHistory: `campaigns/${campaignData.id}/combat/history.json`,
                restHistory: `campaigns/${campaignData.id}/rest/history.json`
            };
            
            for (const [section, path] of Object.entries(chunkMap)) {
                if (campaignData[section]) {
                    const sectionSize = this.calculateDataSize(campaignData[section]);
                    
                    if (sectionSize > this.config.maxChunkSize) {
                        // Further subdivide large sections
                        const subChunks = await this.subdivideSection(campaignData[section], section, path);
                        chunks.push(...subChunks);
                    } else {
                        chunks.push({
                            id: section,
                            type: 'section',
                            data: campaignData[section],
                            path: path
                        });
                    }
                }
            }
        }
        
        return chunks;
    }

    /**
     * Save data chunks with smart batching
     */
    async saveDataChunks(chunks, type) {
        const results = [];
        const batches = this.createBatches(chunks, this.config.batchSize);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            
            // Update progress
            this.core.emit('github:sync_progress', {
                current: i + 1,
                total: batches.length,
                message: `Saving batch ${i + 1} of ${batches.length}`
            });
            
            // Check quota before each batch
            if (!await this.quotaMonitor.checkAvailableQuota(batch.length)) {
                throw new Error('GitHub API quota exceeded during batch save');
            }
            
            // Save batch concurrently
            const batchPromises = batch.map(chunk => this.saveChunk(chunk, type));
            const batchResults = await Promise.allSettled(batchPromises);
            
            // Process results
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    console.warn('Chunk save failed:', result.reason);
                    // Continue with other chunks rather than failing completely
                }
            }
            
            // Rate limiting pause between batches
            if (i < batches.length - 1) {
                await this.sleep(1000);
            }
        }
        
        return results;
    }

    /**
     * Save individual chunk with caching and error handling
     */
    async saveChunk(chunk, type) {
        const startTime = performance.now();
        
        try {
            // Check cache first
            const cacheKey = `chunk_${chunk.path}_${this.hashObject(chunk.data)}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached && cached.sha) {
                console.log(`📦 Chunk cached: ${chunk.path}`);
                this.performanceMetrics.cacheHits++;
                return cached;
            }
            
            this.performanceMetrics.cacheMisses++;
            
            // Prepare content
            let content = JSON.stringify(chunk.data, null, 2);
            
            // Apply compression if beneficial
            if (this.config.enableCompression && content.length > 5000) {
                const compressed = await this.compressionManager.compress(content);
                if (compressed.length < content.length * 0.8) {
                    content = compressed;
                    chunk.compressed = true;
                }
            }
            
            const encodedContent = btoa(unescape(encodeURIComponent(content)));
            
            // Get existing file info
            const existingFile = await this.getFileFromGitHub(chunk.path);
            const isUpdate = existingFile !== null;
            
            // Prepare request
            const requestBody = {
                message: `${isUpdate ? 'Update' : 'Add'} ${type}: ${chunk.id} [optimized]`,
                content: encodedContent,
                branch: 'main'
            };
            
            if (isUpdate && existingFile.sha) {
                requestBody.sha = existingFile.sha;
            }
            
            // Make API request
            const response = await this.makeGitHubRequest(
                `repos/${this.username}/${this.repository}/contents/${chunk.path}`,
                'PUT',
                requestBody
            );
            
            if (response.ok) {
                const result = await response.json();
                const chunkResult = {
                    chunkId: chunk.id,
                    path: chunk.path,
                    sha: result.content.sha,
                    size: result.content.size,
                    compressed: chunk.compressed || false
                };
                
                // Cache the result
                await this.cache.set(cacheKey, chunkResult, this.config.cacheExpiryTime);
                
                // Update performance metrics
                const endTime = performance.now();
                this.updatePerformanceMetrics('chunk_save', endTime - startTime, chunk.data);
                
                return chunkResult;
            } else {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.error(`Failed to save chunk ${chunk.path}:`, error);
            
            // Try offline save as fallback
            if (this.offlineManager.isEnabled()) {
                return await this.offlineManager.saveChunk(chunk);
            }
            
            throw error;
        }
    }

    /**
     * Optimized campaign loading with smart caching
     */
    async loadCampaignOptimized(loadData) {
        const startTime = performance.now();
        
        try {
            // Check for legacy format first
            const legacyCampaign = await this.loadLegacyCampaign(loadData);
            if (legacyCampaign) {
                return legacyCampaign;
            }
            
            const { campaignId, version } = loadData;
            
            // Check cache first
            const cacheKey = `campaign_${campaignId}_${version || 'latest'}`;
            const cached = await this.cache.get(cacheKey);
            
            if (cached && !this.cache.isExpired(cached)) {
                console.log(`📦 Campaign loaded from cache: ${campaignId}`);
                this.performanceMetrics.cacheHits++;
                this.core.emit('github:loaded', { success: true, data: cached.data, fromCache: true });
                return cached.data;
            }
            
            this.performanceMetrics.cacheMisses++;
            
            // Load from GitHub
            const campaignData = await this.loadCampaignChunks(campaignId, version);
            
            // Decompress data if needed
            const decompressedData = await this.decompressCampaignData(campaignData);
            
            // Cache the loaded data
            await this.cache.set(cacheKey, {
                data: decompressedData,
                timestamp: Date.now(),
                version: decompressedData.metadata?.version
            }, this.config.cacheExpiryTime);
            
            // Update performance metrics
            const endTime = performance.now();
            this.updatePerformanceMetrics('load', endTime - startTime, decompressedData);
            
            this.core.emit('github:loaded', { success: true, data: decompressedData });
            
            console.log(`📥 Campaign loaded optimally: ${this.formatBytes(this.calculateDataSize(decompressedData))}`);
            
            return decompressedData;
            
        } catch (error) {
            console.error('❌ Optimized campaign load failed:', error);
            
            // Try offline load as fallback
            if (this.offlineManager.isEnabled()) {
                return await this.offlineManager.loadCampaign(loadData);
            }
            
            this.core.emit('github:loaded', { success: false, error: error.message });
            return null;
        }
    }

    /**
     * Load legacy campaign format (backward compatibility)
     */
    async loadLegacyCampaign(loadData) {
        try {
            const { fileName, campaignId } = loadData;
            const targetFile = fileName || `campaigns/${campaignId}.json`;
            
            // Try to load the old monolithic format
            const fileData = await this.getFileFromGitHub(targetFile);
            
            if (fileData) {
                const content = atob(fileData.content);
                const campaignData = JSON.parse(content);
                
                console.log(`🔄 Loading legacy campaign format: ${targetFile}`);
                
                // Automatically upgrade to new format if enabled
                if (this.config.enableIncrementalSync) {
                    console.log('🔄 Auto-upgrading legacy campaign to optimized format...');
                    await this.saveCampaignOptimized(campaignData);
                }
                
                this.core.emit('github:loaded', { 
                    campaignData,
                    fileName: targetFile,
                    success: true,
                    legacy: true 
                });
                
                return campaignData;
            }
            
            return null;
        } catch (error) {
            console.log('📁 No legacy campaign found, proceeding with optimized load');
            return null;
        }
    }

    /**
     * Load campaign data from chunks
     */
    async loadCampaignChunks(campaignId, version) {
        const campaignPath = `campaigns/${campaignId}`;
        
        // Try to load as single file first
        try {
            const singleFile = await this.getFileFromGitHub(`${campaignPath}/campaign.json`);
            if (singleFile) {
                return JSON.parse(atob(singleFile.content));
            }
        } catch (error) {
            // Continue to chunked loading
        }
        
        // Load chunked data
        const chunkPaths = [
            'metadata.json',
            'world/database.json',
            'choices/tracking.json',
            'dialogue/history.json',
            'quests/system.json',
            'relationships/data.json',
            'combat/history.json',
            'rest/history.json'
        ];
        
        const campaignData = {};
        const loadPromises = chunkPaths.map(async (path) => {
            try {
                const chunk = await this.getFileFromGitHub(`${campaignPath}/${path}`);
                if (chunk) {
                    let content = atob(chunk.content);
                    
                    // Handle compressed content
                    if (content.startsWith('COMPRESSED:')) {
                        content = await this.compressionManager.decompress(content);
                    }
                    
                    const sectionName = this.pathToSectionName(path);
                    campaignData[sectionName] = JSON.parse(content);
                }
            } catch (error) {
                console.warn(`Failed to load chunk ${path}:`, error);
                // Continue with other chunks
            }
        });
        
        await Promise.allSettled(loadPromises);
        
        return campaignData;
    }

    /**
     * Incremental sync for real-time updates
     */
    async incrementalSync(syncData) {
        if (!this.config.enableIncrementalSync) {
            return false;
        }
        
        const { systemName, changes, timestamp } = syncData;
        
        try {
            // Create incremental update
            const incrementalData = {
                system: systemName,
                timestamp: timestamp || new Date().toISOString(),
                changes: changes,
                version: await this.generateVersion()
            };
            
            // Save incremental data
            const path = `incremental/${systemName}/${Date.now()}.json`;
            const result = await this.saveChunk({
                id: `incremental_${systemName}`,
                data: incrementalData,
                path: path
            }, 'incremental');
            
            // Update sync tracking
            this.syncManager.recordSync(systemName, timestamp, result);
            
            console.log(`🔄 Incremental sync completed: ${systemName}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Incremental sync failed for ${systemName}:`, error);
            
            // Queue for retry
            this.syncManager.queueRetry(systemName, changes);
            return false;
        }
    }

    /**
     * Background sync manager
     */
    startBackgroundSync() {
        setInterval(async () => {
            if (!this.isOnline() || !this.isAuthenticated()) {
                return;
            }
            
            // Process offline queue
            await this.offlineManager.processQueue();
            
            // Process retry queue
            await this.syncManager.processRetryQueue();
            
            // Clean up old cache entries
            await this.cache.cleanup();
            
            // Update performance metrics
            this.updatePerformanceReport();
            
        }, this.config.backgroundSyncInterval);
    }

    /**
     * Smart caching system
     */
    async smartCache(key, fetchFunction, expiryTime) {
        const cached = await this.cache.get(key);
        
        if (cached && !this.cache.isExpired(cached)) {
            this.performanceMetrics.cacheHits++;
            return cached.data;
        }
        
        this.performanceMetrics.cacheMisses++;
        
        const data = await fetchFunction();
        await this.cache.set(key, { data, timestamp: Date.now() }, expiryTime);
        
        return data;
    }

    /**
     * GitHub API quota monitoring
     */
    startQuotaMonitoring() {
        setInterval(async () => {
            if (!this.isAuthenticated()) return;
            
            try {
                const response = await this.makeGitHubRequest('rate_limit', 'GET');
                if (response.ok) {
                    const rateLimit = await response.json();
                    this.quotaMonitor.updateQuota(rateLimit);
                    
                    // Emit quota status
                    this.core.emit('github:quota_status', {
                        remaining: rateLimit.core.remaining,
                        limit: rateLimit.core.limit,
                        resetTime: rateLimit.core.reset
                    });
                }
            } catch (error) {
                console.warn('Failed to check GitHub quota:', error);
            }
        }, 60000); // Check every minute
    }

    /**
     * Enhanced GitHub API request with retry and rate limiting
     */
    async makeGitHubRequest(endpoint, method = 'GET', body = null, retries = 3) {
        const url = `${this.baseApiUrl}/${endpoint}`;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Check quota before request
                if (!await this.quotaMonitor.checkAvailableQuota(1)) {
                    throw new Error('GitHub API quota exceeded');
                }
                
                const options = {
                    method,
                    headers: {
                        'Authorization': `token ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'DND-Voice-Adventure/1.0'
                    }
                };
                
                if (body && (method === 'POST' || method === 'PUT')) {
                    options.headers['Content-Type'] = 'application/json';
                    options.body = typeof body === 'string' ? body : JSON.stringify(body);
                }
                
                const startTime = performance.now();
                const response = await fetch(url, options);
                const endTime = performance.now();
                
                // Update performance metrics
                this.performanceMetrics.apiCalls++;
                this.performanceMetrics.avgResponseTime = 
                    (this.performanceMetrics.avgResponseTime + (endTime - startTime)) / 2;
                
                // Update quota from headers
                this.quotaMonitor.updateFromHeaders(response.headers);
                
                if (response.ok) {
                    return response;
                } else if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
                    // Rate limited - wait for reset
                    const resetTime = parseInt(response.headers.get('X-RateLimit-Reset')) * 1000;
                    const waitTime = resetTime - Date.now();
                    if (waitTime > 0 && waitTime < 3600000) { // Don't wait more than 1 hour
                        console.log(`⏳ Rate limited, waiting ${Math.ceil(waitTime / 60000)} minutes`);
                        await this.sleep(waitTime);
                        continue;
                    }
                } else if (response.status >= 500 && attempt < retries) {
                    // Server error - retry with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                    console.log(`🔄 Server error, retrying in ${delay}ms (attempt ${attempt}/${retries})`);
                    await this.sleep(delay);
                    continue;
                }
                
                return response;
                
            } catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                
                // Network error - retry with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
                console.log(`🔄 Network error, retrying in ${delay}ms (attempt ${attempt}/${retries})`);
                await this.sleep(delay);
            }
        }
    }

    // ===== UTILITY METHODS =====

    calculateDataSize(data) {
        return new Blob([JSON.stringify(data)]).size;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    hashObject(obj) {
        const str = JSON.stringify(obj);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isAuthenticated() {
        return !!(this.githubToken && this.repository && this.username);
    }

    isOnline() {
        return navigator.onLine;
    }

    updatePerformanceMetrics(operation, duration, data) {
        if (data) {
            this.performanceMetrics.dataTransferred += this.calculateDataSize(data);
        }
        // Additional metrics tracking
    }

    // ===== PUBLIC API =====

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            cacheHitRate: this.performanceMetrics.cacheHits / 
                         (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses),
            dataTransferredFormatted: this.formatBytes(this.performanceMetrics.dataTransferred)
        };
    }

    /**
     * Enable/disable optimization features
     */
    configureOptimizations(options) {
        this.config = { ...this.config, ...options };
        console.log('🔧 GitHub optimization configuration updated');
    }

    /**
     * Force sync all pending data
     */
    async forceSyncAll() {
        return await this.syncManager.forceSyncAll();
    }

    /**
     * Clear all caches
     */
    async clearCache() {
        await this.cache.clear();
        console.log('🗑️ GitHub cache cleared');
    }

    // ========== COMPATIBILITY METHODS ==========
    // These methods provide backward compatibility with existing codebase

    loadStoredCredentials() {
        const storedToken = localStorage.getItem('dnd_voice_github_token');
        const storedRepo = localStorage.getItem('dnd_voice_github_repo');
        const storedUsername = localStorage.getItem('dnd_voice_github_username');
        
        if (storedToken && storedRepo && storedUsername) {
            this.githubToken = storedToken;
            this.repository = storedRepo;
            this.username = storedUsername;
            
            console.log('📁 GitHub credentials loaded from storage');
            this.core.emit('github:authenticated', { 
                username: this.username, 
                repository: this.repository,
                success: true 
            });
        }
    }

    async authenticate(authData) {
        const { token, repository, username } = authData;
        
        try {
            if (token && repository && username) {
                const isValid = await this.validateToken(token, username);
                
                if (isValid) {
                    this.githubToken = token;
                    this.repository = repository;
                    this.username = username;
                    
                    localStorage.setItem('dnd_voice_github_token', token);
                    localStorage.setItem('dnd_voice_github_repo', repository);
                    localStorage.setItem('dnd_voice_github_username', username);
                    
                    this.core.emit('github:authenticated', { 
                        username, 
                        repository, 
                        success: true 
                    });
                    
                    console.log(`✅ Authenticated with GitHub as ${username}`);
                    return true;
                } else {
                    throw new Error('Invalid GitHub token or username');
                }
            } else {
                throw new Error('Missing authentication data');
            }
        } catch (error) {
            console.error('❌ GitHub authentication failed:', error);
            this.core.emit('github:authenticated', { success: false, error: error.message });
            return false;
        }
    }

    async validateToken(token, username) {
        try {
            const response = await fetch(`${this.baseApiUrl}/user`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                return userData.login === username;
            }
            return false;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    isAuthenticated() {
        return !!(this.githubToken && this.repository && this.username);
    }

    disconnectUser() {
        this.githubToken = null;
        this.repository = null;
        this.username = null;
        
        localStorage.removeItem('dnd_voice_github_token');
        localStorage.removeItem('dnd_voice_github_repo');
        localStorage.removeItem('dnd_voice_github_username');
        
        this.core.emit('github:disconnected', { success: true });
        console.log('🔌 Disconnected from GitHub');
    }

    async getFileFromGitHub(filePath) {
        try {
            const response = await this.makeGitHubRequest(`repos/${this.username}/${this.repository}/contents/${filePath}`);
            return response;
        } catch (error) {
            if (error.message.includes('404')) {
                return null;
            }
            console.error(`Error fetching file ${filePath}:`, error);
            return null;
        }
    }

    async saveCampaignToGitHub(campaignData) {
        // Delegate to optimized save method
        return this.saveCampaignOptimized(campaignData);
    }

    async loadCampaignFromGitHub(loadData) {
        // Delegate to optimized load method
        return this.loadCampaignOptimized(loadData);
    }

    async listGitHubCampaigns() {
        // Keep existing functionality but add caching
        const cacheKey = 'campaigns_list';
        const cached = await this.cache.get(cacheKey);
        
        if (cached && !this.cache.isExpired(cached)) {
            console.log('📦 Campaign list loaded from cache');
            this.performanceMetrics.cacheHits++;
            this.core.emit('github:campaignsList', { campaigns: cached.data, success: true });
            return cached.data;
        }
        
        this.performanceMetrics.cacheMisses++;
        
        if (!this.isAuthenticated()) {
            this.core.emit('github:campaignsList', { 
                success: false, 
                error: 'Not authenticated with GitHub' 
            });
            return [];
        }

        try {
            const response = await this.makeGitHubRequest(`repos/${this.username}/${this.repository}/contents/campaigns`);
            
            if (response) {
                const campaigns = response
                    .filter(file => file.name.endsWith('.json') && file.type === 'file')
                    .map(file => ({
                        name: file.name.replace('.json', ''),
                        fileName: file.name,
                        path: file.path,
                        size: file.size,
                        downloadUrl: file.download_url,
                        htmlUrl: file.html_url,
                        lastModified: file.sha
                    }));
                
                // Cache the result
                await this.cache.set(cacheKey, { data: campaigns, timestamp: Date.now() });
                
                this.core.emit('github:campaignsList', { campaigns, success: true });
                console.log(`📂 Found ${campaigns.length} campaigns on GitHub`);
                return campaigns;
                
            } else {
                this.core.emit('github:campaignsList', { campaigns: [], success: true });
                console.log('📂 No campaigns folder found on GitHub');
                return [];
            }
            
        } catch (error) {
            console.error('❌ Failed to list GitHub campaigns:', error);
            this.core.emit('github:campaignsList', { success: false, error: error.message });
            return [];
        }
    }

    async createCampaignRepository(repoData) {
        // Keep existing functionality
        if (!this.githubToken) {
            this.core.emit('github:repositoryCreated', { 
                success: false, 
                error: 'GitHub token required' 
            });
            return false;
        }

        try {
            const { name, description, isPrivate = false } = repoData;
            
            const requestBody = {
                name,
                description: description || 'D&D Voice Adventure Campaign Repository',
                private: isPrivate,
                auto_init: true,
                gitignore_template: 'Node'
            };
            
            const response = await this.makeGitHubRequest('user/repos', 'POST', requestBody);
            
            if (response) {
                await this.createInitialStructure(response.name);
                
                this.core.emit('github:repositoryCreated', { 
                    repository: response,
                    success: true 
                });
                
                console.log(`🏗️ Created GitHub repository: ${response.full_name}`);
                return response;
            }
            
        } catch (error) {
            console.error('❌ Failed to create GitHub repository:', error);
            this.core.emit('github:repositoryCreated', { success: false, error: error.message });
            return false;
        }
    }

    async createInitialStructure(repositoryName) {
        const files = [
            {
                path: 'campaigns/.gitkeep',
                content: '# Campaign save files will be stored here\n'
            },
            {
                path: 'characters/.gitkeep', 
                content: '# Character files will be stored here\n'
            },
            {
                path: 'README.md',
                content: `# ${repositoryName}\n\nD&D Voice Adventure Campaign Repository\n\nThis repository contains campaign saves, characters, and adventure data for your D&D Voice Adventure game.\n\n## Structure\n\n- \`campaigns/\` - Campaign save files\n- \`characters/\` - Character data files\n\n> Generated by [D&D Voice Adventure](https://github.com/taylor834-sketch/AI-DND-DM)\n`
            }
        ];

        for (const file of files) {
            try {
                await this.makeGitHubRequest(
                    `repos/${this.username}/${repositoryName}/contents/${file.path}`,
                    'PUT',
                    {
                        message: `Initial setup: Add ${file.path}`,
                        content: btoa(unescape(encodeURIComponent(file.content))),
                        branch: 'main'
                    }
                );
            } catch (error) {
                console.warn(`⚠️ Could not create ${file.path}:`, error);
            }
        }
    }

    /**
     * Get current connection status with performance metrics
     */
    getConnectionStatus() {
        return {
            connected: this.isAuthenticated(),
            username: this.username,
            repository: this.repository,
            performanceMetrics: this.performanceMetrics,
            config: this.config
        };
    }

    // Legacy compatibility methods
    disconnect() {
        this.disconnectUser();
    }
}

// ===== OPTIMIZATION COMPONENTS =====

class GitHubCache {
    constructor() {
        this.cache = new Map();
        this.storage = new CacheStorage();
    }

    async init() {
        // Load persistent cache from IndexedDB
        await this.storage.init();
        const persistentCache = await this.storage.getAll();
        for (const [key, value] of persistentCache) {
            this.cache.set(key, value);
        }
    }

    async get(key) {
        return this.cache.get(key) || await this.storage.get(key);
    }

    async set(key, value, ttl) {
        const cacheEntry = {
            data: value,
            timestamp: Date.now(),
            ttl: ttl
        };
        
        this.cache.set(key, cacheEntry);
        await this.storage.set(key, cacheEntry);
    }

    isExpired(entry) {
        return Date.now() - entry.timestamp > entry.ttl;
    }

    async cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, entry] of this.cache) {
            if (this.isExpired(entry)) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            this.cache.delete(key);
            await this.storage.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }

    async clear() {
        this.cache.clear();
        await this.storage.clear();
    }
}

class OfflineManager {
    constructor(github) {
        this.github = github;
        this.queue = [];
        this.enabled = true;
    }

    async init() {
        // Load pending operations from storage
        const pending = localStorage.getItem('dnd_offline_queue');
        if (pending) {
            this.queue = JSON.parse(pending);
        }
    }

    isEnabled() {
        return this.enabled && 'serviceWorker' in navigator;
    }

    async saveCampaign(campaignData) {
        this.queue.push({
            id: Date.now(),
            type: 'save_campaign',
            data: campaignData,
            timestamp: new Date().toISOString()
        });
        
        await this.persistQueue();
        console.log('💾 Campaign saved to offline queue');
        return true;
    }

    async processQueue() {
        if (this.queue.length === 0 || !this.github.isOnline()) {
            return;
        }
        
        const processed = [];
        
        for (const item of this.queue) {
            try {
                switch (item.type) {
                    case 'save_campaign':
                        await this.github.saveCampaignOptimized(item.data);
                        processed.push(item.id);
                        break;
                }
            } catch (error) {
                console.warn(`Failed to process offline item ${item.id}:`, error);
                // Keep in queue for retry
            }
        }
        
        // Remove processed items
        this.queue = this.queue.filter(item => !processed.includes(item.id));
        await this.persistQueue();
        
        if (processed.length > 0) {
            console.log(`📤 Processed ${processed.length} offline items`);
        }
    }

    async persistQueue() {
        localStorage.setItem('dnd_offline_queue', JSON.stringify(this.queue));
    }
}

class QuotaMonitor {
    constructor() {
        this.quota = {
            remaining: 5000,
            limit: 5000,
            resetTime: Date.now() + 3600000
        };
    }

    updateQuota(rateLimit) {
        this.quota = {
            remaining: rateLimit.core.remaining,
            limit: rateLimit.core.limit,
            resetTime: rateLimit.core.reset * 1000
        };
    }

    updateFromHeaders(headers) {
        const remaining = headers.get('X-RateLimit-Remaining');
        const limit = headers.get('X-RateLimit-Limit');
        const reset = headers.get('X-RateLimit-Reset');
        
        if (remaining) this.quota.remaining = parseInt(remaining);
        if (limit) this.quota.limit = parseInt(limit);
        if (reset) this.quota.resetTime = parseInt(reset) * 1000;
    }

    async checkAvailableQuota(required = 1) {
        if (this.quota.remaining < required) {
            const waitTime = this.quota.resetTime - Date.now();
            if (waitTime > 0) {
                console.warn(`⚠️ GitHub quota low: ${this.quota.remaining} remaining`);
                return false;
            }
        }
        return true;
    }

    getStatus() {
        return {
            ...this.quota,
            percentUsed: ((this.quota.limit - this.quota.remaining) / this.quota.limit) * 100
        };
    }
}

class SyncManager {
    constructor(github) {
        this.github = github;
        this.syncTimes = new Map();
        this.retryQueue = [];
    }

    async init() {
        // Load sync state
        const stored = localStorage.getItem('dnd_sync_state');
        if (stored) {
            const state = JSON.parse(stored);
            this.syncTimes = new Map(state.syncTimes || []);
            this.retryQueue = state.retryQueue || [];
        }
    }

    recordSync(systemName, timestamp, result) {
        this.syncTimes.set(systemName, {
            lastSync: timestamp,
            lastResult: result,
            syncCount: (this.syncTimes.get(systemName)?.syncCount || 0) + 1
        });
        this.persistState();
    }

    getLastSyncTime(systemName) {
        return this.syncTimes.get(systemName)?.lastSync;
    }

    queueRetry(systemName, data) {
        this.retryQueue.push({
            id: Date.now(),
            systemName,
            data,
            attempts: 0,
            maxAttempts: 3
        });
        this.persistState();
    }

    async processRetryQueue() {
        const processed = [];
        
        for (const item of this.retryQueue) {
            if (item.attempts >= item.maxAttempts) {
                processed.push(item.id);
                continue;
            }
            
            try {
                await this.github.incrementalSync({
                    systemName: item.systemName,
                    changes: item.data,
                    timestamp: new Date().toISOString()
                });
                processed.push(item.id);
            } catch (error) {
                item.attempts++;
                console.warn(`Retry ${item.attempts}/${item.maxAttempts} failed for ${item.systemName}`);
            }
        }
        
        this.retryQueue = this.retryQueue.filter(item => !processed.includes(item.id));
        this.persistState();
    }

    persistState() {
        const state = {
            syncTimes: Array.from(this.syncTimes.entries()),
            retryQueue: this.retryQueue
        };
        localStorage.setItem('dnd_sync_state', JSON.stringify(state));
    }
}

class CompressionManager {
    async compress(data) {
        try {
            // Use built-in compression if available, otherwise simple encoding
            if ('CompressionStream' in window) {
                const stream = new CompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();
                
                writer.write(new TextEncoder().encode(data));
                writer.close();
                
                const chunks = [];
                let done = false;
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }
                
                const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
                let offset = 0;
                for (const chunk of chunks) {
                    compressed.set(chunk, offset);
                    offset += chunk.length;
                }
                
                return 'COMPRESSED:' + btoa(String.fromCharCode(...compressed));
            } else {
                // Fallback: simple encoding
                return 'ENCODED:' + btoa(unescape(encodeURIComponent(data)));
            }
        } catch (error) {
            console.warn('Compression failed, using original data:', error);
            return data;
        }
    }

    async decompress(compressedData) {
        try {
            if (compressedData.startsWith('COMPRESSED:')) {
                const binaryStr = atob(compressedData.substring(11));
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                
                if ('DecompressionStream' in window) {
                    const stream = new DecompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    
                    writer.write(bytes);
                    writer.close();
                    
                    const chunks = [];
                    let done = false;
                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        if (value) chunks.push(value);
                    }
                    
                    return new TextDecoder().decode(new Uint8Array(chunks.flat()));
                }
            } else if (compressedData.startsWith('ENCODED:')) {
                return decodeURIComponent(escape(atob(compressedData.substring(8))));
            }
            
            return compressedData;
        } catch (error) {
            console.warn('Decompression failed, returning original data:', error);
            return compressedData;
        }
    }
}

class CacheStorage {
    constructor() {
        this.dbName = 'DNDVoiceCache';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }
            };
        });
    }

    async get(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };
        });
    }

    async set(key, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.put({ key, value });
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async delete(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.delete(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.clear();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async getAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.getAll();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const items = request.result.map(item => [item.key, item.value]);
                resolve(items);
            };
        });
    }
}