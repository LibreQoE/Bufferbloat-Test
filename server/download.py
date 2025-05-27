import os
from fastapi import APIRouter, Response
from fastapi.responses import StreamingResponse

router = APIRouter()

# Create a reusable buffer of random data (64KB)
CHUNK_SIZE = 64 * 1024  # 64KB chunks
random_buffer = os.urandom(CHUNK_SIZE)

async def download_generator():
    """
    Generator that yields random data chunks indefinitely.
    """
    while True:
        yield random_buffer

@router.get("/download")
async def download():
    """
    Endpoint that streams random data to saturate the download connection.
    """
    return StreamingResponse(
        download_generator(),
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "no-store",
            "Pragma": "no-cache"
        }
    )