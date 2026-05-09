from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.client import get_pool
from app.routes import channels, icps, briefens, jobs, videos


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="briefen",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(channels.router, prefix="/channels", tags=["channels"])
app.include_router(videos.router, prefix="/videos", tags=["videos"])
app.include_router(icps.router, prefix="/icps", tags=["icps"])
app.include_router(briefens.router, prefix="/briefens", tags=["briefens"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "briefen-api"}
