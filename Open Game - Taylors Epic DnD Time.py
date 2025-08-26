#!/usr/bin/env python3
"""
D&D Voice Adventure Local Server
Starts a local web server to run the D&D Voice Adventure app
"""

import http.server
import socketserver
import os
import webbrowser
import sys

PORT = 8000

def main():
    # Change to the directory containing the files
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    print("🎲 D&D Voice Adventure Server")
    print("=" * 40)
    print(f"📁 Serving from: {script_dir}")
    print(f"🌐 Server URL: http://localhost:{PORT}")
    print(f"🎮 Game URL: http://localhost:{PORT}/index.html")
    print("=" * 40)
    
    Handler = http.server.SimpleHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"✅ Server started successfully!")
            print(f"🚀 Opening browser automatically...")
            print(f"📝 Press Ctrl+C to stop the server")
            print()
            
            # Open browser automatically
            try:
                webbrowser.open(f'http://localhost:{PORT}/index.html')
                print("🌐 Browser opened automatically")
            except Exception as e:
                print(f"⚠️ Could not open browser automatically: {e}")
                print(f"🔗 Please manually open: http://localhost:{PORT}/index.html")
            
            print("\n🎯 Server is running... enjoy your adventure!")
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n\n🛑 Server stopped by user")
                print("Thanks for playing D&D Voice Adventure!")
                
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {PORT} is already in use!")
            print(f"💡 Try opening http://localhost:{PORT} in your browser")
            print(f"💡 Or change PORT in this script to a different number")
        else:
            print(f"❌ Failed to start server: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()