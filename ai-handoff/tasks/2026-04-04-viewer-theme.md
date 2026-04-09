# Task Packet — ビューアテーマ切り替え（ライト / ダーク）

## Goal

ビューア画面のテーマを「ライト（現状: 白＋青アクセント）」と「ダーク（黒＋赤アクセント）」で切り替えられる設定を追加する。

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない。

## In Scope

- `src/types/viewer.ts` に `ViewerTheme = "light" | "dark"` を追加
- `src/features/settings/viewer-theme.ts` を新規作成（テーマの読み書き）
- ビューアのグローバル CSS に CSS 変数定義を追加（ライト・ダーク両テーマ）
- 既存スタイルのハードコードされた色値を CSS 変数に移行
- `viewer-app.tsx` でテーマ読み込みと `data-theme` 属性の適用
- `settings-basic-panel.tsx` にテーマ切り替えUIを追加

## Out Of Scope

- システムの OS テーマ（`prefers-color-scheme`）との自動連動
- テーマのカスタマイズ（色の個別設定）
- ライト・ダーク以外のテーマ追加

## Constraints

- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes。`any` 禁止
- viewer UI（React）は `src/features/viewer/` に限定
- CSS 変数による実装（インラインスタイルでの色指定は禁止）
- `npm run typecheck` ✓ / `npm run build` ✓ を完了条件とする

---

## 実装仕様

### 1. 型の追加（`src/types/viewer.ts`）

```typescript
export type ViewerTheme = "light" | "dark";
```

---

### 2. テーマの読み書き（`viewer-theme.ts`）

```typescript
// src/features/settings/viewer-theme.ts
export async function loadViewerTheme(): Promise<ViewerTheme>
export async function persistViewerTheme(theme: ViewerTheme): Promise<void>
```

`chrome.storage.local` に `{ viewerTheme: ViewerTheme }` として保存。
読み込み時に値が存在しない場合は `"light"` を返す。

`archive-language.ts` の `loadArchiveLanguage()` / `persistArchiveLanguage()` と同一パターンで実装。

---

### 3. CSS 変数定義

ビューアのグローバル CSS（`style.css` またはビューア用のエントリ CSS）に追加:

```css
:root[data-theme="light"] {
  --color-bg:        #ffffff;
  --color-bg-subtle: #f7f9fa;
  --color-bg-hover:  #f0f3f4;
  --color-text:      #0f1419;
  --color-text-sub:  #536471;
  --color-accent:    #1d9bf0;
  --color-accent-hover: #1a8cd8;
  --color-border:    #e1e8ed;
  --color-danger:    #f4212e;
}

:root[data-theme="dark"] {
  --color-bg:        #000000;
  --color-bg-subtle: #16181c;
  --color-bg-hover:  #1d1f23;
  --color-text:      #e7e9ea;
  --color-text-sub:  #71767b;
  --color-accent:    #f4212e;
  --color-accent-hover: #d9112a;
  --color-border:    #2f3336;
  --color-danger:    #f4212e;
}
```

既存 CSS でハードコードされている色値（`#fff`、`#1d9bf0`、`#e1e8ed` 等）を CSS 変数に置き換える。
全ての色を一度に置き換える必要はない。アクセント色・背景色・テキスト色・ボーダー色を優先する。

---

### 4. テーマの適用（`viewer-app.tsx`）

```typescript
// 初期化時
const theme = await loadViewerTheme();
document.documentElement.setAttribute("data-theme", theme);

// テーマ変更時
function handleThemeChange(theme: ViewerTheme) {
  persistViewerTheme(theme);
  document.documentElement.setAttribute("data-theme", theme);
}
```

state として `viewerTheme` を保持し、設定パネルに渡す。

---

### 5. 設定UI（`settings-basic-panel.tsx`）

基本設定パネルに「テーマ」セレクタを追加:

```
テーマ: [ライト ▼] / [ダーク ▼]
```

セレクトボックスまたはラジオボタン（既存UIスタイルに合わせる）。
変更時に `onThemeChange(theme)` を呼び出す。

Props に追加:
```typescript
currentTheme: ViewerTheme;
onThemeChange: (theme: ViewerTheme) => void;
```

---

## 確認すべき既存コード

| ファイル | 確認ポイント |
|---|---|
| `src/features/settings/archive-language.ts` | `loadArchiveLanguage()` の読み書きパターン |
| `src/features/viewer/components/viewer-app.tsx` | テーマ state の追加箇所、`settings-basic-panel` への props 渡し方 |
| `src/features/viewer/components/settings-basic-panel.tsx` | 既存の Props 型、UIレイアウト |
| ビューア用 CSS ファイル（`style.css` 等） | 現在ハードコードされている色値の確認 |

---

## Acceptance Criteria

1. 設定画面の基本設定にテーマ切り替えUIが表示される
2. 「ダーク」に切り替えると画面全体が黒背景・赤アクセントになる
3. 「ライト」に切り替えると元の白背景・青アクセントに戻る
4. テーマ選択はページリロード後も維持される
5. `npm run typecheck` ✓
6. `npm run build` ✓

## Codex Plan

## Codex Result

- Viewer theme support is already implemented in the codebase.
- Added `ViewerTheme = "light" | "dark"` to [src/types/viewer.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/types/viewer.ts).
- Added persisted load/save helpers in [src/features/settings/viewer-theme.ts](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/settings/viewer-theme.ts).
- Wired theme state into [src/features/viewer/components/viewer-app.tsx](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/viewer/components/viewer-app.tsx) so the viewer applies `data-theme` to the document root and persists user changes.
- Added the light / dark selector to [src/features/viewer/components/settings-basic-panel.tsx](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/features/viewer/components/settings-basic-panel.tsx).
- Added light and dark CSS variables plus dark-theme component styling in [src/entrypoints/viewer/style.css](/c:/Users/kurah/Documents/Git/x-post-archive-extension/src/entrypoints/viewer/style.css).

## Changed Files

- `src/types/viewer.ts`
- `src/features/settings/viewer-theme.ts`
- `src/features/viewer/components/viewer-app.tsx`
- `src/features/viewer/components/settings-basic-panel.tsx`
- `src/entrypoints/viewer/style.css`

## Verification

- `npm run typecheck`
- `npm run build`
- Code inspection confirmed the settings UI exposes the theme selector, the viewer persists the selected theme, and the root `data-theme` attribute drives the CSS theme tokens.

## Remaining Issues

- No active blocker is recorded for this task.
- Browser-side visual regression verification can be repeated later if theme styling is expanded again, but the feature itself is implemented.

## Suggested Next Action

- Keep this task closed unless theme scope expands beyond the current light / dark selector.
