import os
import uvicorn
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
    args = parser.parse_args()
    
    if args.ssl_keyfile and args.ssl_certfile:
        # Run with HTTPS
        print(f"Starting HTTPS server on port {args.port}")
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=args.port,
            ssl_keyfile=args.ssl_keyfile,
            ssl_certfile=args.ssl_certfile,
            reload=True
        )
    else:
        # Run with HTTP
        print(f"Starting HTTP server on port {args.port}")
        uvicorn.run("main:app", host="0.0.0.0", port=args.port, reload=True)