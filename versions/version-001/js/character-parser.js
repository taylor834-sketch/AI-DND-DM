export default class CharacterParser {
    constructor() {
        this.abilityScores = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
        this.skills = [
            'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History',
            'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception',
            'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'
        ];
        this.savingThrows = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
    }

    parseCharacterSheet(text) {
        console.log('🔍 Parsing D&D Beyond character sheet...');
        
        const character = this.initializeCharacterData();
        
        try {
            // Clean and normalize the text
            const cleanText = this.cleanText(text);
            const lines = cleanText.split('\n').filter(line => line.trim());
            
            // Use multiple parsing strategies
            this.parseBasicInfo(lines, character);
            this.parseAbilityScores(lines, character);
            this.parseArmorClassAndHP(lines, character);
            this.parseSkills(lines, character);
            this.parseSavingThrows(lines, character);
            this.parseEquipment(lines, character);
            this.parseSpells(lines, character);
            this.parseFeatures(lines, character);
            this.parseBackstory(lines, character);
            
            // Calculate derived stats
            this.calculateDerivedStats(character);
            
            console.log('✅ Character parsed successfully:', character.name);
            return character;
            
        } catch (error) {
            console.error('❌ Error parsing character sheet:', error);
            throw new Error(`Failed to parse character sheet: ${error.message}`);
        }
    }

    initializeCharacterData() {
        return {
            id: this.generateCharacterId(),
            name: '',
            class: '',
            level: 1,
            race: '',
            background: '',
            alignment: '',
            experiencePoints: 0,
            abilityScores: {
                strength: 10,
                dexterity: 10,
                constitution: 10,
                intelligence: 10,
                wisdom: 10,
                charisma: 10
            },
            abilityModifiers: {},
            armorClass: 10,
            hitPoints: {
                current: 1,
                maximum: 1,
                temporary: 0
            },
            hitDie: 'd8',
            hitDieCount: 1,
            speed: 30,
            proficiencyBonus: 2,
            savingThrows: {},
            skills: {},
            proficiencies: {
                armor: [],
                weapons: [],
                tools: [],
                languages: []
            },
            equipment: {
                weapons: [],
                armor: [],
                items: [],
                currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }
            },
            spells: {
                spellcastingAbility: '',
                spellSaveDC: 8,
                spellAttackBonus: 0,
                spellSlots: {},
                spellsKnown: [],
                cantrips: []
            },
            features: [],
            backstory: {
                personalityTraits: [],
                ideals: [],
                bonds: [],
                flaws: [],
                backstory: ''
            },
            notes: '',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
    }

    cleanText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    parseBasicInfo(lines, character) {
        // Look for character name (usually first line or after specific patterns)
        const namePatterns = [
            /^(.+?)(?:\s+(?:Level|Lv\.?\s*)\d+)?$/i,
            /^Name:?\s*(.+)$/i,
            /^Character Name:?\s*(.+)$/i
        ];

        // Look for class and level
        const classLevelPatterns = [
            /(\w+(?:\s+\w+)*)\s+(?:Level|Lv\.?\s*)(\d+)/i,
            /Level\s*(\d+)\s+(\w+(?:\s+\w+)*)/i,
            /^(.+?)\s*(\d+)$/i
        ];

        // Look for race
        const racePatterns = [
            /Race:?\s*(.+?)(?:\s|$)/i,
            /^(.+?)\s+(?:Variant|Half-|Dark)?(?:Elf|Dwarf|Halfling|Human|Dragonborn|Gnome|Tiefling|Orc)/i
        ];

        // Look for background
        const backgroundPatterns = [
            /Background:?\s*(.+?)(?:\s|$)/i,
            /^(.+?)(?:\s+Background)?$/i
        ];

        // Look for alignment
        const alignmentPatterns = [
            /Alignment:?\s*((?:Lawful|Neutral|Chaotic)?\s*(?:Good|Neutral|Evil|Unaligned))/i,
            /(Lawful Good|Lawful Neutral|Lawful Evil|Neutral Good|True Neutral|Neutral Evil|Chaotic Good|Chaotic Neutral|Chaotic Evil|Unaligned)/i
        ];

        for (let i = 0; i < Math.min(lines.length, 20); i++) {
            const line = lines[i].trim();
            
            // Try to extract name
            if (!character.name && line && !line.includes('Level') && !line.includes('Class')) {
                const nameMatch = namePatterns.find(pattern => pattern.test(line));
                if (nameMatch) {
                    const match = line.match(nameMatch);
                    if (match && match[1] && match[1].length > 2) {
                        character.name = match[1].trim();
                    }
                }
            }

            // Try to extract class and level
            classLevelPatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match) {
                    if (pattern.source.includes('Level.*\\d+')) {
                        character.level = parseInt(match[1]) || 1;
                        character.class = match[2] || '';
                    } else {
                        character.class = match[1] || '';
                        character.level = parseInt(match[2]) || 1;
                    }
                }
            });

            // Try to extract race
            racePatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match && !character.race) {
                    character.race = match[1].trim();
                }
            });

            // Try to extract background
            backgroundPatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match && line.toLowerCase().includes('background') && !character.background) {
                    character.background = match[1].trim();
                }
            });

            // Try to extract alignment
            alignmentPatterns.forEach(pattern => {
                const match = line.match(pattern);
                if (match && !character.alignment) {
                    character.alignment = match[1].trim();
                }
            });
        }

        // Calculate proficiency bonus based on level
        character.proficiencyBonus = Math.ceil(character.level / 4) + 1;
    }

    parseAbilityScores(lines, character) {
        const abilityPatterns = [
            // "Strength 16 (+3)"
            /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(\d+)\s*\(\s*([+-]?\d+)\s*\)/gi,
            // "STR 16 +3"
            /(STR|DEX|CON|INT|WIS|CHA)\s+(\d+)\s*([+-]?\d+)/gi,
            // "Strength: 16"
            /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma):\s*(\d+)/gi
        ];

        const abilityMapping = {
            'STR': 'strength', 'Strength': 'strength',
            'DEX': 'dexterity', 'Dexterity': 'dexterity',
            'CON': 'constitution', 'Constitution': 'constitution',
            'INT': 'intelligence', 'Intelligence': 'intelligence',
            'WIS': 'wisdom', 'Wisdom': 'wisdom',
            'CHA': 'charisma', 'Charisma': 'charisma'
        };

        const fullText = lines.join(' ');
        
        abilityPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(fullText)) !== null) {
                const abilityName = abilityMapping[match[1]];
                const score = parseInt(match[2]);
                
                if (abilityName && score >= 1 && score <= 30) {
                    character.abilityScores[abilityName] = score;
                }
            }
        });
    }

    parseArmorClassAndHP(lines, character) {
        const acPatterns = [
            /(?:Armor Class|AC):\s*(\d+)/i,
            /AC\s+(\d+)/i
        ];

        const hpPatterns = [
            /(?:Hit Points|HP):\s*(\d+)(?:\s*\/\s*(\d+))?/i,
            /HP\s+(\d+)(?:\s*\/\s*(\d+))?/i,
            /(\d+)\s*\/\s*(\d+)\s*(?:Hit Points|HP)/i
        ];

        const speedPatterns = [
            /Speed:\s*(\d+)\s*(?:ft|feet)?/i,
            /(\d+)\s*(?:ft|feet)?\s*speed/i
        ];

        const fullText = lines.join(' ');

        // Parse Armor Class
        acPatterns.forEach(pattern => {
            const match = fullText.match(pattern);
            if (match) {
                character.armorClass = parseInt(match[1]) || 10;
            }
        });

        // Parse Hit Points
        hpPatterns.forEach(pattern => {
            const match = fullText.match(pattern);
            if (match) {
                if (match[2]) {
                    // "current/max" format
                    character.hitPoints.current = parseInt(match[1]) || 1;
                    character.hitPoints.maximum = parseInt(match[2]) || 1;
                } else {
                    // Single number (assume it's maximum)
                    character.hitPoints.maximum = parseInt(match[1]) || 1;
                    character.hitPoints.current = character.hitPoints.maximum;
                }
            }
        });

        // Parse Speed
        speedPatterns.forEach(pattern => {
            const match = fullText.match(pattern);
            if (match) {
                character.speed = parseInt(match[1]) || 30;
            }
        });
    }

    parseSkills(lines, character) {
        const fullText = lines.join(' ');
        
        // Look for skill proficiencies with bonuses
        const skillPatterns = [
            new RegExp(`(${this.skills.join('|')})\\s+([+-]?\\d+)`, 'gi'),
            new RegExp(`(${this.skills.join('|')})\\s*\\(([+-]?\\d+)\\)`, 'gi')
        ];

        skillPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(fullText)) !== null) {
                const skillName = match[1].toLowerCase().replace(/\s+/g, '');
                const bonus = parseInt(match[2]);
                
                if (!isNaN(bonus)) {
                    character.skills[skillName] = {
                        proficient: true,
                        bonus: bonus
                    };
                }
            }
        });

        // Look for skill lists (proficient skills without bonuses)
        const skillListPattern = new RegExp(`(?:Skills?|Proficient in):\\s*([^.]+)`, 'i');
        const skillListMatch = fullText.match(skillListPattern);
        
        if (skillListMatch) {
            const skillList = skillListMatch[1];
            this.skills.forEach(skill => {
                if (skillList.toLowerCase().includes(skill.toLowerCase())) {
                    const skillKey = skill.toLowerCase().replace(/\s+/g, '');
                    if (!character.skills[skillKey]) {
                        character.skills[skillKey] = {
                            proficient: true,
                            bonus: 0 // Will be calculated later
                        };
                    }
                }
            });
        }
    }

    parseSavingThrows(lines, character) {
        const fullText = lines.join(' ');
        
        const savingThrowPatterns = [
            /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+(?:saving throw|save)?\s*([+-]?\d+)/gi,
            /(STR|DEX|CON|INT|WIS|CHA)\s+(?:save)?\s*([+-]?\d+)/gi
        ];

        const abilityMapping = {
            'STR': 'strength', 'Strength': 'strength',
            'DEX': 'dexterity', 'Dexterity': 'dexterity',
            'CON': 'constitution', 'Constitution': 'constitution',
            'INT': 'intelligence', 'Intelligence': 'intelligence',
            'WIS': 'wisdom', 'Wisdom': 'wisdom',
            'CHA': 'charisma', 'Charisma': 'charisma'
        };

        savingThrowPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(fullText)) !== null) {
                const abilityName = abilityMapping[match[1]];
                const bonus = parseInt(match[2]);
                
                if (abilityName && !isNaN(bonus)) {
                    character.savingThrows[abilityName] = {
                        proficient: true,
                        bonus: bonus
                    };
                }
            }
        });
    }

    parseEquipment(lines, character) {
        const equipmentSection = this.findSection(lines, ['equipment', 'gear', 'inventory']);
        
        if (equipmentSection.length > 0) {
            equipmentSection.forEach(line => {
                // Parse weapons
                const weaponPattern = /(\w+(?:\s+\w+)*)\s*(?:\+\d+)?\s*(?:(\d+d\d+(?:\s*[+-]\s*\d+)?)|(\d+)\s*(?:damage|dmg)?)/i;
                const weaponMatch = line.match(weaponPattern);
                
                if (weaponMatch) {
                    character.equipment.weapons.push({
                        name: weaponMatch[1].trim(),
                        damage: weaponMatch[2] || weaponMatch[3] || '',
                        type: 'weapon'
                    });
                }

                // Parse armor
                const armorPattern = /(\w+(?:\s+\w+)*)\s*(?:armor|mail|plate|leather|chain)/i;
                const armorMatch = line.match(armorPattern);
                
                if (armorMatch && !weaponMatch) {
                    character.equipment.armor.push({
                        name: armorMatch[0].trim(),
                        type: 'armor'
                    });
                }

                // Parse currency
                const currencyPattern = /(\d+)\s*(cp|sp|ep|gp|pp)/gi;
                let currencyMatch;
                while ((currencyMatch = currencyPattern.exec(line)) !== null) {
                    const amount = parseInt(currencyMatch[1]);
                    const type = currencyMatch[2].toLowerCase();
                    character.equipment.currency[type] = (character.equipment.currency[type] || 0) + amount;
                }

                // Parse general items
                if (!weaponMatch && !armorMatch && !currencyPattern.test(line)) {
                    const itemPattern = /^(.+?)(?:\s*\(\d+\))?$/;
                    const itemMatch = line.match(itemPattern);
                    if (itemMatch && itemMatch[1].trim().length > 2) {
                        character.equipment.items.push({
                            name: itemMatch[1].trim(),
                            type: 'item'
                        });
                    }
                }
            });
        }
    }

    parseSpells(lines, character) {
        const spellSection = this.findSection(lines, ['spells', 'spell list', 'cantrips']);
        
        if (spellSection.length > 0) {
            // Look for spellcasting ability
            const spellcastingPattern = /(?:Spellcasting Ability|Spell Save DC):\s*(\w+)|(\w+)\s+(?:is your spellcasting ability)/i;
            const fullText = lines.join(' ');
            const spellcastingMatch = fullText.match(spellcastingPattern);
            
            if (spellcastingMatch) {
                character.spells.spellcastingAbility = (spellcastingMatch[1] || spellcastingMatch[2]).toLowerCase();
            }

            // Parse spell slots
            const slotPattern = /(\d+)(?:st|nd|rd|th)\s*level.*?(\d+)\s*slot/gi;
            let slotMatch;
            while ((slotMatch = slotPattern.exec(fullText)) !== null) {
                const level = parseInt(slotMatch[1]);
                const slots = parseInt(slotMatch[2]);
                character.spells.spellSlots[level] = slots;
            }

            // Parse individual spells
            spellSection.forEach(line => {
                // Look for spell names (usually capitalized, may have level indicators)
                const spellPattern = /^(.+?)(?:\s*\([^)]*\))?(?:\s*-.*)?$/;
                const spellMatch = line.match(spellPattern);
                
                if (spellMatch) {
                    const spellName = spellMatch[1].trim();
                    
                    // Check if it's a cantrip
                    if (line.toLowerCase().includes('cantrip') || 
                        ['Minor Illusion', 'Prestidigitation', 'Mage Hand', 'Light'].some(cantrip => 
                            spellName.toLowerCase().includes(cantrip.toLowerCase()))) {
                        character.spells.cantrips.push({
                            name: spellName,
                            level: 0
                        });
                    } else {
                        // Extract spell level if present
                        const levelMatch = line.match(/(\d+)(?:st|nd|rd|th)\s*level/i);
                        const level = levelMatch ? parseInt(levelMatch[1]) : 1;
                        
                        character.spells.spellsKnown.push({
                            name: spellName,
                            level: level
                        });
                    }
                }
            });
        }
    }

    parseFeatures(lines, character) {
        const featureSection = this.findSection(lines, ['features', 'traits', 'abilities', 'class features']);
        
        featureSection.forEach(line => {
            const featurePattern = /^(.+?)(?:\s*\([^)]*\))?(?:\s*:.*)?$/;
            const featureMatch = line.match(featurePattern);
            
            if (featureMatch) {
                const featureName = featureMatch[1].trim();
                if (featureName.length > 2) {
                    character.features.push({
                        name: featureName,
                        description: line.includes(':') ? line.split(':').slice(1).join(':').trim() : '',
                        source: 'parsed'
                    });
                }
            }
        });
    }

    parseBackstory(lines, character) {
        const backstoryKeywords = ['personality', 'trait', 'ideal', 'bond', 'flaw', 'backstory'];
        
        lines.forEach(line => {
            const lowerLine = line.toLowerCase();
            
            if (lowerLine.includes('personality') && lowerLine.includes('trait')) {
                const trait = line.split(':').slice(1).join(':').trim();
                if (trait) character.backstory.personalityTraits.push(trait);
            }
            
            if (lowerLine.includes('ideal')) {
                const ideal = line.split(':').slice(1).join(':').trim();
                if (ideal) character.backstory.ideals.push(ideal);
            }
            
            if (lowerLine.includes('bond')) {
                const bond = line.split(':').slice(1).join(':').trim();
                if (bond) character.backstory.bonds.push(bond);
            }
            
            if (lowerLine.includes('flaw')) {
                const flaw = line.split(':').slice(1).join(':').trim();
                if (flaw) character.backstory.flaws.push(flaw);
            }
            
            if (lowerLine.includes('backstory') && line.includes(':')) {
                const backstory = line.split(':').slice(1).join(':').trim();
                if (backstory) character.backstory.backstory = backstory;
            }
        });
    }

    findSection(lines, keywords) {
        const sectionLines = [];
        let inSection = false;
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            // Check if we're entering a relevant section
            if (keywords.some(keyword => lowerLine.includes(keyword))) {
                inSection = true;
                continue;
            }
            
            // Check if we're leaving the section (new major section starts)
            if (inSection && (lowerLine.includes('---') || 
                            lowerLine.match(/^[A-Z][A-Z\s]+:/) ||
                            lowerLine.match(/^(abilities|skills|equipment|spells|features|backstory)/i))) {
                if (!keywords.some(keyword => lowerLine.includes(keyword))) {
                    inSection = false;
                }
            }
            
            if (inSection && line.trim()) {
                sectionLines.push(line.trim());
            }
        }
        
        return sectionLines;
    }

    calculateDerivedStats(character) {
        // Calculate ability modifiers
        Object.keys(character.abilityScores).forEach(ability => {
            const score = character.abilityScores[ability];
            character.abilityModifiers[ability] = Math.floor((score - 10) / 2);
        });

        // Calculate skill bonuses for skills without explicit bonuses
        Object.keys(character.skills).forEach(skillKey => {
            const skill = character.skills[skillKey];
            if (skill.proficient && skill.bonus === 0) {
                const abilityModifier = this.getSkillAbilityModifier(skillKey, character);
                skill.bonus = abilityModifier + (skill.proficient ? character.proficiencyBonus : 0);
            }
        });

        // Calculate saving throw bonuses
        Object.keys(character.savingThrows).forEach(ability => {
            const save = character.savingThrows[ability];
            if (save.proficient && save.bonus === 0) {
                save.bonus = character.abilityModifiers[ability] + character.proficiencyBonus;
            }
        });

        // Calculate spell save DC and attack bonus if spellcaster
        if (character.spells.spellcastingAbility) {
            const abilityMod = character.abilityModifiers[character.spells.spellcastingAbility] || 0;
            character.spells.spellSaveDC = 8 + character.proficiencyBonus + abilityMod;
            character.spells.spellAttackBonus = character.proficiencyBonus + abilityMod;
        }
    }

    getSkillAbilityModifier(skillKey, character) {
        const skillAbilityMap = {
            'acrobatics': 'dexterity',
            'animalhandling': 'wisdom',
            'arcana': 'intelligence',
            'athletics': 'strength',
            'deception': 'charisma',
            'history': 'intelligence',
            'insight': 'wisdom',
            'intimidation': 'charisma',
            'investigation': 'intelligence',
            'medicine': 'wisdom',
            'nature': 'intelligence',
            'perception': 'wisdom',
            'performance': 'charisma',
            'persuasion': 'charisma',
            'religion': 'intelligence',
            'sleightofhand': 'dexterity',
            'stealth': 'dexterity',
            'survival': 'wisdom'
        };

        const ability = skillAbilityMap[skillKey] || 'wisdom';
        return character.abilityModifiers[ability] || 0;
    }

    generateCharacterId() {
        return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Test method to validate parsing with sample data
    testParser() {
        const sampleDnDBeyondText = `
Kaelyn Brightblade
Human Fighter Level 5

Armor Class: 18
Hit Points: 45/45
Speed: 30 ft

STR 16 (+3)
DEX 14 (+2) 
CON 15 (+2)
INT 12 (+1)
WIS 13 (+1)
CHA 10 (+0)

Saving Throws:
Strength +6
Constitution +5

Skills:
Athletics +6
Intimidation +3
Perception +4

Equipment:
Longsword +1
Chain Mail
Shield
50 gp
Adventurer's Pack

Features:
Fighting Style: Defense
Second Wind
Action Surge
Extra Attack

Background: Soldier
Personality Trait: I face problems head-on.
Ideal: Responsibility. I do what I must.
Bond: I fight for those who cannot fight for themselves.
Flaw: I have trouble trusting in my allies' abilities.
        `;

        return this.parseCharacterSheet(sampleDnDBeyondText);
    }
}