import { useState } from "react";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestMergeTags } from "../../runtime/client";
import { getErrorMessage } from "./tag-management-types";
import type { TagNotify } from "./tag-management-types";

type Options = {
  manageableTags: ArchiveTagSummaryRecord[];
  isJapanese: boolean;
  notify: TagNotify;
  reload: () => Promise<void>;
  onTagMerged: (source: string, target: string) => Promise<void>;
};

export function useTagMerge({ manageableTags, isJapanese, notify, reload, onTagMerged }: Options) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [mergeArmed, setMergeArmed] = useState(false);
  const [preserveFutureTagUses, setPreserveFutureTagUses] = useState(true);
  const [mergePending, setMergePending] = useState(false);
  const source = manageableTags.find(({ tag }) => tag.tag_id === selectedTagIds[0]) ?? null;
  const target = manageableTags.find(({ tag }) => tag.tag_id === selectedTagIds[1]) ?? null;

  function toggleSelectedTag(tagId: string): void {
    if (mergePending) {
      return;
    }
    notify("neutral", null);
    setMergeArmed(false);
    setSelectedTagIds((current) => {
      if (current.includes(tagId)) {
        return current.filter((value) => value !== tagId);
      }
      if (current.length >= 2) {
        return current;
      }
      return [...current, tagId];
    });
  }

  async function handleMerge(): Promise<void> {
    if (source === null || target === null || mergePending) {
      return;
    }
    if (!mergeArmed) {
      setMergeArmed(true);
      notify("neutral", null);
      return;
    }
    setMergePending(true);
    notify("neutral", null);
    try {
      await requestMergeTags(source.tag.tag_id, target.tag.tag_id, preserveFutureTagUses);
      await reload();
      await onTagMerged(source.tag.normalized_name, target.tag.normalized_name);
      setSelectedTagIds([]);
      const suffix = preserveFutureTagUses ? (isJapanese ? "（自動変換あり）" : " (auto-redirect on)") : "";
      notify("success", isJapanese
        ? `「${source.tag.display_name}」を「${target.tag.display_name}」へ統合しました。${suffix}`
        : `Merged "${source.tag.display_name}" into "${target.tag.display_name}".${suffix}`);
    } catch (error) {
      notify("error", getErrorMessage(error, isJapanese ? "統合に失敗しました。" : "Merge failed."));
    } finally {
      setMergeArmed(false);
      setMergePending(false);
    }
  }

  function swap(): void {
    setSelectedTagIds((current) => [...current].reverse());
    setMergeArmed(false);
  }

  function select(tagIds: string[]): void {
    if (mergePending) {
      return;
    }
    setSelectedTagIds(tagIds);
  }

  function disarm(): void {
    setMergeArmed(false);
  }

  return {
    selectedTagIds,
    source,
    target,
    armed: mergeArmed,
    preserve: preserveFutureTagUses,
    setPreserve: setPreserveFutureTagUses,
    pending: mergePending,
    toggle: toggleSelectedTag,
    swap,
    select,
    disarm,
    run: handleMerge
  };
}
