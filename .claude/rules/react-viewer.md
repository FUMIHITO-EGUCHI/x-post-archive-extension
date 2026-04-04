---
paths:
  - src/entrypoints/viewer/**/*.ts
  - src/entrypoints/viewer/**/*.tsx
  - src/features/viewer/**/*.ts
  - src/features/viewer/**/*.tsx
---

# React Viewer Rules

- React は viewer UI に限定する。content script と background service worker では使わない
- Hooks はトップレベルでのみ呼ぶ。条件分岐、ループ、ネスト内で呼ばない
- Components and Hooks must be pure を守る
- コンポーネントに重いデータ整形や永続化ロジックを直接詰め込まない。selector / mapper / utility / service に分離する
- viewer UI は X の見た目再現より、検索性・可読性・スレッド順の分かりやすさを優先する
- 表示単位と保存単位を混同しない。UI 都合で保存モデルを歪めない
- タグ、検索、詳細表示のような閲覧体験を中心に組み立てる
