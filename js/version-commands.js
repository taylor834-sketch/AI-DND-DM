export default class VersionCommands {
    constructor(core) {
        this.core = core;
        this.versionControl = null;
        this.autoBackup = null;
        this.init();
    }

    init() {
        // DISABLED - Version commands should only be available during development
        /*
        this.core.on('core:initialized', () => {
            this.versionControl = this.core.getModule('versionControl');
            this.autoBackup = this.core.getModule('autoVersionBackup');
            this.setupGlobalCommands();
        });
        */
        console.log('💤 Version Commands disabled (only for development)');
    }

    setupGlobalCommands() {
        window.vc = {
            backup: (description = 'Manual backup') => this.createBackup(description),
            
            preChange: (description = 'Pre-change backup') => this.createPreChangeBackup(description),
            
            postChange: (description = 'Post-change backup') => this.createPostChangeBackup(description),
            
            restore: (version) => this.restoreVersion(version),
            
            list: () => this.listVersions(),
            
            help: () => this.showHelp(),
            
            auto: {
                on: () => this.enableAutoBackup(),
                off: () => this.disableAutoBackup(),
                force: (description = 'Forced backup') => this.forceBackup(description)
            }
        };

        console.log(`
🎲 Taylor's Epic D&D Time - Version Control Commands Available:

📦 BACKUP COMMANDS:
  vc.backup("description")     - Create manual backup with description  
  vc.preChange("description")  - Create pre-change backup
  vc.postChange("description") - Create post-change backup
  
🔄 RESTORE COMMANDS:
  vc.restore(3)               - Restore to version 3
  vc.list()                   - List all available versions
  
⚙️ AUTO-BACKUP COMMANDS:
  vc.auto.on()                - Enable automatic backups
  vc.auto.off()               - Disable automatic backups  
  vc.auto.force("desc")       - Force immediate backup
  
📋 HELP:
  vc.help()                   - Show this help menu

🎯 KEYBOARD SHORTCUTS:
  Ctrl+Shift+B                - Quick backup prompt
  Ctrl+Shift+V                - Show version control panel
  Ctrl+Shift+L                - List versions
  Ctrl+Shift+R                - Restore interface
        `);
    }

    async createBackup(description) {
        if (!this.versionControl) {
            console.error('Version control not available');
            return;
        }

        try {
            console.log(`🔄 Creating backup: ${description}`);
            const version = await this.versionControl.createBackup(description);
            console.log(`✅ Backup ${version} created successfully`);
            return version;
        } catch (error) {
            console.error('❌ Backup failed:', error.message);
            throw error;
        }
    }

    async createPreChangeBackup(description = 'Pre-change backup') {
        console.log('📝 Creating pre-change backup...');
        return await this.createBackup(`[PRE] ${description}`);
    }

    async createPostChangeBackup(description = 'Post-change backup') {
        console.log('📝 Creating post-change backup...');
        return await this.createBackup(`[POST] ${description}`);
    }

    async restoreVersion(version) {
        if (!this.versionControl) {
            console.error('Version control not available');
            return;
        }

        try {
            console.log(`🔄 Restoring to version ${version}...`);
            const success = await this.versionControl.restoreVersion(version);
            if (success) {
                console.log(`✅ Version ${version} restored successfully`);
            }
            return success;
        } catch (error) {
            console.error('❌ Restore failed:', error.message);
            throw error;
        }
    }

    listVersions() {
        if (!this.versionControl) {
            console.error('Version control not available');
            return [];
        }

        console.log('📋 Listing all versions...');
        return this.versionControl.listVersions();
    }

    enableAutoBackup() {
        if (this.autoBackup) {
            this.versionControl.enableAutoBackup();
            console.log('✅ Auto-backup enabled - backups will be created after every change');
        } else {
            console.error('Auto-backup system not available');
        }
    }

    disableAutoBackup() {
        if (this.autoBackup) {
            this.versionControl.disableAutoBackup();
            console.log('⏸️ Auto-backup disabled');
        } else {
            console.error('Auto-backup system not available');
        }
    }

    forceBackup(description = 'Forced backup') {
        if (this.autoBackup) {
            this.autoBackup.forceBackup(description);
            console.log(`🔄 Forced backup triggered: ${description}`);
        } else {
            console.error('Auto-backup system not available');
        }
    }

    showHelp() {
        console.log(`
🎲 TAYLOR'S EPIC D&D TIME - VERSION CONTROL SYSTEM

📦 BACKUP COMMANDS:
  vc.backup("Fixed button styling")           - Create manual backup
  vc.preChange("About to modify combat")      - Pre-change backup  
  vc.postChange("Combat system updated")      - Post-change backup

🔄 RESTORE COMMANDS:
  vc.restore(5)                              - Restore version 5
  vc.list()                                  - Show all versions

⚙️ AUTO-BACKUP:
  vc.auto.on()                               - Enable auto-backup
  vc.auto.off()                              - Disable auto-backup
  vc.auto.force("Emergency backup")          - Force immediate backup

🎯 KEYBOARD SHORTCUTS:
  Ctrl+Shift+B                               - Quick backup
  Ctrl+Shift+V                               - Version panel
  Ctrl+Shift+L                               - List versions  
  Ctrl+Shift+R                               - Restore UI

📝 USAGE EXAMPLES:
  
  Before making changes:
  > vc.preChange("About to update dice rolling")
  
  After making changes:  
  > vc.postChange("Updated dice rolling logic")
  
  Quick backup:
  > vc.backup("Fixed character sheet layout")
  
  View history:
  > vc.list()
  
  Restore if needed:
  > vc.restore(12)

💡 TIP: Auto-backup is enabled by default and creates backups automatically
    after every code change. Use vc.auto.off() to disable if needed.
        `);
    }
}