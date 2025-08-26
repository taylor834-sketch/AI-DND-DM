import CharacterParser from './character-parser.js';

export default class CharacterSheet {
    constructor(core) {
        this.core = core;
        this.parser = new CharacterParser();
        this.party = [];
        this.currentCharacter = null;
        this.init();
    }

    init() {
        this.core.on('character:import', (event) => this.importCharacter(event.detail));
        this.core.on('character:switch', (event) => this.switchCharacter(event.detail.id));
        this.core.on('character:save', () => this.saveCurrentCharacter());
        this.core.on('ui:screenShown', (event) => this.handleScreenChange(event.detail.screen));
        
        this.setupEventHandlers();
        console.log('📝 Character Sheet Manager initialized');
    }

    setupEventHandlers() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.bindEvents(), 500);
            });
        } else {
            setTimeout(() => this.bindEvents(), 500);
        }
    }

    bindEvents() {
        // Import character button
        const importBtn = document.getElementById('import-character-btn');
        const parseBtn = document.getElementById('parse-character-btn');
        const continueBtn = document.getElementById('continue-to-game-btn');
        const saveBtn = document.getElementById('save-character-btn');
        const characterSwitcher = document.getElementById('character-switcher');

        if (importBtn) {
            importBtn.addEventListener('click', () => {
                document.getElementById('import-modal').style.display = 'flex';
            });
        }

        if (parseBtn) {
            parseBtn.addEventListener('click', () => this.parseCharacterFromText());
        }

        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.continueToGame());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCurrentCharacter());
        }

        if (characterSwitcher) {
            characterSwitcher.addEventListener('change', (e) => {
                if (e.target.value !== 'Select Character') {
                    this.switchCharacter(e.target.value);
                }
            });
        }

        // Tab switching
        this.setupTabHandlers();

        // HP input changes
        const hpInput = document.getElementById('current-hp');
        if (hpInput) {
            hpInput.addEventListener('change', () => this.updateCurrentHP());
        }

        // Notes changes
        const notesTextarea = document.getElementById('character-notes');
        if (notesTextarea) {
            notesTextarea.addEventListener('blur', () => this.updateCharacterNotes());
        }
    }

    setupTabHandlers() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Remove active class from all buttons and panels
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanels.forEach(panel => panel.classList.remove('active'));
                
                // Add active class to clicked button and corresponding panel
                button.classList.add('active');
                const targetPanel = document.getElementById(`${targetTab}-tab`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    }

    handleScreenChange(screenName) {
        if (screenName === 'characterSetup') {
            this.refreshPartyList();
        } else if (screenName === 'characterSheet') {
            this.displayCurrentCharacter();
        }
    }

    parseCharacterFromText() {
        const textarea = document.getElementById('character-import-text');
        const text = textarea.value.trim();

        if (!text) {
            const ui = this.core.getModule('ui');
            ui?.showNotification('Please paste character sheet text', 'error');
            return;
        }

        try {
            const character = this.parser.parseCharacterSheet(text);
            this.addCharacterToParty(character);
            
            // Close modal and clear text
            document.getElementById('import-modal').style.display = 'none';
            textarea.value = '';
            
            const ui = this.core.getModule('ui');
            ui?.showNotification(`Character "${character.name}" imported successfully!`, 'success');
            
        } catch (error) {
            console.error('Failed to parse character:', error);
            const ui = this.core.getModule('ui');
            ui?.showNotification(`Failed to import character: ${error.message}`, 'error');
        }
    }

    addCharacterToParty(character) {
        // Set as main character if it's the first one
        if (this.party.length === 0) {
            character.isMainCharacter = true;
            this.currentCharacter = character;
        }

        this.party.push(character);
        this.refreshPartyList();
        this.savePartyToStorage();
    }

    refreshPartyList() {
        const partyListElement = document.getElementById('party-list');
        const characterActions = document.getElementById('character-actions');

        if (!partyListElement) return;

        if (this.party.length === 0) {
            partyListElement.innerHTML = `
                <div class="empty-party">
                    <p>No characters in party. Import or create characters to get started.</p>
                    <button class="primary-button" onclick="document.getElementById('import-modal').style.display='flex'">
                        <span class="button-icon">👥</span>
                        Add First Character
                    </button>
                </div>
            `;
            if (characterActions) characterActions.style.display = 'none';
        } else {
            partyListElement.innerHTML = this.party.map(character => this.renderPartyMember(character)).join('');
            if (characterActions) characterActions.style.display = 'block';
            this.updateCharacterSwitcher();
        }
    }

    renderPartyMember(character) {
        const mainClass = character.isMainCharacter ? 'main-character' : '';
        return `
            <div class="party-member ${mainClass}" data-character-id="${character.id}">
                <div class="character-info">
                    <h4>${character.name} ${character.isMainCharacter ? '(Main)' : ''}</h4>
                    <div class="character-details">
                        ${character.class} ${character.level} • ${character.race}
                        ${character.background ? '• ' + character.background : ''}
                    </div>
                </div>
                <div class="party-member-actions">
                    <button class="secondary-button" onclick="DNDCore.getModule('characterSheet').viewCharacter('${character.id}')">
                        View
                    </button>
                    ${!character.isMainCharacter ? `
                        <button class="tertiary-button" onclick="DNDCore.getModule('characterSheet').setMainCharacter('${character.id}')">
                            Set Main
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    updateCharacterSwitcher() {
        const switcher = document.getElementById('character-switcher');
        if (!switcher) return;

        switcher.innerHTML = '<option>Select Character</option>' + 
            this.party.map(character => 
                `<option value="${character.id}" ${character.id === this.currentCharacter?.id ? 'selected' : ''}>
                    ${character.name}
                </option>`
            ).join('');
    }

    viewCharacter(characterId) {
        this.switchCharacter(characterId);
        const ui = this.core.getModule('ui');
        ui?.showScreen('characterSheet');
    }

    setMainCharacter(characterId) {
        this.party.forEach(char => char.isMainCharacter = false);
        const character = this.party.find(char => char.id === characterId);
        if (character) {
            character.isMainCharacter = true;
            this.refreshPartyList();
            this.savePartyToStorage();
            
            const ui = this.core.getModule('ui');
            ui?.showNotification(`${character.name} is now the main character`, 'success');
        }
    }

    switchCharacter(characterId) {
        const character = this.party.find(char => char.id === characterId);
        if (character) {
            this.currentCharacter = character;
            this.displayCurrentCharacter();
        }
    }

    displayCurrentCharacter() {
        if (!this.currentCharacter) return;

        const char = this.currentCharacter;

        // Update header
        this.updateElement('character-name', char.name);
        this.updateElement('character-class-level', `${char.class} ${char.level}`);
        this.updateElement('character-race', char.race);

        // Update overview tab
        this.displayOverviewTab(char);
        this.displayAbilitiesTab(char);
        this.displaySkillsTab(char);
        this.displayInventoryTab(char);
        this.displaySpellsTab(char);
        this.displayFeaturesTab(char);
        this.displayRelationshipsTab(char);

        this.updateCharacterSwitcher();
    }

    displayOverviewTab(char) {
        // Vital stats
        this.updateElement('ac-value', char.armorClass);
        this.updateElement('current-hp', char.hitPoints.current, 'value');
        this.updateElement('max-hp', char.hitPoints.maximum);
        this.updateElement('speed-value', `${char.speed} ft`);
        this.updateElement('prof-bonus', `+${char.proficiencyBonus}`);

        // Ability scores
        Object.keys(char.abilityScores).forEach(ability => {
            const abbrev = ability.substring(0, 3);
            this.updateElement(`${abbrev}-score`, char.abilityScores[ability]);
            const modifier = char.abilityModifiers[ability];
            this.updateElement(`${abbrev}-mod`, modifier >= 0 ? `+${modifier}` : `${modifier}`);
        });

        // Character info
        this.updateElement('character-background', char.background || 'Unknown');
        this.updateElement('character-alignment', char.alignment || 'Unknown');
        this.updateElement('character-xp', `${char.experiencePoints} XP`);
    }

    displayAbilitiesTab(char) {
        // Saving throws
        const savesContainer = document.getElementById('saving-throws-list');
        if (savesContainer) {
            savesContainer.innerHTML = Object.keys(char.abilityScores).map(ability => {
                const save = char.savingThrows[ability];
                const isProficient = save?.proficient || false;
                const bonus = save?.bonus || char.abilityModifiers[ability];
                
                return `
                    <div class="save-item ${isProficient ? 'proficient' : ''}">
                        <span class="save-name">${this.capitalize(ability)}</span>
                        <span class="save-bonus">${bonus >= 0 ? '+' : ''}${bonus}</span>
                    </div>
                `;
            }).join('');
        }

        // Ability details
        const abilitiesContainer = document.getElementById('ability-details-list');
        if (abilitiesContainer) {
            abilitiesContainer.innerHTML = Object.keys(char.abilityScores).map(ability => {
                const score = char.abilityScores[ability];
                const modifier = char.abilityModifiers[ability];
                
                return `
                    <div class="ability-item">
                        <span class="ability-name-detail">${this.capitalize(ability)}</span>
                        <span>${score} (${modifier >= 0 ? '+' : ''}${modifier})</span>
                    </div>
                `;
            }).join('');
        }
    }

    displaySkillsTab(char) {
        const skillsContainer = document.getElementById('skills-list');
        if (!skillsContainer) return;

        const allSkills = [
            'acrobatics', 'animalhandling', 'arcana', 'athletics', 'deception', 'history',
            'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
            'performance', 'persuasion', 'religion', 'sleightofhand', 'stealth', 'survival'
        ];

        const skillNames = {
            'acrobatics': 'Acrobatics', 'animalhandling': 'Animal Handling', 'arcana': 'Arcana',
            'athletics': 'Athletics', 'deception': 'Deception', 'history': 'History',
            'insight': 'Insight', 'intimidation': 'Intimidation', 'investigation': 'Investigation',
            'medicine': 'Medicine', 'nature': 'Nature', 'perception': 'Perception',
            'performance': 'Performance', 'persuasion': 'Persuasion', 'religion': 'Religion',
            'sleightofhand': 'Sleight of Hand', 'stealth': 'Stealth', 'survival': 'Survival'
        };

        skillsContainer.innerHTML = allSkills.map(skillKey => {
            const skill = char.skills[skillKey];
            const isProficient = skill?.proficient || false;
            const bonus = skill?.bonus || this.calculateSkillBonus(skillKey, char);
            
            return `
                <div class="skill-item ${isProficient ? 'proficient' : ''}">
                    <span class="skill-name">${skillNames[skillKey]}</span>
                    <span class="skill-bonus">${bonus >= 0 ? '+' : ''}${bonus}</span>
                </div>
            `;
        }).join('');
    }

    displayInventoryTab(char) {
        // Weapons
        const weaponsContainer = document.getElementById('weapons-list');
        if (weaponsContainer) {
            if (char.equipment.weapons.length === 0) {
                weaponsContainer.innerHTML = '<p>No weapons</p>';
            } else {
                weaponsContainer.innerHTML = char.equipment.weapons.map(weapon => `
                    <div class="equipment-item">
                        <span class="equipment-name">${weapon.name}</span>
                        <span class="equipment-details">${weapon.damage || ''}</span>
                    </div>
                `).join('');
            }
        }

        // Armor
        const armorContainer = document.getElementById('armor-list');
        if (armorContainer) {
            if (char.equipment.armor.length === 0) {
                armorContainer.innerHTML = '<p>No armor</p>';
            } else {
                armorContainer.innerHTML = char.equipment.armor.map(armor => `
                    <div class="equipment-item">
                        <span class="equipment-name">${armor.name}</span>
                    </div>
                `).join('');
            }
        }

        // Items
        const itemsContainer = document.getElementById('items-list');
        if (itemsContainer) {
            if (char.equipment.items.length === 0) {
                itemsContainer.innerHTML = '<p>No items</p>';
            } else {
                itemsContainer.innerHTML = char.equipment.items.map(item => `
                    <div class="equipment-item">
                        <span class="equipment-name">${item.name}</span>
                    </div>
                `).join('');
            }
        }

        // Currency
        Object.keys(char.equipment.currency).forEach(coinType => {
            this.updateElement(`${coinType}-amount`, char.equipment.currency[coinType]);
        });
    }

    displaySpellsTab(char) {
        // Spellcasting info
        this.updateElement('spellcasting-ability', char.spells.spellcastingAbility ? this.capitalize(char.spells.spellcastingAbility) : 'None');
        this.updateElement('spell-save-dc', char.spells.spellSaveDC);
        this.updateElement('spell-attack-bonus', `+${char.spells.spellAttackBonus}`);

        // Spell slots
        const slotsContainer = document.getElementById('spell-slots-list');
        if (slotsContainer) {
            if (Object.keys(char.spells.spellSlots).length === 0) {
                slotsContainer.innerHTML = '<p>No spell slots</p>';
            } else {
                slotsContainer.innerHTML = Object.entries(char.spells.spellSlots).map(([level, slots]) => `
                    <div class="spell-slot">Level ${level}: ${slots} slots</div>
                `).join('');
            }
        }

        // Spells known
        const spellsContainer = document.getElementById('spells-list');
        if (spellsContainer) {
            const allSpells = [...char.spells.cantrips, ...char.spells.spellsKnown];
            
            if (allSpells.length === 0) {
                spellsContainer.innerHTML = '<p>No spells known</p>';
            } else {
                spellsContainer.innerHTML = allSpells.map(spell => `
                    <div class="spell-item">
                        <div class="spell-name">${spell.name}</div>
                        <div class="spell-level">${spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}</div>
                    </div>
                `).join('');
            }
        }
    }

    displayFeaturesTab(char) {
        const featuresContainer = document.getElementById('features-list');
        if (featuresContainer) {
            if (char.features.length === 0) {
                featuresContainer.innerHTML = '<p>No features or traits</p>';
            } else {
                featuresContainer.innerHTML = char.features.map(feature => `
                    <div class="feature-item">
                        <div class="feature-name">${feature.name}</div>
                        ${feature.description ? `<div class="feature-description">${feature.description}</div>` : ''}
                    </div>
                `).join('');
            }
        }
    }

    displayRelationshipsTab(char) {
        // Backstory elements
        this.updateElement('personality-traits', char.backstory.personalityTraits.join('; ') || 'None');
        this.updateElement('ideals', char.backstory.ideals.join('; ') || 'None');
        this.updateElement('bonds', char.backstory.bonds.join('; ') || 'None');
        this.updateElement('flaws', char.backstory.flaws.join('; ') || 'None');

        // Notes
        this.updateElement('character-notes', char.notes || '', 'value');
    }

    updateCurrentHP() {
        if (!this.currentCharacter) return;
        
        const hpInput = document.getElementById('current-hp');
        if (hpInput) {
            const newHP = parseInt(hpInput.value) || 0;
            this.currentCharacter.hitPoints.current = Math.max(0, Math.min(newHP, this.currentCharacter.hitPoints.maximum));
            hpInput.value = this.currentCharacter.hitPoints.current;
            this.currentCharacter.lastModified = new Date().toISOString();
        }
    }

    updateCharacterNotes() {
        if (!this.currentCharacter) return;
        
        const notesTextarea = document.getElementById('character-notes');
        if (notesTextarea) {
            this.currentCharacter.notes = notesTextarea.value;
            this.currentCharacter.lastModified = new Date().toISOString();
        }
    }

    calculateSkillBonus(skillKey, character) {
        const skillAbilityMap = {
            'acrobatics': 'dexterity', 'animalhandling': 'wisdom', 'arcana': 'intelligence',
            'athletics': 'strength', 'deception': 'charisma', 'history': 'intelligence',
            'insight': 'wisdom', 'intimidation': 'charisma', 'investigation': 'intelligence',
            'medicine': 'wisdom', 'nature': 'intelligence', 'perception': 'wisdom',
            'performance': 'charisma', 'persuasion': 'charisma', 'religion': 'intelligence',
            'sleightofhand': 'dexterity', 'stealth': 'dexterity', 'survival': 'wisdom'
        };

        const ability = skillAbilityMap[skillKey] || 'wisdom';
        const abilityMod = character.abilityModifiers[ability] || 0;
        const skill = character.skills[skillKey];
        const profBonus = skill?.proficient ? character.proficiencyBonus : 0;

        return abilityMod + profBonus;
    }

    saveCurrentCharacter() {
        if (!this.currentCharacter) return;

        this.currentCharacter.lastModified = new Date().toISOString();
        this.savePartyToStorage();
        
        // Save to campaign if available
        const campaign = this.core.appState.campaign;
        if (campaign) {
            campaign.party.characters = this.party.reduce((acc, char) => {
                acc[char.id] = char;
                return acc;
            }, {});
            
            const campaignManager = this.core.getModule('campaignManager');
            campaignManager?.saveCampaignToStorage(campaign);
        }

        const ui = this.core.getModule('ui');
        ui?.showNotification(`${this.currentCharacter.name} saved successfully!`, 'success');
    }

    savePartyToStorage() {
        try {
            localStorage.setItem('dnd_voice_party', JSON.stringify(this.party));
        } catch (error) {
            console.error('Failed to save party:', error);
        }
    }

    loadPartyFromStorage() {
        try {
            const partyData = localStorage.getItem('dnd_voice_party');
            if (partyData) {
                this.party = JSON.parse(partyData);
                this.currentCharacter = this.party.find(char => char.isMainCharacter) || this.party[0];
            }
        } catch (error) {
            console.error('Failed to load party:', error);
            this.party = [];
        }
    }

    continueToGame() {
        if (this.party.length === 0) {
            const ui = this.core.getModule('ui');
            ui?.showNotification('Please add at least one character to continue', 'error');
            return;
        }

        // For now, just show character sheet
        const ui = this.core.getModule('ui');
        ui?.showScreen('characterSheet');
    }

    updateElement(id, value, property = 'textContent') {
        const element = document.getElementById(id);
        if (element) {
            element[property] = value;
        }
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Public method for testing
    testParser() {
        return this.parser.testParser();
    }
}