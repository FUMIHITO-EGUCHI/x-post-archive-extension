import { detectDefaultArchiveLanguage, isArchiveLanguage, loadArchiveLanguage, type ArchiveLanguage } from "../settings/archive-language";

const strings = {
  ja: {
    save: {
      idle: "アーカイブに保存",
      saving: "保存中",
      saved: "保存済み",
      error: "保存に失敗。押すと再試行",
    },
    thread: {
      idle: (count: number) => `連投を保存（${count}件）`,
      saving: () => "連投を保存中",
      saved: () => "連投を保存済み",
      error: () => "連投保存を再試行",
      disabled: () => "連投ではありません",
    },
    status: {
      idle: "待機中",
      collecting: "収集中",
      saving: "保存中",
      stopping: "停止中",
      stopped: "停止済み",
      completed: "完了",
      failed: "失敗",
    },
    metric: {
      collected: "収集",
      saved: "保存",
      duplicates: "重複",
      failed: "失敗",
      scanned: "走査",
      waiting: "待機",
    },
    start: "開始",
    stop: "停止",
    hide: "取り込みを隠す",
    import: (name: string) => `${name}を取り込む`,
    likes: "いいね",
    bookmarks: "ブックマーク",
    open: (name: string) => `${name}欄を開いてください`,
    manual: "ユーザーが停止しました",
    left: "ページを離れたため停止しました",
    duplicate: "重複が続いたため停止しました",
    failure: "取り込みに失敗しました",
    streak: "連続した重複のみのバッチ / 停止回数",
    progress: "処理済み / 収集数"
  },
  en: {
    save: {
      idle: "Save to archive",
      saving: "Saving",
      saved: "Saved",
      error: "Save failed. Press to retry",
    },
    thread: {
      idle: (count: number) => `Save thread (${count})`,
      saving: () => "Saving thread",
      saved: () => "Thread saved",
      error: () => "Retry saving thread",
      disabled: () => "Not a thread",
    },
    status: {
      idle: "Idle",
      collecting: "Collecting",
      saving: "Saving",
      stopping: "Stopping",
      stopped: "Stopped",
      completed: "Completed",
      failed: "Failed",
    },
    metric: {
      collected: "Collected",
      saved: "Saved",
      duplicates: "Duplicates",
      failed: "Failed",
      scanned: "Scanned",
      waiting: "Waiting",
    },
    start: "Start",
    stop: "Stop",
    hide: "Hide import",
    import: (name: string) => `Import ${name}`,
    likes: "Likes",
    bookmarks: "Bookmarks",
    open: (name: string) => `Open ${name} first`,
    manual: "Stopped by user",
    left: "Stopped after leaving the page",
    duplicate: "Stopped after consecutive duplicates",
    failure: "Import failed",
    streak: "Consecutive duplicate-only batches / stop threshold",
    progress: "Processed / collected"
  }
} as const;

let language: ArchiveLanguage = detectDefaultArchiveLanguage();
const listeners = new Set<() => void>();
export function xUiStrings() {
  return strings[language];
}
export function onXUiLanguageChange(listener: () => void) {
  listeners.add(listener);
}

function updateLanguage(next: ArchiveLanguage) {
  language = next;
  for (const listener of listeners) {
    listener();
  }
}

if (typeof browser !== "undefined" && browser.storage?.onChanged) {
  let changed = false;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes["archive.language"]) {
      changed = true;
      const value = changes["archive.language"].newValue;
      updateLanguage(isArchiveLanguage(value) ? value : detectDefaultArchiveLanguage());
    }
  });
  void loadArchiveLanguage()
    .then((value) => {
      if (!changed) updateLanguage(value);
    })
    .catch(() => {});
}
