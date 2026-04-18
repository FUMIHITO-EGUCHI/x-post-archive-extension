# Task Packet: 動画を自動繰り返し（ループ再生）

## Meta
- status: done
- owner: Codex
- branch: master
- priority: normal
- files_in_scope: src/features/viewer/components/media-lightbox.tsx
- blocked_by: none
- related_findings: none
- needs_from_claude: none
- handoff_to_codex: `<video>` 要素に `loop` 属性を追加するだけ。下記設計参照
- summary:

## Goal

ライトボックスの動画プレイヤーでループ再生を有効にする。動画終端に達したら自動的に先頭に戻って再生を続ける。

## Requested Action

`VideoLightboxDialog` 内の `<video>` 要素（media-lightbox.tsx:299–307）に `loop` 属性を追加する。

### 変更箇所（media-lightbox.tsx 約 299 行目）

```tsx
// 変更前
<video
  className="media-lightbox-video"
  src={activeVideo.objectUrl}
  controls
  autoPlay
  preload="metadata"
  playsInline
/>

// 変更後
<video
  className="media-lightbox-video"
  src={activeVideo.objectUrl}
  controls
  autoPlay
  loop
  preload="metadata"
  playsInline
/>
```

## In Scope

- `src/features/viewer/components/media-lightbox.tsx` の `VideoLightboxDialog` コンポーネント

## Out Of Scope

- post-card.tsx 内のインライン動画プレビュー（ライトボックス外）
- ループ on/off の設定項目

## Constraints

- 変更は `loop` 属性の追加のみ。他の属性・挙動を変えない

## Files To Read First

- `src/features/viewer/components/media-lightbox.tsx`

## Acceptance Criteria

- [ ] 動画ライトボックスで動画終端後に自動的に最初から再生される
- [ ] `npm run typecheck` pass
- [ ] `npm run build` pass

## Open Questions

なし

## Work Log

- `2026-04-18 Claude`: task packet 作成。変更箇所は media-lightbox.tsx:299 の `<video>` 要素のみ

## Codex Plan
- `VideoLightboxDialog` の `<video>` に `loop` 属性を追加する。
- `npm run typecheck` と `npm run build` で確認する。

## Codex Result
ライトボックス内の動画プレイヤーに `loop` 属性を追加し、終端後に自動で先頭から再生されるようにした。

## Changed Files
- `src/features/viewer/components/media-lightbox.tsx`

## Verification
- `npm run typecheck` passed
- `npm run build` passed

## Remaining Issues
none

## Suggested Next Action
none

## Completion Checklist
- [x] implementation finished
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] task packet `Codex Result` or `Result` updated
- [x] task packet `Verification` updated
- [x] `ai-handoff/current-task.md` updated
- [x] `npm run handoff:check`
