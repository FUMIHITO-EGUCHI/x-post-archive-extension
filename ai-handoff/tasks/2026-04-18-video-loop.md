# Task Packet: 動画を自動繰り返し（ループ再生）

## Meta
- status: active
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

## Codex Result

## Changed Files

## Verification

## Remaining Issues

## Suggested Next Action

## Completion Checklist
- [ ] implementation finished
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] task packet `Codex Result` or `Result` updated
- [ ] task packet `Verification` updated
- [ ] `ai-handoff/current-task.md` updated
- [ ] `npm run handoff:check`
