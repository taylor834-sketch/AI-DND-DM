export default class VersionRestoreUI {
    constructor(core) {
        this.core = core;
        this.versionControl = null;
        this.init();
    }

    init() {
        // DISABLED - Version UI should only appear during development
        // Don't create UI on game startup
        /*
        this.core.on('core:initialized', () => {
            this.versionControl = this.core.getModule('versionControl');
            this.setupUI();
        });
        */

        // Still allow manual triggering if needed for development
        this.core.on('version:show_restore_ui', () => {
            this.versionControl = this.core.getModule('versionControl');
            this.showRestoreInterface();
        });
        
        console.log('💤 Version Restore UI disabled (only for development)');
    }

    setupUI() {
        this.createVersionControlPanel();
        this.addVersionControlCommands();
    }

    createVersionControlPanel() {
        const existingPanel = document.getElementById('version-control-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'version-control-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            border: 2px solid #8B4513;
            font-family: 'Cinzel', serif;
            max-width: 300px;
            z-index: 10000;
            display: none;
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #DAA520;">Version Control</h3>
                <button id="close-version-panel" style="background: none; border: none; color: #DAA520; cursor: pointer; font-size: 20px;">×</button>
            </div>
            <div id="version-controls">
                <button id="create-backup-btn" class="version-btn">Create Backup</button>
                <button id="list-versions-btn" class="version-btn">List Versions</button>
                <button id="show-restore-btn" class="version-btn">Restore Version</button>
                <button id="toggle-auto-backup-btn" class="version-btn">Toggle Auto-Backup</button>
            </div>
            <div id="version-list" style="margin-top: 15px; max-height: 200px; overflow-y: auto; display: none;">
                <h4 style="margin: 10px 0 5px 0; color: #DAA520;">Available Versions:</h4>
                <div id="versions-container"></div>
            </div>
            <div id="restore-interface" style="margin-top: 15px; display: none;">
                <h4 style="margin: 10px 0 5px 0; color: #DAA520;">Restore Version:</h4>
                <input type="text" id="restore-version-input" placeholder="Enter version (e.g., 003)" 
                       style="width: 100%; padding: 5px; margin-bottom: 10px; background: #333; color: white; border: 1px solid #8B4513; border-radius: 3px;">
                <button id="restore-version-btn" class="version-btn">Restore</button>
                <button id="cancel-restore-btn" class="version-btn" style="background: #8B0000;">Cancel</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .version-btn {
                background: #8B4513;
                color: white;
                border: none;
                padding: 8px 12px;
                margin: 3px;
                border-radius: 5px;
                cursor: pointer;
                font-family: 'Cinzel', serif;
                font-size: 12px;
                transition: background-color 0.3s;
            }
            .version-btn:hover {
                background: #A0522D;
            }
            .version-item {
                background: #333;
                padding: 8px;
                margin: 5px 0;
                border-radius: 5px;
                border-left: 3px solid #DAA520;
                cursor: pointer;
                font-size: 11px;
                transition: background-color 0.3s;
            }
            .version-item:hover {
                background: #444;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        this.attachEventListeners();
    }

    attachEventListeners() {
        document.getElementById('close-version-panel').addEventListener('click', () => {
            this.hideVersionPanel();
        });

        document.getElementById('create-backup-btn').addEventListener('click', () => {
            this.promptForBackup();
        });

        document.getElementById('list-versions-btn').addEventListener('click', () => {
            this.showVersionList();
        });

        document.getElementById('show-restore-btn').addEventListener('click', () => {
            this.showRestoreInterface();
        });

        document.getElementById('toggle-auto-backup-btn').addEventListener('click', () => {
            this.toggleAutoBackup();
        });

        document.getElementById('restore-version-btn').addEventListener('click', () => {
            this.restoreSelectedVersion();
        });

        document.getElementById('cancel-restore-btn').addEventListener('click', () => {
            this.hideRestoreInterface();
        });
    }

    addVersionControlCommands() {
        const commandMap = {
            'Ctrl+Shift+B': () => this.promptForBackup(),
            'Ctrl+Shift+V': () => this.showVersionPanel(),
            'Ctrl+Shift+L': () => this.showVersionList(),
            'Ctrl+Shift+R': () => this.showRestoreInterface()
        };

        document.addEventListener('keydown', (e) => {
            const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.code.replace('Key', '')}`;
            if (commandMap[key]) {
                e.preventDefault();
                commandMap[key]();
            }
        });

        window.versionControl = {
            createBackup: (description) => this.createBackup(description),
            listVersions: () => this.showVersionList(),
            restoreVersion: (version) => this.restoreVersion(version),
            showPanel: () => this.showVersionPanel()
        };
    }

    showVersionPanel() {
        document.getElementById('version-control-panel').style.display = 'block';
    }

    hideVersionPanel() {
        document.getElementById('version-control-panel').style.display = 'none';
    }

    async promptForBackup() {
        const description = prompt('Enter backup description:', 'Manual backup');
        if (description) {
            await this.createBackup(description);
        }
    }

    async createBackup(description) {
        if (this.versionControl) {
            try {
                const version = await this.versionControl.createBackup(description);
                this.core.emit('ui:notification', {
                    type: 'success',
                    message: `Backup ${version} created successfully`
                });
            } catch (error) {
                this.core.emit('ui:notification', {
                    type: 'error',
                    message: `Backup failed: ${error.message}`
                });
            }
        }
    }

    async showVersionList() {
        if (!this.versionControl) return;

        const versionList = document.getElementById('version-list');
        const versionsContainer = document.getElementById('versions-container');
        
        const versions = this.versionControl.listVersions();
        
        versionsContainer.innerHTML = '';
        
        if (versions.length === 0) {
            versionsContainer.innerHTML = '<p style="color: #888;">No versions found</p>';
        } else {
            versions.reverse().forEach(version => {
                const versionItem = document.createElement('div');
                versionItem.className = 'version-item';
                versionItem.innerHTML = `
                    <div style="font-weight: bold; color: #DAA520;">Version ${version.version}</div>
                    <div style="font-size: 10px; color: #ccc;">${new Date(version.timestamp).toLocaleString()}</div>
                    <div style="font-size: 10px; margin-top: 3px;">${version.description}</div>
                    <div style="font-size: 9px; color: #888;">${version.filesCount} files</div>
                `;
                versionItem.addEventListener('click', () => {
                    document.getElementById('restore-version-input').value = version.version;
                    this.showRestoreInterface();
                });
                versionsContainer.appendChild(versionItem);
            });
        }
        
        versionList.style.display = 'block';
        document.getElementById('restore-interface').style.display = 'none';
    }

    showRestoreInterface() {
        document.getElementById('version-list').style.display = 'none';
        document.getElementById('restore-interface').style.display = 'block';
        document.getElementById('restore-version-input').focus();
    }

    hideRestoreInterface() {
        document.getElementById('restore-interface').style.display = 'none';
    }

    async restoreSelectedVersion() {
        const versionInput = document.getElementById('restore-version-input');
        const version = versionInput.value.trim();
        
        if (!version) {
            this.core.emit('ui:notification', {
                type: 'error',
                message: 'Please enter a version number'
            });
            return;
        }

        if (confirm(`Are you sure you want to restore to version ${version}? This will download the backup files.`)) {
            await this.restoreVersion(version);
        }
    }

    async restoreVersion(version) {
        if (this.versionControl) {
            try {
                const success = await this.versionControl.restoreVersion(parseInt(version));
                if (success) {
                    this.hideRestoreInterface();
                }
            } catch (error) {
                this.core.emit('ui:notification', {
                    type: 'error',
                    message: `Restore failed: ${error.message}`
                });
            }
        }
    }

    toggleAutoBackup() {
        const autoBackup = this.core.getModule('autoVersionBackup');
        if (autoBackup) {
            if (this.versionControl.autoBackupEnabled !== false) {
                this.versionControl.disableAutoBackup();
                this.core.emit('ui:notification', {
                    type: 'info',
                    message: 'Auto-backup disabled'
                });
            } else {
                this.versionControl.enableAutoBackup();
                this.core.emit('ui:notification', {
                    type: 'info',
                    message: 'Auto-backup enabled'
                });
            }
        }
    }
}