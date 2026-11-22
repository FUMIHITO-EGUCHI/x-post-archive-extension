import { Icon } from "./icons";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestMergeTags, requestRenameTag, requestTagSummaries } from "../../runtime/client";
import type { ArchiveLanguage } from "../../settings/archive-language";
import { useIncrementalList } from "./use-incremental-list";
import { useDialogA11y } from "./use-dialog-a11y";

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
  const [renamePendingTagId, setRenamePendingTagId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetTagId, setMergeTargetTagId] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeConfirmationRequired, setMergeConfirmationRequired] = useState(false);
  const [preserveFutureTagUses, setPreserveFutureTagUses] = useState(true);
  const [mergePending, setMergePending] = useState(false);
  const isJapanese = language === "ja";
  const mergeDialogRef = useRef<HTMLElement | null>(null);
  const mergeDialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const manageableTags = useMemo(
    () =>
      [...tags]
        .filter(({ tag }) => tag.system_key === null)
        .sort((left, right) => {
          const countDifference = right.postCount - left.postCount;

          if (countDifference !== 0) {
            return countDifference;
          }

          return left.tag.display_name.localeCompare(right.tag.display_name, "ja-JP");
        }),
    [tags]
  );
  const normalizedSearchQuery = normalizeTagSearchValue(searchQuery);
  const visibleTags = useMemo(() => {
    if (normalizedSearchQuery === "") {
      return manageableTags;
    }

    return manageableTags.filter(({ tag }) => {
      const displayName = normalizeTagSearchValue(tag.display_name);
      const normalizedName = normalizeTagSearchValue(tag.normalized_name);

      return displayName.includes(normalizedSearchQuery) || normalizedName.includes(normalizedSearchQuery);
    });
  }, [manageableTags, normalizedSearchQuery]);
  const requiredVisibleTagCount = useMemo(() => {
    const selectedIndexes = selectedTagIds
      .map((tagId) => visibleTags.findIndex(({ tag }) => tag.tag_id === tagId))
      .filter((index) => index >= 0);
    const editingIndex =
      editingTagId === null ? -1 : visibleTags.findIndex(({ tag }) => tag.tag_id === editingTagId);
    const highestIndex = Math.max(editingIndex, ...selectedIndexes);

    return highestIndex < 0 ? 0 : highestIndex + 1;
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

  const selectedTags = selectedTagIds
    .map((tagId) => manageableTags.find(({ tag }) => tag.tag_id === tagId) ?? null)
    .filter((tag): tag is ArchiveTagSummaryRecord => tag !== null);
  const leftSelectedTag = selectedTags[0] ?? null;
  const rightSelectedTag = selectedTags[1] ?? null;

  useDialogA11y({
    isOpen: isMergeModalOpen,
    containerRef: mergeDialogRef,
    initialFocusRef: mergeDialogCloseButtonRef,
    onClose: closeMergeModal
  });

  useEffect(() => {
    void loadTagList();
  }, []);

  async function loadTagList(): Promise<void> {
    setLoading(true);

    try {
      const tagResponse = await requestTagSummaries();
      setTags(tagResponse.tags);
    } catch (error) {
      setNoticeTone("error");
      setNotice(
        getErrorMessage(
          error,
          isJapanese ? "タグ一覧を取得できませんでした。" : "Failed to load tags."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function startRename(tagId: string, displayName: string): void {
    setEditingTagId(tagId);
    setRenameDraft(displayName);
    setRenameError(null);
    setNotice(null);
    setNoticeTone("neutral");
  }

  function cancelRename(): void {
    setEditingTagId(null);
    setRenameDraft("");
    setRenameError(null);
  }

  async function handleRename(tag: ArchiveTagSummaryRecord): Promise<void> {
    setRenamePendingTagId(tag.tag.tag_id);
    setRenameError(null);
    setNotice(null);

    try {
      const response = await requestRenameTag(tag.tag.tag_id, renameDraft);

      if (!response.ok) {
        const attemptedName = renameDraft.trim();
        setRenameError(
          isJapanese
            ? `「${attemptedName}」は既に存在します。統合する場合はタグ統合を使ってください。`
            : `"${attemptedName}" already exists. Use merge if you want to combine them.`
        );
        return;
      }

      await loadTagList();
      await onTagRenamed(tag.tag.normalized_name, response.tag.normalized_name);
      setEditingTagId(null);
      setRenameDraft("");
      setNoticeTone("success");
      setNotice(
        isJapanese
          ? `タグ名を「${response.tag.display_name}」に更新しました。`
          : `Renamed tag to "${response.tag.display_name}".`
      );
    } catch (error) {
      setRenameError(
        getErrorMessage(error, isJapanese ? "リネームに失敗しました。" : "Rename failed.")
      );
    } finally {
      setRenamePendingTagId(null);
    }
  }

  function toggleSelectedTag(tagId: string): void {
    setNotice(null);
    setNoticeTone("neutral");
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

  function openMergeModal(): void {
    if (selectedTags.length !== 2) {
      return;
    }

    setMergeTargetTagId(selectedTags[1]?.tag.tag_id ?? null);
    setMergeError(null);
    setMergeConfirmationRequired(false);
    setPreserveFutureTagUses(true);
    setIsMergeModalOpen(true);
    setNotice(null);
  }

  function closeMergeModal(): void {
    setIsMergeModalOpen(false);
    setMergeTargetTagId(null);
    setMergeError(null);
    setMergeConfirmationRequired(false);
    setPreserveFutureTagUses(true);
  }

  function requestMergeConfirmation(): void {
    if (selectedTags.length !== 2 || mergeTargetTagId === null || mergePending) {
      return;
    }

    setMergeError(null);
    setMergeConfirmationRequired(true);
  }

  async function handleMerge(): Promise<void> {
    if (selectedTags.length !== 2 || mergeTargetTagId === null) {
      return;
    }

    const target = selectedTags.find(({ tag }) => tag.tag_id === mergeTargetTagId) ?? null;
    const source = selectedTags.find(({ tag }) => tag.tag_id !== mergeTargetTagId) ?? null;

    if (target === null || source === null) {
      setMergeError(isJapanese ? "選択したタグを確認できません。" : "Selected tags are unavailable.");
      return;
    }

    setMergePending(true);
    setMergeError(null);
    setNotice(null);

    try {
      await requestMergeTags(source.tag.tag_id, target.tag.tag_id, preserveFutureTagUses);
      await loadTagList();
      await onTagMerged(source.tag.normalized_name, target.tag.normalized_name);
      setSelectedTagIds([]);
      closeMergeModal();
      setNoticeTone("success");
      setNotice(
        isJapanese
          ? `「${source.tag.display_name}」を「${target.tag.display_name}」へ統合しました。`
          : `Merged "${source.tag.display_name}" into "${target.tag.display_name}".`
      );
    } catch (error) {
      setMergeError(
        getErrorMessage(error, isJapanese ? "統合に失敗しました。" : "Merge failed.")
      );
    } finally {
      setMergePending(false);
    }
  }

  return (
    <>
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
            onChange={(event) => {
              setSearchQuery(event.currentTarget.value);
            }}
          />
        </label>

        <div className="viewer-tag-management-selection" aria-label={isJapanese ? "選択中のタグ" : "Selected tags"}>
          <section className="viewer-tag-management-selection-slot" aria-label={isJapanese ? "旧タグ" : "Source tag"}>
            {leftSelectedTag === null ? (
              <p className="viewer-tag-management-selection-empty">
                {isJapanese ? "旧タグ" : "Source tag"}
              </p>
            ) : (
              <div className="viewer-tag-management-selection-card viewer-tag-source">
                <strong>{leftSelectedTag.tag.display_name}</strong>
                <span>
                  {formatCount(leftSelectedTag.postCount, language)} {isJapanese ? "件の投稿" : "posts"}
                </span>
              </div>
            )}
          </section>

          <Icon name="ArrowRight" />
          <section className="viewer-tag-management-selection-slot" aria-label={isJapanese ? "統合先" : "Target tag"}>
            {rightSelectedTag === null ? (
              <p className="viewer-tag-management-selection-empty">
                {isJapanese ? "統合先" : "Target tag"}
              </p>
            ) : (
              <div className="viewer-tag-management-selection-card">
                <strong>{rightSelectedTag.tag.display_name}</strong>
                <span>
                  {formatCount(rightSelectedTag.postCount, language)} {isJapanese ? "件の投稿" : "posts"}
                </span>
              </div>
            )}
          </section>
        </div>

        <div className="viewer-settings-action-row viewer-settings-action-row-end">
          <button
            className="viewer-action-button"
            type="button"
            disabled={selectedTagIds.length !== 2}
            onClick={openMergeModal}
          >
            {isJapanese ? "統合内容を確認" : "Review merge"}
          </button>
        </div>

        {notice !== null && <p className={feedbackClassName(noticeTone)}>{notice}</p>}

        {loading ? (
          <p className="viewer-message">{isJapanese ? "タグを読み込み中..." : "Loading tags..."}</p>
        ) : manageableTags.length === 0 ? (
          <p className="viewer-message">
            {isJapanese
              ? "管理対象のタグはまだありません。"
              : "There are no manageable tags yet."}
          </p>
        ) : visibleTags.length === 0 ? (
          <p className="viewer-message">
            {isJapanese ? "検索条件に一致するタグはありません。" : "No tags match your search."}
          </p>
        ) : (
          <>
            <div
              className="viewer-tag-management-list"
              role="table"
              aria-label={isJapanese ? "タグ管理一覧" : "Tag management list"}
            >
              <div className="viewer-tag-management-row viewer-tag-management-row-header" role="row">
                <span aria-hidden="true" />
                <span role="columnheader">{isJapanese ? "タグ名" : "Tag"}</span>
                <span role="columnheader">{isJapanese ? "投稿数" : "Posts"}</span>
                <span role="columnheader">{isJapanese ? "リネーム" : "Rename"}</span>
              </div>

              {displayedTags.map((summary) => {
                const isEditing = editingTagId === summary.tag.tag_id;
                const isRenamePending = renamePendingTagId === summary.tag.tag_id;
                const disableUncheckedSelection =
                  selectedTagIds.length >= 2 && !selectedTagIds.includes(summary.tag.tag_id);
                const isSelected = selectedTagIds.includes(summary.tag.tag_id);

                return (
                  <div
                    key={summary.tag.tag_id}
                    className={`viewer-tag-management-row${isSelected ? " viewer-tag-management-row-selected" : ""}${
                      disableUncheckedSelection ? " viewer-tag-management-row-selection-locked" : ""
                    }`}
                    role="row"
                    tabIndex={isEditing || disableUncheckedSelection ? -1 : 0}
                    aria-selected={isSelected}
                    onClick={() => {
                      if (isEditing || disableUncheckedSelection) {
                        return;
                      }

                      toggleSelectedTag(summary.tag.tag_id);
                    }}
                    onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                      if (isEditing || disableUncheckedSelection) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleSelectedTag(summary.tag.tag_id);
                      }
                    }}
                  >
                    <div className="viewer-tag-management-cell" role="cell" aria-hidden="true">
                      {!isEditing && (
                        <span className={`tag-picker-option-check${isSelected ? " tag-picker-check-selected" : ""}`}>
                          {isSelected && <Icon name="Check" />}
                        </span>
                      )}
                    </div>
                    <div className="viewer-tag-management-cell" role="cell">
                      <strong>{summary.tag.display_name}</strong>
                    </div>
                    <div className="viewer-tag-management-cell" role="cell">
                      {formatCount(summary.postCount, language)}
                    </div>
                    <div className="viewer-tag-management-cell" role="cell">
                      {isEditing ? (
                        <div
                          className="viewer-tag-management-inline"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <input
                            className="viewer-file-input"
                            type="text"
                            value={renameDraft}
                            disabled={isRenamePending}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                            onChange={(event) => {
                              setRenameDraft(event.currentTarget.value);
                              setRenameError(null);
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
                          <div className="viewer-settings-action-row">
                            <button
                              className="viewer-action-button"
                              type="button"
                              disabled={isRenamePending}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRename(summary);
                              }}
                            >
                              {isRenamePending
                                ? isJapanese
                                  ? "保存中..."
                                  : "Saving..."
                                : isJapanese
                                  ? "保存"
                                  : "Save"}
                            </button>
                            <button
                              className="viewer-secondary-button"
                              type="button"
                              disabled={isRenamePending}
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelRename();
                              }}
                            >
                              {isJapanese ? "キャンセル" : "Cancel"}
                            </button>
                          </div>
                          {renameError !== null && (
                            <p className="viewer-message viewer-message-error">{renameError}</p>
                          )}
                        </div>
                      ) : (
                        <button
                          className="viewer-secondary-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startRename(summary.tag.tag_id, summary.tag.display_name);
                          }}
                        >
                          {isJapanese ? "リネーム" : "Rename"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMoreTags && (
              <div className="viewer-incremental-list-footer">
                <button
                  className="viewer-secondary-button"
                  type="button"
                  onClick={() => {
                    loadMoreTags();
                  }}
                >
                  {isJapanese ? `さらに ${formatCount(remainingTagCount, language)} 件` : `${formatCount(remainingTagCount, language)} more`}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {isMergeModalOpen && (
        <div
          className="viewer-modal-backdrop"
          role="presentation"
          onClick={closeMergeModal}
        >
          <section
            ref={mergeDialogRef}
            className="viewer-modal viewer-tag-management-modal"
            role="dialog"
            aria-modal="true"
            aria-label={isJapanese ? "タグの統合" : "Merge tags"}
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="viewer-modal-header">
              <div className="viewer-modal-copy">
                <h2>{isJapanese ? "タグを統合" : "Merge tags"}</h2>
              </div>
              <button
                ref={mergeDialogCloseButtonRef}
                className="viewer-secondary-button"
                type="button"
                disabled={mergePending}
                onClick={closeMergeModal}
              >
                {isJapanese ? "閉じる" : "Close"}
              </button>
            </div>

            <div className="viewer-tag-management-targets">
              {selectedTags.map((summary) => (
                <button
                  key={summary.tag.tag_id}
                  className={
                    mergeTargetTagId === summary.tag.tag_id
                      ? "viewer-font-option viewer-font-option-active"
                      : "viewer-font-option"
                  }
                  type="button"
                  disabled={mergePending}
                  onClick={() => {
                    setMergeTargetTagId(summary.tag.tag_id);
                    setMergeConfirmationRequired(false);
                  }}
                >
                  <strong>{summary.tag.display_name}</strong>
                  <span>
                    {isJapanese ? "残す名前にする" : "Keep this name"}
                  </span>
                </button>
              ))}
            </div>

            {mergeTargetTagId !== null && (
              <div className="viewer-tag-management-selection">
                <span className="viewer-tag-management-selection-card viewer-tag-source">
                  {selectedTags.find(({ tag }) => tag.tag_id !== mergeTargetTagId)?.tag.display_name}
                </span>
                <Icon name="ArrowRight" />
                <span className="viewer-tag-management-selection-card">
                  {selectedTags.find(({ tag }) => tag.tag_id === mergeTargetTagId)?.tag.display_name}
                </span>
              </div>
            )}

            <label className="viewer-tag-management-merge-option">
              <input
                type="checkbox"
                checked={preserveFutureTagUses}
                disabled={mergePending}
                onChange={(event) => {
                  setPreserveFutureTagUses(event.currentTarget.checked);
                }}
              />
              <span>
                <strong>
                  {isJapanese
                    ? "今後このタグ名が使われたときも同じ統合先へ自動変換する"
                    : "Automatically redirect future uses of this source tag to the same merged tag"}
                </strong>
              </span>
            </label>

            {mergeConfirmationRequired && mergeTargetTagId !== null && (
              <p className="viewer-message viewer-message-warning">
                {(() => {
                  const target = selectedTags.find(({ tag }) => tag.tag_id === mergeTargetTagId) ?? null;
                  const source = selectedTags.find(({ tag }) => tag.tag_id !== mergeTargetTagId) ?? null;

                  if (target === null || source === null) {
                    return isJapanese
                      ? "統合対象を確認してから実行してください。"
                      : "Review the merge targets before continuing.";
                  }

                  return isJapanese
                    ? `「${source.tag.display_name}」は削除され、「${target.tag.display_name}」に統合されます。この操作は元に戻せません。`
                    : `"${source.tag.display_name}" will be removed and merged into "${target.tag.display_name}". This cannot be undone.`;
                })()}
              </p>
            )}

            {mergeError !== null && <p className="viewer-message viewer-message-error">{mergeError}</p>}

            <div className="viewer-settings-action-row">
              <button
                className="viewer-action-button"
                type="button"
                disabled={mergePending || mergeTargetTagId === null}
                onClick={() => {
                  if (mergeConfirmationRequired) {
                    void handleMerge();
                    return;
                  }

                  requestMergeConfirmation();
                }}
              >
                {mergePending
                  ? isJapanese
                    ? "統合中..."
                    : "Merging..."
                  : mergeConfirmationRequired
                    ? "統合する"
                    : "Merge"}
              </button>
              <button
                className="viewer-secondary-button"
                type="button"
                disabled={mergePending}
                onClick={closeMergeModal}
              >
                {isJapanese ? "キャンセル" : "Cancel"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
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
