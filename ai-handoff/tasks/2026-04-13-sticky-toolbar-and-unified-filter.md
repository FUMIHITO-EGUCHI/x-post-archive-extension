# Task Packet — スティッキーツールバー & 統合フィルターモーダル

## Meta
- status: done
- owner: Codex
- branch: feature/sticky-toolbar-unified-filter
- priority: normal
- files_in_scope: `src/features/viewer/components/viewer-app.tsx`, `src/features/viewer/components/sticky-toolbar.tsx`, `src/features/viewer/components/unified-filter-modal.tsx`, `src/entrypoints/viewer/style.css`
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: 要件定義・設計済み。スティッキーバーと統合フィルターモーダルを実装する

## Goal

現状のフィルター・ソートコントロールはスクロール時に消えてしまい、絞り込みボタンも3つに分散している。
本タスクでは:

1. スクロールに随伴するスティッキーツールバーを導入し、絞り込み・ソート・設定への遷移をまとめる
2. ユーザー・タグ・日付の3フィルターを単一のタブ式モーダルに統合する
3. 複数フィルター適用中に中央チップ領域を `+N` にまとめ、クリックで全条件を確認できるようにする

## Requested Action

### 1. スティッキーツールバー

`viewer-hero`（設定ボタン行）と `viewer-list-header`（フィルター行・ソート行）を廃止し、
新コンポーネント `StickyToolbar` に置き換える。

```
StickyToolbar
  [左] 「絞り込み」ボタン         ← アクティブフィルター合計数バッジ付き
  [中] アクティブフィルターチップ群（横スクロールなし / +N でまとめる）
  [右] ソート select + 昇降順ボタン + 件数表示 + 設定ボタン（歯車）
```

**レイアウト仕様:**
- `position: sticky; top: 0; z-index: 100`
- `background: var(--color-bg)` に `backdrop-filter: blur(8px)` を組み合わせて半透明感を出す
- 右端構成: `件数表示（小文字）→ ソートselect → 昇降順ボタン → 設定ボタン` の順に並べる
- 「一括タグ付け」ボタンはツールバー内の「絞り込み」ボタンの右隣りに配置する
  - `viewer-secondary-button` を使い、disabled 条件は現行と同じ（`status !== "ready" || archiveTotalCount === 0`）

**チップ領域の +N まとめ仕様:**
- アクティブなフィルターが 2 個以下のとき: 個別チップを横並びで表示（各チップに × ボタン）
- アクティブなフィルターが 3 個のとき: `+3 件の絞り込み中` ボタンを表示
- `+N` ボタンをクリックすると `UnifiedFilterModal` を開き、最初に表示するタブをアクティブフィルターの中で最初のもの（ユーザー > タグ > 日付の優先順）に設定する
- 個別チップのラベル形式:
  - ユーザー: `@screen_name ×`
  - タグ: `タグ: display_name ×`
  - 日付: `日付 ×`

**件数表示:**
- 右端に `表示中 N件 / 全 M件` を小さいテキストで表示する
- 現行の `viewer-list-heading` 内 `<span>` の `formatArchiveCountLabel()` をそのまま流用する

### 2. 統合フィルターモーダル

新コンポーネント `UnifiedFilterModal` を作成する。既存の3モーダルの内部UIをこのコンポーネントに統合する。

