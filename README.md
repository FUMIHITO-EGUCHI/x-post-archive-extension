# X Post Archive Extension

X の投稿を 1 件ずつ保存して、あとから一覧で見返すための Chrome 拡張です。
初版では保存、一覧、削除だけに絞っています。

## Stack

- WXT
- TypeScript
- React
- IndexedDB
- Dexie

## Current MVP

- X の投稿ごとに保存ボタンを表示
- `x_post_id`, `x_username`, `post_text`, `post_url`, `saved_at` を保存
- viewer で保存済み投稿を新しい順に表示
- viewer から投稿を削除

## Commands

```bash
npm install
npm run typecheck
npm run build
```

開発時:

```bash
npm run dev
```

Chrome では `.output/chrome-mv3/` を unpacked extension として読み込みます。

## Docs

- [requirements](./docs/requirements.md)
- [mvp-plan](./docs/mvp-plan.md)
- [data-model](./docs/data-model.md)
- [implementation-steps](./docs/implementation-steps.md)
