import { useEffect, useMemo, useState } from "react";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestTagSummaries } from "../../runtime/client";
import { getErrorMessage } from "./tag-management-types";
import type { TagNotify } from "./tag-management-types";
import { useEventCallback } from "./use-event-callback";

export function useTagSummaries(
  { isJapanese, notify }: { isJapanese: boolean; notify: TagNotify }
) {
  const [tags, setTags] = useState<ArchiveTagSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [loadInitial]);

  async function reload(): Promise<void> {
    setLoading(true);
    try {
      const response = await requestTagSummaries();
      setTags(response.tags);
    } catch (error) {
      notify("error", getErrorMessage(
        error, isJapanese ? "タグ一覧を取得できませんでした。" : "Failed to load tags."
      ));
    } finally {
      setLoading(false);
    }
  }

  return { tags, loading, manageableTags, reload };
}