**Props 定義（参考）:**
```ts
type UnifiedFilterModalProps = {
  isOpen: boolean;
  initialTab: "user" | "tag" | "date";
  onClose: () => void;
  // ユーザーフィルター関連（既存props引き継ぎ）
  activeAuthorFilter: string | null;
  userSummaries: UserSummary[];
  displayedUserOptions: UserSummary[];
  hasMoreUserOptions: boolean;
  remainingUserOptionCount: number;
  userSearchQuery: string;
  onUserSearchQueryChange: (v: string) => void;
  onToggleAuthorFilter: (screenName: string) => void;
  onLoadMoreUsers: () => void;
  // タグフィルター関連（既存props引き継ぎ）
  activeTagFilter: string | null;
  availableTags: ArchiveTagSummaryRecord[];
  displayedTagOptions: ArchiveTagSummaryRecord[];
  hasMoreTagOptions: boolean;
  remainingTagOptionCount: number;
  tagSearchQuery: string;
  tagSortOption: TagSortOption;
  onTagSearchQueryChange: (v: string) => void;
  onTagSortOptionChange: (v: TagSortOption) => void;
  onToggleTagFilter: (normalizedName: string) => void;
  onLoadMoreTags: () => void;
  getTagDisplayName: (tag: ArchiveTagRecord) => string;
  // 日付フィルター関連（既存props引き継ぎ）
  activeDateFrom: string | null;
  activeDateTo: string | null;
  activeDateFilterTarget: DateFilterTarget | null;
  dateFilterDraftFrom: string;
  dateFilterDraftTo: string;
  dateFilterDraftTarget: DateFilterTarget;
  dateFilterDraftError: string | null;
  onDateFilterDraftFromChange: (v: string) => void;
  onDateFilterDraftToChange: (v: string) => void;
  onDateFilterDraftTargetChange: (v: DateFilterTarget) => void;
  onApplyDateFilter: () => void;
  onClearDateFilter: () => void;
  language: ArchiveLanguage;
};
```

**タブ仕様:**
- タブボタン行に `ユーザー` `タグ` `日付` の3タブ
- アクティブなフィルターが存在するタブに件数バッジを表示する（例: `タグ (1)`）
  - ユーザー: `activeAuthorFilter !== null` → バッジ `1`
  - タグ: `activeTagFilter !== null` → バッジ `1`
  - 日付: `hasActiveDateFilter` → バッジ `1`
- `<section role="dialog" aria-modal="true">` で実装（既存 3 モーダルと同じ構造）
- `useDialogA11y` フックを呼ぶ（`isOpen`, `containerRef`, `initialFocusRef`, `onClose` 渡す）
- 「閉じる」ボタンは右上固定ではなく、タブ行の右端に `×` ボタンで配置する
- 各タブ内のUI・ハンドラーは既存コードをそのまま移植する（`isTagFilterModalOpen` 系モーダル内のJSXをカット&ペースト）

### 3. viewer-app.tsx の変更

- `isTagFilterModalOpen`, `isAuthorFilterModalOpen`, `isDateFilterModalOpen` を削除し、`isFilterModalOpen: boolean` と `filterModalActiveTab: "user" | "tag" | "date"` に置き換える
- `openFilterModal(tab: "user" | "tag" | "date")` ヘルパーを追加する
- 3つの `useDialogA11y` 呼び出し（タグ・著者・日付用）を `UnifiedFilterModal` 内に移動する
- `viewer-hero` セクション（設定ボタン）と `viewer-list-header` セクション全体を `<StickyToolbar />` に置き換える
- アクティブフィルター表示行（`viewer-active-tag-filter` × 3）を削除する（チップはツールバーに統合）

### 4. style.css の変更

以下の CSS を追加・変更する:

```
.viewer-sticky-toolbar       /* sticky バー本体 */
.viewer-toolbar-left         /* 左: フィルター + 一括タグ */
.viewer-toolbar-center       /* 中: チップ群 */
.viewer-toolbar-right        /* 右: ソート + 件数 + 設定 */
.viewer-filter-chip          /* 個別フィルターチップ */
.viewer-filter-chip-clear    /* チップ × ボタン */
.viewer-filter-chip-overflow /* +N まとめボタン */
.viewer-unified-filter-modal /* 統合フィルターモーダル */
.viewer-filter-modal-tabs    /* タブ行 */
.viewer-filter-tab-button    /* 各タブボタン */
.viewer-filter-tab-button-active /* アクティブタブ */
.viewer-filter-tab-badge     /* アクティブバッジ */
.viewer-filter-tab-panel     /* タブパネル */
.viewer-toolbar-count        /* 件数表示テキスト */
```

