import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from asyncpg import Connection
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.db.client import get_db, resolve_workspace_id
from app.services import youtube as yt
from app.services.jobs import enqueue_job

router = APIRouter()


class AddChannelRequest(BaseModel):
    url: str


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_channel(
    body: AddChannelRequest,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)

    try:
        channel_data = await yt.resolve_channel(body.url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro na YouTube API: {exc}",
        )

    row = await db.fetchrow(
        """
        INSERT INTO channels (
            workspace_id, youtube_id, handle, name, description,
            subscribers, total_videos, thumbnail_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (workspace_id, youtube_id) DO UPDATE
        SET handle        = EXCLUDED.handle,
            name          = EXCLUDED.name,
            description   = EXCLUDED.description,
            subscribers   = EXCLUDED.subscribers,
            total_videos  = EXCLUDED.total_videos,
            thumbnail_url = EXCLUDED.thumbnail_url
        RETURNING *
        """,
        workspace_id,
        channel_data["youtube_id"],
        channel_data.get("handle"),
        channel_data["name"],
        channel_data.get("description", ""),
        channel_data.get("subscribers"),
        channel_data.get("total_videos"),
        channel_data.get("thumbnail_url"),
    )
    channel_id = str(row["id"])

    await enqueue_job(
        "sync_channel",
        {
            "channel_id": channel_id,
            "uploads_playlist_id": channel_data.get("uploads_playlist_id"),
        },
        workspace_id=workspace_id,
    )

    return _serialize(dict(row))


@router.get("")
async def list_channels(
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    rows = await db.fetch(
        """
        SELECT c.id, c.workspace_id, c.youtube_id, c.handle, c.name,
               c.subscribers, c.total_videos, c.thumbnail_url,
               c.last_synced_at, c.created_at,
               COUNT(v.id)::int AS video_count
        FROM channels c
        LEFT JOIN videos v ON v.channel_id = c.id
        WHERE c.workspace_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC
        """,
        workspace_id,
    )
    return [_serialize(dict(row)) for row in rows]


@router.get("/{channel_id}")
async def get_channel(
    channel_id: str,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    row = await db.fetchrow(
        """
        SELECT c.*, COUNT(v.id)::int AS video_count
        FROM channels c
        LEFT JOIN videos v ON v.channel_id = c.id
        WHERE c.id = $1 AND c.workspace_id = $2
        GROUP BY c.id
        """,
        channel_id,
        workspace_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal não encontrado.")
    return _serialize(dict(row))


@router.post("/{channel_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def sync_channel(
    channel_id: str,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    row = await db.fetchrow(
        "SELECT id FROM channels WHERE id = $1 AND workspace_id = $2",
        channel_id,
        workspace_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal não encontrado.")

    await enqueue_job(
        "sync_channel",
        {"channel_id": channel_id},
        workspace_id=workspace_id,
    )
    return {"status": "queued"}


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: str,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    result = await db.execute(
        "DELETE FROM channels WHERE id = $1 AND workspace_id = $2",
        channel_id,
        workspace_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal não encontrado.")


@router.get("/{channel_id}/videos")
async def list_channel_videos(
    channel_id: str,
    page: int = 1,
    per_page: int = 50,
    order_by: str = "views",
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    channel = await db.fetchrow(
        "SELECT id FROM channels WHERE id = $1 AND workspace_id = $2",
        channel_id,
        workspace_id,
    )
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal não encontrado.")

    _valid = {"views", "likes", "comments", "published_at", "views_per_day"}
    if order_by not in _valid:
        order_by = "views"

    if order_by == "views_per_day":
        order_sql = (
            "CASE WHEN EXTRACT(EPOCH FROM (now() - v.published_at)) > 86400 "
            "THEN v.views::float / (EXTRACT(EPOCH FROM (now() - v.published_at)) / 86400) "
            "ELSE v.views::float END DESC"
        )
    elif order_by == "published_at":
        order_sql = "v.published_at DESC"
    else:
        order_sql = f"v.{order_by} DESC"

    rows = await db.fetch(
        f"""
        SELECT v.*,
               t.video_id IS NOT NULL AS has_transcript,
               s.video_id IS NOT NULL AS has_summary
        FROM videos v
        LEFT JOIN transcripts t ON t.video_id = v.id
        LEFT JOIN summaries   s ON s.video_id = v.id
        WHERE v.channel_id = $1
        ORDER BY {order_sql}
        LIMIT $2 OFFSET $3
        """,
        channel_id,
        per_page,
        (page - 1) * per_page,
    )
    return [_serialize(dict(row)) for row in rows]


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
