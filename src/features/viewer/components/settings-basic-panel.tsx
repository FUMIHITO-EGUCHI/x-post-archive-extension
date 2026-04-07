import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ArchiveLanguage } from "../../settings/archive-language";
import {
  DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
  MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
  MIN_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
  type ArchiveSettings
} from "../../../types/archive";
import type {
  ArchiveSummaryRecord,
  FontSizeOption,
  StorageEstimateState,
  ViewerSessionRestoreMode,
  ViewerTheme
} from "../../../types/viewer";

type SettingsBasicPanelProps = {
  language: ArchiveLanguage;
  archiveSettings: ArchiveSettings;
  currentTheme: ViewerTheme;
  fontSize: FontSizeOption;
  sessionRestoreMode: ViewerSessionRestoreMode;
  storageEstimate: StorageEstimateState;
  archiveSummary: ArchiveSummaryRecord;
  onArchiveSettingsChange: (settings: ArchiveSettings) => Promise<void>;
  onThemeChange: (theme: ViewerTheme) => Promise<void>;
  onLanguageChange: (lang: ArchiveLanguage) => Promise<void>;
  onFontSizeChange: (size: FontSizeOption) => Promise<void>;
  onSessionRestoreModeChange: (mode: ViewerSessionRestoreMode) => Promise<void>;
  onClearSavedSession: () => Promise<void>;
};