- モーダルは既存の `viewer-modal-overlay` / `viewer-modal-inner` クラスを使い回してよい
- sticky バーは `border-bottom: 1px solid var(--color-border)` でリスト本体と区切る

## In Scope

- `src/features/viewer/components/viewer-app.tsx`
- `src/features/viewer/components/sticky-toolbar.tsx`（新規）
- `src/features/viewer/components/unified-filter-modal.tsx`（新規）
- `src/entrypoints/viewer/style.css`

## Out Of Scope

- 設定画面の変更
- content script / background の変更
- セッション復元ロジックの変更（State の名前変更のみで実装は維持）
- `useDialogA11y` / `useIncrementalList` フック本体の変更

## Constraints

- `npm run typecheck` と `npm run build` を通過させること
- ダーク/ライトテーマ両対応: `var(--color-*)` トークンのみ使う（ハードコード色は避ける）
- アクセシビリティ: `aria-modal`, `aria-pressed`, `role="dialog"`, `role="tablist"`, `role="tab"`, `role="tabpanel"` を適切に使う
- 既存の絞り込み・ソート・削除ロジックは変更しない（UIの再配置のみ）

## Files To Read First

1. `src/features/viewer/components/viewer-app.tsx`
   - l.1502〜1745: `return (` から `viewer-active-tag-filter` 3件の末尾まで — 現行ツールバーJSX全体
   - l.127〜135: フィルターモーダル open state 定義
   - l.213〜261: モーダル open/close ハンドラーと `useDialogA11y` 呼び出し
   - l.348〜375: `useIncrementalList` 呼び出し（タグ・ユーザー）
2. `src/entrypoints/viewer/style.css`
   - l.873〜971: `viewer-list-header` 〜 `viewer-active-tag-filter` の既存スタイル
   - l.142〜187: `viewer-hero` / `viewer-eyebrow-row` の既存スタイル（廃止予定）
3. `src/types/viewer.ts` — `UserSummary`, `DateFilterTarget`, `PostSortField`, `SortDirection` 型
4. `src/features/viewer/components/use-dialog-a11y.ts` — フックのシグネチャ確認
5. `src/features/viewer/components/tag-picker-overlay.tsx` — 既存モーダルのパターン確認

## Inputs From Claude

- 設計確認済み事項（2026-04-13 Claude レビュー）:
  - 一括タグ付けボタンはツールバー内「絞り込み」ボタンの右隣
  - 件数表示はスティッキーバー右端
  - フィルターチップ溢れは `+N` にまとめ、クリックで統合フィルターモーダルを開く（最初のアクティブタブを開く）

## Acceptance Criteria

- [x] スクロール時にツールバーが画面上部に固定されたままになる
- [x] 「絞り込み」ボタン 1 つで統合フィルターモーダルが開く
- [x] モーダル内のユーザー / タグ / 日付タブが切り替えられる
- [x] アクティブなフィルターが存在するタブにバッジが表示される
- [x] フィルター適用中、ツールバー中央にチップが表示される
- [x] フィルターが 3 個全て適用中は `+3 件の絞り込み中` にまとまる
- [x] `+N` ボタンクリックで統合モーダルが開き、最初のアクティブタブが選択されている
- [x] 各チップの × ボタンで個別にフィルターが解除される
- [x] 件数表示がツールバー右端に表示される（`表示中 N件 / 全 M件` 形式）
- [x] 一括タグ付けボタンがツールバーに収まっている
- [x] 設定ボタン（歯車）がツールバー右端に表示される
- [x] ダークモードで視覚的に崩れない
- [x] Escape キーでモーダルが閉じる
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Open Questions

- なし（設計は確認済み）

## Work Log

