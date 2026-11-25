import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestTagSummaries } from "../../runtime/client";
import { getErrorMessage } from "./tag-management-types";
import type { TagNotify } from "./tag-management-types";
import { useEventCallback } from "./use-event-callback";

export function useTagSummaries(
  { isJapanese, notify }: { isJapanese: boolean; notify: TagNotify }
) {
  const [tags, setTags] = useState<ArchiveTagSummaryRecord[]>([]);
  // True only until the first response; later reloads keep the list (and row focus) on screen.
  const [loading, setLoading] = useState(true);
  const latestRequestIdRef = useRef(0);
  const manageableTags = useMemo(
    () => [...tags]
      .filter(({ tag }) => tag.system_key === null)
      .sort((left, right) => right.postCount - left.postCount ||
        left.tag.display_name.localeCompare(right.tag.display_name, "ja-JP")),
    [tags]
  );
  const loadInitial = useEventCallback(() => {
    void reload();
  });

  useEffect(() => {
    loadInitial();
    return () => {
      // Drop any response that arrives after unmount.
      latestRequestIdRef.current += 1;
    };
  }, [loadInitial]);

  async function reload(): Promise<void> {
    // Only the latest call may update state; an older response that arrives late is ignored.
    latestRequestIdRef.current += 1;
    const requestId = latestRequestIdRef.current;
    try {
      const response = await requestTagSummaries();
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setTags(response.tags);
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      notify("error", getErrorMessage(
        error, isJapanese ? "タグ一覧を取得できませんでした。" : "Failed to load tags."
      ));
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  return { tags, loading, manageableTags, reload };
}
