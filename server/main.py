import os
import uvicorn
import hypercorn
from hypercorn.config import Config
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import endpoint modules
from ping import router as ping_router
from download import router as download_router
from upload import router as upload_router

# Create FastAPI app
app = FastAPI(title="LibreQoS Bufferbloat Test")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ping_router)
app.include_router(download_router)
app.include_router(upload_router)

# Mount static files (client)
client_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "client")
app.mount("/", StaticFiles(directory=client_dir, html=True), name="client")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="LibreQoS Bufferbloat Test Server")
    parser.add_argument("--port", type=int, default=80, help="Port to run the server on")
    parser.add_argument("--ssl-keyfile", type=str, help="SSL key file path for HTTPS")
    parser.add_argument("--ssl-certfile", type=str, help="SSL certificate file path for HTTPS")
    parser.add_argument("--http2", action="store_true", help="Enable HTTP/2 support (requires HTTPS)")
    parser.add_argument("--production", action="store_true", help="Run in production mode (disables auto-reload)")
    args = parser.parse_args()
    
    if args.ssl_keyfile and args.ssl_certfile:
        # Run with HTTPS
        if args.http2:
            # Run with HTTP/2 using Hypercorn
            print(f"Starting HTTPS server with HTTP/2 support on port {args.port}")
            config = Config()
            config.bind = [f"0.0.0.0:{args.port}"]
            config.certfile = args.ssl_certfile
            config.keyfile = args.ssl_keyfile
            config.alpn_protocols = ["h2", "http/1.1"]  # Enable HTTP/2
            config.h2_max_concurrent_streams = 250  # Increase from default 100
            config.h2_max_inbound_frame_size = 16384  # 16KB (default)
            config.use_reloader = not args.production  # Disable reloader in production
            
            import asyncio
            asyncio.run(hypercorn.run(app, config))
        else:
            # Run with HTTPS using Uvicorn (HTTP/1.1 only)
            print(f"Starting HTTPS server (HTTP/1.1 only) on port {args.port}")
            uvicorn.run(
                "main:app",
                host="0.0.0.0",
                port=args.port,
                ssl_keyfile=args.ssl_keyfile,
                ssl_certfile=args.ssl_certfile,
                reload=not args.production  # Disable reloader in production
            )
    else:
        # Run with HTTP
        print(f"Starting HTTP server on port {args.port}")
        uvicorn.run("main:app", host="0.0.0.0", port=args.port, reload=not args.production)  # Disable reloader in production