import json
import logging
from app.db.client import get_pool

logger = logging.getLogger(__name__)

_CLAIM_QUERY = """
UPDATE jobs
SET status = 'running',
    started_at = now(),
    attempts = attempts + 1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'pending'
    AND scheduled_at <= now()
    AND attempts < max_attempts
  ORDER BY scheduled_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *
"""


async def claim_next_job() -> dict | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(_CLAIM_QUERY)
        if not row:
            return None
        d = dict(row)
        # asyncpg pode retornar JSONB como string em algumas configurações
        for key in ("payload", "result"):
            if isinstance(d.get(key), str):
                try:
                    d[key] = json.loads(d[key])
                except (ValueError, TypeError):
                    pass
        return d


async def mark_job_completed(job_id: str, result: dict | None = None) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE jobs
            SET status = 'completed', completed_at = now(), result = $1::jsonb
            WHERE id = $2
            """,
            json.dumps(result) if result else None,
            job_id,
        )


async def mark_job_failed(job_id: str, error: str) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE jobs
            SET status = 'failed', completed_at = now(), error_message = $1
            WHERE id = $2
            """,
            error,
            job_id,
        )


async def enqueue_job(
    job_type: str,
    payload: dict,
    workspace_id: str | None = None,
    delay_seconds: int = 0,
) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO jobs (type, payload, workspace_id, scheduled_at)
            VALUES ($1, $2::jsonb, $3, now() + ($4 || ' seconds')::interval)
            RETURNING id
            """,
            job_type,
            json.dumps(payload),
            workspace_id,
            str(delay_seconds),
        )
        return str(row["id"])


async def process_job(job: dict) -> None:
    handlers = {
        "sync_channel": _handle_sync_channel,
        "transcribe_video": _handle_transcribe_video,
        "summarize_video": _handle_summarize_video,
        "run_briefen": _handle_run_briefen,
    }
    handler = handlers.get(job["type"])
    if handler:
        await handler(str(job["id"]), job["payload"])
    else:
        raise ValueError(f"Tipo de job desconhecido: {job['type']}")


# ── Handlers ──────────────────────────────────────────────────────────────────

async def _handle_sync_channel(job_id: str, payload: dict) -> None:
    from app.services.channels import sync_channel

    channel_id = payload.get("channel_id")
    if not channel_id:
        await mark_job_failed(job_id, "payload.channel_id ausente.")
        return

    uploads_playlist_id = payload.get("uploads_playlist_id")

    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            new_video_ids = await sync_channel(conn, channel_id, uploads_playlist_id)

        # Workspace para enqueue
        row = await pool.fetchrow(
            "SELECT workspace_id FROM channels WHERE id = $1", channel_id
        )
        workspace_id = str(row["workspace_id"]) if row else None

        for i, video_id in enumerate(new_video_ids):
            await enqueue_job(
                "transcribe_video",
                {"video_id": video_id},
                workspace_id=workspace_id,
                delay_seconds=i * 12,  # 12s entre cada job — respeita rate limit do Groq
            )

        await mark_job_completed(job_id, {"synced_videos": len(new_video_ids)})
        logger.info("sync_channel: %s vídeos novos para %s", len(new_video_ids), channel_id)
    except Exception as exc:
        await mark_job_failed(job_id, str(exc))


async def _handle_transcribe_video(job_id: str, payload: dict) -> None:
    from app.services.transcript import get_transcript

    video_id = payload.get("video_id")
    if not video_id:
        await mark_job_failed(job_id, "payload.video_id ausente.")
        return

    pool = await get_pool()
    try:
        row = await pool.fetchrow(
            """
            SELECT v.youtube_id, c.workspace_id
            FROM videos v
            JOIN channels c ON c.id = v.channel_id
            WHERE v.id = $1
            """,
            video_id,
        )
        if not row:
            await mark_job_failed(job_id, f"Vídeo {video_id} não encontrado.")
            return

        youtube_id = row["youtube_id"]
        workspace_id = str(row["workspace_id"])

        content, language, source = await get_transcript(youtube_id)
        word_count = len(content.split())

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO transcripts (video_id, content, language, source, word_count)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (video_id) DO UPDATE
                SET content    = EXCLUDED.content,
                    language   = EXCLUDED.language,
                    source     = EXCLUDED.source,
                    word_count = EXCLUDED.word_count
                """,
                video_id,
                content,
                language,
                source,
                word_count,
            )

        await enqueue_job(
            "summarize_video",
            {"video_id": video_id},
            workspace_id=workspace_id,
        )
        await mark_job_completed(job_id, {"word_count": word_count, "source": source})
    except Exception as exc:
        await mark_job_failed(job_id, str(exc))


