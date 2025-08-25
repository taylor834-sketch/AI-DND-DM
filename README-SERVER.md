# Running D&D Voice Adventure

## Issue with Opening index.html Directly

If you get "Error: Failed to initialize application" when double-clicking `index.html`, this is likely due to browser security restrictions with ES modules when running from the `file://` protocol.

## Solution: Run a Local Server

### Option 1: Python Server (Recommended)
1. Open a terminal/command prompt in the project directory
2. Run one of these commands:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Or Python 2
   python -m SimpleHTTPServer 8000
   
   # Or use the provided script
   python start-server.py
   ```
3. Open your browser and go to: `http://localhost:8000`

### Option 2: Node.js Server
1. Install a simple server: `npm install -g http-server`
2. Run: `http-server -p 8000`
3. Open: `http://localhost:8000`

### Option 3: VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Why This Happens

Modern browsers block ES module imports when running from `file://` for security reasons. The application uses ES modules for better code organization and performance.

## Features That Work
- ✅ Campaign creation and management
- ✅ Character sheet integration
- ✅ World browser and NPC management  
- ✅ GitHub integration for cloud saves
- ✅ Voice integration capabilities
- ✅ Combat and tactical systems
- ✅ Dynamic dialogue and choice tracking

Once running from a server, all features will work properly!