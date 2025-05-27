from fastapi import APIRouter, Response

router = APIRouter()

@router.get("/ping")
async def ping():
    """
    Simple ping endpoint that returns immediately.
    Used for latency measurements.
    """
    return Response(
        content="",
        media_type="application/octet-stream",
        headers={
            "Cache-Control": "no-store",
            "Pragma": "no-cache"
        }
    )