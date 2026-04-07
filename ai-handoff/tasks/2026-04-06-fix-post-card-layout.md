# Task Packet — 一覧画面の post-card レイアウト崩れ修正

## Goal

投稿一覧で `article.post-card[data-post-id]` が横方向に伸びてしまう問題を修正する。

## Symptoms

- 一覧画面で特定の投稿カードが横に伸びる
- 原因は未確認。長いURL・ハッシュタグ・幅の広いメディアなど複数の可能性がある

## Requested Action

1. 再現条件の特定（どの投稿で崩れるか）
2. CSS/HTML 構造の調査
3. 最小限の修正で対応する

## Hypotheses（調査起点）

- `word-break` / `overflow-wrap` 未設定による長い URL や連続文字列のはみ出し
- フレックスコンテナの `min-width: 0` 漏れ（flex child が縮小しない）
- 幅が固定されていない画像・動画要素が `max-width: 100%` を持っていない
- post-card の幅がコンテナに対して `width: fit-content` になっている

## In Scope

- `article.post-card` およびその子要素の CSS 修正
- テキスト・メディア・引用ポスト等の各サブコンポーネントの overflow 対応

## Out Of Scope

- レイアウト全体のリデザイン
- viewer 以外のUI変更

## Constraints

- viewer UI（React）のみ変更。content script / background は触らない
- X の見た目再現より可読性・安定性を優先する

## Files Likely Involved

- `src/features/viewer/components/viewer-app.tsx` — スタイル定義箇所を特定する
- viewer 用の CSS ファイル（存在する場合）または inline style

## Result

390px-width shared CDP Chrome verification reproduced horizontal overflow in the viewer: `.viewer-list` was creating a single implicit grid column sized to the post card's max-content width, which let `.post-card` expand to about `454px` inside a `317px` list column. The fix constrains the list to `grid-template-columns: minmax(0, 1fr)`, forces post cards to `width: 100%` with `min-width: 0`, and adds shrink/wrap protection to the header, body text, quoted text, and post links.

After rebuilding and reloading the unpacked extension, the same 390px viewer check showed `document.documentElement.scrollWidth === clientWidth`, `.viewer-list` at `317px`, `.post-card` at `317px`, and no remaining overflow offenders.

## Changed Files

- `src/entrypoints/viewer/style.css`
- `ai-handoff/current-task.md`
- `ai-handoff/tasks/2026-04-06-fix-post-card-layout.md`

## Verification

- `npm run typecheck`
- `npm run build`
- Shared CDP Chrome (`.shared-cdp-profile`, port `9223`)
  - Reproduced overflow at `390px` before the fix: `documentElement.scrollWidth = 483`, `.viewer-list` implicit column `454px`, `.post-card` width `454px`
  - Reloaded the unpacked extension after rebuild
  - Re-checked at `390px` after the fix: `documentElement.scrollWidth = 375`, `.viewer-list` column `317px`, `.post-card` width `317px`, no overflow offenders remained
