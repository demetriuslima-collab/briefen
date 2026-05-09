import asyncio
import logging
import asyncpg
from asyncpg import Pool, Connection
from app.core.config import settings

logger = logging.getLogger(__name__)

_pool: Pool | None = None


async def get_pool() -> Pool:
    global _pool
    if _pool is not None:
        return _pool

    delays = [2, 5, 10, 20, 30]
    last_error: Exception | None = None
    for attempt, delay in enumerate(delays, 1):
        try:
            _pool = await asyncpg.create_pool(
                settings.database_url,
                min_size=1,
                max_size=10,
            )
            return _pool
        except Exception as exc:
            last_error = exc
            logger.warning("DB connection attempt %d/%d failed: %s", attempt, len(delays), exc)
            if attempt < len(delays):
                await asyncio.sleep(delay)

    raise RuntimeError(f"Could not connect to database after {len(delays)} attempts") from last_error


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