export function SettingsBasicPanel({
  language,
  archiveSettings,
  currentTheme,
  fontSize,
  sessionRestoreMode,
  storageEstimate,
  archiveSummary,
  onArchiveSettingsChange,
  onThemeChange,
  onLanguageChange,
  onFontSizeChange,
  onSessionRestoreModeChange,
  onClearSavedSession
}: SettingsBasicPanelProps) {
  const isJapanese = language === "ja";

  return (
    <>
      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "テーマ" : "Theme"}</h3>
          <p>
            {isJapanese
              ? "アーカイブ画面の見た目をライトとダークで切り替えます。"
              : "Choose whether the archive viewer uses a light or dark theme."}
          </p>
        </div>
        <div className="viewer-font-option-list" role="radiogroup" aria-label={isJapanese ? "テーマ" : "Theme"}>
          {(
            [
              ["light", isJapanese ? "ライト" : "Light"],
              ["dark", isJapanese ? "ダーク" : "Dark"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={
                currentTheme === value
                  ? "viewer-font-option viewer-font-option-active"
                  : "viewer-font-option"
              }
              type="button"
              role="radio"
              aria-checked={currentTheme === value}
              tabIndex={currentTheme === value ? 0 : -1}
              onClick={() => {
                void onThemeChange(value);
              }}
              onKeyDown={(event) => {
                handleOptionGroupKeyDown(event, ["light", "dark"], currentTheme, onThemeChange);
              }}
            >
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "表示言語" : "Language"}</h3>
          <p>
            {isJapanese
              ? "設定画面やアーカイブ内の表示文言を切り替えます。新しく保存する投稿の初期タグ名もこの言語に合わせます。"
              : "Change the language used in settings and archive text, including the default tags added to newly saved posts."}
          </p>
        </div>
        <div
          className="viewer-font-option-list"
          role="radiogroup"
          aria-label={isJapanese ? "表示言語" : "Language"}
        >
          {(
            [
              ["ja", "日本語"],
              ["en", "English"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={language === value ? "viewer-font-option viewer-font-option-active" : "viewer-font-option"}
              type="button"
              role="radio"
              aria-checked={language === value}
              tabIndex={language === value ? 0 : -1}
              onClick={() => {
                void onLanguageChange(value);
              }}
              onKeyDown={(event) => {
                handleOptionGroupKeyDown(event, ["ja", "en"], language, onLanguageChange);
              }}
            >
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "自動保存" : "Automatic saving"}</h3>
          <p>
            {isJapanese
              ? "X でいいねやブックマークを付けた投稿を、自動でアーカイブに追加します。"
              : "Add posts to your archive automatically when you like or bookmark them on X."}
          </p>
        </div>
        <div className="viewer-settings-toggle-list">
          {[
            {
              key: "autoArchiveOnLike" as const,
              checked: archiveSettings.autoArchiveOnLike,
              title: isJapanese ? "いいねした投稿を保存" : "Save liked posts"
            },
            {
              key: "autoArchiveOnBookmark" as const,
              checked: archiveSettings.autoArchiveOnBookmark,
              title: isJapanese ? "ブックマークした投稿を保存" : "Save bookmarked posts"
            }
          ].map(({ key, checked, title }) => (
            <label key={key} className="viewer-settings-toggle-item">
              <input
                type="checkbox"
                checked={checked}
                aria-label={title}
                onChange={(event) => {
                  void onArchiveSettingsChange({
                    ...archiveSettings,
                    [key]: event.currentTarget.checked
                  });
                }}
              />
              <span className="viewer-settings-toggle-copy">
                <strong>{title}</strong>
              </span>
            </label>
          ))}
        </div>
        <label className="viewer-file-input-label">
          <span>
            {isJapanese
              ? "一括取り込みの duplicate-only batch 自動停止閾値"
              : "Bulk import duplicate-only batch stop threshold"}
          </span>
          <input
            className="tag-input"
            type="number"
            min={MIN_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD}
            max={MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD}
            step={1}
            value={archiveSettings.bulkImportDuplicateBatchThreshold}
            onChange={(event) => {
              const parsedValue = event.currentTarget.valueAsNumber;
              const nextThreshold =
                Number.isFinite(parsedValue)
                  ? Math.min(
                      MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
                      Math.max(
                        MIN_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
                        Math.trunc(parsedValue)
                      )
                    )
                  : DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD;

              void onArchiveSettingsChange({
                ...archiveSettings,
                bulkImportDuplicateBatchThreshold: nextThreshold
              });
            }}
          />
          <span className="viewer-settings-inline-note">
            {isJapanese
              ? "likes / bookmarks の一括取り込みで、duplicate だけの保存バッチが連続した回数です。新規保存か失敗が入ると連続数はリセットされます。"
              : "Shared by likes and bookmarks bulk import. This counts consecutive duplicate-only save batches and resets when a batch includes a new save or a failure."}
          </span>
        </label>
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "文字サイズ" : "Font size"}</h3>
          <p>
            {isJapanese
              ? "アーカイブ内の文字を読みやすい大きさに調整します。"
              : "Make text in the archive viewer smaller or larger."}
          </p>
        </div>
        <div
          className="viewer-font-option-list"
          role="radiogroup"
          aria-label={isJapanese ? "文字サイズ" : "Font size"}
        >
          {(
            [
              ["small", isJapanese ? "小" : "Small"],
              ["medium", isJapanese ? "中" : "Medium"],
              ["large", isJapanese ? "大" : "Large"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={fontSize === value ? "viewer-font-option viewer-font-option-active" : "viewer-font-option"}
              type="button"
              role="radio"
              aria-checked={fontSize === value}
              tabIndex={fontSize === value ? 0 : -1}
              onClick={() => {
                void onFontSizeChange(value);
              }}
              onKeyDown={(event) => {
                handleOptionGroupKeyDown(
                  event,
                  ["small", "medium", "large"],
                  fontSize,
                  onFontSizeChange
                );
              }}
            >
              <span>{label}</span>
              <strong>{formatFontSizePreview(value)}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "前回の表示を復元" : "Reopen where you left off"}</h3>
          <p>
            {isJapanese
              ? "アーカイブを開き直したときに、前回の並び順や絞り込み、スクロール位置をどこまで戻すか選べます。"
              : "Choose how much of your previous view to restore when you reopen the archive."}
          </p>
        </div>
        <div
          className="viewer-font-option-list"
          role="radiogroup"
          aria-label={isJapanese ? "前回の表示を復元" : "Restore previous view"}
        >
          {(
            [
              [
                "off",
                isJapanese ? "オフ" : "Off",
                isJapanese ? "毎回まっさらな状態で一覧を開きます。" : "Always open the archive from a fresh state."
              ],
              [
                "filters",
                isJapanese ? "フィルタのみ" : "Filters only",
                isJapanese ? "並び順とタグフィルタを復元します。" : "Restore sort and tag filter choices."
              ],
              [
                "filters-and-position",
                isJapanese ? "フィルタ + 位置" : "Filters + position",
                isJapanese
                  ? "並び順、タグフィルタ、読み込み済み件数、スクロール位置を復元します。"
                  : "Restore sort, tag filter, loaded items, and scroll position."
              ]
            ] as const
          ).map(([value, label, description]) => (
            <button
              key={value}
              className={
                sessionRestoreMode === value ? "viewer-font-option viewer-font-option-active" : "viewer-font-option"
              }
              type="button"
              role="radio"
              aria-checked={sessionRestoreMode === value}
              tabIndex={sessionRestoreMode === value ? 0 : -1}
              onClick={() => {
                void onSessionRestoreModeChange(value);
              }}
              onKeyDown={(event) => {
                handleOptionGroupKeyDown(
                  event,
                  ["off", "filters", "filters-and-position"],
                  sessionRestoreMode,
                  onSessionRestoreModeChange
                );
              }}
            >
              <strong>{label}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
        <div className="viewer-settings-action-row">
          <button
            className="viewer-secondary-button"
            type="button"
            onClick={() => {
              void onClearSavedSession();
            }}
          >
            {isJapanese ? "保存した復元情報を消去" : "Clear saved restore data"}
          </button>
        </div>
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "ストレージ使用量" : "Storage usage"}</h3>
          <p>
            {isJapanese
              ? "この拡張機能がブラウザ内で使っている保存容量の目安です。"
              : "See roughly how much browser storage this extension is using."}
          </p>
        </div>
        {storageEstimate.status === "unsupported" ? (
          <p className="viewer-message">
            {isJapanese
              ? "この環境ではストレージ推定値を取得できません。"
              : "Storage estimate is not available in this environment."}
          </p>
        ) : (
          <dl className="viewer-settings-metric-list">
            <div className="viewer-settings-metric">
              <dt>{isJapanese ? "使用中" : "Used"}</dt>
              <dd>{formatBytes(storageEstimate.usage, language)}</dd>
            </div>
            <div className="viewer-settings-metric">
              <dt>{isJapanese ? "空き" : "Available"}</dt>
              <dd>{formatBytes(storageEstimate.available, language)}</dd>
            </div>
            <div className="viewer-settings-metric">
              <dt>{isJapanese ? "推定上限" : "Estimated quota"}</dt>
              <dd>{formatBytes(storageEstimate.quota, language)}</dd>
            </div>
            <div className="viewer-settings-metric">
              <dt>{isJapanese ? "保存済みメディア総量" : "Saved media total"}</dt>
              <dd>{formatBytes(archiveSummary.mediaBytes, language)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "アーカイブ概要" : "Archive summary"}</h3>
          <p>
            {isJapanese
              ? "このアーカイブに今どれだけ投稿やメディアが保存されているかを確認できます。"
              : "See how many posts, media items, and accounts are currently saved in this archive."}
          </p>
        </div>
        <dl className="viewer-settings-metric-list">
          <div className="viewer-settings-metric">
            <dt>{isJapanese ? "投稿" : "Posts"}</dt>
            <dd>{formatCount(archiveSummary.postCount, language)}</dd>
          </div>
          <div className="viewer-settings-metric">
            <dt>{isJapanese ? "メディア" : "Media"}</dt>
            <dd>{formatCount(archiveSummary.mediaCount, language)}</dd>
          </div>
          <div className="viewer-settings-metric">
            <dt>{isJapanese ? "画像" : "Images"}</dt>
            <dd>{formatCount(archiveSummary.imageCount, language)}</dd>
          </div>
          <div className="viewer-settings-metric">
            <dt>{isJapanese ? "動画" : "Videos"}</dt>
            <dd>{formatCount(archiveSummary.videoCount, language)}</dd>
          </div>
          <div className="viewer-settings-metric">
            <dt>{isJapanese ? "アカウント" : "Accounts"}</dt>
            <dd>{formatCount(archiveSummary.accountCount, language)}</dd>
          </div>
          <div className="viewer-settings-metric">
            <dt>{isJapanese ? "タグ" : "Tags"}</dt>
            <dd>{formatCount(archiveSummary.tagCount, language)}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

function formatFontSizePreview(value: FontSizeOption): string {
  switch (value) {
    case "small":
      return "90%";
    case "medium":
      return "100%";
    case "large":
      return "112%";
  }
}

function formatBytes(value: number | null, language: ArchiveLanguage): string {
  if (value === null || !Number.isFinite(value)) {
    return language === "ja" ? "不明" : "Unknown";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let currentValue = value;
  let unitIndex = 0;

  while (currentValue >= 1024 && unitIndex < units.length - 1) {
    currentValue /= 1024;
    unitIndex += 1;
  }

  const digits = currentValue >= 100 || unitIndex === 0 ? 0 : 1;
  return `${currentValue.toFixed(digits)} ${units[unitIndex]}`;
}

function formatCount(value: number, language: ArchiveLanguage): string {
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "en-US").format(value);
}

function handleOptionGroupKeyDown<T extends string>(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  values: readonly T[],
  currentValue: T,
  onSelect: (value: T) => Promise<void>
) {
  if (
    event.key !== "ArrowRight" &&
    event.key !== "ArrowLeft" &&
    event.key !== "ArrowDown" &&
    event.key !== "ArrowUp" &&
    event.key !== "Home" &&
    event.key !== "End"
  ) {
    return;
  }

  event.preventDefault();

  if (event.key === "Home") {
    void onSelect(values[0] ?? currentValue);
    return;
  }

  if (event.key === "End") {
    void onSelect(values[values.length - 1] ?? currentValue);
    return;
  }

  const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const currentIndex = values.indexOf(currentValue);
  const nextIndex = (currentIndex + direction + values.length) % values.length;

  void onSelect(values[nextIndex] ?? currentValue);
}
