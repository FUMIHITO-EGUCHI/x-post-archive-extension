# Task Packet — 一覧画面 UI/UX 改善

## Meta
- status: done
- owner: Codex
- branch: feature/viewer-list-ux-improvements
- priority: normal
- files_in_scope: `src/features/viewer/components/viewer-app.tsx`, `src/entrypoints/viewer/style.css`
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: Claude が CDP で一覧画面を実機確認し、発見した UX 課題を優先度順に修正する
- summary: viewer list P1/P2 UX fixes completed; optional P3 toolbar merge and image pending skeleton also implemented

## Goal

CDP Chrome で一覧画面を実機レビューした結果、誤操作リスク・情報欠落・視覚的ノイズの 3 軸で UX 改善が必要な箇所を特定した。
本タスクでは **P1（必須）→ P2（改善）→ P3（余裕があれば）** の順に実装する。
アーカイブの見た目 X 再現より「閲覧しやすさ・操作安全性」を優先するという方針に沿って修正する。

## Requested Action

以下を優先度順に実装する。**P1 を全て実装してから P2 に進む**こと。

---

### P1 — 必須

#### P1-1. 「再取得」「削除」ボタンをホバー時のみ表示

**現状:** 全カードのヘッダー右端に「再取得」「削除」が常時表示されている。削除は破壊的操作のため誤クリックリスクが高く、スキャン時の視覚ノイズになっている。

**対応:**
- カード（`article.post-card` 相当の要素）に `:hover` / フォーカスイン時のみ両ボタンを表示する
- 通常時は `visibility: hidden` または `opacity: 0` で非表示にするが、スペースは確保してレイアウトシフトを起こさないようにする
- キーボードフォーカスが当たった場合も表示されるようにする（アクセシビリティ）

#### P1-2. フィルター適用中の状態をボタンに反映する

**現状:** ユーザー絞り込み・タグ絞り込み・日付絞り込みを適用しても、各ボタンの見た目が変わらず、どのフィルターが効いているか判断できない。

**対応:**
- 各フィルターが適用中（値が設定されている）場合、対応するボタンを「アクティブ」スタイルに変更する
  - 例: 背景色を青系（`#2563eb` など）にして文字色を白にする
  - または既存のボタンバリアントの中でアクティブを表すものがあればそれを使う
- フィルターが解除されたら通常スタイルに戻す

#### P1-3. 件数表示のラベルを明確にする

**現状:** ヘッダーに `50 / 14,739件` と表示されているが、「50」が何を指すかラベルがなく意味が分かりにくい。

**対応:**
- `表示中 50件 / 全 14,739件` のように両者にラベルを付ける
- または `50件を表示中（全14,739件）` など、意味が一目で分かる形式に変更する

---

### P2 — 改善

#### P2-1. X 元リンクを生 URL からテキストリンクへ変更

**現状:** 各カード末尾に `https://x.com/handle/status/...` という長い生 URL がリンクとして表示されている。

**対応:**
- `「X で元投稿を開く」` または `「元投稿」` などの短いテキストリンクに置き換える
- URL を `href` に持ち、表示テキストを短く固定する

#### P2-2. 自動タグと手動タグのスタイルを分ける

**現状:** 「いいね」「画像」「動画」「ブックマーク」「引用」（自動付与タグ）と手動タグが同じ緑系スタイルで表示され、区別できない。

**対応:**
- 自動付与タグ（`system_key` が `null` でないタグ）はグレー系（例: `bg-gray-100 text-gray-600 border border-gray-300`）などの別スタイルで表示する
- 手動タグは現在のスタイルを維持する
- タグ表示コンポーネントでタグの `system_key` を参照してスタイルを分岐する

#### P2-3. タグ編集ダイアログの「閉じる」ボタンの幅を確保する

**現状:** 「投稿タグを編集」ダイアログの「閉じる」ボタンが縦長になっており、テキストが折り返している。

**対応:**
- ボタンに `min-width` を設定して折り返しを防ぐ（例: `min-width: 4rem`）
- または「×」アイコンに置き換えて右上固定配置にする

---

### P3 — 余裕があれば

#### P3-1. 並び順コントロールをフィルターボタン行に統合

**現状:** 「並び順」ラベル + セレクト + 昇降順ボタンがヘッダー右上に、フィルターボタンは左下と行が分かれている。

**対応:**
- 並び順コントロールをフィルターボタンと同一行の右端に移動し、ツールバーを 1 行に統合する
- 「並び順」ラベルは省略し、セレクト + 昇降順ボタンのみにする（セレクトの現在値が並び順を示すため）

#### P3-2. 画像ロード中の「画像を準備中です。」をスケルトン表示に変更

**現状:** 画像が遅延ロード中の間、「画像を準備中です。」というテキストが表示される。

**対応:**
- テキストの代わりにグレーの矩形スケルトン（`bg-gray-200 animate-pulse` 相当）で画像プレースホルダーを表示する

---

## In Scope

- `src/features/viewer/components/viewer-app.tsx` — ボタン表示制御・フィルター状態・件数表示・リンク・タグスタイル
- `src/entrypoints/viewer/style.css` — ホバー制御 CSS、スケルトン CSS

## Out Of Scope

- 一覧以外の画面（設定画面など）の変更
- content script / background の変更
- さらに読み込む の無限スクロール化
- 引用投稿のインライン表示

## Constraints

- viewer UI（React + inline style / CSS）のみ変更。content script・background は触らない
- 既存のアーカイブデータモデルは変更しない
- `npm run typecheck` と `npm run build` を必ず通過させること

## Files To Read First

- `src/features/viewer/components/viewer-app.tsx` — ボタン・フィルター状態・タグ表示の実装箇所を特定する
- `src/entrypoints/viewer/style.css` — 既存スタイルを把握する
- `src/types/archive.ts` — `ArchiveTagRecord.system_key` の型定義を確認する

