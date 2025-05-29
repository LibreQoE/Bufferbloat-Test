import os
import asyncio
import logging
from fastapi import APIRouter, Response, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

router = APIRouter()
logger = logging.getLogger(__name__)

# Create a reusable buffer of random data (128KB for higher throughput)
CHUNK_SIZE = 128 * 1024  # 128KB chunks
random_buffer = os.urandom(CHUNK_SIZE)

async def download_generator(request: Request):
    """
    Generator that yields random data chunks indefinitely.
    Checks for client disconnection between chunks.
    """
    chunk_count = 0
    try:
        while True:
            # Check if client has disconnected
            if await request.is_disconnected():
                logger.info(f"Client disconnected after {chunk_count} chunks")
                break
                
            yield random_buffer
            chunk_count += 1
            
            # Small delay to allow abort signals to be processed
            # This makes the download more responsive to abort signals
            if chunk_count % 20 == 0:  # Add delay every 20 chunks (was 10)
                await asyncio.sleep(0.005)  # 5ms delay (was 10ms)
    except Exception as e:
        logger.error(f"Error in download generator: {e}")
    finally:
        logger.info(f"Download generator finished after {chunk_count} chunks")

@router.get("/download")
async def download(request: Request):
    """
    Endpoint that streams random data to saturate the download connection.
    """
    logger.info("Starting download stream")
    
    return StreamingResponse(
        download_generator(request),
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "no-store",
            "Pragma": "no-cache"
        }
    )