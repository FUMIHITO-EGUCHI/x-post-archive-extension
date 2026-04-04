import type { ArchiveLanguage } from "../../settings/archive-language";
import type {
  ArchiveSummaryRecord,
  FontSizeOption,
  StorageEstimateState,
  ViewerSessionRestoreMode
} from "../../../types/viewer";

type SettingsBasicPanelProps = {
  language: ArchiveLanguage;
  fontSize: FontSizeOption;
  sessionRestoreMode: ViewerSessionRestoreMode;
  storageEstimate: StorageEstimateState;
  archiveSummary: ArchiveSummaryRecord;
  onLanguageChange: (lang: ArchiveLanguage) => Promise<void>;
  onFontSizeChange: (size: FontSizeOption) => Promise<void>;
  onSessionRestoreModeChange: (mode: ViewerSessionRestoreMode) => Promise<void>;
  onClearSavedSession: () => Promise<void>;
};

export function SettingsBasicPanel({
  language,
  fontSize,
  sessionRestoreMode,
  storageEstimate,
  archiveSummary,
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
          <h3>{isJapanese ? "表示言語" : "Language"}</h3>
          <p>
            {isJapanese
              ? "設定画面と一覧画面の文言、保存時のデフォルトタグの言語を切り替えます。"
              : "Switch the settings and archive copy, plus the default tags assigned when posts are saved."}
          </p>
        </div>
        <div className="viewer-font-option-list" role="radiogroup" aria-label="Language">
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
              onClick={() => {
                void onLanguageChange(value);
              }}
            >
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "文字サイズ" : "Font size"}</h3>
          <p>
            {isJapanese ? "アーカイブ viewer の文字サイズを調整します。" : "Adjust text size in the archive viewer."}
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
              onClick={() => {
                void onFontSizeChange(value);
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
          <h3>{isJapanese ? "アーカイブの復元状態" : "Archive session"}</h3>
          <p>
            {isJapanese
              ? "タブを閉じたあとにフィルタや表示位置を復元するかを選びます。"
              : "Choose whether the viewer restores filters and your place after the tab closes."}
          </p>
        </div>
        <div
          className="viewer-font-option-list"
          role="radiogroup"
          aria-label={isJapanese ? "アーカイブの復元状態" : "Archive session restore"}
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
              onClick={() => {
                void onSessionRestoreModeChange(value);
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
            {isJapanese ? "保存済みセッションを消去" : "Clear saved session"}
          </button>
        </div>
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "ストレージ使用量" : "Storage usage"}</h3>
          <p>
            {isJapanese
              ? "この拡張で使っているブラウザ管理ストレージの推定値です。"
              : "Estimated browser-managed storage for this extension."}
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
              <dd>{formatBytes(storageEstimate.usage)}</dd>
            </div>
            <div className="viewer-settings-metric">
              <dt>{isJapanese ? "空き" : "Available"}</dt>
              <dd>{formatBytes(storageEstimate.available)}</dd>
            </div>
            <div className="viewer-settings-metric">
              <dt>{isJapanese ? "推定上限" : "Estimated quota"}</dt>
              <dd>{formatBytes(storageEstimate.quota)}</dd>
            </div>
            <div className="viewer-settings-metric">
              <dt>{isJapanese ? "保存済みメディア合計" : "Saved media total"}</dt>
              <dd>{formatBytes(archiveSummary.mediaBytes)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="viewer-settings-card">
        <div className="viewer-settings-card-header">
          <h3>{isJapanese ? "アーカイブ概要" : "Archive summary"}</h3>
          <p>
            {isJapanese ? "現在このアーカイブに保存されている内容の件数です。" : "Current counts for saved content in this archive."}
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

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Unknown";
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
