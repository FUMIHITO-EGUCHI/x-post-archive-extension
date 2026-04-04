# Task Packet — 設定画面のページ分割

## Goal

設定画面を「基本設定／タグ管理／バックアップ／アプリログ」の 4 ページに分割し、
タブナビゲーションで切り替えられるようにする。

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない。

## In Scope

- `viewer-app.tsx` に `SettingsTab` 型と `settingsTab` state を追加
- 設定画面ヘッダーにタブナビゲーションを追加
- 基本設定の inline JSX を `settings-basic-panel.tsx` に抽出
- `src/types/viewer.ts` に共有型 2 種を移動（詳細後述）
- `style.css` にタブナビゲーション用スタイルを追加

## Out Of Scope

- 設定項目の追加・変更（既存機能はそのまま維持）
- URL ルーティングの導入
- モバイル対応レイアウトの変更

## Constraints

- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes。`any` 禁止
- viewer UI（React）は `src/features/viewer/` に限定
- `npm run typecheck` ✓ / `npm run build` ✓ を完了条件とする

---

## 現状の設定画面

`viewer-app.tsx` の設定画面は `screen === "settings"` の分岐内で単一スクロールページとしてレンダリングされている。

```
viewer-hero viewer-settings-hero
  ← アーカイブへ戻る

viewer-list-panel viewer-settings-panel
  viewer-list-header: "設定"
  viewer-settings-grid
    [card] 表示言語           ← inline JSX（~L1313–L1347）
    [card] 文字サイズ         ← inline JSX（~L1349–L1389）
    [card] アーカイブの復元状態 ← inline JSX（~L1391–L1460）
    [card] ストレージ使用量    ← inline JSX（~L1462–L1497）
    [card] アーカイブ概要     ← inline JSX（~L1499–L1534）
    <SettingsTagManagementPanel>
    <SettingsArchiveMaintenancePanel>
    <SettingsLogPanel>
```

---

## 実装仕様

### 1. 型の整理

#### `src/types/viewer.ts` に移動するもの

`viewer-app.tsx` で局所定義されている下記 2 型を `src/types/viewer.ts` に移動し、
`viewer-app.tsx` とパネルコンポーネントの両方からインポートできるようにする。

```typescript
// viewer-app.tsx から移動
export type FontSizeOption = "small" | "medium" | "large";

export type StorageEstimateState = {
  usage: number | null;
  quota: number | null;
  available: number | null;
  status: "idle" | "ready" | "unsupported";
};
```

`ViewerSessionRestoreMode` と `ArchiveSummaryRecord` はすでに `src/types/viewer.ts` / `src/types/archive.ts` に存在するため追加不要。

#### `viewer-app.tsx` に追加する型

```typescript
type SettingsTab = "basic" | "tags" | "backup" | "log";
```

---

### 2. `viewer-app.tsx` の変更

#### state 追加

```typescript
const [settingsTab, setSettingsTab] = useState<SettingsTab>("basic");
```

#### 設定ボタンのクリックハンドラー

既存の `setScreen("settings")` を、`settingsTab` を `"basic"` にリセットしてから遷移するよう変更：

```typescript
onClick={() => {
  setSettingsTab("basic");
  setScreen("settings");
}}
```

#### 設定画面のレンダリング変更

`viewer-list-header` に `<h2>設定</h2>` は残す。
直下にタブナビを追加し、`settingsTab` に応じてパネルを切り替える：

```tsx
<section className="viewer-list-panel viewer-settings-panel">
  <div className="viewer-list-header">
    <h2>{language === "ja" ? "設定" : "Options"}</h2>
  </div>
  <nav className="viewer-settings-tabs" aria-label={language === "ja" ? "設定ページ" : "Settings pages"}>
    {(
      [
        ["basic",  language === "ja" ? "基本設定" : "General"],
        ["tags",   language === "ja" ? "タグ管理" : "Tags"],
        ["backup", language === "ja" ? "バックアップ" : "Backup"],
        ["log",    language === "ja" ? "アプリログ" : "Log"],
      ] as const
    ).map(([tab, label]) => (
      <button
        key={tab}
        type="button"
        className={settingsTab === tab
          ? "viewer-settings-tab viewer-settings-tab-active"
          : "viewer-settings-tab"}
        aria-current={settingsTab === tab ? "page" : undefined}
        onClick={() => setSettingsTab(tab)}
      >
        {label}
      </button>
    ))}
  </nav>
  <div className="viewer-settings-grid">
    {settingsTab === "basic" && (
      <SettingsBasicPanel
        language={language}
        fontSize={fontSize}
        sessionRestoreMode={sessionRestoreMode}
        storageEstimate={storageEstimate}
        archiveSummary={archiveSummary}
        onLanguageChange={handleLanguageChange}
        onFontSizeChange={handleFontSizeChange}
        onSessionRestoreModeChange={handleSessionRestoreModeChange}
        onClearSavedSession={handleClearSavedSession}
      />
    )}
    {settingsTab === "tags" && (
      <SettingsTagManagementPanel
        language={language}
        onTagRenamed={handleTagRenamed}
        onTagMerged={handleTagMerged}
      />
    )}
    {settingsTab === "backup" && (
      <SettingsArchiveMaintenancePanel
        language={language}
        archiveSummary={{
          postCount: archiveSummary.postCount,
          mediaCount: archiveSummary.mediaCount,
          tagCount: archiveSummary.tagCount
        }}
        onArchiveChanged={refreshArchive}
      />
    )}
    {settingsTab === "log" && (
      <SettingsLogPanel language={language} />
    )}
  </div>
</section>
```

