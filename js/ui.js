export default class UIManager {
    constructor(core) {
        this.core = core;
        this.currentScreen = null;
        this.screenElements = new Map();
        this.init();
    }

    init() {
        this.core.on('ui:showScreen', (event) => this.showScreen(event.detail.screen));
        this.core.on('ui:hideScreen', (event) => this.hideScreen(event.detail.screen));
        this.setupMainMenuHandlers();
    }

    showScreen(screenName) {
        this.hideAllScreens();
        
        const screenElement = document.getElementById(`${screenName}-screen`);
        if (screenElement) {
            screenElement.style.display = 'block';
            screenElement.classList.add('active');
            this.currentScreen = screenName;
            this.core.updateState({ currentScreen: screenName });
            
            // Emit event for other modules to react to screen changes
            this.core.emit('ui:screenShown', { screen: screenName });
            
            console.log(`📺 Showing screen: ${screenName}`);
        } else {
            console.warn(`⚠️ Screen not found: ${screenName}`);
        }
    }

    hideScreen(screenName) {
        const screenElement = document.getElementById(`${screenName}-screen`);
        if (screenElement) {
            screenElement.style.display = 'none';
            screenElement.classList.remove('active');
        }
    }

    hideAllScreens() {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.style.display = 'none';
            screen.classList.remove('active');
        });
    }

    setupMainMenuHandlers() {
        // Check if DOM is already loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindButtonEvents();
            });
        } else {
            // DOM is already loaded, bind events immediately
            this.bindButtonEvents();
        }
    }

    bindButtonEvents() {
        const buttons = {
            'create-campaign-btn': () => this.handleCreateCampaign(),
            'continue-campaign-btn': () => this.handleContinueCampaign(),
            'load-github-btn': () => this.handleLoadFromGitHub(),
            'world-browser-btn': () => this.handleWorldBrowser(),
            'settings-btn': () => this.handleSettings()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
                button.addEventListener('mouseenter', this.playHoverSound.bind(this));
            }
        });
    }

    handleCreateCampaign() {
        console.log('🆕 Creating new campaign...');
        this.showScreen('campaignCreation');
    }

    handleContinueCampaign() {
        console.log('▶️ Loading continue campaign screen...');
        this.showCampaignList();
    }

    handleLoadFromGitHub() {
        console.log('📁 Loading from GitHub...');
        this.core.emit('github:loadCampaigns');
        this.showNotification('Connecting to GitHub...', 'info');
    }

    handleWorldBrowser() {
        console.log('🌍 Opening world browser...');
        this.showScreen('worldBrowser');
    }

    handleSettings() {
        console.log('⚙️ Opening settings...');
        this.showScreen('settings');
    }

    showCampaignList() {
        const database = this.core.getModule('database');
        const campaigns = database.getAllCampaigns();
        
        const campaignListHtml = campaigns.length > 0 
            ? campaigns.map(campaign => `
                <div class="campaign-item" data-campaign-id="${campaign.id}">
                    <div class="campaign-info">
                        <h3>${campaign.name}</h3>
                        <p>Last played: ${new Date(campaign.lastSaved).toLocaleDateString()}</p>
                    </div>
                    <div class="campaign-actions">
                        <button class="load-btn" data-campaign-id="${campaign.id}">Load</button>
                        <button class="delete-btn" data-campaign-id="${campaign.id}">Delete</button>
                    </div>
                </div>
            `).join('')
            : '<p class="no-campaigns">No campaigns found. Create your first adventure!</p>';

        const campaignScreen = document.getElementById('campaign-list-screen');
        if (!campaignScreen) {
            this.createCampaignListScreen(campaignListHtml);
        } else {
            campaignScreen.querySelector('.campaign-list').innerHTML = campaignListHtml;
        }
        
        this.showScreen('campaign-list');
        this.bindCampaignListEvents();
    }

    createCampaignListScreen(campaignListHtml) {
        const campaignScreen = document.createElement('div');
        campaignScreen.id = 'campaign-list-screen';
        campaignScreen.className = 'screen';
        campaignScreen.innerHTML = `
            <div class="campaign-list-container">
                <h2>Select Campaign</h2>
                <div class="campaign-list">${campaignListHtml}</div>
                <button id="back-to-menu-btn" class="back-btn">Back to Main Menu</button>
            </div>
        `;
        
        document.getElementById('app').appendChild(campaignScreen);
        
        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });
    }

    bindCampaignListEvents() {
        document.querySelectorAll('.load-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const campaignId = e.target.dataset.campaignId;
                this.loadCampaign(campaignId);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const campaignId = e.target.dataset.campaignId;
                this.deleteCampaign(campaignId);
            });
        });
    }

    loadCampaign(campaignId) {
        const database = this.core.getModule('database');
        database.loadCampaign(campaignId);
        this.showNotification('Loading campaign...', 'info');
    }

    deleteCampaign(campaignId) {
        if (confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
            const database = this.core.getModule('database');
            database.deleteCampaign(campaignId);
            this.showCampaignList();
            this.showNotification('Campaign deleted', 'success');
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    playHoverSound() {
        if (this.core.config.enableAudio) {
            console.log('🔊 Playing hover sound');
        }
    }
}