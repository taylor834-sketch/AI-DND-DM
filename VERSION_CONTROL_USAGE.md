# 🎲 Taylor's Epic D&D Time - Version Control System

## Quick Start

Your D&D project now has a comprehensive version control system that automatically backs up your code after every change! Here's how to use it:

## 🚀 Automatic Backups

**The system automatically creates backups after EVERY code change** - no manual action needed!

- ✅ Detects file modifications
- ✅ Tracks DOM changes  
- ✅ Monitors database saves
- ✅ Creates numbered backup folders (001, 002, 003, etc.)

## 📦 Manual Backup Commands

### Console Commands (Type in browser console):

```javascript
// Create a manual backup
vc.backup("Fixed character sheet layout")

// Before making changes
vc.preChange("About to update combat system")

// After making changes  
vc.postChange("Combat system updated with new dice mechanics")

// Force an immediate backup
vc.auto.force("Emergency backup before major changes")
```

### Keyboard Shortcuts:

- **Ctrl+Shift+B** - Quick backup prompt
- **Ctrl+Shift+V** - Show version control panel
- **Ctrl+Shift+L** - List all versions
- **Ctrl+Shift+R** - Restore interface

## 🔄 Restore Previous Versions

### Via Console:
```javascript
// List all available versions
vc.list()

// Restore to a specific version (downloads files)
vc.restore(5)  // Restores version 005
```

### Via UI:
1. Press **Ctrl+Shift+V** to open the version panel
2. Click "List Versions" to see all backups
3. Click any version to select it for restore
4. Click "Restore Version" to download the files

## 🎯 For Each Coding Session

### Session Start:
```javascript
vc.preChange("Session start - beginning new features")
```

### Before ANY Change (Big or Small):
```javascript  
vc.preChange("About to fix button color")
vc.preChange("Going to add one line of CSS")
vc.preChange("Updating dice roll function")
```

### After ANY Change:
```javascript
vc.postChange("Fixed button color") 
vc.postChange("Added one line of CSS")
vc.postChange("Updated dice roll function")
```

## 📁 File Organization

```
your-project/
├── versions/
│   ├── versions.json          # Version tracking
│   ├── version-001-backup.json
│   ├── version-002-backup.json
│   └── version-003-backup.json
├── js/
│   ├── version-control.js     # Main backup system
│   ├── auto-version-backup.js # Auto-backup detection
│   └── version-restore-ui.js  # UI for managing versions
└── version-control-test.html  # Test the system
```

## 🧪 Test the System

1. Open `version-control-test.html` in your browser
2. Click "Check Status" to verify all modules loaded
3. Try creating test backups
4. Test the auto-backup system

## ⚙️ Auto-Backup Controls

```javascript
// Turn auto-backup on/off
vc.auto.on()   // Enable automatic backups
vc.auto.off()  // Disable automatic backups
```

## 📋 Version Information

Each backup includes:
- **Version number** (001, 002, 003...)
- **Timestamp** (when created)
- **Description** (what changed)
- **File count** (how many files backed up)
- **All HTML, CSS, and JS files**

## 🆘 Help & Troubleshooting

### Show all commands:
```javascript
vc.help()  // Displays full help in console
```

### Common Issues:

1. **"Version control not available"**
   - Make sure you're running the project (not just opening files)
   - Check browser console for module loading errors

2. **Backups not downloading**
   - Check browser download settings
   - Ensure pop-up blocker allows downloads

3. **Auto-backup too frequent**
   - Use `vc.auto.off()` to disable temporarily
   - System has built-in 30-second cooldown

## 💡 Pro Tips

1. **Always backup before major changes:**
   ```javascript
   vc.preChange("Major combat system overhaul starting")
   ```

2. **Use descriptive names:**
   ```javascript
   vc.backup("Fixed dice animation glitch in combat")
   ```

3. **Regular version checks:**
   ```javascript
   vc.list()  // See your backup history
   ```

4. **Emergency restore workflow:**
   ```javascript
   vc.list()      // Find the version you want
   vc.restore(8)  // Download version 8 files
   ```

## 🎯 Example Workflow

```javascript
// Start of session
vc.preChange("Starting work on character creation form")

// Make your changes to HTML/CSS/JS files...

// After completing changes
vc.postChange("Character creation form completed with validation")

// Before next change
vc.preChange("About to add character portrait upload")

// Make more changes...

// After changes
vc.postChange("Added character portrait upload feature")
```

The system automatically creates backups, but using the manual commands gives you better control and descriptions for each version!