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
        console.log('🎲 Initializing Taylor\'s Epic D&D Time...');
        
        const modules = [
            ['ui', '/js/ui.js'],
            ['database', '/js/database.js'],
            ['campaignManager', '/js/campaign-manager.js'],
            ['characterSheet', '/js/character-sheet.js'],
            ['inventorySystem', '/js/inventory-system.js'],
            ['worldDatabase', '/js/world-database.js'],
            ['worldBrowser', '/js/world-browser.js'],
            ['relationshipSystem', '/js/relationship-system.js'],
            ['relationshipUI', '/js/relationship-ui.js'],
            ['relationshipTestScenarios', '/js/relationship-test-scenarios.js'],
            ['monsterDatabase', '/js/monsters.js'],
            ['bestiaryInterface', '/js/bestiary-interface.js'],
            ['interactionHistory', '/js/interaction-history.js'],
            ['aiDMIntegration', '/js/ai-dm-integration.js'],
            ['aiDMInterface', '/js/ai-dm-interface.js'],
            ['autoSaveSystem', '/js/auto-save-system.js'],
            ['sessionContinuation', '/js/session-continuation.js'],
            ['voiceIntegration', '/js/voice-integration.js'],
            ['voiceTestSuite', '/js/voice-test-suite.js'],
            ['combatSystem', '/js/combat-system.js'],
            ['tacticalBattleMap', '/js/tactical-battle-map.js'],
            ['battleMapRepository', '/js/battle-map-repository.js'],
            ['sessionEncounter', '/js/session-encounter.js'],
            ['dmSceneParser', '/js/dm-scene-parser.js'],
            ['combatTestSuite', '/js/combat-test-suite.js'],
            ['choiceTrackingSystem', '/js/choice-tracking-system.js'],
            ['decisionTreeVisualizer', '/js/decision-tree-visualizer.js'],
            ['dynamicQuestSystem', '/js/dynamic-quest-system.js'],
            ['choiceConsequenceInterface', '/js/choice-consequence-interface.js'],
            ['restSystem', '/js/rest-system.js'],
            ['dynamicDialogueSystem', '/js/dynamic-dialogue-system.js'],
            ['githubIntegration', '/js/optimized-github-integration.js'],
            ['versionControl', '/js/version-control.js'],
            ['autoVersionBackup', '/js/auto-version-backup.js'],
            ['versionRestoreUI', '/js/version-restore-ui.js'],
            ['versionCommands', '/js/version-commands.js']
        ];
        
        let loadedCount = 0;
        let totalModules = modules.length;
        
        for (const [name, path] of modules) {
            console.log(`📦 Loading module: ${name} from ${path}`);
            
            try {
                await this.loadModule(name, path);
                loadedCount++;
                console.log(`✅ Successfully loaded: ${name}`);
            } catch (error) {
                console.error(`❌ Failed to load ${name}:`, error.message);
                // Continue loading other modules
            }
            
            // Emit progress for potential loading indicator
            this.emit('core:loading_progress', { 
                loaded: loadedCount, 
                total: totalModules,
                current: name
            });
            
            // Small delay to prevent UI blocking
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        console.log(`📦 Loaded ${this.modules.size}/${totalModules} modules successfully`);
        
        // Always try to show the main menu, even if some modules failed
        try {
            this.showMainMenu();
        } catch (error) {
            console.error('❌ Failed to show main menu:', error);
            // Fallback: show a basic interface
            this.showFallbackInterface();
        }
        
        this.emit('core:initialized');
        console.log('✅ Core initialization complete');
    }

    async loadModule(name, path) {
        try {
            const module = await import(path);
            const ModuleClass = module.default || module[Object.keys(module)[0]];
            
            if (!ModuleClass) {
                throw new Error(`No valid class found in module ${name}`);
            }
            
            this.modules.set(name, new ModuleClass(this));
            console.log(`📦 Loaded module: ${name}`);
        } catch (error) {
            console.error(`❌ Failed to load module ${name}:`, error);
            console.error(`   Error details: ${error.message}`);
            console.error(`   Stack trace: ${error.stack}`);
            
            // Don't throw - continue loading other modules
            console.warn(`⚠️ Continuing without module ${name}`);
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
        } else {
            console.warn('⚠️ UI module not available, showing fallback interface');
            this.showFallbackInterface();
        }
    }

    showFallbackInterface() {
        // Show basic interface if UI module failed to load
        const mainMenuScreen = document.getElementById('mainMenu-screen');
        if (mainMenuScreen) {
            mainMenuScreen.style.display = 'block';
            mainMenuScreen.classList.add('active');
            console.log('📺 Showing fallback main menu');
        } else {
            // Last resort: show error message
            document.body.innerHTML = `
                <div style="max-width: 600px; margin: 100px auto; padding: 40px; background: #1a1a1a; color: white; border-radius: 10px; text-align: center;">
                    <h1>🎲 D&D Voice Adventure</h1>
                    <p>The application loaded with some limitations due to module loading issues.</p>
                    <p>Please check the browser console for details or try running from a web server.</p>
                    <button onclick="location.reload()" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Reload</button>
                </div>
            `;
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