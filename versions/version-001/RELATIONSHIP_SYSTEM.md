# 🎭 Advanced Relationship System

## Overview
The D&D Voice Adventure relationship system provides a comprehensive framework for tracking individual trust levels, faction reputation, companion approval, and romance mechanics. All relationship changes cascade through the world, creating meaningful consequences that the AI DM can reference for dynamic storytelling.

## ✨ Key Features

### 🤝 Individual Relationships (0-100 Trust Scale)
- **Dynamic Trust Levels**: Real-time tracking from 0-100 with automatic relationship type updates
- **Consequence Propagation**: Actions affecting one NPC impact their allies and enemies
- **Interaction History**: Detailed logs of every relationship change with reasons and timestamps
- **Romance System**: Multi-stage romance progression with jealousy mechanics
- **Relationship Decay**: Natural erosion over time without maintenance

### 🏛️ Faction Reputation System
- **Cascading Effects**: Reputation changes flow through allied/enemy faction networks
- **Member Impact**: Faction reputation affects individual relationships with faction members  
- **Power Dynamics**: Different factions have varying levels of influence
- **Historical Tracking**: Complete history of reputation changes and their causes

### 👥 Companion Approval System
- **Approval Thresholds**: 6 distinct levels from Hatred to Devoted
- **Romance Mechanics**: Multi-stage romance system with availability gates
- **Personal Quests**: Approval-locked companion storylines
- **Jealousy System**: Multiple romance attempts create complications
- **Moral Alignment**: Companions react to player choices based on their values

### 🎯 Visual Integration
- **Relationship Indicators**: Real-time visual feedback throughout the UI
- **Progress Bars**: Trust and approval levels with color-coded progress
- **Status Badges**: Immediate relationship status identification
- **Tooltips**: Detailed relationship information on hover
- **Notification System**: Live updates when relationships change

## 🤖 AI DM Integration

### Query System
The AI DM can access relationship data through multiple query types:

```javascript
// Get all allies who can help
const allies = relationshipSystem.queryForAIDM('allies', { threshold: 70 });

// Get enemies who might oppose the party
const enemies = relationshipSystem.queryForAIDM('enemies');

// Get romantic interests and their status
const romances = relationshipSystem.queryForAIDM('romantic');

// Get faction conflicts
const conflicts = relationshipSystem.queryForAIDM('faction_conflicts');
```

### Context Types
- **Conversation Context**: Available topics based on trust levels
- **Quest Help Context**: Who can provide assistance and at what cost
- **Social Encounter Context**: Reputation modifiers and introduction bonuses
- **Romance Context**: Active romances, jealousy risks, and available options

### Dynamic Capabilities
Based on relationship levels, NPCs can provide different services:
- **Trust 50+**: Basic information, common items, directions
- **Trust 70+**: Valuable items, important introductions, shelter
- **Trust 90+**: Secret information, dangerous favors, personal sacrifice

## 🧪 Test Scenarios

### Scenario 1: Building Positive Relationships
- **Help Elara with Bandits**: +15 trust, +8 faction reputation
- **Honest Trade**: +5 trust, builds consistency bonus
- **Return Lost Item**: +20 trust, major honesty bonus

### Scenario 2: Damaging Relationships
- **Steal from Merchant**: -25 trust, -15 faction reputation, guard suspicion
- **Break Promise**: -20 trust, honor-based characters remember
- **Public Insults**: -15 trust, wider faction consequences

### Scenario 3: Faction Conflicts
- **Help Guards vs Thieves**: +20 guards, -25 thieves, lasting enemies
- **Secret Alliances**: +15 thieves, but risk of discovery
- **Diplomatic Solutions**: Small gains with both sides, but limited trust

### Scenario 4: Companion Approval
- **Align with Values**: +12 approval, strong relationship building
- **Conflict with Values**: -8 approval, reduces available options
- **Romance Progression**: Requires 70+ approval, creates jealousy effects

### Scenario 5: Long-term Consequences
- **Time Passage**: Natural decay without interaction
- **Major Quests**: Wide-reaching positive effects (+25-30 across board)
- **Betrayals**: Massive negative consequences (-40-50), permanent damage

## 🎮 How to Use

