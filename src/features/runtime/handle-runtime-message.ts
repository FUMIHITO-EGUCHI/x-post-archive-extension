import { getArchiveStats } from "../../db/repositories/archive-stats-repository";
import type { ArchiveStatsResponse, RuntimeMessage, RuntimeResponse } from "../../types/runtime";

export async function handleRuntimeMessage(message: unknown): Promise<RuntimeResponse | undefined> {
  if (!isRuntimeMessage(message)) {
    return undefined;
  }

  switch (message.type) {
    case "viewer/get-archive-stats": {
      const stats = await getArchiveStats();

      const response: ArchiveStatsResponse = {
        type: "viewer/archive-stats",
        stats
      };

      return response;
    }
  }
}

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RuntimeMessage>;
  return candidate.type === "viewer/get-archive-stats";
}

