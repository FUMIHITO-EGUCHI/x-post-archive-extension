import { useMemo, useRef, useState } from "react";
import type { ArchiveTagSummaryRecord, PostFilterInput } from "../../../types/viewer";
import {
  requestBulkAssignTagApplyBatch,
  requestBulkAssignTagPreview
} from "../../runtime/client";
import type { ArchiveLanguage } from "../../settings/archive-language";
import { useDialogA11y } from "./use-dialog-a11y";

type BulkTagModalProps = {
  filter: PostFilterInput;
  currentFilteredCount: number;
  allTagSummaries: ArchiveTagSummaryRecord[];
  language: ArchiveLanguage;
  onClose: () => void;
  onCompleted: () => Promise<void>;
};

type PreviewState = {
  candidatePostIds: string[];
  targetTagId: string;
  targetNormalizedName: string;
  targetDisplayName: string;
  totalMatchCount: number;
  skipCount: number;
};

type Phase = "idle" | "previewing" | "ready" | "applying" | "done";

const BATCH_SIZE = 100;

export function BulkTagModal({
  filter,
  currentFilteredCount,
  allTagSummaries,
  language,
  onClose,
  onCompleted
}: BulkTagModalProps) {
  const [tagDraft, setTagDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [taggedCount, setTaggedCount] = useState(0);
  const dialogRef = useRef<HTMLElement | null>(null);
  const initialFocusRef = useRef<HTMLInputElement | null>(null);
  const isJapanese = language === "ja";
  const normalizedDraft = normalizeTagSearch(tagDraft);
  const visibleTagSuggestions = useMemo(
    () =>
      [...allTagSummaries]
        .filter(({ tag }) => tag.system_key === null)
        .filter(({ tag }) => {
          if (normalizedDraft === "") {
            return true;
          }

          return (
            normalizeTagSearch(tag.display_name).includes(normalizedDraft) ||
            normalizeTagSearch(tag.normalized_name).includes(normalizedDraft)
          );
        })
        .sort((left, right) => {
          const countDifference = right.postCount - left.postCount;

          if (countDifference !== 0) {
            return countDifference;
          }

          return left.tag.display_name.localeCompare(right.tag.display_name, "ja-JP");
        })
        .slice(0, 12),
    [allTagSummaries, normalizedDraft]
  );
  const progressPercent =
    preview === null || preview.candidatePostIds.length === 0
      ? 0
      : Math.round((processedCount / preview.candidatePostIds.length) * 100);
  const canPreview =
    normalizeTagInput(tagDraft) !== null && phase !== "previewing" && phase !== "applying";

  useDialogA11y({
    isOpen: true,
    containerRef: dialogRef,
    initialFocusRef,
    onClose: phase === "applying" ? () => undefined : onClose
  });

  async function handlePreview() {
    const normalizedInput = normalizeTagInput(tagDraft);

    if (normalizedInput === null) {
      setNotice(isJapanese ? "タグ名を入力してください。" : "Enter a tag name.");
      return;
    }

    setPhase("previewing");
    setNotice(null);
    setPreview(null);
    setProcessedCount(0);
    setTaggedCount(0);

    try {
      const response = await requestBulkAssignTagPreview(filter, normalizedInput);
      setPreview(response);
      setTagDraft(response.targetDisplayName);
      setPhase("ready");
    } catch {
      setPhase("idle");
      setNotice(
        isJapanese ? "一括タグ付けのプレビュー取得に失敗しました。" : "Failed to load the bulk tag preview."
      );
    }
  }

  async function handleApply() {
    if (preview === null) {
      return;
    }

    setPhase("applying");
    setNotice(null);
    setProcessedCount(0);
    setTaggedCount(0);

    try {
      let nextProcessedCount = 0;
      let nextTaggedCount = 0;

      for (let index = 0; index < preview.candidatePostIds.length; index += BATCH_SIZE) {
        const batch = preview.candidatePostIds.slice(index, index + BATCH_SIZE);
        const response = await requestBulkAssignTagApplyBatch(
          batch,
          preview.targetTagId,
          preview.targetNormalizedName,
          preview.targetDisplayName
        );

        nextProcessedCount += batch.length;
        nextTaggedCount += response.tagged;
        setProcessedCount(nextProcessedCount);
        setTaggedCount(nextTaggedCount);
      }

      await onCompleted();
      setPhase("done");
      setNotice(
        isJapanese
          ? `${formatCount(nextTaggedCount, language)}件にタグを付与しました。`
          : `Tagged ${formatCount(nextTaggedCount, language)} posts.`
      );
    } catch {
      setPhase("ready");
      setNotice(
        isJapanese ? "一括タグ付けの適用に失敗しました。" : "Failed to apply bulk tagging."
      );
    }
  }

  const summaryLabel =
    preview === null
      ? isJapanese
        ? `現在の絞り込み: ${formatCount(currentFilteredCount, language)}件`
        : `Current filter: ${formatCount(currentFilteredCount, language)} posts`
      : isJapanese
        ? `${formatCount(preview.totalMatchCount, language)}件中 ${formatCount(preview.candidatePostIds.length, language)}件に付与（${formatCount(preview.skipCount, language)}件はスキップ）`
        : `${formatCount(preview.candidatePostIds.length, language)} of ${formatCount(preview.totalMatchCount, language)} posts will be tagged (${formatCount(preview.skipCount, language)} skipped)`;

  return (
    <div
      className="viewer-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (phase !== "applying") {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="viewer-modal bulk-tag-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isJapanese ? "一括タグ付け" : "Bulk tag"}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="viewer-modal-header">
          <div className="viewer-modal-copy">
            <h2>{isJapanese ? "一括タグ付け" : "Bulk tag"}</h2>
            <p>
              {isJapanese
                ? "現在の絞り込み結果に対して、まとめて手動タグを付与します。"
                : "Assign one manual tag to every post in the current filtered result."}
            </p>
          </div>
          <button
            className="viewer-secondary-button"
            type="button"
            onClick={onClose}
            disabled={phase === "applying"}
          >
            {isJapanese ? "閉じる" : "Close"}
          </button>
        </div>

        <p className="viewer-settings-inline-note">{summaryLabel}</p>

        <div className="bulk-tag-form">
          <label className="viewer-sort-label">
            <span>{isJapanese ? "付与するタグ" : "Tag to assign"}</span>
            <input
              ref={initialFocusRef}
              className="tag-input"
              type="text"
              value={tagDraft}
              placeholder={isJapanese ? "タグを入力" : "Enter a tag"}
              onChange={(event) => {
                setTagDraft(event.currentTarget.value);
                if (phase === "done") {
                  setPhase("idle");
                  setPreview(null);
                  setNotice(null);
                }
              }}
              disabled={phase === "previewing" || phase === "applying"}
            />
          </label>

          {visibleTagSuggestions.length > 0 && (
            <div className="bulk-tag-suggestion-list">
              {visibleTagSuggestions.map(({ tag, postCount }) => (
                <button
                  key={tag.tag_id}
                  className="bulk-tag-suggestion"
                  type="button"
                  onClick={() => {
                    setTagDraft(tag.display_name);
                  }}
                  disabled={phase === "previewing" || phase === "applying"}
                >
                  <strong>{tag.display_name}</strong>
                  <span>
                    {formatCount(postCount, language)} {isJapanese ? "件" : "posts"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {phase === "previewing" && (
          <p className="viewer-settings-inline-note">
            {isJapanese ? "プレビューを計算中..." : "Preparing preview..."}
          </p>
        )}

        {phase === "ready" && preview !== null && (
          <div className="viewer-progress-card">
            <div className="viewer-progress-header">
              <strong>{isJapanese ? "プレビュー" : "Preview"}</strong>
              <span>{preview.targetDisplayName}</span>
            </div>
            <p className="viewer-settings-inline-note">
              {preview.candidatePostIds.length === 0
                ? isJapanese
                  ? "対象投稿はすべてこのタグを持っています。"
                  : "Every matching post already has this tag."
                : isJapanese
                  ? "適用すると 100 件ずつ処理します。"
                  : "Apply processes the matching posts in batches of 100."}
            </p>
          </div>
        )}

        {phase === "applying" && preview !== null && (
          <div className="viewer-progress-card">
            <div className="viewer-progress-header">
              <strong>{isJapanese ? "適用中" : "Applying"}</strong>
              <span>
                {formatCount(processedCount, language)} /{" "}
                {formatCount(preview.candidatePostIds.length, language)}
              </span>
            </div>
            <div className="viewer-progress-bar" aria-hidden="true">
              <span
                className="viewer-progress-bar-fill"
                style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }}
              />
            </div>
            <p className="viewer-settings-inline-note">
              {isJapanese
                ? `${formatCount(taggedCount, language)}件に付与済み`
                : `${formatCount(taggedCount, language)} posts tagged so far`}
            </p>
          </div>
        )}

        {notice !== null && <p className="viewer-modal-inline-error">{notice}</p>}

        <div className="viewer-modal-actions">
          {(phase === "idle" || phase === "previewing") && (
            <>
              <button
                className="viewer-action-button"
                type="button"
                onClick={() => {
                  void handlePreview();
                }}
                disabled={!canPreview}
              >
                {isJapanese ? "プレビュー" : "Preview"}
              </button>
              <button
                className="viewer-secondary-button"
                type="button"
                onClick={onClose}
                disabled={phase === "previewing"}
              >
                {isJapanese ? "キャンセル" : "Cancel"}
              </button>
            </>
          )}

          {phase === "ready" && preview !== null && (
            <>
              <button
                className="viewer-action-button"
                type="button"
                onClick={() => {
                  void handleApply();
                }}
                disabled={preview.candidatePostIds.length === 0}
              >
                {isJapanese ? "適用" : "Apply"}
              </button>
              <button
                className="viewer-secondary-button"
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setPreview(null);
                  setNotice(null);
                  setProcessedCount(0);
                  setTaggedCount(0);
                }}
              >
                {isJapanese ? "やり直す" : "Reset"}
              </button>
            </>
          )}

          {phase === "done" && (
            <button className="viewer-action-button" type="button" onClick={onClose}>
              {isJapanese ? "閉じる" : "Close"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function normalizeTagInput(value: string): string | null {
  const cleaned = value.trim().replace(/^#+/u, "").replace(/\s+/gu, " ");
  return cleaned === "" ? null : cleaned;
}

function normalizeTagSearch(value: string): string {
  return value.trim().replace(/^#+/u, "").toLocaleLowerCase("ja-JP");
}

function formatCount(value: number, language: ArchiveLanguage): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}