#### 削除する inline JSX

`viewer-settings-grid` 内にあった下記 5 カードの inline JSX を丸ごと削除する
（`SettingsBasicPanel` に移動するため）：

- 表示言語カード（L1313–L1347 付近）
- 文字サイズカード（L1349–L1389 付近）
- アーカイブの復元状態カード（L1391–L1460 付近）
- ストレージ使用量カード（L1462–L1497 付近）
- アーカイブ概要カード（L1499–L1534 付近）

---

### 3. 新規コンポーネント `settings-basic-panel.tsx`

**ファイルパス**: `src/features/viewer/components/settings-basic-panel.tsx`

`viewer-app.tsx` から抽出した 5 カードをそのまま移植する純粋な表示コンポーネント。
ロジックは持たず、state と callback をすべて props 経由で受け取る。

#### Props 型

```typescript
import type { ArchiveLanguage } from "../../settings/archive-language";
import type { ArchiveSummaryRecord } from "../../../types/archive";
import type { FontSizeOption, StorageEstimateState, ViewerSessionRestoreMode } from "../../../types/viewer";

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
```

#### 内容

`viewer-app.tsx` の下記ヘルパー関数を同ファイルに複製（またはモジュール化）して使用する：

- `formatBytes(bytes: number | null): string`
- `formatCount(n: number, language: ArchiveLanguage): string`
- `formatFontSizePreview(size: FontSizeOption): string`

これらは現在 `viewer-app.tsx` の末尾付近に定義されている。パネル内でのみ使うなら
`settings-basic-panel.tsx` 内に置く。`viewer-app.tsx` 側でも使っていれば
`src/features/viewer/viewer-format-helpers.ts` に切り出して両方からインポートする。

> **確認事項**: `formatBytes` / `formatCount` / `formatFontSizePreview` が `viewer-app.tsx` の
> レンダリング本体（設定画面以外）で使われているか確認し、使われていれば helper ファイルに抽出する。

---

### 4. CSS 追加（`src/entrypoints/viewer/style.css`）

既存の `viewer-settings-*` クラスはそのまま流用。タブナビゲーション用に追加：

```css
.viewer-settings-tabs {
  display: flex;
  gap: 4px;
  padding: 0 0 16px;
  border-bottom: 1px solid rgba(16, 32, 51, 0.1);
  margin-bottom: 24px;
  overflow-x: auto;
}

.viewer-settings-tab {
  flex-shrink: 0;
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  font-size: calc(0.875rem * var(--viewer-font-scale));
  color: #4b5563;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.viewer-settings-tab:hover {
  background: rgba(37, 99, 235, 0.07);
  color: #1e40af;
}

.viewer-settings-tab-active {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e40af;
  font-weight: 600;
}
```

---

## 確認すべき既存コード

| ファイル | 確認ポイント |
|---|---|
| `src/features/viewer/components/viewer-app.tsx` | 設定画面 JSX の正確な行範囲、`formatBytes` / `formatCount` / `formatFontSizePreview` の使用箇所 |
| `src/types/viewer.ts` | 既存のエクスポート型の確認（`ViewerSessionRestoreMode` など） |
| `src/entrypoints/viewer/style.css` | `.viewer-settings-*` クラスの現状、追加位置 |
| `src/features/viewer/components/settings-tag-management-panel.tsx` | props の型シグネチャ（変更なし確認） |
| `src/features/viewer/components/settings-archive-maintenance-panel.tsx` | props の型シグネチャ（変更なし確認） |
| `src/features/viewer/components/settings-log-panel.tsx` | props の型シグネチャ（変更なし確認） |

---

## Acceptance Criteria

1. 設定ボタンを押すと「基本設定」タブが選択された状態で設定画面が開く
2. 4 つのタブ（基本設定／タグ管理／バックアップ／アプリログ）が表示され、クリックで切り替わる
3. 各タブの内容は従来と同一（見た目・機能に差異なし）
4. タグ管理タブからリネーム・マージが操作できる（`SettingsTagManagementPanel` の機能が維持されている）
5. バックアップタブからエクスポート・インポートが操作できる
6. アプリログタブにログが表示される
7. `npm run typecheck` ✓
8. `npm run build` ✓
