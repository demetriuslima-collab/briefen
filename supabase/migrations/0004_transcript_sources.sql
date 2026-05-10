-- Adiciona 'assemblyai' e 'description' como fontes válidas de transcrição
ALTER TABLE transcripts DROP CONSTRAINT transcripts_source_check;
ALTER TABLE transcripts ADD CONSTRAINT transcripts_source_check
  CHECK (source IN ('youtube_auto', 'whisper_groq', 'assemblyai', 'description'));
