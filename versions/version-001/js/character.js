export default class CharacterManager {
    constructor(core) {
        this.core = core;
        this.currentCharacter = null;
        this.characterTemplates = this.loadCharacterTemplates();
        this.init();
    }

    init() {
        this.core.on('character:create', (event) => this.createCharacter(event.detail));
        this.core.on('character:load', (event) => this.loadCharacter(event.detail.characterId));
        this.core.on('character:save', (event) => this.saveCharacter(event.detail));
        this.core.on('character:update', (event) => this.updateCharacter(event.detail));
    }

    loadCharacterTemplates() {
        return {
            fighter: {
                name: 'Fighter',
                hitDie: 'd10',
                primaryAbility: 'Strength or Dexterity',
                savingThrows: ['Strength', 'Constitution'],
                skills: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
                equipment: ['Chain mail', 'Shield', 'Martial weapon', 'Light crossbow with 20 bolts']
            },
            wizard: {
                name: 'Wizard',
                hitDie: 'd6',
                primaryAbility: 'Intelligence',
                savingThrows: ['Intelligence', 'Wisdom'],
                skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'],
                equipment: ['Quarterstaff', 'Dagger', 'Component pouch', 'Spellbook', 'Scholar\'s pack']
            },
            rogue: {
                name: 'Rogue',
                hitDie: 'd8',
                primaryAbility: 'Dexterity',
                savingThrows: ['Dexterity', 'Intelligence'],
                skills: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'],
                equipment: ['Leather armor', 'Short sword', 'Shortbow with 20 arrows', 'Thieves\' tools', 'Burglar\'s pack']
            }
        };
    }

    createCharacter(characterData) {
        try {
            const character = {
                id: this.generateCharacterId(),
                ...characterData,
                level: characterData.level || 1,
                hitPoints: characterData.hitPoints || this.calculateInitialHP(characterData),
                maxHitPoints: characterData.maxHitPoints || this.calculateInitialHP(characterData),
                experience: characterData.experience || 0,
                abilities: this.initializeAbilities(characterData.abilities),
                skills: this.initializeSkills(characterData.skills, characterData.class),
                equipment: characterData.equipment || [],
                spells: characterData.spells || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.currentCharacter = character;
            this.core.emit('character:created', { character, success: true });
            
            return character;
        } catch (error) {
            console.error('❌ Character creation failed:', error);
            this.core.emit('character:created', { success: false, error });
            return null;
        }
    }

    loadCharacter(characterId) {
        try {
            const characterData = localStorage.getItem(`dnd_voice_character_${characterId}`);
            
            if (!characterData) {
                throw new Error(`Character ${characterId} not found`);
            }

            const character = JSON.parse(characterData);
            this.currentCharacter = character;
            
            this.core.emit('character:loaded', { character, success: true });
            return character;
        } catch (error) {
            console.error('❌ Character load failed:', error);
            this.core.emit('character:loaded', { success: false, error });
            return null;
        }
    }

    saveCharacter(characterData = null) {
        try {
            const character = characterData || this.currentCharacter;
            if (!character) {
                throw new Error('No character data to save');
            }

            character.updatedAt = new Date().toISOString();
            
            localStorage.setItem(
                `dnd_voice_character_${character.id}`,
                JSON.stringify(character)
            );

            this.core.emit('character:saved', { character, success: true });
            return true;
        } catch (error) {
            console.error('❌ Character save failed:', error);
            this.core.emit('character:saved', { success: false, error });
            return false;
        }
    }

    updateCharacter(updates) {
        if (!this.currentCharacter) {
            console.warn('⚠️ No character loaded for update');
            return false;
        }

        this.currentCharacter = { ...this.currentCharacter, ...updates };
        return this.saveCharacter();
    }

    initializeAbilities(customAbilities = {}) {
        const defaultAbilities = {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10
        };

        return { ...defaultAbilities, ...customAbilities };
    }

    initializeSkills(customSkills = {}, characterClass) {
        const allSkills = {
            acrobatics: { ability: 'dexterity', proficient: false, value: 0 },
            animalHandling: { ability: 'wisdom', proficient: false, value: 0 },
            arcana: { ability: 'intelligence', proficient: false, value: 0 },
            athletics: { ability: 'strength', proficient: false, value: 0 },
            deception: { ability: 'charisma', proficient: false, value: 0 },
            history: { ability: 'intelligence', proficient: false, value: 0 },
            insight: { ability: 'wisdom', proficient: false, value: 0 },
            intimidation: { ability: 'charisma', proficient: false, value: 0 },
            investigation: { ability: 'intelligence', proficient: false, value: 0 },
            medicine: { ability: 'wisdom', proficient: false, value: 0 },
            nature: { ability: 'intelligence', proficient: false, value: 0 },
            perception: { ability: 'wisdom', proficient: false, value: 0 },
            performance: { ability: 'charisma', proficient: false, value: 0 },
            persuasion: { ability: 'charisma', proficient: false, value: 0 },
            religion: { ability: 'intelligence', proficient: false, value: 0 },
            sleightOfHand: { ability: 'dexterity', proficient: false, value: 0 },
            stealth: { ability: 'dexterity', proficient: false, value: 0 },
            survival: { ability: 'wisdom', proficient: false, value: 0 }
        };

        return { ...allSkills, ...customSkills };
    }

    calculateInitialHP(characterData) {
        const baseHP = characterData.class === 'wizard' ? 6 : 
                      characterData.class === 'rogue' ? 8 : 10;
        const conModifier = Math.floor((characterData.abilities?.constitution || 10) - 10) / 2;
        return Math.max(1, baseHP + conModifier);
    }

    generateCharacterId() {
        return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getAbilityModifier(abilityScore) {
        return Math.floor((abilityScore - 10) / 2);
    }

    calculateSkillModifier(skillName, character = null) {
        const char = character || this.currentCharacter;
        if (!char) return 0;

        const skill = char.skills[skillName];
        if (!skill) return 0;

        const abilityScore = char.abilities[skill.ability];
        const abilityModifier = this.getAbilityModifier(abilityScore);
        const proficiencyBonus = skill.proficient ? this.getProficiencyBonus(char.level) : 0;

        return abilityModifier + proficiencyBonus;
    }

    getProficiencyBonus(level) {
        return Math.ceil(level / 4) + 1;
    }
}