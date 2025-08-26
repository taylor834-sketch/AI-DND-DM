export default class AutoSaveSystem {
    constructor(core) {
        this.core = core;
        this.campaignManager = null;
        this.interactionHistory = null;
        
        // Auto-save configuration
        this.autoSaveInterval = 5 * 60 * 1000; // 5 minutes
        this.autoSaveTimer = null;
        this.lastSaveTime = Date.now();
        this.isAutoSaveEnabled = true;
        
        // Track activity for save decisions
        this.activitySinceLastSave = false;
        this.lastActivityTime = Date.now();
        
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.campaignManager = this.core.getModule('campaignManager');
            this.interactionHistory = this.core.getModule('interactionHistory');
            
            this.startAutoSave();
            console.log('💾 Auto-Save System initialized');
        });

        // Listen for activity that should trigger saves
        this.core.on('player:action', () => {
            this.recordActivity();
        });

        this.core.on('ai:response', () => {
            this.recordActivity();
        });

        this.core.on('relationship:changed', () => {
            this.recordActivity();
        });

        this.core.on('quest:updated', () => {
            this.recordActivity();
        });

        this.core.on('location:changed', () => {
            this.recordActivity();
        });

        // Listen for manual save requests
        this.core.on('game:save', () => {
            this.performManualSave();
        });

        this.core.on('game:exit', () => {
            this.performExitSave();
        });

        // Prevent data loss on page unload
        window.addEventListener('beforeunload', (event) => {
            if (this.activitySinceLastSave) {
                this.performQuickSave();
                
                // Show confirmation dialog
                event.preventDefault();
                event.returnValue = 'You have unsaved progress. Are you sure you want to leave?';
                return event.returnValue;
            }
        });
    }

    /**
     * Record activity that should trigger saves
     */
    recordActivity() {
        this.activitySinceLastSave = true;
        this.lastActivityTime = Date.now();
        
        // Update UI to show unsaved changes
        this.updateSaveStatus('unsaved');
    }

    /**
     * Start the auto-save timer
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(() => {
            this.performAutoSave();
        }, this.autoSaveInterval);

        console.log(`⏰ Auto-save started: every ${this.autoSaveInterval / 60000} minutes`);
    }

    /**
     * Stop the auto-save timer
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
            console.log('⏹️ Auto-save stopped');
        }
    }

    /**
     * Perform auto-save if there's been activity
     */
    async performAutoSave() {
        if (!this.isAutoSaveEnabled || !this.campaignManager) {
            return;
        }

        // Only save if there's been activity since last save
        if (!this.activitySinceLastSave) {
            return;
        }

        // Don't save if there was recent activity (wait for user to finish their action)
        const timeSinceActivity = Date.now() - this.lastActivityTime;
        if (timeSinceActivity < 10000) { // Wait 10 seconds after last activity
            return;
        }

        try {
            console.log('💾 Performing auto-save...');
            this.updateSaveStatus('saving');

            // Use the campaign manager's save with recap function
            const recap = await this.campaignManager.saveSessionWithRecap();
            
            this.lastSaveTime = Date.now();
            this.activitySinceLastSave = false;
            
            this.updateSaveStatus('saved');
            
            // Show subtle notification
            this.showSaveNotification('Auto-saved', 'success');
            
            console.log('✅ Auto-save completed successfully');
            return recap;
            
        } catch (error) {
            console.error('❌ Auto-save failed:', error);
            this.updateSaveStatus('error');
            this.showSaveNotification('Auto-save failed', 'error');
        }
    }

    /**
     * Perform manual save (from save button)
     */
    async performManualSave() {
        if (!this.campaignManager) {
            console.warn('Campaign manager not available for manual save');
            return null;
        }

        try {
            console.log('💾 Performing manual save...');
            this.updateSaveStatus('saving');

            const recap = await this.campaignManager.saveSessionWithRecap();
            
            this.lastSaveTime = Date.now();
            this.activitySinceLastSave = false;
            
            this.updateSaveStatus('saved');
            this.showSaveNotification('Game saved successfully', 'success');
            
            console.log('✅ Manual save completed successfully');
            return recap;
            
        } catch (error) {
            console.error('❌ Manual save failed:', error);
            this.updateSaveStatus('error');
            this.showSaveNotification('Save failed: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Perform save when exiting to main menu
     */
    async performExitSave() {
        console.log('📤 Performing exit save...');
        
        try {
            const recap = await this.performManualSave();
            
            // Emit event that save is complete and ready to exit
            this.core.emit('save:complete', { recap, action: 'exit' });
            
            return recap;
            
        } catch (error) {
            console.error('❌ Exit save failed:', error);
            // Still allow exit even if save failed, but warn user
            this.core.emit('save:failed', { error, action: 'exit' });
            throw error;
        }
    }

    /**
     * Perform quick save (for page unload)
     */
    performQuickSave() {
        if (!this.campaignManager || !this.activitySinceLastSave) {
            return;
        }

        try {
            // Use synchronous save for page unload
            this.campaignManager.saveCampaign(this.campaignManager.activeCampaign);
            console.log('⚡ Quick save completed');
        } catch (error) {
            console.error('❌ Quick save failed:', error);
        }
    }

    /**
     * Update save status in UI
     */
    updateSaveStatus(status) {
        const statusElement = document.getElementById('save-status');
        if (statusElement) {
            statusElement.className = `save-status ${status}`;
            
            const statusText = {
                unsaved: '● Unsaved changes',
                saving: '⏳ Saving...',
                saved: '✓ Saved',
                error: '⚠ Save error'
            };
            
            statusElement.textContent = statusText[status] || '';
        }

        // Emit event for other systems
        this.core.emit('save:status', { status, timestamp: Date.now() });
    }

    /**
     * Show save notification
     */
    showSaveNotification(message, type = 'info') {
        const ui = this.core.getModule('ui');
        if (ui) {
            ui.showNotification(message, type);
        }
    }

    /**
     * Create save status UI element
     */
    createSaveStatusUI() {
        // Add save status indicator to the UI
        const saveStatusHTML = `
            <div id="save-status" class="save-status saved">✓ Saved</div>
            <style>
                .save-status {
                    position: fixed;
                    top: 10px;
                    right: 20px;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    z-index: 1000;
                    transition: all 0.3s ease;
                }
                
                .save-status.saved {
                    background: var(--color-success);
                    color: white;
                    opacity: 0.7;
                }
                
                .save-status.unsaved {
                    background: var(--color-warning);
                    color: var(--color-text-dark);
                    opacity: 1;
                }
                
                .save-status.saving {
                    background: var(--color-info);
                    color: white;
                    opacity: 1;
                }
                
                .save-status.error {
                    background: var(--color-error);
                    color: white;
                    opacity: 1;
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', saveStatusHTML);
    }

    /**
     * Get time since last save
     */
    getTimeSinceLastSave() {
        return Date.now() - this.lastSaveTime;
    }

    /**
     * Enable/disable auto-save
     */
    setAutoSaveEnabled(enabled) {
        this.isAutoSaveEnabled = enabled;
        
        if (enabled) {
            this.startAutoSave();
        } else {
            this.stopAutoSave();
        }
        
        console.log(`Auto-save ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set auto-save interval
     */
    setAutoSaveInterval(minutes) {
        this.autoSaveInterval = minutes * 60 * 1000;
        
        if (this.isAutoSaveEnabled) {
            this.startAutoSave(); // Restart with new interval
        }
        
        console.log(`Auto-save interval set to ${minutes} minutes`);
    }

    /**
     * Force save now
     */
    async saveNow() {
        return await this.performManualSave();
    }

    // ===== PUBLIC API =====

    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges() {
        return this.activitySinceLastSave;
    }

    /**
     * Get save status
     */
    getSaveStatus() {
        return {
            hasUnsavedChanges: this.activitySinceLastSave,
            lastSaveTime: this.lastSaveTime,
            timeSinceLastSave: this.getTimeSinceLastSave(),
            autoSaveEnabled: this.isAutoSaveEnabled,
            autoSaveInterval: this.autoSaveInterval
        };
    }
}