import { useEffect, useRef, useState } from "react";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestRenameTag } from "../../runtime/client";
import { getErrorMessage } from "./tag-management-types";
import type { TagNotify } from "./tag-management-types";

type Options = {
  isJapanese: boolean;
  notify: TagNotify;
  reload: () => Promise<void>;
  onTagRenamed: (oldName: string, newName: string) => Promise<void>;
  isBlocked: boolean;
  onStart: () => void;
};

export function useTagRename(
  { isJapanese, notify, reload, onTagRenamed, isBlocked, onStart }: Options
) {
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [conflictingTagId, setConflictingTagId] = useState<string | null>(null);
  const [renamePendingTagIds, setRenamePendingTagIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const renameInputRef = useRef<HTMLInputElement>(null);
  const editingTagIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editingTagId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingTagId]);

  function setDraft(value: string): void {
    setRenameDraft(value);
    setRenameError(null);
    setConflictingTagId(null);
  }

  function startRename(tagId: string, displayName: string): void {
    // A blur-save on the previous tag may still be in flight. Only the tag being
    // saved is locked; its result is applied to the editor only while it is still open.
    if (renamePendingTagIds.has(tagId) || isBlocked) {
      return;
    }
    onStart();
    editingTagIdRef.current = tagId;
    setEditingTagId(tagId);
    setRenameDraft(displayName);
    setRenameError(null);
    setConflictingTagId(null);
    notify("neutral", null);
  }

  function cancelRename(): void {
    editingTagIdRef.current = null;
    setEditingTagId(null);
    setRenameDraft("");
    setRenameError(null);
    setConflictingTagId(null);
  }

  async function handleRename(summary: ArchiveTagSummaryRecord): Promise<boolean> {
    const tagId = summary.tag.tag_id;
    if (renamePendingTagIds.has(tagId)) {
      return false;
    }
    const name = renameDraft.trim();
    if (name === "" || name === summary.tag.display_name) {
      cancelRename();
      return true;
    }
    setRenamePendingTagIds((current) => new Set(current).add(tagId));
    setRenameError(null);
    setConflictingTagId(null);
    notify("neutral", null);
    try {
      const response = await requestRenameTag(summary.tag.tag_id, name);
      if (!response.ok) {
        if (editingTagIdRef.current === summary.tag.tag_id) {
          setConflictingTagId(response.conflictingTagId);
        } else {
          notify("error", isJapanese
            ? `「${summary.tag.display_name}」の名前を変更できませんでした。` +
              `「${name}」は既にあります。`
            : `Could not rename "${summary.tag.display_name}": "${name}" already exists.`);
        }
        return false;
      }
      await reload();
      await onTagRenamed(summary.tag.normalized_name, response.tag.normalized_name);
      const wasEditing = editingTagIdRef.current === summary.tag.tag_id;
      if (wasEditing) {
        editingTagIdRef.current = null;
        setRenameDraft("");
        setRenameError(null);
        setConflictingTagId(null);
      }
      setEditingTagId((current) => current === summary.tag.tag_id ? null : current);
      notify("success", isJapanese
        ? `タグ名を「${response.tag.display_name}」に更新しました。`
        : `Renamed tag to "${response.tag.display_name}".`);
      return wasEditing;
    } catch (error) {
      const message = getErrorMessage(error, isJapanese ? "リネームに失敗しました。" : "Rename failed.");
      if (editingTagIdRef.current === summary.tag.tag_id) {
        setRenameError(message);
      } else {
        notify("error", message);
      }
      return false;
    } finally {
      // Release only this tag's lock; another tag may still be saving.
      setRenamePendingTagIds((current) => {
        const next = new Set(current);
        next.delete(tagId);
        return next;
      });
    }
  }

  return {
    editingTagId,
    draft: renameDraft,
    setDraft,
    error: renameError,
    conflictingTagId,
    pendingTagIds: renamePendingTagIds,
    inputRef: renameInputRef,
    start: startRename,
    cancel: cancelRename,
    // Resolves true when this tag's editor closed (saved, or nothing to save).
    save: handleRename
  };
}
