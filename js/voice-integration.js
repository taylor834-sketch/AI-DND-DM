export default class VoiceIntegration {
    constructor(core) {
        this.core = core;
        this.characterSheet = null;
        this.worldDatabase = null;
        this.aiDMIntegration = null;
        this.interactionHistory = null;
        
        // Voice recognition
        this.recognition = null;
        this.isListening = false;
        this.currentTranscript = '';
        this.confidenceThreshold = 0.7;
        
        // Text-to-speech
        this.speechSynthesis = window.speechSynthesis;
        this.currentVoice = null;
        this.elevenLabsApiKey = null;
        this.isSpeaking = false;
        
        // Voice settings
        this.voiceSettings = {
            recognition: {
                language: 'en-US',
                continuous: true,
                interimResults: true,
                maxAlternatives: 3
            },
            tts: {
                provider: 'browser', // 'browser' or 'elevenlabs'
                browserVoice: null,
                rate: 1.0,
                pitch: 1.0,
                volume: 0.8,
                elevenLabsVoice: 'Rachel'
            },
            characters: new Map(), // Character-specific voice settings
            commands: {
                enabled: true,
                sensitivity: 0.8,
                prefix: 'hey dm' // Optional wake word
            }
        };
        
        // Voice commands
        this.voiceCommands = new Map([
            // Database queries
            ['what do i know about', this.queryNPCKnowledge.bind(this)],
            ['tell me about', this.queryEntityInfo.bind(this)],
            ['show me my relationship with', this.queryRelationship.bind(this)],
            ['what quests do i have', this.queryActiveQuests.bind(this)],
            ['where am i', this.queryCurrentLocation.bind(this)],
            ['what monsters have i seen', this.queryEncounteredMonsters.bind(this)],
            ['show my character', this.queryCharacterInfo.bind(this)],
            
            // Character switching
            ['switch to character', this.switchCharacter.bind(this)],
            ['speaking as', this.setCurrentSpeaker.bind(this)],
            ['i am', this.setCurrentSpeaker.bind(this)],
            
            // Voice controls
            ['stop listening', this.stopListening.bind(this)],
            ['start listening', this.startListening.bind(this)],
            ['repeat that', this.repeatLastResponse.bind(this)],
            ['speak slower', this.adjustSpeechRate.bind(this, -0.2)],
            ['speak faster', this.adjustSpeechRate.bind(this, 0.2)],
            
            // AI DM interaction
            ['dm', this.sendToAIDM.bind(this)],
            ['dungeon master', this.sendToAIDM.bind(this)],
            ['game master', this.sendToAIDM.bind(this)]
        ]);
        
        // Character voice context
        this.currentSpeaker = null;
        this.speakerHistory = [];
        this.lastAIResponse = '';
        
        // Visual feedback elements
        this.voiceIndicators = new Map();
        
        this.init();
    }

    async init() {
        this.core.on('core:initialized', () => {
            this.characterSheet = this.core.getModule('characterSheet');
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.aiDMIntegration = this.core.getModule('aiDMIntegration');
            this.interactionHistory = this.core.getModule('interactionHistory');
            
            this.initializeVoiceRecognition();
            this.initializeTextToSpeech();
            this.loadVoiceSettings();
            this.createVoiceInterface();
            
            console.log('🎤 Voice Integration initialized');
        });

        // Listen for character changes
        this.core.on('character:loaded', (event) => {
            this.updateCharacterVoiceSettings(event.detail);
        });

        // Listen for AI DM responses to provide voice context
        this.core.on('ai:response', (event) => {
            this.handleAIResponse(event.detail);
        });
    }

    // ===== SPEECH RECOGNITION =====

    initializeVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported in this browser');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition
        this.recognition.continuous = this.voiceSettings.recognition.continuous;
        this.recognition.interimResults = this.voiceSettings.recognition.interimResults;
        this.recognition.maxAlternatives = this.voiceSettings.recognition.maxAlternatives;
        this.recognition.lang = this.voiceSettings.recognition.language;

        // Event handlers
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateVoiceIndicator('listening', true);
            console.log('🎤 Voice recognition started');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateVoiceIndicator('listening', false);
            console.log('🎤 Voice recognition ended');
        };

        this.recognition.onresult = (event) => {
            this.handleSpeechResult(event);
        };

        this.recognition.onerror = (event) => {
            this.handleSpeechError(event);
        };
    }

    async handleSpeechResult(event) {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.trim();
            const confidence = event.results[i][0].confidence || 0;
            
            if (event.results[i].isFinal) {
                if (confidence >= this.confidenceThreshold) {
                    finalTranscript += transcript + ' ';
                } else {
                    // Low confidence - trigger fallback
                    await this.handleLowConfidenceTranscript(transcript, confidence, event.results[i]);
                }
            } else {
                interimTranscript += transcript;
            }
        }

        // Update UI with interim results
        if (interimTranscript) {
            this.updateTranscriptDisplay(interimTranscript, false);
        }

        // Process final transcript
        if (finalTranscript.trim()) {
            this.updateTranscriptDisplay(finalTranscript.trim(), true);
            await this.processVoiceInput(finalTranscript.trim());
        }
    }

    async handleLowConfidenceTranscript(transcript, confidence, result) {
        console.warn(`Low confidence speech (${confidence}): "${transcript}"`);
        
        // Show alternatives to user
        const alternatives = [];
        for (let i = 0; i < result.length && i < 3; i++) {
            alternatives.push({
                transcript: result[i].transcript,
                confidence: result[i].confidence || 0
            });
        }

        // Show disambiguation UI
        await this.showTranscriptDisambiguation(alternatives);
    }

    handleSpeechError(event) {
        console.error('Speech recognition error:', event.error);
        
        const errorMessages = {
            'no-speech': 'No speech detected. Please try speaking again.',
            'audio-capture': 'Microphone access denied or unavailable.',
            'not-allowed': 'Speech recognition permission denied.',
            'network': 'Network error during speech recognition.',
            'service-not-allowed': 'Speech recognition service not available.'
        };

        const message = errorMessages[event.error] || `Speech recognition error: ${event.error}`;
        this.showVoiceError(message);
        
        // Automatic retry for transient errors
        if (['network', 'service-not-allowed'].includes(event.error)) {
            setTimeout(() => {
                if (!this.isListening) {
                    this.startListening();
                }
            }, 2000);
        }
    }

    // ===== VOICE PROCESSING =====

    async processVoiceInput(transcript) {
        console.log(`🗣️ Processing voice input: "${transcript}"`);
        
        // Check for voice commands first
        const commandResult = await this.checkVoiceCommands(transcript);
        if (commandResult.handled) {
            return;
        }

        // Determine current speaker
        const speaker = await this.determineCurrentSpeaker(transcript);
        
        // Create voice context for AI DM
        const voiceContext = {
            transcript: transcript,
            speaker: speaker,
            confidence: 1.0, // High confidence if we got here
            timestamp: new Date().toISOString(),
            alternatives: [], // Could include lower-confidence alternatives
            isCommand: false
        };

        // Record in interaction history
        if (this.interactionHistory) {
            this.interactionHistory.logPlayerAction({
                type: 'voice_input',
                description: transcript,
                playerId: speaker?.id || 'unknown',
                playerName: speaker?.name || 'Unknown Speaker',
                location: this.getCurrentLocation()?.id,
                result: 'processed',
                tags: ['voice', 'dialogue'],
                voiceContext: voiceContext
            });
        }

        // Send to AI DM with voice context
        if (this.aiDMIntegration) {
            await this.sendVoiceInputToAIDM(transcript, voiceContext);
        }
    }

    async checkVoiceCommands(transcript) {
        if (!this.voiceSettings.commands.enabled) {
            return { handled: false };
        }

        const lowercaseTranscript = transcript.toLowerCase();
        
        // Check for command prefix if required
        if (this.voiceSettings.commands.prefix) {
            if (!lowercaseTranscript.startsWith(this.voiceSettings.commands.prefix)) {
                return { handled: false };
            }
            // Remove prefix for command matching
            transcript = transcript.substring(this.voiceSettings.commands.prefix.length).trim();
        }

        // Find matching command
        for (const [command, handler] of this.voiceCommands) {
            if (lowercaseTranscript.includes(command)) {
                try {
                    const parameter = this.extractCommandParameter(transcript, command);
                    await handler(parameter);
                    this.speak(`Executing command: ${command}`);
                    return { handled: true, command };
                } catch (error) {
                    console.error(`Voice command error for "${command}":`, error);
                    this.speak('Sorry, there was an error executing that command.');
                    return { handled: true, error };
                }
            }
        }

        return { handled: false };
    }

    async determineCurrentSpeaker(transcript) {
        // Check for explicit speaker identification
        const speakerPatterns = [
            /^(.*?)\s+says?:?\s+/i,
            /^speaking as\s+(.*?)[:, ]/i,
            /^(.*?)\s+speaking[:, ]/i
        ];

        for (const pattern of speakerPatterns) {
            const match = transcript.match(pattern);
            if (match) {
                const speakerName = match[1].trim();
                const character = await this.findCharacterByName(speakerName);
                if (character) {
                    this.currentSpeaker = character;
                    return character;
                }
            }
        }

        // Use current speaker or default character
        if (this.currentSpeaker) {
            return this.currentSpeaker;
        }

        // Default to main character
        const mainCharacter = this.characterSheet?.getCharacterData();
        if (mainCharacter) {
            this.currentSpeaker = mainCharacter;
            return mainCharacter;
        }

        return null;
    }

    async sendVoiceInputToAIDM(transcript, voiceContext) {
        try {
            // Get AI DM context with voice information
            const aiContext = await this.aiDMIntegration.getAIDMContext('social', {
                includeHistory: true,
                maxHistoryItems: 10,
                voiceContext: voiceContext,
                currentSpeaker: voiceContext.speaker
            });

            // Simulate AI DM processing (in real implementation, this would call your AI service)
            const aiResponse = await this.simulateAIDMResponse(transcript, aiContext, voiceContext);
            
            // Process the AI response
            const results = await this.aiDMIntegration.processResponse(aiResponse);
            
            // Speak the response
            await this.speak(results.processedResponse);
            
            // Record the complete interaction
            this.recordVoiceInteraction(transcript, aiResponse, voiceContext, results);

        } catch (error) {
            console.error('Error sending voice input to AI DM:', error);
            await this.speak('I\'m sorry, I encountered an error processing your request.');
        }
    }

    // ===== TEXT-TO-SPEECH =====

    initializeTextToSpeech() {
        // Load available voices
        this.speechSynthesis.onvoiceschanged = () => {
            this.loadAvailableVoices();
        };
        
        // Initial load
        this.loadAvailableVoices();
    }

    loadAvailableVoices() {
        const voices = this.speechSynthesis.getVoices();
        console.log(`📢 Loaded ${voices.length} TTS voices`);
        
        // Set default voice if none selected
        if (!this.currentVoice && voices.length > 0) {
            // Prefer English voices
            this.currentVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
            this.voiceSettings.tts.browserVoice = this.currentVoice.name;
        }
    }

    async speak(text, options = {}) {
        if (!text || this.isSpeaking) return;

        const {
            provider = this.voiceSettings.tts.provider,
            voice = this.voiceSettings.tts.browserVoice,
            rate = this.voiceSettings.tts.rate,
            pitch = this.voiceSettings.tts.pitch,
            volume = this.voiceSettings.tts.volume
        } = options;

        this.isSpeaking = true;
        this.updateVoiceIndicator('speaking', true);
        this.lastAIResponse = text;

        try {
            if (provider === 'elevenlabs' && this.elevenLabsApiKey) {
                await this.speakWithElevenLabs(text, options);
            } else {
                await this.speakWithBrowser(text, { voice, rate, pitch, volume });
            }
        } catch (error) {
            console.error('TTS Error:', error);
            // Fallback to browser TTS
            if (provider === 'elevenlabs') {
                await this.speakWithBrowser(text, { voice, rate, pitch, volume });
            }
        } finally {
            this.isSpeaking = false;
            this.updateVoiceIndicator('speaking', false);
        }
    }

    async speakWithBrowser(text, options) {
        return new Promise((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(text);
            
            utterance.voice = this.currentVoice;
            utterance.rate = options.rate || 1.0;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 0.8;

            utterance.onend = () => resolve();
            utterance.onerror = (error) => reject(error);

            // Cancel any ongoing speech
            this.speechSynthesis.cancel();
            this.speechSynthesis.speak(utterance);
        });
    }

    async speakWithElevenLabs(text, options) {
        if (!this.elevenLabsApiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        const voiceId = this.getElevenLabsVoiceId(options.voice || this.voiceSettings.tts.elevenLabsVoice);
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': this.elevenLabsApiKey
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5
                }
            })
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const audioBlob = await response.blob();
        await this.playAudioBlob(audioBlob);
    }

    async playAudioBlob(blob) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(URL.createObjectURL(blob));
            audio.onended = () => {
                URL.revokeObjectURL(audio.src);
                resolve();
            };
            audio.onerror = reject;
            audio.play().catch(reject);
        });
    }

    // ===== VOICE COMMANDS =====

    async queryNPCKnowledge(npcName) {
        if (!npcName || !this.worldDatabase) return;

        const npc = await this.worldDatabase.findEntityByName('npcs', npcName);
        if (!npc) {
            await this.speak(`I don't know anyone named ${npcName}.`);
            return;
        }

        // Get relationship info
        const relationship = this.core.getModule('relationshipSystem')?.getIndividualRelationship(npc.id);
        const relationshipText = relationship ? 
            `Your relationship is ${this.getRelationshipDescription(relationship.trustLevel)}.` : 
            'No relationship information available.';

        // Get conversation history
        const conversations = this.interactionHistory?.getNPCConversationHistory(npc.id, { limit: 3 });
        const conversationText = conversations && conversations.length > 0 ? 
            `You've spoken with them ${conversations.length} times recently.` : 
            'You haven\'t spoken with them recently.';

        const response = `${npc.name} is a ${npc.role || 'person'} ${npc.location ? `at ${npc.location}` : ''}. ${relationshipText} ${conversationText}`;
        await this.speak(response);
    }

    async queryActiveQuests() {
        if (!this.worldDatabase) return;

        const quests = this.worldDatabase.getEntitiesByType('quests')
            .filter(quest => quest.status === 'active');

        if (quests.length === 0) {
            await this.speak('You have no active quests.');
            return;
        }

        const questText = quests.length === 1 ? 
            `You have one active quest: ${quests[0].title}.` :
            `You have ${quests.length} active quests: ${quests.slice(0, 3).map(q => q.title).join(', ')}.`;

        await this.speak(questText);
    }

    async queryCurrentLocation() {
        const location = this.getCurrentLocation();
        if (!location) {
            await this.speak('Your current location is unknown.');
            return;
        }

        const description = location.description ? 
            ` ${location.description.substring(0, 100)}` : '';
        
        await this.speak(`You are currently at ${location.name}, a ${location.type}.${description}`);
    }

    async queryRelationship(npcName) {
        if (!npcName) return;

        const npc = await this.worldDatabase?.findEntityByName('npcs', npcName);
        if (!npc) {
            await this.speak(`I don't know anyone named ${npcName}.`);
            return;
        }

        const relationship = this.core.getModule('relationshipSystem')?.getIndividualRelationship(npc.id);
        if (!relationship) {
            await this.speak(`You have no relationship information for ${npc.name}.`);
            return;
        }

        const trustLevel = relationship.trustLevel;
        const relationshipType = this.getRelationshipDescription(trustLevel);
        
        await this.speak(`${npc.name} considers you ${relationshipType}. Trust level: ${trustLevel} out of 100.`);
    }

    async switchCharacter(characterName) {
        const character = await this.findCharacterByName(characterName);
        if (character) {
            this.currentSpeaker = character;
            await this.speak(`Now speaking as ${character.name}.`);
        } else {
            await this.speak(`Character ${characterName} not found.`);
        }
    }

    async setCurrentSpeaker(characterName) {
        await this.switchCharacter(characterName);
    }

    async repeatLastResponse() {
        if (this.lastAIResponse) {
            await this.speak(this.lastAIResponse);
        } else {
            await this.speak('There\'s nothing to repeat.');
        }
    }

    async adjustSpeechRate(delta) {
        this.voiceSettings.tts.rate = Math.max(0.5, Math.min(2.0, this.voiceSettings.tts.rate + delta));
        await this.speak(`Speech rate adjusted to ${this.voiceSettings.tts.rate.toFixed(1)}.`);
        this.saveVoiceSettings();
    }

    // ===== MISSING QUERY METHODS =====
    
    async queryEntityInfo(entityName) {
        try {
            const worldDatabase = this.core.getModule('worldDatabase');
            if (worldDatabase) {
                // Try to find entity as NPC, location, or faction
                const entity = await this.findEntityByName(entityName);
                if (entity) {
                    await this.speak(`${entity.name}: ${entity.description || 'No additional information available.'}`);
                } else {
                    await this.speak(`I don't have information about ${entityName}.`);
                }
            } else {
                await this.speak('World database is not available.');
            }
        } catch (error) {
            console.error('Error querying entity info:', error);
            await this.speak('Unable to retrieve entity information.');
        }
    }

    async queryEncounteredMonsters() {
        try {
            const monsterDatabase = this.core.getModule('monsterDatabase');
            if (monsterDatabase && monsterDatabase.getEncounteredMonsters) {
                const monsters = monsterDatabase.getEncounteredMonsters();
                if (monsters.length > 0) {
                    const monsterNames = monsters.map(m => m.name).join(', ');
                    await this.speak(`You have encountered: ${monsterNames}.`);
                } else {
                    await this.speak('You haven\'t encountered any monsters yet.');
                }
            } else {
                await this.speak('Monster database is not available.');
            }
        } catch (error) {
            console.error('Error querying encountered monsters:', error);
            await this.speak('Unable to retrieve monster information.');
        }
    }

    async queryCharacterInfo() {
        try {
            const characterSheet = this.core.getModule('characterSheet');
            if (characterSheet) {
                const character = characterSheet.getCharacterData();
                if (character) {
                    const info = `${character.name}, Level ${character.level} ${character.race} ${character.class}. ` +
                               `Health: ${character.currentHP} out of ${character.maxHP}.`;
                    await this.speak(info);
                } else {
                    await this.speak('No character data available.');
                }
            } else {
                await this.speak('Character sheet is not available.');
            }
        } catch (error) {
            console.error('Error querying character info:', error);
            await this.speak('Unable to retrieve character information.');
        }
    }

    // Helper method for finding entities
    async findEntityByName(name) {
        try {
            const worldDatabase = this.core.getModule('worldDatabase');
            if (!worldDatabase) return null;

            // Try to find as NPC first
            if (worldDatabase.findNPC) {
                const npc = await worldDatabase.findNPC(name);
                if (npc) return npc;
            }

            // Try to find as location
            if (worldDatabase.findLocation) {
                const location = await worldDatabase.findLocation(name);
                if (location) return location;
            }

            // Try to find as faction
            if (worldDatabase.findFaction) {
                const faction = await worldDatabase.findFaction(name);
                if (faction) return faction;
            }

            return null;
        } catch (error) {
            console.error('Error finding entity:', error);
            return null;
        }
    }

    // ===== VISUAL FEEDBACK =====

    createVoiceInterface() {
        const voicePanel = document.createElement('div');
        voicePanel.id = 'voice-panel';
        voicePanel.className = 'voice-panel';
        voicePanel.innerHTML = `
            <div class="voice-controls">
                <div class="voice-status">
                    <div class="voice-indicator" id="listening-indicator">
                        <span class="indicator-dot"></span>
                        <span class="indicator-text">Listening</span>
                    </div>
                    <div class="voice-indicator" id="speaking-indicator">
                        <span class="indicator-dot"></span>
                        <span class="indicator-text">Speaking</span>
                    </div>
                    <div class="voice-indicator" id="processing-indicator">
                        <span class="indicator-dot"></span>
                        <span class="indicator-text">Processing</span>
                    </div>
                </div>
                
                <div class="transcript-display" id="transcript-display">
                    <div class="transcript-text" id="transcript-text">Say something...</div>
                    <div class="speaker-info" id="speaker-info">Speaking as: <span id="current-speaker">Unknown</span></div>
                </div>
                
                <div class="voice-actions">
                    <button class="btn btn-primary" id="toggle-listening">
                        <span class="btn-icon">🎤</span> Start Listening
                    </button>
                    <button class="btn btn-secondary" id="voice-settings">
                        <span class="btn-icon">⚙️</span> Settings
                    </button>
                    <button class="btn btn-secondary" id="voice-commands">
                        <span class="btn-icon">📝</span> Commands
                    </button>
                </div>
            </div>
        `;

        // Add CSS styles
        const styles = `
            <style>
                .voice-panel {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: var(--color-background-primary);
                    border: 2px solid var(--color-border);
                    border-radius: var(--border-radius);
                    padding: var(--spacing-md);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 1000;
                    min-width: 320px;
                }

                .voice-status {
                    display: flex;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-md);
                }

                .voice-indicator {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-xs) var(--spacing-sm);
                    background: var(--color-background-secondary);
                    border-radius: var(--border-radius);
                    font-size: 0.8rem;
                    opacity: 0.5;
                    transition: opacity 0.3s ease;
                }

                .voice-indicator.active {
                    opacity: 1;
                    background: var(--color-accent);
                    color: var(--color-text-dark);
                }

                .indicator-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: currentColor;
                }

                .voice-indicator.active .indicator-dot {
                    animation: pulse 1s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }

                .transcript-display {
                    background: var(--color-background-secondary);
                    padding: var(--spacing-sm);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing-md);
                    min-height: 60px;
                }

                .transcript-text {
                    font-family: var(--font-body);
                    margin-bottom: var(--spacing-xs);
                    min-height: 1.2em;
                }

                .transcript-text.interim {
                    opacity: 0.7;
                    font-style: italic;
                }

                .speaker-info {
                    font-size: 0.8rem;
                    color: var(--color-text-secondary);
                }

                #current-speaker {
                    color: var(--color-accent);
                    font-weight: 600;
                }

                .voice-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .voice-actions .btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing-xs);
                }

                .btn-icon {
                    font-size: 1rem;
                }

                #toggle-listening.listening {
                    background: var(--color-error);
                    border-color: var(--color-error);
                }

                .voice-error {
                    background: var(--color-error);
                    color: white;
                    padding: var(--spacing-sm);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing-md);
                    font-size: 0.85rem;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.appendChild(voicePanel);

        this.bindVoiceEvents();
        this.updateSpeakerDisplay();
    }

    bindVoiceEvents() {
        // Toggle listening
        document.getElementById('toggle-listening')?.addEventListener('click', () => {
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        });

        // Voice settings
        document.getElementById('voice-settings')?.addEventListener('click', () => {
            this.showVoiceSettings();
        });

        // Voice commands help
        document.getElementById('voice-commands')?.addEventListener('click', () => {
            this.showVoiceCommands();
        });
    }

    updateVoiceIndicator(type, active) {
        const indicator = document.getElementById(`${type}-indicator`);
        if (indicator) {
            indicator.classList.toggle('active', active);
        }

        // Update toggle button
        const toggleBtn = document.getElementById('toggle-listening');
        if (toggleBtn && type === 'listening') {
            toggleBtn.classList.toggle('listening', active);
            toggleBtn.innerHTML = active ? 
                '<span class="btn-icon">⏹️</span> Stop Listening' : 
                '<span class="btn-icon">🎤</span> Start Listening';
        }
    }

    updateTranscriptDisplay(text, isFinal) {
        const transcriptElement = document.getElementById('transcript-text');
        if (transcriptElement) {
            transcriptElement.textContent = text;
            transcriptElement.classList.toggle('interim', !isFinal);
        }
    }

    updateSpeakerDisplay() {
        const speakerElement = document.getElementById('current-speaker');
        if (speakerElement) {
            const speakerName = this.currentSpeaker?.name || 'Unknown';
            speakerElement.textContent = speakerName;
        }
    }

    showVoiceError(message) {
        const voicePanel = document.getElementById('voice-panel');
        if (!voicePanel) return;

        // Remove existing error
        const existingError = voicePanel.querySelector('.voice-error');
        if (existingError) {
            existingError.remove();
        }

        // Add new error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'voice-error';
        errorDiv.textContent = message;
        voicePanel.insertBefore(errorDiv, voicePanel.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    // ===== VOICE SETTINGS =====

    showVoiceSettings() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🎤 Voice Settings</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="setting-section">
                        <h4>Speech Recognition</h4>
                        <div class="setting-group">
                            <label>
                                Language:
                                <select id="recognition-language">
                                    <option value="en-US">English (US)</option>
                                    <option value="en-GB">English (UK)</option>
                                    <option value="es-ES">Spanish</option>
                                    <option value="fr-FR">French</option>
                                    <option value="de-DE">German</option>
                                </select>
                            </label>
                        </div>
                        <div class="setting-group">
                            <label>
                                Confidence Threshold:
                                <input type="range" id="confidence-threshold" min="0.1" max="1" step="0.1" value="${this.confidenceThreshold}">
                                <span id="confidence-value">${this.confidenceThreshold}</span>
                            </label>
                        </div>
                    </div>

                    <div class="setting-section">
                        <h4>Text-to-Speech</h4>
                        <div class="setting-group">
                            <label>
                                Provider:
                                <select id="tts-provider">
                                    <option value="browser">Browser TTS</option>
                                    <option value="elevenlabs">ElevenLabs</option>
                                </select>
                            </label>
                        </div>
                        <div class="setting-group">
                            <label>
                                Speech Rate:
                                <input type="range" id="speech-rate" min="0.5" max="2" step="0.1" value="${this.voiceSettings.tts.rate}">
                                <span id="rate-value">${this.voiceSettings.tts.rate}</span>
                            </label>
                        </div>
                        <div class="setting-group">
                            <label>
                                Volume:
                                <input type="range" id="speech-volume" min="0" max="1" step="0.1" value="${this.voiceSettings.tts.volume}">
                                <span id="volume-value">${this.voiceSettings.tts.volume}</span>
                            </label>
                        </div>
                        <div class="setting-group" id="elevenlabs-settings" style="display: none;">
                            <label>
                                ElevenLabs API Key:
                                <input type="password" id="elevenlabs-api-key" placeholder="Enter API key">
                            </label>
                        </div>
                    </div>

                    <div class="setting-section">
                        <h4>Voice Commands</h4>
                        <div class="setting-group">
                            <label>
                                <input type="checkbox" id="commands-enabled" ${this.voiceSettings.commands.enabled ? 'checked' : ''}>
                                Enable voice commands
                            </label>
                        </div>
                        <div class="setting-group">
                            <label>
                                Wake word (optional):
                                <input type="text" id="command-prefix" value="${this.voiceSettings.commands.prefix || ''}" placeholder="e.g., 'hey dm'">
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Cancel</button>
                    <button class="btn btn-primary" id="save-voice-settings">Save Settings</button>
                    <button class="btn btn-secondary" id="test-voice">Test Voice</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Set current values
        modal.querySelector('#recognition-language').value = this.voiceSettings.recognition.language;
        modal.querySelector('#tts-provider').value = this.voiceSettings.tts.provider;

        // Provider change handler
        modal.querySelector('#tts-provider').addEventListener('change', (e) => {
            const elevenLabsSettings = modal.querySelector('#elevenlabs-settings');
            elevenLabsSettings.style.display = e.target.value === 'elevenlabs' ? 'block' : 'none';
        });

        // Range input handlers
        ['confidence-threshold', 'speech-rate', 'speech-volume'].forEach(id => {
            const slider = modal.querySelector(`#${id}`);
            const display = modal.querySelector(`#${id.replace('-', '-').replace('threshold', 'value').replace('rate', 'value').replace('volume', 'value')}`);
            slider.addEventListener('input', (e) => {
                display.textContent = e.target.value;
            });
        });

        // Save settings
        modal.querySelector('#save-voice-settings').addEventListener('click', () => {
            this.saveVoiceSettingsFromModal(modal);
            modal.remove();
        });

        // Test voice
        modal.querySelector('#test-voice').addEventListener('click', async () => {
            await this.speak('This is a test of the text-to-speech system.');
        });
    }

    showVoiceCommands() {
        const commandList = Array.from(this.voiceCommands.keys()).map(cmd => 
            `• "${cmd}" - ${this.getCommandDescription(cmd)}`
        ).join('\n');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📝 Voice Commands</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Available voice commands:</p>
                    <pre style="background: var(--color-background-secondary); padding: var(--spacing-md); border-radius: var(--border-radius); white-space: pre-wrap;">${commandList}</pre>
                    <p><strong>Tip:</strong> ${this.voiceSettings.commands.prefix ? `Start commands with "${this.voiceSettings.commands.prefix}" ` : ''}Commands are case-insensitive and support natural language variations.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async showTranscriptDisambiguation(alternatives) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🎤 Speech Recognition</h3>
                    </div>
                    <div class="modal-body">
                        <p>I'm not sure what you said. Please select the correct option:</p>
                        <div class="transcript-options">
                            ${alternatives.map((alt, index) => `
                                <button class="btn btn-secondary transcript-option" data-transcript="${alt.transcript}" style="display: block; width: 100%; margin-bottom: 8px; text-align: left;">
                                    "${alt.transcript}" (${Math.round(alt.confidence * 100)}% confidence)
                                </button>
                            `).join('')}
                            <button class="btn btn-secondary transcript-option" data-transcript="" style="display: block; width: 100%; margin-bottom: 8px;">
                                None of these - try again
                            </button>
                        </div>
                    </div>
                </div>
            `;

            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('transcript-option')) {
                    const transcript = e.target.dataset.transcript;
                    modal.remove();
                    if (transcript) {
                        this.processVoiceInput(transcript);
                    }
                    resolve(transcript);
                }
            });

            document.body.appendChild(modal);
        });
    }

    // ===== SETTINGS MANAGEMENT =====

    saveVoiceSettingsFromModal(modal) {
        this.voiceSettings.recognition.language = modal.querySelector('#recognition-language').value;
        this.confidenceThreshold = parseFloat(modal.querySelector('#confidence-threshold').value);
        this.voiceSettings.tts.provider = modal.querySelector('#tts-provider').value;
        this.voiceSettings.tts.rate = parseFloat(modal.querySelector('#speech-rate').value);
        this.voiceSettings.tts.volume = parseFloat(modal.querySelector('#speech-volume').value);
        this.voiceSettings.commands.enabled = modal.querySelector('#commands-enabled').checked;
        this.voiceSettings.commands.prefix = modal.querySelector('#command-prefix').value.trim();

        const apiKey = modal.querySelector('#elevenlabs-api-key').value.trim();
        if (apiKey) {
            this.elevenLabsApiKey = apiKey;
        }

        this.saveVoiceSettings();
        this.applyVoiceSettings();
    }

    async saveVoiceSettings() {
        if (this.worldDatabase) {
            try {
                await this.worldDatabase.saveData('voice_settings', {
                    ...this.voiceSettings,
                    confidenceThreshold: this.confidenceThreshold,
                    elevenLabsApiKey: this.elevenLabsApiKey // Note: In production, encrypt this
                });
                console.log('💾 Voice settings saved');
            } catch (error) {
                console.error('Failed to save voice settings:', error);
            }
        }
    }

    async loadVoiceSettings() {
        if (this.worldDatabase) {
            try {
                const saved = await this.worldDatabase.getData('voice_settings');
                if (saved) {
                    this.voiceSettings = { ...this.voiceSettings, ...saved };
                    this.confidenceThreshold = saved.confidenceThreshold || 0.7;
                    this.elevenLabsApiKey = saved.elevenLabsApiKey || null;
                    this.applyVoiceSettings();
                    console.log('📂 Voice settings loaded');
                }
            } catch (error) {
                console.error('Failed to load voice settings:', error);
            }
        }
    }

    applyVoiceSettings() {
        if (this.recognition) {
            this.recognition.lang = this.voiceSettings.recognition.language;
            this.recognition.continuous = this.voiceSettings.recognition.continuous;
            this.recognition.interimResults = this.voiceSettings.recognition.interimResults;
        }
    }

    // ===== UTILITY FUNCTIONS =====

    startListening() {
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Failed to start voice recognition:', error);
                this.showVoiceError('Failed to start voice recognition. Please check microphone permissions.');
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    getCurrentLocation() {
        return this.core.getModule('campaignManager')?.getCurrentLocation();
    }

    async findCharacterByName(name) {
        // In a full implementation, this would search through available characters
        const currentCharacter = this.characterSheet?.getCharacterData();
        if (currentCharacter && currentCharacter.name.toLowerCase().includes(name.toLowerCase())) {
            return currentCharacter;
        }
        return null;
    }

    extractCommandParameter(transcript, command) {
        const commandIndex = transcript.toLowerCase().indexOf(command);
        if (commandIndex !== -1) {
            return transcript.substring(commandIndex + command.length).trim();
        }
        return '';
    }

    getRelationshipDescription(trustLevel) {
        if (trustLevel >= 90) return 'devoted to you';
        if (trustLevel >= 70) return 'your ally';
        if (trustLevel >= 40) return 'friendly toward you';
        if (trustLevel >= 30) return 'neutral';
        if (trustLevel >= 10) return 'unfriendly';
        return 'hostile';
    }

    getCommandDescription(command) {
        const descriptions = {
            'what do i know about': 'Get information about an NPC',
            'tell me about': 'Get details about any entity',
            'show me my relationship with': 'Check relationship status',
            'what quests do i have': 'List active quests',
            'where am i': 'Get current location',
            'switch to character': 'Change active speaker',
            'dm': 'Send message to AI DM',
            'stop listening': 'Disable voice recognition',
            'repeat that': 'Repeat last AI response'
        };
        return descriptions[command] || 'Execute voice command';
    }

    getElevenLabsVoiceId(voiceName) {
        const voiceMap = {
            'Rachel': '21m00Tcm4TlvDq8ikWAM',
            'Drew': '29vD33N1CtxCmqQRPOHJ',
            'Clyde': '2EiwWnXFnvU5JabPnv8n',
            'Paul': '5Q0t7uMcjvnagumLfvZi'
        };
        return voiceMap[voiceName] || voiceMap['Rachel'];
    }

    async simulateAIDMResponse(transcript, context, voiceContext) {
        // This is a simulation - in production, this would call your actual AI service
        const speaker = voiceContext.speaker;
        const speakerName = speaker ? speaker.name : 'Unknown';
        
        return `I understand that ${speakerName} said: "${transcript}". How interesting! Let me process that and provide an appropriate response based on the current situation.`;
    }

    recordVoiceInteraction(transcript, aiResponse, voiceContext, results) {
        // Record the complete voice interaction
        if (this.interactionHistory) {
            this.interactionHistory.recordAIResponse({
                originalResponse: aiResponse,
                processedResponse: results.processedResponse,
                contextType: 'voice_interaction',
                voiceContext: voiceContext,
                transcript: transcript,
                speaker: voiceContext.speaker,
                entitiesCreated: results.entitiesCreated,
                relationshipsUpdated: results.relationshipsUpdated,
                questsUpdated: results.questsUpdated
            });
        }
    }

    handleAIResponse(responseData) {
        // This is called when the AI DM generates a response
        // We could analyze the response for voice-specific content
        this.lastAIResponse = responseData.processedResponse || responseData.originalResponse;
    }

    updateCharacterVoiceSettings(character) {
        // Update character-specific voice settings when a character is loaded
        if (character) {
            this.currentSpeaker = character;
            this.updateSpeakerDisplay();
            
            // Apply character-specific voice settings if they exist
            const characterVoiceSettings = this.voiceSettings.characters.get(character.id);
            if (characterVoiceSettings) {
                // Apply character-specific voice, rate, pitch, etc.
                console.log(`🎭 Applied voice settings for ${character.name}`);
            }
        }
    }

    // ===== PUBLIC API =====

    /**
     * Start voice recognition
     */
    startVoiceRecognition() {
        this.startListening();
    }

    /**
     * Stop voice recognition
     */
    stopVoiceRecognition() {
        this.stopListening();
    }

    /**
     * Speak text using current TTS settings
     */
    async speakText(text, options = {}) {
        return await this.speak(text, options);
    }

    /**
     * Set the current speaking character
     */
    setSpeakingCharacter(character) {
        this.currentSpeaker = character;
        this.updateSpeakerDisplay();
    }

    /**
     * Get current voice settings
     */
    getVoiceSettings() {
        return { ...this.voiceSettings };
    }

    /**
     * Update voice settings
     */
    updateVoiceSettings(newSettings) {
        this.voiceSettings = { ...this.voiceSettings, ...newSettings };
        this.applyVoiceSettings();
        this.saveVoiceSettings();
    }

    /**
     * Toggle voice panel visibility
     */
    toggleVoicePanel() {
        const panel = document.getElementById('voice-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }
}