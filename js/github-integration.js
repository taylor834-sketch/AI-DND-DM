export default class GitHubIntegration {
    constructor(core) {
        this.core = core;
        this.githubToken = null;
        this.repository = null;
        this.username = null;
        this.baseApiUrl = 'https://api.github.com';
        this.init();
    }

    init() {
        this.core.on('github:authenticate', (event) => this.authenticate(event.detail));
        this.core.on('github:saveCampaign', (event) => this.saveCampaignToGitHub(event.detail));
        this.core.on('github:loadCampaign', (event) => this.loadCampaignFromGitHub(event.detail));
        this.core.on('github:listCampaigns', (event) => this.listGitHubCampaigns());
        this.core.on('github:createRepository', (event) => this.createCampaignRepository(event.detail));
        
        this.loadStoredCredentials();
    }

    loadStoredCredentials() {
        const storedToken = localStorage.getItem('dnd_voice_github_token');
        const storedRepo = localStorage.getItem('dnd_voice_github_repo');
        const storedUsername = localStorage.getItem('dnd_voice_github_username');
        
        if (storedToken && storedRepo && storedUsername) {
            this.githubToken = storedToken;
            this.repository = storedRepo;
            this.username = storedUsername;
            
            console.log('📁 GitHub credentials loaded from storage');
            this.core.emit('github:authenticated', { 
                username: this.username, 
                repository: this.repository,
                success: true 
            });
        }
    }

    async authenticate(authData) {
        const { token, repository, username } = authData;
        
        try {
            if (token && repository && username) {
                const isValid = await this.validateToken(token, username);
                
                if (isValid) {
                    this.githubToken = token;
                    this.repository = repository;
                    this.username = username;
                    
                    localStorage.setItem('dnd_voice_github_token', token);
                    localStorage.setItem('dnd_voice_github_repo', repository);
                    localStorage.setItem('dnd_voice_github_username', username);
                    
                    this.core.emit('github:authenticated', { 
                        username, 
                        repository, 
                        success: true 
                    });
                    
                    console.log(`✅ Authenticated with GitHub as ${username}`);
                    return true;
                } else {
                    throw new Error('Invalid GitHub token or username');
                }
            } else {
                throw new Error('Missing authentication data');
            }
        } catch (error) {
            console.error('❌ GitHub authentication failed:', error);
            this.core.emit('github:authenticated', { success: false, error: error.message });
            return false;
        }
    }

    async validateToken(token, username) {
        try {
            const response = await fetch(`${this.baseApiUrl}/user`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                return userData.login === username;
            }
            return false;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    async saveCampaignToGitHub(campaignData) {
        if (!this.isAuthenticated()) {
            this.core.emit('github:saved', { 
                success: false, 
                error: 'Not authenticated with GitHub' 
            });
            return false;
        }

        try {
            const fileName = `campaigns/${campaignData.id || 'campaign'}.json`;
            const content = JSON.stringify(campaignData, null, 2);
            const encodedContent = btoa(unescape(encodeURIComponent(content)));
            
            const existingFile = await this.getFileFromGitHub(fileName);
            const isUpdate = existingFile !== null;
            
            const requestBody = {
                message: isUpdate ? 
                    `Update campaign: ${campaignData.name || 'Untitled'}` : 
                    `Add campaign: ${campaignData.name || 'Untitled'}`,
                content: encodedContent,
                branch: 'main'
            };
            
            if (isUpdate && existingFile.sha) {
                requestBody.sha = existingFile.sha;
            }
            
            const response = await fetch(
                `${this.baseApiUrl}/repos/${this.username}/${this.repository}/contents/${fileName}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }
            );
            
            if (response.ok) {
                const result = await response.json();
                this.core.emit('github:saved', { 
                    campaignId: campaignData.id,
                    fileName,
                    url: result.content.html_url,
                    success: true 
                });
                
                console.log(`☁️ Campaign saved to GitHub: ${fileName}`);
                return true;
            } else {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to save campaign to GitHub:', error);
            this.core.emit('github:saved', { success: false, error: error.message });
            return false;
        }
    }

    async loadCampaignFromGitHub(loadData) {
        if (!this.isAuthenticated()) {
            this.core.emit('github:loaded', { 
                success: false, 
                error: 'Not authenticated with GitHub' 
            });
            return null;
        }

        try {
            const { fileName, campaignId } = loadData;
            const targetFile = fileName || `campaigns/${campaignId}.json`;
            
            const fileData = await this.getFileFromGitHub(targetFile);
            
            if (fileData) {
                const content = atob(fileData.content);
                const campaignData = JSON.parse(content);
                
                this.core.emit('github:loaded', { 
                    campaignData,
                    fileName: targetFile,
                    success: true 
                });
                
                console.log(`📥 Campaign loaded from GitHub: ${targetFile}`);
                return campaignData;
            } else {
                throw new Error(`Campaign file not found: ${targetFile}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to load campaign from GitHub:', error);
            this.core.emit('github:loaded', { success: false, error: error.message });
            return null;
        }
    }

    async listGitHubCampaigns() {
        if (!this.isAuthenticated()) {
            this.core.emit('github:campaignsList', { 
                success: false, 
                error: 'Not authenticated with GitHub' 
            });
            return [];
        }

        try {
            const response = await fetch(
                `${this.baseApiUrl}/repos/${this.username}/${this.repository}/contents/campaigns`,
                {
                    headers: {
                        'Authorization': `token ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (response.ok) {
                const files = await response.json();
                const campaigns = files
                    .filter(file => file.name.endsWith('.json') && file.type === 'file')
                    .map(file => ({
                        name: file.name.replace('.json', ''),
                        fileName: file.name,
                        path: file.path,
                        size: file.size,
                        downloadUrl: file.download_url,
                        htmlUrl: file.html_url,
                        lastModified: file.sha
                    }));
                
                this.core.emit('github:campaignsList', { campaigns, success: true });
                console.log(`📂 Found ${campaigns.length} campaigns on GitHub`);
                return campaigns;
                
            } else if (response.status === 404) {
                this.core.emit('github:campaignsList', { campaigns: [], success: true });
                console.log('📂 No campaigns folder found on GitHub');
                return [];
            } else {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to list GitHub campaigns:', error);
            this.core.emit('github:campaignsList', { success: false, error: error.message });
            return [];
        }
    }

    async getFileFromGitHub(filePath) {
        try {
            const response = await fetch(
                `${this.baseApiUrl}/repos/${this.username}/${this.repository}/contents/${filePath}`,
                {
                    headers: {
                        'Authorization': `token ${this.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (response.ok) {
                return await response.json();
            } else if (response.status === 404) {
                return null;
            } else {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error(`Error fetching file ${filePath}:`, error);
            return null;
        }
    }

    async createCampaignRepository(repoData) {
        if (!this.githubToken) {
            this.core.emit('github:repositoryCreated', { 
                success: false, 
                error: 'GitHub token required' 
            });
            return false;
        }

        try {
            const { name, description, isPrivate = false } = repoData;
            
            const requestBody = {
                name,
                description: description || 'D&D Voice Adventure Campaign Repository',
                private: isPrivate,
                auto_init: true,
                gitignore_template: 'Node'
            };
            
            const response = await fetch(`${this.baseApiUrl}/user/repos`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
                const repository = await response.json();
                
                await this.createInitialStructure(repository.name);
                
                this.core.emit('github:repositoryCreated', { 
                    repository,
                    success: true 
                });
                
                console.log(`🏗️ Created GitHub repository: ${repository.full_name}`);
                return repository;
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || `GitHub API error: ${response.status}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to create GitHub repository:', error);
            this.core.emit('github:repositoryCreated', { success: false, error: error.message });
            return false;
        }
    }

    async createInitialStructure(repositoryName) {
        const files = [
            {
                path: 'campaigns/.gitkeep',
                content: '# Campaign save files will be stored here\n'
            },
            {
                path: 'characters/.gitkeep', 
                content: '# Character files will be stored here\n'
            },
            {
                path: 'README.md',
                content: `# ${repositoryName}\n\nD&D Voice Adventure Campaign Repository\n\nThis repository contains campaign saves, characters, and adventure data for your D&D Voice Adventure game.\n\n## Structure\n\n- \`campaigns/\` - Campaign save files\n- \`characters/\` - Character data files\n\n> Generated by [D&D Voice Adventure](https://github.com/taylor834-sketch/DND-Game)\n`
            }
        ];

        for (const file of files) {
            try {
                await fetch(
                    `${this.baseApiUrl}/repos/${this.username}/${repositoryName}/contents/${file.path}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${this.githubToken}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Initial setup: Add ${file.path}`,
                            content: btoa(unescape(encodeURIComponent(file.content))),
                            branch: 'main'
                        })
                    }
                );
            } catch (error) {
                console.warn(`⚠️ Could not create ${file.path}:`, error);
            }
        }
    }

    isAuthenticated() {
        return !!(this.githubToken && this.repository && this.username);
    }

    disconnect() {
        this.githubToken = null;
        this.repository = null;
        this.username = null;
        
        localStorage.removeItem('dnd_voice_github_token');
        localStorage.removeItem('dnd_voice_github_repo');
        localStorage.removeItem('dnd_voice_github_username');
        
        this.core.emit('github:disconnected', { success: true });
        console.log('🔌 Disconnected from GitHub');
    }

    getConnectionStatus() {
        return {
            connected: this.isAuthenticated(),
            username: this.username,
            repository: this.repository
        };
    }
}