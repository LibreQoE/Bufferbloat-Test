from fastapi import APIRouter, Request, Response, File, UploadFile, Form
from fastapi.responses import JSONResponse
import logging

router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.post("/upload")
async def upload(request: Request):
    """
    Endpoint that accepts binary data uploads and discards them immediately.
    Used to saturate the upload connection.
    """
    try:
        # Read and discard the request body
        body = await request.body()
        size = len(body)
        logger.info(f"Received upload of {size} bytes")
        
        return Response(
            content="",
            media_type="application/octet-stream",
            headers={
                "Cache-Control": "no-store",
                "Pragma": "no-cache"
            }
        )
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )