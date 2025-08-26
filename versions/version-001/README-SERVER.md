# Running D&D Voice Adventure

## Issue with Opening index.html Directly

If you get "Error: Failed to initialize application" when double-clicking `index.html`, this is likely due to browser security restrictions with ES modules when running from the `file://` protocol.

## Solution: Run a Local Server

### Option 1: Python Server (Recommended)
1. Open a terminal/command prompt in the project directory
2. Run one of these commands:
   ```bash
   # Python 3 (try different ports if 8000 is busy)
   python -m http.server 8000
   python -m http.server 8080
   python -m http.server 3000
   
   # Or Python 2
   python -m SimpleHTTPServer 8000
   
   # Or use the provided script
   python start-server.py
   ```
3. Open your browser and go to: `http://localhost:8000` (or whatever port you used)

### Troubleshooting Port Issues
If you get `ERR_EMPTY_RESPONSE` or connection refused:
1. **Port Already in Use**: Try a different port (8080, 3000, 9000)
2. **Multiple Servers Running**: Kill existing Python processes or restart your computer
3. **Check if Server Started**: Look for message like "Serving HTTP on 0.0.0.0 port 8080"
4. **Test Connection**: Try `curl http://localhost:8080` in another terminal

### Quick Fix Commands
```bash
# Kill any existing Python servers
taskkill /F /IM python.exe
# Or restart computer

# Start fresh server
cd "C:\Users\taylo\dnd-voice-adventure"
python -m http.server 8080
```

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