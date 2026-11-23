import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestMergeTags, requestRenameTag, requestTagSummaries } from "../../runtime/client";
import type { ArchiveLanguage } from "../../settings/archive-language";
import { Icon } from "./icons";
import { useIncrementalList } from "./use-incremental-list";

type SettingsTagManagementPanelProps = {
  language: ArchiveLanguage;
  onTagRenamed: (oldNormalizedName: string, newNormalizedName: string) => Promise<void>;
  onTagMerged: (sourceNormalizedName: string, targetNormalizedName: string) => Promise<void>;
};

type FeedbackTone = "neutral" | "success" | "error";
const TAG_MANAGEMENT_LIST_SIZE = 50;

export function SettingsTagManagementPanel({
  language,
  onTagRenamed,
  onTagMerged
}: SettingsTagManagementPanelProps) {
  const [tags, setTags] = useState<ArchiveTagSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<FeedbackTone>("neutral");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [conflictingTagId, setConflictingTagId] = useState<string | null>(null);
  const [renamePendingTagId, setRenamePendingTagId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mergeArmed, setMergeArmed] = useState(false);
  const [preserveFutureTagUses, setPreserveFutureTagUses] = useState(true);
  const [mergePending, setMergePending] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const editingTagIdRef = useRef<string | null>(null);
  const isJapanese = language === "ja";

  const manageableTags = useMemo(
    () => [...tags]
      .filter(({ tag }) => tag.system_key === null)
      .sort((left, right) => right.postCount - left.postCount ||
        left.tag.display_name.localeCompare(right.tag.display_name, "ja-JP")),
    [tags]
  );
  const normalizedSearchQuery = normalizeTagSearchValue(searchQuery);
  const visibleTags = useMemo(() => {
    if (normalizedSearchQuery === "") {
      return manageableTags;
    }
    return manageableTags.filter(({ tag }) =>
      normalizeTagSearchValue(tag.display_name).includes(normalizedSearchQuery) ||
      normalizeTagSearchValue(tag.normalized_name).includes(normalizedSearchQuery));
  }, [manageableTags, normalizedSearchQuery]);
  const requiredVisibleTagCount = useMemo(() => {
    const indexes = selectedTagIds.map((id) =>
      visibleTags.findIndex(({ tag }) => tag.tag_id === id));
    indexes.push(visibleTags.findIndex(({ tag }) => tag.tag_id === editingTagId));
    return Math.max(-1, ...indexes) + 1;
  }, [editingTagId, selectedTagIds, visibleTags]);
  const {
    visibleItems: displayedTags,
    remainingCount: remainingTagCount,
    hasMore: hasMoreTags,
    loadMore: loadMoreTags
  } = useIncrementalList(visibleTags, {
    initialCount: TAG_MANAGEMENT_LIST_SIZE,
    step: TAG_MANAGEMENT_LIST_SIZE,
    requiredCount: requiredVisibleTagCount
  });
  const source = manageableTags.find(({ tag }) => tag.tag_id === selectedTagIds[0]) ?? null;
  const target = manageableTags.find(({ tag }) => tag.tag_id === selectedTagIds[1]) ?? null;
  const conflictingTag = tags.find(({ tag }) => tag.tag_id === conflictingTagId) ?? null;
  const manageableConflict =
    manageableTags.find(({ tag }) => tag.tag_id === conflictingTagId) ?? null;

  useEffect(() => {
    void loadTagList();
  }, []);
  useEffect(() => {
    if (editingTagId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingTagId]);

  async function loadTagList(): Promise<void> {
    setLoading(true);
    try {
      const response = await requestTagSummaries();
      setTags(response.tags);
    } catch (error) {
      setNoticeTone("error");
      setNotice(getErrorMessage(error, isJapanese ? "タグ一覧を取得できませんでした。" : "Failed to load tags."));
    } finally {
      setLoading(false);
    }
  }

  function startRename(tagId: string, displayName: string): void {
    // A blur-save on the previous tag may still be in flight. Only the tag being
    // saved is locked; its result is applied to the editor only while it is still open.
    if (renamePendingTagId === tagId || mergePending) {
      return;
    }
    setMergeArmed(false);
    editingTagIdRef.current = tagId;
    setEditingTagId(tagId);
    setRenameDraft(displayName);
    setRenameError(null);
    setConflictingTagId(null);
    setNotice(null);
    setNoticeTone("neutral");
  }

  function cancelRename(): void {
    editingTagIdRef.current = null;
    setEditingTagId(null);
    setRenameDraft("");
    setRenameError(null);
    setConflictingTagId(null);
  }

  async function handleRename(summary: ArchiveTagSummaryRecord): Promise<void> {
    if (renamePendingTagId !== null) {
      return;
    }
    const name = renameDraft.trim();
    if (name === "" || name === summary.tag.display_name) {
      cancelRename();
      return;
    }
    setRenamePendingTagId(summary.tag.tag_id);
    setRenameError(null);
    setConflictingTagId(null);
    setNotice(null);
    try {
      const response = await requestRenameTag(summary.tag.tag_id, name);
      if (!response.ok) {
        if (editingTagIdRef.current === summary.tag.tag_id) {
          setConflictingTagId(response.conflictingTagId);
        } else {
          setNoticeTone("error");
          setNotice(isJapanese
            ? `「${summary.tag.display_name}」の名前を変更できませんでした。` +
              `「${name}」は既にあります。`
            : `Could not rename "${summary.tag.display_name}": "${name}" already exists.`);
        }
        return;
      }
      await loadTagList();
      await onTagRenamed(summary.tag.normalized_name, response.tag.normalized_name);
      if (editingTagIdRef.current === summary.tag.tag_id) {
        editingTagIdRef.current = null;
        setRenameDraft("");
        setRenameError(null);
        setConflictingTagId(null);
      }
      setEditingTagId((current) => current === summary.tag.tag_id ? null : current);
      setNoticeTone("success");
      setNotice(isJapanese
        ? `タグ名を「${response.tag.display_name}」に更新しました。`
        : `Renamed tag to "${response.tag.display_name}".`);
    } catch (error) {
      const message = getErrorMessage(error, isJapanese ? "リネームに失敗しました。" : "Rename failed.");
      if (editingTagIdRef.current === summary.tag.tag_id) {
        setRenameError(message);
      } else {
        setNoticeTone("error");
        setNotice(message);
      }
    } finally {
      setRenamePendingTagId(null);
    }
  }

  function toggleSelectedTag(tagId: string): void {
    if (mergePending) {
      return;
    }
    setNotice(null);
    setNoticeTone("neutral");
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
      setNotice(null);
      return;
    }
    setMergePending(true);
    setNotice(null);
    try {
      await requestMergeTags(source.tag.tag_id, target.tag.tag_id, preserveFutureTagUses);
      await loadTagList();
      await onTagMerged(source.tag.normalized_name, target.tag.normalized_name);
      setSelectedTagIds([]);
      setNoticeTone("success");
      const suffix = preserveFutureTagUses ? (isJapanese ? "（自動変換あり）" : " (auto-redirect on)") : "";
      setNotice(isJapanese
        ? `「${source.tag.display_name}」を「${target.tag.display_name}」へ統合しました。${suffix}`
        : `Merged "${source.tag.display_name}" into "${target.tag.display_name}".${suffix}`);
    } catch (error) {
      setNoticeTone("error");
      setNotice(getErrorMessage(error, isJapanese ? "統合に失敗しました。" : "Merge failed."));
    } finally {
      setMergeArmed(false);
      setMergePending(false);
    }
  }

  return (
    <section className="viewer-settings-card">
      <div className="viewer-settings-card-header">
        <h3>{isJapanese ? "タグを整理" : "Organize tags"}</h3>
      </div>
      <label className="viewer-file-input-label">
        <span>{isJapanese ? "タグ名を検索" : "Search tags"}</span>
        <input
          className="viewer-file-input"
          type="search"
          value={searchQuery}
          placeholder={isJapanese ? "タグ名で絞り込み" : "Filter by tag name"}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
        />
      </label>
      <div
        className="viewer-tag-management-selection"
        aria-label={isJapanese ? "選択中のタグ" : "Selected tags"}
      >
        {[source, target].map((summary, index) => (
          <Fragment key={index}>
            {index === 1 && (
              <div className="viewer-tag-management-direction">
                <Icon name="ArrowRight" />
                <button
                  className="viewer-tag-management-swap"
                  type="button"
                  title={isJapanese ? "入れ替え" : "Swap"}
                  aria-label={isJapanese ? "旧タグと統合先を入れ替え" : "Swap source and target"}
                  disabled={selectedTagIds.length !== 2 || mergePending}
                  onClick={() => {
                    setSelectedTagIds((current) => [...current].reverse());
                    setMergeArmed(false);
                  }}
                >
                  <Icon name="Swap" />
                </button>
              </div>
            )}
            <section
              className={
                `viewer-tag-management-selection-slot${summary ? " viewer-tag-management-slot-filled" : ""}` +
                `${index === 0 && mergeArmed ? " viewer-tag-management-slot-doomed" : ""}`
              }
              aria-label={index === 0
                ? (isJapanese ? "旧タグ" : "Source tag")
                : (isJapanese ? "統合先" : "Target tag")}
            >
              {summary ? (
                <>
                  <strong>{summary.tag.display_name}</strong>
                  <span>{formatCount(summary.postCount, language)}</span>
                </>
              ) : (
                <span>
                  {index === 0 ? (isJapanese ? "旧タグ" : "Source") : (isJapanese ? "統合先" : "Target")}
                </span>
              )}
            </section>
          </Fragment>
        ))}
      </div>
      <div className="viewer-settings-action-row viewer-settings-action-row-end viewer-tag-management-actions">
        <label className="viewer-tag-management-auto">
          <input
            type="checkbox"
            checked={preserveFutureTagUses}
            disabled={mergePending}
            onChange={(event) => setPreserveFutureTagUses(event.currentTarget.checked)}
          />
          {isJapanese ? "自動変換" : "Auto-redirect"}
        </label>
        <button
          className={mergeArmed ? "viewer-danger-button" : "viewer-action-button"}
          type="button"
          disabled={source === null || target === null || mergePending || renamePendingTagId !== null}
          onClick={() => {
            void handleMerge();
          }}
        >
          {mergePending
            ? (isJapanese ? "統合中..." : "Merging...")
            : mergeArmed
              ? (isJapanese ? "統合を確定" : "Confirm merge")
              : (isJapanese ? "統合" : "Merge")}
        </button>
      </div>
      {notice !== null && <p className={feedbackClassName(noticeTone)}>{notice}</p>}
      {loading ? (
        <p className="viewer-message">{isJapanese ? "タグを読み込み中..." : "Loading tags..."}</p>
      ) : manageableTags.length === 0 ? (
        <p className="viewer-message">
          {isJapanese ? "管理対象のタグはまだありません。" : "There are no manageable tags yet."}
        </p>
      ) : visibleTags.length === 0 ? (
        <p className="viewer-message">
          {isJapanese ? "検索条件に一致するタグはありません。" : "No tags match your search."}
        </p>
      ) : (
        <>
          <div
            className="viewer-tag-management-list"
            role="grid"
            aria-label={isJapanese ? "タグ管理一覧" : "Tag management list"}
          >
            <div className="viewer-tag-management-row viewer-tag-management-row-header" role="row">
              <span aria-hidden="true" />
              <span role="columnheader">{isJapanese ? "タグ名" : "Tag"}</span>
              <span className="viewer-tag-management-count" role="columnheader">
                {isJapanese ? "投稿数" : "Posts"}
              </span>
            </div>
            {displayedTags.map((summary) => {
              const isEditing = editingTagId === summary.tag.tag_id;
              const isRenamePending = renamePendingTagId === summary.tag.tag_id;
              const isSelected = selectedTagIds.includes(summary.tag.tag_id);
              const locked = selectedTagIds.length >= 2 && !isSelected;
              const otherName = conflictingTag?.tag.display_name ?? renameDraft.trim();
              return (
                <div
                  key={summary.tag.tag_id}
                  className={
                    `viewer-tag-management-row${isSelected ? " viewer-tag-management-row-selected" : ""}` +
                    `${locked ? " viewer-tag-management-row-selection-locked" : ""}`
                  }
                  role="row"
                  tabIndex={isEditing || locked ? -1 : 0}
                  aria-selected={isSelected}
                  onClick={() => {
                    if (!isEditing && !locked) {
                      toggleSelectedTag(summary.tag.tag_id);
                    }
                  }}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                    if (!isEditing && !locked && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      toggleSelectedTag(summary.tag.tag_id);
                    }
                  }}
                >
                  <div className="viewer-tag-management-cell" role="gridcell" aria-hidden="true">
                    <span
                      className={`tag-picker-option-check${isSelected ? " tag-picker-check-selected" : ""}`}
                    >
                      {isSelected && <Icon name="Check" />}
                    </span>
                  </div>
                  <div className="viewer-tag-management-cell" role="gridcell">
                    {isEditing ? (
                      <div
                        className={
                          `viewer-tag-management-edit${conflictingTagId !== null || renameError !== null
                            ? " viewer-tag-management-edit-error" : ""}`
                        }
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameDraft}
                          disabled={isRenamePending}
                          aria-label={isJapanese ? "新しいタグ名" : "New tag name"}
                          aria-invalid={conflictingTagId !== null || renameError !== null}
                          onChange={(event) => {
                            setRenameDraft(event.currentTarget.value);
                            setRenameError(null);
                            setConflictingTagId(null);
                          }}
                          onBlur={() => {
                            if (conflictingTagId === null && renameError === null && !isRenamePending) {
                              void handleRename(summary);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleRename(summary);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelRename();
                            }
                          }}
                        />
                        <button
                          className="viewer-tag-management-edit-save"
                          type="button"
                          disabled={isRenamePending}
                          aria-label={isJapanese ? "保存" : "Save"}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            void handleRename(summary);
                          }}
                        >
                          <Icon name="Check" />
                        </button>
                        <button
                          className="viewer-tag-management-edit-cancel"
                          type="button"
                          disabled={isRenamePending}
                          aria-label={isJapanese ? "取り消し" : "Cancel"}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={cancelRename}
                        >
                          <Icon name="Close" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="viewer-tag-management-name"
                        type="button"
                        title={isJapanese ? "名前を変更" : "Rename"}
                        aria-label={isJapanese
                          ? `${summary.tag.display_name} の名前を変更`
                          : `Rename ${summary.tag.display_name}`}
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          startRename(summary.tag.tag_id, summary.tag.display_name);
                        }}
                      >
                        <span>{summary.tag.display_name}</span>
                        <span className="viewer-tag-management-name-pen">
                          <Icon name="Pencil" />
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="viewer-tag-management-cell viewer-tag-management-count" role="gridcell">
                    {formatCount(summary.postCount, language)}
                  </div>
                  {isEditing && (conflictingTagId !== null || renameError !== null) && (
                    <div
                      className="viewer-tag-management-error"
                      role="alert"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {conflictingTagId !== null
                        ? (isJapanese ? `「${otherName}」は既にある` : `"${otherName}" already exists`)
                        : renameError}
                      {manageableConflict !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTagIds([summary.tag.tag_id, manageableConflict.tag.tag_id]);
                            setMergeArmed(false);
                            cancelRename();
                          }}
                        >
                          {isJapanese ? `「${otherName}」へ統合` : `Merge into "${otherName}"`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {hasMoreTags && (
            <div className="viewer-incremental-list-footer">
              <button className="viewer-secondary-button" type="button" onClick={loadMoreTags}>
                {isJapanese
                  ? `さらに ${formatCount(remainingTagCount, language)} 件`
                  : `${formatCount(remainingTagCount, language)} more`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function feedbackClassName(tone: FeedbackTone): string {
  if (tone === "error") {
    return "viewer-message viewer-message-error";
  }
  if (tone === "success") {
    return "viewer-message viewer-message-success";
  }
  return "viewer-message";
}

function formatCount(value: number, language: ArchiveLanguage): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

function normalizeTagSearchValue(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ja-JP");
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}