async def _handle_summarize_video(job_id: str, payload: dict) -> None:
    from app.services.summarizer import summarize_video

    video_id = payload.get("video_id")
    if not video_id:
        await mark_job_failed(job_id, "payload.video_id ausente.")
        return

    pool = await get_pool()
    try:
        row = await pool.fetchrow(
            """
            SELECT v.title, v.description, v.duration_seconds, t.content AS transcript
            FROM videos v
            JOIN transcripts t ON t.video_id = v.id
            WHERE v.id = $1
            """,
            video_id,
        )
        if not row:
            await mark_job_failed(job_id, f"Transcrição não encontrada para {video_id}.")
            return

        result = await summarize_video(
            title=row["title"],
            duration_seconds=row["duration_seconds"],
            description=row["description"],
            transcript=row["transcript"],
        )

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO summaries (video_id, summary, topics, hooks, model_used)
                VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
                ON CONFLICT (video_id) DO UPDATE
                SET summary    = EXCLUDED.summary,
                    topics     = EXCLUDED.topics,
                    hooks      = EXCLUDED.hooks,
                    model_used = EXCLUDED.model_used
                """,
                video_id,
                result["summary"],
                json.dumps(result["topics"]),
                json.dumps(result["hooks"]),
                result["model_used"],
            )

        await mark_job_completed(job_id)
    except Exception as exc:
        await mark_job_failed(job_id, str(exc))


async def _handle_run_briefen(job_id: str, payload: dict) -> None:
    from app.services.strategist import run_briefen

    briefen_id = payload.get("briefen_id")
    if not briefen_id:
        await mark_job_failed(job_id, "payload.briefen_id ausente.")
        return

    top_n = int(payload.get("top_n_per_channel", 30))
    ranking_metric = payload.get("ranking_metric", "views_per_day")

    if ranking_metric == "views_per_day":
        order_sql = (
            "CASE WHEN EXTRACT(EPOCH FROM (now() - v.published_at)) > 86400 "
            "THEN v.views::float / (EXTRACT(EPOCH FROM (now() - v.published_at)) / 86400) "
            "ELSE v.views::float END DESC"
        )
    elif ranking_metric == "likes":
        order_sql = "v.likes DESC"
    else:
        order_sql = "v.views DESC"

    pool = await get_pool()

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE briefens SET status = 'running' WHERE id = $1", briefen_id
            )

        briefen = await pool.fetchrow(
            "SELECT * FROM briefens WHERE id = $1", briefen_id
        )
        if not briefen:
            await mark_job_failed(job_id, f"Briefen {briefen_id} não encontrado.")
            return

        icp_row = await pool.fetchrow(
            "SELECT * FROM icps WHERE id = $1", str(briefen["icp_id"])
        )
        if not icp_row:
            raise ValueError(f"ICP {briefen['icp_id']} não encontrado.")

        icp_dict = {
            "name": icp_row["name"],
            "description": icp_row["description"],
            "pain_points": list(icp_row["pain_points"] or []),
            "goals": list(icp_row["goals"] or []),
            "language_style": icp_row["language_style"],
        }

        channels_data = []
        video_snapshot: list[tuple] = []

        for channel_uuid in briefen["selected_channel_ids"]:
            channel = await pool.fetchrow(
                "SELECT * FROM channels WHERE id = $1", str(channel_uuid)
            )
            if not channel:
                continue

            videos = await pool.fetch(
                f"""
                SELECT v.id, v.title, v.views, v.likes, v.published_at,
                       s.summary, s.topics
                FROM videos v
                LEFT JOIN summaries s ON s.video_id = v.id
                WHERE v.channel_id = $1
                ORDER BY {order_sql}
                LIMIT $2
                """,
                str(channel_uuid),
                top_n,
            )

            video_list = []
            for rank, video in enumerate(videos, 1):
                video_snapshot.append(
                    (briefen_id, str(video["id"]), rank, video["views"])
                )
                published_str = (
                    video["published_at"].strftime("%d/%m/%Y")
                    if video["published_at"]
                    else ""
                )
                video_list.append(
                    {
                        "title": video["title"],
                        "views": video["views"] or 0,
                        "likes": video["likes"] or 0,
                        "published_at": published_str,
                        "summary": video["summary"] or "",
                        "topics": list(video["topics"] or []),
                    }
                )

            channels_data.append(
                {
                    "name": channel["name"],
                    "subscribers": channel["subscribers"] or 0,
                    "videos": video_list,
                }
            )

        result_markdown = await run_briefen(icp_dict, channels_data, top_n)

        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE briefens
                SET status       = 'completed',
                    result       = $1,
                    model_used   = $2,
                    completed_at = now()
                WHERE id = $3
                """,
                result_markdown,
                "claude-sonnet-4-6",
                briefen_id,
            )
            if video_snapshot:
                await conn.executemany(
                    """
                    INSERT INTO briefen_videos (briefen_id, video_id, rank, views_at_briefen)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (briefen_id, video_id) DO NOTHING
                    """,
                    video_snapshot,
                )

        await mark_job_completed(job_id)
        logger.info("run_briefen: briefen %s gerado.", briefen_id)
    except Exception as exc:
        logger.error("run_briefen: briefen %s falhou: %s", briefen_id, exc)
        await mark_job_failed(job_id, str(exc))
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE briefens SET status = 'failed', error_message = $1 WHERE id = $2",
                str(exc),
                briefen_id,
            )
