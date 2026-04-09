import type { SavePostInput } from "./archive";

export type RefetchQueueStatus = "pending" | "done" | "error";
export type RefetchQueuePriority = 0 | 1;
export type RefetchPhase = "idle" | "running" | "stopped";

export type RefetchQueueRecord = {
  x_post_id: string;
  status: RefetchQueueStatus;
  priority: RefetchQueuePriority;
  enqueued_at: number;
  attempts: number;
  completed_at: number | null;
  last_error: string | null;
};

export type RefetchStatusRecord = {
  phase: RefetchPhase;
  currentPostId: string | null;
  currentAttempt: number | null;
  pendingCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  stopRequested: boolean;
  averageDurationMs: number | null;
  estimatedRemainingMs: number | null;
};

export type RefetchCheckMessage = {
  type: "refetch.check";
  xPostId: string;
};

export type RefetchCheckResponse = {
  found: boolean;
  extracted: boolean;
  waitingForMedia: boolean;
  imageHintCount: number;
  videoHintCount: number;
  savableMediaCount: number;
  warmupApplied: boolean;
};

export type RefetchCompletePayload = {
  xPostId: string;
  post: SavePostInput | null;
  error: string | null;
};

export const DEFAULT_REFETCH_STATUS: RefetchStatusRecord = {
  phase: "idle",
  currentPostId: null,
  currentAttempt: null,
  pendingCount: 0,
  completedCount: 0,
  failedCount: 0,
  totalCount: 0,
  stopRequested: false,
  averageDurationMs: null,
  estimatedRemainingMs: null
};
