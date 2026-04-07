# Task Packet

- GitHub Issue: `#4`

## Goal

タグ、ユーザー絞り込み、タグ管理、自動タグ変換で全件一括表示している UI を無限スクロール化し、viewer の初期表示負荷と再描画負荷を下げる。

## Requested Action

要件整理、設計、実装、型チェック、ビルド確認まで行う。コミットはしない。

## In Scope

- タグ絞り込み UI の全件表示を段階読み込みへ変更
- ユーザー絞り込み UI の全件表示を段階読み込みへ変更
- タグ管理 UI のタグ一覧表示を段階読み込みへ変更
- 自動タグ変換 UI の一覧表示を段階読み込みへ変更
- 件数が多い場合でも操作感を維持できる共通ロジックの導入検討
- viewer 内での無限スクロールまたは `Load more` 方式の選定

## Out Of Scope

- 検索ロジック自体の変更
- DB スキーマ変更
- content script / background の大規模再設計
- 仮想スクロールの本格導入が必要な場合の別基盤整備

## Constraints

- 検索性と操作の自然さを優先し、複雑な UI にはしない
- viewer UI の変更に閉じる
- 既存のフィルタ結果や選択状態を壊さない
- `npm run typecheck` と `npm run build` を通す

## Files To Read First

- `src/features/viewer/components/viewer-app.tsx`
- `src/features/viewer/components/settings-tag-management-panel.tsx`
- `src/features/viewer/components/settings-basic-panel.tsx`
- `src/types/viewer.ts`

## Inputs From Claude

- 現状は対象一覧を全件まとめて描画しており、件数増加時の負荷が気になる
- 対象はタグ、ユーザー絞り込み、タグ管理、自動タグ変換
- 軽量化を目的として全表示から無限スクロールへ寄せたい

## Acceptance Criteria

- 対象 UI が全件即時描画ではなく段階表示になっている
- スクロールまたは追加読み込みで続きを閲覧できる
- 既存の選択、検索、操作フローが破綻していない
- 大量データ時の初期描画負荷が下がる構成になっている
- `npm run typecheck`
- `npm run build`

## Open Questions

- 完全な無限スクロールにするか、明示的な `Load more` にするか
- 一覧取得を UI 側で分割するか、runtime / repository 側にもページングを入れるか
- 対象 4 画面で共通フック化するか、まず個別対応するか

## Codex Plan

- 現在の一覧描画箇所と件数取得経路を整理する
- 共通化可能な段階表示ロジックを決める
- UI を壊さない最小変更で段階表示へ置き換える
- 型チェックとビルドで整合性を確認する

## Codex Result

- 完全な無限スクロールではなく、viewer 側だけで完結する `Load more` 方式を採用した。操作の予測可能性が高く、runtime / DB にページングを増やさずに初期描画負荷を下げられるため。
- `useIncrementalList` 共通フックを追加し、タグ絞り込み、ユーザー絞り込み、タグ管理、自動タグ変換の 4 画面を段階表示へ切り替えた。
- アクティブなタグ / ユーザーや、タグ管理で選択中・編集中の項目が初期表示件数の外に落ちても見えなくならないよう、必要件数を自動で広げるようにした。

## Changed Files

- `src/features/viewer/components/use-incremental-list.ts`
- `src/features/viewer/components/viewer-app.tsx`
- `src/features/viewer/components/settings-tag-management-panel.tsx`
- `src/features/viewer/components/settings-tag-redirects-panel.tsx`
- `src/entrypoints/viewer/style.css`

## Verification

- `npm run typecheck`
- `npm run build`
- Shared CDP Chrome (`.shared-cdp-profile`, port `9223`) で user filter modal の候補数が `40 -> 80` に増え、残件数表示が更新されることを確認
- Shared CDP Chrome 上で tag filter modal の候補数が `40 -> 80` に増え、残件数表示が更新されることを確認
- Shared CDP Chrome 上で settings の `タグ管理` タブを開き、一覧行数が `50 -> 100` に増え、残件数表示が更新されることを確認
- Shared CDP Chrome 上で settings の `自動タグ変換` タブを開き、共有 profile では 20 件のため `Load more` が出ず通常一覧表示になることを確認

## Remaining Issues

- 自動タグ変換一覧の `Load more` 経路自体は、この shared profile では件数が 20 件しかなく未踏。しきい値超過データでの追試余地はある。

## Suggested Next Action

- `#5` の archive date-range filter を設計し、既存の tag / user filter と整合する形で追加する。
