# 🎲 How to Run D&D Voice Adventure

## The Problem
If you're seeing "Awakening ancient powers..." stuck forever, you're opening the `index.html` file directly from your file system. Modern browsers block ES module imports from `file://` URLs for security reasons.

## ✅ Solution: Run a Local Server

### Option 1: Double-Click to Start (Windows)
1. **Double-click `start-server.bat`**
2. A command window will open and start the server
3. Your browser should open automatically
4. If not, go to: http://localhost:8000

### Option 2: Python Command
1. **Open command prompt/terminal** in this folder
2. **Run:** `python start-server.py`
3. **Open browser to:** http://localhost:8000

### Option 3: Simple Python Server
1. **Open command prompt/terminal** in this folder  
2. **Run:** `python -m http.server 8000`
3. **Open browser to:** http://localhost:8000

### Option 4: VS Code Live Server
1. **Install "Live Server" extension** in VS Code
2. **Right-click `index.html`**
3. **Select "Open with Live Server"**

## 🎮 What Works Once Running From Server:

- ✅ **Campaign Creation** - Create and manage D&D campaigns
- ✅ **Character Sheets** - Full character management system
- ✅ **World Browser** - Manage NPCs, locations, factions
- ✅ **GitHub Integration** - Cloud save your campaigns
- ✅ **Voice Features** - Voice integration for immersive play
- ✅ **Combat System** - Tactical combat and battle maps
- ✅ **Dynamic Dialogue** - Interactive story and choice tracking
- ✅ **Relationship System** - Track character relationships
- ✅ **Quest Management** - Dynamic quest and story systems

## 🔧 Troubleshooting

### Server Won't Start?
- **Port busy:** Try `python -m http.server 8001` (different port)
- **No Python:** Install from https://python.org
- **Still issues:** Try `py -m http.server 8000` on Windows

### Browser Issues?
- **Clear cache:** Ctrl+F5 to hard refresh
- **Try different browser:** Chrome, Firefox, Edge
- **Check console:** F12 → Console tab for errors

### Still Stuck?
1. Check `diagnostic.html` to test individual modules
2. Look at browser console (F12) for specific errors
3. Try `test-basic.html` for basic functionality test

## 🚀 Quick Start Checklist

1. ✅ **Don't double-click `index.html`** (this won't work)
2. ✅ **DO run `start-server.bat`** or use Python command
3. ✅ **Open `http://localhost:8000`** in browser
4. ✅ **Enjoy your D&D adventure!**

---

**Need help?** Check the browser console (F12) for detailed error messages.