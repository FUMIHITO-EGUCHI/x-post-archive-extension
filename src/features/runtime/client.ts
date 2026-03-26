import type {
  ArchiveStatsResponse,
  RuntimeMessage,
  RuntimeResponse
} from "../../types/runtime";

export async function requestArchiveStats(): Promise<ArchiveStatsResponse> {
  const message: RuntimeMessage = {
    type: "viewer/get-archive-stats"
  };

  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse;

  if (response?.type !== "viewer/archive-stats") {
    throw new Error("Unexpected runtime response for archive stats request.");
  }

  return response;
}

