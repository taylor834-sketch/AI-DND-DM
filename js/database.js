export default class DatabaseManager {
    constructor(core) {
        this.core = core;
        this.storagePrefix = 'dnd_voice_';
        this.campaignData = null;
        this.init();
    }

    init() {
        this.core.on('database:save', (event) => this.saveCampaign(event.detail));
        this.core.on('database:load', (event) => this.loadCampaign(event.detail.id));
        this.core.on('database:delete', (event) => this.deleteCampaign(event.detail.id));
    }

    saveCampaign(campaignData) {
        try {
            const campaignId = campaignData.id || this.generateCampaignId();
            const saveData = {
                ...campaignData,
                id: campaignId,
                lastSaved: new Date().toISOString(),
                version: this.core.config.version
            };

            localStorage.setItem(
                `${this.storagePrefix}campaign_${campaignId}`,
                JSON.stringify(saveData)
            );

            this.updateCampaignList(campaignId, saveData.name || 'Untitled Campaign');
            this.core.emit('database:saved', { campaignId, success: true });
            
            return campaignId;
        } catch (error) {
            console.error('❌ Save failed:', error);
            this.core.emit('database:saved', { success: false, error });
            return null;
        }
    }

    loadCampaign(campaignId) {
        try {
            const saveData = localStorage.getItem(`${this.storagePrefix}campaign_${campaignId}`);
            
            if (!saveData) {
                throw new Error(`Campaign ${campaignId} not found`);
            }

            const campaignData = JSON.parse(saveData);
            this.campaignData = campaignData;
            
            this.core.emit('database:loaded', { campaignData, success: true });
            return campaignData;
        } catch (error) {
            console.error('❌ Load failed:', error);
            this.core.emit('database:loaded', { success: false, error });
            return null;
        }
    }

    getAllCampaigns() {
        const campaigns = [];
        const campaignListData = localStorage.getItem(`${this.storagePrefix}campaign_list`);
        
        if (campaignListData) {
            const campaignList = JSON.parse(campaignListData);
            for (const [id, name] of Object.entries(campaignList)) {
                try {
                    const saveData = localStorage.getItem(`${this.storagePrefix}campaign_${id}`);
                    if (saveData) {
                        const campaign = JSON.parse(saveData);
                        campaigns.push({
                            id,
                            name: campaign.name || name,
                            lastSaved: campaign.lastSaved,
                            version: campaign.version
                        });
                    }
                } catch (error) {
                    console.warn(`⚠️ Corrupted campaign data for ${id}:`, error);
                }
            }
        }

        return campaigns.sort((a, b) => new Date(b.lastSaved) - new Date(a.lastSaved));
    }

    deleteCampaign(campaignId) {
        try {
            localStorage.removeItem(`${this.storagePrefix}campaign_${campaignId}`);
            this.removeCampaignFromList(campaignId);
            this.core.emit('database:deleted', { campaignId, success: true });
        } catch (error) {
            console.error('❌ Delete failed:', error);
            this.core.emit('database:deleted', { success: false, error });
        }
    }

    updateCampaignList(campaignId, campaignName) {
        const campaignListData = localStorage.getItem(`${this.storagePrefix}campaign_list`);
        const campaignList = campaignListData ? JSON.parse(campaignListData) : {};
        
        campaignList[campaignId] = campaignName;
        localStorage.setItem(`${this.storagePrefix}campaign_list`, JSON.stringify(campaignList));
    }

    removeCampaignFromList(campaignId) {
        const campaignListData = localStorage.getItem(`${this.storagePrefix}campaign_list`);
        if (campaignListData) {
            const campaignList = JSON.parse(campaignListData);
            delete campaignList[campaignId];
            localStorage.setItem(`${this.storagePrefix}campaign_list`, JSON.stringify(campaignList));
        }
    }

    generateCampaignId() {
        return `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    exportCampaign(campaignId) {
        const campaignData = this.loadCampaign(campaignId);
        if (campaignData) {
            const dataStr = JSON.stringify(campaignData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportName = `${campaignData.name || 'campaign'}_${campaignId}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportName);
            linkElement.click();
        }
    }

    // ===== GENERIC DATA STORAGE METHODS =====
    // Added for compatibility with battle map repository and other modules

    /**
     * Generic load method for module data
     */
    load(key) {
        try {
            const data = localStorage.getItem(`${this.storagePrefix}${key}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`❌ Failed to load ${key}:`, error);
            return null;
        }
    }

    /**
     * Generic save method for module data
     */
    save(key, data) {
        try {
            localStorage.setItem(`${this.storagePrefix}${key}`, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error(`❌ Failed to save ${key}:`, error);
            return false;
        }
    }

    /**
     * Generic delete method for module data
     */
    delete(key) {
        try {
            localStorage.removeItem(`${this.storagePrefix}${key}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to delete ${key}:`, error);
            return false;
        }
    }

    /**
     * Check if key exists in storage
     */
    exists(key) {
        return localStorage.getItem(`${this.storagePrefix}${key}`) !== null;
    }

    /**
     * Get all keys matching a prefix
     */
    getKeys(prefix = '') {
        const keys = [];
        const fullPrefix = `${this.storagePrefix}${prefix}`;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(fullPrefix)) {
                keys.push(key.replace(this.storagePrefix, ''));
            }
        }
        
        return keys;
    }
}