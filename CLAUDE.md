# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Since this is a client-side JavaScript application hosted on GitHub Pages, there are no build, lint, or test commands. Development is done by:

1. **Local Development**: Open `index.html` in a browser or serve with a local server:
   ```bash
   python -m http.server 8000
   # or
   npx http-server
   ```

2. **Testing Foundation**: Open `test.html` to verify all modules load and function correctly

3. **Deployment**: Push to GitHub and enable GitHub Pages in repository settings

## Architecture Overview

This is a **modular, event-driven JavaScript application** with the following core architecture:

### Core System (`core.js`)
- **DNDCore**: Global singleton that manages the entire application
- **Module Loading**: Dynamic ES6 module imports with `loadModule()` method
- **Event Bus**: Central communication via custom events (`emit()`, `on()`, `off()`)
- **State Management**: Centralized app state with `updateState()`

### Module Communication Pattern
All modules communicate through events to prevent tight coupling:

```javascript
// Emit an event
core.emit('database:save', campaignData);

// Listen for events  
core.on('ui:showScreen', (event) => this.showScreen(event.detail.screen));
```

### Key Modules

- **`database.js`**: LocalStorage persistence with `storagePrefix: 'dnd_voice_'`
- **`ui.js`**: Screen management, notifications, DOM manipulation
- **`character.js`**: Character creation, stats, abilities
- **`combat.js`**: Turn-based combat, initiative tracking
- **`relationships.js`**: NPC relationships, faction reputation
- **`monsters.js`**: Monster database, encounter generation
- **`github-integration.js`**: Cloud saves via GitHub API

### Module Structure Pattern
All modules follow this structure:
```javascript
export default class ModuleName {
    constructor(core) {
        this.core = core;
        this.init();
    }
    
    init() {
        // Set up event listeners
        this.core.on('eventName', (event) => this.handleEvent(event.detail));
    }
}
```

## Development Patterns

### Adding New Features
1. Create new module files following existing patterns
2. Use event-driven communication instead of direct module references
3. Register modules in `core.js` `init()` method with `loadModule()`
4. Test functionality using `test.html`

### Screen Management
- Screens are HTML elements with `id="screenName-screen"` and class `screen`
- Use `ui.showScreen('screenName')` to display screens
- All screens should be hidden by default except `mainMenu-screen`

### Data Persistence
- Campaign data uses localStorage with prefix `dnd_voice_`
- GitHub integration saves to user repositories
- Settings stored in localStorage with individual keys

### Styling
- Dark medieval fantasy theme with CSS custom properties
- Google Fonts: Cinzel (headings), Crimson Text (body)
- Responsive design with mobile-first approach

## GitHub Pages Configuration

- Hosted via GitHub Pages with Jekyll disabled (`.nojekyll` file present)
- Configuration in `_config.yml` with SEO and metadata
- No build process required - direct static file serving