export default class VersionControl {
    constructor(core) {
        this.core = core;
        this.versionsPath = './versions/';
        this.currentVersion = 0;
        this.init();
    }

    init() {
        this.loadVersionHistory();
        this.core.on('version:backup', (event) => this.createBackup(event.detail.description));
        this.core.on('version:restore', (event) => this.restoreVersion(event.detail.version));
        this.core.on('version:list', () => this.listVersions());
    }

    async loadVersionHistory() {
        try {
            const response = await fetch('./versions/versions.json');
            if (response.ok) {
                const data = await response.json();
                this.currentVersion = data.currentVersion || 0;
                this.versions = data.versions || [];
            } else {
                this.currentVersion = 0;
                this.versions = [];
                await this.saveVersionHistory();
            }
        } catch (error) {
            console.log('No existing version history found, starting fresh');
            this.currentVersion = 0;
            this.versions = [];
            await this.saveVersionHistory();
        }
    }

    async saveVersionHistory() {
        const versionData = {
            currentVersion: this.currentVersion,
            lastUpdated: new Date().toISOString(),
            versions: this.versions
        };

        const blob = new Blob([JSON.stringify(versionData, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'versions.json';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Version history saved. Please save the downloaded versions.json to your versions folder.');
    }

    async createBackup(description = 'Backup created') {
        this.currentVersion++;
        const versionNumber = String(this.currentVersion).padStart(3, '0');
        const timestamp = new Date().toISOString();
        
        console.log(`Creating backup version ${versionNumber}: ${description}`);
        
        const filesToBackup = await this.getFilesToBackup();
        const backupData = {
            version: versionNumber,
            description: description,
            timestamp: timestamp,
            files: {}
        };

        for (const file of filesToBackup) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    backupData.files[file] = await response.text();
                    console.log(`✓ Backed up: ${file}`);
                }
            } catch (error) {
                console.warn(`Failed to backup ${file}:`, error);
            }
        }

        const versionInfo = {
            version: versionNumber,
            description: description,
            timestamp: timestamp,
            filesCount: Object.keys(backupData.files).length,
            files: Object.keys(backupData.files)
        };

        this.versions.push(versionInfo);
        await this.saveVersionHistory();

        const backupBlob = new Blob([JSON.stringify(backupData, null, 2)], {type: 'application/json'});
        const backupUrl = URL.createObjectURL(backupBlob);
        
        const a = document.createElement('a');
        a.href = backupUrl;
        a.download = `version-${versionNumber}-backup.json`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(backupUrl);

        this.core.emit('ui:notification', {
            type: 'success',
            message: `Backup ${versionNumber} created: ${description}`,
            duration: 3000
        });

        console.log(`Backup ${versionNumber} completed. Please save the downloaded backup file to versions/version-${versionNumber}/`);
        
        return versionNumber;
    }

    async getFilesToBackup() {
        return [
            './index.html',
            './test.html',
            './css/styles.css',
            './js/core.js',
            './js/ui.js',
            './js/database.js',
            './js/character.js',
            './js/combat.js',
            './js/relationships.js',
            './js/monsters.js',
            './js/github-integration.js',
            './js/version-control.js'
        ];
    }

    async restoreVersion(targetVersion) {
        const versionNumber = String(targetVersion).padStart(3, '0');
        const versionInfo = this.versions.find(v => v.version === versionNumber);
        
        if (!versionInfo) {
            this.core.emit('ui:notification', {
                type: 'error',
                message: `Version ${versionNumber} not found`
            });
            return false;
        }

        try {
            const response = await fetch(`./versions/version-${versionNumber}/version-${versionNumber}-backup.json`);
            if (!response.ok) {
                throw new Error('Backup file not found');
            }
            
            const backupData = await response.json();
            
            console.log(`Restoring version ${versionNumber}: ${versionInfo.description}`);
            
            for (const [fileName, content] of Object.entries(backupData.files)) {
                const blob = new Blob([content], {type: this.getContentType(fileName)});
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName.replace('./', '');
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`✓ Restored: ${fileName}`);
            }

            this.core.emit('ui:notification', {
                type: 'success',
                message: `Version ${versionNumber} restored. Please replace the downloaded files in your project.`,
                duration: 5000
            });

            console.log(`Restore complete. Please replace the files in your project directory with the downloaded files.`);
            return true;
            
        } catch (error) {
            console.error('Restore failed:', error);
            this.core.emit('ui:notification', {
                type: 'error',
                message: `Failed to restore version ${versionNumber}: ${error.message}`
            });
            return false;
        }
    }

    getContentType(fileName) {
        if (fileName.endsWith('.html')) return 'text/html';
        if (fileName.endsWith('.css')) return 'text/css';
        if (fileName.endsWith('.js')) return 'application/javascript';
        return 'text/plain';
    }

    listVersions() {
        console.log('=== VERSION HISTORY ===');
        if (this.versions.length === 0) {
            console.log('No versions found');
            return [];
        }

        this.versions.forEach(version => {
            const date = new Date(version.timestamp).toLocaleString();
            console.log(`Version ${version.version}: ${version.description} (${date}) - ${version.filesCount} files`);
        });

        this.core.emit('ui:notification', {
            type: 'info',
            message: `${this.versions.length} versions available. Check console for details.`
        });

        return this.versions;
    }

    async autoBackup(description) {
        if (this.autoBackupEnabled !== false) {
            return await this.createBackup(description);
        }
    }

    enableAutoBackup() {
        this.autoBackupEnabled = true;
        console.log('Auto-backup enabled - backups will be created after every code change');
    }

    disableAutoBackup() {
        this.autoBackupEnabled = false;
        console.log('Auto-backup disabled');
    }
}