## Inputs From Claude

Claude が CDP 実機レビューで取得したスクリーンショット（レビュー時の会話を参照）から確認した現状:

- 一覧画面の「再取得」「削除」ボタンはカードヘッダー右端に常時表示（青・赤のアウトラインボタン）
- フィルターボタンは白背景・ボーダーのアウトラインボタンで 4 つ横並び（アクティブ・非アクティブで見た目同一）
- 件数は `50 / 14,739件` とラベルなしで表示
- X 元リンクは全文 URL でカード末尾に表示
- タグチップは自動・手動とも同じ緑系スタイル
- タグ編集ダイアログの「閉じる」ボタンはモーダル右上の小さいボタン（幅が狭く折り返しあり）

## Acceptance Criteria

- [x] 一覧でカードをホバーしていない状態では「再取得」「削除」ボタンが非表示（領域は確保）
- [x] カードをホバーまたはフォーカスした状態では「再取得」「削除」ボタンが表示される
- [x] ユーザー絞り込みを適用中、「ユーザー絞り込み」ボタンが視覚的にアクティブ状態になる
- [x] タグ絞り込みを適用中、「タグ絞り込み」ボタンが視覚的にアクティブ状態になる
- [x] 日付絞り込みを適用中、「日付絞り込み」ボタンが視覚的にアクティブ状態になる
- [x] 件数表示が「表示中 N件 / 全 M件」または同等の意味が分かる表記になっている
- [x] X 元リンクが「元投稿を開く」などの短いテキストリンクになっている（P2）
- [x] 自動タグと手動タグのスタイルが視覚的に区別できる（P2）
- [x] タグ編集ダイアログの「閉じる」ボタンが折り返さずに表示される（P2）
- [x] `npm run typecheck` pass
- [x] `npm run build` pass

## Open Questions

- ホバー非表示の実装方法: CSS の `visibility: hidden / visible` が望ましいが、タッチデバイス（将来的な対応）では常時表示が必要になる可能性がある。PC 専用と割り切って CSS hover で実装してよい。
- フィルターアクティブ状態のスタイル: 既存の viewer テーマカラーに合わせた青系が望ましい。具体的な色値は `viewer-app.tsx` 内の既存スタイル定義を参照して統一する。

## Work Log

- `2026-04-13 Claude`: CDP 実機レビューにより一覧画面の UX 課題を特定、本タスクパケットを作成

## Codex Plan

1. `current-task.md` を新しい viewer list UX タスクに同期し、作業ブランチを切る。
2. 一覧ヘッダー、カードアクション、タグ表示、元投稿リンク、タグ編集ダイアログの実装箇所を確認する。
3. P1 を実装してから P2 を実装し、余裕分として画像準備中表示のスケルトン化を入れる。
4. `npm run typecheck` と `npm run build` を通し、handoff 記録を更新する。

## Codex Result

Implemented the viewer list UX fixes on `feature/viewer-list-ux-improvements`.

- Synced `ai-handoff/current-task.md` to the active viewer list UX task.
- Added active visual state and `aria-pressed` to user, tag, and date filter buttons.
- Changed the archive count label to show explicit loaded/total meaning (`表示中 N件 / 全 M件` / `Showing N / M posts`).
- Hid per-card refetch/delete actions until hover, focus-within, or touch-hoverless environments while keeping their layout space reserved.
- Replaced raw X post URLs with a fixed text link (`元投稿を開く` / `Open original post`).
- Split tag chip styling by `system_key`: auto tags now use the neutral base style and manual tags keep the manual green style.
- Added minimum width and no-wrap styling to modal close buttons, including the post tag edit dialog.
- Moved sort controls into the filter toolbar row and visually hid the redundant sort label while keeping it accessible.
- Implemented the optional P3-2 image pending skeleton with hidden accessible text.

## Changed Files

- `src/entrypoints/viewer/style.css`
- `src/features/viewer/components/tag-picker-overlay.tsx`
- `src/features/viewer/components/viewer-app.tsx`

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run handoff:check`
- Shared CDP Chrome (`Port 9223`) after reloading the unpacked extension:
  - viewer rendered 50 cards with count label `表示中 50件 / 全 14,739件`
  - first card actions were hidden at rest (`opacity: 0`, `pointer-events: none`)
  - focusing the first refetch button made the card match `:focus-within` and actions visible (`opacity: 1`)
  - first source link text was `元投稿を開く`
  - both manual and auto tag chip classes were present
  - pending image skeleton elements were present
- Shared CDP Chrome (`Port 9223`) after the P3-1 follow-up build:
  - `.viewer-list-controls` rendered as `display: flex` with wrapping
  - `.viewer-filter-controls` and `.viewer-sort-controls` shared the same parent in filter-before-sort order
  - the visible toolbar button texts were `ユーザー絞り込み`, `タグ絞り込み`, `日付絞り込み`, `一括タグ付け`, and `降順`
  - the sort label text remained available but used `viewer-visually-hidden`

## Remaining Issues

- None.

## Suggested Next Action

- Task complete.

## Completion Checklist
- [x] P1-1: 「再取得」「削除」ホバー時のみ表示
- [x] P1-2: フィルターアクティブ状態の可視化
- [x] P1-3: 件数表示ラベルの明確化
- [x] P2-1: X 元リンクをテキストリンクへ
- [x] P2-2: 自動タグと手動タグのスタイル分離
- [x] P2-3: タグ編集ダイアログ「閉じる」ボタン幅確保
- [x] P3-1: 並び順コントロールをフィルター行に統合（余裕があれば）
- [x] P3-2: 画像ロード中スケルトン表示（余裕があれば）
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
