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
        // First try to load from localStorage
        try {
            const localData = localStorage.getItem('dnd_voice_version_history');
            if (localData) {
                const data = JSON.parse(localData);
                this.currentVersion = data.currentVersion || 0;
                this.versions = data.versions || [];
                console.log(`📁 Loaded ${this.versions.length} versions from localStorage`);
                return;
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }

        // Fallback: try to load from file
        try {
            const response = await fetch('./versions/versions.json');
            if (response.ok) {
                const data = await response.json();
                this.currentVersion = data.currentVersion || 0;
                this.versions = data.versions || [];
                console.log(`📁 Loaded ${this.versions.length} versions from file`);
                
                // Save to localStorage for future use
                try {
                    localStorage.setItem('dnd_voice_version_history', JSON.stringify(data));
                } catch (e) {
                    console.warn('Could not save to localStorage');
                }
                return;
            }
        } catch (error) {
            console.log('Could not load from file, checking for existing version-001');
        }

        // Check if version-001 exists and initialize from it
        try {
            const version001Response = await fetch('./versions/version-001/VERSION_INFO.md');
            if (version001Response.ok) {
                console.log('🎯 Found existing version-001, initializing version history');
                this.currentVersion = 1;
                this.versions = [{
                    version: "001",
                    description: "Initial complete project backup before character sheet navigation fix",
                    timestamp: "2025-08-26T19:55:00.000Z",
                    filesCount: 50,
                    files: [
                        "index.html", "test.html", "version-control-test.html",
                        "css/styles.css", "js/core.js", "js/character-sheet.js",
                        "js/version-control.js", "README.md", "CLAUDE.md"
                    ],
                    type: "manual",
                    location: "./versions/version-001/"
                }];
                await this.saveVersionHistory();
                return;
            }
        } catch (error) {
            console.log('No version-001 found either');
        }

        // Start completely fresh
        console.log('🆕 Starting fresh version history');
        this.currentVersion = 0;
        this.versions = [];
        await this.saveVersionHistory();
    }

    async saveVersionHistory() {
        const versionData = {
            currentVersion: this.currentVersion,
            lastUpdated: new Date().toISOString(),
            versions: this.versions
        };

        try {
            // Try to save to localStorage as backup
            localStorage.setItem('dnd_voice_version_history', JSON.stringify(versionData));
            console.log('Version history saved to localStorage');
        } catch (error) {
            console.warn('Failed to save version history to localStorage:', error);
        }

        // Also offer download as backup
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

        console.log('Version history saved. Downloaded versions.json - please save to your versions folder.');
    }

    async createBackup(description = 'Backup created') {
        this.currentVersion++;
        const versionNumber = String(this.currentVersion).padStart(3, '0');
        const timestamp = new Date().toISOString();
        
        console.log(`🔄 Creating backup version ${versionNumber}: ${description}`);
        
        const filesToBackup = await this.getFilesToBackup();
        const backupData = {
            version: versionNumber,
            description: description,
            timestamp: timestamp,
            files: {}
        };

        // Collect all file contents
        for (const file of filesToBackup) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    backupData.files[file] = await response.text();
                    console.log(`✓ Backed up: ${file}`);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to backup ${file}:`, error);
            }
        }

        const versionInfo = {
            version: versionNumber,
            description: description,
            timestamp: timestamp,
            filesCount: Object.keys(backupData.files).length,
            files: Object.keys(backupData.files),
            type: 'auto',
            location: `./versions/version-${versionNumber}/`
        };

        this.versions.push(versionInfo);
        await this.saveVersionHistory();

        // Create individual file downloads and instructions
        this.downloadAllBackupFiles(versionNumber, backupData);

        this.core.emit('ui:notification', {
            type: 'success',
            message: `Backup ${versionNumber} created - files downloading`,
            duration: 5000
        });

        console.log(`
📦 BACKUP ${versionNumber} COMPLETED!

📋 INSTRUCTIONS:
1. Create folder: versions/version-${versionNumber}/
2. Move all downloaded files to that folder
3. Files downloaded: ${Object.keys(backupData.files).length}

✅ Backup: ${description}
        `);
        
        return versionNumber;
    }

    downloadAllBackupFiles(versionNumber, backupData) {
        // Download individual files with proper names and folder structure
        Object.entries(backupData.files).forEach(([filePath, content], index) => {
            setTimeout(() => {
                const fileName = filePath.replace('./', '').replace('/', '-');
                const blob = new Blob([content], { 
                    type: this.getContentType(filePath) 
                });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `version-${versionNumber}-${fileName}`;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log(`📥 Downloaded: version-${versionNumber}-${fileName}`);
            }, index * 200); // Stagger downloads to avoid browser blocking
        });

        // Create a README for this version
        setTimeout(() => {
            const readme = `# Version ${versionNumber} Backup

**Created:** ${new Date().toLocaleString()}
**Description:** ${backupData.description}
**Files Count:** ${Object.keys(backupData.files).length}

## Files in this backup:
${Object.keys(backupData.files).map(file => `- ${file}`).join('\n')}

## Instructions:
1. Create folder: versions/version-${versionNumber}/
2. Move all downloaded version-${versionNumber}-* files to that folder
3. Remove the "version-${versionNumber}-" prefix from each file name
4. Your backup is complete!

## To restore this version:
Use the console command: \`vc.restore(${parseInt(versionNumber)})\`
`;
            
            const readmeBlob = new Blob([readme], { type: 'text/markdown' });
            const readmeUrl = URL.createObjectURL(readmeBlob);
            
            const a = document.createElement('a');
            a.href = readmeUrl;
            a.download = `version-${versionNumber}-README.md`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(readmeUrl);
            
            console.log(`📖 Downloaded: version-${versionNumber}-README.md`);
        }, Object.keys(backupData.files).length * 200 + 500);
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