### For Players
1. **Monitor Relationships**: Check the World Browser for current standings
2. **Consider Consequences**: Actions ripple through connected NPCs and factions
3. **Maintain Relationships**: Regular positive interactions prevent decay
4. **Romance Carefully**: Multiple romantic pursuits create jealousy
5. **Align with Companions**: Support their values for better approval

### For AI DMs
```javascript
// Get comprehensive relationship context
const context = relationshipSystem.getAIDMContext();

// Check what help is available for a quest
const questHelp = relationshipSystem.getAIDMRelationshipContext('quest_help');

// Determine conversation options based on trust
const convOptions = relationshipSystem.getAIDMRelationshipContext('conversation');

// Check romance status for story beats
const romanceContext = relationshipSystem.getAIDMRelationshipContext('romance_check');
```

### Integration Examples

**Story Decisions**: 
```javascript
const allies = relationshipSystem.queryForAIDM('allies');
if (allies.length > 0) {
    // Allies can provide warning about upcoming danger
    // Show different story path options
}
```

**Dynamic Pricing**:
```javascript
const merchantTrust = relationshipSystem.getIndividualRelationship('merchant-id').trustLevel;
const discount = Math.floor((merchantTrust - 50) / 10) * 5; // 5% per 10 trust above 50
```

**Companion Reactions**:
```javascript
const approval = relationshipSystem.getCompanionApproval('companion-id');
if (approval.approval < 30) {
    // Companion objects to player's plans
    // May leave the party if approval drops too low
}
```

## 📊 Relationship Mechanics

### Trust Level Ranges
- **0-10**: Enemy (Active hostility, may attack)
- **11-30**: Unfriendly (Suspicious, unhelpful)
- **31-40**: Neutral (Professional distance)
- **41-70**: Friendly (Helpful, positive interactions)
- **71-90**: Ally (Strong support, will take risks)
- **91-100**: Devoted (Complete loyalty, personal sacrifice)

### Faction Reputation Ranges
- **-100 to -50**: Hated/Hostile (Active opposition)
- **-49 to -25**: Unfriendly (Suspicious, disadvantages)
- **-24 to 24**: Neutral (Standard treatment)
- **25-50**: Friendly (Small bonuses, easier interactions)
- **51-100**: Honored/Revered (Major bonuses, special access)

### Romance Progression
- **None**: No romantic interest
- **Interested**: Initial attraction (70+ approval needed)
- **Courting**: Active romance (80+ approval needed)  
- **Committed**: Serious relationship (90+ approval needed)
- **Married**: Ultimate relationship status (quest-dependent)

## 🔄 Relationship Flow

```
Player Action
    ↓
Trust/Approval Change
    ↓
Relationship Type Update
    ↓
Consequence Propagation (Allies/Enemies)
    ↓
Faction Cascade (if applicable)
    ↓
Visual Indicator Updates
    ↓
AI DM Context Updates
```

## 💡 Best Practices

### For Meaningful Relationships
1. **Consistency Matters**: Small positive actions over time build stronger relationships than single large gestures
2. **Values Alignment**: Understanding NPC motivations and values creates deeper connections
3. **Consequence Awareness**: Consider how actions toward one NPC affect their network
4. **Maintenance Required**: Relationships naturally decay without interaction
5. **Choose Wisely**: Some relationship conflicts are irreconcilable (Guards vs Thieves)

### For AI DM Implementation
1. **Reference Context**: Always check relationship status before major story beats
2. **Dynamic Reactions**: NPCs should react differently based on current relationship status
3. **Cascading Stories**: Use faction relationships to create interconnected plot threads
4. **Romance Complexity**: Romance isn't just approval - consider jealousy and social dynamics
5. **Long-term Impact**: Major relationship changes should have lasting story consequences

## 🛠️ Technical Implementation

The relationship system consists of four main modules:

1. **RelationshipSystem** (`relationship-system.js`): Core logic and data management
2. **RelationshipUI** (`relationship-ui.js`): Visual indicators and user interface
3. **WorldDatabase Integration**: Seamless integration with existing world data
4. **RelationshipTestScenarios** (`relationship-test-scenarios.js`): Comprehensive testing framework

All relationship data is stored in the world database and automatically syncs with GitHub, ensuring persistent, cross-session relationship tracking.

The system is designed to make relationships feel meaningful by ensuring that every action has appropriate consequences, creating a living world where the player's choices matter and are remembered by the AI DM.