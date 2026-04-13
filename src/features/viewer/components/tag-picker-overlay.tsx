import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { ArchiveTagRecord } from "../../../types/archive";
import type { ArchiveTagSummaryRecord } from "../../../types/viewer";
import { normalizeTagName, type ArchiveLanguage } from "../../settings/archive-language";
import { useDialogA11y } from "./use-dialog-a11y";

type TagPickerOption =
  | {
      kind: "existing";
      key: string;
      tag: ArchiveTagRecord;
      postCount: number;
      isAssigned: boolean;
    }
  | {
      kind: "create";
      key: string;
      displayName: string;
    };

export type TagPickerOverlayProps = {
  currentPostTags: ArchiveTagRecord[];
  allTagSummaries: ArchiveTagSummaryRecord[];
  onAdd: (displayName: string) => Promise<void>;
  onRemove: (normalizedName: string) => Promise<void>;
  onClose: () => void;
  language: ArchiveLanguage;
  isPending?: boolean;
};

export function TagPickerOverlay({
  currentPostTags,
  allTagSummaries,
  onAdd,
  onRemove,
  onClose,
  language,
  isPending = false
}: TagPickerOverlayProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const inputId = `${dialogId}-input`;
  const listboxId = `${dialogId}-listbox`;
  const normalizedQuery = normalizeTagName(query);
  const trimmedQuery = query.trim();
  const assignedNames = useMemo(
    () => new Set(currentPostTags.map((tag) => tag.normalized_name)),
    [currentPostTags]
  );

  const exactExistingMatch = useMemo(
    () =>
      normalizedQuery === null
        ? false
        : allTagSummaries.some(({ tag }) => tag.normalized_name === normalizedQuery),
    [allTagSummaries, normalizedQuery]
  );

  const options = useMemo(() => {
    const visibleExistingOptions = allTagSummaries
      .filter(({ tag }) => tag.system_key === null)
      .filter(({ tag }) => {
        if (trimmedQuery === "" || normalizedQuery === null) {
          return true;
        }

        const loweredQuery = trimmedQuery.toLocaleLowerCase("ja-JP");
        return (
          tag.normalized_name.includes(normalizedQuery) ||
          tag.display_name.toLocaleLowerCase("ja-JP").includes(loweredQuery)
        );
      })
      .sort((left, right) => {
        const leftAssigned = assignedNames.has(left.tag.normalized_name);
        const rightAssigned = assignedNames.has(right.tag.normalized_name);

        if (leftAssigned !== rightAssigned) {
          return leftAssigned ? -1 : 1;
        }

        if (left.postCount !== right.postCount) {
          return right.postCount - left.postCount;
        }

        return left.tag.display_name.localeCompare(right.tag.display_name, "ja-JP");
      })
      .map<TagPickerOption>(({ tag, postCount }) => ({
        kind: "existing",
        key: tag.tag_id,
        tag,
        postCount,
        isAssigned: assignedNames.has(tag.normalized_name)
      }));

    if (trimmedQuery === "" || normalizedQuery === null || exactExistingMatch) {
      return visibleExistingOptions;
    }

    return [
      ...visibleExistingOptions,
      {
        kind: "create",
        key: `create:${normalizedQuery}`,
        displayName: trimmedQuery
      }
    ] satisfies TagPickerOption[];
  }, [allTagSummaries, assignedNames, exactExistingMatch, normalizedQuery, trimmedQuery]);

  useEffect(() => {
    if (options.length === 0) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((current) => {
      if (current < 0 || current >= options.length) {
        return 0;
      }

      return current;
    });
  }, [options]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogA11y({
    isOpen: true,
    containerRef: rootRef,
    initialFocusRef: inputRef,
    onClose
  });

  async function handleSelectOption(option: TagPickerOption): Promise<void> {
    if (isPending) {
      return;
    }

    if (option.kind === "create") {
      await onAdd(option.displayName);
      return;
    }

    if (option.isAssigned) {
      await onRemove(option.tag.normalized_name);
      return;
    }

    await onAdd(option.tag.display_name);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (options.length === 0) {
        return;
      }

      setActiveIndex((current) => (current + 1) % options.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (options.length === 0) {
        return;
      }

      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (activeIndex < 0 || activeIndex >= options.length) {
        return;
      }

      const selectedOption = options[activeIndex];

      if (selectedOption === undefined) {
        return;
      }

      void handleSelectOption(selectedOption);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  const activeOption = options[activeIndex] ?? null;
  const activeOptionId =
    activeOption === null ? undefined : `${listboxId}-${sanitizeForId(activeOption.key)}`;

  return createPortal(
    <div
      className="viewer-modal-backdrop tag-picker-modal-backdrop"
      role="presentation"
      onClick={() => {
        onClose();
      }}
    >
      <section
        ref={rootRef}
        className="viewer-modal tag-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="viewer-modal-header">
          <div className="viewer-modal-copy">
            <h2 id={titleId}>{language === "ja" ? "投稿タグを編集" : "Edit post tags"}</h2>
            <p>
              {language === "ja"
                ? "候補から選ぶか、新しいタグをその場で作成できます。付与済みタグは再度選ぶと外れます。"
                : "Choose an existing tag or create a new one. Selecting an assigned tag removes it."}
            </p>
          </div>
          <button
            className="viewer-secondary-button viewer-modal-close-button"
            type="button"
            onClick={() => {
              onClose();
            }}
          >
            {language === "ja" ? "閉じる" : "Close"}
          </button>
        </div>

        <label className="viewer-visually-hidden" htmlFor={inputId}>
          {language === "ja" ? "タグを入力" : "Type a tag"}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className="tag-picker-input"
          type="text"
          value={query}
          placeholder={language === "ja" ? "タグを入力..." : "Type a tag..."}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          onKeyDown={handleInputKeyDown}
          disabled={isPending}
        />

        <div
          className="tag-picker-option-list"
          id={listboxId}
          role="listbox"
          aria-label={language === "ja" ? "タグ候補" : "Tag options"}
        >
          {options.length === 0 ? (
            <p className="tag-picker-empty">
              {language === "ja" ? "候補がありません。" : "No matching tags."}
            </p>
          ) : (
            options.map((option, index) => {
              const className =
                index === activeIndex
                  ? "tag-picker-option tag-picker-option-active"
                  : "tag-picker-option";
              const optionId = `${listboxId}-${sanitizeForId(option.key)}`;

              if (option.kind === "create") {
                return (
                  <button
                    key={option.key}
                    id={optionId}
                    className={`${className} tag-picker-option-create`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                    onClick={() => {
                      void handleSelectOption(option);
                    }}
                    disabled={isPending}
                  >
                    <span className="tag-picker-option-check">+</span>
                    <span className="tag-picker-option-copy">
                      {language === "ja"
                        ? `「${option.displayName}」を新規作成`
                        : `Create "${option.displayName}"`}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={option.key}
                  id={optionId}
                  className={
                    option.isAssigned ? `${className} tag-picker-option-selected` : className
                  }
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => {
                    setActiveIndex(index);
                  }}
                  onClick={() => {
                    void handleSelectOption(option);
                  }}
                  disabled={isPending}
                >
                  <span className="tag-picker-option-check">{option.isAssigned ? "✓" : ""}</span>
                  <span className="tag-picker-option-copy">{option.tag.display_name}</span>
                  <span className="tag-picker-option-count">
                    {formatTagCount(option.postCount, language)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

function formatTagCount(postCount: number, language: ArchiveLanguage): string {
  const count = new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(postCount);
  return language === "ja" ? `${count}件` : count;
}

function sanitizeForId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}
