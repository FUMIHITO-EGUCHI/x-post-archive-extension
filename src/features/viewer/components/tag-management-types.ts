export type FeedbackTone = "neutral" | "success" | "error";
export type TagNotify = (tone: FeedbackTone, message: string | null) => void;

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}
