import { useEffect, useMemo, useState } from "react";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { requestMergeTags, requestRenameTag, requestTagSummaries } from "../../runtime/client";
import type { ArchiveLanguage } from "../../settings/archive-language";

type SettingsTagManagementPanelProps = {
  language: ArchiveLanguage;
  onTagRenamed: (oldNormalizedName: string, newNormalizedName: string) => Promise<void>;
  onTagMerged: (sourceNormalizedName: string, targetNormalizedName: string) => Promise<void>;
};

type FeedbackTone = "neutral" | "success" | "error";

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
  const [mergePending, setMergePending] = useState(false);
  const isJapanese = language === "ja";

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

  const selectedTags = selectedTagIds
    .map((tagId) => manageableTags.find(({ tag }) => tag.tag_id === tagId) ?? null)
    .filter((tag): tag is ArchiveTagSummaryRecord => tag !== null);
  const leftSelectedTag = selectedTags[0] ?? null;
  const rightSelectedTag = selectedTags[1] ?? null;

  useEffect(() => {
    void loadTags();
  }, []);

  async function loadTags(): Promise<void> {
    setLoading(true);

    try {
      const response = await requestTagSummaries();
      setTags(response.tags);
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
            ? `「${attemptedName}」は既に存在します。マージする場合は操作 B を使用してください。`
            : `"${attemptedName}" already exists. Use merge if you want to combine them.`
        );
        return;
      }

      await loadTags();
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

    setMergeTargetTagId(selectedTags[0]?.tag.tag_id ?? null);
    setMergeError(null);
    setIsMergeModalOpen(true);
    setNotice(null);
  }

  function closeMergeModal(): void {
    setIsMergeModalOpen(false);
    setMergeTargetTagId(null);
    setMergeError(null);
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
      await requestMergeTags(source.tag.tag_id, target.tag.tag_id);
      await loadTags();
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
        getErrorMessage(error, isJapanese ? "マージに失敗しました。" : "Merge failed.")
      );
    } finally {
      setMergePending(false);
    }
  }

  return (
    <>
      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "タグ管理" : "Tag management"}</h3>
          <p>
            {isJapanese
              ? "ユーザータグの名前変更と統合を settings 画面から行います。ビルトインタグはここでは操作できません。"
              : "Rename or merge user-visible tags from the settings screen. Built-in tags are excluded here."}
          </p>
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
          <section className="viewer-tag-management-selection-slot" aria-label={isJapanese ? "左の選択タグ" : "Selected left tag"}>
            <span className="viewer-tag-management-selection-label">
              {isJapanese ? "左の選択" : "Selected left"}
            </span>
            {leftSelectedTag === null ? (
              <p className="viewer-tag-management-selection-empty">
                {isJapanese ? "最初のタグを選択してください。" : "Select the first tag."}
              </p>
            ) : (
              <div className="viewer-tag-management-selection-card">
                <strong>{leftSelectedTag.tag.display_name}</strong>
                <span>
                  {formatCount(leftSelectedTag.postCount, language)} {isJapanese ? "件の投稿" : "posts"}
                </span>
              </div>
            )}
          </section>

          <section className="viewer-tag-management-selection-slot" aria-label={isJapanese ? "右の選択タグ" : "Selected right tag"}>
            <span className="viewer-tag-management-selection-label">
              {isJapanese ? "右の選択" : "Selected right"}
            </span>
            {rightSelectedTag === null ? (
              <p className="viewer-tag-management-selection-empty">
                {isJapanese ? "2つ目のタグを選択してください。" : "Select the second tag."}
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

        <div className="viewer-settings-action-row">
          <button
            className="viewer-action-button"
            type="button"
            disabled={selectedTagIds.length !== 2}
            onClick={openMergeModal}
          >
            {isJapanese ? "マージ" : "Merge"}
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
          <div className="viewer-tag-management-list" role="table" aria-label={isJapanese ? "タグ管理一覧" : "Tag management list"}>
            <div className="viewer-tag-management-row viewer-tag-management-row-header" role="row">
              <span role="columnheader">{isJapanese ? "タグ名" : "Tag"}</span>
              <span role="columnheader">{isJapanese ? "投稿数" : "Posts"}</span>
              <span role="columnheader">{isJapanese ? "リネーム" : "Rename"}</span>
              <span role="columnheader">{isJapanese ? "マージ" : "Merge"}</span>
            </div>

            {visibleTags.map((summary) => {
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
                  aria-selected={isSelected}
                  tabIndex={isEditing ? -1 : 0}
                  onClick={() => {
                    if (isEditing || disableUncheckedSelection) {
                      return;
                    }

                    toggleSelectedTag(summary.tag.tag_id);
                  }}
                  onKeyDown={(event) => {
                    if (isEditing || disableUncheckedSelection) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleSelectedTag(summary.tag.tag_id);
                    }
                  }}
                >
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
                  <div className="viewer-tag-management-cell" role="cell">
                    <label className="viewer-tag-management-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedTagIds.includes(summary.tag.tag_id)}
                        disabled={disableUncheckedSelection || isEditing}
                        onChange={() => {
                          toggleSelectedTag(summary.tag.tag_id);
                        }}
                      />
                      <span>{isJapanese ? "選択" : "Select"}</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isMergeModalOpen && (
        <div
          className="viewer-modal-backdrop"
          role="presentation"
          onClick={closeMergeModal}
        >
          <section
            className="viewer-modal viewer-tag-management-modal"
            role="dialog"
            aria-modal="true"
            aria-label={isJapanese ? "タグのマージ" : "Merge tags"}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="viewer-modal-header">
              <div className="viewer-modal-copy">
                <h2>{isJapanese ? "タグを統合" : "Merge tags"}</h2>
                <p>
                  {isJapanese
                    ? "どちらの名前を残すか選んで、2つのタグを1つにまとめます。"
                    : "Choose which name to keep, then combine the two tags into one."}
                </p>
              </div>
              <button
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
              <p className="viewer-settings-inline-note">
                {(() => {
                  const target = selectedTags.find(({ tag }) => tag.tag_id === mergeTargetTagId) ?? null;
                  const source = selectedTags.find(({ tag }) => tag.tag_id !== mergeTargetTagId) ?? null;

                  if (target === null || source === null) {
                    return isJapanese
                      ? "統合対象を確認できません。"
                      : "Selected merge targets are unavailable.";
                  }

                  return isJapanese
                    ? `「${source.tag.display_name}」を削除し、「${target.tag.display_name}」へ統合します。`
                    : `Merge "${source.tag.display_name}" into "${target.tag.display_name}".`;
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
                  void handleMerge();
                }}
              >
                {mergePending
                  ? isJapanese
                    ? "統合中..."
                    : "Merging..."
                  : isJapanese
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
