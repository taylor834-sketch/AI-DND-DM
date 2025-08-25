# 🐉 D&D Voice Adventure

A comprehensive tabletop RPG companion with voice integration, inspired by Baldur's Gate 3 and Gloomhaven. Built with a modular architecture for GitHub Pages hosting.

## 🎯 Project Overview

This project creates a solid foundation for a D&D voice adventure game with:
- **Modular Architecture**: Event-driven system preventing tight coupling
- **GitHub Integration**: Save/sync campaigns via GitHub repositories  
- **Atmospheric UI**: Dark medieval fantasy theme with environmental storytelling
- **Progressive Enhancement**: Features can be added without breaking core functionality

## 🏗️ Architecture

### Core Modules

- **`core.js`** - Event bus, module loader, application state management
- **`database.js`** - Local storage, save/load campaign data
- **`ui.js`** - DOM manipulation, screen management, notifications
- **`character.js`** - Character creation, management, ability calculations
- **`combat.js`** - Turn-based combat system, initiative tracking
- **`relationships.js`** - NPC relationships, faction reputation system
- **`monsters.js`** - Monster database, encounter generation
- **`github-integration.js`** - GitHub API integration for cloud saves

### Event-Driven Communication

Modules communicate through custom events to prevent tight coupling:
```javascript
// Example: Save a campaign
core.emit('database:save', campaignData);

// Example: Update character relationship
core.emit('relationships:updateRelationship', {
    characterId: 'char123',
    targetId: 'npc456', 
    change: +10,
    reason: 'Helped with quest'
});
```

## 🚀 Getting Started

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/taylor834-sketch/AI-DND-DM.git
   cd dnd-voice-adventure
   ```

2. **Open `index.html` in your browser** or serve with a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx http-server
   ```

3. **Test the foundation** by opening `test.html` to verify all modules load correctly.

### GitHub Pages Deployment

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial foundation setup"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to repository Settings > Pages
   - Source: Deploy from branch
   - Branch: main / (root)

3. **Access your game** at `https://taylor834-sketch.github.io/AI-DND-DM/`

## 📁 Project Structure

```
dnd-voice-adventure/
├── index.html              # Main application entry point
├── test.html              # Foundation testing page
├── _config.yml            # GitHub Pages configuration
├── .nojekyll             # Bypass Jekyll processing
├── css/
│   └── main.css          # Dark atmospheric styling
└── js/
    ├── core.js           # Application core & event bus
    ├── database.js       # Save/load functionality
    ├── ui.js            # User interface management
    ├── character.js     # Character system
    ├── combat.js        # Combat mechanics
    ├── relationships.js # NPC & faction relationships
    ├── monsters.js      # Monster database & encounters
    └── github-integration.js # Cloud save integration
```

## 🎮 Features Implemented

### ✅ Foundation Complete
- [x] Modular event-driven architecture
- [x] Dark medieval fantasy UI theme
- [x] Main menu with atmospheric styling
- [x] Local storage database system
- [x] GitHub Pages configuration
- [x] Basic character creation framework
- [x] Combat system foundation
- [x] Relationship/reputation tracking
- [x] Monster database with encounter generation
- [x] GitHub integration for cloud saves

### 🔄 Ready for Extension
- Settings persistence
- Voice integration hooks
- Particle effects system
- Campaign creation wizard
- Audio management
- Advanced combat features

## 🧪 Testing

Open `test.html` to verify:
- ✅ Core module loading
- ✅ Database save/load operations  
- ✅ UI notification system
- ✅ Event bus communication

## 🎨 UI Theme

The interface uses a **dark medieval fantasy theme** with:
- **Colors**: Rich browns, dark slate grays, golden accents
- **Typography**: Cinzel (headings) + Crimson Text (body)
- **Effects**: Subtle gradients, glows, and atmospheric overlays
- **Responsive**: Mobile-friendly with adaptive layouts

## 🔧 Configuration

### GitHub Integration Setup
1. Generate a GitHub personal access token
2. Create a repository for campaign saves
3. Configure in Settings with token and repository details

### Environment Variables
The application uses localStorage for:
- `dnd_voice_github_token` - GitHub API token
- `dnd_voice_github_repo` - Repository name  
- `dnd_voice_github_username` - GitHub username
- `dnd_voice_campaign_*` - Individual campaign saves

## 🤝 Contributing

This is a solid foundation ready for expansion. Key principles:

1. **Maintain modularity** - New features should be self-contained modules
2. **Use the event system** - Communicate between modules via events
3. **Follow the established patterns** - Look at existing modules for guidance
4. **Test your changes** - Verify with `test.html` before committing

## 📋 Next Steps

After testing this foundation, you can add:
- 🎵 **Atmospheric effects** - Particle systems, ambient sounds
- 🗣️ **Voice integration** - Speech recognition/synthesis  
- 🎲 **Advanced mechanics** - Spell systems, inventory management
- 🌍 **World building** - Location database, quest system
- 📱 **PWA features** - Offline support, app installation

## 🏷️ License

MIT License - see LICENSE file for details.

---

**🎯 Ready to begin your adventure?** Open `index.html` to start exploring the foundation!
