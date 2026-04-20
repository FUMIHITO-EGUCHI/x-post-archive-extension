# Task Packet: 無限スクロールとフィルターモーダルのスクロールバー非表示

## Meta
- status: active
- owner: Codex
- branch: master
- priority: medium
- files_in_scope: src/features/viewer/components/viewer-app.tsx, src/entrypoints/viewer/style.css
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: 設計完了。下記 Design 参照
- summary:

## Goal

1. 投稿一覧の「さらに読み込む」ボタンを廃止し、無限スクロールに変更する
2. フィルターモーダルのスクロールバーを非表示にする（スクロール自体は維持）

## Design

### 1. 無限スクロール (`src/features/viewer/components/viewer-app.tsx`)

#### 現状

`viewer-app.tsx` L690-709 に「さらに読み込む」ボタンがある:

```tsx
{hasMorePosts && (
  <div className="viewer-list-footer">
    <button
      className="viewer-action-button"
      type="button"
      onClick={() => { void handleLoadMore(); }}
      disabled={isLoadingMore}
    >
      {isLoadingMore ? "読み込み中..." : "さらに読み込む"}
    </button>
  </div>
)}
```

#### 変更後

load-more ボタンを削除し、sentinel div + `useEffect` で `IntersectionObserver` を設置する。

```tsx
// useRef を追加（コンポーネント上部）
const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

// useEffect を追加（コンポーネント上部、他の useEffect と並べる）
useEffect(() => {
  const sentinel = loadMoreSentinelRef.current;
  if (sentinel === null) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMorePosts && !isLoadingMore) {
        void handleLoadMore();
      }
    },
    { rootMargin: "200px" }
  );
  observer.observe(sentinel);
  return () => observer.disconnect();
}, [hasMorePosts, isLoadingMore, handleLoadMore]);
```

ボタン部分を sentinel div に置き換え:

```tsx
{/* 旧ボタンを削除し sentinel を配置 */}
<div ref={loadMoreSentinelRef} className="viewer-list-sentinel" />
{isLoadingMore && (
  <div className="viewer-list-footer">
    <span>{language === "ja" ? "読み込み中..." : "Loading..."}</span>
  </div>
)}
```

注意:
- `handleLoadMore` が `useCallback` でメモ化されていない場合、`useEffect` の deps に入れると無限再実行になる。`handleLoadMore` の参照が安定しているか確認し、必要なら `useRef` 経由でラップする。
- `hasMorePosts` が `false` になった時点で observer は sentinel を監視しているが、条件チェック (`hasMorePosts && !isLoadingMore`) でガードしているので二重フェッチは起きない。

#### CSS 追加 (`src/entrypoints/viewer/style.css`)

```css
.viewer-list-sentinel {
  height: 1px;
}
```

### 2. フィルターモーダルのスクロールバー非表示 (`src/entrypoints/viewer/style.css`)

#### 現状

- `.viewer-modal` (L1971): `overflow: auto` → ブラウザデフォルトのスクロールバーが出る
- `.viewer-tag-option-list` (L2109-2115): `max-height: min(56vh, 640px); overflow-y: auto` → タグ一覧でもスクロールバーが出る

#### 変更後

スクロール自体は維持しつつ、スクロールバーのみ非表示にする:

```css
/* .viewer-modal に追加 */
.viewer-modal {
  /* 既存スタイルはそのまま */
  scrollbar-width: none; /* Firefox */
}
.viewer-modal::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Edge */
}

/* .viewer-tag-option-list に追加 */
.viewer-tag-option-list {
  /* 既存スタイルはそのまま */
  scrollbar-width: none; /* Firefox */
}
.viewer-tag-option-list::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Edge */
}
```

## Acceptance Criteria

- [ ] 投稿一覧を最下部までスクロールすると自動で次ページが読み込まれる
- [ ] 「さらに読み込む」ボタンが表示されない
- [ ] 読み込み中はローディング表示が出る
- [ ] 全件読み込み完了後はそれ以上ロードされない
- [ ] フィルターモーダル内にスクロールバーが表示されない（スクロール自体は可能）
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Completion Checklist

- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`

## Work Log

- `2026-04-20 Claude`: 設計完了。task packet 作成。Codex へ handoff。

## Codex Result

(未記入)

## Verification

(未記入)
