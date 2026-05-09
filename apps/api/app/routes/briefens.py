import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from asyncpg import Connection
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.db.client import get_db, resolve_workspace_id
from app.services.jobs import enqueue_job

router = APIRouter()


class CreateBriefen(BaseModel):
    icp_id: uuid.UUID
    channel_ids: list[uuid.UUID]
    top_n_per_channel: int = 30
    ranking_metric: str = "views_per_day"
    title: str | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_briefen(
    body: CreateBriefen,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)

    icp = await db.fetchrow(
        "SELECT id, name FROM icps WHERE id = $1 AND workspace_id = $2",
        str(body.icp_id),
        workspace_id,
    )
    if not icp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ICP não encontrado.")

    channel_ids_pg = [uuid.UUID(str(cid)) for cid in body.channel_ids]
    valid = await db.fetch(
        "SELECT id FROM channels WHERE id = ANY($1) AND workspace_id = $2",
        channel_ids_pg,
        workspace_id,
    )
    if len(valid) != len(channel_ids_pg):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Um ou mais canais não pertencem ao workspace.",
        )

    title = body.title or f"Briefen para {icp['name']}"

    row = await db.fetchrow(
        """
        INSERT INTO briefens (workspace_id, icp_id, title, selected_channel_ids)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        workspace_id,
        str(body.icp_id),
        title,
        channel_ids_pg,
    )
    briefen_id = str(row["id"])

    await enqueue_job(
        "run_briefen",
        {
            "briefen_id": briefen_id,
            "top_n_per_channel": body.top_n_per_channel,
            "ranking_metric": body.ranking_metric,
        },
        workspace_id=workspace_id,
    )

    return _serialize(dict(row))


@router.get("")
async def list_briefens(
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    rows = await db.fetch(
        """
        SELECT b.*,
               i.name AS icp_name,
               array_length(b.selected_channel_ids, 1) AS channel_count
        FROM briefens b
        JOIN icps i ON i.id = b.icp_id
        WHERE b.workspace_id = $1
        ORDER BY b.created_at DESC
        """,
        workspace_id,
    )
    return [_serialize(dict(row)) for row in rows]


@router.get("/{briefen_id}")
async def get_briefen(
    briefen_id: str,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)

    row = await db.fetchrow(
        """
        SELECT b.*,
               i.name AS icp_name
        FROM briefens b
        JOIN icps i ON i.id = b.icp_id
        WHERE b.id = $1 AND b.workspace_id = $2
        """,
        briefen_id,
        workspace_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Briefen não encontrado.")

    videos = await db.fetch(
        """
        SELECT bv.rank, bv.views_at_briefen,
               v.id AS video_id, v.youtube_id, v.title, v.thumbnail_url, v.views
        FROM briefen_videos bv
        JOIN videos v ON v.id = bv.video_id
        WHERE bv.briefen_id = $1
        ORDER BY bv.rank
        """,
        briefen_id,
    )

    result = _serialize(dict(row))
    result["videos"] = [_serialize(dict(v)) for v in videos]
    return result


def _serialize(d: dict) -> dict:
    result = {}
    for k, v in d.items():
        if isinstance(v, uuid.UUID):
            result[k] = str(v)
        elif isinstance(v, (datetime, date)):
            result[k] = v.isoformat()
        elif isinstance(v, list):
            result[k] = [str(x) if isinstance(x, uuid.UUID) else x for x in v]
        else:
            result[k] = v
    return result
