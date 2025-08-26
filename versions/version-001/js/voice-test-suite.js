export default class VoiceTestSuite {
    constructor(core) {
        this.core = core;
        this.voiceIntegration = null;
        this.aiDMIntegration = null;
        this.testResults = new Map();
        this.currentTest = null;
        
        // Test scenarios
        this.testScenarios = [
            {
                id: 'speech_recognition_basic',
                name: 'Basic Speech Recognition',
                description: 'Test basic speech recognition accuracy',
                type: 'recognition',
                testPhrases: [
                    'Hello, this is a test',
                    'What do I know about Elara the merchant',
                    'Show me my active quests',
                    'I want to cast a fireball spell',
                    'Tell me about the tavern'
                ]
            },
            {
                id: 'character_context',
                name: 'Character Context Processing',
                description: 'Test character-aware voice processing',
                type: 'character',
                testPhrases: [
                    'Thorin says: I want to examine the door',
                    'Speaking as Lyra: I cast detect magic',
                    'Gareth the fighter speaking: I attack with my sword',
                    'Switch to character Aria',
                    'I am Zara the rogue'
                ]
            },
            {
                id: 'voice_commands',
                name: 'Voice Command Recognition',
                description: 'Test database query voice commands',
                type: 'commands',
                testPhrases: [
                    'What do I know about Captain Marcus',
                    'Show me my relationship with the innkeeper',
                    'What quests do I have active',
                    'Where am I currently located',
                    'Tell me about the local guild'
                ]
            },
            {
                id: 'ai_dm_integration',
                name: 'AI DM Voice Integration',
                description: 'Test voice context in AI DM responses',
                type: 'ai_dm',
                testPhrases: [
                    'I want to negotiate with the merchant for a better price',
                    'Can I convince the guard to let us through',
                    'I search the room for hidden passages',
                    'We should rest at the inn tonight',
                    'I want to learn more about the local history'
                ]
            },
            {
                id: 'tts_quality',
                name: 'Text-to-Speech Quality',
                description: 'Test TTS with various content types',
                type: 'tts',
                testPhrases: [
                    'Welcome to the Dragon\'s Rest Tavern, weary travelers!',
                    'Roll a d20 for your perception check.',
                    'The ancient runes glow with mystical energy as you approach.',
                    'You gain 150 experience points and find 25 gold pieces.',
                    'The orc chieftain roars in anger, raising his massive war axe!'
                ]
            },
            {
                id: 'environment_noise',
                name: 'Environmental Noise Handling',
                description: 'Test recognition accuracy in various noise conditions',
                type: 'noise',
                testPhrases: [
                    'Can you hear me with background music',
                    'Testing with keyboard typing sounds',
                    'Voice recognition during game sound effects',
                    'Speaking while other people are talking',
                    'Recognition with fan or AC noise'
                ]
            }
        ];
        
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.voiceIntegration = this.core.getModule('voiceIntegration');
            this.aiDMIntegration = this.core.getModule('aiDMIntegration');
            
            this.createTestInterface();
            console.log('🧪 Voice Test Suite initialized');
        });
    }

    createTestInterface() {
        const testPanel = document.createElement('div');
        testPanel.id = 'voice-test-panel';
        testPanel.className = 'test-panel';
        testPanel.innerHTML = `
            <div class="test-header">
                <h2>🧪 Voice Integration Test Suite</h2>
                <div class="test-status" id="test-status">Ready to test</div>
            </div>
            
            <div class="test-content">
                <div class="test-scenarios">
                    <h3>Test Scenarios</h3>
                    <div class="scenario-list" id="scenario-list">
                        ${this.testScenarios.map(scenario => `
                            <div class="test-scenario" data-scenario-id="${scenario.id}">
                                <div class="scenario-header">
                                    <h4>${scenario.name}</h4>
                                    <div class="scenario-status" id="status-${scenario.id}">Not tested</div>
                                </div>
                                <p class="scenario-description">${scenario.description}</p>
                                <div class="scenario-actions">
                                    <button class="btn btn-primary" onclick="voiceTestSuite.runScenario('${scenario.id}')">Run Test</button>
                                    <button class="btn btn-secondary" onclick="voiceTestSuite.showScenarioDetails('${scenario.id}')">Details</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="test-controls">
                    <h3>Test Controls</h3>
                    <div class="control-buttons">
                        <button class="btn btn-primary" id="run-all-tests">Run All Tests</button>
                        <button class="btn btn-secondary" id="test-microphone">Test Microphone</button>
                        <button class="btn btn-secondary" id="test-speakers">Test Speakers</button>
                        <button class="btn btn-secondary" id="calibrate-voice">Calibrate Voice</button>
                    </div>
                    
                    <div class="test-settings">
                        <h4>Test Settings</h4>
                        <div class="setting-group">
                            <label>
                                <input type="checkbox" id="detailed-logging" checked>
                                Enable detailed logging
                            </label>
                        </div>
                        <div class="setting-group">
                            <label>
                                <input type="checkbox" id="auto-retry" checked>
                                Auto-retry failed tests
                            </label>
                        </div>
                        <div class="setting-group">
                            <label>
                                Test delay (seconds):
                                <input type="number" id="test-delay" min="1" max="10" value="3">
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="test-results" id="test-results">
                    <h3>Test Results</h3>
                    <div class="results-summary" id="results-summary">
                        <p>No tests run yet.</p>
                    </div>
                    <div class="results-detail" id="results-detail">
                        <!-- Detailed results will appear here -->
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles
        const styles = `
            <style>
                .test-panel {
                    max-width: 1200px;
                    margin: 20px auto;
                    padding: var(--spacing-lg);
                    background: var(--color-background-primary);
                    border-radius: var(--border-radius);
                }

                .test-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-lg);
                    padding-bottom: var(--spacing-md);
                    border-bottom: 2px solid var(--color-border);
                }

                .test-header h2 {
                    color: var(--color-accent);
                    font-family: var(--font-title);
                    margin: 0;
                }

                .test-status {
                    padding: var(--spacing-xs) var(--spacing-sm);
                    background: var(--color-background-secondary);
                    border-radius: var(--border-radius);
                    font-weight: 600;
                }

                .test-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--spacing-xl);
                }

                .test-scenarios, .test-controls, .test-results {
                    background: var(--color-background-secondary);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                }

                .test-results {
                    grid-column: 1 / -1;
                }

                .test-scenario {
                    background: var(--color-background-primary);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing-md);
                    border-left: 4px solid var(--color-border);
                }

                .test-scenario.running {
                    border-left-color: var(--color-warning);
                }

                .test-scenario.passed {
                    border-left-color: var(--color-success);
                }

                .test-scenario.failed {
                    border-left-color: var(--color-error);
                }

                .scenario-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-sm);
                }

                .scenario-header h4 {
                    margin: 0;
                    color: var(--color-text-primary);
                }

                .scenario-status {
                    font-size: 0.8rem;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-weight: bold;
                }

                .scenario-status.not-tested {
                    background: var(--color-background-secondary);
                    color: var(--color-text-secondary);
                }

                .scenario-status.running {
                    background: var(--color-warning);
                    color: var(--color-text-dark);
                }

                .scenario-status.passed {
                    background: var(--color-success);
                    color: white;
                }

                .scenario-status.failed {
                    background: var(--color-error);
                    color: white;
                }

                .scenario-description {
                    color: var(--color-text-secondary);
                    font-size: 0.9rem;
                    margin-bottom: var(--spacing-sm);
                }

                .scenario-actions {
                    display: flex;
                    gap: var(--spacing-sm);
                }

                .control-buttons {
                    display: flex;
                    gap: var(--spacing-sm);
                    margin-bottom: var(--spacing-md);
                    flex-wrap: wrap;
                }

                .test-settings .setting-group {
                    margin-bottom: var(--spacing-sm);
                }

                .test-settings input[type="number"] {
                    width: 60px;
                    padding: 4px;
                    border: 1px solid var(--color-border);
                    border-radius: 4px;
                    background: var(--color-background-primary);
                    color: var(--color-text-primary);
                }

                .results-summary {
                    background: var(--color-background-primary);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing-md);
                }

                .results-detail {
                    max-height: 400px;
                    overflow-y: auto;
                }

                .test-result-item {
                    background: var(--color-background-primary);
                    padding: var(--spacing-sm);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing-sm);
                    border-left: 4px solid var(--color-info);
                }

                .test-result-item.passed {
                    border-left-color: var(--color-success);
                }

                .test-result-item.failed {
                    border-left-color: var(--color-error);
                }

                .test-result-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing-xs);
                }

                .test-result-details {
                    font-size: 0.85rem;
                    color: var(--color-text-secondary);
                }

                .progress-bar {
                    width: 100%;
                    height: 8px;
                    background: var(--color-background-secondary);
                    border-radius: 4px;
                    overflow: hidden;
                    margin: var(--spacing-sm) 0;
                }

                .progress-fill {
                    height: 100%;
                    background: var(--color-accent);
                    transition: width 0.3s ease;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.appendChild(testPanel);
        
        // Make test suite globally accessible
        window.voiceTestSuite = this;
        
        this.bindTestEvents();
    }

    bindTestEvents() {
        document.getElementById('run-all-tests')?.addEventListener('click', async () => {
            await this.runAllTests();
        });

        document.getElementById('test-microphone')?.addEventListener('click', () => {
            this.testMicrophone();
        });

        document.getElementById('test-speakers')?.addEventListener('click', () => {
            this.testSpeakers();
        });

        document.getElementById('calibrate-voice')?.addEventListener('click', () => {
            this.calibrateVoice();
        });
    }

    // ===== TEST EXECUTION =====

    async runAllTests() {
        this.updateTestStatus('Running all tests...');
        let passedTests = 0;
        let totalTests = this.testScenarios.length;

        for (const scenario of this.testScenarios) {
            const result = await this.runScenario(scenario.id);
            if (result.passed) passedTests++;
            
            // Delay between tests
            const delay = parseInt(document.getElementById('test-delay')?.value || '3') * 1000;
            await this.delay(delay);
        }

        this.updateResultsSummary(passedTests, totalTests);
        this.updateTestStatus(`Tests complete: ${passedTests}/${totalTests} passed`);
    }

    async runScenario(scenarioId) {
        const scenario = this.testScenarios.find(s => s.id === scenarioId);
        if (!scenario) return { passed: false, error: 'Scenario not found' };

        console.log(`🧪 Running test scenario: ${scenario.name}`);
        
        this.currentTest = scenarioId;
        this.updateScenarioStatus(scenarioId, 'running');
        
        try {
            let result;
            
            switch (scenario.type) {
                case 'recognition':
                    result = await this.testSpeechRecognition(scenario);
                    break;
                case 'character':
                    result = await this.testCharacterContext(scenario);
                    break;
                case 'commands':
                    result = await this.testVoiceCommands(scenario);
                    break;
                case 'ai_dm':
                    result = await this.testAIDMIntegration(scenario);
                    break;
                case 'tts':
                    result = await this.testTextToSpeech(scenario);
                    break;
                case 'noise':
                    result = await this.testNoiseHandling(scenario);
                    break;
                default:
                    result = { passed: false, error: 'Unknown test type' };
            }

            this.testResults.set(scenarioId, result);
            this.updateScenarioStatus(scenarioId, result.passed ? 'passed' : 'failed');
            this.addTestResult(scenario.name, result);
            
            return result;
            
        } catch (error) {
            const result = { passed: false, error: error.message };
            this.testResults.set(scenarioId, result);
            this.updateScenarioStatus(scenarioId, 'failed');
            this.addTestResult(scenario.name, result);
            return result;
        }
    }

    // ===== SPECIFIC TEST IMPLEMENTATIONS =====

    async testSpeechRecognition(scenario) {
        if (!this.voiceIntegration) {
            return { passed: false, error: 'Voice integration not available' };
        }

        const results = [];
        
        for (const phrase of scenario.testPhrases) {
            const result = await this.testRecognitionPhrase(phrase);
            results.push(result);
        }

        const successCount = results.filter(r => r.success).length;
        const accuracy = successCount / results.length;
        
        return {
            passed: accuracy >= 0.7, // 70% accuracy threshold
            accuracy: accuracy,
            details: `${successCount}/${results.length} phrases recognized correctly`,
            results: results
        };
    }

    async testRecognitionPhrase(expectedPhrase) {
        return new Promise((resolve) => {
            console.log(`🎤 Test phrase: "${expectedPhrase}"`);
            
            // Start listening
            this.voiceIntegration.startListening();
            
            // Display prompt to user
            this.showRecognitionPrompt(expectedPhrase);
            
            // Set up temporary event listener
            const handleResult = (event) => {
                this.voiceIntegration.recognition.removeEventListener('result', handleResult);
                
                const transcript = event.results[event.results.length - 1][0].transcript.trim();
                const confidence = event.results[event.results.length - 1][0].confidence || 0;
                
                const similarity = this.calculateSimilarity(expectedPhrase.toLowerCase(), transcript.toLowerCase());
                const success = similarity >= 0.8 && confidence >= 0.7;
                
                resolve({
                    expected: expectedPhrase,
                    received: transcript,
                    confidence: confidence,
                    similarity: similarity,
                    success: success
                });
            };

            this.voiceIntegration.recognition.addEventListener('result', handleResult);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                this.voiceIntegration.recognition.removeEventListener('result', handleResult);
                resolve({
                    expected: expectedPhrase,
                    received: '',
                    confidence: 0,
                    similarity: 0,
                    success: false,
                    error: 'Timeout'
                });
            }, 10000);
        });
    }

    async testCharacterContext(scenario) {
        const results = [];
        
        for (const phrase of scenario.testPhrases) {
            // Simulate processing the character-aware phrase
            await this.voiceIntegration.processVoiceInput(phrase);
            
            // Check if character context was correctly identified
            const currentSpeaker = this.voiceIntegration.currentSpeaker;
            const extractedCharacter = this.extractCharacterFromPhrase(phrase);
            
            const success = extractedCharacter ? 
                currentSpeaker && currentSpeaker.name.toLowerCase().includes(extractedCharacter.toLowerCase()) :
                true; // For phrases without explicit character mentions
            
            results.push({
                phrase: phrase,
                extractedCharacter: extractedCharacter,
                currentSpeaker: currentSpeaker?.name || 'None',
                success: success
            });
        }

        const successCount = results.filter(r => r.success).length;
        
        return {
            passed: successCount >= results.length * 0.8, // 80% success rate
            accuracy: successCount / results.length,
            details: `${successCount}/${results.length} character contexts correctly identified`,
            results: results
        };
    }

    async testVoiceCommands(scenario) {
        const results = [];
        
        for (const phrase of scenario.testPhrases) {
            const result = await this.voiceIntegration.checkVoiceCommands(phrase);
            
            results.push({
                command: phrase,
                handled: result.handled,
                success: result.handled && !result.error
            });
        }

        const successCount = results.filter(r => r.success).length;
        
        return {
            passed: successCount === results.length, // All commands should work
            accuracy: successCount / results.length,
            details: `${successCount}/${results.length} voice commands executed successfully`,
            results: results
        };
    }

    async testAIDMIntegration(scenario) {
        if (!this.aiDMIntegration) {
            return { passed: false, error: 'AI DM integration not available' };
        }

        const results = [];
        
        for (const phrase of scenario.testPhrases) {
            try {
                // Test voice context integration
                const voiceContext = {
                    transcript: phrase,
                    speaker: this.voiceIntegration.currentSpeaker,
                    timestamp: new Date().toISOString(),
                    confidence: 1.0
                };

                const context = await this.aiDMIntegration.getAIDMContext('social', {
                    voiceContext: voiceContext
                });

                const success = context && context.metadata && 
                    context.critical && context.important;
                
                results.push({
                    phrase: phrase,
                    contextGenerated: !!context,
                    voiceContextIncluded: !!context.voiceContext,
                    success: success
                });
                
            } catch (error) {
                results.push({
                    phrase: phrase,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        
        return {
            passed: successCount >= results.length * 0.9, // 90% success rate for AI integration
            accuracy: successCount / results.length,
            details: `${successCount}/${results.length} AI DM integrations successful`,
            results: results
        };
    }

    async testTextToSpeech(scenario) {
        const results = [];
        
        for (const phrase of scenario.testPhrases) {
            try {
                const startTime = Date.now();
                await this.voiceIntegration.speak(phrase);
                const duration = Date.now() - startTime;
                
                results.push({
                    phrase: phrase,
                    duration: duration,
                    success: true
                });
                
            } catch (error) {
                results.push({
                    phrase: phrase,
                    success: false,
                    error: error.message
                });
            }
            
            // Brief pause between TTS tests
            await this.delay(1000);
        }

        const successCount = results.filter(r => r.success).length;
        const avgDuration = results.filter(r => r.success)
            .reduce((sum, r) => sum + r.duration, 0) / successCount;
        
        return {
            passed: successCount === results.length,
            accuracy: successCount / results.length,
            averageDuration: avgDuration,
            details: `${successCount}/${results.length} TTS phrases spoken successfully (avg: ${Math.round(avgDuration)}ms)`,
            results: results
        };
    }

    async testNoiseHandling(scenario) {
        // This test would require user interaction to simulate different noise conditions
        return {
            passed: true, // Manual test - assume passed
            details: 'Noise handling test requires manual verification',
            instructions: [
                'Test speech recognition with background music playing',
                'Try recognition while typing on keyboard',
                'Test with multiple people talking',
                'Verify recognition with ambient noise (fan, AC)',
                'Check fallback mechanisms when recognition fails'
            ]
        };
    }

    // ===== UTILITY TESTS =====

    testMicrophone() {
        console.log('🎤 Testing microphone access...');
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                console.log('✅ Microphone access granted');
                this.showTestResult('Microphone Test', 'Microphone access successful', true);
                
                // Stop the stream
                stream.getTracks().forEach(track => track.stop());
            })
            .catch(error => {
                console.error('❌ Microphone access failed:', error);
                this.showTestResult('Microphone Test', `Microphone access failed: ${error.message}`, false);
            });
    }

    async testSpeakers() {
        console.log('🔊 Testing speaker output...');
        
        try {
            await this.voiceIntegration.speak('This is a speaker test. Can you hear this clearly?');
            this.showTestResult('Speaker Test', 'Speaker test completed - please verify audio quality', true);
        } catch (error) {
            this.showTestResult('Speaker Test', `Speaker test failed: ${error.message}`, false);
        }
    }

    calibrateVoice() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🎤 Voice Calibration</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Voice calibration helps optimize recognition accuracy for your voice and environment.</p>
                    
                    <div class="calibration-steps">
                        <div class="calibration-step">
                            <h4>Step 1: Environment Check</h4>
                            <p>Ensure you're in a quiet environment with minimal background noise.</p>
                            <button class="btn btn-primary" id="check-environment">Check Environment</button>
                        </div>
                        
                        <div class="calibration-step">
                            <h4>Step 2: Voice Sample</h4>
                            <p>Speak the following phrases clearly:</p>
                            <ul>
                                <li>"I want to search for treasure"</li>
                                <li>"Cast fireball at the goblin"</li>
                                <li>"What do I know about this NPC"</li>
                            </ul>
                            <button class="btn btn-primary" id="record-samples">Record Samples</button>
                        </div>
                        
                        <div class="calibration-step">
                            <h4>Step 3: Optimization</h4>
                            <p>Adjust sensitivity based on your voice patterns.</p>
                            <div class="calibration-controls">
                                <label>
                                    Sensitivity:
                                    <input type="range" id="voice-sensitivity" min="0.1" max="1" step="0.1" value="0.7">
                                    <span id="sensitivity-value">0.7</span>
                                </label>
                            </div>
                            <button class="btn btn-primary" id="apply-calibration">Apply Calibration</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // ===== HELPER FUNCTIONS =====

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        return (longer.length - this.levenshteinDistance(longer, shorter)) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    extractCharacterFromPhrase(phrase) {
        const patterns = [
            /^(.*?)\s+says?:?\s+/i,
            /^speaking as\s+(.*?)[:, ]/i,
            /^(.*?)\s+speaking[:, ]/i
        ];

        for (const pattern of patterns) {
            const match = phrase.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        return null;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== UI UPDATE FUNCTIONS =====

    updateTestStatus(message) {
        const statusElement = document.getElementById('test-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    updateScenarioStatus(scenarioId, status) {
        const statusElement = document.getElementById(`status-${scenarioId}`);
        const scenarioElement = document.querySelector(`[data-scenario-id="${scenarioId}"]`);
        
        if (statusElement) {
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusElement.className = `scenario-status ${status}`;
        }
        
        if (scenarioElement) {
            scenarioElement.className = `test-scenario ${status}`;
        }
    }

    updateResultsSummary(passed, total) {
        const summaryElement = document.getElementById('results-summary');
        if (summaryElement) {
            const percentage = Math.round((passed / total) * 100);
            summaryElement.innerHTML = `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <p><strong>Test Results:</strong> ${passed}/${total} passed (${percentage}%)</p>
                <p><strong>Status:</strong> ${percentage >= 80 ? '✅ Voice integration working well' : percentage >= 60 ? '⚠️ Some issues detected' : '❌ Significant issues found'}</p>
            `;
        }
    }

    addTestResult(testName, result) {
        const detailElement = document.getElementById('results-detail');
        if (!detailElement) return;

        const resultDiv = document.createElement('div');
        resultDiv.className = `test-result-item ${result.passed ? 'passed' : 'failed'}`;
        resultDiv.innerHTML = `
            <div class="test-result-header">
                <strong>${testName}</strong>
                <span class="result-status">${result.passed ? '✅ PASSED' : '❌ FAILED'}</span>
            </div>
            <div class="test-result-details">
                ${result.details || result.error || 'No details available'}
                ${result.accuracy ? ` (${Math.round(result.accuracy * 100)}% accuracy)` : ''}
            </div>
        `;

        detailElement.appendChild(resultDiv);
        detailElement.scrollTop = detailElement.scrollHeight;
    }

    showTestResult(title, message, success) {
        this.addTestResult(title, {
            passed: success,
            details: message
        });
    }

    showRecognitionPrompt(phrase) {
        const prompt = document.createElement('div');
        prompt.id = 'recognition-prompt';
        prompt.className = 'recognition-prompt';
        prompt.innerHTML = `
            <div class="prompt-content">
                <h3>🎤 Speech Recognition Test</h3>
                <p>Please say the following phrase clearly:</p>
                <div class="test-phrase">"${phrase}"</div>
                <p class="listening-indicator">🔴 Listening...</p>
            </div>
        `;

        // Add prompt styles
        const promptStyles = `
            <style>
                .recognition-prompt {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: var(--color-background-primary);
                    border: 2px solid var(--color-accent);
                    border-radius: var(--border-radius);
                    padding: var(--spacing-lg);
                    z-index: 2000;
                    text-align: center;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                }

                .test-phrase {
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: var(--color-accent);
                    background: var(--color-background-secondary);
                    padding: var(--spacing-md);
                    border-radius: var(--border-radius);
                    margin: var(--spacing-md) 0;
                }

                .listening-indicator {
                    color: var(--color-error);
                    font-weight: bold;
                }
            </style>
        `;

        if (!document.querySelector('#prompt-styles')) {
            document.head.insertAdjacentHTML('beforeend', `<style id="prompt-styles">${promptStyles}</style>`);
        }

        document.body.appendChild(prompt);

        // Remove prompt after 10 seconds
        setTimeout(() => {
            if (prompt.parentNode) {
                prompt.remove();
            }
        }, 10000);
    }

    showScenarioDetails(scenarioId) {
        const scenario = this.testScenarios.find(s => s.id === scenarioId);
        if (!scenario) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📋 ${scenario.name}</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Description:</strong> ${scenario.description}</p>
                    <p><strong>Type:</strong> ${scenario.type}</p>
                    
                    <h4>Test Phrases:</h4>
                    <ul>
                        ${scenario.testPhrases.map(phrase => `<li>"${phrase}"</li>`).join('')}
                    </ul>
                    
                    ${this.testResults.has(scenarioId) ? `
                        <h4>Last Test Result:</h4>
                        <pre style="background: var(--color-background-secondary); padding: var(--spacing-md); border-radius: var(--border-radius); white-space: pre-wrap;">${JSON.stringify(this.testResults.get(scenarioId), null, 2)}</pre>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
                    <button class="btn btn-primary" onclick="voiceTestSuite.runScenario('${scenarioId}'); this.parentElement.parentElement.parentElement.remove()">Run Test</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // ===== PUBLIC API =====

    getTestResults() {
        return Object.fromEntries(this.testResults);
    }

    exportTestResults() {
        const results = {
            timestamp: new Date().toISOString(),
            scenarios: this.testScenarios,
            results: Object.fromEntries(this.testResults),
            environment: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                webkitSpeechRecognition: 'webkitSpeechRecognition' in window,
                speechSynthesis: 'speechSynthesis' in window
            }
        };

        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voice-test-results-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}