export interface Channel {
  id: string;
  workspace_id: string;
  youtube_id: string;
  handle: string | null;
  name: string;
  description: string | null;
  subscribers: number | null;
  total_videos: number | null;
  thumbnail_url: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Video {
  id: string;
  channel_id: string;
  youtube_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  published_at: string;
  views: number;
  likes: number;
  comments: number;
  thumbnail_url: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface VideoWithStatus extends Video {
  transcripts: { video_id: string } | null;
  summaries: { video_id: string } | null;
}

export interface ICP {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  pain_points: string[];
  goals: string[];
  language_style: string | null;
  created_at: string;
  updated_at: string;
}

export interface Briefen {
  id: string;
  workspace_id: string;
  icp_id: string;
  title: string | null;
  selected_channel_ids: string[];
  result: string | null;
  status: "pending" | "running" | "completed" | "failed";
  model_used: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Job {
  id: string;
  workspace_id: string | null;
  type: "sync_channel" | "transcribe_video" | "summarize_video" | "run_briefen";
  status: "pending" | "running" | "completed" | "failed";
  payload: Record<string, unknown>;
  created_at: string;
}
