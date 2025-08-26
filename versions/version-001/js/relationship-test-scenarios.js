export default class RelationshipTestScenarios {
    constructor(core) {
        this.core = core;
        this.relationshipSystem = null;
        this.worldDatabase = null;
        this.testResults = [];
        this.init();
    }

    init() {
        this.core.on('core:initialized', () => {
            this.relationshipSystem = this.core.getModule('relationshipSystem');
            this.worldDatabase = this.core.getModule('worldDatabase');
            this.setupTestScenarios();
        });
    }

    setupTestScenarios() {
        // Create test NPCs and factions for relationship testing
        this.createTestEntities();
        
        // Add test UI controls to world browser
        this.addTestUI();
    }

    createTestEntities() {
        if (!this.worldDatabase) return;

        // Test NPCs
        const testNPCs = [
            {
                id: 'test-merchant-elara',
                name: 'Elara Moonwhisper',
                occupation: 'Merchant',
                location: 'Riverside Market',
                personality: 'Shrewd but fair trader who values loyalty and honesty.',
                background: 'Former adventurer turned merchant, has connections throughout the region.',
                status: 'neutral',
                relationships: [
                    { type: 'ally', target: 'test-guild-traders', strength: 'strong' },
                    { type: 'rival', target: 'test-thief-marcus', strength: 'moderate' }
                ]
            },
            {
                id: 'test-guard-captain-thorne',
                name: 'Captain Thorne Ironfist',
                occupation: 'Guard Captain',
                location: 'City Watch Headquarters',
                personality: 'Honorable and dutiful, but can be inflexible about rules.',
                background: 'Veteran guard who has served the city for 20 years.',
                status: 'neutral',
                relationships: [
                    { type: 'ally', target: 'test-guild-guards', strength: 'strong' },
                    { type: 'enemy', target: 'test-thief-marcus', strength: 'strong' }
                ]
            },
            {
                id: 'test-thief-marcus',
                name: 'Marcus Shadowstep',
                occupation: 'Information Broker',
                location: 'The Docks',
                personality: 'Charming rogue with a silver tongue and flexible morals.',
                background: 'Former street thief turned information broker.',
                status: 'neutral',
                relationships: [
                    { type: 'rival', target: 'test-merchant-elara', strength: 'moderate' },
                    { type: 'enemy', target: 'test-guard-captain-thorne', strength: 'strong' }
                ]
            },
            {
                id: 'test-companion-aria',
                name: 'Aria Stormwind',
                occupation: 'Battle Mage',
                location: 'Traveling Companion',
                personality: 'Intelligent and passionate about justice, can be impulsive.',
                background: 'Former court mage seeking to right the wrongs of her past.',
                status: 'friendly',
                isCompanion: true,
                romance: {
                    available: true,
                    stage: 'none'
                },
                personalQuest: {
                    available: true,
                    title: 'Redemption of the Fallen Star',
                    description: 'Help Aria confront her past mistakes at the royal court.'
                }
            },
            {
                id: 'test-companion-gareth',
                name: 'Gareth Stonebeard',
                occupation: 'Warrior',
                location: 'Traveling Companion',
                personality: 'Loyal and straightforward dwarf with a strong sense of honor.',
                background: 'Exiled dwarf seeking to restore his clan\'s honor.',
                status: 'friendly',
                isCompanion: true,
                romance: {
                    available: false
                },
                personalQuest: {
                    available: true,
                    title: 'The Lost Hammer of Clan Stonebeard',
                    description: 'Help Gareth retrieve his ancestral weapon.'
                }
            }
        ];

        // Test Factions
        const testFactions = [
            {
                id: 'test-guild-traders',
                name: 'Merchants\' Guild',
                type: 'Trade Organization',
                description: 'Powerful guild controlling most trade in the region.',
                powerLevel: 'high',
                status: 'neutral',
                members: ['test-merchant-elara'],
                relationships: [
                    { type: 'ally', target: 'test-guild-guards', strength: 'moderate' },
                    { type: 'unfriendly', target: 'test-thieves-guild', strength: 'moderate' }
                ]
            },
            {
                id: 'test-guild-guards',
                name: 'City Watch',
                type: 'Law Enforcement',
                description: 'The official peacekeeping force of the city.',
                powerLevel: 'high',
                status: 'neutral',
                members: ['test-guard-captain-thorne'],
                relationships: [
                    { type: 'ally', target: 'test-guild-traders', strength: 'moderate' },
                    { type: 'enemy', target: 'test-thieves-guild', strength: 'strong' }
                ]
            },
            {
                id: 'test-thieves-guild',
                name: 'The Shadow Syndicate',
                type: 'Criminal Organization',
                description: 'Underground network of thieves and information brokers.',
                powerLevel: 'moderate',
                status: 'hostile',
                members: ['test-thief-marcus'],
                relationships: [
                    { type: 'unfriendly', target: 'test-guild-traders', strength: 'moderate' },
                    { type: 'enemy', target: 'test-guild-guards', strength: 'strong' }
                ]
            }
        ];

        // Create the test entities
        testNPCs.forEach(npc => {
            this.worldDatabase.createNPC(npc);
        });

        testFactions.forEach(faction => {
            this.worldDatabase.createFaction(faction);
        });

        // Initialize companion relationships
        this.relationshipSystem.setCompanionApproval('test-companion-aria', 55, {
            romance: { available: true }
        });
        this.relationshipSystem.setCompanionApproval('test-companion-gareth', 60);

        console.log('✅ Test entities created for relationship system');
    }

    addTestUI() {
        // Add test panel to world browser
        const testPanel = this.createTestPanel();
        
        // Inject into world browser when it's shown
        this.core.on('ui:screenShown', (event) => {
            if (event.detail.screen === 'worldBrowser') {
                setTimeout(() => {
                    const worldBrowserContainer = document.querySelector('.world-browser-container');
                    if (worldBrowserContainer && !document.getElementById('relationship-test-panel')) {
                        worldBrowserContainer.appendChild(testPanel);
                    }
                }, 100);
            }
        });
    }

    createTestPanel() {
        const panel = document.createElement('div');
        panel.id = 'relationship-test-panel';
        panel.className = 'relationship-test-panel';
        
        panel.innerHTML = `
            <div class="test-panel-header">
                <h3>🧪 Relationship System Testing</h3>
                <button id="toggle-test-panel" class="toggle-button">▼</button>
            </div>
            <div class="test-panel-content">
                <div class="test-section">
                    <h4>Scenario 1: Building Positive Relationships</h4>
                    <div class="test-buttons">
                        <button class="test-btn" data-test="help-elara">Help Elara with Bandits</button>
                        <button class="test-btn" data-test="honest-trade">Make Honest Trade</button>
                        <button class="test-btn" data-test="return-item">Return Lost Item</button>
                    </div>
                </div>
                
                <div class="test-section">
                    <h4>Scenario 2: Damaging Relationships</h4>
                    <div class="test-buttons">
                        <button class="test-btn" data-test="steal-from-merchant">Steal from Merchant</button>
                        <button class="test-btn" data-test="break-promise">Break Promise</button>
                        <button class="test-btn" data-test="insult-guard">Insult Guard Captain</button>
                    </div>
                </div>
                
                <div class="test-section">
                    <h4>Scenario 3: Faction Conflicts</h4>
                    <div class="test-buttons">
                        <button class="test-btn" data-test="help-guards-raid">Help Guards Raid Thieves</button>
                        <button class="test-btn" data-test="tip-off-thieves">Tip Off Thieves Guild</button>
                        <button class="test-btn" data-test="broker-peace">Try to Broker Peace</button>
                    </div>
                </div>
                
                <div class="test-section">
                    <h4>Scenario 4: Companion Approval</h4>
                    <div class="test-buttons">
                        <button class="test-btn" data-test="aria-justice">Support Aria's Justice</button>
                        <button class="test-btn" data-test="aria-pragmatic">Choose Pragmatic Option</button>
                        <button class="test-btn" data-test="gareth-honor">Honor Gareth's Code</button>
                        <button class="test-btn" data-test="romance-aria">Flirt with Aria</button>
                    </div>
                </div>
                
                <div class="test-section">
                    <h4>Scenario 5: Long-term Consequences</h4>
                    <div class="test-buttons">
                        <button class="test-btn" data-test="time-passage">Simulate 30 Days</button>
                        <button class="test-btn" data-test="major-quest">Complete Major Quest</button>
                        <button class="test-btn" data-test="betrayal">Major Betrayal</button>
                    </div>
                </div>
                
                <div class="test-section">
                    <h4>Test Results</h4>
                    <div id="test-results" class="test-results"></div>
                    <div class="test-buttons">
                        <button class="test-btn secondary" data-test="ai-context">Show AI DM Context</button>
                        <button class="test-btn secondary" data-test="reset-tests">Reset All Tests</button>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .relationship-test-panel {
                background: var(--color-background-tertiary);
                border: 2px solid var(--color-accent);
                border-radius: var(--border-radius-md);
                margin: var(--spacing-lg) 0;
                overflow: hidden;
            }
            
            .test-panel-header {
                background: var(--color-accent);
                color: var(--color-background);
                padding: var(--spacing-sm) var(--spacing-md);
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
            }
            
            .test-panel-header h3 {
                margin: 0;
                font-family: var(--font-title);
                font-size: 1.1rem;
            }
            
            .toggle-button {
                background: none;
                border: none;
                color: var(--color-background);
                font-size: 1.2rem;
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            
            .test-panel-content {
                padding: var(--spacing-md);
                max-height: 500px;
                overflow-y: auto;
            }
            
            .test-panel-content.collapsed {
                display: none;
            }
            
            .test-section {
                margin-bottom: var(--spacing-lg);
                padding-bottom: var(--spacing-md);
                border-bottom: 1px solid var(--color-border);
            }
            
            .test-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
            
            .test-section h4 {
                color: var(--color-text-primary);
                font-family: var(--font-title);
                margin-bottom: var(--spacing-sm);
            }
            
            .test-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: var(--spacing-sm);
            }
            
            .test-btn {
                background: var(--color-primary);
                color: var(--color-text-primary);
                border: none;
                padding: var(--spacing-xs) var(--spacing-sm);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                font-size: 0.9rem;
                transition: var(--transition-fast);
            }
            
            .test-btn:hover {
                background: var(--color-primary-dark);
                transform: translateY(-1px);
            }
            
            .test-btn.secondary {
                background: var(--color-secondary);
            }
            
            .test-btn.secondary:hover {
                background: var(--color-secondary-dark);
            }
            
            .test-results {
                background: var(--color-background-secondary);
                border: 1px solid var(--color-border);
                border-radius: var(--border-radius-sm);
                padding: var(--spacing-sm);
                margin-bottom: var(--spacing-sm);
                min-height: 100px;
                font-family: monospace;
                font-size: 0.8rem;
                white-space: pre-line;
                overflow-y: auto;
                max-height: 200px;
            }
            
            @media (max-width: 768px) {
                .test-buttons {
                    flex-direction: column;
                }
                
                .test-btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);

        // Bind events
        this.bindTestEvents(panel);

        return panel;
    }

    bindTestEvents(panel) {
        // Toggle panel
        const toggleBtn = panel.querySelector('#toggle-test-panel');
        const content = panel.querySelector('.test-panel-content');
        
        toggleBtn.addEventListener('click', () => {
            content.classList.toggle('collapsed');
            toggleBtn.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
        });

        // Test buttons
        panel.addEventListener('click', (e) => {
            if (e.target.classList.contains('test-btn')) {
                const testType = e.target.dataset.test;
                this.runTestScenario(testType);
            }
        });
    }

    runTestScenario(testType) {
        const results = document.getElementById('test-results');
        if (!results) return;

        this.logTest(`Running test: ${testType}`);

        switch (testType) {
            case 'help-elara':
                this.testHelpElara();
                break;
            case 'honest-trade':
                this.testHonestTrade();
                break;
            case 'return-item':
                this.testReturnItem();
                break;
            case 'steal-from-merchant':
                this.testStealFromMerchant();
                break;
            case 'break-promise':
                this.testBreakPromise();
                break;
            case 'insult-guard':
                this.testInsultGuard();
                break;
            case 'help-guards-raid':
                this.testHelpGuardsRaid();
                break;
            case 'tip-off-thieves':
                this.testTipOffThieves();
                break;
            case 'broker-peace':
                this.testBrokerPeace();
                break;
            case 'aria-justice':
                this.testAriaJustice();
                break;
            case 'aria-pragmatic':
                this.testAriaPragmatic();
                break;
            case 'gareth-honor':
                this.testGarethHonor();
                break;
            case 'romance-aria':
                this.testRomanceAria();
                break;
            case 'time-passage':
                this.testTimePassage();
                break;
            case 'major-quest':
                this.testMajorQuest();
                break;
            case 'betrayal':
                this.testBetrayal();
                break;
            case 'ai-context':
                this.showAIDMContext();
                break;
            case 'reset-tests':
                this.resetAllTests();
                break;
            default:
                this.logTest(`Unknown test: ${testType}`);
        }
    }

    // ===== SCENARIO 1: BUILDING POSITIVE RELATIONSHIPS =====

    testHelpElara() {
        this.logTest('🛡️ You help Elara fight off bandits attacking her caravan');
        
        const oldTrust = this.relationshipSystem.getIndividualRelationship('test-merchant-elara').trustLevel;
        const relationship = this.relationshipSystem.modifyTrust(
            'test-merchant-elara', 
            15, 
            'Helped fight off bandits attacking her caravan'
        );
        
        // Merchants' Guild also approves
        this.relationshipSystem.modifyFactionReputation(
            'test-guild-traders',
            8,
            'Helped protect guild member from bandits'
        );
        
        this.logTest(`Elara's trust: ${oldTrust} → ${relationship.trustLevel}`);
        this.logTest(`Merchants' Guild reputation improved by 8 points`);
        this.logTest(`✅ Positive consequences: Better prices, new quests available`);
    }

    testHonestTrade() {
        this.logTest('🤝 You conduct an honest trade, paying fair prices');
        
        const oldTrust = this.relationshipSystem.getIndividualRelationship('test-merchant-elara').trustLevel;
        const relationship = this.relationshipSystem.modifyTrust(
            'test-merchant-elara', 
            5, 
            'Conducted honest trade, paid fair prices'
        );
        
        this.logTest(`Elara's trust: ${oldTrust} → ${relationship.trustLevel}`);
        this.logTest(`✅ Small but consistent trust gain from honest dealing`);
    }

    testReturnItem() {
        this.logTest('📦 You return a valuable item you found that belongs to Elara');
        
        const oldTrust = this.relationshipSystem.getIndividualRelationship('test-merchant-elara').trustLevel;
        const relationship = this.relationshipSystem.modifyTrust(
            'test-merchant-elara', 
            20, 
            'Returned valuable lost item instead of keeping it'
        );
        
        this.logTest(`Elara's trust: ${oldTrust} → ${relationship.trustLevel}`);
        this.logTest(`✅ Major trust gain for honesty when no one was watching`);
    }

    // ===== SCENARIO 2: DAMAGING RELATIONSHIPS =====

    testStealFromMerchant() {
        this.logTest('🎭 You attempt to steal from Elara\'s shop');
        
        const oldTrust = this.relationshipSystem.getIndividualRelationship('test-merchant-elara').trustLevel;
        const relationship = this.relationshipSystem.modifyTrust(
            'test-merchant-elara', 
            -25, 
            'Caught stealing from her shop'
        );
        
        // Merchants' Guild is not pleased
        this.relationshipSystem.modifyFactionReputation(
            'test-guild-traders',
            -15,
            'Stole from guild member'
        );

        // Guards are alerted
        this.relationshipSystem.modifyTrust(
            'test-guard-captain-thorne',
            -10,
            'Reported for theft by merchant'
        );
        
        this.logTest(`Elara's trust: ${oldTrust} → ${relationship.trustLevel}`);
        this.logTest(`⚠️ Consequences: Shop prices increased, guards suspicious`);
    }

    testBreakPromise() {
        this.logTest('💔 You break an important promise to Captain Thorne');
        
        const oldTrust = this.relationshipSystem.getIndividualRelationship('test-guard-captain-thorne').trustLevel;
        const relationship = this.relationshipSystem.modifyTrust(
            'test-guard-captain-thorne', 
            -20, 
            'Broke important promise about investigating crime'
        );
        
        this.logTest(`Captain Thorne's trust: ${oldTrust} → ${relationship.trustLevel}`);
        this.logTest(`⚠️ Honor-bound characters remember broken promises`);
    }

    testInsultGuard() {
        this.logTest('😤 You publicly insult Captain Thorne');
        
        const oldTrust = this.relationshipSystem.getIndividualRelationship('test-guard-captain-thorne').trustLevel;
        const relationship = this.relationshipSystem.modifyTrust(
            'test-guard-captain-thorne', 
            -15, 
            'Publicly insulted in front of subordinates'
        );
        
        // City Watch doesn't like you insulting their captain
        this.relationshipSystem.modifyFactionReputation(
            'test-guild-guards',
            -12,
            'Insulted the captain publicly'
        );
        
        this.logTest(`Captain Thorne's trust: ${oldTrust} → ${relationship.trustLevel}`);
        this.logTest(`⚠️ Public insults have wider consequences`);
    }

    // ===== SCENARIO 3: FACTION CONFLICTS =====

    testHelpGuardsRaid() {
        this.logTest('⚔️ You help the City Watch raid a Shadow Syndicate hideout');
        
        // Guards love you
        this.relationshipSystem.modifyFactionReputation(
            'test-guild-guards',
            20,
            'Helped raid criminal hideout'
        );

        // Thieves hate you
        this.relationshipSystem.modifyFactionReputation(
            'test-thieves-guild',
            -25,
            'Helped guards raid their operations'
        );

        // Individual consequences
        this.relationshipSystem.modifyTrust(
            'test-guard-captain-thorne',
            10,
            'Helped with dangerous raid'
        );

        this.relationshipSystem.modifyTrust(
            'test-thief-marcus',
            -20,
            'Helped enemies raid our hideout'
        );
        
        this.logTest(`✅ Guards: +20 reputation, Thieves: -25 reputation`);
        this.logTest(`⚠️ Faction conflicts create lasting enemies`);
    }

    testTipOffThieves() {
        this.logTest('🗣️ You secretly tip off the Shadow Syndicate about the raid');
        
        // Thieves appreciate the warning
        this.relationshipSystem.modifyFactionReputation(
            'test-thieves-guild',
            15,
            'Warned about incoming guard raid'
        );

        // But if discovered, guards will be furious
        this.relationshipSystem.modifyTrust(
            'test-thief-marcus',
            12,
            'Provided valuable warning about raid'
        );
        
        this.logTest(`Shadow Syndicate: +15 reputation`);
        this.logTest(`⚠️ Secret alliances can backfire if discovered`);
    }

    testBrokerPeace() {
        this.logTest('🕊️ You attempt to broker peace between Guards and Thieves');
        
        // Moderate gains with both, but neither fully trusts you
        this.relationshipSystem.modifyFactionReputation(
            'test-guild-guards',
            5,
            'Attempted peaceful resolution'
        );

        this.relationshipSystem.modifyFactionReputation(
            'test-thieves-guild',
            8,
            'Showed respect for our position'
        );
        
        this.logTest(`Both factions gain small reputation, but neither fully trusts`);
        this.logTest(`✅ Diplomatic approach has benefits but limits`);
    }

    // ===== SCENARIO 4: COMPANION APPROVAL =====

    testAriaJustice() {
        this.logTest('⚖️ You support Aria\'s desire for justice over pragmatism');
        
        const oldApproval = this.relationshipSystem.getCompanionApproval('test-companion-aria').approval;
        const companion = this.relationshipSystem.modifyCompanionApproval(
            'test-companion-aria',
            12,
            'Supported justice over pragmatic concerns',
            { context: 'moral_alignment' }
        );
        
        this.logTest(`Aria's approval: ${oldApproval} → ${companion.approval}`);
        this.logTest(`✅ Aligning with companion values builds strong approval`);
    }

    testAriaPragmatic() {
        this.logTest('🤔 You choose pragmatic option over Aria\'s justice ideals');
        
        const oldApproval = this.relationshipSystem.getCompanionApproval('test-companion-aria').approval;
        const companion = this.relationshipSystem.modifyCompanionApproval(
            'test-companion-aria',
            -8,
            'Chose pragmatism over justice ideals',
            { context: 'moral_conflict' }
        );
        
        this.logTest(`Aria's approval: ${oldApproval} → ${companion.approval}`);
        this.logTest(`⚠️ Going against companion values reduces approval`);
    }

    testGarethHonor() {
        this.logTest('🛡️ You honor Gareth\'s code and stand by your word');
        
        const oldApproval = this.relationshipSystem.getCompanionApproval('test-companion-gareth').approval;
        const companion = this.relationshipSystem.modifyCompanionApproval(
            'test-companion-gareth',
            10,
            'Honored your word and showed integrity',
            { context: 'honor_code' }
        );
        
        this.logTest(`Gareth's approval: ${oldApproval} → ${companion.approval}`);
        this.logTest(`✅ Honor resonates strongly with Gareth`);
    }

    testRomanceAria() {
        this.logTest('💕 You express romantic interest in Aria');
        
        const current = this.relationshipSystem.getCompanionApproval('test-companion-aria');
        
        if (current.approval >= 70) {
            const companion = this.relationshipSystem.modifyCompanionApproval(
                'test-companion-aria',
                8,
                'Expressed romantic interest',
                { romantic: true, context: 'romance' }
            );
            
            this.logTest(`Aria's approval: ${current.approval} → ${companion.approval}`);
            this.logTest(`✅ Romance progressed due to high approval`);
            
            // Gareth might be jealous if he has feelings
            const garethCurrent = this.relationshipSystem.getCompanionApproval('test-companion-gareth');
            if (garethCurrent.approval > 60) {
                this.relationshipSystem.modifyCompanionApproval(
                    'test-companion-gareth',
                    -3,
                    'Jealousy from romantic attention to another',
                    { context: 'jealousy' }
                );
                this.logTest(`⚠️ Gareth shows subtle disapproval (jealousy effect)`);
            }
        } else {
            this.logTest(`❌ Aria's approval too low (${current.approval}) for romance`);
        }
    }

    // ===== SCENARIO 5: LONG-TERM CONSEQUENCES =====

    testTimePassage() {
        this.logTest('⏰ Simulating 30 days without interaction...');
        
        // Manually trigger decay for all relationships
        const before = {};
        ['test-merchant-elara', 'test-guard-captain-thorne', 'test-thief-marcus'].forEach(npcId => {
            before[npcId] = this.relationshipSystem.getIndividualRelationship(npcId).trustLevel;
        });

        // Simulate time passage by calling decay multiple times
        for (let i = 0; i < 30; i++) {
            this.relationshipSystem.processRelationshipDecay();
        }

        Object.keys(before).forEach(npcId => {
            const after = this.relationshipSystem.getIndividualRelationship(npcId).trustLevel;
            if (before[npcId] !== after) {
                this.logTest(`${npcId} trust: ${before[npcId]} → ${after} (decay)`);
            }
        });
        
        this.logTest(`⚠️ Relationships naturally decay without maintenance`);
    }

    testMajorQuest() {
        this.logTest('🏆 You complete a major quest that affects everyone');
        
        // Major positive changes across the board
        this.relationshipSystem.modifyTrust('test-merchant-elara', 25, 'Completed major quest benefiting the city');
        this.relationshipSystem.modifyTrust('test-guard-captain-thorne', 30, 'Heroic actions protecting the city');
        this.relationshipSystem.modifyFactionReputation('test-guild-traders', 20, 'Quest brought prosperity');
        this.relationshipSystem.modifyFactionReputation('test-guild-guards', 25, 'Helped protect the city');
        
        // Companions are impressed
        this.relationshipSystem.modifyCompanionApproval('test-companion-aria', 15, 'Amazed by your heroic deeds');
        this.relationshipSystem.modifyCompanionApproval('test-companion-gareth', 12, 'Honored to fight alongside a hero');
        
        this.logTest(`✅ Major positive shifts across all relationships`);
        this.logTest(`🎖️ Heroic actions have wide-reaching positive effects`);
    }

    testBetrayal() {
        this.logTest('🗡️ You commit a major betrayal that shocks everyone');
        
        // Massive negative changes
        this.relationshipSystem.modifyTrust('test-merchant-elara', -40, 'Major betrayal of trust');
        this.relationshipSystem.modifyTrust('test-guard-captain-thorne', -50, 'Betrayed the city\'s trust');
        this.relationshipSystem.modifyFactionReputation('test-guild-traders', -35, 'Betrayal hurt guild interests');
        this.relationshipSystem.modifyFactionReputation('test-guild-guards', -45, 'Betrayed the city and its protectors');
        
        // Companions are devastated
        this.relationshipSystem.modifyCompanionApproval('test-companion-aria', -30, 'Devastated by your betrayal');
        this.relationshipSystem.modifyCompanionApproval('test-companion-gareth', -25, 'Honor demands distance from betrayers');
        
        this.logTest(`💔 Massive negative shifts - relationships may never recover`);
        this.logTest(`⚠️ Major betrayals have permanent consequences`);
    }

    // ===== AI DM CONTEXT AND UTILITIES =====

    showAIDMContext() {
        this.logTest('🤖 Current AI DM Relationship Context:');
        
        const context = this.relationshipSystem.getAIDMContext();
        
        this.logTest('\n=== ALLIES ===');
        context.summary.allies.forEach(ally => {
            this.logTest(`${ally.name}: Trust ${ally.trustLevel} (${ally.relationshipType})`);
        });
        
        this.logTest('\n=== ENEMIES ===');
        context.summary.enemies.forEach(enemy => {
            this.logTest(`${enemy.name}: Trust ${enemy.trustLevel} (${enemy.relationshipType})`);
        });
        
        this.logTest('\n=== ROMANTIC INTERESTS ===');
        context.summary.romantic.forEach(romance => {
            this.logTest(`${romance.name}: ${romance.romance.stage} (Trust ${romance.trustLevel})`);
        });
        
        this.logTest('\n=== FACTION STANDINGS ===');
        Object.values(context.factions).forEach(faction => {
            this.logTest(`${faction.name}: ${faction.reputation} (${faction.level})`);
        });
        
        this.logTest('\n=== COMPANION STATUS ===');
        Object.values(context.companions).forEach(companion => {
            const level = companion.approvalLevel;
            this.logTest(`${companion.name}: ${companion.approval} (${level.name})`);
            if (companion.romance.stage !== 'none') {
                this.logTest(`  Romance: ${companion.romance.stage}`);
            }
        });
        
        // Show what AI DM can do with this data
        this.logTest('\n=== AI DM CAPABILITIES ===');
        const allies = this.relationshipSystem.queryForAIDM('allies');
        const enemies = this.relationshipSystem.queryForAIDM('enemies');
        
        this.logTest(`Available help from ${allies.length} allies`);
        this.logTest(`Potential threats from ${enemies.length} enemies`);
        
        if (allies.length > 0) {
            this.logTest(`Best ally: ${allies[0].name} (${allies[0].trustLevel} trust)`);
            this.logTest(`Can provide: ${allies[0].canProvide.join(', ')}`);
        }
    }

    resetAllTests() {
        this.logTest('🔄 Resetting all test relationships to baseline...');
        
        // Reset individual relationships
        ['test-merchant-elara', 'test-guard-captain-thorne', 'test-thief-marcus'].forEach(npcId => {
            this.relationshipSystem.setIndividualRelationship(npcId, {
                trustLevel: 50,
                relationshipType: 'neutral',
                notes: [],
                interactions: 0,
                romance: { available: false, active: false, stage: 'none' }
            });
        });
        
        // Reset faction reputations
        ['test-guild-traders', 'test-guild-guards', 'test-thieves-guild'].forEach(factionId => {
            this.relationshipSystem.modifyFactionReputation(factionId, -this.relationshipSystem.getFactionReputation(factionId).reputation, 'Test reset');
        });
        
        // Reset companions
        this.relationshipSystem.setCompanionApproval('test-companion-aria', 55, {
            romance: { available: true, stage: 'none' }
        });
        this.relationshipSystem.setCompanionApproval('test-companion-gareth', 60);
        
        this.logTest('✅ All relationships reset to baseline values');
        this.testResults = [];
    }

    logTest(message) {
        const results = document.getElementById('test-results');
        if (results) {
            const timestamp = new Date().toLocaleTimeString();
            results.textContent += `[${timestamp}] ${message}\n`;
            results.scrollTop = results.scrollHeight;
        }
        
        console.log(`[Relationship Test] ${message}`);
    }

    // ===== PUBLIC API FOR AI DM INTEGRATION =====

    /**
     * Get relationship context for AI DM responses
     * @param {string} contextType - Type of context needed
     * @returns {Object} Context data
     */
    getAIDMRelationshipContext(contextType) {
        switch (contextType) {
            case 'conversation':
                return this.getConversationContext();
            case 'quest_help':
                return this.getQuestHelpContext();
            case 'social_encounter':
                return this.getSocialEncounterContext();
            case 'romance_check':
                return this.getRomanceContext();
            default:
                return this.relationshipSystem.getAIDMContext();
        }
    }

    getConversationContext() {
        const allies = this.relationshipSystem.queryForAIDM('allies', { threshold: 60 });
        const enemies = this.relationshipSystem.queryForAIDM('enemies', { threshold: 40 });
        
        return {
            type: 'conversation',
            allies: allies.map(a => ({ 
                name: a.name, 
                trustLevel: a.trustLevel,
                topics: this.getAvailableTopics(a)
            })),
            enemies: enemies.map(e => ({
                name: e.name,
                trustLevel: e.trustLevel,
                attitude: this.getDynamicAttitude(e.trustLevel)
            })),
            suggestions: this.getConversationSuggestions(allies, enemies)
        };
    }

    getQuestHelpContext() {
        const allies = this.relationshipSystem.queryForAIDM('allies', { threshold: 70 });
        
        return {
            type: 'quest_help',
            available_help: allies.map(ally => ({
                name: ally.name,
                trustLevel: ally.trustLevel,
                capabilities: ally.canProvide,
                cost: this.getHelpCost(ally.trustLevel),
                reliability: this.getReliability(ally.trustLevel)
            }))
        };
    }

    getSocialEncounterContext() {
        const context = this.relationshipSystem.getAIDMContext();
        
        return {
            type: 'social_encounter',
            reputation_modifiers: this.getReputationModifiers(context.factions),
            introduction_bonuses: this.getIntroductionBonuses(context.individual),
            social_standing: this.calculateSocialStanding(context)
        };
    }

    getRomanceContext() {
        const romanticInterests = this.relationshipSystem.queryForAIDM('romantic');
        
        return {
            type: 'romance',
            active_romances: romanticInterests,
            jealousy_risks: this.calculateJealousyRisks(romanticInterests),
            available_options: this.getAvailableRomanceOptions()
        };
    }

    // Helper methods for AI DM context
    getAvailableTopics(ally) {
        const topics = ['general'];
        if (ally.trustLevel >= 70) topics.push('personal', 'rumors');
        if (ally.trustLevel >= 80) topics.push('secrets', 'quests');
        if (ally.trustLevel >= 90) topics.push('dangerous_knowledge');
        return topics;
    }

    getDynamicAttitude(trustLevel) {
        if (trustLevel <= 10) return 'hostile';
        if (trustLevel <= 30) return 'unfriendly';
        return 'cold';
    }

    getHelpCost(trustLevel) {
        if (trustLevel >= 90) return 'free';
        if (trustLevel >= 80) return 'favor';
        if (trustLevel >= 70) return 'small_payment';
        return 'standard_rate';
    }

    getReliability(trustLevel) {
        if (trustLevel >= 90) return 'absolute';
        if (trustLevel >= 80) return 'very_high';
        if (trustLevel >= 70) return 'reliable';
        return 'conditional';
    }

    getReputationModifiers(factions) {
        const modifiers = {};
        Object.values(factions).forEach(faction => {
            modifiers[faction.name] = {
                modifier: Math.floor(faction.reputation / 10),
                description: `${faction.level} standing`
            };
        });
        return modifiers;
    }

    getIntroductionBonuses(relationships) {
        const bonuses = [];
        Object.values(relationships).forEach(rel => {
            if (rel.trustLevel >= 70) {
                bonuses.push({
                    name: rel.name,
                    bonus: Math.floor((rel.trustLevel - 50) / 10),
                    description: `${rel.name} speaks well of you`
                });
            }
        });
        return bonuses;
    }

    calculateSocialStanding(context) {
        const avgReputation = Object.values(context.factions)
            .reduce((sum, faction) => sum + faction.reputation, 0) / 
            Object.values(context.factions).length;
            
        const avgTrust = Object.values(context.individual)
            .reduce((sum, rel) => sum + rel.trustLevel, 0) / 
            Object.values(context.individual).length;
            
        const standing = (avgReputation + avgTrust) / 2;
        
        if (standing >= 80) return 'renowned';
        if (standing >= 60) return 'respected';
        if (standing >= 40) return 'known';
        if (standing >= 20) return 'unremarkable';
        return 'notorious';
    }

    calculateJealousyRisks(romanticInterests) {
        return romanticInterests.map(interest => ({
            name: interest.name,
            jealousy: interest.jealousy || 0,
            risk_level: interest.jealousy > 20 ? 'high' : interest.jealousy > 10 ? 'moderate' : 'low'
        }));
    }

    getAvailableRomanceOptions() {
        // This would check all NPCs with romance.available = true
        // and sufficient approval ratings
        const data = this.worldDatabase.getData();
        const options = [];
        
        data.relationships.individual.forEach((rel, npcId) => {
            if (rel.romance.available && rel.trustLevel >= 60 && rel.romance.stage === 'none') {
                const npc = this.worldDatabase.getNPC(npcId);
                if (npc) {
                    options.push({
                        name: npc.name,
                        id: npcId,
                        readiness: rel.trustLevel >= 70 ? 'ready' : 'building_trust'
                    });
                }
            }
        });
        
        return options;
    }
}