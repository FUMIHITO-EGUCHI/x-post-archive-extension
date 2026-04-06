# Task Packet — 一括タグ付け機能

## Goal

タグを絞り込み条件として使い、条件に一致する投稿に対して一括でタグを付与する。
大量の過去投稿の整理・分類を効率化する。

## User Story

1. 一括タグ付けパネルを開く
2. 「対象を絞り込むタグ」を 1 つ以上選択する（既存タグから選択）
3. 「付与するタグ」を入力または選択する
4. 「適用」を実行すると、絞り込みに一致した全投稿にタグが付与される

### 絞り込みロジック

- **OR 検索を採用**: 選択したいずれかのタグを持つ投稿が対象
- AND 検索は不要（ユーザー確認済み）

### 付与対象の投稿

- 対象タグを持ち、**まだ付与タグを持っていない投稿**のみに付与する（冪等な動作）
- 付与タグが既に存在する投稿はスキップ

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない。

## In Scope

- 一括タグ付け UI パネル（設定画面の「タグ管理」タブに追加、または専用パネル）
- 絞り込みタグの複数選択 UI（既存 TagPickerOverlay の再利用または新規）
- 付与タグの入力 UI（既存タグまたは新規タグ名入力）
- AND / OR 切り替え（絞り込みロジック）
- 適用前の対象件数プレビュー表示（「○件の投稿に付与されます」）
- 実行後の付与件数フィードバック
- background / repository 層への一括付与 API 追加

## Out Of Scope

- 一括タグ削除（タグを外す）
- 一括タグ付けのアンドゥ
- スケジュール実行

## Constraints

- TypeScript strict 維持
- React は viewer UI のみ
- 一括処理はバッチ分割（例: 100 件ずつ）で IndexedDB の過負荷を避ける
- 既存の `requestAddPostTagByName` との整合性を保つ

## Files Likely Involved

- `src/types/runtime.ts` — 新 message 型（一括付与リクエスト）
- `src/entrypoints/background.ts` — 一括付与ハンドラ
- `src/db/repositories/post-tags-repository.ts` — 一括付与クエリ
- `src/features/runtime/client.ts` — 新クライアント関数
- `src/features/viewer/components/settings-tag-management-panel.tsx` — 一括タグ付け UI 追加
- または新規 `src/features/viewer/components/bulk-tag-panel.tsx`

## Open Questions

1. ~~AND / OR どちらをデフォルトにするか?~~ → OR に決定
2. 絞り込み条件に「タグなし」（未分類投稿）を含めるか?
3. 対象件数が多い（例: 1000 件超）場合に進捗表示が必要か?
4. 設定タブ内に置くか、一覧画面の操作として置くか?

## Result

<!-- 完了後に記入 -->
