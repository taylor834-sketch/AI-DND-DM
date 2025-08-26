export default class CombatManager {
    constructor(core) {
        this.core = core;
        this.currentCombat = null;
        this.combatants = [];
        this.currentTurn = 0;
        this.round = 0;
        this.init();
    }

    init() {
        this.core.on('combat:start', (event) => this.startCombat(event.detail));
        this.core.on('combat:end', (event) => this.endCombat(event.detail));
        this.core.on('combat:nextTurn', (event) => this.nextTurn());
        this.core.on('combat:attack', (event) => this.processAttack(event.detail));
        this.core.on('combat:addCombatant', (event) => this.addCombatant(event.detail));
    }

    startCombat(combatData) {
        try {
            this.currentCombat = {
                id: this.generateCombatId(),
                startTime: new Date().toISOString(),
                participants: combatData.participants || [],
                environment: combatData.environment || 'generic',
                conditions: combatData.conditions || {}
            };

            this.combatants = [...combatData.participants];
            this.rollInitiative();
            this.currentTurn = 0;
            this.round = 1;

            this.core.emit('combat:started', {
                combat: this.currentCombat,
                combatants: this.combatants,
                success: true
            });

            console.log('⚔️ Combat started!');
            this.announceCurrentTurn();
            
        } catch (error) {
            console.error('❌ Combat start failed:', error);
            this.core.emit('combat:started', { success: false, error });
        }
    }

    rollInitiative() {
        this.combatants.forEach(combatant => {
            const dexModifier = this.getAbilityModifier(combatant.abilities?.dexterity || 10);
            const roll = this.rollD20();
            combatant.initiative = roll + dexModifier;
            
            console.log(`🎲 ${combatant.name} rolled initiative: ${roll} + ${dexModifier} = ${combatant.initiative}`);
        });

        this.combatants.sort((a, b) => b.initiative - a.initiative);
    }

    nextTurn() {
        if (!this.currentCombat) {
            console.warn('⚠️ No active combat');
            return;
        }

        this.currentTurn++;
        
        if (this.currentTurn >= this.combatants.length) {
            this.currentTurn = 0;
            this.round++;
            console.log(`🔄 Round ${this.round} begins!`);
        }

        this.announceCurrentTurn();
        this.core.emit('combat:turnChanged', {
            currentCombatant: this.getCurrentCombatant(),
            turn: this.currentTurn,
            round: this.round
        });
    }

    getCurrentCombatant() {
        return this.combatants[this.currentTurn];
    }

    announceCurrentTurn() {
        const currentCombatant = this.getCurrentCombatant();
        if (currentCombatant) {
            console.log(`👤 ${currentCombatant.name}'s turn (Initiative: ${currentCombatant.initiative})`);
        }
    }

    processAttack(attackData) {
        const { attacker, target, weapon, attackType = 'melee' } = attackData;
        
        try {
            const attackRoll = this.rollD20();
            const attackBonus = this.calculateAttackBonus(attacker, weapon);
            const totalAttack = attackRoll + attackBonus;
            
            const targetAC = target.armorClass || 10;
            const isHit = totalAttack >= targetAC;
            const isCritical = attackRoll === 20;
            
            let damage = 0;
            if (isHit) {
                damage = this.calculateDamage(attacker, weapon, isCritical);
                this.applyDamage(target, damage);
            }

            const result = {
                attacker: attacker.name,
                target: target.name,
                attackRoll,
                attackBonus,
                totalAttack,
                targetAC,
                isHit,
                isCritical,
                damage,
                targetHP: target.hitPoints
            };

            this.core.emit('combat:attackResult', result);
            this.checkCombatEnd();
            
            return result;
            
        } catch (error) {
            console.error('❌ Attack processing failed:', error);
            this.core.emit('combat:attackResult', { success: false, error });
            return null;
        }
    }

    calculateAttackBonus(attacker, weapon) {
        const proficiencyBonus = this.getProficiencyBonus(attacker.level || 1);
        let abilityModifier;

        if (weapon?.finesse && attacker.abilities.dexterity > attacker.abilities.strength) {
            abilityModifier = this.getAbilityModifier(attacker.abilities.dexterity);
        } else {
            abilityModifier = this.getAbilityModifier(attacker.abilities.strength);
        }

        return abilityModifier + (weapon?.proficient ? proficiencyBonus : 0);
    }

    calculateDamage(attacker, weapon, isCritical = false) {
        const baseDamage = weapon?.damage || '1d4';
        let damageRoll = this.rollDamage(baseDamage);
        
        if (isCritical) {
            damageRoll += this.rollDamage(baseDamage);
        }

        const abilityModifier = weapon?.finesse ? 
            this.getAbilityModifier(Math.max(attacker.abilities.strength, attacker.abilities.dexterity)) :
            this.getAbilityModifier(attacker.abilities.strength);

        return Math.max(1, damageRoll + abilityModifier);
    }

    applyDamage(target, damage) {
        target.hitPoints = Math.max(0, target.hitPoints - damage);
        
        if (target.hitPoints === 0) {
            console.log(`💀 ${target.name} has fallen!`);
            target.status = 'unconscious';
        }
    }

    addCombatant(combatantData) {
        if (!this.currentCombat) {
            console.warn('⚠️ No active combat to add combatant to');
            return false;
        }

        const dexModifier = this.getAbilityModifier(combatantData.abilities?.dexterity || 10);
        combatantData.initiative = this.rollD20() + dexModifier;
        
        const insertIndex = this.combatants.findIndex(c => c.initiative < combatantData.initiative);
        
        if (insertIndex === -1) {
            this.combatants.push(combatantData);
        } else {
            this.combatants.splice(insertIndex, 0, combatantData);
            if (insertIndex <= this.currentTurn) {
                this.currentTurn++;
            }
        }

        this.core.emit('combat:combatantAdded', { combatant: combatantData });
        return true;
    }

    checkCombatEnd() {
        const aliveCombatants = this.combatants.filter(c => c.hitPoints > 0);
        const uniqueFactions = new Set(aliveCombatants.map(c => c.faction || 'neutral'));
        
        if (uniqueFactions.size <= 1) {
            this.endCombat({ victor: Array.from(uniqueFactions)[0] || 'unknown' });
        }
    }

    endCombat(endData = {}) {
        if (!this.currentCombat) {
            console.warn('⚠️ No active combat to end');
            return;
        }

        const combatResult = {
            ...this.currentCombat,
            endTime: new Date().toISOString(),
            duration: new Date() - new Date(this.currentCombat.startTime),
            rounds: this.round,
            victor: endData.victor,
            survivors: this.combatants.filter(c => c.hitPoints > 0)
        };

        this.currentCombat = null;
        this.combatants = [];
        this.currentTurn = 0;
        this.round = 0;

        this.core.emit('combat:ended', { result: combatResult, success: true });
        console.log('🏆 Combat ended!');
    }

    rollD20() {
        return Math.floor(Math.random() * 20) + 1;
    }

    rollDamage(diceExpression) {
        const match = diceExpression.match(/(\d+)d(\d+)(?:\+(\d+))?/);
        if (!match) return 1;

        const [, numDice, sides, bonus] = match;
        let total = 0;
        
        for (let i = 0; i < parseInt(numDice); i++) {
            total += Math.floor(Math.random() * parseInt(sides)) + 1;
        }
        
        return total + (parseInt(bonus) || 0);
    }

    getAbilityModifier(abilityScore) {
        return Math.floor((abilityScore - 10) / 2);
    }

    getProficiencyBonus(level) {
        return Math.ceil(level / 4) + 1;
    }

    generateCombatId() {
        return `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}