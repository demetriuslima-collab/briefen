import logging
from anthropic import AsyncAnthropic
from app.core.config import settings
from app.prompts.briefen import SYSTEM, build_user_message

logger = logging.getLogger(__name__)

_MODEL = "claude-sonnet-4-6"


async def run_briefen(icp: dict, channels: list[dict], top_n: int) -> str:
    """
    Gera um briefen usando Claude Sonnet.
    Retorna o markdown do resultado.
    """
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_msg = build_user_message(icp, channels, top_n)

    logger.info(
        "run_briefen: chamando %s — ICP=%s, %d canais, top_n=%d",
        _MODEL,
        icp.get("name"),
        len(channels),
        top_n,
    )

    message = await client.messages.create(
        model=_MODEL,
        max_tokens=4096,
        system=SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    return message.content[0].text
