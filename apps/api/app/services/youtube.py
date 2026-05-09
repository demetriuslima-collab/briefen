import re
import httpx
from app.core.config import settings

_API = "https://www.googleapis.com/youtube/v3"


def _parse_input(raw: str) -> tuple[str, str]:
    """Returns (param_name, value) for the YouTube channels.list call."""
    raw = raw.strip()

    # Bare channel ID
    if re.match(r"^UC[a-zA-Z0-9_\-]{22}$", raw):
        return "id", raw

    # @handle anywhere in the string (URL or bare)
    m = re.search(r"@([\w.\-]+)", raw)
    if m:
        return "forHandle", m.group(1)

    # /channel/UCxxxx in URL
    m = re.search(r"/channel/(UC[a-zA-Z0-9_\-]{22})", raw)
    if m:
        return "id", m.group(1)

    # /c/Name or /user/Name in URL
    m = re.search(r"/(?:c|user)/([\w.\-]+)", raw)
    if m:
        return "forUsername", m.group(1)

    return "forUsername", raw.lstrip("@")


async def resolve_channel(raw: str) -> dict:
    """Resolve channel from URL/handle/ID. Raises ValueError if not found."""
    param_name, param_value = _parse_input(raw)

    params = {
        "part": "snippet,statistics,contentDetails",
        "maxResults": 1,
        "key": settings.youtube_api_key,
        param_name: param_value,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(f"{_API}/channels", params=params)
        resp.raise_for_status()
        data = resp.json()

    items = data.get("items", [])
    if not items:
        raise ValueError(f"Canal não encontrado: {raw}")

    item = items[0]
    snippet = item["snippet"]
    stats = item.get("statistics", {})
    uploads_id = (
        item.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    )

    return {
        "youtube_id": item["id"],
        "handle": snippet.get("customUrl", "").lstrip("@") or None,
        "name": snippet["title"],
        "description": snippet.get("description", ""),
        "subscribers": int(stats.get("subscriberCount", 0)),
        "total_videos": int(stats.get("videoCount", 0)),
        "thumbnail_url": snippet.get("thumbnails", {}).get("medium", {}).get("url"),
        "uploads_playlist_id": uploads_id,
    }


async def fetch_recent_videos(uploads_playlist_id: str, max_results: int = 100) -> list[dict]:
    """Fetch latest videos from the channel's uploads playlist."""
    video_ids: list[str] = []
    page_token: str | None = None

    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: collect video IDs from playlist
        while len(video_ids) < max_results:
            params: dict = {
                "part": "contentDetails",
                "playlistId": uploads_playlist_id,
                "maxResults": min(50, max_results - len(video_ids)),
                "key": settings.youtube_api_key,
            }
            if page_token:
                params["pageToken"] = page_token

            resp = await client.get(f"{_API}/playlistItems", params=params)
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("items", []):
                video_ids.append(item["contentDetails"]["videoId"])

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        if not video_ids:
            return []

        # Step 2: fetch video details in batches of 50
        videos: list[dict] = []
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i : i + 50]
            resp = await client.get(
                f"{_API}/videos",
                params={
                    "part": "snippet,statistics,contentDetails",
                    "id": ",".join(batch),
                    "key": settings.youtube_api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("items", []):
                snippet = item["snippet"]
                stats = item.get("statistics", {})
                duration = _parse_duration(
                    item.get("contentDetails", {}).get("duration", "PT0S")
                )
                videos.append(
                    {
                        "youtube_id": item["id"],
                        "title": snippet["title"],
                        "description": snippet.get("description", ""),
                        "duration_seconds": duration,
                        "published_at": snippet["publishedAt"],
                        "views": int(stats.get("viewCount", 0)),
                        "likes": int(stats.get("likeCount", 0)),
                        "comments": int(stats.get("commentCount", 0)),
                        "thumbnail_url": snippet.get("thumbnails", {})
                        .get("medium", {})
                        .get("url"),
                        "tags": snippet.get("tags", []),
                    }
                )

    return videos


def _parse_duration(duration: str) -> int:
    """Convert ISO 8601 duration (PT#H#M#S) to total seconds."""
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration)
    if not m:
        return 0
    h = int(m.group(1) or 0)
    mins = int(m.group(2) or 0)
    secs = int(m.group(3) or 0)
    return h * 3600 + mins * 60 + secs
