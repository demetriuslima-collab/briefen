import json
import logging
from anthropic import AsyncAnthropic
from app.core.config import settings
from app.prompts.summary import SYSTEM, build_user_message

logger = logging.getLogger(__name__)

_MODEL = "claude-haiku-4-5-20251001"
_TRANSCRIPT_LIMIT = 12_000


async def summarize_video(
    title: str,
    duration_seconds: int | None,
    description: str | None,
    transcript: str,
) -> dict:
    """
    Gera resumo, tópicos e hooks do vídeo usando Claude Haiku.
    """
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    user_msg = build_user_message(
        title=title,
        duration_seconds=duration_seconds or 0,
        description=description or "",
        transcript=transcript[:_TRANSCRIPT_LIMIT],
    )

    message = await client.messages.create(
        model=_MODEL,
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = message.content[0].text.strip()

    # Remove possível markdown ```json ... ```
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Haiku retornou JSON inválido para '%s'. Usando fallback.", title)
        data = {}

    return {
        "summary": data.get("summary", ""),
        "topics": data.get("topics", []),
        "hooks": data.get("hooks", []),
        "model_used": _MODEL,
    }
