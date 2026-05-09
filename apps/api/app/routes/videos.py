import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status
from asyncpg import Connection

from app.core.auth import get_user_id
from app.db.client import get_db, resolve_workspace_id
from app.services.jobs import enqueue_job

router = APIRouter()


@router.get("/{video_id}")
async def get_video(
    video_id: str,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)

    row = await db.fetchrow(
        """
        SELECT v.*,
               c.id   AS channel_id_ref,
               c.name AS channel_name,
               t.content    AS transcript_content,
               t.language   AS transcript_language,
               t.source     AS transcript_source,
               t.word_count AS transcript_word_count,
               s.summary    AS summary_text,
               s.topics     AS summary_topics,
               s.hooks      AS summary_hooks,
               s.model_used AS summary_model
        FROM videos v
        JOIN channels c ON c.id = v.channel_id
        LEFT JOIN transcripts t ON t.video_id = v.id
        LEFT JOIN summaries   s ON s.video_id = v.id
        WHERE v.id = $1 AND c.workspace_id = $2
        """,
        video_id,
        workspace_id,
    )

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vídeo não encontrado.")

    return _serialize(dict(row))


@router.post("/{video_id}/reprocess", status_code=status.HTTP_202_ACCEPTED)
async def reprocess_video(
    video_id: str,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)

    row = await db.fetchrow(
        """
        SELECT v.id, c.workspace_id
        FROM videos v
        JOIN channels c ON c.id = v.channel_id
        WHERE v.id = $1 AND c.workspace_id = $2
        """,
        video_id,
        workspace_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vídeo não encontrado.")

    await enqueue_job(
        "transcribe_video",
        {"video_id": video_id},
        workspace_id=workspace_id,
    )
    return {"status": "queued"}


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
