export type ThreadExpandQueueStatus = "pending" | "in_progress" | "failed";

export type ThreadExpandQueueRecord = {
  id?: number;
  candidate_post_id: string;
  thread_root_id: string;
  status: ThreadExpandQueueStatus;
  retry_count: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
  next_attempt_at: number;
};

export type TweetDetailTemplateRecord = {
  id: "current";
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  variables: Record<string, unknown>;
  features: Record<string, unknown> | null;
  fieldToggles: Record<string, unknown> | null;
  captured_at: number;
};