- `2026-04-13 Claude`: 要件定義・設計をレビューし、本タスクパケットを作成

## Codex Plan

1. `feature/sticky-toolbar-unified-filter` ブランチを切る
2. `viewer-app.tsx` のフィルターモーダル State を `isFilterModalOpen` + `filterModalActiveTab` に整理する
3. `unified-filter-modal.tsx` を作成し、既存 3 モーダルの JSX を移植する
4. `sticky-toolbar.tsx` を作成し、ツールバーレイアウトを実装する
5. `viewer-app.tsx` から `viewer-hero` と `viewer-list-header` を `<StickyToolbar>` に置き換える
6. `style.css` に sticky バー・チップ・タブのスタイルを追加し、不要になった旧スタイルをコメントアウト（削除は後続タスクで）
7. `npm run typecheck` と `npm run build` を確認する
8. handoff 記録を更新する

## Codex Result

`StickyToolbar` と `UnifiedFilterModal` を追加し、viewer の絞り込み UI をスティッキーツールバー + 単一タブ式モーダルへ統合した。

- 既存のユーザー / タグ / 日付の個別モーダル state と JSX を統合モーダルへ移動
- ツールバー内に絞り込みボタン、一括タグ付け、フィルターチップ、件数、ソート、設定ボタンを配置
- フィルター 3 種が同時に有効な場合は `+3 件の絞り込み中` に集約し、クリックで最初のアクティブタブを開く
- 各チップの × で個別解除できるようにした
- `+N 件の絞り込み中` 表示の左に全絞り込み条件を一括解除する × ボタンを追加した
- 有効条件数に関係なく、ツールバー中央の絞り込みチップ表示は常に `× +N 件の絞り込み中` の1枚に統一した
- 全解除用 × と `+N 件の絞り込み中` を同じピル状コンテナ内に収めた（button nested in button は避け、 sibling buttons として実装）
- ダークモードを含む toolbar/modal/chip/tab の CSS を追加

## Changed Files

- `src/features/viewer/components/sticky-toolbar.tsx`
- `src/features/viewer/components/unified-filter-modal.tsx`
- `src/features/viewer/components/viewer-app.tsx`
- `src/entrypoints/viewer/style.css`

## Verification

- `npm run typecheck`
- `npm run build`
- Shared CDP Chrome port 9223:
  - unpacked extension reload
  - viewer toolbar sticky position check (`position: sticky`, `top: 0px`, scroll after top retention)
  - filter modal open check and user/tag/date tab switching
  - active tab badges for user/tag/date filters
  - tag chip display and individual clear button
  - 3 active filters collapsed to `+3 件の絞り込み中`
  - `+N` click opens unified modal with first active tab selected
  - `+3 件の絞り込み中` の左に全解除用 × が表示され、クリック後に `絞り込みなし` へ戻る
  - active filter count 2 still renders as a single collapsed chip and no individual filter chips are shown
  - reset × and `+N 件の絞り込み中` are rendered inside the same collapsed filter chip container
  - count display and bulk tag button placement
  - dark mode visual state check via `data-theme="dark"`
- `npm run typecheck` after follow-up clear-all change
- `npm run build` after follow-up clear-all change
- `npm run typecheck` after always-collapsed chip change
- `npm run build` after always-collapsed chip change
- `npm run typecheck` after nested-reset visual layout change
- `npm run build` after nested-reset visual layout change

## Remaining Issues

None.

## Suggested Next Action

Task complete. Commit when ready.

## Completion Checklist

- [x] StickyToolbar コンポーネント作成
- [x] UnifiedFilterModal コンポーネント作成（3タブ統合）
- [x] viewer-app.tsx: フィルターモーダル State 統合
- [x] viewer-app.tsx: viewer-hero / viewer-list-header を StickyToolbar に置き換え
- [x] style.css: sticky バー・チップ・タブ CSS 追加
- [x] ダークモード確認
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
