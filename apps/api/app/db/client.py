import asyncpg
from asyncpg import Pool, Connection
from app.core.config import settings

_pool: Pool | None = None


async def get_pool() -> Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)
    return _pool


async def get_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def resolve_workspace_id(user_id: str, conn: Connection) -> str:
    row = await conn.fetchrow(
        "SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1",
        user_id,
    )
    if not row:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário sem workspace.",
        )
    return str(row["workspace_id"])
