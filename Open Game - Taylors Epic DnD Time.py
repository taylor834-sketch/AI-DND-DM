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
FALLBACK_PORTS = [8001, 8002, 8080, 8888, 3000]  # Alternative ports to try

def find_available_port():
    """Find an available port to use"""
    import socket
    
    # First try the default port
    ports_to_try = [PORT] + FALLBACK_PORTS
    
    for port in ports_to_try:
        try:
            # Try to bind to the port
            test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test_socket.bind(('', port))
            test_socket.close()
            return port
        except OSError:
            continue
    
    # If no ports available, return None
    return None

def main():
    # Change to the directory containing the files
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Find an available port
    available_port = find_available_port()
    if not available_port:
        print("ERROR: No available ports found!")
        print("Please close other applications using ports 8000-8002, 8080, 8888, or 3000")
        sys.exit(1)
    
    if available_port != PORT:
        print(f"NOTE: Port {PORT} was busy, using port {available_port} instead")
    
    print("Taylor's Epic D&D Time - v2.0 (Latest)")
    print("Enhanced with Fog of War Battle System")
    print("=" * 50)
    print(f"Serving from: {script_dir}")
    print(f"Server URL: http://localhost:{available_port}")
    print(f"Game URL: http://localhost:{available_port}/index.html")
    print("=" * 50)
    
    Handler = http.server.SimpleHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", available_port), Handler) as httpd:
            print(f"Server started successfully!")
            print(f"Opening browser automatically...")
            print(f"Press Ctrl+C to stop the server")
            print()
            
            # Open browser automatically
            try:
                webbrowser.open(f'http://localhost:{available_port}/index.html')
                print("Browser opened automatically")
            except Exception as e:
                print(f"Could not open browser automatically: {e}")
                print(f"Please manually open: http://localhost:{available_port}/index.html")
            
            print("\nServer is running... enjoy your adventure!")
            
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n\nServer stopped by user")
                print("Thanks for playing D&D Voice Adventure!")
                
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Port {available_port} is already in use!")
            print(f"This shouldn't happen - please report this issue")
            print(f"Try running the script again")
        else:
            print(f"Failed to start server: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()