export default class AutoVersionBackup {
    constructor(core) {
        this.core = core;
        this.versionControl = null;
        this.lastBackupTime = 0;
        this.backupQueue = [];
        this.processing = false;
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.versionControl = this.core.getModule('versionControl');
            if (this.versionControl) {
                this.versionControl.enableAutoBackup();
                this.setupAutoBackupHooks();
                console.log('🔄 Auto-backup system initialized');
            }
        });
    }

    setupAutoBackupHooks() {
        const originalMethods = {
            fetch: window.fetch,
            XMLHttpRequest: window.XMLHttpRequest
        };

        this.interceptFileModifications();
        this.interceptDOMChanges();
        this.interceptModuleEvents();
    }

    interceptFileModifications() {
        const self = this;
        
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            if (method.toUpperCase() === 'PUT' || method.toUpperCase() === 'POST') {
                if (this.isProjectFile(url)) {
                    self.scheduleBackup(`File modification via XHR: ${url}`);
                }
            }
            return originalOpen.apply(this, [method, url, ...args]);
        };

        window.addEventListener('beforeunload', () => {
            if (this.hasUnsavedChanges()) {
                this.scheduleBackup('Session ending with unsaved changes');
            }
        });
    }

    interceptDOMChanges() {
        if (!document.querySelector('#version-backup-observer')) {
            const observer = new MutationObserver((mutations) => {
                let hasSignificantChanges = false;
                
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE && 
                                (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'LINK')) {
                                hasSignificantChanges = true;
                            }
                        });
                    } else if (mutation.type === 'attributes') {
                        if (['src', 'href', 'style'].includes(mutation.attributeName)) {
                            hasSignificantChanges = true;
                        }
                    }
                });
                
                if (hasSignificantChanges) {
                    this.scheduleBackup('DOM structure modified');
                }
            });

            observer.observe(document, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'href', 'style', 'class']
            });

            const observerMarker = document.createElement('div');
            observerMarker.id = 'version-backup-observer';
            observerMarker.style.display = 'none';
            document.body.appendChild(observerMarker);
        }
    }

    interceptModuleEvents() {
        this.core.on('ui:screen_changed', () => {
            this.scheduleBackup('UI screen transition');
        });

        this.core.on('database:save', () => {
            this.scheduleBackup('Database save operation');
        });

        this.core.on('character:updated', () => {
            this.scheduleBackup('Character data updated');
        });

        this.core.on('campaign:modified', () => {
            this.scheduleBackup('Campaign data modified');
        });

        this.core.on('github:sync', () => {
            this.scheduleBackup('GitHub synchronization');
        });
    }

    scheduleBackup(description) {
        const now = Date.now();
        
        if (now - this.lastBackupTime < 30000) {
            return;
        }

        this.backupQueue.push({
            description: description,
            timestamp: now
        });

        if (!this.processing) {
            this.processBackupQueue();
        }
    }

    async processBackupQueue() {
        if (this.processing || this.backupQueue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.backupQueue.length > 0) {
            const backupInfo = this.backupQueue.shift();
            
            try {
                if (this.versionControl) {
                    console.log(`🔄 Auto-creating backup: ${backupInfo.description}`);
                    await this.versionControl.createBackup(`[AUTO] ${backupInfo.description}`);
                    this.lastBackupTime = Date.now();
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error('Auto-backup failed:', error);
            }
        }

        this.processing = false;
    }

    isProjectFile(url) {
        const projectExtensions = ['.html', '.css', '.js', '.json'];
        return projectExtensions.some(ext => url.includes(ext)) && 
               !url.includes('node_modules') && 
               !url.includes('versions/');
    }

    hasUnsavedChanges() {
        return this.backupQueue.length > 0 || 
               (Date.now() - this.lastBackupTime) > 300000;
    }

    createManualBackup(description) {
        if (this.versionControl) {
            return this.versionControl.createBackup(`[MANUAL] ${description}`);
        }
        return Promise.reject(new Error('Version control not available'));
    }

    createPreChangeBackup() {
        return this.createManualBackup('Pre-change backup');
    }

    createPostChangeBackup(changeDescription) {
        return this.createManualBackup(`Post-change: ${changeDescription}`);
    }

    forceBackup(description = 'Forced backup') {
        this.lastBackupTime = 0;
        this.scheduleBackup(description);
    }
}