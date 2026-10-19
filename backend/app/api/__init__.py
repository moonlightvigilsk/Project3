from fastapi import APIRouter
from app.api.routes.health import router as health_router
from app.api.routes.practice import router as practice_router
from app.api.routes.grammar import router as grammar_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(practice_router)
api_router.include_router(grammar_router)
