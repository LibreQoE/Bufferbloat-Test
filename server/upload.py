from fastapi import APIRouter, Request, Response, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
import logging
import asyncio
import random
import time

router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for rate limiting and size control
MAX_CHUNK_SIZE = 64 * 1024  # Process in 64KB chunks max
MAX_REQUEST_SIZE = 8 * 1024 * 1024  # 8MB max per request
MAX_PROCESSING_RATE = 100 * 1024 * 1024  # 100MB/s max processing rate

@router.post("/upload")
async def upload(request: Request):
    """
    Endpoint that accepts binary data uploads and discards them immediately.
    Used to saturate the upload connection.
    
    Includes rate limiting and size checks to prevent server overload
    on high-capacity connections.
    """
    try:
        # Initialize counters and rate limiting
        size = 0
        chunk_count = 0
        start_time = asyncio.get_event_loop().time()
        last_rate_check = start_time
        bytes_since_check = 0
        
        # Process chunks with rate limiting
        async for chunk in request.stream():
            # Check total request size
            size += len(chunk)
            chunk_count += 1
            
            if size > MAX_REQUEST_SIZE:
                logger.warning(f"Upload request too large: {size/1024/1024:.2f} MB exceeds limit of {MAX_REQUEST_SIZE/1024/1024} MB")
                raise HTTPException(status_code=413, detail="Request too large")
            
            # Process in smaller chunks to avoid memory issues
            remaining = chunk
            while remaining:
                # Process at most MAX_CHUNK_SIZE at once
                process_size = min(len(remaining), MAX_CHUNK_SIZE)
                current_chunk = remaining[:process_size]
                remaining = remaining[process_size:]
                
                # Count processed data
                bytes_since_check += process_size
                
                # Rate limiting check
                current_time = asyncio.get_event_loop().time()
                time_since_check = current_time - last_rate_check
                
                if time_since_check > 0.1:  # Check every 100ms
                    current_rate = bytes_since_check / time_since_check
                    
                    # If processing too fast, add a small delay
                    if current_rate > MAX_PROCESSING_RATE:
                        delay_time = bytes_since_check / MAX_PROCESSING_RATE - time_since_check
                        if delay_time > 0:
                            # Log if we're throttling significantly
                            if delay_time > 0.05:  # Only log if delay is more than 50ms
                                logger.info(f"Rate limiting upload: {current_rate/1024/1024:.2f} MB/s exceeds {MAX_PROCESSING_RATE/1024/1024} MB/s, adding {delay_time*1000:.1f}ms delay")
                            await asyncio.sleep(delay_time)
                    
                    # Reset rate limiting counters
                    bytes_since_check = 0
                    last_rate_check = asyncio.get_event_loop().time()
        
        # Calculate throughput for logging
        duration = asyncio.get_event_loop().time() - start_time
        if duration > 0:
            throughput_mbps = (size * 8) / (duration * 1000000)
            
            # Only log for very large or fast uploads (for debugging)
            if size > 50 * 1024 * 1024 or throughput_mbps > 1000:
                logger.info(f"Received upload: {size/1024/1024:.2f} MB at {throughput_mbps:.2f} Mbps")
        
        return Response(
            content="",
            media_type="application/octet-stream",
            headers={
                "Cache-Control": "no-store",
                "Pragma": "no-cache",
                "Connection": "keep-alive"  # Encourage connection reuse
            }
        )
    except HTTPException as he:
        logger.warning(f"Upload request rejected: {he.detail}")
        return JSONResponse(
            status_code=he.status_code,
            content={"error": he.detail}
        )
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )