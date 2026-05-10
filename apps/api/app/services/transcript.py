import asyncio
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


def _youtube_transcript(youtube_id: str) -> tuple[str, str]:
    """Obtém legenda automática do YouTube. Levanta ValueError se indisponível."""
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
    config = aai.TranscriptionConfig(language_detection=True)

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
    """
    Retorna (content, language, source).
    Tenta YouTube auto-captions primeiro; se falhar e AssemblyAI estiver configurado,
    usa AssemblyAI como fallback.
    """
    try:
        content, lang = _youtube_transcript(youtube_id)
        logger.info("Transcrição YouTube obtida para %s (%s)", youtube_id, lang)
        return content, lang, "youtube_auto"
    except ValueError as exc:
        logger.info("YouTube sem legenda para %s: %s", youtube_id, exc)

    if not settings.assemblyai_api_key:
        raise ValueError(f"Sem legenda automática disponível para {youtube_id}.")

    logger.info("Tentando AssemblyAI para %s", youtube_id)
    content, lang = await _assemblyai_transcript(youtube_id)
    logger.info("Transcrição AssemblyAI obtida para %s (%s, %d palavras)", youtube_id, lang, len(content.split()))
    return content, lang, "assemblyai"
