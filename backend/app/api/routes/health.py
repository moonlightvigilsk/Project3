from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import get_settings, Settings
from app.core.database import get_db
from app.services.llm.factory import get_llm_provider

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check(
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
):
    """Health check endpoint verifying app status, DB, and LLM provider."""
    # Check DB
    db_healthy = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_healthy = False

    # Check LLM provider
    provider = get_llm_provider(settings)
    provider_healthy = await provider.health_check()

    return {
        "status": "healthy" if db_healthy else "degraded",
        "app_name": settings.app_name,
        "environment": settings.environment,
        "database": "connected" if db_healthy else "error",
        "llm_provider": provider.provider_name,
        "llm_available": provider_healthy,
    }
