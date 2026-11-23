import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ArchiveLanguage } from "../../settings/archive-language";
import { Icon } from "./icons";
import type { FeedbackTone } from "./tag-management-types";
import { useEventCallback } from "./use-event-callback";
import { useIncrementalList } from "./use-incremental-list";
import { useTagMerge } from "./use-tag-merge";
import { useTagRename } from "./use-tag-rename";
import { useTagSummaries } from "./use-tag-summaries";

type SettingsTagManagementPanelProps = {
  language: ArchiveLanguage;
  onTagRenamed: (oldNormalizedName: string, newNormalizedName: string) => Promise<void>;
  onTagMerged: (sourceNormalizedName: string, targetNormalizedName: string) => Promise<void>;
};

const TAG_MANAGEMENT_LIST_SIZE = 50;

export function SettingsTagManagementPanel({
  language,
  onTagRenamed,
  onTagMerged
}: SettingsTagManagementPanelProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<FeedbackTone>("neutral");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocusTagId = useRef<string | null>(null);
  const isJapanese = language === "ja";
  const notify = useEventCallback((tone: FeedbackTone, message: string | null) => {
    setNoticeTone(tone);
    setNotice(message);
  });
  const { tags, loading, manageableTags, reload } = useTagSummaries({ isJapanese, notify });
  const merge = useTagMerge({ manageableTags, isJapanese, notify, reload, onTagMerged });
  const rename = useTagRename({
    isJapanese,
    notify,
    reload,
    onTagRenamed,
    isBlocked: merge.pending,
    onStart: merge.disarm
  });
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
    const indexes = merge.selectedTagIds.map((id) =>
      visibleTags.findIndex(({ tag }) => tag.tag_id === id));
    indexes.push(visibleTags.findIndex(({ tag }) => tag.tag_id === rename.editingTagId));
    // Keep the keyboard-focused row rendered; otherwise deselecting a row past the
    // first page shrinks the list and drops focus.
    indexes.push(visibleTags.findIndex(({ tag }) => tag.tag_id === activeTagId));
    return Math.max(-1, ...indexes) + 1;
  }, [activeTagId, rename.editingTagId, merge.selectedTagIds, visibleTags]);
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
  // Roving tabindex: one row is the list's only tab stop; arrow keys move it.
  const effectiveActiveId = displayedTags.some(({ tag }) => tag.tag_id === activeTagId)
    ? activeTagId
    : displayedTags[0]?.tag.tag_id ?? null;

  useEffect(() => {
    const id = pendingFocusTagId.current;
    if (id === null || loading || rename.editingTagId !== null) {
      return;
    }
    const row = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-tag-id]") ?? [])]
      .find((element) => element.dataset.tagId === id);
    if (row) {
      pendingFocusTagId.current = null;
      row.focus();
    }
  });

  function focusTag(id: string): void {
    pendingFocusTagId.current = id;
    setActiveTagId(id);
  }

  const conflictingTag = tags.find(({ tag }) => tag.tag_id === rename.conflictingTagId) ?? null;
  const manageableConflict =
    manageableTags.find(({ tag }) => tag.tag_id === rename.conflictingTagId) ?? null;

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
        {[merge.source, merge.target].map((summary, index) => (
          <Fragment key={index}>
            {index === 1 && (
              <div className="viewer-tag-management-direction">
                <Icon name="ArrowRight" />
                <button
                  className="viewer-tag-management-swap"
                  type="button"
                  title={isJapanese ? "入れ替え" : "Swap"}
                  aria-label={isJapanese ? "旧タグと統合先を入れ替え" : "Swap source and target"}
                  disabled={merge.selectedTagIds.length !== 2 || merge.pending}
                  onClick={() => {
                    merge.swap();
                  }}
                >
                  <Icon name="Swap" />
                </button>
              </div>
            )}
            <section
              className={
                "viewer-tag-management-selection-slot" +
                `${summary ? " viewer-tag-management-slot-filled" : ""}` +
                `${index === 0 && merge.armed ? " viewer-tag-management-slot-doomed" : ""}`
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
      <div
        className={
          "viewer-settings-action-row viewer-settings-action-row-end viewer-tag-management-actions"
        }
      >
        <label className="viewer-tag-management-auto">
          <input
            type="checkbox"
            checked={merge.preserve}
            disabled={merge.pending}
            onChange={(event) => merge.setPreserve(event.currentTarget.checked)}
          />
          {isJapanese ? "自動変換" : "Auto-redirect"}
        </label>
        <button
          className={merge.armed ? "viewer-danger-button" : "viewer-action-button"}
          type="button"
          disabled={
            merge.source === null || merge.target === null || merge.pending ||
            rename.pendingTagIds.size > 0
          }
          onClick={() => {
            void merge.run();
          }}
        >
          {merge.pending
            ? (isJapanese ? "統合中..." : "Merging...")
            : merge.armed
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
            ref={listRef}
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
            {displayedTags.map((summary, index) => {
              const isEditing = rename.editingTagId === summary.tag.tag_id;
              const isRenamePending = rename.pendingTagIds.has(summary.tag.tag_id);
              const isSelected = merge.selectedTagIds.includes(summary.tag.tag_id);
              const locked = merge.selectedTagIds.length >= 2 && !isSelected;
              const otherName = conflictingTag?.tag.display_name ?? rename.draft.trim();
              return (
                <div
                  key={summary.tag.tag_id}
                  className={
                    "viewer-tag-management-row" +
                    `${isSelected ? " viewer-tag-management-row-selected" : ""}` +
                    `${locked ? " viewer-tag-management-row-selection-locked" : ""}`
                  }
                  role="row"
                  data-tag-id={summary.tag.tag_id}
                  tabIndex={effectiveActiveId === summary.tag.tag_id ? 0 : -1}
                  aria-selected={isSelected}
                  aria-disabled={locked || undefined}
                  aria-keyshortcuts="F2"
                  onClick={() => {
                    pendingFocusTagId.current = null;
                    setActiveTagId(summary.tag.tag_id);
                    if (!isEditing && !locked) {
                      merge.toggle(summary.tag.tag_id);
                    }
                  }}
                  onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                    if (event.target !== event.currentTarget || isEditing) {
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (!locked) {
                        merge.toggle(summary.tag.tag_id);
                      }
                      return;
                    }
                    if (event.key === "F2") {
                      event.preventDefault();
                      setActiveTagId(summary.tag.tag_id);
                      rename.start(summary.tag.tag_id, summary.tag.display_name);
                      return;
                    }
                    let nextIndex = index;
                    if (event.key === "ArrowDown") {
                      nextIndex = Math.min(index + 1, visibleTags.length - 1);
                      if (index === displayedTags.length - 1 && hasMoreTags) {
                        loadMoreTags();
                      }
                    } else if (event.key === "ArrowUp") {
                      nextIndex = Math.max(index - 1, 0);
                    } else if (event.key === "Home") {
                      nextIndex = 0;
                    } else if (event.key === "End") {
                      nextIndex = displayedTags.length - 1;
                    } else {
                      return;
                    }
                    event.preventDefault();
                    const nextTag = visibleTags[nextIndex];
                    if (nextTag && nextIndex !== index) {
                      focusTag(nextTag.tag.tag_id);
                    }
                  }}
                >
                  <div className="viewer-tag-management-cell" role="gridcell" aria-hidden="true">
                    <span
                      className={
                        `tag-picker-option-check${isSelected ? " tag-picker-check-selected" : ""}`
                      }
                    >
                      {isSelected && <Icon name="Check" />}
                    </span>
                  </div>
                  <div className="viewer-tag-management-cell" role="gridcell">
                    {isEditing ? (
                      <div
                        className={
                          "viewer-tag-management-edit" +
                          `${rename.conflictingTagId !== null || rename.error !== null
                            ? " viewer-tag-management-edit-error" : ""}`
                        }
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <input
                          ref={rename.inputRef}
                          type="text"
                          value={rename.draft}
                          disabled={isRenamePending}
                          aria-label={isJapanese ? "新しいタグ名" : "New tag name"}
                          aria-invalid={rename.conflictingTagId !== null || rename.error !== null}
                          onChange={(event) => {
                            rename.setDraft(event.currentTarget.value);
                          }}
                          onBlur={() => {
                            if (
                              rename.conflictingTagId === null && rename.error === null &&
                              !isRenamePending
                            ) {
                              void rename.save(summary);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              focusTag(summary.tag.tag_id);
                              void rename.save(summary).then((closed) => {
                                if (!closed && pendingFocusTagId.current === summary.tag.tag_id) {
                                  pendingFocusTagId.current = null;
                                }
                              });
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              focusTag(summary.tag.tag_id);
                              rename.cancel();
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
                            void rename.save(summary);
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
                          onClick={rename.cancel}
                        >
                          <Icon name="Close" />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="viewer-tag-management-name"
                        type="button"
                        tabIndex={-1}
                        title={isJapanese ? "名前を変更" : "Rename"}
                        aria-label={isJapanese
                          ? `${summary.tag.display_name} の名前を変更`
                          : `Rename ${summary.tag.display_name}`}
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          pendingFocusTagId.current = null;
                          setActiveTagId(summary.tag.tag_id);
                          rename.start(summary.tag.tag_id, summary.tag.display_name);
                        }}
                      >
                        <span>{summary.tag.display_name}</span>
                        <span className="viewer-tag-management-name-pen">
                          <Icon name="Pencil" />
                        </span>
                      </button>
                    )}
                  </div>
                  <div
                    className="viewer-tag-management-cell viewer-tag-management-count"
                    role="gridcell"
                  >
                    {formatCount(summary.postCount, language)}
                  </div>
                  {isEditing && (rename.conflictingTagId !== null || rename.error !== null) && (
                    <div
                      className="viewer-tag-management-error"
                      role="alert"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {rename.conflictingTagId !== null
                        ? (isJapanese ? `「${otherName}」は既にある` : `"${otherName}" already exists`)
                        : rename.error}
                      {manageableConflict !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            merge.select([summary.tag.tag_id, manageableConflict.tag.tag_id]);
                            merge.disarm();
                            rename.cancel();
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
