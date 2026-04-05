# Task Packet — ユーザー（投稿者）フィルタ

## Goal

投稿一覧をタグフィルタと同様に投稿者名で絞り込める機能を追加する。
タグフィルタとの AND 条件で動作する。

## Requested Action

実装・型チェック・ビルド確認まで行う。コミットはしない。

## In Scope

- `src/types/viewer.ts` に `UserSummary` 型と `ListPostsPageInput.authorFilter` を追加
- `src/types/runtime.ts` に `RequestUserSummariesMessage` を追加
- `src/features/archive/archive-service.ts` に `listArchiveUserSummaries()` を追加
- `listArchivePostsPage()` に `authorFilter` 対応を追加
- `src/features/runtime/handle-runtime-message.ts` にハンドラーを追加
- `viewer-app.tsx` にユーザー一覧パネルと絞り込みUIを追加

## Out Of Scope

- ユーザーのプロフィール画像の表示
- フォロー中・フォロワーなどの属性でのフィルタ
- 複数ユーザーの同時選択

## Constraints

- TypeScript strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes。`any` 禁止
- viewer UI（React）は `src/features/viewer/` に限定
- `npm run typecheck` ✓ / `npm run build` ✓ を完了条件とする

---

## 実装仕様

### 1. 型の追加（`src/types/viewer.ts`）

```typescript
export interface UserSummary {
  display_name: string;
  screen_name: string;
  post_count: number;
}
```

`ListPostsPageInput` に追加:
```typescript
authorFilter: string | null;   // screen_name の完全一致
```

---

### 2. Runtime メッセージ（`src/types/runtime.ts`）

```typescript
// Request
{ type: "users.summaries" }

// Response
{ type: "users.summaries"; users: UserSummary[] }
```

---

### 3. Service 層（`archive-service.ts`）

#### `listArchiveUserSummaries()`

```
出力: UserSummary[]  — post_count 降順
```

処理:
- `posts` テーブルを全件走査し、`screen_name` でグループ化
- 各グループの `display_name`（最新の値）・`screen_name`・投稿数を集計
- `post_count` 降順でソート

注意: `posts` テーブルに `display_name` インデックスはあるが `screen_name` インデックスは未確認。
全件走査で問題ない規模感のため、インデックスを追加せずに実装する。

#### `listArchivePostsPage()` の修正

- `authorFilter: string | null` を受け取る
- `authorFilter` が non-null の場合: `posts` の `screen_name` で完全一致フィルタを追加（タグフィルタとの AND）

---

### 4. UIの組み込み（`viewer-app.tsx`）

#### state の追加

```typescript
const [activeAuthorFilter, setActiveAuthorFilter] = useState<string | null>(null);
const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
const [userSearchQuery, setUserSearchQuery] = useState("");
```

#### ユーザーパネル

- タグフィルタパネルと同じレイアウト構造で左サイドバーに追加
- 検索テキスト入力フィールド（`display_name` / `screen_name` の部分一致で絞り込み）
- ユーザー一覧: `display_name (@screen_name)` + 投稿数
- アクティブなユーザーをクリック → 解除
- 非アクティブなユーザーをクリック → `setActiveAuthorFilter(screen_name)`

#### フィルタ状態の表示

- アクティブなユーザーフィルタはタグフィルタと同様にフィルタバー等に表示
- 「×」ボタンで解除

#### データ取得

- 初期表示時と投稿保存後に `requestUserSummaries()` を呼び出してキャッシュ
- `activeAuthorFilter` 変更時は投稿一覧を再取得（`listArchivePostsPage` の `authorFilter` に渡す）

---

## 確認すべき既存コード

| ファイル | 確認ポイント |
|---|---|
| `src/features/archive/archive-service.ts` | `listArchiveTagSummaries()` の実装パターン（同様の集計ロジック） |
| `src/features/archive/archive-service.ts` | `listArchivePostsPage()` の現在の実装（tagFilter 対応箇所） |
| `src/types/viewer.ts` | `ListPostsPageInput`、`TagSummary` の現在の定義 |
| `src/features/viewer/components/viewer-app.tsx` | タグパネルのレンダリング箇所（ユーザーパネルの参考） |
| `src/db/repositories/posts-repository.ts` | `screen_name` フィールドの存在確認、クエリパターン |

---

## Acceptance Criteria

1. 左サイドバーにユーザー一覧パネルが表示される
2. ユーザー名で絞り込み検索ができる
3. ユーザーをクリックすると投稿一覧がそのユーザーの投稿のみに絞り込まれる
4. タグフィルタと同時に適用できる（AND 条件）
5. アクティブフィルタが UI に表示され、解除できる
6. `npm run typecheck` ✓
7. `npm run build` ✓

## Codex Plan

## Codex Result

## Changed Files

## Verification

## Remaining Issues

## Suggested Next Action
