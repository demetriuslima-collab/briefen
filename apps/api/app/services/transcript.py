import logging

logger = logging.getLogger(__name__)

# NOTA FUTURA — Whisper desabilitado temporariamente.
# Motivos: rate limit Groq Whisper + bot detection do yt-dlp em dev.
# Para reativar: implementar _whisper_transcript com yt-dlp + Groq ou OpenAI Whisper.
# Antes de reativar, medir % de vídeos sem legenda automática por canal
# (sugestão: SELECT COUNT(*) FROM videos v LEFT JOIN transcripts t ON t.video_id = v.id
#  WHERE t.video_id IS NULL por canal após sync completo).


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


async def get_transcript(youtube_id: str) -> tuple[str, str, str]:
    """
    Retorna (content, language, source).
    Apenas YouTube auto-captions por enquanto — Whisper desabilitado.
    """
    content, lang = _youtube_transcript(youtube_id)
    logger.info("Transcrição YouTube obtida para %s (%s)", youtube_id, lang)
    return content, lang, "youtube_auto"
