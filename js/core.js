class DNDVoiceCore {
    constructor() {
        this.modules = new Map();
        this.eventBus = new EventTarget();
        this.config = {
            debug: true,
            version: '1.0.0',
            enableGitHubSync: true,
            enableVoice: false,
            theme: 'dark'
        };
        this.appState = {
            currentScreen: 'mainMenu',
            user: null,
            campaign: null,
            character: null
        };
    }

    async init() {
        try {
            console.log('🎲 Initializing D&D Voice Adventure...');
            
            await this.loadModule('ui', './js/ui.js');
            await this.loadModule('database', './js/database.js');
            
            this.emit('core:initialized');
            this.showMainMenu();
            
            console.log('✅ Core initialization complete');
        } catch (error) {
            console.error('❌ Core initialization failed:', error);
            this.handleCriticalError(error);
        }
    }

    async loadModule(name, path) {
        try {
            const module = await import(path);
            const ModuleClass = module.default || module[Object.keys(module)[0]];
            this.modules.set(name, new ModuleClass(this));
            console.log(`📦 Loaded module: ${name}`);
        } catch (error) {
            console.error(`❌ Failed to load module ${name}:`, error);
            throw error;
        }
    }

    getModule(name) {
        return this.modules.get(name);
    }

    emit(eventName, data = {}) {
        this.eventBus.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }

    on(eventName, callback) {
        this.eventBus.addEventListener(eventName, callback);
    }

    off(eventName, callback) {
        this.eventBus.removeEventListener(eventName, callback);
    }

    updateState(newState) {
        this.appState = { ...this.appState, ...newState };
        this.emit('state:updated', this.appState);
    }

    showMainMenu() {
        const ui = this.getModule('ui');
        if (ui) {
            ui.showScreen('mainMenu');
        }
    }

    handleCriticalError(error) {
        const errorContainer = document.getElementById('error-container') || document.body;
        errorContainer.innerHTML = `
            <div class="critical-error">
                <h2>⚠️ Critical Error</h2>
                <p>The application encountered a critical error and cannot continue.</p>
                <details>
                    <summary>Error Details</summary>
                    <pre>${error.stack || error.message}</pre>
                </details>
                <button onclick="location.reload()">Reload Application</button>
            </div>
        `;
    }
}

window.DNDCore = new DNDVoiceCore();