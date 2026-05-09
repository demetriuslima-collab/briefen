import logging
from datetime import datetime, timezone
from asyncpg import Connection
from app.services import youtube as yt

logger = logging.getLogger(__name__)


async def sync_channel(
    conn: Connection,
    channel_id: str,
    uploads_playlist_id: str | None = None,
) -> list[str]:
    """
    Sincroniza vídeos de um canal. Retorna IDs de vídeos sem transcrição.
    Se uploads_playlist_id não for fornecido, resolve o canal antes.
    """
    if not uploads_playlist_id:
        row = await conn.fetchrow(
            "SELECT youtube_id FROM channels WHERE id = $1", channel_id
        )
        if not row:
            raise ValueError(f"Canal {channel_id} não encontrado.")

        channel_data = await yt.resolve_channel(
            f"https://www.youtube.com/channel/{row['youtube_id']}"
        )
        uploads_playlist_id = channel_data.get("uploads_playlist_id")

        await conn.execute(
            """
            UPDATE channels
            SET subscribers = $1, total_videos = $2, last_synced_at = now()
            WHERE id = $3
            """,
            channel_data.get("subscribers"),
            channel_data.get("total_videos"),
            channel_id,
        )

    if not uploads_playlist_id:
        return []

    videos = await yt.fetch_recent_videos(uploads_playlist_id)
    logger.info("Upserting %d videos for channel %s", len(videos), channel_id)
    await upsert_videos(conn, channel_id, videos)

    # Atualiza last_synced_at se ainda não foi atualizado (sync com playlist_id direto)
    await conn.execute(
        "UPDATE channels SET last_synced_at = now() WHERE id = $1 AND last_synced_at IS NULL",
        channel_id,
    )

    rows = await conn.fetch(
        """
        SELECT v.id FROM videos v
        LEFT JOIN transcripts t ON t.video_id = v.id
        WHERE v.channel_id = $1 AND t.video_id IS NULL
        """,
        channel_id,
    )
    return [str(r["id"]) for r in rows]


def _parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def upsert_videos(conn: Connection, channel_id: str, videos: list[dict]) -> None:
    if not videos:
        return

    inserted = 0
    for v in videos:
        await conn.execute(
            """
            INSERT INTO videos (
                channel_id, youtube_id, title, description, duration_seconds,
                published_at, views, likes, comments, thumbnail_url, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (youtube_id) DO UPDATE
            SET channel_id = EXCLUDED.channel_id,
                title      = EXCLUDED.title,
                views      = EXCLUDED.views,
                likes      = EXCLUDED.likes,
                comments   = EXCLUDED.comments,
                updated_at = now()
            """,
            channel_id,
            v["youtube_id"],
            v["title"],
            v.get("description", "") or "",
            v.get("duration_seconds"),
            _parse_dt(v["published_at"]),
            v.get("views", 0) or 0,
            v.get("likes", 0) or 0,
            v.get("comments", 0) or 0,
            v.get("thumbnail_url"),
            v.get("tags") or [],
        )
        inserted += 1

    logger.info("Inserted/updated %d videos", inserted)

    # Snapshot de métricas
    youtube_ids = [v["youtube_id"] for v in videos]
    rows = await conn.fetch(
        "SELECT id, views, likes, comments FROM videos WHERE youtube_id = ANY($1)",
        youtube_ids,
    )
    for r in rows:
        await conn.execute(
            """
            INSERT INTO video_metrics_history (video_id, views, likes, comments)
            VALUES ($1, $2, $3, $4)
            """,
            r["id"],
            r["views"],
            r["likes"],
            r["comments"],
        )
