from datetime import datetime
from uuid import UUID
from typing import Any
from pydantic import BaseModel


class Workspace(BaseModel):
    id: UUID
    name: str
    created_at: datetime


class Channel(BaseModel):
    id: UUID
    workspace_id: UUID
    youtube_id: str
    handle: str | None
    name: str
    description: str | None
    subscribers: int | None
    total_videos: int | None
    thumbnail_url: str | None
    last_synced_at: datetime | None
    created_at: datetime


class Video(BaseModel):
    id: UUID
    channel_id: UUID
    youtube_id: str
    title: str
    description: str | None
    duration_seconds: int | None
    published_at: datetime
    views: int
    likes: int
    comments: int
    thumbnail_url: str | None
    tags: list[str] | None
    created_at: datetime
    updated_at: datetime


class ICP(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    description: str
    pain_points: list[str]
    goals: list[str]
    language_style: str | None
    created_at: datetime
    updated_at: datetime


class Briefen(BaseModel):
    id: UUID
    workspace_id: UUID
    icp_id: UUID
    title: str | None
    selected_channel_ids: list[UUID]
    result: str | None
    status: str
    model_used: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None


class Job(BaseModel):
    id: UUID
    workspace_id: UUID | None
    type: str
    status: str
    payload: dict[str, Any]
    result: dict[str, Any] | None
    error_message: str | None
    attempts: int
    max_attempts: int
    scheduled_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
