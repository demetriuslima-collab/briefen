import asyncio
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def _youtube_transcript(youtube_id: str) -> tuple[str, str]:
    """Obtém legenda do YouTube. Tenta pt/pt-BR/en/en-US em ordem."""
    from youtube_transcript_api import YouTubeTranscriptApi

    api = YouTubeTranscriptApi()
    for lang in ["pt", "pt-BR", "en", "en-US"]:
        try:
            transcript = api.fetch(youtube_id, languages=[lang])
            content = " ".join(t.text for t in transcript).strip()
            if content:
                return content, lang[:2]
        except Exception:
            continue

    raise ValueError(f"Sem legenda automática disponível para {youtube_id}.")


def _assemblyai_transcript_sync(youtube_id: str) -> tuple[str, str]:
    """Transcreve via AssemblyAI. Bloqueante — chamar via run_in_executor."""
    import assemblyai as aai

    aai.settings.api_key = settings.assemblyai_api_key

    url = f"https://www.youtube.com/watch?v={youtube_id}"
    config = aai.TranscriptionConfig(
        speech_models=["universal-3-pro"],
        language_code="pt",
    )

    transcriber = aai.Transcriber()
    transcript = transcriber.transcribe(url, config=config)

    if transcript.status == aai.TranscriptStatus.error:
        raise ValueError(f"AssemblyAI error: {transcript.error}")

    text = transcript.text or ""
    lang = (transcript.language_code or "pt")[:2]
    return text, lang


async def _assemblyai_transcript(youtube_id: str) -> tuple[str, str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _assemblyai_transcript_sync, youtube_id)


async def get_transcript(youtube_id: str) -> tuple[str, str, str]:
    """Retorna (content, language, source). Usa apenas YouTube auto-captions."""
    content, lang = _youtube_transcript(youtube_id)
    logger.info("Transcrição YouTube obtida para %s (lang=%s)", youtube_id, lang)
    return content, lang, "youtube_auto"
