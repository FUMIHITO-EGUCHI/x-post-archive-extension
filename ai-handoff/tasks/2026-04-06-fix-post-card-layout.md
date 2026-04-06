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

<!-- 完了後に記入 -->
