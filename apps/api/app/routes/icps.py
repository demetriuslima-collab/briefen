import io
import json
import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from asyncpg import Connection
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.db.client import get_db, resolve_workspace_id

router = APIRouter()


@router.post("/extract")
async def extract_icp_from_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id),
):
    """
    Lê um documento (PDF, DOCX, TXT) e extrai campos de ICP via Claude.
    Retorna os campos preenchidos para revisão no frontend.
    """
    data = await file.read()
    filename = (file.filename or "").lower()

    try:
        if filename.endswith(".pdf"):
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(data))
            text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            )
        elif filename.endswith(".docx"):
            import docx
            doc = docx.Document(io.BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs)
        else:
            text = data.decode("utf-8", errors="ignore")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Não foi possível ler o documento: {exc}",
        )

    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="O documento está vazio ou não contém texto legível.",
        )

    extracted = await _extract_with_claude(text[:20_000])
    return extracted


async def _extract_with_claude(content: str) -> dict:
    from anthropic import AsyncAnthropic
    from app.core.config import settings

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": (
                    "Extraia as informações de ICP (Perfil de Cliente Ideal) deste documento "
                    "e retorne um JSON com exatamente estas chaves:\n\n"
                    '- "name": nome ou título para este ICP (string curta)\n'
                    '- "description": descrição geral do perfil (parágrafo)\n'
                    '- "pain_points": lista de dores e frustrações (array de strings)\n'
                    '- "goals": lista de objetivos e metas (array de strings)\n'
                    '- "language_style": estilo de comunicação preferido (string curta ou null)\n\n'
                    "Retorne apenas o JSON válido, sem texto antes ou depois.\n\n"
                    f"Documento:\n{content}"
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Remove possível markdown ```json ... ```
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Claude retornou JSON inválido: {exc}",
        )


class CreateICPRequest(BaseModel):
    name: str
    description: str
    pain_points: list[str] = []
    goals: list[str] = []
    language_style: str | None = None


class UpdateICPRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    pain_points: list[str] | None = None
    goals: list[str] | None = None
    language_style: str | None = None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_icp(
    body: CreateICPRequest,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    row = await db.fetchrow(
        """
        INSERT INTO icps (workspace_id, name, description, pain_points, goals, language_style)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
        RETURNING *
        """,
        workspace_id,
        body.name,
        body.description,
        json.dumps(body.pain_points),
        json.dumps(body.goals),
        body.language_style,
    )
    return _serialize(dict(row))


@router.get("")
async def list_icps(
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    rows = await db.fetch(
        "SELECT * FROM icps WHERE workspace_id = $1 ORDER BY created_at DESC",
        workspace_id,
    )
    return [_serialize(dict(row)) for row in rows]


@router.get("/{icp_id}")
async def get_icp(
    icp_id: str,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)
    row = await db.fetchrow(
        "SELECT * FROM icps WHERE id = $1 AND workspace_id = $2",
        icp_id,
        workspace_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ICP não encontrado.")
    return _serialize(dict(row))


@router.patch("/{icp_id}")
async def update_icp(
    icp_id: str,
    body: UpdateICPRequest,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)

    row = await db.fetchrow(
        "SELECT * FROM icps WHERE id = $1 AND workspace_id = $2",
        icp_id,
        workspace_id,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ICP não encontrado.")

    updates = {
        "name": body.name if body.name is not None else row["name"],
        "description": body.description if body.description is not None else row["description"],
        "pain_points": json.dumps(body.pain_points) if body.pain_points is not None else json.dumps(list(row["pain_points"])),
        "goals": json.dumps(body.goals) if body.goals is not None else json.dumps(list(row["goals"])),
        "language_style": body.language_style if body.language_style is not None else row["language_style"],
    }

    updated = await db.fetchrow(
        """
        UPDATE icps
        SET name           = $1,
            description    = $2,
            pain_points    = $3::jsonb,
            goals          = $4::jsonb,
            language_style = $5
        WHERE id = $6
        RETURNING *
        """,
        updates["name"],
        updates["description"],
        updates["pain_points"],
        updates["goals"],
        updates["language_style"],
        icp_id,
    )
    return _serialize(dict(updated))


@router.delete("/{icp_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_icp(
    icp_id: str,
    user_id: str = Depends(get_user_id),
    db: Connection = Depends(get_db),
):
    workspace_id = await resolve_workspace_id(user_id, db)

    briefen_count = await db.fetchval(
        "SELECT COUNT(*) FROM briefens WHERE icp_id = $1",
        icp_id,
    )
    if briefen_count and briefen_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ICP em uso por briefens existentes. Remova os briefens primeiro.",
        )

    result = await db.execute(
        "DELETE FROM icps WHERE id = $1 AND workspace_id = $2",
        icp_id,
        workspace_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ICP não encontrado.")


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
