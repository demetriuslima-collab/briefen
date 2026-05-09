from fastapi import APIRouter, Depends, HTTPException, status
from asyncpg import Connection

from app.core.auth import get_user_id
from app.db.client import get_db

router = APIRouter()


@router.get("")
async def list_jobs(
    job_status: str | None = None,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Em implementação.")
