import { useState } from "react";
import type {
  ArchiveSummaryRecord,
  ArchiveTagSummaryRecord,
  UserSummary
} from "../../../types/viewer";
import { createLogger } from "../../logging/logger";
import {
  requestArchiveSummary,
  requestTagSummaries,
  requestUserSummaries
} from "../../runtime/client";

const logger = createLogger("viewer");

export function useArchiveMetadata() {
  const [availableTags, setAvailableTags] = useState<ArchiveTagSummaryRecord[]>([]);
  const [archiveSummary, setArchiveSummary] = useState<ArchiveSummaryRecord>({
    postCount: 0,
    imageCount: 0,
    videoCount: 0,
    mediaCount: 0,
    accountCount: 0,
    tagCount: 0,
    mediaBytes: 0
  });
  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);

  async function refreshArchiveMetadata(): Promise<void> {
    try {
      const [summaryResponse, tagsResponse, usersResponse] = await Promise.all([
        requestArchiveSummary(),
        requestTagSummaries(),
        requestUserSummaries()
      ]);

      setArchiveSummary(summaryResponse.summary);
      setAvailableTags(tagsResponse.tags);
      setUserSummaries(usersResponse.users);
    } catch (error) {
      logger.error("archive.metadata.load.failed", {
        message: "Failed to load archive metadata.",
        context: {
          error
        }
      });
    }
  }

  return {
    archiveSummary,
    availableTags,
    refreshArchiveMetadata,
    userSummaries
  };
}
